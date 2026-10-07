"use client";
import { useEffect, useState } from "react";

type Config = {
  asaasAmbiente: "production";
  asaasApiKey: string | null;
  asaasWebhookToken: string | null;
  testeGratisHoras: number;
  limiteHorasRemarcar: number;
  prazoSaqueDias: number;
};

export default function AdminPagamentosPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [novaAsaasKey, setNovaAsaasKey] = useState("");
  const [novoWebhookToken, setNovoWebhookToken] = useState("");
  const [testeDias, setTesteDias] = useState("");
  const [limiteRemarcar, setLimiteRemarcar] = useState("");
  const [prazoSaque, setPrazoSaque] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/configuracoes").then((r) => r.json()).then(setConfig);
  }, []);

  async function salvar(campos: Record<string, unknown>) {
    setSalvando(true);
    setMensagem(null);
    const resp = await fetch("/api/admin/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    });
    setSalvando(false);
    if (resp.ok) {
      setMensagem("Salvo.");
      const atualizado = await fetch("/api/admin/configuracoes").then((r) => r.json());
      setConfig(atualizado);
      setNovaAsaasKey("");
      setNovoWebhookToken("");
      setTesteDias("");
      setLimiteRemarcar("");
      setPrazoSaque("");
    } else {
      setMensagem("Não foi possível salvar. Confira os dados.");
    }
  }

  if (!config) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Pagamentos</h1>
        <p className="mt-1 text-ink/60">
          Configuração da SUA conta Asaas — usada só pra cobrar a assinatura dos profissionais
          e cobrir subsídio de cupom. O pagamento do cliente pro profissional usa a conta de
          cada um deles, configurada no painel individual.
        </p>
      </div>

      <section>
        <h2 className="font-medium">Ambiente do Asaas</h2>
        <div className="mt-3 flex gap-2">
          <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm font-medium">Produção (dinheiro real)</div>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Chave de API do Asaas (sua conta, da plataforma)</h2>
        <p className="mt-1 text-sm text-ink/60">
          Status atual: {config.asaasApiKey ?? "ainda não configurada"}
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={novaAsaasKey} onChange={(e) => setNovaAsaasKey(e.target.value)}
            placeholder="Cole a chave nova aqui pra trocar"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2"
          />
          <button
            disabled={!novaAsaasKey || salvando}
            onClick={() => salvar({ asaasApiKey: novaAsaasKey })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Token do webhook da assinatura</h2>
        <p className="mt-1 text-sm text-ink/60">
          Status atual: {config.asaasWebhookToken ?? "ainda não configurado"}. Esse mesmo valor
          precisa ser colado no painel do Asaas, em Integrações → Webhooks — usado só pra
          confirmar pagamento de assinatura dos profissionais.
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={novoWebhookToken} onChange={(e) => setNovoWebhookToken(e.target.value)}
            placeholder="Uma senha longa e aleatória"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2"
          />
          <button
            disabled={!novoWebhookToken || salvando}
            onClick={() => salvar({ asaasWebhookToken: novoWebhookToken })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Teste grátis</h2>
        <p className="mt-1 text-sm text-ink/60">
          Duração atual: {(config.testeGratisHoras / 24).toFixed(1)} dias ({config.testeGratisHoras}h).
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={testeDias} onChange={(e) => setTesteDias(e.target.value)}
            placeholder="Novo valor em dias — ex: 10"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2"
          />
          <button
            disabled={!testeDias || salvando}
            onClick={() => salvar({ testeGratisHoras: Math.round(parseFloat(testeDias) * 24) })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Prazo pra remarcar agendamento</h2>
        <p className="mt-1 text-sm text-ink/60">
          Valor atual: até {config.limiteHorasRemarcar}h antes do horário marcado — vale tanto
          pro cliente quanto pro profissional.
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={limiteRemarcar} onChange={(e) => setLimiteRemarcar(e.target.value)}
            placeholder="Novo valor em horas — ex: 2"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2"
          />
          <button
            disabled={!limiteRemarcar || salvando}
            onClick={() => salvar({ limiteHorasRemarcar: Number(limiteRemarcar) })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Prazo de saque (indique e ganhe)</h2>
        <p className="mt-1 text-sm text-ink/60">
          Valor atual: até {config.prazoSaqueDias} dia(s) depois de pedir o saque — vale pra
          indicação de profissional, cliente e colaborador. O pagamento cai automático via Pix
          depois desse prazo.
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={prazoSaque} onChange={(e) => setPrazoSaque(e.target.value)}
            placeholder="Novo valor em dias — ex: 3"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2"
          />
          <button
            disabled={!prazoSaque || salvando}
            onClick={() => salvar({ prazoSaqueDias: Number(prazoSaque) })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

{mensagem && <p className="text-sm text-ink/60">{mensagem}</p>}
    </div>
  );
}
