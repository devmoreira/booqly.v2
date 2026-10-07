-- Telefone do colaborador usado para confirmação de saques via WhatsApp.
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS telefone text;

CREATE INDEX IF NOT EXISTS idx_colaboradores_telefone
  ON public.colaboradores (telefone)
  WHERE telefone IS NOT NULL;
