// GET/POST/PUT/DELETE /api/admin/faq
// Controle total do admin sobre as perguntas frequentes da home.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db.from("perguntas_frequentes").select("*").order("ordem");
  return NextResponse.json({ perguntas: data ?? [] });
}

const schemaCriar = z.object({
  pergunta: z.string().min(3).max(200),
  resposta: z.string().min(3).max(1000),
  ordem: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaCriar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("perguntas_frequentes").insert({
    pergunta: validado.data.pergunta,
    resposta: validado.data.resposta,
    ordem: validado.data.ordem ?? 0,
  });
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  pergunta: z.string().min(3).max(200).optional(),
  resposta: z.string().min(3).max(1000).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (validado.data.pergunta !== undefined) dados.pergunta = validado.data.pergunta;
  if (validado.data.resposta !== undefined) dados.resposta = validado.data.resposta;
  if (validado.data.ordem !== undefined) dados.ordem = validado.data.ordem;
  if (validado.data.ativo !== undefined) dados.ativo = validado.data.ativo;

  const db = createAdminClient();
  const { error } = await db.from("perguntas_frequentes").update(dados).eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = z.object({ id: z.string().uuid() }).safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("perguntas_frequentes").delete().eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "falha ao remover" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
