"use client";
import { useEffect, useState } from "react";

type Comissao = { id: string; valorCentavos: number; status: string; criadoEm: string; nomeIndicado: string };

export default function RevendaPage() {
  const [ativo, setAtivo] = useState(false);
  const [valorComissaoCentavos, setValorComissaoCentavos] = useState(0);
  const [slug, setSlug] = useState("");
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [saldoCentavos, setSaldoCentavos] = useState(0);
  const [prazoSaqueDias, setPrazoSaqueDias] = useState(3);
  const [pixChave, setPixChave] = useState("");
  const [nomePlataforma, setNomePlataforma] = useState("");
  const [pixChaveTipo, setPixChaveTipo] = useState("CPF");
  const [solicitando, setSolicitando] = useState(false);
  const [mensagemSaque, setMensagemSaque] = useState<string | null>(null);
  const [erroSaque, setErroSaque] = useState<string | null>(null);
  const [codigoVerificacao, setCodigoVerificacao] = useState("");
  const [linkWhatsapp, setLinkWhatsapp] = useState("");
  const [telefoneMascarado, setTelefoneMascarado] = useState("");
  const [aguardandoWhatsapp, setAguardandoWhatsapp] = useState(false);

  async function carregar() {
    const d = await fetch("/api/painel/indicacoes-profissional").then((r) => r.json());
    setAtivo(d.ativo); setValorComissaoCentavos(d.valorComissaoCentavos);
    setSlug(d.slug ?? ""); setComissoes(d.comissoes ?? []);
    setSaldoCentavos(d.saldoCentavos ?? 0); setPrazoSaqueDias(d.prazoSaqueDias ?? 3);
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((dp) => { if (dp.nomePlataforma) setNomePlataforma(dp.nomePlataforma); });
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  const link = typeof window !== "undefined" ? `${window.location.origin}/cadastro?indicado_por=${slug}` : "";
  const totalPago = comissoes.filter((c) => c.status === "pago").reduce((soma, c) => soma + c.valorCentavos, 0);

  function formatarReais(centavos: number) {
    return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function copiar() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function concluirSaque(codigo: string) {
    const resp = await fetch("/api/painel/revenda/solicitar-saque", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixChave, pixChaveTipo, codigoVerificacao: codigo }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível solicitar o saque.");
    setMensagemSaque(`Saque de ${formatarReais(dados.valorCentavos)} autorizado pelo WhatsApp e solicitado! Cai na sua chave Pix em até ${prazoSaqueDias} dia(s).`);
    setPixChave(""); setCodigoVerificacao(""); setLinkWhatsapp(""); setAguardandoWhatsapp(false);
    await carregar();
  }

  async function solicitarSaque(e: React.FormEvent) {
    e.preventDefault(); setErroSaque(null); setMensagemSaque(null); setSolicitando(true);
    try {
      const resp = await fetch("/api/painel/revenda/verificar-saque", { method: "POST" });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível iniciar a confirmação.");
      setCodigoVerificacao(dados.codigo); setLinkWhatsapp(dados.linkWhatsapp); setTelefoneMascarado(dados.telefoneMascarado ?? "");
      setAguardandoWhatsapp(true);
      window.open(dados.linkWhatsapp, "_blank", "noopener,noreferrer");
    } catch (err) { setErroSaque(err instanceof Error ? err.message : "Não foi possível iniciar a confirmação."); }
    finally { setSolicitando(false); }
  }

  useEffect(() => {
    if (!aguardandoWhatsapp || !codigoVerificacao) return;
    let encerrado = false;
    const timer = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/painel/revenda/verificar-saque?codigo=${encodeURIComponent(codigoVerificacao)}`, { cache: "no-store" });
        const d = await r.json();
        if (!encerrado && d.verificado) {
          encerrado = true; window.clearInterval(timer); setSolicitando(true);
          try { await concluirSaque(codigoVerificacao); }
          catch (err) { setErroSaque(err instanceof Error ? err.message : "Não foi possível concluir o saque."); }
          finally { setSolicitando(false); }
        }
      } catch {}
    }, 2000);
    return () => { encerrado = true; window.clearInterval(timer); };
  }, [aguardandoWhatsapp, codigoVerificacao]);

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  if (!ativo) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-bold">Indique e ganhe</h1>
        <p className="text-ink/60">O programa de indicação de novos estabelecimentos ainda não está ativo.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Indique e ganhe</h1>
        <p className="mt-1 text-ink/60">
          Indique outro estabelecimento pra assinar o {nomePlataforma} — quando ele pagar a primeira
          assinatura, você ganha {formatarReais(valorComissaoCentavos)}.
        </p>
      </div>

      <div className="rounded-xl2 border border-ink/10 p-4">
        <p className="text-sm font-medium">Seu link de indicação</p>
        <div className="mt-2 flex gap-2">
          <input readOnly value={link} className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          <button onClick={copiar} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">
            {copiado ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl2 border border-brand bg-brand/10 p-4">
          <p className="text-sm text-ink/60">Saldo disponível</p>
          <p className="text-xl font-bold">{formatarReais(saldoCentavos)}</p>
        </div>
        <div className="rounded-xl2 border border-ink/10 p-4">
          <p className="text-sm text-ink/60">Já pago</p>
          <p className="text-xl font-bold">{formatarReais(totalPago)}</p>
        </div>
      </div>

      <form onSubmit={solicitarSaque} className="space-y-3 rounded-xl2 border border-ink/10 p-4">
        <h2 className="font-medium">Sacar pro Pix</h2>
        <p className="text-xs text-ink/50">Por segurança, cada saque precisa ser autorizado pelo WhatsApp do celular cadastrado. Depois da confirmação, o pagamento cai em até {prazoSaqueDias} dia(s).</p>
        <div className="flex flex-wrap gap-2">
          <select value={pixChaveTipo} onChange={(e) => setPixChaveTipo(e.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-2 text-sm">
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
            <option value="EMAIL">E-mail</option>
            <option value="PHONE">Telefone</option>
            <option value="EVP">Aleatória</option>
          </select>
          <input required value={pixChave} onChange={(e) => setPixChave(e.target.value)}
            placeholder="Sua chave Pix" className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>
        {aguardandoWhatsapp && (
          <div className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm">
            <p className="font-medium">Confirme o saque pelo WhatsApp {telefoneMascarado}</p>
            <p className="mt-1 text-xs text-ink/60">Envie a mensagem pronta com o código {codigoVerificacao}. Esta tela autoriza o saque automaticamente após a confirmação.</p>
            <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand underline">Abrir WhatsApp para confirmar</a>
          </div>
        )}
        {erroSaque && <p className="text-sm text-red-600">{erroSaque}</p>}
        {mensagemSaque && <p className="text-sm text-brand">{mensagemSaque}</p>}
        <button disabled={saldoCentavos <= 0 || solicitando}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50">
          {solicitando ? "Aguardando..." : aguardandoWhatsapp ? "Aguardando confirmação no WhatsApp" : `Confirmar no WhatsApp e sacar ${formatarReais(saldoCentavos)}`}
        </button>
      </form>

      <div>
        <h2 className="font-medium">Histórico</h2>
        <div className="mt-2 space-y-1">
          {comissoes.length === 0 && <p className="text-sm text-ink/50">Nenhuma indicação ainda.</p>}
          {comissoes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm">
              <div>
                <p>{c.nomeIndicado}</p>
                <p className="text-xs text-ink/50">{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatarReais(c.valorCentavos)}</p>
                <p className={`text-xs ${c.status === "pago" ? "text-brand" : c.status === "usado" ? "text-ink/40" : c.status === "solicitado" ? "text-amber-600" : "text-ink/50"}`}>
                  {c.status === "pago" ? "Pago" : c.status === "usado" ? "Usado na assinatura" : c.status === "solicitado" ? "Saque solicitado" : "Pendente"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
