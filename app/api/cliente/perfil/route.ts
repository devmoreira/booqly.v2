// PUT /api/cliente/perfil { nome }
// Só o próprio cliente, já logado na Área do cliente, pode mudar o
// nome dele — nunca acontece automaticamente por um agendamento.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ nome: z.string().min(2).max(120) });

export async function PUT(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Digite um nome válido" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("clientes").update({ nome: validado.data.nome }).eq("id", cliente.id);
  if (error) return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
