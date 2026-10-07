// Transferências Pix comuns — nada de Split ou subconta. Duas funções:
//
// 1. enviarPixDaPlataforma: usa a conta Asaas PRÓPRIA da plataforma
//    (Admin → Pagamentos), só pra cobrir o subsídio de cupom de cliente.
//    Nunca processa pagamento de terceiro — só manda um Pix normal,
//    como qualquer pessoa manda.
//
// 2. enviarPixComChaveDoProfissional: usa a chave do PRÓPRIO profissional
//    (já que o dinheiro do cliente caiu na conta dele) pra repassar a
//    fatia do colaborador — um Pix comum, de uma conta pra outra.
import { createAdminClient } from "@/lib/supabase/admin";

function baseUrlPara(ambiente: string) {
  return ambiente === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

async function enviarPix(apiKey: string, ambiente: string, pixChave: string, pixChaveTipo: string, valorCentavos: number, descricao: string) {
  if (valorCentavos <= 0) return;
  const BASE_URL = baseUrlPara(ambiente);
  const resp = await fetch(`${BASE_URL}/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      value: valorCentavos / 100,
      pixAddressKey: pixChave,
      pixAddressKeyType: pixChaveTipo,
      description: descricao,
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.errors?.[0]?.description ?? "Não foi possível fazer a transferência Pix");
  }
}

export async function enviarPixDaPlataforma(pixChave: string, pixChaveTipo: string, valorCentavos: number, descricao: string) {
  const admin = createAdminClient();
  const { data: config } = await admin.from("configuracoes_plataforma").select("asaas_api_key, asaas_ambiente").eq("id", 1).single();
  if (!config?.asaas_api_key) throw new Error("Conta Asaas da plataforma não configurada em Admin → Pagamentos");
  await enviarPix(config.asaas_api_key, config.asaas_ambiente ?? "sandbox", pixChave, pixChaveTipo, valorCentavos, descricao);
}

export async function enviarPixComChaveDoProfissional(
  apiKeyProfissional: string, ambiente: string,
  pixChave: string, pixChaveTipo: string, valorCentavos: number, descricao: string
) {
  await enviarPix(apiKeyProfissional, ambiente, pixChave, pixChaveTipo, valorCentavos, descricao);
}
