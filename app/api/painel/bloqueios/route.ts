// POST/GET/DELETE /api/painel/bloqueios
// Bloqueio pontual de agenda (folga, compromisso, etc.) — pode ser pro
// estabelecimento inteiro ou só pra um colaborador específico.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacaoPush } from "@/lib/push";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data } = await supabase
    .from("bloqueios_agenda")
    .select("id, colaborador_id, inicio, fim, motivo")
    .eq("profissional_id", user.id)
    .gte("fim", new Date().toISOString())
    .order("inicio");

  return NextResponse.json({ bloqueios: data ?? [] });
}

const schema = z.object({
  colaboradorId: z.string().uuid().optional(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  motivo: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });
  if (new Date(validado.data.fim) <= new Date(validado.data.inicio)) {
    return NextResponse.json({ erro: "O fim precisa ser depois do início." }, { status: 400 });
  }

  const { error } = await supabase.from("bloqueios_agenda").insert({
    profissional_id: user.id,
    colaborador_id: validado.data.colaboradorId ?? null,
    inicio: validado.data.inicio,
    fim: validado.data.fim,
    motivo: validado.data.motivo,
  });
  if (error) return NextResponse.json({ erro: "não foi possível criar" }, { status: 500 });

  // Avisa quem já tinha agendamento marcado bem no meio desse período
  // que acabou de ser bloqueado — pra não pegar ninguém de surpresa.
  const admin = createAdminClient();
  let consultaConflito = admin
    .from("agendamentos")
    .select("id, cliente_id, servico_id")
    .eq("profissional_id", user.id)
    .in("status", ["pendente", "confirmado"])
    .lt("inicio", validado.data.fim)
    .gt("fim", validado.data.inicio);
  if (validado.data.colaboradorId) consultaConflito = consultaConflito.eq("colaborador_id", validado.data.colaboradorId);

  const { data: conflitos } = await consultaConflito;
  for (const conflito of conflitos ?? []) {
    const { data: servico } = await admin.from("servicos").select("nome").eq("id", conflito.servico_id).single();
    enviarNotificacaoPush(conflito.cliente_id, {
      titulo: "Atenção ao seu horário ⚠️",
      corpo: `O estabelecimento bloqueou a agenda no horário do seu ${servico?.nome ?? "agendamento"}. Confira se ainda está tudo certo.`,
      url: "/cliente/historico",
    }).catch((erro) => console.error("Falha ao notificar conflito de bloqueio:", erro));
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const { error } = await supabase.from("bloqueios_agenda").delete().eq("id", id).eq("profissional_id", user.id);
  if (error) return NextResponse.json({ erro: "não foi possível remover" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
