"use client";
import { useEffect, useState } from "react";

export default function SaldoIndicacaoPage() {
  const [saldoCentavos, setSaldoCentavos] = useState(0);
  const [programaAtivo, setProgramaAtivo] = useState(true);
  const [prazoSaqueDias, setPrazoSaqueDias] = useState(3);
  const [link, setLink] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [pixChaveTipo, setPixChaveTipo] = useState("CPF");
  const [solicitando, setSolicitando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nomePlataforma, setNomePlataforma] = useState("");
  const [codigoVerificacao, setCodigoVerificacao] = useState("");
  const [linkWhatsapp, setLinkWhatsapp] = useState("");
  const [telefoneMascarado, setTelefoneMascarado] = useState("");
  const [aguardandoWhatsapp, setAguardandoWhatsapp] = useState(false);

  async function carregar() {
    const d = await fetch("/api/cliente/indicacao-dinheiro").then((r) => r.json());
    setSaldoCentavos(d.saldoCentavos ?? 0);
    setProgramaAtivo(d.programaAtivo ?? true);
    setPrazoSaqueDias(d.prazoSaqueDias ?? 3);
    setLink(`${window.location.origin}/cadastro?indicado_por_cliente=${d.clienteId ?? ""}`);
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((dp) => { if (dp.nomePlataforma) setNomePlataforma(dp.nomePlataforma); });
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  function formatarReais(centavos: number) {
    return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function concluirSaque(codigo: string) {
    const resp = await fetch("/api/cliente/solicitar-saque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixChave, pixChaveTipo, codigoVerificacao: codigo }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível solicitar.");
    setMensagem(`Saque de ${formatarReais(dados.valorCentavos)} autorizado pelo WhatsApp e solicitado! Cai na sua chave Pix em até ${prazoSaqueDias} dia(s).`);
    setSaldoCentavos(0);
    setPixChave("");
    setCodigoVerificacao("");
    setLinkWhatsapp("");
    setAguardandoWhatsapp(false);
  }

  async function solicitarSaque(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setSolicitando(true);
    try {
      const resp = await fetch("/api/cliente/verificar-saque", { method: "POST" });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível iniciar a confirmação.");
      setCodigoVerificacao(dados.codigo);
      setLinkWhatsapp(dados.linkWhatsapp);
      setTelefoneMascarado(dados.telefoneMascarado ?? "");
      setAguardandoWhatsapp(true);
      window.open(dados.linkWhatsapp, "_blank", "noopener,noreferrer");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível iniciar a confirmação.");
    } finally {
      setSolicitando(false);
    }
  }

  useEffect(() => {
    if (!aguardandoWhatsapp || !codigoVerificacao) return;
    let encerrado = false;
    const timer = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/cliente/verificar-saque?codigo=${encodeURIComponent(codigoVerificacao)}`, { cache: "no-store" });
        const d = await r.json();
        if (!encerrado && d.verificado) {
          encerrado = true;
          window.clearInterval(timer);
          setSolicitando(true);
          try { await concluirSaque(codigoVerificacao); }
          catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível concluir o saque."); }
          finally { setSolicitando(false); }
        }
      } catch {}
    }, 2000);
    return () => { encerrado = true; window.clearInterval(timer); };
  }, [aguardandoWhatsapp, codigoVerificacao]);


  if (carregando) return <p className="text-ink/60">Carregando...</p>;
  if (!programaAtivo) return <p className="text-sm text-ink/50">Esse recurso não está disponível no momento.</p>;

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Indique um profissional</h1>
        <p className="mt-1 text-ink/60">
          Conhece um barbeiro, salão, ou outro profissional que ainda não usa o {nomePlataforma}?
          Manda seu link — quando ele assinar um plano pago pela primeira vez, você ganha um
          saldo em dinheiro pra sacar direto no seu Pix.
        </p>
      </div>

      <div className="rounded-lg bg-brand/10 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-ink/50">Seu saldo</p>
        <p className="mt-1 text-3xl font-bold text-brand">{formatarReais(saldoCentavos)}</p>
      </div>

      <div>
        <label className="text-sm font-medium">Seu link de indicação</label>
        <div className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input readOnly value={link} className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-ink/[0.02] px-3 py-2 text-sm" />
          <button onClick={() => navigator.clipboard.writeText(link)} className="shrink-0 rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5">
            Copiar
          </button>
        </div>
      </div>

      <form onSubmit={solicitarSaque} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <h2 className="font-medium">Sacar pro Pix</h2>
        <p className="text-xs text-ink/50">Por segurança, cada saque precisa ser autorizado pelo WhatsApp do telefone cadastrado. Depois da confirmação, o pagamento cai em até {prazoSaqueDias} dia(s).</p>
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
            placeholder="Sua chave Pix" className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>
        {aguardandoWhatsapp && (
          <div className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm">
            <p className="font-medium">Confirme o saque pelo WhatsApp {telefoneMascarado}</p>
            <p className="mt-1 text-xs text-ink/60">Envie a mensagem pronta com o código {codigoVerificacao}. O saque será autorizado automaticamente após a confirmação.</p>
            <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-brand underline">Abrir WhatsApp para confirmar</a>
          </div>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {mensagem && <p className="text-sm text-brand">{mensagem}</p>}
        <button disabled={saldoCentavos <= 0 || solicitando}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50">
          {solicitando ? "Aguardando..." : aguardandoWhatsapp ? "Aguardando confirmação no WhatsApp" : `Confirmar no WhatsApp e sacar ${formatarReais(saldoCentavos)}`}
        </button>
      </form>
    </div>
  );
}
