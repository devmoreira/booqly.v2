// POST /api/cliente/reagendar { agendamentoId, data, hora }
// O cliente só consegue remarcar até X horas antes do horário ATUAL
// marcado — o valor de X é configurável pelo admin (configuracoes_
// plataforma.limite_horas_remarcar), conferido aqui no servidor,
// nunca só no navegador.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularHorariosDisponiveis } from "@/lib/disponibilidade";
import { horaBrasilParaData } from "@/lib/timezone";
import { enviarNotificacaoPushProfissional } from "@/lib/push";

const schema = z.object({
  agendamentoId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: agendamento } = await admin
      .from("agendamentos")
      .select("id, cliente_id, profissional_id, colaborador_id, servico_id, inicio, status")
      .eq("id", validado.data.agendamentoId)
      .single();

    if (!agendamento || agendamento.cliente_id !== cliente.id) {
      return NextResponse.json({ erro: "Agendamento não encontrado" }, { status: 404 });
    }
    if (agendamento.status === "cancelado" || agendamento.status === "concluido") {
      return NextResponse.json({ erro: "Esse agendamento não pode mais ser alterado" }, { status: 400 });
    }

    const { data: config } = await admin.from("configuracoes_plataforma").select("limite_horas_remarcar").eq("id", 1).single();
    const limiteHoras = config?.limite_horas_remarcar ?? 2;

    const limiteParaAlterar = new Date(agendamento.inicio).getTime() - limiteHoras * 3_600_000;
    if (Date.now() > limiteParaAlterar) {
      return NextResponse.json(
        { erro: `Só é possível remarcar até ${limiteHoras}h antes do horário atual.` },
        { status: 400 }
      );
    }

    const { data: servico } = await admin
      .from("servicos")
      .select("duracao_minutos")
      .eq("id", agendamento.servico_id)
      .single();
    if (!servico) return NextResponse.json({ erro: "Serviço não encontrado" }, { status: 400 });

    // Confere de novo, no servidor, que o horário novo escolhido realmente
    // está livre (ignorando o próprio agendamento atual na checagem).
    const disponiveis = await calcularHorariosDisponiveis({
      profissionalId: agendamento.profissional_id,
      colaboradorId: agendamento.colaborador_id ?? undefined,
      duracaoMinutos: servico.duracao_minutos,
      data: validado.data.data,
      ignorarAgendamentoId: agendamento.id,
    });
    if (!disponiveis.horarios.includes(validado.data.hora)) {
      return NextResponse.json({ erro: "Esse horário não está mais disponível." }, { status: 409 });
    }

    const novoInicio = horaBrasilParaData(validado.data.data, validado.data.hora);
    const novoFim = new Date(novoInicio.getTime() + servico.duracao_minutos * 60_000);

    const { error } = await admin
      .from("agendamentos")
      .update({
        inicio: novoInicio.toISOString(), fim: novoFim.toISOString(), status: "pendente",
        lembrete_30min_enviado: false, lembrete_1h_push_enviado: false,
      })
      .eq("id", agendamento.id);

    if (error) {
      console.error("Erro do Supabase ao remarcar (update):", JSON.stringify(error, null, 2));
      return NextResponse.json({ erro: "Não foi possível remarcar" }, { status: 500 });
    }

    const { data: servicoNome } = await admin.from("servicos").select("nome").eq("id", agendamento.servico_id).single();
    enviarNotificacaoPushProfissional(agendamento.profissional_id, {
      titulo: "Agendamento remarcado 🔄",
      corpo: `${cliente.nome} mudou o horário de ${servicoNome?.nome ?? "um serviço"} pra ${novoInicio.toLocaleDateString("pt-BR")} às ${novoInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      url: "/painel/agenda",
    }).catch((erro) => console.error("Falha ao notificar remarcação pro profissional:", erro));

    return NextResponse.json({ ok: true });
  } catch (erro: any) {
    console.error("ERRO REAL em /api/cliente/reagendar:", erro?.message ?? erro, erro?.stack ?? "");
    return NextResponse.json({ erro: "Não foi possível remarcar. Tente de novo." }, { status: 500 });
  }
}
