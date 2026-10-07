// Nome da plataforma — MUDE AQUI quando decidir o nome definitivo do
// projeto. Não é mais editável pelo admin (era um risco desnecessário
// de alguém mudar sem querer); só muda quando alguém edita esse arquivo
// e reimplanta o sistema.
export const NOME_PLATAFORMA = "Booqly";

export async function obterNomePlataforma(): Promise<string> {
  return NOME_PLATAFORMA;
}
