"use client";
import { useEffect, useState } from "react";

type Cupom = {
  id: string; codigo: string; tipo: "percentual" | "fixo"; valor: number; publico: "profissional" | "cliente";
  ativo: boolean; validade: string | null; usos_maximos: number | null; usos_atuais: number;
  usos_maximos_por_empresa: number | null;
};

export default function AdminCuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "fixo">("percentual");
  const [valor, setValor] = useState("");
  const [publico, setPublico] = useState<"profissional" | "cliente">("profissional");
  const [validade, setValidade] = useState("");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [usosMaximosPorEmpresa, setUsosMaximosPorEmpresa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cuponsAtiva, setCuponsAtiva] = useState(true);

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => setCuponsAtiva(d.cuponsAtiva ?? true));
  }, []);
  const [notificar, setNotificar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const data = await fetch("/api/admin/cupons").then((r) => r.json());
    setCupons(data.cupons ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const resp = await fetch("/api/admin/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo,
        tipo,
        valor: parseFloat(valor.replace(",", ".")),
        publico,
        validade: validade ? new Date(validade).toISOString() : undefined,
        usosMaximos: usosMaximos ? Number(usosMaximos) : undefined,
        usosMaximosPorEmpresa: usosMaximosPorEmpresa ? Number(usosMaximosPorEmpresa) : undefined,
        descricao: descricao || undefined,
        notificar,
      }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErro(dados.erro ?? "Não foi possível criar o cupom.");
      return;
    }
    setCodigo(""); setValor(""); setValidade(""); setUsosMaximos(""); setUsosMaximosPorEmpresa(""); setDescricao(""); setNotificar(false);
    carregar();
  }

  async function desativar(id: string) {
    await fetch("/api/admin/cupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esse cupom de vez? Isso não pode ser desfeito.")) return;
    const resp = await fetch("/api/admin/cupons", {
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

  return (
    <div className="max-w-xl space-y-8">
      {!cuponsAtiva && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          O sistema de cupons está desativado (Admin → Funcionalidades) — cupons já criados ficam
          pausados, e não é possível criar novos até religar.
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl font-bold">Cupons</h1>
        <p className="mt-1 text-ink/60">Descontos pra profissional (assinatura) ou pro cliente final (agendamento).</p>
      </div>

      <form onSubmit={criar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <div>
          <label className="text-xs text-ink/60">Para quem é esse cupom</label>
          <select value={publico} onChange={(e) => setPublico(e.target.value as "profissional" | "cliente")}
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2">
            <option value="profissional">Profissional (desconto na assinatura da plataforma)</option>
            <option value="cliente">Cliente final (desconto no agendamento — a plataforma banca)</option>
          </select>
          {publico === "cliente" && (
            <p className="mt-1 text-xs text-amber-700">
              Esse desconto sai do seu bolso, não do profissional — ele recebe o valor cheio normalmente.
            </p>
          )}
        </div>
        <input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Código — ex: LANCAMENTO20" className="w-full rounded-lg border border-ink/15 px-3 py-2 uppercase" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "percentual" | "fixo")}
            className="rounded-lg border border-ink/15 px-3 py-2">
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
          <input required value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder={tipo === "percentual" ? "20" : "10,00"}
            className="flex-1 rounded-lg border border-ink/15 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs text-ink/60">Validade (opcional)</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-ink/60">Limite de usos geral (opcional)</label>
            <input type="number" min={1} value={usosMaximos} onChange={(e) => setUsosMaximos(e.target.value)}
              placeholder="Sem limite" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="text-xs text-ink/60">Limite de usos POR ESTABELECIMENTO (opcional)</label>
          <input type="number" min={1} value={usosMaximosPorEmpresa} onChange={(e) => setUsosMaximosPorEmpresa(e.target.value)}
            placeholder="Sem limite por empresa" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          <p className="mt-1 text-xs text-ink/50">
            Além do limite geral acima, controla quantas vezes esse cupom pode ser usado em cada
            estabelecimento — evita um único estabelecimento usar tudo sozinho.
          </p>
        </div>

        <div className="border-t border-ink/10 pt-3">
          <label className="text-xs text-ink/60">Descrição pra notificação (opcional)</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2}
            placeholder="Ex: Ganhe 20% de desconto no seu próximo corte! Só até domingo."
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
            Avisar por notificação push todo mundo que já ativou (
            {publico === "cliente" ? "os clientes" : "os profissionais"})
          </label>
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
              <p className="font-medium">
                {c.codigo} {!c.ativo && <span className="text-ink/40">(inativo)</span>}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${c.publico === "cliente" ? "bg-amber-100 text-amber-800" : "bg-ink/5 text-ink/60"}`}>
                  {c.publico === "cliente" ? "Cliente" : "Profissional"}
                </span>
              </p>
              <p className="text-ink/50">
                {c.tipo === "percentual" ? `${c.valor}% de desconto` : `R$ ${c.valor.toFixed(2)} de desconto`}
                {c.validade && ` — válido até ${new Date(c.validade).toLocaleDateString("pt-BR")}`}
                {c.usos_maximos && ` — ${c.usos_atuais}/${c.usos_maximos} usos`}
                {c.usos_maximos_por_empresa && ` — até ${c.usos_maximos_por_empresa} por empresa`}
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              {c.ativo && <button onClick={() => desativar(c.id)} className="text-ink/60 hover:underline">Desativar</button>}
              <button onClick={() => excluir(c.id)} className="text-red-600 hover:underline">Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
