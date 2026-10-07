"use client";
import { useEffect, useState } from "react";

type Servico = { id: string; nome: string; duracao_minutos: number; preco_centavos: number; ativo: boolean; foto_url: string | null };

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState("");
  const [duracao, setDuracao] = useState("30");
  const [preco, setPreco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [duracaoEdit, setDuracaoEdit] = useState("30");
  const [precoEdit, setPrecoEdit] = useState("");
  const [erroEdit, setErroEdit] = useState<string | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  async function carregar() {
    const data = await fetch("/api/servicos").then((r) => r.json());
    setServicos(data.servicos ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const precoCentavos = Math.round(parseFloat(preco.replace(",", ".")) * 100);
    if (isNaN(precoCentavos)) { setSalvando(false); setErro("Preço inválido."); return; }

    const resp = await fetch("/api/servicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, duracaoMinutos: Number(duracao), precoCentavos }),
    });
    setSalvando(false);
    if (!resp.ok) { setErro("Não foi possível adicionar."); return; }
    setNome(""); setDuracao("30"); setPreco("");
    carregar();
  }

  async function alternarAtivo(servico: Servico) {
    await fetch("/api/servicos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: servico.id, ativo: !servico.ativo }),
    });
    carregar();
  }

  async function remover(id: string) {
    await fetch("/api/servicos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  function abrirEdicao(s: Servico) {
    setEditando(s.id);
    setNomeEdit(s.nome);
    setDuracaoEdit(String(s.duracao_minutos));
    setPrecoEdit((s.preco_centavos / 100).toFixed(2).replace(".", ","));
    setErroEdit(null);
  }

  async function salvarEdicao(id: string) {
    setErroEdit(null);
    const precoCentavos = Math.round(parseFloat(precoEdit.replace(",", ".")) * 100);
    if (isNaN(precoCentavos)) { setErroEdit("Preço inválido."); return; }
    setSalvandoEdit(true);
    const resp = await fetch("/api/servicos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nome: nomeEdit, duracaoMinutos: Number(duracaoEdit), precoCentavos }),
    });
    setSalvandoEdit(false);
    if (!resp.ok) { setErroEdit("Não foi possível salvar."); return; }
    setEditando(null);
    carregar();
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Serviços</h1>
        <p className="mt-1 text-ink/60">O que aparece pro cliente escolher na hora de agendar.</p>
      </div>

      <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <input required value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Nome — ex: Corte + Barba" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs text-ink/60">Duração (minutos)</label>
            <input required type="number" min={5} step={5} value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-ink/60">Preço (R$)</label>
            <input required value={preco} onChange={(e) => setPreco(e.target.value)}
              placeholder="45,00" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={salvando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {salvando ? "Adicionando..." : "Adicionar serviço"}
        </button>
      </form>

      <div className="space-y-2">
        {carregando && <p className="text-sm text-ink/50">Carregando...</p>}
        {!carregando && servicos.length === 0 && <p className="text-sm text-ink/50">Nenhum serviço cadastrado ainda.</p>}
        {servicos.map((s) => (
          <div key={s.id} className="rounded-lg border border-ink/10 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={`font-medium ${!s.ativo ? "text-ink/40 line-through" : ""}`}>{s.nome}</p>
                <p className="text-ink/50">{s.duracao_minutos} min — R$ {(s.preco_centavos / 100).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => (editando === s.id ? setEditando(null) : abrirEdicao(s))} className="text-brand hover:underline">
                  {editando === s.id ? "Cancelar" : "Editar"}
                </button>
                <button onClick={() => alternarAtivo(s)} className="text-ink/60 hover:underline">
                  {s.ativo ? "Desativar" : "Ativar"}
                </button>
                <button onClick={() => remover(s.id)} className="text-red-600 hover:underline">Remover</button>
              </div>
            </div>

            {editando === s.id && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                <div className="flex flex-wrap gap-2">
                  <input type="number" min={5} step={5} value={duracaoEdit} onChange={(e) => setDuracaoEdit(e.target.value)}
                    placeholder="Minutos" className="w-1/2 rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                  <input value={precoEdit} onChange={(e) => setPrecoEdit(e.target.value)}
                    placeholder="Preço (R$)" className="w-1/2 rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                </div>
                {erroEdit && <p className="text-xs text-red-600">{erroEdit}</p>}
                <button onClick={() => salvarEdicao(s.id)} disabled={salvandoEdit}
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-60">
                  {salvandoEdit ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
