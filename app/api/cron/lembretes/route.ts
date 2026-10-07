// GET /api/cron/lembretes
// Chamado automaticamente pela Vercel a cada 10 minutos (ver vercel.json).
// Manda lembrete de 1h antes e 30min antes, só por notificação push no
// celular — sem WhatsApp, que tem custo real por mensagem enviada.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacaoPush } from "@/lib/push";
import { segredosIguais } from "@/lib/comparar-segredo";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET não configurado — recusando por segurança.");
    return NextResponse.json({ erro: "cron não configurado" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (!segredosIguais(auth ?? "", `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const agora = Date.now();

  await processarJanela(admin, {
    campoFlag: "lembrete_1h_push_enviado",
    inicioJanela: new Date(agora + (60 - 5) * 60_000),
    fimJanela: new Date(agora + (60 + 5) * 60_000),
    montarTextoPush: (nomeServico, dataHora) =>
      `Falta 1 hora pro seu horário de ${nomeServico}, às ${dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
  });

  await processarJanela(admin, {
    campoFlag: "lembrete_30min_enviado",
    inicioJanela: new Date(agora + 25 * 60_000),
    fimJanela: new Date(agora + 35 * 60_000),
    montarTextoPush: (nomeServico) => `Faltam 30 minutos pro seu horário de ${nomeServico}. Já está a caminho?`,
  });

  return NextResponse.json({ ok: true });
}

async function processarJanela(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    campoFlag: "lembrete_30min_enviado" | "lembrete_1h_push_enviado";
    inicioJanela: Date; fimJanela: Date;
    montarTextoPush: (nomeServico: string, dataHora: Date, nomeCliente: string) => string;
  }
) {
  const { data: agendamentos } = await admin
    .from("agendamentos")
    .select("id, inicio, servico_id, cliente_id")
    .in("status", ["pendente", "confirmado"])
    .eq(params.campoFlag, false)
    .gte("inicio", params.inicioJanela.toISOString())
    .lte("inicio", params.fimJanela.toISOString());

  for (const agendamento of agendamentos ?? []) {
    const [{ data: servico }, { data: cliente }] = await Promise.all([
      admin.from("servicos").select("nome").eq("id", agendamento.servico_id).single(),
      admin.from("clientes").select("nome").eq("id", agendamento.cliente_id).single(),
    ]);
    const nomeServico = servico?.nome ?? "seu serviço";
    const dataHora = new Date(agendamento.inicio);
    const nomeCliente = cliente?.nome ?? "";

    await enviarNotificacaoPush(agendamento.cliente_id, {
      titulo: "Lembrete de agendamento ⏰",
      corpo: params.montarTextoPush(nomeServico, dataHora, nomeCliente),
      url: "/cliente",
    }).catch((erro) => console.error("Falha ao enviar lembrete push:", erro));

    await admin.from("agendamentos").update({ [params.campoFlag]: true }).eq("id", agendamento.id);
  }
}
