// GET /api/admin/comissoes-indicacao
// Lista as comissões de indicação de profissional (revenda). Pagamento
// é automático (ver /api/cron/processar-saques) — essa rota é só leitura.
import { NextResponse } from "next/server";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: comissoes } = await db
    .from("comissoes_indicacao_profissional")
    .select("id, valor_centavos, status, criado_em, profissional_indicador_id, profissional_indicado_id")
    .order("criado_em", { ascending: false });

  const idsProfissionais = [...new Set((comissoes ?? []).flatMap((c) => [c.profissional_indicador_id, c.profissional_indicado_id]))];
  const { data: profissionais } = idsProfissionais.length > 0
    ? await db.from("profissionais").select("id, nome_negocio").in("id", idsProfissionais)
    : { data: [] as { id: string; nome_negocio: string }[] };
  const mapa = new Map((profissionais ?? []).map((p) => [p.id, p.nome_negocio]));

  return NextResponse.json({
    comissoes: (comissoes ?? []).map((c) => ({
      id: c.id,
      valorCentavos: c.valor_centavos,
      status: c.status,
      criadoEm: c.criado_em,
      indicador: mapa.get(c.profissional_indicador_id) ?? "—",
      indicado: mapa.get(c.profissional_indicado_id) ?? "—",
    })),
  });
}
