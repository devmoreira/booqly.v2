// Roda antes de qualquer página carregar. A função principal aqui é
// manter a sessão do Supabase sempre atualizada — e, importante: se o
// navegador estiver com um "token de sessão" antigo que não existe mais
// (comum depois de apagar/recriar uma conta de teste), limpa ele
// sozinho em vez de deixar o erro estourar em toda página.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    await supabase.auth.getUser();
  } catch (erro: any) {
    console.error(`Middleware: getUser() falhou em ${request.nextUrl.pathname}:`, erro);
    // Só limpa a sessão se o erro for claramente de token inválido —
    // um erro passageiro (rede lenta, instabilidade momentânea) não
    // deveria derrubar uma sessão válida.
    const mensagem = String(erro?.message ?? erro).toLowerCase();
    const ehErroDeToken = mensagem.includes("refresh") || mensagem.includes("jwt") || mensagem.includes("token") || mensagem.includes("session");
    if (ehErroDeToken) {
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("sb-")) supabaseResponse.cookies.delete(cookie.name);
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
