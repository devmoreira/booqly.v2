// GET /api/admin/profissionais — lista todos, com dias desde o último acesso
// DELETE /api/admin/profissionais { id } — exclui a conta de verdade
// (registro + login), usado pra limpar contas inativas há muito tempo.
import { NextRequest, NextResponse } from "next/server";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db
    .from("profissionais")
    .select("id, nome_negocio, slug, cidade, estado, ultimo_acesso, criado_em")
    .order("ultimo_acesso", { ascending: true, nullsFirst: true });

  const { data: config } = await db.from("configuracoes_plataforma").select("dias_inatividade_sugerido").eq("id", 1).single();

  return NextResponse.json({
    profissionais: data ?? [],
    diasInatividadeSugerido: config?.dias_inatividade_sugerido ?? 180,
  });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const { id, ids } = await req.json().catch(() => ({ id: null, ids: null }));
  const idsParaExcluir: string[] = ids ?? (id ? [id] : []);
  if (idsParaExcluir.length === 0) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  const db = createAdminClient();
  const resultados: { id: string; ok: boolean; erro?: string }[] = [];

  for (const idExcluir of idsParaExcluir) {
    if (idExcluir === admin.id) {
      resultados.push({ id: idExcluir, ok: false, erro: "A conta de administrador logada não pode ser excluída por esta tela." });
      continue;
    }

    // Evita travar a exclusão por causa da auto-referência de indicação
    // entre profissionais (quem esse profissional indicou perde a
    // referência, mas continua existindo normalmente).
    await db.from("profissionais").update({ indicado_por_profissional_id: null }).eq("indicado_por_profissional_id", idExcluir);

    // O resto (agendamentos, serviços, colaboradores, cobranças, etc.)
    // já apaga em cascata sozinho, configurado no banco.
    const { error: erroTabela } = await db.from("profissionais").delete().eq("id", idExcluir);
    if (erroTabela) {
      resultados.push({ id: idExcluir, ok: false, erro: erroTabela.message });
      continue;
    }

    const { error: erroAuth } = await db.auth.admin.deleteUser(idExcluir);
    resultados.push({ id: idExcluir, ok: !erroAuth, erro: erroAuth?.message });
  }

  return NextResponse.json({ resultados });
}
