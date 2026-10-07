// GET/DELETE /api/painel/story — até 3 fotos do story permanente do
// estabelecimento. Adicionar é feito por /api/painel/story/foto
// (upload direto), já que cada item é sempre uma imagem.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin.from("stories_estabelecimento").select("id, foto_url, ordem").eq("profissional_id", user.id).order("ordem");
  return NextResponse.json({ fotos: data ?? [] });
}

const schema = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("stories_estabelecimento").delete().eq("id", validado.data.id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "Não foi possível excluir" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
