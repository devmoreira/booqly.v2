// GET/POST /api/painel/gateway-pagamento
// O profissional cola aqui a chave de API da própria conta Asaas ou
// Mercado Pago. A gente confere se ela é válida de verdade antes de
// guardar (nunca salva uma chave sem testar), e guarda criptografada.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criptografar } from "@/lib/crypto";
import { getGatewayAtivo } from "@/lib/payments/adapter";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data: perfil, error } = await supabase
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, gateway_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar configuração de gateway:", error);
    return NextResponse.json({ erro: "Não foi possível carregar — confira se as colunas de gateway existem no banco." }, { status: 500 });
  }

  return NextResponse.json({
    gateway: perfil?.gateway_pagamento ?? null,
    ambiente: "production",
    status: perfil?.gateway_status ?? "nao_configurado",
  });
}

const schema = z.object({
  gateway: z.enum(["asaas", "mercadopago"]),
  apiKey: z.string().min(10),
  ambiente: z.literal("production"),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const gateway = getGatewayAtivo(validado.data.gateway);
  const chaveValida = await gateway.validarChave(validado.data.apiKey, validado.data.ambiente).catch(() => false);

  if (!chaveValida) {
    const admin = createAdminClient();
    await admin.from("profissionais").update({ gateway_status: "invalido" }).eq("id", user.id);
    return NextResponse.json({ erro: "Essa chave não parece válida para o ambiente de produção. Confira se copiou corretamente a chave de produção." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profissionais").update({
    gateway_pagamento: validado.data.gateway,
    gateway_ambiente: "production",
    chave_api_pagamento_criptografada: criptografar(validado.data.apiKey),
    gateway_status: "valido",
  }).eq("id", user.id);

  if (error) return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
