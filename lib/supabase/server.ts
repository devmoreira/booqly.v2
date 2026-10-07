// Cliente Supabase usado no servidor (Server Components, Route Handlers).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// "sessaoTemporaria: true" é usado quando a pessoa NÃO marca "Manter
// conexão" no login — o cookie vira um cookie de sessão (sem maxAge/
// expires), que o próprio navegador apaga quando fecha, em vez de
// durar dias.
export async function createClient(sessaoTemporaria = false) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const opcoesFinais = sessaoTemporaria
                ? { ...options, maxAge: undefined, expires: undefined }
                : options;
              cookieStore.set(name, value, opcoesFinais);
            });
          } catch {
            // chamado de um Server Component sem permissão de escrita — ok ignorar
          }
        },
      },
    }
  );
}
