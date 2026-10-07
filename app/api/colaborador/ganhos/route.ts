// GET /api/colaborador/ganhos?dataInicio=&dataFim=
// Resumo de ganhos só do colaborador logado.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const hoje = new Date();
  const dataInicio = req.nextUrl.searchParams.get("dataInicio") ?? new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const dataFim = req.nextUrl.searchParams.get("dataFim") ?? hoje.toISOString().slice(0, 10);

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("id, inicio, valor_pago_centavos, servico_id, cliente_id")
    .eq("colaborador_id", user.id)
    .eq("status", "concluido")
    .gte("inicio", `${dataInicio}T00:00:00`)
    .lte("inicio", `${dataFim}T23:59:59`)
    .order("inicio");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const lista = agendamentos ?? [];
  const servicoIds = [...new Set(lista.map((a) => a.servico_id))];
  const clienteIds = [...new Set(lista.map((a) => a.cliente_id))];

  const [{ data: servicos }, { data: clientes }] = await Promise.all([
    servicoIds.length > 0 ? supabase.from("servicos").select("id, nome, preco_centavos").in("id", servicoIds) : Promise.resolve({ data: [] as any[] }),
    clienteIds.length > 0 ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));

  const detalhado = lista.map((a) => {
    const servico = mapaServicos.get(a.servico_id);
    const valor = a.valor_pago_centavos > 0 ? a.valor_pago_centavos : (servico?.preco_centavos ?? 0);
    return {
      data: a.inicio,
      servico: servico?.nome ?? "",
      cliente: mapaClientes.get(a.cliente_id)?.nome ?? "",
      valorCentavos: valor,
    };
  });

  const totalGeralCentavos = detalhado.reduce((soma, item) => soma + item.valorCentavos, 0);

  return NextResponse.json({ periodo: { dataInicio, dataFim }, detalhado, totalGeralCentavos });
}
