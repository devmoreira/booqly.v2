import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { GRUPOS } from "@/components/painel-grupos";
import { MenuMobilePainel } from "@/components/MenuMobilePainel";
import { createClient } from "@/lib/supabase/server";
import { calcularStatusAcesso, temAcessoPremium } from "@/lib/assinatura";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("profissionais").select("is_admin").eq("id", user.id).maybeSingle();

  // Quem está logado não é dono de estabelecimento nenhum (ex: um
  // colaborador que caiu aqui por engano) — não tem "teste grátis" pra
  // calcular, simplesmente não é a área dele.
  if (!perfil) redirect("/login");

  // Quem administra a plataforma nunca fica travado por teste grátis
  // vencido — senão o próprio dono do Booqly perde acesso ao sistema.
  if (!perfil?.is_admin) {
    const status = await calcularStatusAcesso(user.id);
    if (!status.liberado) redirect("/assinatura");
  }

  const premium = await temAcessoPremium(user.id);
  const nomePlataforma = await obterNomePlataforma();
  const { data: config } = await createAdminClient().from("configuracoes_plataforma").select("funcionalidade_cupons_ativa").eq("id", 1).single();
  const cuponsAtiva = config?.funcionalidade_cupons_ativa ?? true;

  const gruposFiltrados = GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) =>
      (premium || (item.href !== "/painel/lembrete-clientes" && item.href !== "/painel/loja")) &&
      (cuponsAtiva || item.href !== "/painel/cupons")
    ),
  }));

  return (
    <div className="booqly-app flex min-h-screen flex-col md:flex-row">
      <MenuMobilePainel grupos={gruposFiltrados} isAdmin={perfil?.is_admin ?? false} nomePlataforma={nomePlataforma} />
      <Sidebar isAdmin={perfil?.is_admin ?? false} premium={premium} nomePlataforma={nomePlataforma} />
      <div className="min-w-0 max-w-full flex-1 overflow-x-clip">
        <header className="booqly-topbar hidden h-[76px] items-center justify-between border-b px-8 md:flex">
          <div />
          <div className="ml-6 flex items-center gap-3 text-sm">
            <span className="hidden text-ink/50 lg:block">Painel profissional</span>
            <span className="booqly-avatar">{(user.email?.charAt(0) ?? "B").toUpperCase()}</span>
          </div>
        </header>
        <main className="booqly-content px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
