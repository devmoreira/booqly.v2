// GET/PUT /api/painel/agendamentos — agendamentos do profissional logado
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarCancelamentoComEstorno } from "@/lib/cancelamento";
import { enviarNotificacaoPush } from "@/lib/push";
import { processarPagamentosNaConclusao } from "@/lib/pagamentos-na-conclusao";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data: agendamentos, error: erroAgendamentos } = await supabase
    .from("agendamentos")
    .select("id, inicio, fim, status, servico_id, cliente_id, colaborador_id")
    .eq("profissional_id", user.id)
    .order("inicio");

  if (erroAgendamentos) {
    console.error("Erro ao buscar agendamentos:", erroAgendamentos);
    return NextResponse.json({ erro: erroAgendamentos.message }, { status: 500 });
  }
  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ agendamentos: [] });
  }

  const servicoIds = [...new Set(agendamentos.map((a) => a.servico_id))];
  const clienteIds = [...new Set(agendamentos.map((a) => a.cliente_id))];
  const colaboradorIds = [...new Set(agendamentos.map((a) => a.colaborador_id).filter(Boolean))];

  const admin = createAdminClient();
  const agendamentoIds = agendamentos.map((a) => a.id);
  const [{ data: servicos, error: erroServicos }, { data: clientes, error: erroClientes }, { data: colaboradores }, { data: avaliacoesClientes }, { data: avaliacoesJaFeitas }] = await Promise.all([
    supabase.from("servicos").select("id, nome").in("id", servicoIds),
    supabase.from("clientes").select("id, nome, telefone").in("id", clienteIds),
    colaboradorIds.length > 0
      ? supabase.from("colaboradores").select("id, nome").in("id", colaboradorIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    admin.from("avaliacoes_cliente").select("cliente_id, nota").in("cliente_id", clienteIds),
    admin.from("avaliacoes_cliente").select("agendamento_id").in("agendamento_id", agendamentoIds),
  ]);

  if (erroServicos || erroClientes) {
    console.error("Erro ao buscar serviços/clientes:", erroServicos, erroClientes);
    return NextResponse.json({ erro: (erroServicos ?? erroClientes)?.message }, { status: 500 });
  }

  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));
  const mapaColaboradores = new Map((colaboradores ?? []).map((c) => [c.id, c]));

  const mapaReputacao = new Map<string, { soma: number; quantidade: number }>();
  for (const av of avaliacoesClientes ?? []) {
    const atual = mapaReputacao.get(av.cliente_id) ?? { soma: 0, quantidade: 0 };
    atual.soma += av.nota;
    atual.quantidade += 1;
    mapaReputacao.set(av.cliente_id, atual);
  }

  const idsJaAvaliados = new Set((avaliacoesJaFeitas ?? []).map((a) => a.agendamento_id));

  const resultado = agendamentos.map((a) => {
    const rep = mapaReputacao.get(a.cliente_id);
    return {
      id: a.id,
      inicio: a.inicio,
      fim: a.fim,
      status: a.status,
      clienteId: a.cliente_id,
      servicos: mapaServicos.get(a.servico_id) ?? null,
      clientes: mapaClientes.get(a.cliente_id) ?? null,
      colaboradorId: a.colaborador_id,
      colaboradores: a.colaborador_id ? mapaColaboradores.get(a.colaborador_id) ?? null : null,
      reputacaoCliente: rep ? { media: rep.soma / rep.quantidade, quantidade: rep.quantidade } : null,
      jaAvaliado: idsJaAvaliados.has(a.id),
    };
  });

  return NextResponse.json({ agendamentos: resultado });
}

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["confirmado", "concluido", "cancelado"]).optional(),
  novoInicio: z.string().datetime().optional(), // sujeito ao mesmo prazo configurável (limite_horas_remarcar)
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });
  if (!validado.data.status && !validado.data.novoInicio) {
    return NextResponse.json({ erro: "nada pra atualizar" }, { status: 400 });
  }

  // Busca o estado ATUAL antes de atualizar — só soma ponto de indicação
  // se estiver virando "concluído" agora (evita contar duas vezes se
  // alguém clicar de novo, ou já tiver sido concluído antes).
  const { data: atual } = await supabase
    .from("agendamentos")
    .select("status, servico_id, inicio, cliente_id")
    .eq("id", validado.data.id)
    .eq("profissional_id", user.id)
    .single();
  if (!atual) return NextResponse.json({ erro: "agendamento não encontrado" }, { status: 404 });

  if (validado.data.status === "cancelado" && new Date(atual.inicio).getTime() < Date.now()) {
    return NextResponse.json({ erro: "Esse horário já passou — não dá mais pra cancelar, só marcar como concluído." }, { status: 400 });
  }
  if (validado.data.status === "concluido" && new Date(atual.inicio).getTime() > Date.now()) {
    return NextResponse.json({ erro: "Só dá pra marcar como concluído depois do horário marcado." }, { status: 400 });
  }

  const dadosParaAtualizar: Record<string, unknown> = {};
  if (validado.data.status) dadosParaAtualizar.status = validado.data.status;

  if (validado.data.novoInicio) {
    if (atual.status === "concluido" || atual.status === "cancelado") {
      return NextResponse.json({ erro: "Esse agendamento já foi finalizado — não dá mais pra remarcar." }, { status: 400 });
    }
    const { data: config } = await supabase.from("configuracoes_plataforma").select("limite_horas_remarcar").eq("id", 1).single();
    const limiteHoras = config?.limite_horas_remarcar ?? 2;
    const limiteParaAlterar = new Date(atual.inicio).getTime() - limiteHoras * 3_600_000;
    if (Date.now() > limiteParaAlterar) {
      return NextResponse.json({ erro: `Só é possível remarcar até ${limiteHoras}h antes do horário atual.` }, { status: 400 });
    }
    const { data: servico } = await supabase.from("servicos").select("duracao_minutos").eq("id", atual.servico_id).single();
    if (!servico) return NextResponse.json({ erro: "serviço não encontrado" }, { status: 404 });
    const novoInicio = new Date(validado.data.novoInicio);
    const novoFim = new Date(novoInicio.getTime() + servico.duracao_minutos * 60_000);
    dadosParaAtualizar.inicio = novoInicio.toISOString();
    dadosParaAtualizar.fim = novoFim.toISOString();
    // Muda de horário — os lembretes automáticos precisam disparar de novo pro horário certo
    dadosParaAtualizar.lembrete_30min_enviado = false;
    dadosParaAtualizar.lembrete_1h_push_enviado = false;
  }

  const { error } = await supabase
    .from("agendamentos")
    .update(dadosParaAtualizar)
    .eq("id", validado.data.id)
    .eq("profissional_id", user.id);

  if (error) return NextResponse.json({ erro: "não foi possível atualizar" }, { status: 500 });

  if (validado.data.status === "concluido" && atual.status !== "concluido") {
    processarPagamentosNaConclusao(createAdminClient(), validado.data.id).catch((erro) =>
      console.error("Falha ao processar pagamentos na conclusão:", erro)
    );
  }

  if (validado.data.status === "cancelado" && atual?.status !== "cancelado") {
    await processarCancelamentoComEstorno(createAdminClient(), validado.data.id);
    if (atual?.cliente_id) {
      const { data: servicoCancelado } = await supabase.from("servicos").select("nome").eq("id", atual.servico_id).single();
      enviarNotificacaoPush(atual.cliente_id, {
        titulo: "Agendamento cancelado ❌",
        corpo: `O estabelecimento cancelou seu horário de ${servicoCancelado?.nome ?? "serviço"}.`,
        url: "/cliente/historico",
      }).catch((erro) => console.error("Falha ao notificar cancelamento pro cliente:", erro));
    }
  }

  if (validado.data.novoInicio && atual?.cliente_id) {
    const novoInicioDate = new Date(validado.data.novoInicio);
    const { data: servicoRemarcado } = await supabase.from("servicos").select("nome").eq("id", atual.servico_id).single();
    enviarNotificacaoPush(atual.cliente_id, {
      titulo: "Agendamento remarcado 🔄",
      corpo: `O estabelecimento mudou seu horário de ${servicoRemarcado?.nome ?? "serviço"} pra ${novoInicioDate.toLocaleDateString("pt-BR")} às ${novoInicioDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      url: "/cliente/historico",
    }).catch((erro) => console.error("Falha ao notificar remarcação pro cliente:", erro));
  }

  if (validado.data.status === "confirmado" && atual?.status !== "confirmado" && atual?.cliente_id) {
    enviarNotificacaoPush(atual.cliente_id, {
      titulo: "Agendamento confirmado! ✅",
      corpo: "O estabelecimento confirmou seu horário. Toque pra ver os detalhes.",
      url: "/cliente",
    }).catch((erro) => console.error("Falha ao enviar notificação push de confirmação:", erro));
  }

  return NextResponse.json({ ok: true });
}
