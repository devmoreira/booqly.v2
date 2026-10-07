// POST /api/comunidade/comentarios — comenta num post da comunidade.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { censurarPalavroes, linkNaoPermitido } from "@/lib/filtro-comunidade";

const schema = z.object({ postId: z.string().uuid(), texto: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const linkRuim = linkNaoPermitido(validado.data.texto);
  if (linkRuim) return NextResponse.json({ erro: `Só é permitido link do YouTube ou Instagram. Remova: ${linkRuim}` }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("comunidade_comentarios").insert({
    post_id: validado.data.postId,
    profissional_id: user.id,
    texto: censurarPalavroes(validado.data.texto),
  });
  if (error) return NextResponse.json({ erro: "Não foi possível comentar." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
