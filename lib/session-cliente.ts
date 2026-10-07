// Sessão de login do cliente — bem mais simples que a do profissional:
// sem senha, só telefone. O "token" da sessão fica num cookie httpOnly
// (o navegador não consegue ler via JavaScript, só o servidor).
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const COOKIE_SESSAO_CLIENTE = "agendify_cliente_sessao";

export async function getClienteLogado() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO_CLIENTE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data: sessao } = await admin
    .from("sessoes_clientes")
    .select("cliente_id, expira_em")
    .eq("token", token)
    .maybeSingle();

  if (!sessao || new Date(sessao.expira_em).getTime() < Date.now()) return null;

  const { data: cliente } = await admin
    .from("clientes")
    .select("id, nome, telefone")
    .eq("id", sessao.cliente_id)
    .single();

  return cliente ?? null;
}
