// GET /api/painel/ganhos?dataInicio=&dataFim=
// Resumo de ganhos do estabelecimento inteiro, detalhado por colaborador.
// O dinheiro cai direto na conta do próprio profissional (Pix/cartão via
// Asaas ou Mercado Pago) — o valor mostrado aqui é o valor cheio recebido,
// sem nenhuma comissão de plataforma descontada.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const hoje = new Date();
  const dataInicio = req.nextUrl.searchParams.get("dataInicio") ?? new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const dataFim = req.nextUrl.searchParams.get("dataFim") ?? hoje.toISOString().slice(0, 10);

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("id, inicio, valor_pago_centavos, servico_id, colaborador_id, cliente_id")
    .eq("profissional_id", user.id)
    .eq("status", "concluido")
    .gte("inicio", `${dataInicio}T00:00:00`)
    .lte("inicio", `${dataFim}T23:59:59`)
    .order("inicio");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const lista = agendamentos ?? [];
  const servicoIds = [...new Set(lista.map((a) => a.servico_id))];
  const colaboradorIds = [...new Set(lista.map((a) => a.colaborador_id).filter(Boolean))];
  const clienteIds = [...new Set(lista.map((a) => a.cliente_id))];
  const agendamentoIds = lista.map((a) => a.id);

  const admin = createAdminClient();
  const [{ data: servicos }, { data: colaboradores }, { data: clientes }, { data: cobrancas }] = await Promise.all([
    servicoIds.length > 0 ? supabase.from("servicos").select("id, nome, preco_centavos").in("id", servicoIds) : Promise.resolve({ data: [] as any[] }),
    colaboradorIds.length > 0 ? supabase.from("colaboradores").select("id, nome").in("id", colaboradorIds) : Promise.resolve({ data: [] as any[] }),
    clienteIds.length > 0 ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : Promise.resolve({ data: [] as any[] }),
    agendamentoIds.length > 0
      ? admin.from("cobrancas").select("agendamento_id, tipo, valor_centavos, status").in("agendamento_id", agendamentoIds).eq("status", "pago")
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaColaboradores = new Map((colaboradores ?? []).map((c) => [c.id, c]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));
  const mapaCobrancas = new Map((cobrancas ?? []).map((c) => [c.agendamento_id, c]));

  const detalhado = lista.map((a) => {
    const servico = mapaServicos.get(a.servico_id);
    const precoServico = servico?.preco_centavos ?? 0;
    const cobranca = mapaCobrancas.get(a.id);

    let valor: number;
    let viaPagamentoOnline = false;
    if (cobranca) {
      viaPagamentoOnline = true;
      // O dinheiro cai 100% na sua conta — sem comissão de plataforma
      // descontada. Se foi só a taxa de agendamento, o resto do serviço
      // foi pago por fora (dinheiro/cartão direto com o cliente).
      const restoPagoPorFora = cobranca.tipo === "taxa_agendamento" ? Math.max(0, precoServico - cobranca.valor_centavos) : 0;
      valor = cobranca.valor_centavos + restoPagoPorFora;
    } else {
      // Não passou pela plataforma — recebido direto pelo profissional, sem desconto
      valor = precoServico;
    }

    return {
      data: a.inicio,
      servico: servico?.nome ?? "",
      cliente: mapaClientes.get(a.cliente_id)?.nome ?? "",
      colaborador: a.colaborador_id ? mapaColaboradores.get(a.colaborador_id)?.nome ?? "" : "Você (sem colaborador)",
      valorCentavos: valor,
      viaPagamentoOnline,
    };
  });

  const porColaboradorMapa = new Map<string, { colaboradorId: string | null; nome: string; quantidade: number; totalCentavos: number }>();
  for (const item of detalhado) {
    const chave = item.colaborador;
    if (!porColaboradorMapa.has(chave)) {
      porColaboradorMapa.set(chave, { colaboradorId: null, nome: item.colaborador, quantidade: 0, totalCentavos: 0 });
    }
    const acumulado = porColaboradorMapa.get(chave)!;
    acumulado.quantidade += 1;
    acumulado.totalCentavos += item.valorCentavos;
  }

  const totalGeralCentavos = detalhado.reduce((soma, item) => soma + item.valorCentavos, 0);

  return NextResponse.json({
    periodo: { dataInicio, dataFim },
    porColaborador: [...porColaboradorMapa.values()],
    totalGeralCentavos,
    detalhado,
  });
}
