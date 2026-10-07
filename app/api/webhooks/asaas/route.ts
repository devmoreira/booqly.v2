// POST /api/webhooks/asaas
// O Asaas chama essa URL quando um pagamento muda de status — mas hoje
// isso só é usado pra ASSINATURA DA PLATAFORMA (o profissional pagando
// pra usar o Booqly), que continua sendo cobrada pela NOSSA própria
// conta Asaas, configurada em Admin → Pagamentos.
//
// O pagamento do CLIENTE pro profissional não passa mais por aqui —
// desde o modelo de "traga sua própria chave", cada profissional usa a
// conta dele, e a confirmação acontece por consulta (polling), em
// /api/checkout-status — não tem como o Asaas nos avisar de um evento
// que acontece na conta de outra pessoa.
//
// Segurança: o Asaas permite configurar um "token de autenticação" que
// ele envia em todo webhook. Comparamos esse token (guardado no banco,
// não no .env — configurável em /admin/pagamentos) antes de processar
// qualquer coisa.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { garantirClienteAsaas, criarAssinaturaAsaas, cancelarAssinaturaAsaas } from "@/lib/payments/asaas-assinatura";
import { enviarNotificacaoPush } from "@/lib/push";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { segredosIguais } from "@/lib/comparar-segredo";

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("configuracoes_plataforma")
    .select("asaas_webhook_token")
    .eq("id", 1)
    .single();

  const tokenRecebido = req.headers.get("asaas-access-token");
  if (!config?.asaas_webhook_token || !tokenRecebido || !segredosIguais(tokenRecebido, config.asaas_webhook_token)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  }

  const evento = await req.json().catch(() => null);
  const statusAsaas: string | undefined = evento?.payment?.status;
  const externalReference: string | undefined = evento?.payment?.externalReference;
  const subscriptionId: string | undefined = evento?.payment?.subscription;
  const cobrancaIdExterno: string | undefined = evento?.payment?.id;

  if (!statusAsaas || !cobrancaIdExterno) return NextResponse.json({ erro: "payload inválido" }, { status: 400 });

  // TRAVA DE SEGURANÇA: o Asaas pode reenviar o mesmo aviso mais de uma
  // vez (é esperado, não é bug deles). Sem isso, um reenvio criava a
  // assinatura DUAS vezes. A trava usa a combinação pagamento+status
  // como chave única.
  const chaveEvento = `${cobrancaIdExterno}:${statusAsaas}`;
  const { error: erroChave } = await admin.from("webhooks_asaas_processados").insert({ chave: chaveEvento });
  if (erroChave) {
    if (erroChave.code === "23505") return NextResponse.json({ ok: true, duplicado: true });
    console.error("Erro inesperado na trava de idempotência do webhook:", erroChave);
    return NextResponse.json({ erro: "falha interna" }, { status: 500 });
  }

  const pago = statusAsaas === "CONFIRMED" || statusAsaas === "RECEIVED";
  const vencida = statusAsaas === "OVERDUE";

  if (pago && externalReference?.startsWith("assinatura_")) {
    await processarPagamentoAssinatura(admin, externalReference, subscriptionId);
  }

  if (pago && externalReference?.startsWith("upgradeplano_")) {
    await processarUpgradeDePlano(admin, externalReference);
  }

  if (vencida && externalReference?.startsWith("assinatura_")) {
    await avisarRenovacaoFalhou(admin, externalReference);
  }

  return NextResponse.json({ ok: true });
}

async function processarPagamentoAssinatura(
  admin: ReturnType<typeof createAdminClient>,
  externalReference: string,
  subscriptionId: string | undefined
) {
  const partes = externalReference.split("_");
  const profissionalId = partes[1];
  const planoId = partes[2];
  const cupomId = partes[3] && partes[3] !== "sem-cupom" ? partes[3] : null;
  if (!profissionalId || !planoId) return;

  const { data: plano } = await admin.from("planos_assinatura").select("duracao_meses").eq("id", planoId).single();
  if (!plano) return;

  const { data: ativaAtual } = await admin
    .from("assinaturas")
    .select("fim")
    .eq("profissional_id", profissionalId)
    .eq("status", "ativa")
    .gt("fim", new Date().toISOString())
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Confere ANTES de inserir se essa vai ser a primeira assinatura de
  // verdade dele — usado só pra decidir se credita a comissão de
  // indicação de profissional (que só vale na primeira).
  const { count: assinaturasAnteriores } = await admin
    .from("assinaturas")
    .select("id", { count: "exact", head: true })
    .eq("profissional_id", profissionalId);
  const ehPrimeiraAssinatura = (assinaturasAnteriores ?? 0) === 0;

  const baseData = ativaAtual ? new Date(ativaAtual.fim) : new Date();
  const novoFim = new Date(baseData);
  novoFim.setMonth(novoFim.getMonth() + plano.duracao_meses);

  const { data: novaAssinatura } = await admin.from("assinaturas").insert({
    profissional_id: profissionalId,
    plano_id: planoId,
    cupom_id: cupomId,
    status: "ativa",
    inicio: new Date().toISOString(),
    fim: novoFim.toISOString(),
  }).select("id").single();

  if (ehPrimeiraAssinatura && novaAssinatura) {
    const [{ data: profissional }, { data: config }] = await Promise.all([
      admin.from("profissionais").select("indicado_por_profissional_id, indicado_por_cliente_id, indicado_por_colaborador_id").eq("id", profissionalId).single(),
      admin.from("configuracoes_plataforma").select("valor_comissao_indicacao_profissional_centavos, valor_comissao_indicacao_cliente_centavos, valor_comissao_indicacao_colaborador_centavos").eq("id", 1).single(),
    ]);
    const valorComissao = config?.valor_comissao_indicacao_profissional_centavos ?? 0;
    const valorComissaoCliente = config?.valor_comissao_indicacao_cliente_centavos ?? 0;
    const valorComissaoColaborador = config?.valor_comissao_indicacao_colaborador_centavos ?? 0;

    if (profissional?.indicado_por_profissional_id && valorComissao > 0) {
      await admin.from("comissoes_indicacao_profissional").insert({
        profissional_indicador_id: profissional.indicado_por_profissional_id,
        profissional_indicado_id: profissionalId,
        assinatura_id: novaAssinatura.id,
        valor_centavos: valorComissao,
      });
    }

    if (profissional?.indicado_por_cliente_id && valorComissaoCliente > 0) {
      await admin.from("comissoes_indicacao_cliente").insert({
        cliente_indicador_id: profissional.indicado_por_cliente_id,
        profissional_indicado_id: profissionalId,
        assinatura_id: novaAssinatura.id,
        valor_centavos: valorComissaoCliente,
      });
    }

    if (profissional?.indicado_por_colaborador_id && valorComissaoColaborador > 0) {
      await admin.from("comissoes_indicacao_colaborador").insert({
        colaborador_indicador_id: profissional.indicado_por_colaborador_id,
        profissional_indicado_id: profissionalId,
        assinatura_id: novaAssinatura.id,
        valor_centavos: valorComissaoColaborador,
      });
    }
  }
}

async function processarUpgradeDePlano(admin: ReturnType<typeof createAdminClient>, externalReference: string) {
  // "upgradeplano_{idDoRegistroEmTrocasDePlanoPendentes}"
  const trocaId = externalReference.replace("upgradeplano_", "");
  const { data: troca } = await admin
    .from("trocas_de_plano_pendentes")
    .select("profissional_id, assinatura_id, novo_plano_id")
    .eq("id", trocaId)
    .maybeSingle();
  if (!troca) return;

  const profissionalId = troca.profissional_id;
  const assinaturaId = troca.assinatura_id;
  const novoPlanoId = troca.novo_plano_id;

  const [{ data: assinatura }, { data: novoPlano }, { data: profissional }] = await Promise.all([
    admin.from("assinaturas").select("id, fim").eq("id", assinaturaId).single(),
    admin.from("planos_assinatura").select("duracao_meses, valor_centavos, nome").eq("id", novoPlanoId).single(),
    admin.from("profissionais").select("id, nome_negocio, asaas_customer_id, asaas_subscription_id").eq("id", profissionalId).single(),
  ]);
  if (!assinatura || !novoPlano || !profissional) return;

  // Troca o plano da assinatura ATUAL agora mesmo — mantém a mesma data
  // de fim (já foi paga a diferença proporcional até lá).
  await admin.from("assinaturas").update({ plano_id: novoPlanoId }).eq("id", assinaturaId);

  // Cancela a assinatura recorrente antiga (senão continuaria cobrando
  // o valor do plano velho pra sempre) e cria uma nova, já no valor do
  // plano novo, mas só cobrando de verdade a partir de quando o ciclo
  // atual (já pago) termina.
  try {
    if (profissional.asaas_customer_id) {
      if (profissional.asaas_subscription_id) {
        await cancelarAssinaturaAsaas(profissional.asaas_subscription_id).catch((erro) =>
          console.error("Falha ao cancelar assinatura antiga no upgrade:", erro)
        );
      }

      const nomePlataforma = await obterNomePlataforma();
      const { subscriptionId } = await criarAssinaturaAsaas({
        customerId: profissional.asaas_customer_id,
        valorCentavos: novoPlano.valor_centavos,
        duracaoMeses: novoPlano.duracao_meses,
        externalReference: `assinatura_${profissional.id}_${novoPlanoId}_sem-cupom`,
        descricao: `Assinatura ${nomePlataforma} — ${novoPlano.nome}`,
        nextDueDate: assinatura.fim.slice(0, 10), // só cobra de novo quando o ciclo atual, já pago, terminar
      });
      await admin.from("profissionais").update({ asaas_subscription_id: subscriptionId }).eq("id", profissional.id);
    }
  } catch (erro) {
    console.error("Falha ao criar assinatura recorrente nova após upgrade:", erro);
  }

  await admin.from("trocas_de_plano_pendentes").delete().eq("id", trocaId);
}

async function avisarRenovacaoFalhou(admin: ReturnType<typeof createAdminClient>, externalReference: string) {
  // "assinatura_{profissionalId}_{planoId}_{cupomOuSemCupom}"
  const profissionalId = externalReference.split("_")[1];
  if (!profissionalId) return;

  try {
    const nomePlataforma = await obterNomePlataforma();
    await enviarNotificacaoPush(profissionalId, {
      titulo: "Sua assinatura não foi renovada ⚠️",
      corpo: `A cobrança da sua assinatura do ${nomePlataforma} venceu sem pagamento. Regularize pra não perder o acesso.`,
      url: "/assinatura",
    });
  } catch (erro) {
    console.error(`Falha ao avisar profissional ${profissionalId} sobre renovação vencida:`, erro);
  }
}
