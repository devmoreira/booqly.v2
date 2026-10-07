import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacaoPushProfissional } from "@/lib/push";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db
    .from("configuracoes_plataforma")
    .select("funcionalidade_cupons_ativa, funcionalidade_teste_gratis_ativa, funcionalidade_busca_cliente_ativa, gateway_asaas_ativo, gateway_mercadopago_ativo, comunidade_minimo_assinantes")
    .eq("id", 1)
    .single();

  return NextResponse.json(data ?? {});
}

const schema = z.object({
  cuponsAtiva: z.boolean().optional(),
  testeGratisAtiva: z.boolean().optional(),
  buscaClienteAtiva: z.boolean().optional(),
  gatewayAsaasAtivo: z.boolean().optional(),
  gatewayMercadopagoAtivo: z.boolean().optional(),
  comunidadeMinimoAssinantes: z.number().int().min(1).max(100000).optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const dados: Record<string, unknown> = {};
  if (validado.data.cuponsAtiva !== undefined) dados.funcionalidade_cupons_ativa = validado.data.cuponsAtiva;
  if (validado.data.testeGratisAtiva !== undefined) dados.funcionalidade_teste_gratis_ativa = validado.data.testeGratisAtiva;
  if (validado.data.buscaClienteAtiva !== undefined) dados.funcionalidade_busca_cliente_ativa = validado.data.buscaClienteAtiva;
  if (validado.data.gatewayAsaasAtivo !== undefined) dados.gateway_asaas_ativo = validado.data.gatewayAsaasAtivo;
  if (validado.data.gatewayMercadopagoAtivo !== undefined) dados.gateway_mercadopago_ativo = validado.data.gatewayMercadopagoAtivo;
  if (validado.data.comunidadeMinimoAssinantes !== undefined) dados.comunidade_minimo_assinantes = validado.data.comunidadeMinimoAssinantes;

  // Se algum gateway está sendo DESLIGADO agora, avisa por push todo
  // profissional que está conectado com ele — o pagamento deles para
  // de funcionar imediatamente, então precisam saber pra trocar.
  for (const [campo, nomeGateway, chaveBanco] of [
    ["gatewayAsaasAtivo", "Asaas", "asaas"],
    ["gatewayMercadopagoAtivo", "Mercado Pago", "mercadopago"],
  ] as const) {
    if (validado.data[campo] === false) {
      const { data: afetados } = await db.from("profissionais").select("id").eq("gateway_pagamento", chaveBanco);
      for (const p of afetados ?? []) {
        await enviarNotificacaoPushProfissional(p.id, {
          titulo: "Pagamento por " + nomeGateway + " foi desativado ⚠️",
          corpo: "A plataforma desligou temporariamente esse gateway. Conecte outro em Receber pra continuar recebendo.",
          url: "/painel/receber",
        }).catch((erro) => console.error(`Falha ao avisar profissional ${p.id} sobre ${nomeGateway} desativado:`, erro));
      }
    }
  }

  const { error } = await db.from("configuracoes_plataforma").update(dados).eq("id", 1);
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
