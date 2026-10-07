// Calcula os horários livres de um dia, cruzando: horário de
// funcionamento, agendamentos já existentes, e bloqueios pontuais.
// Usado tanto pra tela pública de agendar quanto pra remarcação do cliente.
//
// IMPORTANTE: todo cálculo de hora "de parede" (horário de funcionamento,
// horários mostrados na tela) usa o helper de fuso de lib/timezone.ts —
// nunca o construtor local do Date — porque o servidor pode rodar em
// UTC (na Vercel) mesmo que o negócio seja no horário de Brasília.
import { createAdminClient } from "@/lib/supabase/admin";
import { horaBrasilParaData, formatarHoraBrasil, diaDaSemanaBrasil } from "@/lib/timezone";

export async function calcularHorariosDisponiveis(params: {
  profissionalId: string;
  colaboradorId?: string;
  duracaoMinutos: number;
  data: string; // "YYYY-MM-DD"
  ignorarAgendamentoId?: string; // usado na remarcação, pra não contar o próprio horário atual como ocupado
}) {
  const admin = createAdminClient();
  const diaSemana = diaDaSemanaBrasil(params.data);

  const { data: horario } = await admin
    .from("horarios_funcionamento")
    .select("hora_inicio, hora_fim, ativo")
    .eq("profissional_id", params.profissionalId)
    .eq("dia_semana", diaSemana)
    .maybeSingle();

  if (!horario || !horario.ativo) return { horarios: [], bloqueios: [] }; // não funciona nesse dia da semana

  const inicioExpediente = horaBrasilParaData(params.data, horario.hora_inicio.slice(0, 5));
  const fimExpediente = horaBrasilParaData(params.data, horario.hora_fim.slice(0, 5));

  // Agendamentos que já ocupam horário nesse dia (do mesmo colaborador,
  // ou geral do estabelecimento se nenhum colaborador foi escolhido)
  let consultaOcupados = admin
    .from("agendamentos")
    .select("id, inicio, fim")
    .eq("profissional_id", params.profissionalId)
    .neq("status", "cancelado")
    .gte("inicio", inicioExpediente.toISOString())
    .lt("inicio", fimExpediente.toISOString());
  consultaOcupados = params.colaboradorId
    ? consultaOcupados.eq("colaborador_id", params.colaboradorId)
    : consultaOcupados.is("colaborador_id", null);
  const { data: ocupados } = await consultaOcupados;

  // Bloqueios pontuais (do colaborador, ou geral se nenhum colaborador)
  // Confere o formato de UUID aqui TAMBÉM (defesa extra, além da
  // validação que já acontece em quem chama essa função) — evita
  // qualquer risco de injeção de filtro, mesmo que um chamador futuro
  // esqueça de validar antes de passar pra cá.
  const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (params.colaboradorId && !REGEX_UUID.test(params.colaboradorId)) {
    throw new Error("colaboradorId inválido");
  }

  let consultaBloqueios = admin
    .from("bloqueios_agenda")
    .select("inicio, fim, motivo")
    .eq("profissional_id", params.profissionalId)
    .lt("inicio", fimExpediente.toISOString())
    .gt("fim", inicioExpediente.toISOString());
  consultaBloqueios = params.colaboradorId
    ? consultaBloqueios.or(`colaborador_id.eq.${params.colaboradorId},colaborador_id.is.null`)
    : consultaBloqueios.is("colaborador_id", null);
  const { data: bloqueios } = await consultaBloqueios;

  // Reservas temporárias de horário: alguém já está no meio do pagamento
  // desse horário — conta como ocupado até confirmar ou expirar.
  let consultaCheckouts = admin
    .from("checkouts_pendentes")
    .select("inicio, fim")
    .eq("profissional_id", params.profissionalId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .lt("inicio", fimExpediente.toISOString())
    .gt("fim", inicioExpediente.toISOString());
  consultaCheckouts = params.colaboradorId
    ? consultaCheckouts.eq("colaborador_id", params.colaboradorId)
    : consultaCheckouts.is("colaborador_id", null);
  const { data: checkoutsPendentes } = await consultaCheckouts;

  // Horário de almoço do colaborador — conta como ocupado, igual um
  // bloqueio, só que vem cadastrado no próprio perfil dele, não na
  // agenda de bloqueios pontuais.
  let almoco: { inicio: Date; fim: Date } | null = null;
  if (params.colaboradorId) {
    const { data: colaborador } = await admin
      .from("colaboradores")
      .select("almoco_inicio, almoco_fim")
      .eq("id", params.colaboradorId)
      .maybeSingle();
    if (colaborador?.almoco_inicio && colaborador?.almoco_fim) {
      almoco = {
        inicio: horaBrasilParaData(params.data, colaborador.almoco_inicio.slice(0, 5)),
        fim: horaBrasilParaData(params.data, colaborador.almoco_fim.slice(0, 5)),
      };
    }
  }

  const ocupacoes = [
    ...(ocupados ?? [])
      .filter((o) => o.id !== params.ignorarAgendamentoId)
      .map((o) => ({ inicio: new Date(o.inicio), fim: new Date(o.fim) })),
    ...(bloqueios ?? []).map((b) => ({ inicio: new Date(b.inicio), fim: new Date(b.fim) })),
    ...(checkoutsPendentes ?? []).map((c) => ({ inicio: new Date(c.inicio), fim: new Date(c.fim) })),
    ...(almoco ? [almoco] : []),
  ];

  const agora = new Date();
  const horarios: string[] = [];
  let cursor = new Date(inicioExpediente);

  while (cursor.getTime() + params.duracaoMinutos * 60_000 <= fimExpediente.getTime()) {
    const fimSlot = new Date(cursor.getTime() + params.duracaoMinutos * 60_000);
    const colide = ocupacoes.some((o) => cursor < o.fim && fimSlot > o.inicio);
    const jaPassou = cursor < agora;
    if (!colide && !jaPassou) {
      horarios.push(formatarHoraBrasil(cursor));
    }
    cursor = new Date(cursor.getTime() + params.duracaoMinutos * 60_000);
  }

  const bloqueiosFormatados = [
    ...(bloqueios ?? []).map((b) => ({
      inicio: formatarHoraBrasil(new Date(b.inicio)),
      fim: formatarHoraBrasil(new Date(b.fim)),
      motivo: b.motivo as string | null,
    })),
    ...(almoco ? [{ inicio: formatarHoraBrasil(almoco.inicio), fim: formatarHoraBrasil(almoco.fim), motivo: "Almoço" }] : []),
  ];

  return { horarios, bloqueios: bloqueiosFormatados };
}
