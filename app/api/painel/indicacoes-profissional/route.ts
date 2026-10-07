// GET /api/painel/indicacoes-profissional
// Mostra o link de indicação do profissional (pra revenda do sistema)
// e o histórico de comissões ganhas indicando outros profissionais.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saldoDisponivel } from "@/lib/saque";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: perfil }, { data: config }, { data: comissoes }, saldoCentavos] = await Promise.all([
    admin.from("profissionais").select("slug").eq("id", user.id).single(),
    admin.from("configuracoes_plataforma").select("valor_comissao_indicacao_profissional_centavos, prazo_saque_dias").eq("id", 1).single(),
    admin
      .from("comissoes_indicacao_profissional")
      .select("id, valor_centavos, status, criado_em, profissional_indicado_id")
      .eq("profissional_indicador_id", user.id)
      .order("criado_em", { ascending: false }),
    saldoDisponivel("profissional", user.id),
  ]);

  const idsIndicados = [...new Set((comissoes ?? []).map((c) => c.profissional_indicado_id))];
  const { data: indicados } = idsIndicados.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio").in("id", idsIndicados)
    : { data: [] as { id: string; nome_negocio: string }[] };
  const mapaIndicados = new Map((indicados ?? []).map((p) => [p.id, p.nome_negocio]));

  const valorComissao = config?.valor_comissao_indicacao_profissional_centavos ?? 0;

  return NextResponse.json({
    ativo: valorComissao > 0,
    valorComissaoCentavos: valorComissao,
    saldoCentavos,
    prazoSaqueDias: config?.prazo_saque_dias ?? 3,
    slug: perfil?.slug,
    comissoes: (comissoes ?? []).map((c) => ({
      id: c.id,
      valorCentavos: c.valor_centavos,
      status: c.status,
      criadoEm: c.criado_em,
      nomeIndicado: mapaIndicados.get(c.profissional_indicado_id) ?? "Estabelecimento",
    })),
  });
}
