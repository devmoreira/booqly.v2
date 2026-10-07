// Sistema unificado de saque de saldo de indicação — vale pra
// profissional, cliente e colaborador. O usuário pede o saque (com a
// própria chave Pix), e um cron paga automaticamente depois do prazo
// definido pelo admin (nunca na hora, sempre com essa janela de
// segurança). Ver /api/cron/processar-saques.
import { createAdminClient } from "@/lib/supabase/admin";

type TipoIndicacao = "profissional" | "cliente" | "colaborador";

const TABELA_POR_TIPO: Record<TipoIndicacao, string> = {
  profissional: "comissoes_indicacao_profissional",
  cliente: "comissoes_indicacao_cliente",
  colaborador: "comissoes_indicacao_colaborador",
};

const COLUNA_INDICADOR_POR_TIPO: Record<TipoIndicacao, string> = {
  profissional: "profissional_indicador_id",
  cliente: "cliente_indicador_id",
  colaborador: "colaborador_indicador_id",
};

export async function saldoDisponivel(tipo: TipoIndicacao, beneficiarioId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from(TABELA_POR_TIPO[tipo])
    .select("valor_centavos")
    .eq(COLUNA_INDICADOR_POR_TIPO[tipo], beneficiarioId)
    .eq("status", "pendente");
  return (data ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
}

export async function solicitarSaque(
  tipo: TipoIndicacao,
  beneficiarioId: string,
  pixChave: string,
  pixChaveTipo: string
): Promise<{ ok: true; valorCentavos: number } | { ok: false; erro: string }> {
  const admin = createAdminClient();
  const tabela = TABELA_POR_TIPO[tipo];
  const colunaIndicador = COLUNA_INDICADOR_POR_TIPO[tipo];

  const { data: pendentes } = await admin
    .from(tabela)
    .select("id, valor_centavos")
    .eq(colunaIndicador, beneficiarioId)
    .eq("status", "pendente");

  const idsCandidatos = (pendentes ?? []).map((c) => c.id);
  if (idsCandidatos.length === 0) return { ok: false, erro: "Você não tem saldo disponível pra sacar." };

  // Trava atômica: só marca como "solicitado" quem AINDA estiver
  // "pendente" nesse exato instante — se duas solicitações chegarem
  // juntas (dois cliques, ou alguém tentando abusar disso), a segunda
  // não consegue reservar as mesmas comissões que a primeira já pegou.
  const { data: reservadas, error: erroReserva } = await admin
    .from(tabela)
    .update({ status: "solicitado" })
    .in("id", idsCandidatos)
    .eq("status", "pendente")
    .select("id, valor_centavos");

  if (erroReserva) return { ok: false, erro: "Não foi possível processar o pedido de saque." };

  const valorCentavos = (reservadas ?? []).reduce((soma, c) => soma + c.valor_centavos, 0);
  if (valorCentavos <= 0) return { ok: false, erro: "Você não tem saldo disponível pra sacar." };

  const { data: solicitacao, error: erroSolicitacao } = await admin
    .from("solicitacoes_saque")
    .insert({ tipo, beneficiario_id: beneficiarioId, valor_centavos: valorCentavos, pix_chave: pixChave, pix_chave_tipo: pixChaveTipo })
    .select("id")
    .single();

  if (erroSolicitacao || !solicitacao) {
    // Não conseguiu registrar o pedido — devolve as comissões pro
    // estado "pendente" de novo, pra não ficarem presas sem saque nenhum.
    await admin.from(tabela).update({ status: "pendente" }).in("id", (reservadas ?? []).map((c) => c.id));
    return { ok: false, erro: "Não foi possível registrar o pedido de saque." };
  }

  await admin.from(tabela).update({ solicitacao_saque_id: solicitacao.id }).in("id", (reservadas ?? []).map((c) => c.id));

  return { ok: true, valorCentavos };
}
