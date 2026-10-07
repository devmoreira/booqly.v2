// ATENÇÃO: este arquivo só pode ser importado dentro de código que roda
// no servidor (Route Handlers em app/api/.../route.ts). A "service role
// key" ignora todas as regras de segurança (RLS) do banco — se ela
// vazar pro navegador, qualquer pessoa consegue ler/apagar tudo.
//
// Por isso ela usa a variável SUPABASE_SERVICE_ROLE_KEY (sem o prefixo
// NEXT_PUBLIC_) — no Next.js, só variáveis com NEXT_PUBLIC_ na frente
// chegam ao navegador. Sem esse prefixo, ela nunca sai do servidor.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
