-- Exclusão lógica/anônima de conta profissional. Mantém históricos financeiros
-- e operacionais vinculados para não quebrar auditoria, pagamentos e agendamentos.
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS conta_excluida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conta_excluida_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_profissionais_conta_excluida
  ON public.profissionais (conta_excluida);
