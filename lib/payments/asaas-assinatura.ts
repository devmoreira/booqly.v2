// Cobrança da ASSINATURA DA PLATAFORMA (você cobrando o profissional
// pelo uso do Booqly) — diferente da cobrança que o profissional faz
// no próprio cliente dele. Aqui não tem split: o dinheiro cai direto
// na sua conta Asaas.
import { createAdminClient } from "@/lib/supabase/admin";

async function pegarCredenciaisAsaas() {
  const db = createAdminClient();
  const { data } = await db
    .from("configuracoes_plataforma")
    .select("asaas_api_key, asaas_ambiente")
    .eq("id", 1)
    .single();
  if (!data?.asaas_api_key) throw new Error("Asaas não configurado. Cadastre a chave em /admin/pagamentos.");
  const baseUrl = data.asaas_ambiente === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  return { apiKey: data.asaas_api_key, baseUrl };
}

export async function garantirClienteAsaas(profissional: {
  id: string; nomeNegocio: string; email: string; asaasCustomerId: string | null; cpfCnpj: string;
}) {
  const { apiKey, baseUrl } = await pegarCredenciaisAsaas();

  if (profissional.asaasCustomerId) {
    // Cliente já existe no Asaas — mas pode ter sido criado ANTES da
    // gente coletar CPF/CNPJ (versão antiga do sistema). Garante que
    // ele está atualizado antes de reaproveitar, senão a cobrança falha.
    const respAtualizar = await fetch(`${baseUrl}/customers/${profissional.asaasCustomerId}`, {
      method: "POST", // o Asaas usa POST também pra atualizar um cliente existente
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({ cpfCnpj: profissional.cpfCnpj }),
    });
    if (respAtualizar.ok) return profissional.asaasCustomerId;
    // Se falhar (ex: cliente foi apagado do lado do Asaas), cai pro
    // fluxo de baixo e cria um cliente novo do zero.
  }

  const resp = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      name: profissional.nomeNegocio,
      email: profissional.email,
      cpfCnpj: profissional.cpfCnpj,
      externalReference: profissional.id,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível cadastrar no Asaas");

  const admin = createAdminClient();
  await admin.from("profissionais").update({ asaas_customer_id: data.id }).eq("id", profissional.id);
  return data.id as string;
}

const CICLO_POR_MESES: Record<number, string> = {
  1: "MONTHLY", 3: "QUARTERLY", 6: "SEMIANNUALLY", 12: "YEARLY",
};

export async function criarAssinaturaAsaas(input: {
  customerId: string;
  valorCentavos: number;
  duracaoMeses: number;
  externalReference: string; // "assinatura_{profissionalId}_{planoId}"
  descricao: string;
  nextDueDate?: string; // AAAA-MM-DD — padrão é amanhã, mas pode ser adiada (ex: upgrade de plano)
}) {
  const { apiKey, baseUrl } = await pegarCredenciaisAsaas();
  const resp = await fetch(`${baseUrl}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "UNDEFINED", // deixa o profissional escolher Pix/boleto/cartão na hora
      cycle: CICLO_POR_MESES[input.duracaoMeses] ?? "MONTHLY",
      value: input.valorCentavos / 100,
      description: input.descricao,
      externalReference: input.externalReference,
      nextDueDate: input.nextDueDate ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10), // amanhã, por padrão
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível criar a assinatura");

  // O Asaas gera automaticamente a 1ª cobrança da assinatura — buscamos
  // ela pra pegar o link de pagamento (checkout) e mandar o profissional pra lá.
  const respPagamentos = await fetch(`${baseUrl}/payments?subscription=${data.id}&limit=1`, {
    headers: { access_token: apiKey },
  });
  const pagamentos = await respPagamentos.json();
  const linkPagamento = pagamentos?.data?.[0]?.invoiceUrl as string | undefined;

  return { subscriptionId: data.id as string, linkPagamento };
}

// Cancela uma assinatura recorrente no Asaas — usado quando o
// profissional troca de plano no meio do ciclo, pra não continuar
// cobrando o valor do plano antigo pra sempre.
export async function cancelarAssinaturaAsaas(subscriptionId: string) {
  const { apiKey, baseUrl } = await pegarCredenciaisAsaas();
  const resp = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { access_token: apiKey },
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    // Se já tiver sido cancelada/apagada antes, não é um erro que
    // precise travar o fluxo de troca de plano.
    if (resp.status !== 404) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível cancelar a assinatura antiga");
  }
}

// Cobrança AVULSA (não recorrente) — usada pra cobrar só a diferença
// proporcional na hora de trocar de plano no meio do ciclo.
export async function criarCobrancaUnicaAsaas(input: {
  customerId: string;
  valorCentavos: number;
  externalReference: string;
  descricao: string;
}) {
  const { apiKey, baseUrl } = await pegarCredenciaisAsaas();
  const resp = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "UNDEFINED",
      value: input.valorCentavos / 100,
      description: input.descricao,
      externalReference: input.externalReference,
      dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível criar a cobrança");
  return { paymentId: data.id as string, linkPagamento: data.invoiceUrl as string | undefined };
}
