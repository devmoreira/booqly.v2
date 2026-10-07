// GET/POST/DELETE /api/servicos
// CRUD dos serviços do próprio profissional logado. RLS já garante que
// cada um só mexe nos próprios (auth.uid() = profissional_id).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data } = await supabase
    .from("servicos")
    .select("id, nome, duracao_minutos, preco_centavos, ativo, foto_url")
    .eq("profissional_id", user.id)
    .order("nome");

  return NextResponse.json({ servicos: data ?? [] });
}

const schema = z.object({
  nome: z.string().min(2).max(80),
  duracaoMinutos: z.number().int().min(5).max(600),
  precoCentavos: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const { error } = await supabase.from("servicos").insert({
    profissional_id: user.id,
    nome: validado.data.nome,
    duracao_minutos: validado.data.duracaoMinutos,
    preco_centavos: validado.data.precoCentavos,
  });
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaAtualizar = z.object({
  id: z.string().uuid(),
  ativo: z.boolean().optional(),
  nome: z.string().min(2).max(80).optional(),
  duracaoMinutos: z.number().int().min(5).max(600).optional(),
  precoCentavos: z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaAtualizar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });
  const { id, ...resto } = validado.data;

  const dados: Record<string, unknown> = {};
  if (resto.ativo !== undefined) dados.ativo = resto.ativo;
  if (resto.nome !== undefined) dados.nome = resto.nome;
  if (resto.duracaoMinutos !== undefined) dados.duracao_minutos = resto.duracaoMinutos;
  if (resto.precoCentavos !== undefined) dados.preco_centavos = resto.precoCentavos;

  const { error } = await supabase.from("servicos").update(dados).eq("id", id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "não foi possível atualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const { error } = await supabase.from("servicos").delete().eq("id", id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "não foi possível remover" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
