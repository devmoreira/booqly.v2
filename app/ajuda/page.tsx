import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AjudaPage() {
  const admin = createAdminClient();
  const [{ data: perguntas }, { data: config }] = await Promise.all([
    admin.from("perguntas_frequentes").select("id, pergunta, resposta").eq("ativo", true).order("ordem"),
    admin.from("configuracoes_plataforma").select("rodape_email_suporte, rodape_whatsapp").eq("id", 1).single(),
  ]);

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
        <h1 className="font-display text-3xl font-bold">Central de ajuda</h1>
        <p className="mt-3 text-ink/60">Respostas rápidas — e um jeito de falar com a gente, se precisar de mais.</p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-16">
        {perguntas && perguntas.length > 0 ? (
          <div className="divide-y divide-ink/10 rounded-xl2 border border-ink/10 bg-surface px-5">
            {perguntas.map((item) => (
              <details key={item.id} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  {item.pergunta}
                  <span className="text-ink/40 transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-2 text-sm text-ink/60">{item.resposta}</p>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-ink/50">Nenhuma pergunta cadastrada ainda.</p>
        )}

        {(config?.rodape_email_suporte || config?.rodape_whatsapp) && (
          <div className="mt-10 rounded-xl2 border border-ink/10 bg-surface p-6 text-center">
            <p className="font-medium">Não achou sua resposta?</p>
            <p className="mt-1 text-sm text-ink/60">Fala direto com a gente.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {config?.rodape_email_suporte && (
                <a href={`mailto:${config.rodape_email_suporte}`} className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5">
                  {config.rodape_email_suporte}
                </a>
              )}
              {config?.rodape_whatsapp && (
                <a href={config.rodape_whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
