// GET/POST/PUT/DELETE /api/admin/recursos
// Controle dos recursos exibidos na página pública /recursos.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

async function autorizar() {
  const admin = await getProfissionalAdminOuNull();
  return Boolean(admin);
}

export async function GET() {
  if (!(await autorizar())) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("recursos_site")
    .select("id, titulo, texto, ordem, ativo")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[admin/recursos] GET Supabase:", error);
    if (error.code === "42P01") {
      return NextResponse.json({
        erro: "A tabela recursos_site ainda não existe no Supabase. Execute a migration 20260922_recursos_site.sql no SQL Editor."
      }, { status: 503 });
    }
    return NextResponse.json({ erro: `Falha ao carregar recursos: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ recursos: data ?? [] });
}

const schemaCriar = z.object({
  titulo: z.string().trim().min(2).max(120),
  texto: z.string().trim().min(2).max(1000),
});

export async function POST(req: NextRequest) {
  if (!(await autorizar())) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaCriar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Preencha título e descrição corretamente." }, { status: 400 });

  const db = createAdminClient();
  const { count } = await db.from("recursos_site").select("id", { count: "exact", head: true });
  const { error } = await db.from("recursos_site").insert({
    titulo: validado.data.titulo,
    texto: validado.data.texto,
    ordem: count ?? 0,
    ativo: true,
  });

  if (error) {
    console.error("[admin/recursos] POST Supabase:", error);
    if (error.code === "42P01") return NextResponse.json({ erro: "A tabela recursos_site ainda não existe no Supabase. Execute a migration 20260922_recursos_site.sql." }, { status: 503 });
    if (error.code === "23505") return NextResponse.json({ erro: "Já existe um recurso com esse título." }, { status: 409 });
    return NextResponse.json({ erro: "Não foi possível adicionar o recurso." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(2).max(120).optional(),
  texto: z.string().trim().min(2).max(1000).optional(),
  ativo: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  if (!(await autorizar())) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (validado.data.titulo !== undefined) dados.titulo = validado.data.titulo;
  if (validado.data.texto !== undefined) dados.texto = validado.data.texto;
  if (validado.data.ativo !== undefined) dados.ativo = validado.data.ativo;

  if (Object.keys(dados).length === 0) return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("recursos_site").update(dados).eq("id", validado.data.id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ erro: "Já existe um recurso com esse título." }, { status: 409 });
    return NextResponse.json({ erro: "Não foi possível salvar o recurso." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await autorizar())) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = z.object({ id: z.string().uuid() }).safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("recursos_site").delete().eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "Não foi possível excluir o recurso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
