// Confere se um gateway de pagamento está ligado globalmente (admin
// pode desligar Asaas ou Mercado Pago em Funcionalidades). Usado antes
// de criar qualquer cobrança nova.
import { createAdminClient } from "@/lib/supabase/admin";

export async function gatewayEstaAtivo(gateway: "asaas" | "mercadopago"): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("configuracoes_plataforma")
    .select("gateway_asaas_ativo, gateway_mercadopago_ativo")
    .eq("id", 1)
    .single();
  if (!data) return true; // nunca bloqueia por falha de leitura
  return gateway === "asaas" ? data.gateway_asaas_ativo !== false : data.gateway_mercadopago_ativo !== false;
}
