"use client";
import { useEffect, useState } from "react";

export function StoryAvatar({ children, fotos }: { children: React.ReactNode; fotos: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    const timer = setTimeout(() => {
      if (indice < fotos.length - 1) setIndice((i) => i + 1);
      else setAberto(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [aberto, indice, fotos.length]);

  if (fotos.length === 0) return <>{children}</>;

  return (
    <>
      <button
        onClick={() => { setIndice(0); setAberto(true); }}
        className="rounded-full p-[3px]"
        style={{ background: "conic-gradient(from 45deg, #D85A30, #0F6E56, #D85A30)" }}
      >
        <div className="rounded-full bg-surface p-[3px]">{children}</div>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setAberto(false)}>
          <div className="absolute left-0 right-0 top-0 flex gap-1 p-3">
            {fotos.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface/30">
                <div className={`h-full bg-surface ${i < indice ? "w-full" : i === indice ? "w-full animate-[storybar_5s_linear]" : "w-0"}`} />
              </div>
            ))}
          </div>
          <img src={fotos[indice]} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />

          <button
            onClick={(e) => { e.stopPropagation(); setAberto(false); }}
            className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface/15 text-sm text-white"
            aria-label="Fechar"
          >
            ✕
          </button>

          {indice > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIndice((i) => i - 1); }}
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-surface/15 text-base text-white"
              aria-label="Voltar"
            >
              ‹
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); if (indice < fotos.length - 1) setIndice((i) => i + 1); else setAberto(false); }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-surface/15 text-base text-white"
            aria-label="Avançar"
          >
            ›
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); if (indice > 0) setIndice((i) => i - 1); }}
            className="absolute left-0 top-0 h-full w-1/3"
            aria-label="Anterior"
          />
          <button
            onClick={(e) => { e.stopPropagation(); if (indice < fotos.length - 1) setIndice((i) => i + 1); else setAberto(false); }}
            className="absolute right-0 top-0 h-full w-1/3"
            aria-label="Próxima"
          />
          <style>{`@keyframes storybar { from { width: 0; } to { width: 100%; } }`}</style>
        </div>
      )}
    </>
  );
}
