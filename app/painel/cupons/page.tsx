"use client";
import { useEffect, useState } from "react";

type Cupom = {
  id: string; codigo: string; tipo: "percentual" | "fixo"; valor: number;
  ativo: boolean; validade: string | null; usos_maximos: number | null; usos_atuais: number;
};

export default function PainelCuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "fixo">("percentual");
  const [valor, setValor] = useState("");
  const [validade, setValidade] = useState("");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cuponsAtiva, setCuponsAtiva] = useState(true);

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => setCuponsAtiva(d.cuponsAtiva ?? true));
  }, []);

  async function carregar() {
    const data = await fetch("/api/painel/cupons").then((r) => r.json());
    setCupons(data.cupons ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const resp = await fetch("/api/painel/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo, tipo,
        valor: parseFloat(valor.replace(",", ".")),
        validade: validade ? new Date(validade).toISOString() : undefined,
        usosMaximos: usosMaximos ? Number(usosMaximos) : undefined,
      }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErro(dados.erro ?? "Não foi possível criar o cupom.");
      return;
    }
    setCodigo(""); setValor(""); setValidade(""); setUsosMaximos("");
    carregar();
  }

  async function desativar(id: string) {
    await fetch("/api/painel/cupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  return (
    <div className="max-w-xl space-y-8">
      {!cuponsAtiva && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          O sistema de cupons está temporariamente desativado pela plataforma — os cupons que
          já existem ficam pausados, e não é possível criar novos até ser religado.
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl font-bold">Seus cupons</h1>
        <p className="mt-1 text-ink/60">
          Cupom de desconto só pra quem agenda com você — o desconto sai do valor que você
          recebe (diferente de um cupom da plataforma, que é bancado por eles).
        </p>
      </div>

      <form onSubmit={criar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Código — ex: VOLTA10" className="w-full rounded-lg border border-ink/15 px-3 py-2 uppercase" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "percentual" | "fixo")}
            className="rounded-lg border border-ink/15 px-3 py-2">
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
          <input required value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder={tipo === "percentual" ? "10" : "5,00"}
            className="flex-1 rounded-lg border border-ink/15 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs text-ink/60">Validade (opcional)</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-ink/60">Limite de usos (opcional)</label>
            <input type="number" min={1} value={usosMaximos} onChange={(e) => setUsosMaximos(e.target.value)}
              placeholder="Sem limite" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={enviando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {enviando ? "Criando..." : "Criar cupom"}
        </button>
      </form>

      <div className="space-y-2">
        {cupons.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-4 text-sm">
            <div>
              <p className="font-medium">{c.codigo} {!c.ativo && <span className="text-ink/40">(inativo)</span>}</p>
              <p className="text-ink/50">
                {c.tipo === "percentual" ? `${c.valor}% de desconto` : `R$ ${c.valor.toFixed(2)} de desconto`}
                {c.validade && ` — válido até ${new Date(c.validade).toLocaleDateString("pt-BR")}`}
                {c.usos_maximos && ` — ${c.usos_atuais}/${c.usos_maximos} usos`}
              </p>
            </div>
            {c.ativo && <button onClick={() => desativar(c.id)} className="text-red-600 hover:underline">Desativar</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
