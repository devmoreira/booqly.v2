// GET/POST/DELETE /api/admin/categorias
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const db = createAdminClient();
  const { data } = await db.from("categorias_servico").select("*").order("rotulo");
  return NextResponse.json({ categorias: data ?? [] });
}

const schema = z.object({
  valor: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/, "use só letras minúsculas, número e underline"),
  rotulo: z.string().min(2).max(60),
  sinonimos: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: validado.error.errors[0]?.message ?? "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("categorias_servico").insert({
    valor: validado.data.valor,
    rotulo: validado.data.rotulo,
    sinonimos: validado.data.sinonimos ?? [],
  });
  if (error) {
    const mensagem = error.code === "23505" ? "Já existe uma categoria com esse identificador." : "Não foi possível criar.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const corpo = await req.json().catch(() => ({}));
  const { valor, rotulo, sinonimos } = corpo;
  if (!valor) return NextResponse.json({ erro: "valor obrigatório" }, { status: 400 });

  const db = createAdminClient();
  // Se vier rótulo ou sinônimos, é uma edição de verdade — não mexe no
  // "ativo". Se vier só o valor, é o botão de reativar de sempre.
  const dados: Record<string, unknown> = rotulo !== undefined || sinonimos !== undefined
    ? { ...(rotulo !== undefined && { rotulo }), ...(sinonimos !== undefined && { sinonimos }) }
    : { ativo: true };

  const { error } = await db.from("categorias_servico").update(dados).eq("valor", valor);
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const { valor, excluir } = await req.json().catch(() => ({ valor: null, excluir: false }));
  if (!valor) return NextResponse.json({ erro: "valor obrigatório" }, { status: 400 });

  const db = createAdminClient();

  if (excluir) {
    const { error } = await db.from("categorias_servico").delete().eq("valor", valor);
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ erro: "Já tem estabelecimento cadastrado nessa categoria — não dá pra excluir, só desativar." }, { status: 400 });
      }
      return NextResponse.json({ erro: "não foi possível excluir" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.from("categorias_servico").update({ ativo: false }).eq("valor", valor);
  if (error) return NextResponse.json({ erro: "não foi possível desativar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
