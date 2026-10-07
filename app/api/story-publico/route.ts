// GET /api/story-publico?slug=barbearia-do-joao
// Fotos do story permanente do estabelecimento, pra mostrar em tela
// cheia quando o cliente clica na foto de perfil.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ erro: "slug obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profissional } = await admin.from("profissionais").select("id").eq("slug", slug).maybeSingle();
  if (!profissional) return NextResponse.json({ fotos: [] });

  const { data } = await admin.from("stories_estabelecimento").select("id, foto_url").eq("profissional_id", profissional.id).order("ordem");
  return NextResponse.json({ fotos: data ?? [] });
}
