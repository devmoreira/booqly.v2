"use client";
import { useEffect, useState } from "react";

type Avaliacao = { nota: number; comentario: string | null; criadoEm: string; estabelecimento: string };

export function AvaliacoesClienteModal({ clienteId, onFechar }: { clienteId: string; onFechar: () => void }) {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/painel/avaliacoes-cliente?clienteId=${clienteId}`)
      .then((r) => r.json())
      .then((d) => { setAvaliacoes(d.avaliacoes ?? []); setCarregando(false); });
  }, [clienteId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl2 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Avaliações desse cliente</p>
          <button onClick={onFechar} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-ink/50">Vindas de qualquer estabelecimento que já atendeu esse cliente.</p>

        <div className="mt-4 space-y-3">
          {carregando && <p className="text-sm text-ink/50">Carregando...</p>}
          {!carregando && avaliacoes.length === 0 && <p className="text-sm text-ink/50">Nenhuma avaliação ainda.</p>}
          {avaliacoes.map((a, i) => (
            <div key={i} className="rounded-lg border border-ink/10 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-amber-400">{"★".repeat(a.nota)}{"☆".repeat(5 - a.nota)}</span>
                <span className="text-xs text-ink/40">{a.estabelecimento}</span>
              </div>
              {a.comentario && <p className="mt-1 text-ink/70">{a.comentario}</p>}
              <p className="mt-1 text-xs text-ink/40">{new Date(a.criadoEm).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
