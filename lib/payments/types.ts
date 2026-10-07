// Contrato único que QUALQUER gateway de pagamento precisa seguir.
// O resto do sistema (agenda, painel, indicações) só conversa com essa
// interface — nunca direto com o Asaas ou o Mercado Pago. Por isso,
// trocar de gateway no futuro é só trocar o arquivo por trás, sem
// mexer nas telas nem nas regras de negócio.
//
// IMPORTANTE: desde a mudança pro modelo "traga sua própria chave",
// toda cobrança usa a CONTA E CHAVE DO PRÓPRIO PROFISSIONAL — o
// dinheiro do cliente cai direto na conta dele, nunca na nossa.

export type MetodoCobranca = "taxa_agendamento" | "pagamento_total" | "pos_servico";
export type FormaPagamento = "pix" | "credito" | "debito";

export interface CriarCobrancaInput {
  referenciaId: string; // id do agendamento OU do pedido de produto — só vira "externalReference" na cobrança
  profissionalId: string;
  valorCentavos: number;
  forma: FormaPagamento;
  descricao: string;
  clienteNome: string;
  clienteEmail: string;
  clienteDocumento?: string; // CPF, exigido por alguns gateways para Pix/cartão
  apiKey: string; // chave do PRÓPRIO profissional — nunca a nossa
  ambiente: "sandbox" | "production";
}

export interface CriarCobrancaOutput {
  cobrancaIdExterno: string; // id da cobrança no gateway (Asaas/Mercado Pago)
  status: "pendente" | "pago" | "falhou";
  linkPagamento?: string; // checkout hospedado, quando o gateway usa esse modelo
  qrCodePix?: string; // copia-e-cola do Pix, quando aplicável
  qrCodeImagemBase64?: string; // imagem do QR code do Pix, pronta pra mostrar na tela
}

export interface GatewayPagamento {
  nome: "asaas" | "mercadopago";
  criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaOutput>;
  consultarStatus(cobrancaIdExterno: string, apiKey: string, ambiente: "sandbox" | "production"): Promise<"pendente" | "pago" | "falhou">;
  // Confere se uma chave de API é válida de verdade, sem precisar criar
  // cobrança nenhuma — usado na hora que o profissional cola a chave dele.
  validarChave(apiKey: string, ambiente: "sandbox" | "production"): Promise<boolean>;
}
