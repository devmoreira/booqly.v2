"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const ITENS_ADMIN = [
  { href: "/admin/pagamentos", rotulo: "Pagamentos" },
  { href: "/admin/planos", rotulo: "Planos" },
  { href: "/admin/cupons", rotulo: "Cupons" },
  { href: "/admin/rodape", rotulo: "Rodapé" },
  { href: "/admin/profissionais", rotulo: "Profissionais" },
  { href: "/admin/categorias", rotulo: "Categorias" },
  { href: "/admin/tutoriais", rotulo: "Vídeos tutoriais" },
  { href: "/admin/recursos", rotulo: "Recursos do site" },
  { href: "/admin/funcionalidades", rotulo: "Funcionalidades" },
  { href: "/admin/faq", rotulo: "Perguntas frequentes" },
  { href: "/admin/indicacao", rotulo: "Indique e ganhe" },
  { href: "/admin/subsidios-cupom", rotulo: "Subsídios de cupom" },
];

export function MenuMobileAdmin({ nomePlataforma = "Booqly", cuponsAtiva = true }: { nomePlataforma?: string; cuponsAtiva?: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="border-b border-ink/10 p-4 md:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Logo className="text-lg" nome={nomePlataforma} />
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" className="rounded-lg border border-ink/15 p-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setAberto(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative flex h-full w-[min(19rem,88vw)] max-w-[88vw] flex-col bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Logo className="text-lg" nome={nomePlataforma} />
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="p-1 text-ink/50">✕</button>
            </div>
            <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto text-sm">
              {ITENS_ADMIN.filter((item) => cuponsAtiva || (item.href !== "/admin/cupons" && item.href !== "/admin/subsidios-cupom")).map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setAberto(false)}
                  className="rounded-lg px-3 py-2 text-ink/70 hover:bg-ink/5 hover:text-ink">
                  {item.rotulo}
                </Link>
              ))}
            </nav>
            <div className="border-t border-ink/10 pt-4">
              <Link href="/painel" onClick={() => setAberto(false)} className="block rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink">
                ← Voltar pro painel
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
