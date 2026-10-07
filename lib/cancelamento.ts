// Ao cancelar um agendamento que já foi pago: estorna a cobrança pro
// cliente. Como o dinheiro caiu direto na conta do PRÓPRIO profissional
// (modelo "traga sua própria chave"), o estorno precisa usar a chave
// dele, não a nossa — buscamos e descriptografamos ela aqui.
//
// Não existe mais lógica de "recuperar subsídio de cupom" nem "recuperar
// repasse de colaborador" aqui — desde que os dois passaram a ser pagos
// só na CONCLUSÃO do agendamento (ver lib/pagamentos-na-conclusao.ts), e
// cancelamento não é mais possível depois de concluído, não existe
// cenário onde esse dinheiro já foi pago e o agendamento ainda pode ser
// cancelado.
import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/crypto";
import { estornarCobranca } from "@/lib/payments/estorno";

export async function processarCancelamentoComEstorno(
  admin: ReturnType<typeof createAdminClient>,
  agendamentoId: string
) {
  const { data: cobrancas } = await admin
    .from("cobrancas")
    .select("id, cobranca_id_externo, status")
    .eq("agendamento_id", agendamentoId)
    .eq("status", "pago");

  if (!cobrancas || cobrancas.length === 0) return;

  const { data: agendamento } = await admin.from("agendamentos").select("profissional_id").eq("id", agendamentoId).single();
  if (!agendamento) return;

  const { data: profissional } = await admin
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada")
    .eq("id", agendamento.profissional_id)
    .single();

  if (!profissional?.chave_api_pagamento_criptografada || !profissional.gateway_pagamento) {
    console.error("Não foi possível estornar: profissional sem gateway de pagamento configurado", agendamento.profissional_id);
    return;
  }

  const apiKey = descriptografar(profissional.chave_api_pagamento_criptografada);
  const ambiente = (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox";

  for (const cobranca of cobrancas) {
    try {
      await estornarCobranca(
        cobranca.cobranca_id_externo,
        profissional.gateway_pagamento as "asaas" | "mercadopago",
        apiKey,
        ambiente
      );
      await admin.from("cobrancas").update({ status: "estornado", repasse_status: "cancelado" }).eq("id", cobranca.id);
    } catch (erro) {
      console.error("Falha ao estornar cobrança no cancelamento:", erro);
    }
  }
}
