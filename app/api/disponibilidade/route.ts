// GET /api/disponibilidade?profissionalId=&servicoId=&colaboradorId=&data=YYYY-MM-DD
// Pública — usada tanto na página de agendar quanto na remarcação do cliente.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularHorariosDisponiveis } from "@/lib/disponibilidade";

const schema = z.object({
  profissionalId: z.string().uuid(),
  servicoId: z.string().uuid(),
  colaboradorId: z.string().uuid().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ignorarAgendamentoId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const validado = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!validado.success) return NextResponse.json({ erro: "parâmetros inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: servico } = await admin
    .from("servicos")
    .select("duracao_minutos, profissional_id")
    .eq("id", validado.data.servicoId)
    .single();
  if (!servico || servico.profissional_id !== validado.data.profissionalId) {
    return NextResponse.json({ erro: "serviço inválido" }, { status: 400 });
  }

  const resultado = await calcularHorariosDisponiveis({
    profissionalId: validado.data.profissionalId,
    colaboradorId: validado.data.colaboradorId,
    duracaoMinutos: servico.duracao_minutos,
    data: validado.data.data,
    ignorarAgendamentoId: validado.data.ignorarAgendamentoId,
  });

  return NextResponse.json(resultado);
}
