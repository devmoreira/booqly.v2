// GET/POST/DELETE /api/colaborador/clientes-bloqueados
// Bloqueio feito pelo colaborador vale pro estabelecimento inteiro —
// resolve o profissional_id dele antes de aplicar.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bloquearCliente, desbloquearCliente, listarBloqueados } from "@/lib/bloqueio-cliente";

async function pegarProfissionalDoColaborador(colaboradorId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("colaboradores").select("profissional_id").eq("id", colaboradorId).maybeSingle();
  return data?.profissional_id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const profissionalId = await pegarProfissionalDoColaborador(user.id);
  if (!profissionalId) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  return NextResponse.json({ bloqueados: await listarBloqueados(profissionalId) });
}

const schema = z.object({ clienteId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const profissionalId = await pegarProfissionalDoColaborador(user.id);
  if (!profissionalId) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const ok = await bloquearCliente(profissionalId, validado.data.clienteId);
  if (!ok) return NextResponse.json({ erro: "não foi possível bloquear" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const profissionalId = await pegarProfissionalDoColaborador(user.id);
  if (!profissionalId) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const ok = await desbloquearCliente(profissionalId, validado.data.clienteId);
  if (!ok) return NextResponse.json({ erro: "não foi possível desbloquear" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
