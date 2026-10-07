// GET /api/painel/visao-geral — resumo do painel do profissional
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularStatusAcesso } from "@/lib/assinatura";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);
  const inicioMes = new Date(inicioHoje.getFullYear(), inicioHoje.getMonth(), 1);

  const statusAcesso = await calcularStatusAcesso(user.id);
  if (statusAcesso.motivo === "perfil_nao_encontrado") {
    return NextResponse.json({ erro: "Essa área é só para donos de estabelecimento." }, { status: 403 });
  }

  const [
    { count: pendentes },
    { data: hoje, error: erroHoje },
    { count: concluidosNoMes },
    { data: clientesUnicos },
  ] = await Promise.all([
    supabase.from("agendamentos").select("id", { count: "exact", head: true })
      .eq("profissional_id", user.id).eq("status", "pendente"),
    supabase.from("agendamentos")
      .select("id, inicio, status, servico_id, cliente_id")
      .eq("profissional_id", user.id)
      .neq("status", "cancelado")
      .gte("inicio", inicioHoje.toISOString())
      .lte("inicio", fimHoje.toISOString())
      .order("inicio"),
    supabase.from("agendamentos").select("id", { count: "exact", head: true })
      .eq("profissional_id", user.id).eq("status", "concluido")
      .gte("inicio", inicioMes.toISOString()),
    supabase.from("agendamentos").select("cliente_id")
      .eq("profissional_id", user.id),
  ]);

  if (erroHoje) {
    console.error("Erro na visão geral:", erroHoje);
    return NextResponse.json({ erro: erroHoje.message }, { status: 500 });
  }

  const listaHoje = hoje ?? [];
  const servicoIds = [...new Set(listaHoje.map((a) => a.servico_id))];
  const clienteIds = [...new Set(listaHoje.map((a) => a.cliente_id))];

  const [{ data: servicos }, { data: clientes }] = await Promise.all([
    servicoIds.length > 0
      ? supabase.from("servicos").select("id, nome").in("id", servicoIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    clienteIds.length > 0
      ? supabase.from("clientes").select("id, nome").in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));

  const agendamentosHoje = listaHoje.map((a) => ({
    id: a.id,
    inicio: a.inicio,
    status: a.status,
    servico: mapaServicos.get(a.servico_id)?.nome ?? null,
    cliente: mapaClientes.get(a.cliente_id)?.nome ?? null,
  }));

  const totalClientes = new Set((clientesUnicos ?? []).map((c) => c.cliente_id)).size;

  return NextResponse.json({
    pendentes: pendentes ?? 0,
    agendamentosHoje,
    concluidosNoMes: concluidosNoMes ?? 0,
    totalClientes,
    statusAcesso,
  });
}
