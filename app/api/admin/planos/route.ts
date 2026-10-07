import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const db = createAdminClient();
  const { data } = await db.from("planos_assinatura").select("*").order("duracao_meses");
  return NextResponse.json({ planos: data ?? [] });
}

const schema = z.object({
  nome: z.string().min(2).max(60),
  duracaoMeses: z.number().int().min(1).max(60),
  valorCentavos: z.number().int().min(500, "O Asaas exige valor mínimo de R$5,00 pra cobrança de assinatura"),
  nivel: z.enum(["basico", "premium"]).default("basico"),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: validado.error.errors[0]?.message ?? "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("planos_assinatura").insert({
    nome: validado.data.nome,
    duracao_meses: validado.data.duracaoMeses,
    valor_centavos: validado.data.valorCentavos,
    nivel: validado.data.nivel,
  });
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2).max(60).optional(),
  valorCentavos: z.number().int().min(500, "O Asaas exige valor mínimo de R$5,00 pra cobrança de assinatura").optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: validado.error.errors[0]?.message ?? "dados inválidos" }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (validado.data.nome !== undefined) dados.nome = validado.data.nome;
  if (validado.data.valorCentavos !== undefined) dados.valor_centavos = validado.data.valorCentavos;
  if (Object.keys(dados).length === 0) return NextResponse.json({ erro: "nada pra salvar" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("planos_assinatura").update(dados).eq("id", validado.data.id);
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const { id, excluir } = await req.json().catch(() => ({ id: null, excluir: false }));
  if (!id) return NextResponse.json({ erro: "id inválido" }, { status: 400 });
  const db = createAdminClient();

  if (excluir) {
    // Exclusão de verdade — só funciona se ninguém nunca assinou esse
    // plano. Se já tiver histórico, o banco recusa (chave estrangeira).
    const { error } = await db.from("planos_assinatura").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ erro: "Esse plano já teve assinatura — não dá pra excluir, só desativar." }, { status: 400 });
      }
      return NextResponse.json({ erro: "falha ao excluir" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Desativa em vez de apagar, pra não perder o histórico de quem já assinou esse plano
  const { error } = await db.from("planos_assinatura").update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ erro: "falha ao remover" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
