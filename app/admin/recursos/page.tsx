"use client";
import { useEffect, useState } from "react";

type Recurso = {
  id: string;
  titulo: string;
  texto: string;
  ordem: number;
  ativo: boolean;
};

export default function AdminRecursosPage() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [tituloEdit, setTituloEdit] = useState("");
  const [textoEdit, setTextoEdit] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const resp = await fetch("/api/admin/recursos");
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(data.erro ?? "Não foi possível carregar os recursos.");
      setCarregando(false);
      return;
    }
    setRecursos(data.recursos ?? []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const resp = await fetch("/api/admin/recursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, texto }),
    });
    const data = await resp.json().catch(() => ({}));
    setSalvando(false);
    if (!resp.ok) { setErro(data.erro ?? "Não foi possível adicionar."); return; }
    setTitulo("");
    setTexto("");
    carregar();
  }

  function abrirEdicao(recurso: Recurso) {
    setErro(null);
    setEditando(recurso.id);
    setTituloEdit(recurso.titulo);
    setTextoEdit(recurso.texto);
  }

  async function salvarEdicao(id: string) {
    setErro(null);
    setSalvando(true);
    const resp = await fetch("/api/admin/recursos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, titulo: tituloEdit, texto: textoEdit }),
    });
    const data = await resp.json().catch(() => ({}));
    setSalvando(false);
    if (!resp.ok) { setErro(data.erro ?? "Não foi possível salvar."); return; }
    setEditando(null);
    carregar();
  }

  async function alternarAtivo(recurso: Recurso) {
    setErro(null);
    const resp = await fetch("/api/admin/recursos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recurso.id, ativo: !recurso.ativo }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { setErro(data.erro ?? "Não foi possível alterar o status."); return; }
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este recurso definitivamente?")) return;
    setErro(null);
    const resp = await fetch("/api/admin/recursos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { setErro(data.erro ?? "Não foi possível excluir."); return; }
    carregar();
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Recursos do site</h1>
        <p className="mt-1 text-ink/60">
          Tudo que aparece em <strong>/recursos</strong> agora pode ser administrado por aqui.
          Os recursos que já existiam foram mantidos.
        </p>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <form onSubmit={adicionar} className="space-y-3 rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-medium">Adicionar novo recurso</h2>
        <input
          required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do recurso"
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
        />
        <textarea
          required maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Descrição do recurso"
          rows={4}
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
        />
        <button disabled={salvando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {salvando ? "Salvando..." : "Adicionar recurso"}
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{recursos.length} recurso(s) cadastrado(s)</h2>
          <a href="/recursos" target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Ver página pública ↗</a>
        </div>

        {carregando ? (
          <p className="text-sm text-ink/50">Carregando...</p>
        ) : recursos.length === 0 ? (
          <p className="text-sm text-ink/50">Nenhum recurso cadastrado.</p>
        ) : recursos.map((recurso) => (
          <div key={recurso.id} className="rounded-xl border border-ink/10 bg-surface p-4 text-sm">
            {editando === recurso.id ? (
              <div className="space-y-3">
                <input value={tituloEdit} onChange={(e) => setTituloEdit(e.target.value)} maxLength={120}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2" />
                <textarea value={textoEdit} onChange={(e) => setTextoEdit(e.target.value)} maxLength={1000} rows={4}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2" />
                <div className="flex flex-wrap gap-2">
                  <button disabled={salvando} onClick={() => salvarEdicao(recurso.id)} className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-60">Salvar</button>
                  <button disabled={salvando} onClick={() => setEditando(null)} className="rounded-lg border border-ink/15 px-4 py-2 text-xs">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`font-medium ${!recurso.ativo ? "text-ink/40 line-through" : ""}`}>{recurso.titulo}</p>
                    <p className="mt-1 text-ink/60">{recurso.texto}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${recurso.ativo ? "bg-brand/10 text-brand" : "bg-ink/5 text-ink/50"}`}>
                    {recurso.ativo ? "Visível" : "Oculto"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 border-t border-ink/5 pt-3 text-xs">
                  <button onClick={() => abrirEdicao(recurso)} className="font-medium text-brand hover:underline">Editar</button>
                  <button onClick={() => alternarAtivo(recurso)} className="text-ink/60 hover:underline">{recurso.ativo ? "Ocultar" : "Mostrar"}</button>
                  <button onClick={() => excluir(recurso.id)} className="text-red-600 hover:underline">Excluir</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
