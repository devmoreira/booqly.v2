"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Aba = "automatico" | "manual";

export default function LembreteClientesPage() {
  const [aba, setAba] = useState<Aba>("automatico");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ totalClientesInativos: number; enviados: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [premium, setPremium] = useState<boolean | null>(null);

  const [autoAtivo, setAutoAtivo] = useState(false);
  const [autoDias, setAutoDias] = useState("60");
  const [autoMensagem, setAutoMensagem] = useState("");
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [mensagemAuto, setMensagemAuto] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/painel/lembrete-inativos").then((r) => (r.ok ? r.json() : { premium: false })).then((d) => setPremium(d.premium ?? false));
    fetch("/api/painel/lembrete-inativos/automatico").then((r) => r.json()).then((d) => {
      setAutoAtivo(d.ativo ?? false);
      setAutoDias(String(d.diasSemVisita ?? 60));
      setAutoMensagem(d.mensagem ?? "");
    });
  }, []);

  async function salvarAutomatico() {
    setMensagemAuto(null);
    setSalvandoAuto(true);
    const resp = await fetch("/api/painel/lembrete-inativos/automatico", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: autoAtivo, diasSemVisita: Number(autoDias), mensagem: autoMensagem || undefined }),
    });
    const dados = await resp.json();
    setSalvandoAuto(false);
    setMensagemAuto(resp.ok ? "Salvo." : (dados.erro ?? "Não foi possível salvar."));
  }

  async function enviar() {
    setErro(null);
    setResultado(null);
    setEnviando(true);
    const resp = await fetch("/api/painel/lembrete-inativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: mensagem || undefined }),
    });
    const dados = await resp.json();
    setEnviando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível enviar."); return; }
    setResultado(dados);
  }

  if (premium === null) return <p className="text-ink/60">Carregando...</p>;

  if (!premium) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-bold">Lembrete pra clientes que sumiram</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esse recurso é exclusivo do plano <strong>Premium</strong>.{" "}
          <Link href="/assinatura" className="underline">Fazer upgrade</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Lembrete pra clientes que sumiram</h1>
        <p className="mt-1 text-ink/60">
          Avisos automáticos ou manuais pra quem tem atendimento concluído aqui, mas não volta há um tempo.
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Premium</span>
        </p>
      </div>

      <div className="flex border-b border-ink/10">
        <button
          onClick={() => setAba("automatico")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "automatico" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Automático
        </button>
        <button
          onClick={() => setAba("manual")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "manual" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Enviar notificação para os clientes
        </button>
      </div>

      {aba === "automatico" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Lembrete automático</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoAtivo} onChange={(e) => setAutoAtivo(e.target.checked)} />
              Ativo
            </label>
          </div>
          <p className="text-sm text-ink/60">
            Configura uma vez e esquece — o sistema manda sozinho sempre que um cliente cruzar esse
            prazo sem visitar, sem precisar clicar em nada.
          </p>
          <div>
            <label className="text-sm font-medium">Sem visitar há mais de quantos dias?</label>
            <input type="number" min={7} max={365} value={autoDias} onChange={(e) => setAutoDias(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Mensagem (opcional)</label>
            <textarea value={autoMensagem} onChange={(e) => setAutoMensagem(e.target.value)} rows={2} maxLength={180}
              placeholder="Deixe em branco pra usar uma mensagem padrão"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          {mensagemAuto && <p className="text-sm text-brand">{mensagemAuto}</p>}
          <button onClick={salvarAutomatico} disabled={salvandoAuto}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
            {salvandoAuto ? "Salvando..." : "Salvar"}
          </button>
        </section>
      )}

      {aba === "manual" && (
        <section className="space-y-4">
          <p className="text-sm text-ink/60">Manda pra todos os clientes que já tiveram atendimento concluído aqui.</p>
          <div>
            <label className="text-sm font-medium">Mensagem (opcional)</label>
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={2} maxLength={180}
              placeholder="Deixe em branco pra usar uma mensagem padrão"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {resultado && (
            <p className="rounded-lg bg-brand/10 p-3 text-sm">
              Enviado pra {resultado.enviados} de {resultado.totalClientesInativos} cliente(s) que já visitaram você
              {resultado.totalClientesInativos > resultado.enviados && " — o resto ainda não ativou notificação"}.
            </p>
          )}

          <button onClick={enviar} disabled={enviando}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
            {enviando ? "Enviando..." : "Enviar notificação"}
          </button>
        </section>
      )}
    </div>
  );
}
