-- Vincula a verificação de WhatsApp do cadastro ao usuário do Supabase Auth.
-- Isso impede que um código válido de um telefone seja usado para criar
-- o perfil de outro usuário.
alter table verificacoes_whatsapp
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_verificacoes_whatsapp_user_telefone
  on verificacoes_whatsapp (user_id, telefone, criado_em desc);
