// GET/PUT /api/colaborador/agendamentos
// Agenda do colaborador logado — só os agendamentos atribuídos a ele
// (RLS garante isso via auth.uid() = colaborador_id).
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
    .select("id, inicio, fim, status, servico_id, cliente_id")
    .eq("colaborador_id", user.id)
    .order("inicio");

  if (erroAgendamentos) {
    console.error("Erro ao buscar agenda do colaborador:", erroAgendamentos);
    return NextResponse.json({ erro: erroAgendamentos.message }, { status: 500 });
  }
  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ agendamentos: [] });
  }

  const servicoIds = [...new Set(agendamentos.map((a) => a.servico_id))];
  const clienteIds = [...new Set(agendamentos.map((a) => a.cliente_id))];

  const admin = createAdminClient();
  const agendamentoIds = agendamentos.map((a) => a.id);
  const [{ data: servicos }, { data: clientes }, { data: avaliacoesClientes }, { data: avaliacoesJaFeitas }] = await Promise.all([
    supabase.from("servicos").select("id, nome").in("id", servicoIds),
    admin.from("clientes").select("id, nome, telefone").in("id", clienteIds),
    admin.from("avaliacoes_cliente").select("cliente_id, nota").in("cliente_id", clienteIds),
    admin.from("avaliacoes_cliente").select("agendamento_id").in("agendamento_id", agendamentoIds),
  ]);

  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));
  const idsJaAvaliados = new Set((avaliacoesJaFeitas ?? []).map((a) => a.agendamento_id));

  const mapaReputacao = new Map<string, { soma: number; quantidade: number }>();
  for (const av of avaliacoesClientes ?? []) {
    const atual = mapaReputacao.get(av.cliente_id) ?? { soma: 0, quantidade: 0 };
    atual.soma += av.nota;
    atual.quantidade += 1;
    mapaReputacao.set(av.cliente_id, atual);
  }

  const resultado = agendamentos.map((a) => {
    const rep = mapaReputacao.get(a.cliente_id);
    return {
      id: a.id, inicio: a.inicio, fim: a.fim, status: a.status, clienteId: a.cliente_id,
      servicos: mapaServicos.get(a.servico_id) ?? null,
      clientes: mapaClientes.get(a.cliente_id) ?? null,
      reputacaoCliente: rep ? { media: rep.soma / rep.quantidade, quantidade: rep.quantidade } : null,
      jaAvaliado: idsJaAvaliados.has(a.id),
    };
  });

  return NextResponse.json({ agendamentos: resultado });
}

const schema = z.object({ id: z.string().uuid(), status: z.enum(["confirmado", "concluido", "cancelado"]) });

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const { data: atual } = await supabase
    .from("agendamentos")
    .select("status, profissional_id, cliente_id, servico_id, inicio")
    .eq("id", validado.data.id)
    .eq("colaborador_id", user.id)
    .single();

  if (validado.data.status === "cancelado" && atual && new Date(atual.inicio).getTime() < Date.now()) {
    return NextResponse.json({ erro: "Esse horário já passou — não dá mais pra cancelar, só marcar como concluído." }, { status: 400 });
  }
  if (validado.data.status === "concluido" && atual && new Date(atual.inicio).getTime() > Date.now()) {
    return NextResponse.json({ erro: "Só dá pra marcar como concluído depois do horário marcado." }, { status: 400 });
  }

  const { error } = await supabase
    .from("agendamentos")
    .update({ status: validado.data.status })
    .eq("id", validado.data.id)
    .eq("colaborador_id", user.id);

  if (error) return NextResponse.json({ erro: "não foi possível atualizar" }, { status: 500 });

  if (validado.data.status === "concluido" && atual?.status !== "concluido") {
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

  console.log(`Colaborador PUT agendamentos: id=${validado.data.id}, novoStatus=${validado.data.status}, statusAnterior=${atual?.status}, clienteId=${atual?.cliente_id}`);

  if (validado.data.status === "confirmado" && atual?.status !== "confirmado" && atual?.cliente_id) {
    console.log(`Enviando push de confirmação pro cliente ${atual.cliente_id}...`);
    enviarNotificacaoPush(atual.cliente_id, {
      titulo: "Agendamento confirmado! ✅",
      corpo: "O estabelecimento confirmou seu horário. Toque pra ver os detalhes.",
      url: "/cliente",
    }).then(() => console.log("Push de confirmação enviado com sucesso."))
      .catch((erro) => console.error("Falha ao enviar notificação push de confirmação:", erro));
  } else if (validado.data.status === "confirmado") {
    console.log("Push de confirmação NÃO enviado — condição não bateu (status já era confirmado, ou sem cliente_id).");
  }

  return NextResponse.json({ ok: true });
}
