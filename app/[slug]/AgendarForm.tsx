"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatarTelefoneParaExibicao, telefoneParaE164 } from "@/lib/telefone";

// O telefone que vem do banco (clienteLogado) já está em +55DDDNUMERO —
// diferente do que a pessoa digita na hora (só DDD+número). Precisa
// tirar o "+55" ANTES de formatar pra exibição, senão o código do
// país vira DDD por engano e corrompe o número de verdade.
function telefoneE164ParaExibicao(e164: string): string {
  const digitos = e164.replace(/^\+55/, "").replace(/\D/g, "");
  return formatarTelefoneParaExibicao(digitos);
}

type Servico = { id: string; nome: string; duracao_minutos: number; preco_centavos: number };
type Colaborador = { id: string; nome: string };
type EstadoTela = "formulario" | "aguardando_pagamento" | "pix_expirado" | "sucesso" | "erro";

function formatarContador(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AgendarForm({
  profissionalId, slug, servicos, colaboradores,
  metodoCobranca, pagamentoDisponivel, aceitaPix, aceitaCredito, aceitaDebito, cuponsAtivos = true,
  clienteLogado = null,
}: {
  profissionalId: string; slug: string; servicos: Servico[]; colaboradores: Colaborador[];
  metodoCobranca: "taxa_agendamento" | "pagamento_total" | "pos_servico";
  pagamentoDisponivel: boolean; aceitaPix: boolean; aceitaCredito: boolean; aceitaDebito: boolean;
  cuponsAtivos?: boolean;
  clienteLogado?: { nome: string; telefone: string; documento: string | null } | null;
}) {
  const router = useRouter();

  const exigePagamento = metodoCobranca !== "pos_servico" && pagamentoDisponivel;

  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [colaboradorId, setColaboradorId] = useState("");
  const [data, setData] = useState("");
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [bloqueiosDoDia, setBloqueiosDoDia] = useState<{ inicio: string; fim: string; motivo: string | null }[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "credito" | "debito">(
    aceitaPix ? "pix" : aceitaCredito ? "credito" : "debito"
  );
  const [nomeCliente, setNomeCliente] = useState(clienteLogado?.nome ?? "");
  const [telefoneCliente, setTelefoneCliente] = useState(clienteLogado ? telefoneE164ParaExibicao(clienteLogado.telefone) : "");
  const [documentoCliente, setDocumentoCliente] = useState(clienteLogado?.documento ?? "");
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [saldoIndicacaoCentavos, setSaldoIndicacaoCentavos] = useState(0);
  const [usarSaldoIndicacao, setUsarSaldoIndicacao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<EstadoTela>("formulario");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<{ qrCodePix?: string; qrCodeImagemBase64?: string; linkPagamento?: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [statusAgendamentoFinal, setStatusAgendamentoFinal] = useState<string | null>(null);
  const [descontoAplicadoCentavos, setDescontoAplicadoCentavos] = useState(0);
  const [escolhendoServico, setEscolhendoServico] = useState(false);

  // Contador do Pix
  const [expiraEmCheckout, setExpiraEmCheckout] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  const intervaloPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervaloContadorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!clienteLogado) return;
    fetch("/api/cliente/indicacao-dinheiro").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.saldoCentavos > 0) setSaldoIndicacaoCentavos(d.saldoCentavos);
    });
  }, [clienteLogado]);

  useEffect(() => {
    setHoraEscolhida("");
    setHorariosDisponiveis([]);
    setBloqueiosDoDia([]);
    if (!data || !servicoId) return;
    setCarregandoHorarios(true);
    const params = new URLSearchParams({ profissionalId, servicoId, data });
    if (colaboradorId) params.set("colaboradorId", colaboradorId);
    fetch(`/api/disponibilidade?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setHorariosDisponiveis(d.horarios ?? []);
        setBloqueiosDoDia(d.bloqueios ?? []);
      })
      .finally(() => setCarregandoHorarios(false));
  }, [data, servicoId, colaboradorId, profissionalId]);

  // Some com os intervalos se o componente desmontar no meio do caminho
  useEffect(() => () => {
    if (intervaloPollRef.current) clearInterval(intervaloPollRef.current);
    if (intervaloContadorRef.current) clearInterval(intervaloContadorRef.current);
  }, []);

  // Depois que o agendamento é confirmado (com ou sem pagamento), manda
  // o cliente pra área dele automaticamente, depois de alguns segundos.
  function agendarRedirecionamentoParaPerfil() {
    setTimeout(() => router.push("/cliente"), 6000);
  }

  function limparIntervalos() {
    if (intervaloPollRef.current) clearInterval(intervaloPollRef.current);
    if (intervaloContadorRef.current) clearInterval(intervaloContadorRef.current);
  }

  function iniciarChecagemPagamento(checkoutId: string) {
    intervaloPollRef.current = setInterval(async () => {
      const resp = await fetch(`/api/checkout-status?id=${checkoutId}`);
      const dados = await resp.json();
      if (dados.status === "pago") {
        limparIntervalos();
        setStatusAgendamentoFinal(dados.statusAgendamento);
        setEstado("sucesso");
        agendarRedirecionamentoParaPerfil();
      } else if (dados.status === "falhou") {
        limparIntervalos();
        setMensagemErro("O pagamento falhou. Tente agendar de novo.");
        setEstado("erro");
      }
      // "expirado" é tratado pelo contador local (mesmo horário exato do servidor) — não precisa duplicar aqui
    }, 4000);
  }

  // Conta o tempo até o Pix expirar. Quando chega em zero, o
  // agendamento é cancelado e o cliente precisa fazer um novo, do zero.
  function iniciarContadorExpiracao(expiraEm: string) {
    setExpiraEmCheckout(expiraEm);
    intervaloContadorRef.current = setInterval(() => {
      const restante = Math.round((new Date(expiraEm).getTime() - Date.now()) / 1000);
      if (restante <= 0) {
        limparIntervalos();
        setEstado("pix_expirado");
      } else {
        setSegundosRestantes(restante);
      }
    }, 1000);
  }

  function comecarNovoAgendamento() {
    limparIntervalos();
    setEstado("formulario");
    setPagamento(null);
    setExpiraEmCheckout(null);
    setMensagemErro(null);
  }

  async function enviarAgendamento() {
    if (!horaEscolhida) { setMensagemErro("Escolha um horário."); setEstado("erro"); return; }
    const telefoneValido = telefoneParaE164(telefoneCliente);
    if (!telefoneValido) {
      setMensagemErro("Telefone incompleto — digite o DDD e o número todo.");
      setEstado("erro");
      return;
    }
    setEnviando(true);
    limparIntervalos();

    const inicio = new Date(`${data}T${horaEscolhida}:00`);

    const resp = await fetch("/api/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profissionalId,
        servicoId,
        colaboradorId: colaboradorId || undefined,
        inicio: inicio.toISOString(),
        formaPagamento: exigePagamento ? formaPagamento : undefined,
        cupomCodigo: exigePagamento && cupomCodigo ? cupomCodigo : undefined,
        usarSaldoIndicacao: exigePagamento && usarSaldoIndicacao ? true : undefined,
        cliente: { nome: nomeCliente, telefone: telefoneValido, documento: exigePagamento ? documentoCliente : undefined },
      }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const corpo = await resp.json().catch(() => ({}));
      setMensagemErro(corpo.erro ?? "Não foi possível agendar.");
      setEstado("erro");
      return;
    }
    const dados = await resp.json();

    if (dados.checkoutId) {
      // Precisa pagar antes do agendamento nascer — mostra o QR/link,
      // fica checando se já pagou, e conta o tempo até expirar.
      setPagamento(dados.pagamento);
      setDescontoAplicadoCentavos(dados.descontoCentavos ?? 0);
      setEstado("aguardando_pagamento");
      iniciarChecagemPagamento(dados.checkoutId);
      if (dados.expiraEm) iniciarContadorExpiracao(dados.expiraEm);
      return;
    }

    // Sem pagamento exigido — o agendamento já nasceu direto.
    if (dados.aviso) setAviso(dados.aviso);
    setStatusAgendamentoFinal(dados.statusAgendamento);
    setEstado("sucesso");
    agendarRedirecionamentoParaPerfil();
  }

  async function aoSubmeterForm(e: React.FormEvent) {
    e.preventDefault();
    setEstado("formulario");
    await enviarAgendamento();
  }

  if (estado === "erro") {
    return (
      <div className="mt-8 rounded-xl2 border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">{mensagemErro}</p>
        <button onClick={() => setEstado("formulario")} className="mt-3 text-sm font-medium text-ink underline">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (estado === "pix_expirado") {
    return (
      <div className="mt-8 rounded-xl2 border border-ink/10 bg-ink/5 p-6 text-center">
        <p className="font-medium">O prazo para pagamento via Pix expirou.</p>
        <p className="mt-2 text-sm text-ink/70">
          Como o pagamento não foi confirmado dentro do prazo estabelecido, o horário
          reservado foi automaticamente cancelado. Para garantir seu atendimento, por
          favor, realize um novo agendamento.
        </p>
        <button
          onClick={comecarNovoAgendamento}
          className="mt-4 rounded-lg bg-brand px-6 py-2.5 font-medium text-[var(--brand-fg)]"
        >
          Fazer novo agendamento
        </button>
      </div>
    );
  }

  if (estado === "aguardando_pagamento") {
    return (
      <div className="mt-8 space-y-4">
        {descontoAplicadoCentavos > 0 && (
          <div className="rounded-lg bg-brand/10 p-3 text-center text-sm font-medium text-brand">
            🎉 Cupom aplicado! Desconto de {(descontoAplicadoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        )}
        {pagamento?.qrCodeImagemBase64 && (
          <div className="rounded-xl2 border border-ink/10 p-6 text-center">
            <p className="font-medium">Pague com Pix pra confirmar seu agendamento</p>
            <p className="mt-1 text-sm font-medium text-brand">Expira em {formatarContador(segundosRestantes)}</p>
            <p className="mt-1 text-xs text-ink/50">O horário fica reservado só pra você enquanto o contador não zera.</p>
            <img
              src={`data:image/png;base64,${pagamento.qrCodeImagemBase64}`}
              alt="QR code do Pix" className="mx-auto mt-3 h-48 w-48"
            />
            {pagamento.qrCodePix && (
              <div className="mt-3 flex gap-2">
                <input readOnly value={pagamento.qrCodePix} className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-xs" />
                <button
                  onClick={() => navigator.clipboard.writeText(pagamento.qrCodePix!)}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-[var(--brand-fg)]"
                >
                  Copiar
                </button>
              </div>
            )}
            <p className="mt-4 text-sm text-ink/60">Assim que o pagamento confirmar, essa tela atualiza sozinha.</p>
            <p className="mt-2 text-xs text-ink/40">Pagamento processado com segurança pelo Asaas.</p>
          </div>
        )}

        {pagamento?.linkPagamento && !pagamento.qrCodeImagemBase64 && (
          <div className="rounded-xl2 border border-ink/10 p-6 text-center">
            <p className="font-medium">Falta pagar pra confirmar seu agendamento</p>
            <p className="mt-1 text-sm font-medium text-brand">Expira em {formatarContador(segundosRestantes)}</p>
            <a
              href={pagamento.linkPagamento} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-brand px-6 py-2.5 font-medium text-[var(--brand-fg)]"
            >
              Ir para o pagamento
            </a>
            <p className="mt-4 text-sm text-ink/60">Depois de pagar, volte pra essa aba — ela atualiza sozinha.</p>
            <p className="mt-2 text-xs text-ink/40">Pagamento processado com segurança pelo Asaas.</p>
          </div>
        )}
      </div>
    );
  }

  if (estado === "sucesso") {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-xl2 border border-brand bg-brand/10 p-6 text-center">
          <p className="font-medium">
            {statusAgendamentoFinal === "confirmado" ? "Agendamento confirmado!" : "Agendamento enviado!"}
          </p>
          {statusAgendamentoFinal !== "confirmado" && (
            <p className="mt-1 text-sm text-ink/60">O estabelecimento vai confirmar seu horário em breve.</p>
          )}
          <p className="mt-2 text-xs text-ink/50">Levando você pro seu perfil...</p>
        </div>

        {aviso && (
          <div className="rounded-xl2 border border-ink/10 bg-ink/5 p-4 text-center text-sm text-ink/70">
            {aviso}
          </div>
        )}
      </div>
    );
  }

  const servicoSelecionado = servicos.find((s) => s.id === servicoId);

  return (
    <form onSubmit={aoSubmeterForm} className="mt-8 space-y-4">
      <div>
        <label className="text-sm font-medium">Serviço</label>
        <button
          type="button" onClick={() => setEscolhendoServico(true)}
          className="mt-2 flex w-full items-center justify-between rounded-xl2 border border-ink/15 p-4 text-left transition hover:border-brand"
        >
          {servicoSelecionado ? (
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="text-sm font-medium">{servicoSelecionado.nome}</p>
                <p className="text-xs text-ink/50">{servicoSelecionado.duracao_minutos} min · R$ {(servicoSelecionado.preco_centavos / 100).toFixed(2)}</p>
              </div>
              <span className="text-xs font-medium text-brand">Trocar</span>
            </div>
          ) : (
            <span className="text-sm text-ink/50">💈 Toque pra escolher o serviço</span>
          )}
        </button>

        {escolhendoServico && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEscolhendoServico(false)}>
            <div
              className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-bold">Escolha um serviço</p>
                <button type="button" onClick={() => setEscolhendoServico(false)} className="text-ink/40 hover:text-ink">✕</button>
              </div>
              <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
                {servicos.map((s) => (
                  <button
                    type="button" key={s.id}
                    onClick={() => { setServicoId(s.id); setEscolhendoServico(false); }}
                    className={`flex w-full items-center justify-between rounded-xl2 border p-4 text-left transition ${
                      servicoId === s.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-ink/15 hover:border-brand/50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{s.nome}</p>
                      <p className="text-xs text-ink/50">{s.duracao_minutos} min</p>
                    </div>
                    <p className="text-sm font-medium text-brand">R$ {(s.preco_centavos / 100).toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {colaboradores.length > 0 && (
        <div>
          <label className="text-sm font-medium">Com quem você quer ser atendido?</label>
          <select required value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2">
            <option value="" disabled>Escolha um profissional</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-sm font-medium">Data</label>
        <input required type="date" min={new Date().toISOString().slice(0, 10)} value={data}
          onChange={(e) => setData(e.target.value)}
          className="mt-1 w-full min-w-0 rounded-lg border border-ink/15 px-3 py-2" />
      </div>

      {data && (
        <div>
          <label className="text-sm font-medium">Horário</label>
          {carregandoHorarios && <p className="mt-1 text-sm text-ink/50">Carregando horários...</p>}
          {!carregandoHorarios && horariosDisponiveis.length === 0 && (
            <p className="mt-1 text-sm text-ink/50">Nenhum horário disponível nesse dia.</p>
          )}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {horariosDisponiveis.map((h) => (
              <button
                type="button" key={h} onClick={() => setHoraEscolhida(h)}
                className={`rounded-lg border py-2 text-sm ${horaEscolhida === h ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}
              >
                {h}
              </button>
            ))}
          </div>
          {bloqueiosDoDia.length > 0 && (
            <div className="mt-2 space-y-1">
              {bloqueiosDoDia.map((b, i) => (
                <p key={i} className="text-xs text-ink/50">
                  Indisponível {b.inicio}–{b.fim}{b.motivo ? ` (${b.motivo})` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {clienteLogado ? (
        <div className="rounded-lg bg-ink/5 p-3 text-sm">
          Agendando como <strong>{clienteLogado.nome}</strong> ·{" "}
          <a href={`tel:${telefoneCliente}`} className="text-ink/70">{telefoneCliente}</a>
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium">Seu nome</label>
            <input required value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <input required type="tel" value={telefoneCliente}
              onChange={(e) => setTelefoneCliente(formatarTelefoneParaExibicao(e.target.value))}
              placeholder="(27) 99999-9999"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
            <p className="mt-1 text-xs text-ink/50">Usado pra você acessar a Área do cliente depois</p>
          </div>
        </>
      )}

      {exigePagamento && !(clienteLogado && clienteLogado.documento) && (
        <div>
          <label className="text-sm font-medium">CPF ou CNPJ</label>
          <input required inputMode="numeric" value={documentoCliente}
            onChange={(e) => setDocumentoCliente(e.target.value.replace(/\D/g, ""))}
            placeholder="Necessário pra gerar o pagamento"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          <p className="mt-1 text-xs text-ink/50">
            Se esse telefone já tiver um cadastro, o nome e o CPF precisam ser os mesmos de antes.
          </p>
        </div>
      )}

      {exigePagamento && cuponsAtivos && (
        <div>
          <label className="text-sm font-medium">Cupom de desconto (opcional)</label>
          <input value={cupomCodigo} onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
            placeholder="Ex: BEMVINDO10"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 uppercase" />
        </div>
      )}

      {exigePagamento && saldoIndicacaoCentavos > 0 && (
        <label className="flex items-center gap-2 rounded-lg border border-ink/15 p-3 text-sm">
          <input type="checkbox" checked={usarSaldoIndicacao} onChange={(e) => setUsarSaldoIndicacao(e.target.checked)} />
          Usar meu saldo de indique e ganhe ({(saldoIndicacaoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} disponível)
        </label>
      )}

      {exigePagamento && (
        <div>
          <label className="text-sm font-medium">
            {metodoCobranca === "taxa_agendamento" ? "Como prefere pagar a taxa de agendamento?" : "Como prefere pagar?"}
          </label>
          <div className="mt-2 flex gap-2">
            {aceitaPix && (
              <button type="button" onClick={() => setFormaPagamento("pix")}
                className={`flex-1 rounded-lg border py-2 text-sm ${formaPagamento === "pix" ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
                Pix
              </button>
            )}
            {aceitaCredito && (
              <button type="button" onClick={() => setFormaPagamento("credito")}
                className={`flex-1 rounded-lg border py-2 text-sm ${formaPagamento === "credito" ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
                Crédito
              </button>
            )}
            {aceitaDebito && (
              <button type="button" onClick={() => setFormaPagamento("debito")}
                className={`flex-1 rounded-lg border py-2 text-sm ${formaPagamento === "debito" ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
                Débito
              </button>
            )}
          </div>
        </div>
      )}

      {mensagemErro && estado === "formulario" && <p className="text-sm text-red-600">{mensagemErro}</p>}
      <button disabled={enviando || !horaEscolhida || (colaboradores.length > 0 && !colaboradorId)} className="w-full rounded-lg bg-brand py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60">
        {enviando ? "Agendando..." : exigePagamento ? "Agendar e pagar" : "Agendar"}
      </button>
    </form>
  );
}
