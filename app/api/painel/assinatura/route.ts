// POST /api/painel/assinatura { planoId }
// Cria (ou reaproveita) o cliente no Asaas e a assinatura recorrente,
// devolvendo o link de pagamento pra onde o profissional é redirecionado.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { garantirClienteAsaas, criarAssinaturaAsaas } from "@/lib/payments/asaas-assinatura";
import { obterNomePlataforma } from "@/lib/nome-plataforma";

const schema = z.object({ planoId: z.string().uuid(), cupomCodigo: z.string().optional(), cpfCnpj: z.string().min(11).max(18).optional() });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: comissoesPendentes }, { data: perfil }, { data: assinaturaAtiva }] = await Promise.all([
    admin
      .from("comissoes_indicacao_profissional")
      .select("valor_centavos")
      .eq("profissional_indicador_id", user.id)
      .eq("status", "pendente"),
    admin.from("profissionais").select("cpf_cnpj").eq("id", user.id).maybeSingle(),
    admin
      .from("assinaturas")
      .select("plano_id, fim, planos_assinatura(nome, nivel, valor_centavos, duracao_meses)")
      .eq("profissional_id", user.id)
      .eq("status", "ativa")
      .gt("fim", new Date().toISOString())
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const saldoIndicacaoCentavos = (comissoesPendentes ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
  const plano = assinaturaAtiva?.planos_assinatura as any;
  return NextResponse.json({
    saldoIndicacaoCentavos,
    temCpfCnpj: !!perfil?.cpf_cnpj,
    planoAtual: assinaturaAtiva
      ? { id: assinaturaAtiva.plano_id, nome: plano?.nome, nivel: plano?.nivel, valorCentavos: plano?.valor_centavos, duracaoMeses: plano?.duracao_meses, expiraEm: assinaturaAtiva.fim }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "plano inválido" }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: profissional }, { data: plano }] = await Promise.all([
    admin.from("profissionais").select("id, nome_negocio, asaas_customer_id, cpf_cnpj").eq("id", user.id).maybeSingle(),
    admin.from("planos_assinatura").select("nome, duracao_meses, valor_centavos, ativo").eq("id", validado.data.planoId).single(),
  ]);

  if (!profissional || !plano || !plano.ativo) {
    return NextResponse.json({ erro: "Plano não encontrado" }, { status: 404 });
  }

  const cpfCnpj = validado.data.cpfCnpj ?? profissional.cpf_cnpj;
  if (!cpfCnpj) {
    return NextResponse.json({ erro: "Informe seu CPF ou CNPJ pra continuar." }, { status: 400 });
  }
  if (validado.data.cpfCnpj && validado.data.cpfCnpj !== profissional.cpf_cnpj) {
    await admin.from("profissionais").update({ cpf_cnpj: validado.data.cpfCnpj.replace(/\D/g, "") }).eq("id", profissional.id);
  }

  let valorComDesconto = plano.valor_centavos;
  let cupomId: string | null = null;

  const { data: configPlataforma } = await admin.from("configuracoes_plataforma").select("funcionalidade_cupons_ativa").eq("id", 1).single();
  const cuponsGlobalAtiva = configPlataforma?.funcionalidade_cupons_ativa ?? true;

  if (validado.data.cupomCodigo && cuponsGlobalAtiva) {
    const codigo = validado.data.cupomCodigo.toUpperCase().trim();
    const { data: cupom } = await admin
      .from("cupons")
      .select("id, tipo, valor, ativo, validade, usos_maximos, usos_atuais")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!cupom || !cupom.ativo) {
      return NextResponse.json({ erro: "Cupom inválido." }, { status: 400 });
    }
    if (cupom.validade && new Date(cupom.validade).getTime() < Date.now()) {
      return NextResponse.json({ erro: "Esse cupom expirou." }, { status: 400 });
    }
    if (cupom.usos_maximos !== null && cupom.usos_atuais >= cupom.usos_maximos) {
      return NextResponse.json({ erro: "Esse cupom já atingiu o limite de usos." }, { status: 400 });
    }

    const descontoCentavos = cupom.tipo === "percentual"
      ? Math.round(plano.valor_centavos * (Number(cupom.valor) / 100))
      : Math.round(Number(cupom.valor) * 100);
    valorComDesconto = Math.max(100, plano.valor_centavos - descontoCentavos); // nunca abaixo de R$1,00
    cupomId = cupom.id;

    await admin.from("cupons").update({ usos_atuais: cupom.usos_atuais + 1 }).eq("id", cupom.id);
  }

  try {
    const customerId = await garantirClienteAsaas({
      id: profissional.id,
      nomeNegocio: profissional.nome_negocio,
      email: user.email,
      asaasCustomerId: profissional.asaas_customer_id,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
    });

    const nomePlataforma = await obterNomePlataforma();
    const { subscriptionId, linkPagamento } = await criarAssinaturaAsaas({
      customerId,
      valorCentavos: valorComDesconto,
      duracaoMeses: plano.duracao_meses,
      externalReference: `assinatura_${profissional.id}_${validado.data.planoId}_${cupomId ?? "sem-cupom"}`,
      descricao: `Assinatura ${nomePlataforma} — ${plano.nome}${cupomId ? " (com cupom)" : ""}`,
    });

    await admin.from("profissionais").update({ asaas_subscription_id: subscriptionId }).eq("id", profissional.id);

    if (!linkPagamento) {
      return NextResponse.json({ erro: "Assinatura criada, mas sem link de pagamento. Fale com o suporte." }, { status: 500 });
    }
    return NextResponse.json({ linkPagamento });
  } catch (erro: any) {
    console.error("Erro ao criar assinatura no Asaas:", erro);
    return NextResponse.json({ erro: erro.message ?? "Não foi possível iniciar a assinatura" }, { status: 500 });
  }
}
