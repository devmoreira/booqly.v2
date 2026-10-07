import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PlanosPage() {
  const admin = createAdminClient();
  const [{ data: planos }, { data: funcionalidades }] = await Promise.all([
    admin.from("planos_assinatura").select("id, nome, duracao_meses, valor_centavos, nivel").eq("ativo", true).order("nivel").order("valor_centavos"),
    admin.from("configuracoes_plataforma").select("funcionalidade_teste_gratis_ativa").eq("id", 1).single(),
  ]);
  const testeGratisAtivo = funcionalidades?.funcionalidade_teste_gratis_ativa ?? true;

  const basicos = (planos ?? []).filter((p) => p.nivel === "basico");
  const premiums = (planos ?? []).filter((p) => p.nivel === "premium");

  return (
    <main className="min-h-screen bg-paper">
      <header className="booqly-landing-header border-b border-ink/10">
        <div className="mx-auto flex h-[72px] max-w-[1024px] items-center justify-between px-5 sm:px-7">
          <Link href="/"><Logo className="text-xl sm:text-2xl" /></Link>
          <Link href="/cadastro" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">
            Criar conta
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-14 text-center">
        <h1 className="font-display text-3xl font-bold">Planos</h1>
        <p className="mt-3 text-ink/60">
          {testeGratisAtivo
            ? "Comece grátis no período de teste, e escolha o plano que fizer sentido pro seu negócio."
            : "Escolha o plano que fizer sentido pro seu negócio."}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        {(!planos || planos.length === 0) && (
          <p className="text-center text-sm text-ink/50">Os planos ainda estão sendo configurados — volte em breve.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl2 border border-ink/10 bg-surface p-6">
            <p className="font-display text-lg font-bold">Básico</p>
            <p className="mt-1 text-sm text-ink/60">Tudo que você precisa pra rodar o dia a dia do seu estabelecimento.</p>
            <div className="mt-4 space-y-2">
              {basicos.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm">
                  <span>{p.nome}</span>
                  <span className="font-medium">
                    R$ {(p.valor_centavos / 100).toFixed(2)}
                    <span className="text-ink/50"> /{p.duracao_meses === 1 ? "mês" : `${p.duracao_meses} meses`}</span>
                  </span>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-ink/70">
              <li>✓ Agenda online, sem limite de agendamentos</li>
              <li>✓ Pagamento por Pix e cartão, direto na sua conta</li>
              <li>✓ Cupons de desconto pros seus clientes</li>
              <li>✓ Indique e ganhe (você, seus clientes e seus colaboradores)</li>
              <li>✓ Até 2 colaboradores</li>
            </ul>
          </div>

          <div className="rounded-xl2 border-2 border-brand bg-surface p-6">
            <p className="font-display text-lg font-bold">Premium</p>
            <p className="mt-1 text-sm text-ink/60">Tudo do Básico, sem limite de equipe, e com lembrete automático de clientes.</p>
            <div className="mt-4 space-y-2">
              {premiums.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm">
                  <span>{p.nome}</span>
                  <span className="font-medium">
                    R$ {(p.valor_centavos / 100).toFixed(2)}
                    <span className="text-ink/50"> /{p.duracao_meses === 1 ? "mês" : `${p.duracao_meses} meses`}</span>
                  </span>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-ink/70">
              <li>✓ Colaboradores ilimitados</li>
              <li>✓ Lembrete automático pra clientes que sumiram (configura uma vez, o sistema avisa sozinho)</li>
              <li>✓ Envio manual de notificação pra todos os seus clientes quando quiser</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/cadastro" className="rounded-lg bg-brand px-6 py-3 font-medium text-[var(--brand-fg)] hover:opacity-90">
            {testeGratisAtivo ? "Começar com o teste grátis" : "Criar minha conta"}
          </Link>
        </div>
      </section>
    </main>
  );
}
