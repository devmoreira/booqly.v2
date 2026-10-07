// GET /api/cron/processar-saques
// Chamado automaticamente pela Vercel (ver vercel.json). Paga de
// verdade (Pix) todo pedido de saque que já passou do prazo definido
// pelo admin — nunca paga na hora do pedido, sempre com essa janela.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPixDaPlataforma } from "@/lib/payments/pix";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { segredosIguais } from "@/lib/comparar-segredo";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET não configurado — recusando por segurança (essa rota move dinheiro de verdade).");
    return NextResponse.json({ erro: "cron não configurado" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (!segredosIguais(auth ?? "", `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: config } = await admin.from("configuracoes_plataforma").select("prazo_saque_dias").eq("id", 1).single();
  const prazoDias = config?.prazo_saque_dias ?? 3;
  const dataLimite = new Date(Date.now() - prazoDias * 86_400_000).toISOString();

  const { data: pendentes } = await admin
    .from("solicitacoes_saque")
    .select("id, tipo, valor_centavos, pix_chave, pix_chave_tipo")
    .eq("status", "pendente")
    .lte("solicitado_em", dataLimite);

  const TABELA_POR_TIPO: Record<string, string> = {
    profissional: "comissoes_indicacao_profissional",
    cliente: "comissoes_indicacao_cliente",
    colaborador: "comissoes_indicacao_colaborador",
  };

  let pagos = 0;
  let falhas = 0;
  const nomePlataforma = await obterNomePlataforma();

  for (const solicitacao of pendentes ?? []) {
    try {
      await enviarPixDaPlataforma(solicitacao.pix_chave, solicitacao.pix_chave_tipo, solicitacao.valor_centavos, `${nomePlataforma} — saque de indicação`);
      await admin.from("solicitacoes_saque").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", solicitacao.id);
      await admin.from(TABELA_POR_TIPO[solicitacao.tipo]).update({ status: "pago" }).eq("solicitacao_saque_id", solicitacao.id);
      pagos++;
    } catch (erro) {
      console.error(`Falha ao processar saque ${solicitacao.id}:`, erro);
      await admin.from("solicitacoes_saque").update({ status: "falhou" }).eq("id", solicitacao.id);
      falhas++;
    }
  }

  return NextResponse.json({ ok: true, pagos, falhas, totalEncontrados: pendentes?.length ?? 0 });
}
