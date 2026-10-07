"use client";
import { useState } from "react";
import { SeletorEstrelas } from "./SeletorEstrelas";

export function AvaliarEstabelecimentoModal({
  agendamentoId, nomeNegocio, onFechar, onEnviado,
}: { agendamentoId: string; nomeNegocio: string; onFechar: () => void; onEnviado: () => void }) {
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const resp = await fetch("/api/cliente/avaliar-estabelecimento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agendamentoId, nota, comentario: comentario || undefined }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setErro(d.erro ?? "Não foi possível enviar.");
      return;
    }
    onEnviado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl2 bg-surface p-6">
        <p className="font-medium">Avaliar {nomeNegocio}</p>
        <p className="mt-1 text-sm text-ink/60">Sua avaliação fica pública na página do estabelecimento.</p>
        <div className="mt-4"><SeletorEstrelas valor={nota} onChange={setNota} /></div>
        <textarea
          value={comentario} onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário (opcional)" rows={3}
          className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
        />
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onFechar} className="flex-1 rounded-lg border border-ink/15 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button onClick={enviar} disabled={enviando} className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
            {enviando ? "Enviando..." : "Enviar avaliação"}
          </button>
        </div>
      </div>
    </div>
  );
}
