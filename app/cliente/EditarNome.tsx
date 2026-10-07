"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditarNome({ nomeAtual }: { nomeAtual: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const resp = await fetch("/api/cliente/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    setSalvando(false);
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setErro(d.erro ?? "Não foi possível salvar.");
      return;
    }
    setEditando(false);
    router.refresh();
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <p className="font-display text-xl font-bold">Olá, {nomeAtual}</p>
        <button onClick={() => setEditando(true)} className="text-xs font-medium text-brand hover:underline">
          Editar nome
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={nome} onChange={(e) => setNome(e.target.value)}
        className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
      />
      <button onClick={salvar} disabled={salvando} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-60">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      <button onClick={() => { setEditando(false); setNome(nomeAtual); }} className="text-xs text-ink/50 hover:underline">
        Cancelar
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
