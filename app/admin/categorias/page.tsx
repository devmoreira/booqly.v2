"use client";
import { useEffect, useState } from "react";

type Categoria = { valor: string; rotulo: string; sinonimos: string[]; ativo: boolean };

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [valor, setValor] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [sinonimos, setSinonimos] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [rotuloEdit, setRotuloEdit] = useState("");
  const [sinonimosEdit, setSinonimosEdit] = useState("");

  async function carregar() {
    const data = await fetch("/api/admin/categorias").then((r) => r.json());
    setCategorias(data.categorias ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const resp = await fetch("/api/admin/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: valor.toLowerCase().trim().replace(/\s+/g, "_"),
        rotulo,
        sinonimos: sinonimos.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErro(dados.erro ?? "Não foi possível criar.");
      return;
    }
    setValor(""); setRotulo(""); setSinonimos("");
    carregar();
  }

  async function desativar(v: string) {
    await fetch("/api/admin/categorias", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: v }) });
    carregar();
  }
  async function reativar(v: string) {
    await fetch("/api/admin/categorias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: v }) });
    carregar();
  }
  async function excluir(v: string) {
    if (!confirm("Excluir essa categoria de vez? Só funciona se nenhum estabelecimento estiver usando ela.")) return;
    const resp = await fetch("/api/admin/categorias", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: v, excluir: true }) });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      alert(dados.erro ?? "Não foi possível excluir.");
      return;
    }
    carregar();
  }

  function abrirEdicao(c: Categoria) {
    setEditando(c.valor);
    setRotuloEdit(c.rotulo);
    setSinonimosEdit(c.sinonimos.join(", "));
  }

  async function salvarEdicao(v: string) {
    const resp = await fetch("/api/admin/categorias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor: v,
        rotulo: rotuloEdit,
        sinonimos: sinonimosEdit.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      alert(dados.erro ?? "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    carregar();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Categorias de serviço</h1>
        <p className="mt-1 text-ink/60">
          Aparecem no cadastro do profissional e na busca do cliente. Sinônimos ajudam a busca
          a reconhecer o que a pessoa digitou (ex: "barbeiro" → Barbearia).
        </p>
      </div>

      <form onSubmit={criar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input required value={rotulo} onChange={(e) => setRotulo(e.target.value)}
            placeholder="Nome — ex: Barbearia" className="flex-1 rounded-lg border border-ink/15 px-3 py-2" />
          <input required value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="identificador — ex: barbearia" className="flex-1 rounded-lg border border-ink/15 px-3 py-2" />
        </div>
        <input value={sinonimos} onChange={(e) => setSinonimos(e.target.value)}
          placeholder="Sinônimos, separados por vírgula — ex: barbeiro, corte, barba"
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={enviando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {enviando ? "Criando..." : "Criar categoria"}
        </button>
      </form>

      <div className="space-y-2">
        {categorias.map((c) => (
          <div key={c.valor} className="rounded-lg border border-ink/10 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.rotulo} {!c.ativo && <span className="text-ink/40">(desativada)</span>}</p>
                <p className="text-xs text-ink/50">{c.valor} — {c.sinonimos.join(", ") || "sem sinônimos"}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button onClick={() => abrirEdicao(c)} className="text-ink/60 hover:underline">Editar</button>
                {c.ativo ? (
                  <button onClick={() => desativar(c.valor)} className="text-ink/60 hover:underline">Desativar</button>
                ) : (
                  <button onClick={() => reativar(c.valor)} className="text-brand hover:underline">Reativar</button>
                )}
                <button onClick={() => excluir(c.valor)} className="text-red-600 hover:underline">Excluir</button>
              </div>
            </div>

            {editando === c.valor && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <input value={rotuloEdit} onChange={(e) => setRotuloEdit(e.target.value)}
                  placeholder="Nome" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
                <input value={sinonimosEdit} onChange={(e) => setSinonimosEdit(e.target.value)}
                  placeholder="Sinônimos, separados por vírgula" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => salvarEdicao(c.valor)} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
                    Salvar
                  </button>
                  <button onClick={() => setEditando(null)} className="rounded-lg border border-ink/15 px-4 py-1.5 text-xs">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
