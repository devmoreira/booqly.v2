"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { SairButton } from "./SairButton";

type Item = { href: string; rotulo: string };
type Grupo = { titulo: string; itens: Item[] };

export function MenuMobilePainel({
  grupos, isAdmin, nomePlataforma,
}: { grupos: Grupo[]; isAdmin: boolean; nomePlataforma?: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="border-b border-ink/10 p-4 md:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Logo className="text-lg" nome={nomePlataforma} />
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="rounded-lg border border-ink/15 p-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setAberto(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative flex h-full w-[min(19rem,88vw)] max-w-[88vw] flex-col bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Logo className="text-lg" nome={nomePlataforma} />
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="p-1 text-ink/50">
                ✕
              </button>
            </div>
            <nav className="mt-8 flex flex-1 flex-col gap-4 overflow-y-auto">
              {grupos.map((grupo) => (
                grupo.itens.length > 0 && (
                  <div key={grupo.titulo}>
                    <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink/35">{grupo.titulo}</p>
                    <div className="flex flex-col gap-0.5">
                      {grupo.itens.map((item) => (
                        <Link
                          key={item.href} href={item.href} onClick={() => setAberto(false)}
                          className="rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
                        >
                          {item.rotulo}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              ))}
              {isAdmin && (
                <div>
                  <div className="mb-2 border-t border-ink/10" />
                  <Link
                    href="/admin/pagamentos" onClick={() => setAberto(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10"
                  >
                    Painel admin
                  </Link>
                </div>
              )}
            </nav>
            <div className="border-t border-ink/10 pt-4">
              <SairButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
