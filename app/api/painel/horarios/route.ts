import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data } = await supabase
    .from("horarios_funcionamento")
    .select("dia_semana, hora_inicio, hora_fim, ativo")
    .eq("profissional_id", user.id);

  return NextResponse.json({ horarios: data ?? [] });
}

const schema = z.object({
  dias: z.array(z.object({
    diaSemana: z.number().int().min(0).max(6),
    horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
    horaFim: z.string().regex(/^\d{2}:\d{2}$/),
    ativo: z.boolean(),
  })),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const diaComHorarioInvalido = validado.data.dias.find((d) => d.ativo && d.horaFim <= d.horaInicio);
  if (diaComHorarioInvalido) {
    return NextResponse.json(
      { erro: "O horário de fechar precisa ser depois do de abrir, em todo dia ativo (a agenda ainda não funciona virando a noite)." },
      { status: 400 }
    );
  }

  const linhas = validado.data.dias.map((d) => ({
    profissional_id: user.id,
    dia_semana: d.diaSemana,
    hora_inicio: d.horaInicio,
    hora_fim: d.horaFim,
    ativo: d.ativo,
  }));

  const { error } = await supabase.from("horarios_funcionamento").upsert(linhas, { onConflict: "profissional_id,dia_semana" });
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
