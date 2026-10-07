// POST /api/comunidade/curtir — alterna curtida num post (curte se
// não tinha curtido, descurte se já tinha).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ postId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existente } = await admin.from("comunidade_curtidas").select("post_id").eq("post_id", validado.data.postId).eq("profissional_id", user.id).maybeSingle();

  if (existente) {
    await admin.from("comunidade_curtidas").delete().eq("post_id", validado.data.postId).eq("profissional_id", user.id);
    return NextResponse.json({ curtido: false });
  }
  await admin.from("comunidade_curtidas").insert({ post_id: validado.data.postId, profissional_id: user.id });
  return NextResponse.json({ curtido: true });
}
