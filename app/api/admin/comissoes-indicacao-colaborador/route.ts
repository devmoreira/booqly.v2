// GET /api/admin/comissoes-indicacao-colaborador
import { NextResponse } from "next/server";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: comissoes } = await db
    .from("comissoes_indicacao_colaborador")
    .select("id, valor_centavos, status, criado_em, colaborador_indicador_id, profissional_indicado_id")
    .order("criado_em", { ascending: false });

  const idsColaboradores = [...new Set((comissoes ?? []).map((c) => c.colaborador_indicador_id))];
  const idsProfissionais = [...new Set((comissoes ?? []).map((c) => c.profissional_indicado_id))];
  const [{ data: colaboradores }, { data: profissionais }] = await Promise.all([
    idsColaboradores.length > 0 ? db.from("colaboradores").select("id, nome").in("id", idsColaboradores) : Promise.resolve({ data: [] as any[] }),
    idsProfissionais.length > 0 ? db.from("profissionais").select("id, nome_negocio").in("id", idsProfissionais) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaColaboradores = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]));
  const mapaProfissionais = new Map((profissionais ?? []).map((p) => [p.id, p.nome_negocio]));

  return NextResponse.json({
    comissoes: (comissoes ?? []).map((c) => ({
      id: c.id,
      valorCentavos: c.valor_centavos,
      status: c.status,
      criadoEm: c.criado_em,
      indicador: mapaColaboradores.get(c.colaborador_indicador_id) ?? "—",
      indicado: mapaProfissionais.get(c.profissional_indicado_id) ?? "—",
    })),
  });
}
