-- Cadastro profissional: WhatsApp passa a ser a única confirmação.
-- Permite criar a verificação antes de existir um usuário em auth.users.
alter table public.verificacoes_whatsapp
  alter column user_id drop not null;

-- A FK existente permite NULL, portanto é mantida.
create index if not exists idx_verificacoes_whatsapp_telefone_criado
  on public.verificacoes_whatsapp (telefone, criado_em desc);
