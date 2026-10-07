"use client";
import { useEffect, useState } from "react";

function base64UrlParaUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const dados = atob(base64);
  return Uint8Array.from([...dados].map((c) => c.charCodeAt(0)));
}

export function AtivarNotificacoes() {
  const [suportado, setSuportado] = useState(false);
  const [status, setStatus] = useState<"inativo" | "ativando" | "ativo" | "negado">("inativo");
  const [precisaInstalarNoIphone, setPrecisaInstalarNoIphone] = useState(false);
  const [nomePlataforma, setNomePlataforma] = useState("");

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => { if (d.nomePlataforma) setNomePlataforma(d.nomePlataforma); });
    const ehIphoneOuIpad = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const jaInstalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

    if (ehIphoneOuIpad && !jaInstalado) {
      setPrecisaInstalarNoIphone(true);
      return; // no Safari comum do iPhone, notificação push não funciona — a Apple exige instalar primeiro
    }

    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSuportado(true);
      if (Notification.permission === "denied") setStatus("negado");
      navigator.serviceWorker.getRegistration().then(async (registro) => {
        const inscricaoAtual = await registro?.pushManager.getSubscription();
        if (inscricaoAtual) setStatus("ativo");
      });
    }
  }, []);

  async function ativar() {
    setStatus("ativando");
    try {
      const registro = await navigator.serviceWorker.register("/sw.js");
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setStatus("negado"); return; }

      const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chavePublica) {
        console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY não está configurada — confira o .env.local e reinicie o servidor.");
        setStatus("inativo");
        return;
      }
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaUint8Array(chavePublica),
      });

      const dados = inscricao.toJSON();
      const respSalvar = await fetch("/api/cliente/push/inscrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: dados.endpoint, keys: dados.keys }),
      });
      if (!respSalvar.ok) {
        console.error("Falha ao salvar a inscrição push do cliente:", await respSalvar.text().catch(() => ""));
        setStatus("inativo");
        return;
      }
      setStatus("ativo");
    } catch (erro) {
      console.error("Erro ao ativar notificações:", erro);
      setStatus("inativo");
    }
  }

  if (precisaInstalarNoIphone) {
    return (
      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm">
        <p className="text-ink/70">
          Quer receber um aviso no celular quando seu pagamento confirmar? No iPhone, a Apple
          exige um passo a mais: toque no botão de compartilhar{" "}
          <span className="font-medium">⬆️</span> do Safari e escolha{" "}
          <span className="font-medium">"Adicionar à Tela de Início"</span>. Depois de abrir o
          {nomePlataforma} por esse atalho, a opção de ativar notificação aparece aqui.
        </p>
      </div>
    );
  }

  if (!suportado || status === "ativo") return null;

  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm">
      {status === "negado" ? (
        <p className="text-ink/60">
          Notificações bloqueadas nas configurações do navegador. Ative manualmente se quiser ser
          avisado quando seu pagamento confirmar.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink/70">Quer receber um aviso no celular quando seu pagamento confirmar?</p>
          <button
            onClick={ativar} disabled={status === "ativando"}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-60"
          >
            {status === "ativando" ? "Ativando..." : "Ativar"}
          </button>
        </div>
      )}
    </div>
  );
}
