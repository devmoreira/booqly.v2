// GET /api/colaborador/indicacao
// Saldo e link de indicação de profissional novo, pro colaborador logado.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saldoDisponivel } from "@/lib/saque";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [saldoCentavos, { data: config }] = await Promise.all([
    saldoDisponivel("colaborador", user.id),
    admin.from("configuracoes_plataforma").select("valor_comissao_indicacao_colaborador_centavos, prazo_saque_dias").eq("id", 1).single(),
  ]);

  return NextResponse.json({
    saldoCentavos,
    programaAtivo: (config?.valor_comissao_indicacao_colaborador_centavos ?? 0) > 0,
    prazoSaqueDias: config?.prazo_saque_dias ?? 3,
    colaboradorId: user.id,
  });
}
