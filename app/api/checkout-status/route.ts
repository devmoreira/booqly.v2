// GET /api/checkout-status?id=...
// A tela de pagamento consulta isso de tempos em tempos. Desde o novo
// modelo (chave própria do profissional), NINGUÉM nos avisa quando o
// pagamento confirma — é a GENTE que precisa perguntar pro gateway,
// usando a chave do próprio profissional. É aqui, na primeira vez que
// detectamos "pago", que o agendamento de verdade nasce, o profissional
// é avisado, o colaborador recebe a fatia dele (Pix normal), e o
// subsídio de cupom é pago (se tiver).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGatewayAtivo } from "@/lib/payments/adapter";
import { descriptografar } from "@/lib/crypto";
import { notificarNovoAgendamento } from "@/lib/notificacoes";
import { enviarNotificacaoPush } from "@/lib/push";
import { estornarCobranca } from "@/lib/payments/estorno";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: checkout } = await admin.from("checkouts_pendentes").select("*").eq("id", id).single();
  if (!checkout) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  if (checkout.status === "pendente" || (checkout.status === "pago" && !checkout.agendamento_id)) {
    const expirado = checkout.status === "pendente" && new Date(checkout.expira_em).getTime() < Date.now();

    if (!expirado && checkout.cobranca_id_externo) {
      const { data: profissional } = await admin
        .from("profissionais")
        .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
        .eq("id", checkout.profissional_id)
        .single();

      if (profissional?.chave_api_pagamento_criptografada && profissional.gateway_pagamento) {
        const apiKey = descriptografar(profissional.chave_api_pagamento_criptografada);
        const gateway = getGatewayAtivo(profissional.gateway_pagamento as "asaas" | "mercadopago");
        const statusReal = checkout.status === "pago"
          ? "pago" as const
          : await gateway
              .consultarStatus(checkout.cobranca_id_externo, apiKey, (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox")
              .catch(() => "pendente" as const);

        if (statusReal === "pago") {
          // Trava atômica: só processa se AINDA estiver "pendente" no banco —
          // evita processar duas vezes se duas consultas chegarem juntas.
          const ganhouACorrida = checkout.status === "pago"
            ? [{ id }]
            : (await admin
                .from("checkouts_pendentes")
                .update({ status: "pago" })
                .eq("id", id)
                .eq("status", "pendente")
                .select("id")).data;

          if (ganhouACorrida && ganhouACorrida.length > 0) {
            await processarPagamentoConfirmado(admin, checkout);
          }
        } else if (statusReal === "falhou") {
          await admin.from("checkouts_pendentes").update({ status: "falhou" }).eq("id", id).eq("status", "pendente");
        }
      }
    }
  }

  const { data: checkoutAtual } = await admin
    .from("checkouts_pendentes")
    .select("status, agendamento_id, expira_em")
    .eq("id", id)
    .single();

  if (!checkoutAtual) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  let statusAgendamento: string | null = null;
  if (checkoutAtual.agendamento_id) {
    const { data: agendamento } = await admin.from("agendamentos").select("status").eq("id", checkoutAtual.agendamento_id).single();
    statusAgendamento = agendamento?.status ?? null;
  }

  const expirado = checkoutAtual.status === "pendente" && new Date(checkoutAtual.expira_em).getTime() < Date.now();

  return NextResponse.json({
    status: expirado ? "expirado" : checkoutAtual.status,
    agendamentoId: checkoutAtual.agendamento_id,
    statusAgendamento,
  });
}

async function estornarCheckoutSemAgendamento(
  admin: ReturnType<typeof createAdminClient>,
  checkout: any
) {
  if (!checkout.cobranca_id_externo) return;

  const { data: profissional } = await admin
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
    .eq("id", checkout.profissional_id)
    .single();

  if (!profissional?.gateway_pagamento || !profissional.chave_api_pagamento_criptografada) {
    throw new Error("Profissional sem gateway configurado para estorno");
  }

  const apiKey = descriptografar(profissional.chave_api_pagamento_criptografada);
  await estornarCobranca(
    checkout.cobranca_id_externo,
    profissional.gateway_pagamento as "asaas" | "mercadopago",
    apiKey,
    (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox"
  );

  await admin
    .from("checkouts_pendentes")
    .update({ status: "falhou" })
    .eq("id", checkout.id)
    .eq("status", "pago");
}

async function processarPagamentoConfirmado(
  admin: ReturnType<typeof createAdminClient>,
  checkout: any
) {
  const { data: colaborador } = checkout.colaborador_id
    ? await admin.from("colaboradores").select("confirmacao_automatica").eq("id", checkout.colaborador_id).single()
    : { data: null };
  const statusInicial = colaborador?.confirmacao_automatica ? "confirmado" : "pendente";

  const { data: profissional } = await admin
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
    .eq("id", checkout.profissional_id)
    .single();

  if (!profissional?.gateway_pagamento || !profissional.chave_api_pagamento_criptografada) {
    console.error("Falha ao confirmar pagamento: gateway do profissional não está disponível", checkout.profissional_id);
    return;
  }

  const { data: agendamentoExistente } = await admin
    .from("agendamentos")
    .select("id")
    .eq("profissional_id", checkout.profissional_id)
    .eq("cliente_id", checkout.cliente_id)
    .eq("servico_id", checkout.servico_id)
    .eq("inicio", checkout.inicio)
    .eq("fim", checkout.fim)
    .neq("status", "cancelado")
    .maybeSingle();

  const { data: agendamento, error: erroAgendamento } = agendamentoExistente
    ? { data: agendamentoExistente, error: null }
    : await admin
    .from("agendamentos")
    .insert({
      profissional_id: checkout.profissional_id,
      colaborador_id: checkout.colaborador_id,
      servico_id: checkout.servico_id,
      cliente_id: checkout.cliente_id,
      inicio: checkout.inicio,
      fim: checkout.fim,
      status: statusInicial,
      status_pagamento: checkout.metodo === "pagamento_total" ? "pago_total" : "pago_parcial",
      valor_pago_centavos: checkout.valor_original_centavos, // sem desconto — é o que o profissional "vê" como pago
    })
    .select("id")
    .single();

  if (erroAgendamento || !agendamento) {
    console.error("Falha ao criar agendamento após pagamento confirmado:", erroAgendamento);
    if (erroAgendamento?.code === "23P01") {
      // Alguém ocupou esse horário enquanto o pagamento processava —
      // o cliente já pagou, então precisa receber de volta.
      await estornarCheckoutSemAgendamento(admin, checkout).catch((erro: unknown) =>
        console.error("Falha ao estornar cliente após colisão de horário:", erro)
      );
      await enviarNotificacaoPush(checkout.cliente_id, {
        titulo: "Ops, esse horário acabou de ser ocupado",
        corpo: "Seu pagamento está sendo estornado automaticamente. Agende de novo em outro horário.",
        url: "/cliente/historico",
      }).catch((erro) => console.error("Falha ao notificar colisão de horário:", erro));
    }
    return;
  }

  const { data: cobrancaExistente } = await admin
    .from("cobrancas")
    .select("id")
    .eq("agendamento_id", agendamento.id)
    .eq("cobranca_id_externo", checkout.cobranca_id_externo)
    .maybeSingle();

  if (!cobrancaExistente) {
    const { error: erroCobranca } = await admin.from("cobrancas").insert({
      agendamento_id: agendamento.id,
      gateway: profissional.gateway_pagamento,
      cobranca_id_externo: checkout.cobranca_id_externo,
      forma: checkout.forma_pagamento,
      valor_centavos: checkout.valor_original_centavos,
      tipo: checkout.metodo === "taxa_agendamento" ? "taxa_agendamento" : "total",
      status: "pago",
      repasse_status: "concluido", // o dinheiro já caiu direto na conta do profissional
    });
    if (erroCobranca) {
      console.error("Falha ao registrar cobrança após pagamento confirmado:", erroCobranca);
      return;
    }
  }

  await admin.from("checkouts_pendentes").update({ agendamento_id: agendamento.id }).eq("id", checkout.id);

  if (checkout.cupom_id) {
    const { data: cupomAtual } = await admin.from("cupons").select("usos_atuais").eq("id", checkout.cupom_id).single();
    if (cupomAtual) await admin.from("cupons").update({ usos_atuais: cupomAtual.usos_atuais + 1 }).eq("id", checkout.cupom_id);

    const { data: usoPorEmpresaAtual } = await admin
      .from("cupom_usos_por_profissional")
      .select("id, usos_atuais")
      .eq("cupom_id", checkout.cupom_id)
      .eq("profissional_id", checkout.profissional_id)
      .maybeSingle();
    if (usoPorEmpresaAtual) {
      await admin.from("cupom_usos_por_profissional").update({ usos_atuais: usoPorEmpresaAtual.usos_atuais + 1 }).eq("id", usoPorEmpresaAtual.id);
    } else {
      await admin.from("cupom_usos_por_profissional").insert({ cupom_id: checkout.cupom_id, profissional_id: checkout.profissional_id, usos_atuais: 1 });
    }
  }

  const { data: clienteRow } = await admin.from("clientes").select("nome").eq("id", checkout.cliente_id).single();
  notificarNovoAgendamento(admin, checkout.profissional_id, checkout.servico_id, clienteRow?.nome ?? "Cliente", new Date(checkout.inicio))
    .catch((erro) => console.error("Falha ao notificar novo agendamento:", erro));

  enviarNotificacaoPush(checkout.cliente_id, {
    titulo: "Pagamento confirmado! 🎉",
    corpo: "Seu agendamento já está garantido. Toque pra ver os detalhes.",
    url: "/cliente",
  }).catch((erro) => console.error("Falha ao enviar notificação push:", erro));

  // O repasse pro colaborador NÃO é mais pago aqui (na confirmação do
  // pagamento) — só quando o agendamento for marcado como CONCLUÍDO de
  // verdade (ver lib/pagamentos-na-conclusao.ts). Isso evita repassar
  // por um atendimento que ainda pode ser cancelado.

  // O subsídio de cupom NÃO é mais pago aqui (na confirmação do
  // pagamento) — só quando o agendamento for marcado como CONCLUÍDO de
  // verdade (ver lib/pagamentos-na-conclusao.ts). Isso evita pagar por um serviço que
  // ainda pode ser cancelado.
}
