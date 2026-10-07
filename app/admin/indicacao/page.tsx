"use client";
import { useEffect, useState } from "react";

type Comissao = { id: string; valorCentavos: number; status: string; criadoEm: string; indicador: string; indicado: string };
type Aba = "profissional" | "cliente" | "colaborador";

const CONFIG_POR_ABA: Record<Aba, { rotaComissoes: string; campoValor: string; tituloIndicador: string; placeholder: string }> = {
  profissional: {
    rotaComissoes: "/api/admin/comissoes-indicacao",
    campoValor: "valorComissaoIndicacaoProfissionalCentavos",
    tituloIndicador: "Um profissional indica outro pra assinar.",
    placeholder: "Ex: 50,00",
  },
  cliente: {
    rotaComissoes: "/api/admin/comissoes-indicacao-cliente",
    campoValor: "valorComissaoIndicacaoClienteCentavos",
    tituloIndicador: "Um cliente indica um profissional novo pra assinar.",
    placeholder: "Ex: 20,00",
  },
  colaborador: {
    rotaComissoes: "/api/admin/comissoes-indicacao-colaborador",
    campoValor: "valorComissaoIndicacaoColaboradorCentavos",
    tituloIndicador: "Um colaborador indica um profissional novo pra assinar.",
    placeholder: "Ex: 15,00",
  },
};

function formatarReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminIndicacaoPage() {
  const [aba, setAba] = useState<Aba>("profissional");
  const [config, setConfig] = useState<Record<string, number>>({});
  const [comissoesPorAba, setComissoesPorAba] = useState<Record<Aba, Comissao[]>>({ profissional: [], cliente: [], colaborador: [] });
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const [configData, prof, cli, col] = await Promise.all([
      fetch("/api/admin/configuracoes").then((r) => r.json()),
      fetch("/api/admin/comissoes-indicacao").then((r) => r.json()),
      fetch("/api/admin/comissoes-indicacao-cliente").then((r) => r.json()),
      fetch("/api/admin/comissoes-indicacao-colaborador").then((r) => r.json()),
    ]);
    setConfig(configData);
    setComissoesPorAba({ profissional: prof.comissoes ?? [], cliente: cli.comissoes ?? [], colaborador: col.comissoes ?? [] });
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function salvarValor() {
    setSalvando(true);
    await fetch("/api/admin/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [CONFIG_POR_ABA[aba].campoValor]: Math.round(parseFloat(valor.replace(",", ".")) * 100) }),
    });
    setSalvando(false);
    setValor("");
    carregar();
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  const info = CONFIG_POR_ABA[aba];
  const valorAtual = config[info.campoValor] ?? 0;
  const comissoes = comissoesPorAba[aba];
  const pendentes = comissoes.filter((c) => c.status === "pendente");
  const solicitadas = comissoes.filter((c) => c.status === "solicitado");
  const pagas = comissoes.filter((c) => c.status === "pago");
  const usadas = comissoes.filter((c) => c.status === "usado");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Indique e ganhe</h1>
        <p className="mt-1 text-ink/60">
          Os 3 programas de indicação da plataforma, cada um numa aba — profissional, cliente e
          colaborador podem indicar um estabelecimento novo pra assinar.
        </p>
      </div>

      <div className="flex border-b border-ink/10">
        {(["profissional", "cliente", "colaborador"] as Aba[]).map((a) => (
          <button
            key={a} onClick={() => { setAba(a); setValor(""); }}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${
              aba === a ? "border-brand text-ink" : "border-transparent text-ink/50"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink/60">{info.tituloIndicador}</p>

      <section className="rounded-lg border border-ink/10 p-4">
        <h2 className="font-medium">Valor da comissão</h2>
        <p className="mt-1 text-sm text-ink/60">Valor atual: {formatarReais(valorAtual)} {valorAtual === 0 && "(programa desligado)"}</p>
        <div className="mt-2 flex gap-2">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={info.placeholder}
            className="w-40 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          <button disabled={!valor || salvando} onClick={salvarValor}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50">
            Salvar
          </button>
        </div>
        <p className="mt-1 text-xs text-ink/50">Deixe 0 pra desligar esse programa (some da tela de quem indica).</p>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink/70">Pendentes ({pendentes.length})</h3>
        <p className="text-xs text-ink/50">Ainda não solicitou o saque.</p>
        <div className="mt-2 space-y-1">
          {pendentes.length === 0 && <p className="text-sm text-ink/40">Nenhuma.</p>}
          {pendentes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-xs text-ink/60">
              <span>{c.indicador} → {c.indicado}</span>
              <span>{formatarReais(c.valorCentavos)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink/70">Saque solicitado, aguardando o prazo ({solicitadas.length})</h3>
        <p className="text-xs text-ink/50">Paga sozinho quando o prazo (Admin → Pagamentos) vencer.</p>
        <div className="mt-2 space-y-1">
          {solicitadas.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-xs text-ink/60">
              <span>{c.indicador} → {c.indicado}</span>
              <span>{formatarReais(c.valorCentavos)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink/70">Já pagas ({pagas.length})</h3>
        <div className="mt-2 space-y-1">
          {pagas.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-xs text-ink/60">
              <span>{c.indicador} → {c.indicado}</span>
              <span>{formatarReais(c.valorCentavos)}</span>
            </div>
          ))}
        </div>
      </section>

      {aba === "profissional" && usadas.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-ink/70">Usadas como crédito de assinatura ({usadas.length})</h3>
          <div className="mt-2 space-y-1">
            {usadas.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-xs text-ink/60">
                <span>{c.indicador} → {c.indicado}</span>
                <span>{formatarReais(c.valorCentavos)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
