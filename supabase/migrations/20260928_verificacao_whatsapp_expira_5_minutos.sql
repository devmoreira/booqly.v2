-- Verificações WhatsApp expiram em 5 minutos.
-- O backend/webhook já recusam e removem códigos vencidos.
-- Esta função permite limpeza física periódica dos registros que o usuário abandonou.
create or replace function public.limpar_verificacoes_whatsapp_expiradas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.verificacoes_whatsapp
  where criado_em < now() - interval '5 minutes'
    and verificado_em is null;
$$;

revoke all on function public.limpar_verificacoes_whatsapp_expiradas() from public, anon, authenticated;

-- Se pg_cron estiver habilitado no projeto Supabase, execute UMA VEZ manualmente:
-- select cron.schedule(
--   'limpar-verificacoes-whatsapp-expiradas',
--   '* * * * *',
--   $$select public.limpar_verificacoes_whatsapp_expiradas();$$
-- );
