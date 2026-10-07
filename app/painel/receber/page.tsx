"use client";
import { useEffect, useState } from "react";

type Gateway = "asaas" | "mercadopago";

const INFO_GATEWAY: Record<Gateway, { nome: string; rotuloChave: string; instrucao: string; sigla: string; cor: string }> = {
  asaas: {
    nome: "Asaas",
    rotuloChave: "Chave de API",
    instrucao: "Menu do usuário → Integrações → Chave de API, dentro da sua conta Asaas.",
    sigla: "A",
    cor: "#16a34a",
  },
  mercadopago: {
    nome: "Mercado Pago",
    rotuloChave: "Access Token",
    instrucao: "Seu negócio → Configurações → Credenciais → Access Token, dentro da sua conta Mercado Pago.",
    sigla: "MP",
    cor: "#00b1ea",
  },
};

export default function ReceberPage() {
  const [carregando, setCarregando] = useState(true);
  const [nomePlataforma, setNomePlataforma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [gatewayAtual, setGatewayAtual] = useState<Gateway | null>(null);
  const [statusAtual, setStatusAtual] = useState("nao_configurado");
  const [abaAtiva, setAbaAtiva] = useState<Gateway>("asaas");

  const [apiKey, setApiKey] = useState("");
  const ambiente = "production" as const;

  const [pixChave, setPixChave] = useState("");
  const [pixChaveTipo, setPixChaveTipo] = useState("CPF");
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [pixSalvo, setPixSalvo] = useState(false);
  const [cuponsAtiva, setCuponsAtiva] = useState(true);
  const [gatewayAsaasAtivo, setGatewayAsaasAtivo] = useState(true);
  const [gatewayMercadopagoAtivo, setGatewayMercadopagoAtivo] = useState(true);

  async function carregar() {
    const d = await fetch("/api/painel/gateway-pagamento").then((r) => r.json());
    setGatewayAtual(d.gateway);
    setStatusAtual(d.status);
    if (d.gateway) { setAbaAtiva(d.gateway); }
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((dp) => {
      if (dp.nomePlataforma) setNomePlataforma(dp.nomePlataforma);
      setCuponsAtiva(dp.cuponsAtiva ?? true);
      setGatewayAsaasAtivo(dp.gatewayAsaasAtivo ?? true);
      setGatewayMercadopagoAtivo(dp.gatewayMercadopagoAtivo ?? true);
    });
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  function trocarAba(g: Gateway) {
    setAbaAtiva(g);
    setApiKey("");
    setErro(null);
    setSucesso(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    const resp = await fetch("/api/painel/gateway-pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway: abaAtiva, apiKey, ambiente }),
    });
    const dados = await resp.json();
    setSalvando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível salvar."); return; }
    setApiKey("");
    setSucesso(true);
    carregar();
  }

  async function salvarPix() {
    setSalvandoPix(true);
    const resp = await fetch("/api/painel/pix-subsidio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixChave, pixChaveTipo }),
    });
    setSalvandoPix(false);
    if (resp.ok) setPixSalvo(true);
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  const info = INFO_GATEWAY[abaAtiva];

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Receber pagamentos</h1>
        <p className="mt-1 text-ink/60">
          Conecte a sua própria conta Asaas ou Mercado Pago — o dinheiro do cliente cai
          direto nela, na hora. O {nomePlataforma} nunca fica no meio do caminho do seu dinheiro.
        </p>
      </div>

      {statusAtual === "valido" && gatewayAtual && (
        <p className="rounded-lg bg-brand/10 p-4 text-sm">
          ✅ Conectado ao <strong>{INFO_GATEWAY[gatewayAtual].nome}</strong>. Pix e cartão já
          estão liberados na hora de agendar.
        </p>
      )}

      {gatewayAtual && (
        (gatewayAtual === "asaas" && !gatewayAsaasAtivo) || (gatewayAtual === "mercadopago" && !gatewayMercadopagoAtivo)
      ) && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          O gateway que você está usando ({INFO_GATEWAY[gatewayAtual].nome}) foi desativado temporariamente pela
          plataforma. Escolha outro abaixo pra voltar a receber pagamentos.
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Conexão de pagamento</p>
        <div className="flex border-b border-ink/10">
          {(Object.keys(INFO_GATEWAY) as Gateway[]).map((g) => {
            const habilitado = g === "asaas" ? gatewayAsaasAtivo : gatewayMercadopagoAtivo;
            return (
              <button
                key={g} onClick={() => habilitado && trocarAba(g)} disabled={!habilitado}
                className={`border-b-2 px-5 py-2.5 text-sm font-medium transition ${
                  !habilitado ? "cursor-not-allowed border-transparent text-ink/30"
                  : abaAtiva === g ? "border-brand text-ink" : "border-transparent text-ink/50"
                }`}
              >
                {INFO_GATEWAY[g].nome}{!habilitado && " (indisponível)"}
              </button>
            );
          })}
        </div>

        <form onSubmit={salvar} className="space-y-4 rounded-b-lg rounded-tr-lg border border-t-0 border-ink/10 p-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: info.cor }}
            >
              {info.sigla}
            </div>
            <h2 className="font-medium">Conectar sua conta {info.nome}</h2>
          </div>

          <div>
            <label className="text-sm font-medium">{info.rotuloChave}</label>
            <input required type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Cole aqui a ${info.rotuloChave.toLowerCase()} gerada na sua conta`}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 font-mono text-sm" />
            <p className="mt-1 text-xs text-ink/50">{info.instrucao}</p>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {sucesso && <p className="text-sm text-brand">Conta conectada com sucesso!</p>}

          <button disabled={salvando} className="w-full rounded-lg bg-brand py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60">
            {salvando ? "Conferindo chave..." : "Conectar"}
          </button>
        </form>
      </div>

      {cuponsAtiva && (
        <div className="space-y-3 rounded-lg border border-ink/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Outra chave, outro propósito</p>
          <h2 className="font-medium">Receber subsídio de cupom da plataforma</h2>
          <p className="text-sm text-ink/60">
            Só usada se você tiver algum cupom de desconto pra cliente ativo — a plataforma
            cobre a diferença do desconto direto nessa chave, sem custo pra você. Não depende
            de qual gateway você conectar acima.
          </p>
          <div className="flex flex-wrap gap-2">
            <select value={pixChaveTipo} onChange={(e) => setPixChaveTipo(e.target.value)}
              className="rounded-lg border border-ink/15 px-2 py-2 text-sm">
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
              <option value="EVP">Aleatória</option>
            </select>
            <input value={pixChave} onChange={(e) => setPixChave(e.target.value)}
              placeholder="Sua chave Pix" className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          <button onClick={salvarPix} disabled={!pixChave || salvandoPix}
            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50">
            {salvandoPix ? "Salvando..." : "Salvar chave Pix"}
          </button>
          {pixSalvo && <p className="text-sm text-brand">Chave Pix salva!</p>}
        </div>
      )}
    </div>
  );
}
