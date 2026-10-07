// GET/POST/DELETE /api/painel/clientes-bloqueados
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { bloquearCliente, desbloquearCliente, listarBloqueados } from "@/lib/bloqueio-cliente";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  return NextResponse.json({ bloqueados: await listarBloqueados(user.id) });
}

const schema = z.object({ clienteId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const ok = await bloquearCliente(user.id, validado.data.clienteId);
  if (!ok) return NextResponse.json({ erro: "não foi possível bloquear" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const ok = await desbloquearCliente(user.id, validado.data.clienteId);
  if (!ok) return NextResponse.json({ erro: "não foi possível desbloquear" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
