// GET /api/admin/subsidios-cupom
// Lista as cobranças que tiveram cupom de cliente com subsídio da
// plataforma, mostrando se a transferência foi paga ou falhou — sem
// precisar caçar isso no log do terminal.
import { NextResponse } from "next/server";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: cobrancas } = await db
    .from("cobrancas")
    .select("id, agendamento_id, valor_centavos, subsidio_cupom_centavos, subsidio_cupom_status, criado_em")
    .not("subsidio_cupom_status", "is", null)
    .order("criado_em", { ascending: false })
    .limit(200);

  const agendamentoIds = [...new Set((cobrancas ?? []).map((c) => c.agendamento_id))];
  const { data: agendamentos } = agendamentoIds.length > 0
    ? await db.from("agendamentos").select("id, profissional_id, cliente_id").in("id", agendamentoIds)
    : { data: [] as any[] };
  const mapaAgendamentos = new Map((agendamentos ?? []).map((a) => [a.id, a]));

  const profissionalIds = [...new Set((agendamentos ?? []).map((a) => a.profissional_id))];
  const clienteIds = [...new Set((agendamentos ?? []).map((a) => a.cliente_id))];
  const [{ data: profissionais }, { data: clientes }] = await Promise.all([
    profissionalIds.length > 0 ? db.from("profissionais").select("id, nome_negocio").in("id", profissionalIds) : Promise.resolve({ data: [] as any[] }),
    clienteIds.length > 0 ? db.from("clientes").select("id, nome").in("id", clienteIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaProfissionais = new Map((profissionais ?? []).map((p) => [p.id, p.nome_negocio]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  const lista = (cobrancas ?? []).map((c) => {
    const agendamento = mapaAgendamentos.get(c.agendamento_id);
    return {
      id: c.id,
      criadoEm: c.criado_em,
      valorCentavos: c.valor_centavos,
      subsidioCentavos: c.subsidio_cupom_centavos,
      status: c.subsidio_cupom_status,
      profissional: agendamento ? mapaProfissionais.get(agendamento.profissional_id) ?? "—" : "—",
      cliente: agendamento ? mapaClientes.get(agendamento.cliente_id) ?? "—" : "—",
    };
  });

  return NextResponse.json({ subsidios: lista });
}
