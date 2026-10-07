import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { MenuMobileAdmin } from "@/components/MenuMobileAdmin";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) redirect("/painel"); // não é admin: manda de volta pro painel normal
  const nomePlataforma = await obterNomePlataforma();
  const { data: config } = await createAdminClient().from("configuracoes_plataforma").select("funcionalidade_cupons_ativa").eq("id", 1).single();
  const cuponsAtiva = config?.funcionalidade_cupons_ativa ?? true;

  return (
    <div className="booqly-app flex min-h-screen flex-col md:flex-row">
      <MenuMobileAdmin nomePlataforma={nomePlataforma} cuponsAtiva={cuponsAtiva} />
      <aside className="booqly-sidebar hidden w-[248px] shrink-0 md:flex md:flex-col">
        <div className="flex h-[76px] items-center border-b px-7"><span className="font-display text-lg font-bold">{nomePlataforma} <span className="text-brand">admin</span></span></div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 text-sm">
          <Link href="/admin/pagamentos" className="booqly-nav-item">
            Pagamentos
          </Link>
          <Link href="/admin/planos" className="booqly-nav-item">
            Planos
          </Link>
          {cuponsAtiva && (
            <Link href="/admin/cupons" className="booqly-nav-item">
              Cupons
            </Link>
          )}
          <Link href="/admin/rodape" className="booqly-nav-item">
            Rodapé
          </Link>
          <Link href="/admin/profissionais" className="booqly-nav-item">
            Profissionais
          </Link>
          <Link href="/admin/categorias" className="booqly-nav-item">
            Categorias
          </Link>
          <Link href="/admin/tutoriais" className="booqly-nav-item">
            Vídeos tutoriais
          </Link>
          <Link href="/admin/recursos" className="booqly-nav-item">
            Recursos do site
          </Link>
          <Link href="/admin/funcionalidades" className="booqly-nav-item">
            Funcionalidades
          </Link>
          <Link href="/admin/comunidade-denuncias" className="booqly-nav-item">
            Denúncias da Comunidade
          </Link>
          <Link href="/admin/faq" className="booqly-nav-item">
            Perguntas frequentes
          </Link>
          <Link href="/admin/indicacao" className="booqly-nav-item">
            Indique e ganhe
          </Link>
          {cuponsAtiva && (
            <Link href="/admin/subsidios-cupom" className="booqly-nav-item">
              Subsídios de cupom
            </Link>
          )}
        </nav>
        <div className="border-t p-5">
          <Link href="/painel" className="block rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink">
            ← Voltar pro painel
          </Link>
        </div>
      </aside>
      <div className="min-w-0 max-w-full flex-1 overflow-x-clip"><header className="booqly-topbar hidden h-[76px] items-center justify-between border-b px-8 md:flex"><span className="font-medium">Painel administrativo</span><span className="booqly-avatar">A</span></header><main className="booqly-content px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main></div>
    </div>
  );
}
