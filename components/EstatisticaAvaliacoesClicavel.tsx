"use client";
import { useState } from "react";

type Avaliacao = { nota: number; comentario: string | null; criado_em: string };

// Mesmo padrão da caixa flutuante de avaliações na Agenda do profissional
// — aqui é do lado do cliente, olhando as avaliações do ESTABELECIMENTO.
export function EstatisticaAvaliacoesClicavel({
  totalAvaliacoes, mediaAvaliacoes, avaliacoes,
}: { totalAvaliacoes: number; mediaAvaliacoes: number; avaliacoes: Avaliacao[] }) {
  const [aberto, setAberto] = useState(false);
  const comComentario = avaliacoes.filter((a) => a.comentario);

  return (
    <>
      <button onClick={() => setAberto(true)} className="text-center">
        <p className="font-bold">{totalAvaliacoes}</p>
        <p className="text-xs text-ink/50 underline">Avaliações</p>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(false)}>
          <div className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl2 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Avaliações</p>
                <p className="text-xs text-ink/50">
                  {totalAvaliacoes > 0 ? `${mediaAvaliacoes.toFixed(1)} ★ — ${totalAvaliacoes} avaliação(ões)` : "Nenhuma avaliação ainda"}
                </p>
              </div>
              <button onClick={() => setAberto(false)} className="text-ink/40 hover:text-ink">✕</button>
            </div>

            <div className="mt-4 space-y-3">
              {comComentario.length === 0 && <p className="text-sm text-ink/50">Nenhum comentário ainda.</p>}
              {comComentario.map((a, i) => (
                <div key={i} className="rounded-lg border border-ink/10 p-3 text-sm">
                  <span className="text-amber-400">{"★".repeat(a.nota)}{"☆".repeat(5 - a.nota)}</span>
                  <p className="mt-1 text-ink/70">{a.comentario}</p>
                  <p className="mt-1 text-xs text-ink/40">{new Date(a.criado_em).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
