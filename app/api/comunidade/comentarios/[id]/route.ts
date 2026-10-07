// DELETE /api/comunidade/comentarios/:id — autor ou admin exclui.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profissionais").select("is_admin").eq("id", user.id).single();
  const { data: comentario } = await admin.from("comunidade_comentarios").select("profissional_id").eq("id", id).single();
  if (!comentario) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  if (comentario.profissional_id !== user.id && !perfil?.is_admin) {
    return NextResponse.json({ erro: "Só o autor ou o admin pode excluir." }, { status: 403 });
  }

  const { error } = await admin.from("comunidade_comentarios").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: "Não foi possível excluir." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
