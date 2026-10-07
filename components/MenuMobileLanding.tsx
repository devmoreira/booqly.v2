"use client";
import { useState } from "react";
import Link from "next/link";

export function MenuMobileLanding() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15"
      >
        <span className="block h-0.5 w-4 bg-ink relative before:absolute before:-top-1.5 before:h-0.5 before:w-4 before:bg-ink after:absolute after:top-1.5 after:h-0.5 after:w-4 after:bg-ink" />
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 top-[64px] z-20 border-b border-ink/10 bg-paper px-6 py-4 shadow-sm">
          <nav className="flex flex-col gap-3 text-sm">
            <Link href="/recursos" onClick={() => setAberto(false)} className="text-ink/70">Recursos</Link>
            <Link href="/planos" onClick={() => setAberto(false)} className="text-ink/70">Planos</Link>
            <Link href="/ajuda" onClick={() => setAberto(false)} className="text-ink/70">Ajuda</Link>
            <Link href="/login" onClick={() => setAberto(false)} className="text-ink/70">Entrar</Link>
          </nav>
        </div>
      )}
    </div>
  );
}
