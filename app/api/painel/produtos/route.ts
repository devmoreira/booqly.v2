// GET/POST/PUT/DELETE /api/painel/produtos
// Loja de produtos — exclusiva do Premium, pra retirada no local.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const premium = await temAcessoPremium(user.id);
  if (!premium) return NextResponse.json({ premium: false, produtos: [] });

  const admin = createAdminClient();
  const { data } = await admin.from("produtos").select("id, nome, preco_centavos, foto_url, estoque, ativo").eq("profissional_id", user.id).order("criado_em", { ascending: false });
  return NextResponse.json({ premium: true, produtos: data ?? [] });
}

const schemaCriar = z.object({
  nome: z.string().min(2).max(80),
  precoCentavos: z.number().int().min(1),
  estoque: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const premium = await temAcessoPremium(user.id);
  if (!premium) return NextResponse.json({ erro: "A loja de produtos é exclusiva do plano Premium." }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaCriar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Preencha nome, preço e estoque corretamente." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("produtos").insert({
    profissional_id: user.id,
    nome: validado.data.nome,
    preco_centavos: validado.data.precoCentavos,
    estoque: validado.data.estoque,
  });
  if (error) return NextResponse.json({ erro: "Não foi possível criar o produto." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2).max(80).optional(),
  precoCentavos: z.number().int().min(1).optional(),
  estoque: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const dados: Record<string, unknown> = {};
  if (validado.data.nome !== undefined) dados.nome = validado.data.nome;
  if (validado.data.precoCentavos !== undefined) dados.preco_centavos = validado.data.precoCentavos;
  if (validado.data.estoque !== undefined) dados.estoque = validado.data.estoque;
  if (validado.data.ativo !== undefined) dados.ativo = validado.data.ativo;

  const { error } = await admin.from("produtos").update(dados).eq("id", validado.data.id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "Não foi possível salvar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = z.object({ id: z.string().uuid() }).safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("produtos").delete().eq("id", validado.data.id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "Não foi possível excluir." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
