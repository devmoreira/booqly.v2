// POST /api/painel/assinatura/upgrade { planoId }
// Troca de plano NO MEIO do ciclo já pago — cobra só a diferença
// proporcional pelos dias que sobraram (ex: pagou 3 meses de Básico,
// sobrou 1 mês, quer virar Premium: calcula quanto vale esse mês em
// Básico, desconta do valor do Premium, e cobra só a diferença).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { garantirClienteAsaas, criarCobrancaUnicaAsaas } from "@/lib/payments/asaas-assinatura";
import { obterNomePlataforma } from "@/lib/nome-plataforma";

const VALOR_MINIMO_ASAAS_CENTAVOS = 500; // regra do próprio Asaas, não é nossa

const schema = z.object({ planoId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "plano inválido" }, { status: 400 });

  const admin = createAdminClient();

  const [{ data: profissional }, { data: assinaturaAtiva }, { data: novoPlano }] = await Promise.all([
    admin.from("profissionais").select("id, nome_negocio, asaas_customer_id, cpf_cnpj").eq("id", user.id).maybeSingle(),
    admin
      .from("assinaturas")
      .select("id, inicio, fim, plano_id, planos_assinatura(nome, valor_centavos)")
      .eq("profissional_id", user.id)
      .eq("status", "ativa")
      .gt("fim", new Date().toISOString())
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("planos_assinatura").select("nome, valor_centavos, ativo").eq("id", validado.data.planoId).single(),
  ]);

  if (!profissional) return NextResponse.json({ erro: "profissional não encontrado" }, { status: 404 });
  if (!novoPlano || !novoPlano.ativo) return NextResponse.json({ erro: "Plano não encontrado" }, { status: 404 });
  if (!profissional.cpf_cnpj) return NextResponse.json({ erro: "Informe seu CPF ou CNPJ em Assinatura antes de trocar de plano." }, { status: 400 });

  if (!assinaturaAtiva) {
    return NextResponse.json({ erro: "Você ainda não tem uma assinatura ativa pra trocar — assine um plano primeiro." }, { status: 400 });
  }

  const planoAtual = assinaturaAtiva.planos_assinatura as any;
  if (assinaturaAtiva.plano_id === validado.data.planoId) {
    return NextResponse.json({ erro: "Você já está nesse plano." }, { status: 400 });
  }
  if (novoPlano.valor_centavos <= planoAtual.valor_centavos) {
    return NextResponse.json({ erro: "Essa troca só funciona pra planos mais caros que o atual. Pra trocar por um mais barato, fale com o suporte." }, { status: 400 });
  }

  // Proporcional: quanto do plano atual ainda "vale" pelos dias que
  // faltam, descontado do preço cheio do plano novo.
  const inicio = new Date(assinaturaAtiva.inicio).getTime();
  const fim = new Date(assinaturaAtiva.fim).getTime();
  const agora = Date.now();
  const diasTotais = Math.max(1, (fim - inicio) / 86_400_000);
  const diasRestantes = Math.max(0, (fim - agora) / 86_400_000);
  const valorDiarioAtual = planoAtual.valor_centavos / diasTotais;
  const creditoCentavos = Math.round(diasRestantes * valorDiarioAtual);
  const valorCobrarCentavos = Math.max(VALOR_MINIMO_ASAAS_CENTAVOS, novoPlano.valor_centavos - creditoCentavos);

  try {
    const customerId = await garantirClienteAsaas({
      id: profissional.id,
      nomeNegocio: profissional.nome_negocio,
      email: user.email,
      asaasCustomerId: profissional.asaas_customer_id,
      cpfCnpj: profissional.cpf_cnpj.replace(/\D/g, ""),
    });

    // O Asaas limita "externalReference" a 100 caracteres — não cabem
    // 3 UUIDs juntos ali, então guardamos os dados numa tabela e usamos
    // só o ID desse registro (1 UUID) na referência da cobrança.
    const { data: troca, error: erroTroca } = await admin
      .from("trocas_de_plano_pendentes")
      .insert({ profissional_id: profissional.id, assinatura_id: assinaturaAtiva.id, novo_plano_id: validado.data.planoId })
      .select("id")
      .single();
    if (erroTroca || !troca) {
      return NextResponse.json({ erro: "Não foi possível registrar a troca de plano" }, { status: 500 });
    }

    const nomePlataforma = await obterNomePlataforma();
    const { linkPagamento } = await criarCobrancaUnicaAsaas({
      customerId,
      valorCentavos: valorCobrarCentavos,
      externalReference: `upgradeplano_${troca.id}`,
      descricao: `${nomePlataforma} — troca pra ${novoPlano.nome} (proporcional)`,
    });

    if (!linkPagamento) {
      return NextResponse.json({ erro: "Cobrança criada, mas sem link de pagamento. Fale com o suporte." }, { status: 500 });
    }

    return NextResponse.json({
      linkPagamento,
      creditoCentavos,
      valorCobrarCentavos,
      diasRestantes: Math.round(diasRestantes),
    });
  } catch (erro: any) {
    console.error("Erro ao criar cobrança de troca de plano:", erro);
    return NextResponse.json({ erro: erro.message ?? "Não foi possível processar a troca de plano" }, { status: 500 });
  }
}
