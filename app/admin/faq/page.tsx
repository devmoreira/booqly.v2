"use client";
import { useEffect, useState } from "react";

type Pergunta = { id: string; pergunta: string; resposta: string; ordem: number; ativo: boolean };

export default function AdminFaqPage() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [perguntaEdit, setPerguntaEdit] = useState("");
  const [respostaEdit, setRespostaEdit] = useState("");

  async function carregar() {
    const data = await fetch("/api/admin/faq").then((r) => r.json());
    setPerguntas(data.perguntas ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta, resposta, ordem: perguntas.length }),
    });
    setPergunta(""); setResposta("");
    carregar();
  }

  function abrirEdicao(p: Pergunta) {
    setEditando(p.id);
    setPerguntaEdit(p.pergunta);
    setRespostaEdit(p.resposta);
  }

  async function salvarEdicao(id: string) {
    await fetch("/api/admin/faq", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pergunta: perguntaEdit, resposta: respostaEdit }),
    });
    setEditando(null);
    carregar();
  }

  async function alternarAtivo(p: Pergunta) {
    await fetch("/api/admin/faq", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, ativo: !p.ativo }),
    });
    carregar();
  }

  async function mover(p: Pergunta, direcao: -1 | 1) {
    const indice = perguntas.findIndex((item) => item.id === p.id);
    const vizinho = perguntas[indice + direcao];
    if (!vizinho) return;
    await Promise.all([
      fetch("/api/admin/faq", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, ordem: vizinho.ordem }) }),
      fetch("/api/admin/faq", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: vizinho.id, ordem: p.ordem }) }),
    ]);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover essa pergunta de vez?")) return;
    await fetch("/api/admin/faq", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Perguntas frequentes</h1>
        <p className="mt-1 text-ink/60">O que aparece na seção de FAQ da página inicial.</p>
      </div>

      <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <input required value={pergunta} onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunta" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <textarea required value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3}
          placeholder="Resposta" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <button className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)]">
          Adicionar pergunta
        </button>
      </form>

      <div className="space-y-2">
        {perguntas.length === 0 && <p className="text-sm text-ink/50">Nenhuma pergunta cadastrada ainda.</p>}
        {perguntas.map((p, i) => (
          <div key={p.id} className="rounded-lg border border-ink/10 p-4 text-sm">
            {editando === p.id ? (
              <div className="space-y-2">
                <input value={perguntaEdit} onChange={(e) => setPerguntaEdit(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2" />
                <textarea value={respostaEdit} onChange={(e) => setRespostaEdit(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => salvarEdicao(p.id)} className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
                    Salvar
                  </button>
                  <button onClick={() => setEditando(null)} className="rounded-full border border-ink/15 px-4 py-1.5 text-xs">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-medium ${!p.ativo ? "text-ink/40 line-through" : ""}`}>{p.pergunta}</p>
                    <p className="mt-1 text-ink/60">{p.resposta}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t border-ink/5 pt-3 text-xs">
                  <button onClick={() => mover(p, -1)} disabled={i === 0} className="text-ink/60 hover:underline disabled:opacity-30">↑ Mover pra cima</button>
                  <button onClick={() => mover(p, 1)} disabled={i === perguntas.length - 1} className="text-ink/60 hover:underline disabled:opacity-30">↓ Mover pra baixo</button>
                  <button onClick={() => abrirEdicao(p)} className="font-medium text-brand hover:underline">Editar</button>
                  <button onClick={() => alternarAtivo(p)} className="text-ink/60 hover:underline">{p.ativo ? "Ocultar" : "Mostrar"}</button>
                  <button onClick={() => remover(p.id)} className="text-red-600 hover:underline">Excluir</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
