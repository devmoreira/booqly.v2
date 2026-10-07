// Estorna uma cobrança (Pix ou cartão) — sempre usando a chave do
// PRÓPRIO profissional, já que é na conta dele que o dinheiro caiu.
// No cartão, o dinheiro volta pro cliente em até 10 dias úteis; no
// Pix, cai na hora.
export async function estornarCobranca(
  cobrancaIdExterno: string,
  gateway: "asaas" | "mercadopago",
  apiKey: string,
  ambiente: "sandbox" | "production"
) {
  if (gateway === "mercadopago") {
    let paymentId = cobrancaIdExterno;
    if (cobrancaIdExterno.startsWith("mp_pref:")) {
      const partes = cobrancaIdExterno.split(":");
      const externalReference = partes.slice(2).join(":");
      const busca = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=10`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const pagamentos = await busca.json().catch(() => ({}));
      const aprovado = (pagamentos?.results ?? []).find((p: { id?: number | string; status?: string }) => p.status === "approved");
      if (!aprovado?.id) throw new Error("Pagamento do Mercado Pago ainda não encontrado para estorno");
      paymentId = String(aprovado.id);
    }

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message ?? "Não foi possível estornar essa cobrança no Mercado Pago");
    return data;
  }

  const baseUrl = ambiente === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const resp = await fetch(`${baseUrl}/payments/${cobrancaIdExterno}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({}), // sem "value" = estorna o valor integral
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description ?? "Não foi possível estornar essa cobrança");
  return data;
}
