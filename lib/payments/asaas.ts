// Implementação do gateway usando a API do Asaas.
// Documentação oficial: https://docs.asaas.com
//
// Desde o novo modelo, usa SEMPRE a chave do PRÓPRIO profissional
// (input.apiKey) — nunca uma chave nossa. O dinheiro cai direto na
// conta dele, a gente só intermedia a chamada técnica.
import type { GatewayPagamento, CriarCobrancaInput, CriarCobrancaOutput } from "./types";

function baseUrlPara(_ambiente: string) {
  return "https://api.asaas.com/v3";
}

export const asaasGateway: GatewayPagamento = {
  nome: "asaas",

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaOutput> {
    const BASE_URL = baseUrlPara(input.ambiente);

    // O cliente que paga também precisa existir como "customer" no Asaas
    const respCustomer = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: input.apiKey },
      body: JSON.stringify({ name: input.clienteNome, email: input.clienteEmail, cpfCnpj: input.clienteDocumento }),
    });
    const customer = await respCustomer.json();
    if (!respCustomer.ok) throw new Error(customer?.errors?.[0]?.description ?? "Não foi possível registrar o cliente no Asaas");

    // A data de vencimento importa de verdade pro cartão: o Asaas só
    // libera antecipação de uma cobrança que ainda tenha pelo menos 8
    // dias úteis até essa data — se deixar sempre "hoje", nenhuma
    // cobrança de cartão nunca conseguiria ser antecipada.
    const dataVencimento = new Date();
    if (input.forma !== "pix") dataVencimento.setDate(dataVencimento.getDate() + 15);

    const corpo: Record<string, unknown> = {
      customer: customer.id,
      billingType: input.forma === "pix" ? "PIX" : input.forma === "debito" ? "DEBIT_CARD" : "CREDIT_CARD",
      value: input.valorCentavos / 100,
      description: input.descricao,
      externalReference: input.referenciaId,
      dueDate: dataVencimento.toISOString().slice(0, 10),
    };

    const resp = await fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: input.apiKey },
      body: JSON.stringify(corpo),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível criar a cobrança");

    const resultado: CriarCobrancaOutput = {
      cobrancaIdExterno: data.id,
      status: data.status === "CONFIRMED" || data.status === "RECEIVED" ? "pago" : "pendente",
      linkPagamento: data.invoiceUrl,
    };

    if (input.forma === "pix") {
      const respPix = await fetch(`${BASE_URL}/payments/${data.id}/pixQrCode`, {
        headers: { access_token: input.apiKey },
      });
      const pix = await respPix.json();
      if (respPix.ok) {
        resultado.qrCodePix = pix.payload; // "copia e cola"
        resultado.qrCodeImagemBase64 = pix.encodedImage; // imagem pronta (base64 PNG)
      }
    }

    return resultado;
  },

  async consultarStatus(cobrancaIdExterno: string, apiKey: string, ambiente: "sandbox" | "production") {
    const BASE_URL = baseUrlPara(ambiente);
    const resp = await fetch(`${BASE_URL}/payments/${cobrancaIdExterno}`, { headers: { access_token: apiKey } });
    const data = await resp.json();
    if (data.status === "CONFIRMED" || data.status === "RECEIVED") return "pago";
    if (data.status === "OVERDUE" || data.status === "REFUNDED") return "falhou";
    return "pendente";
  },

  async validarChave(apiKey: string, ambiente: "sandbox" | "production") {
    const BASE_URL = baseUrlPara(ambiente);
    // Lista 1 cliente só pra confirmar que a chave é válida — não cria
    // nem altera nada, é só uma leitura simples.
    const resp = await fetch(`${BASE_URL}/customers?limit=1`, { headers: { access_token: apiKey } });
    return resp.ok;
  },
};
