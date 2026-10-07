// POST /api/cliente/avaliar-estabelecimento { agendamentoId, nota, comentario? }
// Só depois do serviço concluído, e só uma vez por agendamento.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  agendamentoId: z.string().uuid(),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: agendamento } = await admin
    .from("agendamentos")
    .select("id, cliente_id, profissional_id, status")
    .eq("id", validado.data.agendamentoId)
    .single();

  if (!agendamento || agendamento.cliente_id !== cliente.id) {
    return NextResponse.json({ erro: "Agendamento não encontrado" }, { status: 404 });
  }
  if (agendamento.status !== "concluido") {
    return NextResponse.json({ erro: "Só dá pra avaliar depois que o serviço for concluído." }, { status: 400 });
  }

  const { error } = await admin.from("avaliacoes_estabelecimento").insert({
    profissional_id: agendamento.profissional_id,
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    nota: validado.data.nota,
    comentario: validado.data.comentario,
  });

  if (error) {
    const mensagem = error.code === "23505" ? "Você já avaliou esse atendimento." : "Não foi possível enviar a avaliação.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
