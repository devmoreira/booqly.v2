// Mercado Pago via Checkout Pro (hosted checkout).
// A API /v1/payments não funciona para um checkout web genérico sem
// tokenização/dados do cartão. O Checkout Pro cria a tela hospedada do
// Mercado Pago e permite oferecer Pix, crédito ou débito de acordo com
// a preferência criada.
import type { GatewayPagamento, CriarCobrancaInput, CriarCobrancaOutput } from "./types";

const MP_API = "https://api.mercadopago.com";

function tiposExcluidos(forma: CriarCobrancaInput["forma"]): string[] {
  if (forma === "pix") return ["credit_card", "debit_card", "prepaid_card", "ticket"];
  if (forma === "credito") return ["debit_card", "prepaid_card", "ticket", "bank_transfer"];
  return ["credit_card", "prepaid_card", "ticket", "bank_transfer"];
}

function referenciaDoCheckout(valor: string) {
  if (!valor.startsWith("mp_pref:")) return null;
  const partes = valor.split(":");
  return partes.length >= 3 ? partes.slice(2).join(":") : null;
}

export const mercadoPagoGateway: GatewayPagamento = {
  nome: "mercadopago",

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaOutput> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const body: Record<string, unknown> = {
      items: [
        {
          id: input.referenciaId,
          title: input.descricao,
          quantity: 1,
          currency_id: "BRL",
          unit_price: input.valorCentavos / 100,
        },
      ],
      payer: {
        name: input.clienteNome,
        email: input.clienteEmail,
        identification: input.clienteDocumento ? { type: input.clienteDocumento.length > 11 ? "CNPJ" : "CPF", number: input.clienteDocumento } : undefined,
      },
      external_reference: input.referenciaId,
      payment_methods: {
        excluded_payment_types: tiposExcluidos(input.forma).map((id) => ({ id })),
      },
    };

    if (siteUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteUrl)) {
      body.back_urls = {
        success: siteUrl,
        pending: siteUrl,
        failure: siteUrl,
      };
      body.auto_return = "approved";
    }

    const resp = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message ?? "Não foi possível criar o checkout no Mercado Pago");

    if (!data?.id || !data?.init_point) {
      throw new Error("O Mercado Pago não retornou um link de checkout válido");
    }

    // Guardamos a preferência + referência externa. Quando o cliente pagar,
    // consultamos /v1/payments/search pela referência para descobrir o ID real
    // do pagamento. Isso também permite estornar depois.
    return {
      cobrancaIdExterno: `mp_pref:${data.id}:${input.referenciaId}`,
      status: "pendente",
      linkPagamento: data.init_point,
    };
  },

  async consultarStatus(cobrancaIdExterno: string, apiKey: string) {
    const referencia = referenciaDoCheckout(cobrancaIdExterno);
    if (referencia) {
      const params = new URLSearchParams({
        external_reference: referencia,
        sort: "date_created",
        criteria: "desc",
        limit: "10",
      });
      const resp = await fetch(`${MP_API}/v1/payments/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return "pendente";
      const pagamentos = Array.isArray(data?.results) ? data.results : [];
      const aprovado = pagamentos.find((p: any) => p.status === "approved");
      if (aprovado) return "pago";
      const definitivo = pagamentos.find((p: any) => ["rejected", "cancelled", "refunded", "charged_back"].includes(p.status));
      if (definitivo) return "falhou";
      return "pendente";
    }

    const resp = await fetch(`${MP_API}/v1/payments/${cobrancaIdExterno}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return "pendente";
    if (data.status === "approved") return "pago";
    if (["rejected", "cancelled", "refunded", "charged_back"].includes(data.status)) return "falhou";
    return "pendente";
  },

  async validarChave(apiKey: string) {
    const resp = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return resp.ok;
  },
};
