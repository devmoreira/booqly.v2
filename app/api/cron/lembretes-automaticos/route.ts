// GET /api/cron/lembretes-automaticos
// Roda 1x por dia. Pra cada profissional com o lembrete automático
// ativo (e Premium), acha quem passou do prazo configurado sem visitar
// e manda push — só uma vez por "sumiço" (não manda todo dia; só manda
// de novo depois que a pessoa visitar de novo e sumir outra vez).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";
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
  const { data: configsAtivas } = await admin
    .from("configuracoes_lembrete_automatico")
    .select("profissional_id, dias_sem_visita, mensagem")
    .eq("ativo", true);

  let totalEnviados = 0;

  for (const config of configsAtivas ?? []) {
    // Confere Premium de novo aqui — se o profissional caiu pro Básico
    // depois de configurar, o lembrete automático para sozinho.
    if (!(await temAcessoPremium(config.profissional_id))) continue;

    const { data: profissional } = await admin
      .from("profissionais")
      .select("nome_negocio")
      .eq("id", config.profissional_id)
      .single();

    const { data: agendamentos } = await admin
      .from("agendamentos")
      .select("cliente_id, inicio")
      .eq("profissional_id", config.profissional_id)
      .eq("status", "concluido");

    const ultimaVisitaPorCliente = new Map<string, string>();
    for (const a of agendamentos ?? []) {
      const atual = ultimaVisitaPorCliente.get(a.cliente_id);
      if (!atual || a.inicio > atual) ultimaVisitaPorCliente.set(a.cliente_id, a.inicio);
    }

    const limite = Date.now() - config.dias_sem_visita * 86_400_000;
    const { data: jaEnviados } = await admin
      .from("lembretes_automaticos_enviados")
      .select("cliente_id, enviado_em")
      .eq("profissional_id", config.profissional_id);
    const mapaEnviados = new Map((jaEnviados ?? []).map((e) => [e.cliente_id, e.enviado_em]));

    const mensagem = config.mensagem?.trim()
      || `Faz um tempinho que você não aparece aqui na ${profissional?.nome_negocio ?? "gente"} — que tal marcar um horário?`;

    for (const [clienteId, ultimaVisita] of ultimaVisitaPorCliente.entries()) {
      if (new Date(ultimaVisita).getTime() >= limite) continue; // ainda não passou do prazo

      const ultimoEnvio = mapaEnviados.get(clienteId);
      // Já mandou depois da última visita dessa pessoa? Não manda de novo.
      if (ultimoEnvio && ultimoEnvio >= ultimaVisita) continue;

      try {
        await enviarNotificacaoPush(clienteId, {
          titulo: `${profissional?.nome_negocio ?? "Seu estabelecimento"} sentiu sua falta! 👋`,
          corpo: mensagem,
          url: "/",
        });
        await admin.from("lembretes_automaticos_enviados").upsert({
          profissional_id: config.profissional_id,
          cliente_id: clienteId,
          enviado_em: new Date().toISOString(),
        });
        totalEnviados++;
      } catch (erro) {
        console.error(`Falha ao enviar lembrete automático pro cliente ${clienteId}:`, erro);
      }
    }
  }

  return NextResponse.json({ ok: true, totalEnviados, profissionaisProcessados: configsAtivas?.length ?? 0 });
}
