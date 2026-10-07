// GET /api/cliente/indicacao-dinheiro
// Saldo disponível (indicação de PROFISSIONAIS novos pra assinar,
// mesmo modelo da indicação entre profissionais) do cliente logado.
import { NextResponse } from "next/server";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { saldoDisponivel } from "@/lib/saque";

export async function GET() {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [saldoCentavos, { data: config }] = await Promise.all([
    saldoDisponivel("cliente", cliente.id),
    admin.from("configuracoes_plataforma").select("valor_comissao_indicacao_cliente_centavos, prazo_saque_dias").eq("id", 1).single(),
  ]);

  return NextResponse.json({
    saldoCentavos,
    programaAtivo: (config?.valor_comissao_indicacao_cliente_centavos ?? 0) > 0,
    prazoSaqueDias: config?.prazo_saque_dias ?? 3,
    clienteId: cliente.id,
  });
}
