// POST /api/cliente/cancelar { agendamentoId }
// O cliente cancela o próprio agendamento — só até 2h antes do horário
// (mesma regra do remarcar; antes disso, essa trava só existia na tela,
// não no backend). Se já tinha pago, estorna automaticamente.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarCancelamentoComEstorno } from "@/lib/cancelamento";
import { enviarNotificacaoPushProfissional } from "@/lib/push";

const LIMITE_HORAS_ANTES = 2;
const schema = z.object({ agendamentoId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: agendamento } = await admin
    .from("agendamentos")
    .select("id, cliente_id, status, profissional_id, servico_id, inicio")
    .eq("id", validado.data.agendamentoId)
    .single();

  if (!agendamento || agendamento.cliente_id !== cliente.id) {
    return NextResponse.json({ erro: "Agendamento não encontrado" }, { status: 404 });
  }
  if (agendamento.status === "cancelado" || agendamento.status === "concluido") {
    return NextResponse.json({ erro: "Esse agendamento não pode mais ser cancelado" }, { status: 400 });
  }

  const limiteParaCancelar = new Date(agendamento.inicio).getTime() - LIMITE_HORAS_ANTES * 3_600_000;
  if (Date.now() > limiteParaCancelar) {
    return NextResponse.json(
      { erro: `Só é possível cancelar até ${LIMITE_HORAS_ANTES}h antes do horário. Entre em contato direto com o estabelecimento.` },
      { status: 400 }
    );
  }

  const { error } = await admin.from("agendamentos").update({ status: "cancelado" }).eq("id", agendamento.id);
  if (error) return NextResponse.json({ erro: "Não foi possível cancelar" }, { status: 500 });

  await processarCancelamentoComEstorno(admin, agendamento.id);

  const { data: servico } = await admin.from("servicos").select("nome").eq("id", agendamento.servico_id).single();
  const dataHora = new Date(agendamento.inicio);
  enviarNotificacaoPushProfissional(agendamento.profissional_id, {
    titulo: "Agendamento cancelado ❌",
    corpo: `${cliente.nome} cancelou ${servico?.nome ?? "o horário"} de ${dataHora.toLocaleDateString("pt-BR")} às ${dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
    url: "/painel/agenda",
  }).catch((erro) => console.error("Falha ao notificar cancelamento pro profissional:", erro));

  return NextResponse.json({ ok: true });
}
