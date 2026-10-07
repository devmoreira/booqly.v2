// Paga o repasse do colaborador E o subsídio de cupom de cliente — os
// dois SÓ quando o agendamento é marcado como concluído de verdade,
// nunca antes. Isso fecha duas brechas parecidas: um profissional (ou
// cliente) combinar um cancelamento depois de já ter recebido dinheiro
// que não deveria mais existir, seja repasse ou subsídio. Como cancelar
// não é mais possível depois de concluído, e concluído só pode ser
// marcado depois do horário passar, o dinheiro só sai quando o
// atendimento realmente aconteceu.
import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/crypto";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { enviarPixDaPlataforma, enviarPixComChaveDoProfissional } from "@/lib/payments/pix";

export async function processarPagamentosNaConclusao(
  admin: ReturnType<typeof createAdminClient>,
  agendamentoId: string
) {
  const nomePlataforma = await obterNomePlataforma();
  const { data: checkout } = await admin
    .from("checkouts_pendentes")
    .select("id, cupom_id, desconto_centavos, desconto_saldo_centavos, valor_centavos, profissional_id, colaborador_valor_centavos")
    .eq("agendamento_id", agendamentoId)
    .maybeSingle();

  if (!checkout) return; // não foi pago online — nada a fazer aqui

  const { data: cobranca } = await admin
    .from("cobrancas")
    .select("id, subsidio_cupom_status, repasse_colaborador_status")
    .eq("agendamento_id", agendamentoId)
    .maybeSingle();

  const { data: agendamento } = await admin.from("agendamentos").select("colaborador_id").eq("id", agendamentoId).single();

  const { data: profissional } = await admin
    .from("profissionais")
    .select("gateway_pagamento, gateway_ambiente, chave_api_pagamento_criptografada, pix_chave, pix_chave_tipo")
    .eq("id", checkout.profissional_id)
    .single();

  const valorColaborador = checkout.colaborador_valor_centavos ?? 0;
  const jaTemCupom = !!checkout.cupom_id && (checkout.desconto_centavos ?? 0) > 0;
  const cupomEhDaPlataforma = jaTemCupom
    ? !(await admin.from("cupons").select("profissional_id").eq("id", checkout.cupom_id).single()).data?.profissional_id
    : false;

  // Repasse pro colaborador — Pix comum, saindo da conta do PRÓPRIO
  // profissional, já que o dinheiro do cliente caiu lá.
  if (valorColaborador > 0 && cobranca?.repasse_colaborador_status !== "pago" && agendamento?.colaborador_id) {
    if (!profissional?.chave_api_pagamento_criptografada || !profissional.gateway_pagamento) {
      console.error("Não foi possível repassar: profissional sem gateway configurado", checkout.profissional_id);
    } else {
      try {
        const { data: colaborador } = await admin.from("colaboradores").select("pix_chave, pix_chave_tipo").eq("id", agendamento.colaborador_id).maybeSingle();
        if (colaborador?.pix_chave && colaborador.pix_chave_tipo) {
          const apiKey = descriptografar(profissional.chave_api_pagamento_criptografada);
          const ambiente = (profissional.gateway_ambiente as "sandbox" | "production") ?? "sandbox";
          await enviarPixComChaveDoProfissional(apiKey, ambiente, colaborador.pix_chave, colaborador.pix_chave_tipo, valorColaborador, `${nomePlataforma} — repasse de atendimento`);
          if (cobranca) await admin.from("cobrancas").update({ repasse_colaborador_status: "pago" }).eq("id", cobranca.id);
        }
      } catch (erro) {
        console.error("Falha ao repassar pro colaborador na conclusão:", erro);
        if (cobranca) await admin.from("cobrancas").update({ repasse_colaborador_status: "falhou" }).eq("id", cobranca.id);
      }
    }
  }

  // Subsídio de cupom — a plataforma cobre o desconto com Pix próprio.
  if (jaTemCupom && cupomEhDaPlataforma && cobranca?.subsidio_cupom_status !== "pago") {
    const subsidioColaborador = valorColaborador > 0
      ? Math.round(checkout.desconto_centavos * (valorColaborador / checkout.valor_centavos))
      : 0;
    const subsidioProfissional = checkout.desconto_centavos - subsidioColaborador;

    try {
      if (profissional?.pix_chave && profissional.pix_chave_tipo && subsidioProfissional > 0) {
        await enviarPixDaPlataforma(profissional.pix_chave, profissional.pix_chave_tipo, subsidioProfissional, `${nomePlataforma} — subsídio de cupom`);
      }
      if (subsidioColaborador > 0 && agendamento?.colaborador_id) {
        const { data: colaborador } = await admin.from("colaboradores").select("pix_chave, pix_chave_tipo").eq("id", agendamento.colaborador_id).maybeSingle();
        if (colaborador?.pix_chave && colaborador.pix_chave_tipo) {
          await enviarPixDaPlataforma(colaborador.pix_chave, colaborador.pix_chave_tipo, subsidioColaborador, `${nomePlataforma} — subsídio de cupom`);
        }
      }
      if (cobranca) await admin.from("cobrancas").update({ subsidio_cupom_centavos: checkout.desconto_centavos, subsidio_cupom_status: "pago" }).eq("id", cobranca.id);
    } catch (erro) {
      console.error("Falha ao pagar subsídio de cupom na conclusão:", erro);
      if (cobranca) await admin.from("cobrancas").update({ subsidio_cupom_centavos: checkout.desconto_centavos, subsidio_cupom_status: "falhou" }).eq("id", cobranca.id);
    }
  }

  // Subsídio de saldo de indique-e-ganhe do cliente — sempre bancado
  // pela plataforma (o dinheiro do saldo nunca é do profissional).
  const descontoSaldo = checkout.desconto_saldo_centavos ?? 0;
  if (descontoSaldo > 0) {
    const subsidioSaldoColaborador = valorColaborador > 0
      ? Math.round(descontoSaldo * (valorColaborador / checkout.valor_centavos))
      : 0;
    const subsidioSaldoProfissional = descontoSaldo - subsidioSaldoColaborador;

    try {
      if (profissional?.pix_chave && profissional.pix_chave_tipo && subsidioSaldoProfissional > 0) {
        await enviarPixDaPlataforma(profissional.pix_chave, profissional.pix_chave_tipo, subsidioSaldoProfissional, `${nomePlataforma} — subsídio de saldo de indicação`);
      }
      if (subsidioSaldoColaborador > 0 && agendamento?.colaborador_id) {
        const { data: colaborador } = await admin.from("colaboradores").select("pix_chave, pix_chave_tipo").eq("id", agendamento.colaborador_id).maybeSingle();
        if (colaborador?.pix_chave && colaborador.pix_chave_tipo) {
          await enviarPixDaPlataforma(colaborador.pix_chave, colaborador.pix_chave_tipo, subsidioSaldoColaborador, `${nomePlataforma} — subsídio de saldo de indicação`);
        }
      }
    } catch (erro) {
      console.error("Falha ao pagar subsídio de saldo de indicação na conclusão:", erro);
    }
  }
}
