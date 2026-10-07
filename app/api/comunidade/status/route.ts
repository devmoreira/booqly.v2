// GET /api/comunidade/status
// Diz se a comunidade da categoria do profissional logado já
// desbloqueou (bateu o mínimo de assinantes pagos ativos), e quanto
// falta se ainda não bateu.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium, calcularStatusAcesso } from "@/lib/assinatura";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profissionais").select("categoria").eq("id", user.id).single();
  if (!perfil) return NextResponse.json({ erro: "perfil não encontrado" }, { status: 404 });

  const { data: config } = await admin.from("configuracoes_plataforma").select("comunidade_minimo_assinantes").eq("id", 1).single();
  const minimo = config?.comunidade_minimo_assinantes ?? 50;

  // Conta quantos profissionais da mesma categoria têm assinatura paga
  // ATIVA agora (teste grátis não conta) — sempre calculado na hora,
  // nunca guardado, pra nunca ficar desatualizado.
  const { data: mesmaCategoria } = await admin.from("profissionais").select("id").eq("categoria", perfil.categoria);
  let quantidadeAtiva = 0;
  for (const p of mesmaCategoria ?? []) {
    const status = await calcularStatusAcesso(p.id);
    if (status.liberado && status.motivo !== "teste_gratis") quantidadeAtiva++;
  }

  const desbloqueada = quantidadeAtiva >= minimo;
  return NextResponse.json({ desbloqueada, quantidadeAtiva, minimo, categoria: perfil.categoria });
}
