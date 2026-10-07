// Cria (ou reaproveita) a conta do cliente e a sessão de login — usado
// tanto depois da verificação por WhatsApp confirmar, quanto no modo
// de fallback (quando WHATSAPP_NUMERO_VERIFICACAO não está configurado,
// e o sistema volta a logar direto, sem verificação nenhuma).
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_SESSAO_CLIENTE } from "@/lib/session-cliente";

export async function criarSessaoCliente(telefone: string, nomeSeForNovo?: string | null): Promise<{ ok: true } | { ok: false; erro: string }> {
  const admin = createAdminClient();

  let clienteId: string;
  const { data: existente } = await admin.from("clientes").select("id").eq("telefone", telefone).maybeSingle();

  if (existente) {
    clienteId = existente.id;
  } else {
    const { data: novo, error } = await admin
      .from("clientes")
      .insert({ telefone, nome: nomeSeForNovo ?? "Cliente" })
      .select("id")
      .single();
    if (error || !novo) {
      console.error("Erro ao criar cliente:", error);
      return { ok: false, erro: "Não foi possível criar sua conta" };
    }
    clienteId = novo.id;
  }

  const expiraEm = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  const { data: sessao, error: erroSessao } = await admin
    .from("sessoes_clientes")
    .insert({ cliente_id: clienteId, expira_em: expiraEm })
    .select("token")
    .single();
  if (erroSessao || !sessao) {
    console.error("Erro ao criar sessão do cliente:", erroSessao);
    return { ok: false, erro: "Não foi possível entrar" };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO_CLIENTE, sessao.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 90 * 24 * 3600,
    path: "/",
  });

  return { ok: true };
}
