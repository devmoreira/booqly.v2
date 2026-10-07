// POST /api/painel/assinatura/pagar-com-saldo { planoId }
// Usa o saldo ganho indicando outros profissionais (revenda) pra pagar
// a própria assinatura, sem precisar passar pelo Asaas. Consome as
// comissões pendentes mais antigas primeiro, até cobrir o valor do
// plano — se a última comissão consumida for maior que o necessário,
// ela é gasta inteira mesmo assim (não divide comissão ao meio).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ planoId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: plano } = await admin.from("planos_assinatura").select("id, duracao_meses, valor_centavos").eq("id", validado.data.planoId).single();
  if (!plano) return NextResponse.json({ erro: "plano não encontrado" }, { status: 404 });

  const { data: comissoesPendentes } = await admin
    .from("comissoes_indicacao_profissional")
    .select("id, valor_centavos")
    .eq("profissional_indicador_id", user.id)
    .eq("status", "pendente")
    .order("criado_em", { ascending: true });

  const saldoDisponivel = (comissoesPendentes ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
  if (saldoDisponivel < plano.valor_centavos) {
    return NextResponse.json({ erro: "Saldo insuficiente pra esse plano." }, { status: 400 });
  }

  // Consome as comissões mais antigas primeiro, até cobrir o valor do plano
  const idsParaConsumir: string[] = [];
  let acumulado = 0;
  for (const c of comissoesPendentes ?? []) {
    if (acumulado >= plano.valor_centavos) break;
    idsParaConsumir.push(c.id);
    acumulado += c.valor_centavos;
  }

  // Trava atômica: só marca como "usado" quem AINDA estiver "pendente"
  // nesse exato instante — evita duas requisições simultâneas (dois
  // cliques, ou uso indevido) consumirem a mesma comissão duas vezes.
  const { data: consumidas, error: erroConsumo } = await admin
    .from("comissoes_indicacao_profissional")
    .update({ status: "usado" })
    .in("id", idsParaConsumir)
    .eq("status", "pendente")
    .select("id, valor_centavos");

  if (erroConsumo) return NextResponse.json({ erro: "Não foi possível processar o saldo." }, { status: 500 });

  const valorConsumidoDeVerdade = (consumidas ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
  if (valorConsumidoDeVerdade < plano.valor_centavos) {
    // Perdeu a corrida (outra requisição pegou o saldo primeiro) —
    // devolve o que conseguiu reservar e avisa que não deu.
    await admin.from("comissoes_indicacao_profissional").update({ status: "pendente" }).in("id", (consumidas ?? []).map((c) => c.id));
    return NextResponse.json({ erro: "Saldo insuficiente pra esse plano." }, { status: 400 });
  }

  // Ativa a assinatura direto, igual o webhook faz depois de um
  // pagamento confirmado — só que aqui não tem cobrança nenhuma no Asaas.
  const { data: ativaAtual } = await admin
    .from("assinaturas")
    .select("fim")
    .eq("profissional_id", user.id)
    .eq("status", "ativa")
    .gt("fim", new Date().toISOString())
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseData = ativaAtual ? new Date(ativaAtual.fim) : new Date();
  const novoFim = new Date(baseData);
  novoFim.setMonth(novoFim.getMonth() + plano.duracao_meses);

  const { error } = await admin.from("assinaturas").insert({
    profissional_id: user.id,
    plano_id: plano.id,
    status: "ativa",
    inicio: new Date().toISOString(),
    fim: novoFim.toISOString(),
  });

  if (error) {
    // Reverte o consumo do saldo se não conseguiu ativar a assinatura
    await admin.from("comissoes_indicacao_profissional").update({ status: "pendente" }).in("id", (consumidas ?? []).map((c) => c.id));
    return NextResponse.json({ erro: "Não foi possível ativar a assinatura" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saldoRestanteCentavos: saldoDisponivel - valorConsumidoDeVerdade });
}
