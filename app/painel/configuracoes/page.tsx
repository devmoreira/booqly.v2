"use client";
import { useEffect, useState } from "react";
import { UploadFoto } from "@/components/UploadFoto";

type Metodo = "taxa_agendamento" | "pagamento_total" | "pos_servico";
type TaxaTipo = "percentual" | "fixo";
type Aba = "conta" | "estabelecimento" | "recebimento";

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<Aba>("conta");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [email, setEmail] = useState("");

  // Fluxo de troca de senha: verificar por WhatsApp primeiro, só
  // depois libera os campos de senha nova.
  const [verificacaoSenha, setVerificacaoSenha] = useState<{ codigo: string; linkWhatsapp: string; telefoneMascarado: string } | null>(null);
  const [pedindoVerificacao, setPedindoVerificacao] = useState(false);
  const [identidadeConfirmada, setIdentidadeConfirmada] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [mensagemSenha, setMensagemSenha] = useState<string | null>(null);
  const [verificacaoExclusao, setVerificacaoExclusao] = useState<{ codigo: string; linkWhatsapp: string; telefoneMascarado: string } | null>(null);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [mensagemExclusao, setMensagemExclusao] = useState<string | null>(null);
  const [identidadeExclusaoConfirmada, setIdentidadeExclusaoConfirmada] = useState(false);

  const [metodo, setMetodo] = useState<Metodo>("pos_servico");
  const [taxaTipo, setTaxaTipo] = useState<TaxaTipo>("percentual");
  const [taxaValor, setTaxaValor] = useState("0");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [complementoEndereco, setComplementoEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [instagram, setInstagram] = useState("");
  const [celular, setCelular] = useState("");

  useEffect(() => {
    fetch("/api/painel/configuracoes")
      .then((r) => r.json())
      .then((d) => {
        setMetodo(d.metodo);
        setTaxaTipo(d.taxaTipo);
        setTaxaValor(String(d.taxaValor));
        setFotoUrl(d.fotoUrl);
        setNomeNegocio(d.nomeNegocio ?? "");
        setEndereco(d.endereco ?? "");
        setNumeroEndereco(d.numeroEndereco ?? "");
        setComplementoEndereco(d.complementoEndereco ?? "");
        setBairro(d.bairro ?? "");
        setCidade(d.cidade ?? "");
        setEstado(d.estado ?? "");
        setInstagram(d.instagram ?? "");
        setCelular(d.celular ?? "");
        setEmail(d.email ?? "");
        setCarregando(false);
      });
  }, []);

  async function pedirVerificacaoParaTrocarSenha() {
    setPedindoVerificacao(true);
    setMensagemSenha(null);
    const resp = await fetch("/api/painel/verificar-telefone", { method: "POST" });
    const dados = await resp.json();
    setPedindoVerificacao(false);
    if (!resp.ok) { setMensagemSenha(dados.erro ?? "Não foi possível gerar a verificação."); return; }
    setVerificacaoSenha(dados);
  }

  // Enquanto a verificação está aberta, confere de tempos em tempos se
  // a mensagem já chegou no WhatsApp.
  useEffect(() => {
    if (!verificacaoSenha || identidadeConfirmada) return;
    const intervalo = setInterval(async () => {
      const resp = await fetch(`/api/painel/verificar-telefone?codigo=${encodeURIComponent(verificacaoSenha.codigo)}`);
      const dados = await resp.json();
      if (dados.verificado) {
        clearInterval(intervalo);
        setIdentidadeConfirmada(true);
      }
    }, 3000);
    return () => clearInterval(intervalo);
  }, [verificacaoSenha, identidadeConfirmada]);

  async function salvarNovaSenha() {
    setMensagemSenha(null);
    if (novaSenha.length < 8) { setMensagemSenha("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { setMensagemSenha("A confirmação não bate com a senha nova."); return; }
    setSalvandoSenha(true);
    const resp = await fetch("/api/painel/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metodo, taxaTipo, taxaValor, novaSenha, codigoVerificacao: verificacaoSenha?.codigo }),
    });
    const dados = await resp.json().catch(() => ({}));
    setSalvandoSenha(false);
    if (!resp.ok) { setMensagemSenha(dados.erro ?? "Não foi possível trocar a senha."); return; }
    setMensagemSenha("Senha trocada com sucesso.");
    setVerificacaoSenha(null); setIdentidadeConfirmada(false); setNovaSenha(""); setConfirmarSenha("");
  }

  async function salvar() {
    setMensagem(null);
    setSalvando(true);
    const resp = await fetch("/api/painel/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metodo,
        taxaTipo,
        taxaValor: parseFloat(taxaValor.replace(",", ".")) || 0,
        nomeNegocio: nomeNegocio || undefined,
        endereco: endereco || undefined,
        numeroEndereco,
        complementoEndereco,
        bairro,
        cidade: cidade || undefined,
        estado: estado || undefined,
        instagram,
        celular,
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    setSalvando(false);
    if (!resp.ok) { setMensagem(dados.erro ?? "Não foi possível salvar. Tente de novo."); return; }
    setMensagem("Configurações salvas.");
    setNovaSenha(""); setConfirmarSenha("");
  }

  async function iniciarExclusao() {
    setMensagemExclusao(null);
    const resp = await fetch("/api/painel/verificar-telefone", { method: "POST" });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) { setMensagemExclusao(dados.erro ?? "Não foi possível iniciar a verificação."); return; }
    setVerificacaoExclusao(dados);
    setIdentidadeExclusaoConfirmada(false);
  }

  useEffect(() => {
    if (!verificacaoExclusao || identidadeExclusaoConfirmada) return;
    const timer = setInterval(async () => {
      const r = await fetch(`/api/painel/verificar-telefone?codigo=${encodeURIComponent(verificacaoExclusao.codigo)}`);
      const d = await r.json().catch(() => ({}));
      if (d.verificado) { clearInterval(timer); setIdentidadeExclusaoConfirmada(true); }
    }, 3000);
    return () => clearInterval(timer);
  }, [verificacaoExclusao, identidadeExclusaoConfirmada]);

  async function excluirConta() {
    setMensagemExclusao(null);
    if (!identidadeExclusaoConfirmada) { setMensagemExclusao("Confirme sua identidade pelo WhatsApp primeiro."); return; }
    if (confirmacaoExclusao !== "EXCLUIR MINHA CONTA") { setMensagemExclusao("Digite exatamente EXCLUIR MINHA CONTA para continuar."); return; }
    setExcluindoConta(true);
    const resp = await fetch("/api/painel/excluir-conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmacao: confirmacaoExclusao, codigoVerificacao: verificacaoExclusao?.codigo }) });
    const dados = await resp.json().catch(() => ({}));
    setExcluindoConta(false);
    if (!resp.ok) { setMensagemExclusao(dados.erro ?? "Não foi possível excluir a conta."); return; }
    window.location.href = "/";
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-8 sm:space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="mt-1 text-ink/60">Dados do seu estabelecimento, organizados por assunto.</p>
      </div>

      <section>
        <h2 className="font-medium">Foto de perfil</h2>
        <p className="mt-1 text-sm text-ink/60">Aparece na sua página pública. Opcional.</p>
        <div className="mt-3">
          <UploadFoto
            fotoAtual={fotoUrl} endpoint="/api/painel/foto-perfil" rotulo="Foto"
            onEnviado={setFotoUrl}
          />
        </div>
        <div className="mt-3 rounded-lg border border-ink/10 bg-ink/[0.02] p-3 text-xs text-ink/60">
          <p className="font-medium text-ink/70">Pra encaixar certinho no círculo:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Imagem quadrada (largura igual à altura) — ex: 800×800px</li>
            <li>Deixe o conteúdo importante (logo, texto) dentro dos 85% centrais da imagem — as bordas ficam cortadas pelo círculo</li>
            <li>Fundo liso ou transparente funciona melhor que fundo com detalhes até a borda</li>
          </ul>
          <p className="mt-1.5 text-ink/50">
            Se for pedir pra um designer fazer, é só mandar essas 3 orientações pra ele.
          </p>
        </div>
      </section>

      <section>
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto border-b border-ink/10 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setAba("conta")}
            className={`shrink-0 whitespace-nowrap border-b-2 px-2 pb-2.5 text-sm font-medium ${aba === "conta" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
          >
            Conta
          </button>
          <button
            onClick={() => setAba("estabelecimento")}
            className={`shrink-0 whitespace-nowrap border-b-2 px-2 pb-2.5 text-sm font-medium ${aba === "estabelecimento" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
          >
            Estabelecimento
          </button>
          <button
            onClick={() => setAba("recebimento")}
            className={`shrink-0 whitespace-nowrap border-b-2 px-2 pb-2.5 text-sm font-medium ${aba === "recebimento" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
          >
            Como você recebe
          </button>
        </div>

        {aba === "conta" && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium">E-mail atual</label>
              <p className="mt-1 text-sm text-ink/60">{email}</p>
            </div>
            <div className="border-t border-ink/10 pt-4">
              <p className="text-sm font-medium">Trocar senha</p>
              <p className="mt-1 text-xs text-ink/50">
                Por segurança, primeiro confirmamos que é você pelo WhatsApp cadastrado, e só
                depois disso a senha nova pode ser definida.
              </p>

              {!verificacaoSenha && (
                <button onClick={pedirVerificacaoParaTrocarSenha} disabled={pedindoVerificacao}
                  className="mt-2 rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50">
                  {pedindoVerificacao ? "Gerando..." : "Verificar identidade por WhatsApp"}
                </button>
              )}

              {verificacaoSenha && !identidadeConfirmada && (
                <div className="mt-3 rounded-lg border border-ink/10 p-3">
                  <p className="text-sm">Toque no botão — vai abrir o WhatsApp com uma mensagem já escrita.</p>
                  <p className="mt-1 text-xs text-ink/50">Enviando do número {verificacaoSenha.telefoneMascarado}</p>
                  <a href={verificacaoSenha.linkWhatsapp} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">
                    Abrir WhatsApp e confirmar
                  </a>
                  <p className="mt-2 text-xs text-ink/40">Aguardando confirmação...</p>
                </div>
              )}

              {identidadeConfirmada && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-brand">✓ Identidade confirmada.</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <label className="text-xs text-ink/60">Nova senha</label>
                      <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
                        placeholder="Mínimo 8 caracteres" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-ink/60">Confirmar nova senha</label>
                      <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
                    </div>
                  </div>
                  <button onClick={salvarNovaSenha} disabled={salvandoSenha}
                    className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
                    {salvandoSenha ? "Salvando..." : "Salvar nova senha"}
                  </button>
                </div>
              )}

              {mensagemSenha && <p className="mt-2 text-sm text-ink/60">{mensagemSenha}</p>}
            </div>
          </div>
        )}

        {aba === "estabelecimento" && (
          <div className="mt-5 space-y-3">
            <div>
              <label className="text-sm font-medium">Nome do estabelecimento</label>
              <input value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Celular (WhatsApp)</label>
              <input value={celular} onChange={(e) => setCelular(e.target.value)}
                placeholder="(27) 99999-9999" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              <p className="mt-1 text-xs text-ink/50">Usado pra confirmar sua identidade por WhatsApp, na aba Conta.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Instagram (opcional)</label>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="seu_usuario" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              <p className="mt-1 text-xs text-ink/50">Aparece na sua página de agendamento. Sem o @.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-[3]">
                <label className="text-sm font-medium">Rua</label>
                <input value={endereco} onChange={(e) => setEndereco(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Número</label>
                <input value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-sm font-medium">Complemento (opcional)</label>
                <input value={complementoEndereco} onChange={(e) => setComplementoEndereco(e.target.value)}
                  placeholder="Sala, apto, etc." className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Bairro</label>
                <input value={bairro} onChange={(e) => setBairro(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-[3]">
                <label className="text-sm font-medium">Cidade</label>
                <input value={cidade} onChange={(e) => setCidade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Estado</label>
                <input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2}
                  placeholder="ES" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 uppercase" />
              </div>
            </div>
          </div>
        )}

        {aba === "recebimento" && (
          <div className="mt-5 min-w-0 space-y-3">
            <p className="text-sm text-ink/60">
              Pra receber Pix/cartão na hora de agendar, conecte sua própria conta em{" "}
              <a href="/painel/receber" className="text-brand underline">Receber pagamentos</a>.
            </p>
            <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-ink/10 p-3 sm:p-4 has-[:checked]:border-brand">
              <input type="radio" name="metodo" checked={metodo === "taxa_agendamento"}
                onChange={() => setMetodo("taxa_agendamento")} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Cobrar taxa de agendamento</span>
                <span className="block text-sm text-ink/60">
                  Cliente paga uma taxa (% ou valor fixo) pra reservar o horário. Essa taxa é
                  descontada do valor total do serviço — o cliente paga só a diferença no dia.
                </span>
                {metodo === "taxa_agendamento" && (
                  <span className="mt-3 flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center" onClick={(e) => e.preventDefault()}>
                    <select value={taxaTipo} onChange={(e) => setTaxaTipo(e.target.value as TaxaTipo)}
                      className="w-full min-w-0 rounded-lg border border-ink/15 px-2 py-2 text-sm sm:w-auto">
                      <option value="percentual">Percentual (%)</option>
                      <option value="fixo">Valor fixo (R$)</option>
                    </select>
                    <input value={taxaValor} onChange={(e) => setTaxaValor(e.target.value)}
                      placeholder={taxaTipo === "percentual" ? "20" : "30,00"}
                      className="w-full min-w-0 rounded-lg border border-ink/15 px-2 py-2 text-sm sm:w-28" />
                  </span>
                )}
              </span>
            </label>
            <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-ink/10 p-3 sm:p-4 has-[:checked]:border-brand">
              <input type="radio" name="metodo" checked={metodo === "pagamento_total"}
                onChange={() => setMetodo("pagamento_total")} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Cobrar o serviço inteiro antes de confirmar</span>
                <span className="block text-sm text-ink/60">Pix, crédito ou débito — no ato do agendamento.</span>
              </span>
            </label>
            <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-ink/10 p-3 sm:p-4 has-[:checked]:border-brand">
              <input type="radio" name="metodo" checked={metodo === "pos_servico"}
                onChange={() => setMetodo("pos_servico")} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Receber só depois do serviço concluído</span>
                <span className="block text-sm text-ink/60">Sem cobrança adiantada.</span>
              </span>
            </label>
          </div>
        )}
      </section>

      <div>
        <button
          onClick={salvar} disabled={salvando}
          className="rounded-lg bg-brand px-6 py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
        {mensagem && <p className="mt-2 text-sm text-ink/60">{mensagem}</p>}
      </div>

      <section className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/[0.03] p-5">
        <h2 className="font-semibold text-red-600">Excluir minha conta</h2>
        <p className="text-sm text-ink/70">Essa ação é irreversível. Seu perfil será desativado e anonimizado, e o acesso será bloqueado. Registros financeiros e históricos necessários poderão ser mantidos para obrigações legais e auditoria. Revise e resolva seus agendamentos e pagamentos pendentes antes de continuar.</p>
        {!verificacaoExclusao && <button onClick={iniciarExclusao} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10">Iniciar exclusão da conta</button>}
        {verificacaoExclusao && !identidadeExclusaoConfirmada && <div className="space-y-2 rounded-lg border border-ink/10 p-3">
          <p className="text-sm">Confirme pelo WhatsApp cadastrado ({verificacaoExclusao.telefoneMascarado}).</p>
          <a href={verificacaoExclusao.linkWhatsapp} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">Abrir WhatsApp e confirmar</a>
          <p className="text-xs text-ink/50">Aguardando confirmação…</p>
        </div>}
        {identidadeExclusaoConfirmada && <div className="space-y-3">
          <p className="text-sm font-medium text-green-700">Identidade confirmada. Para concluir, digite abaixo:</p>
          <input value={confirmacaoExclusao} onChange={e => setConfirmacaoExclusao(e.target.value)} placeholder="EXCLUIR MINHA CONTA" className="w-full rounded-lg border border-red-500/30 px-3 py-2" />
          <button onClick={excluirConta} disabled={excluindoConta || confirmacaoExclusao !== "EXCLUIR MINHA CONTA"} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{excluindoConta ? "Excluindo conta…" : "Confirmar exclusão definitiva"}</button>
        </div>}
        {mensagemExclusao && <p role="alert" className="text-sm text-red-600">{mensagemExclusao}</p>}
      </section>
    </div>
  );
}
