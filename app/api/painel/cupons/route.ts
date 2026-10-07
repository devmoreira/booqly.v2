// GET/POST/DELETE /api/painel/cupons
// Cupom criado pelo PRÓPRIO profissional — só vale no estabelecimento
// dele, e o desconto sai do bolso dele mesmo (sem subsídio da
// plataforma, que é exclusivo dos cupons criados pelo admin).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db.from("cupons").select("*").eq("profissional_id", user.id).order("criado_em", { ascending: false });
  return NextResponse.json({ cupons: data ?? [] });
}

const schema = z.object({
  codigo: z.string().min(3).max(30),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.number().positive(),
  validade: z.string().datetime().optional(),
  usosMaximos: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: config } = await admin.from("configuracoes_plataforma").select("funcionalidade_cupons_ativa").eq("id", 1).single();
  if (config?.funcionalidade_cupons_ativa === false) {
    return NextResponse.json({ erro: "O sistema de cupons está temporariamente desativado pela plataforma." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("cupons").insert({
    codigo: validado.data.codigo.toUpperCase().trim(),
    tipo: validado.data.tipo,
    valor: validado.data.valor,
    publico: "cliente", // cupom de profissional é sempre pro cliente final dele
    profissional_id: user.id,
    validade: validado.data.validade ?? null,
    usos_maximos: validado.data.usosMaximos ?? null,
  });
  if (error) {
    const mensagem = error.code === "23505" ? "Já existe um cupom com esse código." : "Não foi possível criar o cupom.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  const db = createAdminClient();
  // Só desativa (nunca apaga de vez) — e só se o cupom for DESSE profissional.
  const { error } = await db.from("cupons").update({ ativo: false }).eq("id", id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "não foi possível desativar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
