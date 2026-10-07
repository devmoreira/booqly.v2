"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Plano = { id: string; nome: string; duracao_meses: number; valor_centavos: number; nivel: string };
type PlanoAtual = { id: string; nome: string; nivel: string; valorCentavos: number; duracaoMeses: number; expiraEm: string };

const RECURSOS_POR_NIVEL: Record<string, string[]> = {
  basico: [
    "Agenda online, sem limite de agendamentos",
    "Pagamento por Pix e cartão, direto na sua conta",
    "Cupons de desconto pros seus clientes",
    "Indique e ganhe",
    "Até 2 colaboradores",
  ],
  premium: [
    "Tudo do Básico",
    "Colaboradores ilimitados",
    "Lembrete automático pra clientes que sumiram",
    "Envio manual de notificação pra todos os seus clientes",
  ],
};

export default function AssinaturaPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoAtual, setPlanoAtual] = useState<PlanoAtual | null>(null);
  const [cupom, setCupom] = useState("");
  const [saldoIndicacaoCentavos, setSaldoIndicacaoCentavos] = useState(0);
  const [temCpfCnpj, setTemCpfCnpj] = useState(true); // true até saber, pra não "piscar" o campo à toa
  const [cuponsAtiva, setCuponsAtiva] = useState(true);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [carregandoPlanoId, setCarregandoPlanoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nomePlataforma, setNomePlataforma] = useState("");

  useEffect(() => {
    fetch("/api/planos").then((r) => r.json()).then((d) => setPlanos(d.planos ?? []));
    fetch("/api/painel/assinatura").then((r) => (r.ok ? r.json() : { saldoIndicacaoCentavos: 0, temCpfCnpj: true, planoAtual: null }))
      .then((d) => { setSaldoIndicacaoCentavos(d.saldoIndicacaoCentavos ?? 0); setTemCpfCnpj(d.temCpfCnpj ?? true); setPlanoAtual(d.planoAtual ?? null); });
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => { if (d.nomePlataforma) setNomePlataforma(d.nomePlataforma); setCuponsAtiva(d.cuponsAtiva ?? true); });
  }, []);

  function formatarReais(centavos: number) {
    return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function assinar(planoId: string) {
    setErro(null);
    if (!temCpfCnpj && !cpfCnpj.replace(/\D/g, "")) {
      setErro("Informe seu CPF ou CNPJ pra continuar — o Asaas exige isso pra emitir a cobrança.");
      return;
    }
    setCarregandoPlanoId(planoId);
    const resp = await fetch("/api/painel/assinatura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planoId, cupomCodigo: cupom || undefined, cpfCnpj: !temCpfCnpj ? cpfCnpj : undefined }),
    });
    const dados = await resp.json();
    setCarregandoPlanoId(null);
    if (!resp.ok || !dados.linkPagamento) {
      setErro(dados.erro ?? "Não foi possível iniciar a assinatura.");
      return;
    }
    window.location.href = dados.linkPagamento; // leva pro checkout do Asaas
  }

  async function trocarDePlano(planoId: string) {
    setErro(null);
    if (!confirm("Vamos calcular quanto do seu plano atual ainda vale, e cobrar só a diferença pra trocar pro plano novo. Continuar?")) return;
    setCarregandoPlanoId(planoId);
    const resp = await fetch("/api/painel/assinatura/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planoId }),
    });
    const dados = await resp.json();
    setCarregandoPlanoId(null);
    if (!resp.ok || !dados.linkPagamento) {
      setErro(dados.erro ?? "Não foi possível trocar de plano.");
      return;
    }
    window.location.href = dados.linkPagamento;
  }

  async function trocarParaMaisBarato(planoId: string) {
    setErro(null);
    if (!confirm("Trocar pra esse plano agora? Sem cobrança nova — você mantém a mesma data de renovação, só que já no plano mais barato. Só dá pra fazer isso 1x por mês.")) return;
    setCarregandoPlanoId(planoId);
    const resp = await fetch("/api/painel/assinatura/downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planoId }),
    });
    const dados = await resp.json();
    setCarregandoPlanoId(null);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível trocar de plano."); return; }
    window.location.reload();
  }

  async function pagarComSaldo(planoId: string) {
    setErro(null);
    setCarregandoPlanoId(planoId);
    const resp = await fetch("/api/painel/assinatura/pagar-com-saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planoId }),
    });
    const dados = await resp.json();
    setCarregandoPlanoId(null);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível usar o saldo."); return; }
    router.push("/painel");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <Link href="/painel" className="mb-6 inline-block text-sm text-ink/50 hover:underline">← Voltar pro painel</Link>
      <h1 className="font-display text-2xl font-bold">Planos do {nomePlataforma}</h1>
      <p className="mt-2 text-ink/60">Escolha um plano pra continuar usando o {nomePlataforma} sem interrupção.</p>

      {planoAtual && (
        <div className="mx-auto mt-6 max-w-sm rounded-lg border border-brand bg-brand/10 p-4 text-left text-sm">
          <p className="font-medium">
            Plano atual: {planoAtual.nivel === "premium" ? "Premium" : "Básico"}
          </p>
          <p className="mt-1 text-ink/60">
            {formatarReais(planoAtual.valorCentavos)} a cada {planoAtual.duracaoMeses === 1 ? "mês" : `${planoAtual.duracaoMeses} meses`}
            {" — "}renova em {new Date(planoAtual.expiraEm).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}

      {saldoIndicacaoCentavos > 0 && (
        <div className="mx-auto mt-6 max-w-xs rounded-xl2 border border-brand bg-brand/10 p-4">
          <p className="text-sm text-ink/60">Seu saldo de indicação</p>
          <p className="text-xl font-bold">{formatarReais(saldoIndicacaoCentavos)}</p>
          <p className="mt-1 text-xs text-ink/50">Dá pra usar esse saldo pra pagar um plano abaixo, sem precisar de cartão/Pix.</p>
        </div>
      )}

      {!temCpfCnpj && (
        <div className="mx-auto mt-6 max-w-xs">
          <label className="text-sm font-medium">Seu CPF ou CNPJ</label>
          <input
            value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value.replace(/\D/g, ""))}
            placeholder="Só números"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-center"
          />
          <p className="mt-1 text-xs text-ink/50">Exigido pelo Asaas pra emitir a cobrança da assinatura.</p>
        </div>
      )}

      {cuponsAtiva && (
        <div className="mx-auto mt-6 max-w-xs">
          <label className="text-sm font-medium">Tem um cupom de desconto?</label>
          <input
            value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())}
            placeholder="Ex: LANCAMENTO20"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-center uppercase"
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {planos.length === 0 && (
          <p className="col-span-2 text-sm text-ink/50">Nenhum plano disponível no momento. Fale com o suporte.</p>
        )}
        {planos.map((p) => {
          const daParaPagarComSaldo = saldoIndicacaoCentavos >= p.valor_centavos;
          const ehPlanoAtual = planoAtual?.id === p.id;
          const ehTroca = !!planoAtual && !ehPlanoAtual;
          return (
            <div key={p.id} className={`rounded-xl2 border p-6 text-left ${ehPlanoAtual ? "border-brand bg-brand/5" : "border-ink/10"}`}>
              <p className="font-medium">{p.nome} {ehPlanoAtual && <span className="text-xs text-brand">(seu plano atual)</span>}</p>
              <p className="mt-1 text-2xl font-bold">
                R$ {(p.valor_centavos / 100).toFixed(2)}
                <span className="text-sm font-normal text-ink/50"> / {p.duracao_meses === 1 ? "mês" : `${p.duracao_meses} meses`}</span>
              </p>

              <ul className="mt-3 space-y-1 text-sm text-ink/70">
                {(RECURSOS_POR_NIVEL[p.nivel] ?? []).map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>

              {ehPlanoAtual ? (
                <p className="mt-4 text-center text-sm text-ink/50">Você já está nesse plano.</p>
              ) : ehTroca ? (
                p.valor_centavos > (planoAtual?.valorCentavos ?? 0) ? (
                  <button
                    onClick={() => trocarDePlano(p.id)}
                    disabled={carregandoPlanoId === p.id}
                    className="mt-4 w-full rounded-lg bg-brand py-2 font-medium text-[var(--brand-fg)] disabled:opacity-60"
                  >
                    {carregandoPlanoId === p.id ? "Calculando..." : "Trocar pra esse plano"}
                  </button>
                ) : (
                  <button
                    onClick={() => trocarParaMaisBarato(p.id)}
                    disabled={carregandoPlanoId === p.id}
                    className="mt-4 w-full rounded-lg border border-brand py-2 font-medium text-brand disabled:opacity-60"
                  >
                    {carregandoPlanoId === p.id ? "Trocando..." : "Trocar pra esse plano"}
                  </button>
                )
              ) : (
                <button
                  onClick={() => assinar(p.id)}
                  disabled={carregandoPlanoId === p.id}
                  className="mt-4 w-full rounded-lg bg-brand py-2 font-medium text-[var(--brand-fg)] disabled:opacity-60"
                >
                  {carregandoPlanoId === p.id ? "Preparando pagamento..." : "Assinar com Pix/cartão"}
                </button>
              )}

              {!planoAtual && daParaPagarComSaldo && (
                <button
                  onClick={() => pagarComSaldo(p.id)}
                  disabled={carregandoPlanoId === p.id}
                  className="mt-2 w-full rounded-lg border border-brand py-2 font-medium text-brand disabled:opacity-60"
                >
                  Pagar com meu saldo de indicação
                </button>
              )}
            </div>
          );
        })}
      </div>
      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
    </main>
  );
}
