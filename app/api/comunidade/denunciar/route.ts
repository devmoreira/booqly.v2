// POST /api/comunidade/denunciar — reporta post ou comentário pro
// admin revisar (não exclui na hora, só avisa).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  postId: z.string().uuid().optional(),
  comentarioId: z.string().uuid().optional(),
  motivo: z.string().max(300).optional(),
}).refine((d) => (!!d.postId) !== (!!d.comentarioId), { message: "Informe post OU comentário, não os dois." });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("comunidade_denuncias").insert({
    post_id: validado.data.postId ?? null,
    comentario_id: validado.data.comentarioId ?? null,
    denunciado_por: user.id,
    motivo: validado.data.motivo ?? null,
  });
  if (error) return NextResponse.json({ erro: "Não foi possível denunciar." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
