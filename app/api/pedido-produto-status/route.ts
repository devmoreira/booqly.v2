// GET /api/pedido-produto-status?id=...
// A tela de pagamento consulta isso de tempos em tempos. Mesmo modelo
// do checkout de agendamento: a gente pergunta pro gateway (com a
// chave do próprio profissional) se já pagou.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGatewayAtivo } from "@/lib/payments/adapter";
import { descriptografar } from "@/lib/crypto";
import { enviarNotificacaoPush, enviarNotificacaoPushProfissional } from "@/lib/push";
import { estornarCobranca } from "@/lib/payments/estorno";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: pedido } = await admin.from("pedidos_produtos").select("*").eq("id", id).single();
  if (!pedido) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  if (pedido.status === "pendente") {
    const expirado = new Date(pedido.expira_em).getTime() < Date.now();

    if (!expirado && pedido.cobranca_id_externo) {
      const { data: profissional } = await admin
        .from("profissionais")
        .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
        .eq("id", pedido.profissional_id)
        .single();

      if (profissional?.chave_api_pagamento_criptografada && profissional.gateway_pagamento) {
        const apiKey = descriptografar(profissional.chave_api_pagamento_criptografada);
        const gateway = getGatewayAtivo(profissional.gateway_pagamento as "asaas" | "mercadopago");
        const statusReal = await gateway
          .consultarStatus(pedido.cobranca_id_externo, apiKey, (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox")
          .catch(() => "pendente" as const);

        if (statusReal === "pago") {
          // Trava atômica — só processa se ainda estiver pendente.
          const { data: ganhouACorrida } = await admin
            .from("pedidos_produtos")
            .update({ status: "pago_aguardando_retirada" })
            .eq("id", id)
            .eq("status", "pendente")
            .select("id");

          if (ganhouACorrida && ganhouACorrida.length > 0) {
            // Desconta o estoque de forma atômica no banco. Se duas compras
            // chegarem juntas, apenas uma consegue reservar as unidades disponíveis.
            const { data: estoqueReservado, error: erroEstoque } = await admin.rpc(
              "decrementar_estoque_produto",
              { p_produto_id: pedido.produto_id, p_quantidade: pedido.quantidade }
            );

            if (erroEstoque || estoqueReservado !== true) {
              console.error("Pagamento confirmado, mas estoque insuficiente para o pedido:", pedido.id, erroEstoque);
              try {
                const { data: profissionalPagamento } = await admin
                  .from("profissionais")
                  .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
                  .eq("id", pedido.profissional_id)
                  .single();
                if (!profissionalPagamento?.gateway_pagamento || !profissionalPagamento.chave_api_pagamento_criptografada) {
                  throw new Error("Gateway do profissional indisponível para estorno");
                }
                const apiKey = descriptografar(profissionalPagamento.chave_api_pagamento_criptografada);
                await estornarCobranca(
                  pedido.cobranca_id_externo,
                  profissionalPagamento.gateway_pagamento as "asaas" | "mercadopago",
                  apiKey,
                  (profissionalPagamento.gateway_ambiente as "sandbox" | "production") ?? "sandbox"
                );
                await admin.from("pedidos_produtos").update({ status: "falhou" }).eq("id", id).eq("status", "pago_aguardando_retirada");
              } catch (erroEstorno) {
                console.error("Falha ao estornar pedido sem estoque:", pedido.id, erroEstorno);
              }
              return;
            }

            const { data: profissional } = await admin.from("profissionais").select("nome_negocio").eq("id", pedido.profissional_id).single();

            await enviarNotificacaoPushProfissional(pedido.profissional_id, {
              titulo: "Cha-ching! 🤑",
              corpo: `Vendeu ${pedido.quantidade}x ${pedido.produto_nome}! Bota na sacolinha, o dinheiro já é seu.`,
              url: "/painel/loja",
            }).catch((erro) => console.error("Falha ao notificar novo pedido de produto (profissional):", erro));

            await enviarNotificacaoPush(pedido.cliente_id, {
              titulo: "Seu produto está esperando! 📦",
              corpo: `${pedido.quantidade}x ${pedido.produto_nome} já foi pago — passe em ${profissional?.nome_negocio ?? "o estabelecimento"} pra retirar quando quiser.`,
              url: "/cliente/historico",
            }).catch((erro) => console.error("Falha ao notificar novo pedido de produto (cliente):", erro));
          }
        } else if (statusReal === "falhou") {
          await admin.from("pedidos_produtos").update({ status: "falhou" }).eq("id", id).eq("status", "pendente");
        }
      }
    }
  }

  const { data: pedidoAtual } = await admin.from("pedidos_produtos").select("status, expira_em").eq("id", id).single();
  if (!pedidoAtual) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  const expirado = pedidoAtual.status === "pendente" && new Date(pedidoAtual.expira_em).getTime() < Date.now();
  return NextResponse.json({ status: expirado ? "expirado" : pedidoAtual.status });
}
