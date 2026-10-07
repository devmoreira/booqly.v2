import Link from "next/link";
import { redirect } from "next/navigation";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { SairClienteButton } from "@/components/SairClienteButton";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const cliente = await getClienteLogado();
  if (!cliente) redirect("/login?next=%2Fcliente%2Fbuscar");

  const admin = createAdminClient();
  const { data: funcionalidades } = await admin
    .from("configuracoes_plataforma")
    .select("funcionalidade_busca_cliente_ativa")
    .eq("id", 1)
    .single();
  const buscaAtiva = funcionalidades?.funcionalidade_busca_cliente_ativa ?? true;

  return (
    <div className="booqly-client min-h-screen bg-paper">
      <header className="booqly-client-header sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
        <div className="booqly-client-header-inner mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/cliente" aria-label="Booqly"><img src="/booqly-logo.png" alt="Booqly" className="h-8 w-auto" /></Link>
          <nav className="booqly-client-nav flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-4">
        <Link href="/cliente" className="text-ink/70 hover:text-ink">Início</Link>
        {buscaAtiva && (
          <Link href="/cliente/buscar" className="text-ink/70 hover:text-ink">Buscar</Link>
        )}
        <Link href="/cliente/historico" className="text-ink/70 hover:text-ink">Histórico</Link>
        <Link href="/cliente/saldo" className="text-ink/70 hover:text-ink">Indique e ganhe</Link>
        <SairClienteButton />
          </nav>
        </div>
      </header>
      <main className="booqly-client-main mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
