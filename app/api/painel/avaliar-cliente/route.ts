// POST /api/painel/avaliar-cliente { agendamentoId, nota, comentario? }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  agendamentoId: z.string().uuid(),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const { data: agendamento } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, colaborador_id, status")
    .eq("id", validado.data.agendamentoId)
    .eq("profissional_id", user.id)
    .single();

  if (!agendamento) return NextResponse.json({ erro: "Agendamento não encontrado" }, { status: 404 });
  if (agendamento.status !== "concluido") {
    return NextResponse.json({ erro: "Só dá pra avaliar depois que o serviço for concluído." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("avaliacoes_cliente").insert({
    cliente_id: agendamento.cliente_id,
    profissional_id: user.id,
    colaborador_id: agendamento.colaborador_id,
    agendamento_id: agendamento.id,
    nota: validado.data.nota,
    comentario: validado.data.comentario,
  });

  if (error) {
    const mensagem = error.code === "23505" ? "Esse atendimento já foi avaliado." : "Não foi possível enviar a avaliação.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
