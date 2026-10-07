-- Corrige concorrência de estoque nas compras de produtos.
-- A operação é atômica: só decrementa se houver quantidade suficiente.
create or replace function public.decrementar_estoque_produto(p_produto_id uuid, p_quantidade int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  atualizado boolean;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    return false;
  end if;

  update public.produtos
     set estoque = estoque - p_quantidade
   where id = p_produto_id
     and ativo = true
     and estoque >= p_quantidade;

  atualizado := found;
  return atualizado;
end;
$$;

revoke all on function public.decrementar_estoque_produto(uuid, int) from public;
grant execute on function public.decrementar_estoque_produto(uuid, int) to service_role;
