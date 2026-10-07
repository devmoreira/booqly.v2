// GET/POST/PUT/DELETE /api/admin/tutoriais
// Vídeos tutoriais (YouTube) configurados pelo admin — sem limite de
// quantidade. Aparecem pro profissional em Painel → Passo a passo.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db.from("tutoriais_video").select("id, titulo, url, ordem").order("ordem");
  return NextResponse.json({ tutoriais: data ?? [] });
}

const schemaCriar = z.object({
  titulo: z.string().max(80).optional(),
  url: z.string().url().max(300),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaCriar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Cole um link válido de vídeo." }, { status: 400 });

  const db = createAdminClient();
  const { count } = await db.from("tutoriais_video").select("id", { count: "exact", head: true });
  const { error } = await db.from("tutoriais_video").insert({
    titulo: validado.data.titulo || null,
    url: validado.data.url,
    ordem: count ?? 0,
  });
  if (error) return NextResponse.json({ erro: "Não foi possível adicionar" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  titulo: z.string().max(80).optional(),
  url: z.string().url().max(300).optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (validado.data.titulo !== undefined) dados.titulo = validado.data.titulo || null;
  if (validado.data.url !== undefined) dados.url = validado.data.url;

  const db = createAdminClient();
  const { error } = await db.from("tutoriais_video").update(dados).eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = z.object({ id: z.string().uuid() }).safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("tutoriais_video").delete().eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "Não foi possível excluir" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
