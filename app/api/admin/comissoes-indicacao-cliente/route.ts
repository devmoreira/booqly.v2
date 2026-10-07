// GET /api/admin/comissoes-indicacao-cliente
// Mesmo modelo de /api/admin/comissoes-indicacao, só que quem indica é
// um CLIENTE (e quem é indicado continua sendo um profissional novo).
// Pagamento é automático (ver /api/cron/processar-saques) — essa rota
// é só leitura.
import { NextResponse } from "next/server";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: comissoes } = await db
    .from("comissoes_indicacao_cliente")
    .select("id, valor_centavos, status, criado_em, cliente_indicador_id, profissional_indicado_id")
    .order("criado_em", { ascending: false });

  const idsClientes = [...new Set((comissoes ?? []).map((c) => c.cliente_indicador_id))];
  const idsProfissionais = [...new Set((comissoes ?? []).map((c) => c.profissional_indicado_id))];
  const [{ data: clientes }, { data: profissionais }] = await Promise.all([
    idsClientes.length > 0 ? db.from("clientes").select("id, nome").in("id", idsClientes) : Promise.resolve({ data: [] as any[] }),
    idsProfissionais.length > 0 ? db.from("profissionais").select("id, nome_negocio").in("id", idsProfissionais) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.nome]));
  const mapaProfissionais = new Map((profissionais ?? []).map((p) => [p.id, p.nome_negocio]));

  return NextResponse.json({
    comissoes: (comissoes ?? []).map((c) => ({
      id: c.id,
      valorCentavos: c.valor_centavos,
      status: c.status,
      criadoEm: c.criado_em,
      indicador: mapaClientes.get(c.cliente_indicador_id) ?? "—",
      indicado: mapaProfissionais.get(c.profissional_indicado_id) ?? "—",
    })),
  });
}
