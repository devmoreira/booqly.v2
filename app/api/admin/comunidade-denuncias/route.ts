// GET /api/admin/comunidade-denuncias — lista denúncias pendentes.
// PUT — marca como resolvida (com ou sem excluir o conteúdo).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: denuncias } = await db
    .from("comunidade_denuncias")
    .select("id, post_id, comentario_id, motivo, criado_em, denunciado_por")
    .eq("resolvido", false)
    .order("criado_em", { ascending: false });

  const idsPosts = [...new Set((denuncias ?? []).filter((d) => d.post_id).map((d) => d.post_id as string))];
  const idsComentarios = [...new Set((denuncias ?? []).filter((d) => d.comentario_id).map((d) => d.comentario_id as string))];

  const [{ data: posts }, { data: comentarios }] = await Promise.all([
    idsPosts.length > 0 ? db.from("comunidade_posts").select("id, texto, categoria").in("id", idsPosts) : Promise.resolve({ data: [] as any[] }),
    idsComentarios.length > 0 ? db.from("comunidade_comentarios").select("id, texto, post_id").in("id", idsComentarios) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mapaPosts = new Map((posts ?? []).map((p) => [p.id, p]));
  const mapaComentarios = new Map((comentarios ?? []).map((c) => [c.id, c]));

  const resultado = (denuncias ?? []).map((d) => ({
    id: d.id,
    motivo: d.motivo,
    criadoEm: d.criado_em,
    tipo: d.post_id ? "post" : "comentario",
    texto: d.post_id ? mapaPosts.get(d.post_id)?.texto : mapaComentarios.get(d.comentario_id!)?.texto,
    postId: d.post_id,
    comentarioId: d.comentario_id,
  }));

  return NextResponse.json({ denuncias: resultado });
}

const schema = z.object({ id: z.string().uuid(), excluirConteudo: z.boolean().optional() });

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { data: denuncia } = await db.from("comunidade_denuncias").select("post_id, comentario_id").eq("id", validado.data.id).single();

  if (validado.data.excluirConteudo && denuncia) {
    if (denuncia.post_id) await db.from("comunidade_posts").delete().eq("id", denuncia.post_id);
    if (denuncia.comentario_id) await db.from("comunidade_comentarios").delete().eq("id", denuncia.comentario_id);
  }

  await db.from("comunidade_denuncias").update({ resolvido: true }).eq("id", validado.data.id);
  return NextResponse.json({ ok: true });
}
