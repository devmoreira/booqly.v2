// POST /api/pedidos-produtos — cliente logado compra um produto.
// Mesmo modelo do agendamento: só reservamos o pedido (status
// "pendente") e geramos a cobrança; o pedido só vira "pago aguardando
// retirada" quando o gateway confirmar (ver /api/pedido-produto-status).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClienteLogado } from "@/lib/session-cliente";
import { getGatewayAtivo } from "@/lib/payments/adapter";
import { descriptografar } from "@/lib/crypto";
import { gatewayEstaAtivo } from "@/lib/gateway-disponibilidade";
import { temAcessoPremium } from "@/lib/assinatura";

const MINUTOS_EXPIRACAO = 20;

const schema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().int().min(1).max(20),
  formaPagamento: z.enum(["pix", "credito", "debito"]),
  documento: z.string().min(11).max(18),
});

export async function POST(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "Faça login pra comprar." }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();
  const { data: produto } = await admin.from("produtos").select("id, nome, preco_centavos, estoque, ativo, profissional_id").eq("id", validado.data.produtoId).maybeSingle();
  if (!produto || !produto.ativo) return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 });
  if (!(await temAcessoPremium(produto.profissional_id))) {
    return NextResponse.json({ erro: "A loja desse estabelecimento está indisponível no momento." }, { status: 403 });
  }
  if (produto.estoque < validado.data.quantidade) return NextResponse.json({ erro: "Não temos essa quantidade em estoque." }, { status: 400 });

  const { data: profissional } = await admin
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
    .eq("id", produto.profissional_id)
    .single();
  if (!profissional?.chave_api_pagamento_criptografada || !profissional.gateway_pagamento) {
    return NextResponse.json({ erro: "Esse estabelecimento ainda não configurou pagamento." }, { status: 400 });
  }

  const documentoLimpo = validado.data.documento.replace(/\D/g, "");
  const valorTotalCentavos = produto.preco_centavos * validado.data.quantidade;
  const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO * 60_000);

  const { data: pedido, error: erroPedido } = await admin.from("pedidos_produtos").insert({
    profissional_id: produto.profissional_id,
    cliente_id: cliente.id,
    produto_id: produto.id,
    produto_nome: produto.nome,
    quantidade: validado.data.quantidade,
    valor_unitario_centavos: produto.preco_centavos,
    valor_total_centavos: valorTotalCentavos,
    forma_pagamento: validado.data.formaPagamento,
    expira_em: expiraEm.toISOString(),
  }).select("id").single();

  if (erroPedido || !pedido) {
    return NextResponse.json({ erro: "Não foi possível criar o pedido." }, { status: 500 });
  }

  try {
    const apiKeyProfissional = descriptografar(profissional.chave_api_pagamento_criptografada);
    if (!(await gatewayEstaAtivo(profissional.gateway_pagamento as "asaas" | "mercadopago"))) {
      throw new Error("Esse estabelecimento está com o pagamento temporariamente indisponível. Tente de novo mais tarde.");
    }
    const gateway = getGatewayAtivo(profissional.gateway_pagamento as "asaas" | "mercadopago");
    const cobranca = await gateway.criarCobranca({
      referenciaId: `pedido_produto_${pedido.id}`,
      profissionalId: produto.profissional_id,
      valorCentavos: valorTotalCentavos,
      forma: validado.data.formaPagamento,
      descricao: `${validado.data.quantidade}x ${produto.nome}`,
      clienteNome: cliente.nome,
      clienteEmail: `${cliente.id}@sem-email.booqly.internal`,
      clienteDocumento: documentoLimpo,
      apiKey: apiKeyProfissional,
      ambiente: (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox",
    });

    await admin.from("pedidos_produtos").update({ cobranca_id_externo: cobranca.cobrancaIdExterno }).eq("id", pedido.id);

    return NextResponse.json({
      pedidoId: pedido.id,
      expiraEm: expiraEm.toISOString(),
      pagamento: {
        qrCodePix: cobranca.qrCodePix,
        qrCodeImagemBase64: cobranca.qrCodeImagemBase64,
        linkPagamento: cobranca.linkPagamento,
      },
    }, { status: 201 });
  } catch (erro: any) {
    console.error("Erro ao criar cobrança de produto:", erro);
    await admin.from("pedidos_produtos").update({ status: "falhou" }).eq("id", pedido.id);
    return NextResponse.json({ erro: erro?.message ?? "Não foi possível gerar o pagamento." }, { status: 400 });
  }
}
