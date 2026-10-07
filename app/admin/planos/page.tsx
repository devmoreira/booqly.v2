"use client";
import { useEffect, useState } from "react";

type Plano = { id: string; nome: string; duracao_meses: number; valor_centavos: number; nivel: "basico" | "premium"; ativo: boolean };

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [nome, setNome] = useState("");
  const [duracaoMeses, setDuracaoMeses] = useState(1);
  const [valor, setValor] = useState("");
  const [nivel, setNivel] = useState<"basico" | "premium">("basico");
  const [erro, setErro] = useState<string | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [valorEdit, setValorEdit] = useState("");
  const [erroEdit, setErroEdit] = useState<string | null>(null);

  async function carregar() {
    const data = await fetch("/api/admin/planos").then((r) => r.json());
    setPlanos(data.planos ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const resp = await fetch("/api/admin/planos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome, duracaoMeses, nivel,
        valorCentavos: Math.round(parseFloat(valor.replace(",", ".")) * 100),
      }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErro(dados.erro ?? "Não foi possível criar o plano.");
      return;
    }
    setNome(""); setValor(""); setDuracaoMeses(1); setNivel("basico");
    carregar();
  }

  async function remover(id: string) {
    await fetch("/api/admin/planos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esse plano de vez? Isso não pode ser desfeito.")) return;
    const resp = await fetch("/api/admin/planos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, excluir: true }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      alert(dados.erro ?? "Não foi possível excluir.");
      return;
    }
    carregar();
  }

  function abrirEdicao(p: Plano) {
    setEditando(p.id);
    setNomeEdit(p.nome);
    setValorEdit((p.valor_centavos / 100).toFixed(2).replace(".", ","));
    setErroEdit(null);
  }

  async function salvarEdicao(id: string) {
    setErroEdit(null);
    const resp = await fetch("/api/admin/planos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        nome: nomeEdit,
        valorCentavos: Math.round(parseFloat(valorEdit.replace(",", ".")) * 100),
      }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErroEdit(dados.erro ?? "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    carregar();
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Planos de assinatura</h1>
        <p className="mt-1 text-ink/60">O que os profissionais veem quando o teste grátis acaba.</p>
      </div>

      <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <input required value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Nome — ex: Básico Mensal, Premium Anual" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <div>
          <label className="text-xs text-ink/60">Nível do plano</label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setNivel("basico")}
              className={`flex-1 rounded-lg border py-2 text-sm ${nivel === "basico" ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
              Básico
            </button>
            <button type="button" onClick={() => setNivel("premium")}
              className={`flex-1 rounded-lg border py-2 text-sm ${nivel === "premium" ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
              Premium
            </button>
          </div>
          <p className="mt-1 text-xs text-ink/50">
            Premium libera colaboradores ilimitados.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs text-ink/60">Duração (meses)</label>
            <input required type="number" min={1} value={duracaoMeses}
              onChange={(e) => setDuracaoMeses(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-ink/60">Valor (R$)</label>
            <input required value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="59,90" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)]">
          Adicionar plano
        </button>
      </form>

      <div className="space-y-2">
        {planos.map((p) => (
          <div key={p.id} className="rounded-lg border border-ink/10 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {p.nome} {!p.ativo && <span className="text-ink/40">(inativo)</span>}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${p.nivel === "premium" ? "bg-amber-100 text-amber-800" : "bg-ink/5 text-ink/60"}`}>
                    {p.nivel === "premium" ? "Premium" : "Básico"}
                  </span>
                </p>
                <p className="text-ink/50">
                  R$ {(p.valor_centavos / 100).toFixed(2)} a cada {p.duracao_meses === 1 ? "mês" : `${p.duracao_meses} meses`}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button onClick={() => abrirEdicao(p)} className="text-ink/60 hover:underline">Editar</button>
                {p.ativo && <button onClick={() => remover(p.id)} className="text-ink/60 hover:underline">Desativar</button>}
                <button onClick={() => excluir(p.id)} className="text-red-600 hover:underline">Excluir</button>
              </div>
            </div>

            {editando === p.id && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)}
                  placeholder="Nome" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
                <input value={valorEdit} onChange={(e) => setValorEdit(e.target.value)}
                  placeholder="Valor (R$)" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
                <p className="text-xs text-ink/50">A duração ({p.duracao_meses === 1 ? "mensal" : `${p.duracao_meses} meses`}) e o nível não podem ser alterados — crie um plano novo se precisar de outra combinação.</p>
                {erroEdit && <p className="text-xs text-red-600">{erroEdit}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => salvarEdicao(p.id)} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
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
