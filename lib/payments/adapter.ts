// Ponto único de entrada para pagamentos em todo o sistema.
// Lê a escolha do admin (tabela configuracoes_plataforma no Supabase)
// e devolve o gateway correspondente. É essa função que o resto do
// código chama — nunca o asaas.ts ou o mercadopago.ts diretamente.
import { asaasGateway } from "./asaas";
import { mercadoPagoGateway } from "./mercadopago";
import type { GatewayPagamento } from "./types";

export function getGatewayAtivo(nomeConfigurado: "asaas" | "mercadopago"): GatewayPagamento {
  switch (nomeConfigurado) {
    case "mercadopago":
      return mercadoPagoGateway;
    case "asaas":
    default:
      return asaasGateway;
  }
}
