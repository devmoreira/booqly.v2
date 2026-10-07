// POST /api/agendamentos
// Único caminho pelo qual um agendamento é criado. O formulário público
// (página do profissional) chama essa rota — nunca insere direto no
// Supabase pelo navegador. Isso permite validar tudo (dados do cliente,
// conflito de horário, regra de cobrança) num só lugar, protegido.
//
// IMPORTANTE: quando o profissional exige pagamento, o agendamento NÃO
// é criado aqui — só reservamos o horário temporariamente
// (checkouts_pendentes) e o agendamento de verdade só nasce quando o
// Asaas confirma o pagamento (ver o webhook). Isso evita gente
// "reservando" horário sem nunca pagar.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGatewayAtivo } from "@/lib/payments/adapter";
import { notificarNovoAgendamento } from "@/lib/notificacoes";
import { clienteEstaBloqueado } from "@/lib/bloqueio-cliente";
import { telefoneParaE164 } from "@/lib/telefone";
import { descriptografar } from "@/lib/crypto";
import { gatewayEstaAtivo } from "@/lib/gateway-disponibilidade";
import { estornarCobranca } from "@/lib/payments/estorno";

const MINUTOS_EXPIRACAO_CHECKOUT = 20;

const schema = z.object({
  profissionalId: z.string().uuid(),
  servicoId: z.string().uuid(),
  colaboradorId: z.string().uuid().optional(),
  inicio: z.string().datetime(),
  formaPagamento: z.enum(["pix", "credito", "debito"]).optional(), // só quando o profissional exige pagamento
  cupomCodigo: z.string().max(30).optional(),
  usarSaldoIndicacao: z.boolean().optional(),
  cliente: z.object({
    nome: z.string().min(2).max(120),
    telefone: z.string().min(8).max(20),
    email: z.string().email().optional(),
    documento: z.string().min(11).max(18).optional(), // CPF ou CNPJ — exigido pelo Asaas quando cobra
  }),
});

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) {
    return NextResponse.json({ erro: "Dados inválidos", detalhes: validado.error.flatten() }, { status: 400 });
  }
  const { profissionalId, servicoId, colaboradorId, inicio, formaPagamento, cupomCodigo, usarSaldoIndicacao, cliente } = validado.data;
  const { documento: documentoCliente, ...dadosClienteBruto } = cliente; // "documento" não é coluna da tabela clientes — só usado na cobrança

  const telefoneValidado = telefoneParaE164(dadosClienteBruto.telefone);
  if (!telefoneValidado) {
    return NextResponse.json({ erro: "Telefone inválido" }, { status: 400 });
  }
  const dadosCliente = { ...dadosClienteBruto, telefone: telefoneValidado };

  const admin = createAdminClient();

  // Se um colaborador foi escolhido, confere que ele é de verdade desse
  // profissional e está ativo (nunca confia no que veio do navegador)
  let statusInicial: "pendente" | "confirmado" = "pendente";
  if (colaboradorId) {
    const { data: colaborador } = await admin
      .from("colaboradores")
      .select("profissional_id, ativo, confirmacao_automatica")
      .eq("id", colaboradorId)
      .single();
    if (!colaborador || colaborador.profissional_id !== profissionalId || !colaborador.ativo) {
      return NextResponse.json({ erro: "Colaborador inválido" }, { status: 400 });
    }
    if (colaborador.confirmacao_automatica) statusInicial = "confirmado";
  } else {
    // Sem colaborador escolhido — só é permitido se o estabelecimento
    // não tiver NENHUM colaborador ativo. Se tiver, é obrigatório escolher um.
    const { count: colaboradoresAtivos } = await admin
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profissionalId)
      .eq("ativo", true);
    if ((colaboradoresAtivos ?? 0) > 0) {
      return NextResponse.json({ erro: "Escolha um profissional pra continuar." }, { status: 400 });
    }
  }

  // Busca o serviço pra pegar duração e preço reais — NUNCA confia em
  // valor/duração vindos do navegador, sempre recalcula a partir do banco.
  const { data: servico } = await admin
    .from("servicos")
    .select("duracao_minutos, preco_centavos, profissional_id, ativo")
    .eq("id", servicoId)
    .single();

  if (!servico || servico.profissional_id !== profissionalId || !servico.ativo) {
    return NextResponse.json({ erro: "Serviço não encontrado" }, { status: 404 });
  }

  const inicioDate = new Date(inicio);
  const fimDate = new Date(inicioDate.getTime() + servico.duracao_minutos * 60_000);

  // Impede overbooking: rejeita se já existe um agendamento (ou uma
  // reserva de pagamento ainda válida) que colide com esse horário.
  let consultaConflito = admin
    .from("agendamentos")
    .select("id")
    .eq("profissional_id", profissionalId)
    .neq("status", "cancelado")
    .lt("inicio", fimDate.toISOString())
    .gt("fim", inicioDate.toISOString());
  consultaConflito = colaboradorId
    ? consultaConflito.eq("colaborador_id", colaboradorId)
    : consultaConflito.is("colaborador_id", null);
  const { data: conflito } = await consultaConflito.limit(1);

  let consultaConflitoCheckout = admin
    .from("checkouts_pendentes")
    .select("id")
    .eq("profissional_id", profissionalId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .lt("inicio", fimDate.toISOString())
    .gt("fim", inicioDate.toISOString());
  consultaConflitoCheckout = colaboradorId
    ? consultaConflitoCheckout.eq("colaborador_id", colaboradorId)
    : consultaConflitoCheckout.is("colaborador_id", null);
  const { data: conflitoCheckout } = await consultaConflitoCheckout.limit(1);

  if ((conflito && conflito.length > 0) || (conflitoCheckout && conflitoCheckout.length > 0)) {
    return NextResponse.json({ erro: "Esse horário acabou de ser ocupado. Escolha outro." }, { status: 409 });
  }

  // Se o cliente já existe (mesmo telefone), reaproveita o cadastro em
  // vez de criar um novo. O nome E o CPF ficam FIXOS depois de criados —
  // ninguém consegue usar o mesmo telefone com uma identidade diferente
  // depois (protege contra fraude/confusão de identidade).
  let clienteId: string;
  const { data: existente } = await admin.from("clientes").select("id, nome, cpf_cnpj").eq("telefone", dadosCliente.telefone).maybeSingle();
  const documentoLimpo = documentoCliente ? documentoCliente.replace(/\D/g, "") : undefined;

  if (existente) {
    clienteId = existente.id;
    if (documentoLimpo) {
      const nomeBate = existente.nome.trim().toLowerCase() === dadosCliente.nome.trim().toLowerCase();
      const cpfBate = !existente.cpf_cnpj || existente.cpf_cnpj === documentoLimpo;
      if (!nomeBate || !cpfBate) {
        return NextResponse.json({ erro: "Esses dados não correspondem ao cadastro desse telefone." }, { status: 400 });
      }
      if (!existente.cpf_cnpj) {
        await admin.from("clientes").update({ cpf_cnpj: documentoLimpo }).eq("id", existente.id);
      }
    }
  } else {
    const { data: novo, error: erroCliente } = await admin
      .from("clientes")
      .insert({ ...dadosCliente, cpf_cnpj: documentoLimpo ?? null })
      .select("id")
      .single();
    if (erroCliente || !novo) return NextResponse.json({ erro: "Não foi possível registrar o cliente" }, { status: 500 });
    clienteId = novo.id;
  }

  if (await clienteEstaBloqueado(profissionalId, clienteId)) {
    return NextResponse.json({ erro: "Não foi possível concluir esse agendamento. Entre em contato diretamente com o estabelecimento." }, { status: 403 });
  }

  // Confere a regra de cobrança do profissional ANTES de decidir se cria
  // o agendamento direto ou só a reserva de pagamento.
  const [{ data: cobrancaConfig }, { data: profissional }] = await Promise.all([
    admin.from("configuracoes_cobranca").select("metodo, taxa_tipo, taxa_valor").eq("profissional_id", profissionalId).maybeSingle(),
    admin.from("profissionais").select("gateway_pagamento, gateway_ambiente, gateway_status, chave_api_pagamento_criptografada").eq("id", profissionalId).single(),
  ]);

  // Pagamento online (Pix/cartão na hora de agendar) só existe se o
  // profissional já cadastrou a própria chave de API válida — sem
  // isso, sempre cai pra "receber na mão" (pos_servico), sem exceção.
  const metodo = cobrancaConfig?.metodo ?? "pos_servico";
  const pagamentoDisponivel =
    metodo !== "pos_servico" &&
    profissional?.gateway_status === "valido" &&
    !!profissional.chave_api_pagamento_criptografada;

  // Sem pagamento exigido (ou pagamento indisponível no momento): cria
  // o agendamento direto, do jeito que sempre funcionou.
  if (metodo === "pos_servico" || !pagamentoDisponivel) {
    const { data: agendamento, error: erroAgendamento } = await admin
      .from("agendamentos")
      .insert({
        profissional_id: profissionalId,
        colaborador_id: colaboradorId ?? null,
        servico_id: servicoId,
        cliente_id: clienteId,
        inicio: inicioDate.toISOString(),
        fim: fimDate.toISOString(),
        status: statusInicial,
      })
      .select("id")
      .single();

    if (erroAgendamento || !agendamento) {
      if (erroAgendamento?.code === "23P01") {
        return NextResponse.json({ erro: "Esse horário acabou de ser ocupado por outra pessoa. Escolha outro." }, { status: 409 });
      }
      return NextResponse.json({ erro: "Não foi possível criar o agendamento" }, { status: 500 });
    }

    notificarNovoAgendamento(admin, profissionalId, servicoId, cliente.nome, inicioDate).catch((erro) =>
      console.error("Falha ao notificar novo agendamento:", erro)
    );

    return NextResponse.json({
      agendamentoId: agendamento.id,
      clienteId,
      statusAgendamento: statusInicial,
      aviso: metodo !== "pos_servico"
        ? "Pagamento online indisponível no momento — combine o pagamento direto com o estabelecimento."
        : undefined,
    }, { status: 201 });
  }

  // A partir daqui, pagamento é obrigatório — o agendamento só nasce
  // depois que o Asaas confirmar. Por enquanto, só reserva o horário.
  if (!formaPagamento) {
    return NextResponse.json({ erro: "Escolha uma forma de pagamento" }, { status: 400 });
  }
  if (!documentoCliente) {
    return NextResponse.json({ erro: "Informe seu CPF ou CNPJ pra concluir o pagamento." }, { status: 400 });
  }

  const valorTotalCentavos = servico.preco_centavos;
  const valorACobrar = metodo === "taxa_agendamento"
    ? (cobrancaConfig?.taxa_tipo === "percentual"
        ? Math.round(valorTotalCentavos * (Number(cobrancaConfig.taxa_valor) / 100))
        : Math.round(Number(cobrancaConfig?.taxa_valor ?? 0) * 100))
    : valorTotalCentavos;

  // Cupom de CLIENTE: o desconto sai do bolso da plataforma, não do
  // profissional — ele recebe como se o cliente tivesse pago o valor cheio.
  let cupomId: string | null = null;
  let descontoCentavos = 0;
  if (cupomCodigo) {
    const { data: funcionalidades } = await admin
      .from("configuracoes_plataforma")
      .select("funcionalidade_cupons_ativa")
      .eq("id", 1)
      .single();
    if (funcionalidades?.funcionalidade_cupons_ativa === false) {
      return NextResponse.json({ erro: "Cupons estão temporariamente indisponíveis." }, { status: 400 });
    }

    const { data: cupom } = await admin
      .from("cupons")
      .select("id, tipo, valor, ativo, validade, usos_maximos, usos_atuais, usos_maximos_por_empresa, publico, profissional_id")
      .eq("codigo", cupomCodigo.toUpperCase())
      .maybeSingle();

    let valido = !!cupom && cupom.publico === "cliente" && cupom.ativo
      && (!cupom.validade || new Date(cupom.validade) >= new Date())
      && (cupom.usos_maximos == null || cupom.usos_atuais < cupom.usos_maximos)
      // Cupom da plataforma (profissional_id nulo) vale em qualquer
      // estabelecimento; cupom criado por um profissional só vale nele mesmo.
      && (cupom!.profissional_id == null || cupom!.profissional_id === profissionalId);

    if (valido && cupom!.usos_maximos_por_empresa != null) {
      const { data: usoPorEmpresa } = await admin
        .from("cupom_usos_por_profissional")
        .select("usos_atuais")
        .eq("cupom_id", cupom!.id)
        .eq("profissional_id", profissionalId)
        .maybeSingle();
      if ((usoPorEmpresa?.usos_atuais ?? 0) >= cupom!.usos_maximos_por_empresa) {
        valido = false;
      }
    }

    if (!valido) {
      return NextResponse.json({ erro: "Cupom inválido, expirado, ou já usado o máximo de vezes nesse estabelecimento." }, { status: 400 });
    }
    cupomId = cupom!.id;
    descontoCentavos = cupom!.tipo === "percentual"
      ? Math.round(valorACobrar * (Number(cupom!.valor) / 100))
      : Math.round(Number(cupom!.valor) * 100);
    descontoCentavos = Math.min(descontoCentavos, valorACobrar); // nunca fica negativo
  }
  let valorComDesconto = valorACobrar - descontoCentavos;

  // Saldo de indique e ganhe (em dinheiro) — desconto extra, por cima
  // do cupom, se o cliente pedir pra usar. Consome as comissões mais
  // antigas primeiro, sem dividir (mesmo padrão usado na assinatura).
  let idsComissoesConsumidas: string[] = [];
  let descontoSaldoCentavos = 0;
  if (usarSaldoIndicacao) {
    const { data: comissoesDisponiveis } = await admin
      .from("comissoes_indicacao_cliente")
      .select("id, valor_centavos")
      .eq("cliente_indicador_id", clienteId)
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });

    let saldoAUsar = 0;
    for (const c of comissoesDisponiveis ?? []) {
      if (saldoAUsar >= valorComDesconto) break;
      saldoAUsar += c.valor_centavos;
      idsComissoesConsumidas.push(c.id);
    }

    if (idsComissoesConsumidas.length > 0) {
      // Trava atômica: só marca como "usado" quem AINDA estiver
      // "pendente" nesse exato instante — evita duas requisições
      // simultâneas consumirem a mesma comissão duas vezes.
      const { data: consumidasDeVerdade } = await admin
        .from("comissoes_indicacao_cliente")
        .update({ status: "usado" })
        .in("id", idsComissoesConsumidas)
        .eq("status", "pendente")
        .select("id, valor_centavos");

      saldoAUsar = (consumidasDeVerdade ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
      idsComissoesConsumidas = (consumidasDeVerdade ?? []).map((c) => c.id);
    }

    const descontoSaldo = Math.min(saldoAUsar, valorComDesconto);
    valorComDesconto -= descontoSaldo;
    descontoSaldoCentavos = descontoSaldo;
  }

  const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO_CHECKOUT * 60_000);
  const { data: checkout, error: erroCheckout } = await admin
    .from("checkouts_pendentes")
    .insert({
      profissional_id: profissionalId,
      colaborador_id: colaboradorId ?? null,
      servico_id: servicoId,
      cliente_id: clienteId,
      inicio: inicioDate.toISOString(),
      fim: fimDate.toISOString(),
      metodo,
      forma_pagamento: formaPagamento,
      valor_centavos: valorComDesconto,
      valor_original_centavos: valorACobrar,
      cupom_id: cupomId,
      desconto_centavos: descontoCentavos,
      desconto_saldo_centavos: descontoSaldoCentavos,
      expira_em: expiraEm.toISOString(),
    })
    .select("id")
    .single();

  if (erroCheckout || !checkout) {
    if (idsComissoesConsumidas.length > 0) {
      await admin
        .from("comissoes_indicacao_cliente")
        .update({ status: "pendente" })
        .in("id", idsComissoesConsumidas)
        .eq("status", "usado");
    }
    return NextResponse.json({ erro: "Não foi possível reservar o horário" }, { status: 500 });
  }

  // Não existe mais Split — o dinheiro cai 100% na conta do próprio
  // profissional. Só calculamos aqui quanto SERIA a fatia do
  // colaborador (se tiver um nesse agendamento), pra repassar por Pix
  // normal depois que o pagamento confirmar (ver /api/checkout-status).
  let colaboradorValorCentavos = 0;
  if (colaboradorId) {
    const { data: colaboradorInfo } = await admin
      .from("colaboradores")
      .select("percentual_comissao, pix_chave")
      .eq("id", colaboradorId)
      .maybeSingle();
    if (colaboradorInfo?.percentual_comissao && colaboradorInfo.pix_chave) {
      colaboradorValorCentavos = Math.round(valorComDesconto * (Number(colaboradorInfo.percentual_comissao) / 100));
    }
  }
  if (colaboradorValorCentavos > 0) {
    await admin.from("checkouts_pendentes").update({ colaborador_valor_centavos: colaboradorValorCentavos }).eq("id", checkout.id);
  }

  try {
    const apiKeyProfissional = descriptografar(profissional!.chave_api_pagamento_criptografada!);
    if (!(await gatewayEstaAtivo(profissional!.gateway_pagamento as "asaas" | "mercadopago"))) {
      throw new Error("Esse estabelecimento está com o pagamento temporariamente indisponível. Tente de novo mais tarde.");
    }
    const gateway = getGatewayAtivo(profissional!.gateway_pagamento as "asaas" | "mercadopago");
    const cobranca = await gateway.criarCobranca({
      referenciaId: `checkout_${checkout.id}`, // vira a externalReference — sem agendamento de verdade ainda
      profissionalId,
      valorCentavos: valorComDesconto,
      forma: formaPagamento,
      descricao: metodo === "taxa_agendamento" ? "Taxa de agendamento" : "Pagamento do serviço",
      clienteNome: cliente.nome,
      clienteEmail: cliente.email ?? `${clienteId}@sem-email.booqly.internal`,
      clienteDocumento: documentoLimpo!,
      apiKey: apiKeyProfissional,
      ambiente: (profissional!.gateway_ambiente as "sandbox" | "production") ?? "sandbox",
    });

    const { error: erroSalvarCobranca } = await admin
      .from("checkouts_pendentes")
      .update({ cobranca_id_externo: cobranca.cobrancaIdExterno })
      .eq("id", checkout.id);

    if (erroSalvarCobranca) {
      try {
        await estornarCobranca(
          cobranca.cobrancaIdExterno,
          profissional!.gateway_pagamento as "asaas" | "mercadopago",
          apiKeyProfissional,
          (profissional!.gateway_ambiente as "sandbox" | "production") ?? "sandbox"
        );
      } catch (erroEstorno) {
        console.error("Cobrança criada, mas falhou ao salvar o ID no checkout e também falhou o estorno:", erroEstorno);
      }
      throw new Error("Não foi possível registrar o pagamento. Se a cobrança foi criada, o sistema tentou estorná-la.");
    }

    return NextResponse.json({
      checkoutId: checkout.id,
      clienteId,
      descontoCentavos,
      expiraEm: expiraEm.toISOString(),
      pagamento: {
        qrCodePix: cobranca.qrCodePix,
        qrCodeImagemBase64: cobranca.qrCodeImagemBase64,
        linkPagamento: cobranca.linkPagamento,
      },
    }, { status: 201 });
  } catch (erro: any) {
    console.error("Erro ao criar cobrança:", erro);
    await admin.from("checkouts_pendentes").update({ status: "falhou" }).eq("id", checkout.id);
    if (idsComissoesConsumidas.length > 0) {
      await admin
        .from("comissoes_indicacao_cliente")
        .update({ status: "pendente" })
        .in("id", idsComissoesConsumidas)
        .eq("status", "usado");
    }
    // Nunca exponha detalhes internos da conta/gateway ao cliente.
    // Em especial, mensagens como "conta precisa estar aprovada" são
    // administrativas e devem virar uma indisponibilidade amigável.
    const erroGateway = String(erro?.message ?? "");
    const pixIndisponivel =
      formaPagamento === "pix" &&
      (/pix/i.test(erroGateway) || /aprovad/i.test(erroGateway)) &&
      (/dispon[ií]vel|indispon[ií]vel|aprovad/i.test(erroGateway));

    const mensagem = pixIndisponivel
      ? "O pagamento via PIX está temporariamente indisponível. Tente novamente mais tarde."
      : /inválid|invalido|inválido/i.test(erroGateway)
        ? erroGateway
        : "Não foi possível gerar o pagamento. Tente novamente mais tarde.";

    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
