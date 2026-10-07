"use client";
import { useEffect, useMemo, useState } from "react";
import { AvaliarClienteModal } from "@/components/AvaliarClienteModal";
import { AvaliacoesClienteModal } from "@/components/AvaliacoesClienteModal";
import { EstrelasExibicao } from "@/components/SeletorEstrelas";
import { CompartilharHorariosHoje } from "@/components/CompartilharHorariosHoje";
import { CalendarioAgenda } from "@/components/CalendarioAgenda";

type Perfil = { id: string; nomeNegocio: string; fotoUrl: string | null; slug: string };
type Colaborador = { id: string; nome: string; almoco_inicio: string | null; almoco_fim: string | null };

type Agendamento = {
  id: string; inicio: string; fim: string; status: string; clienteId: string;
  servicos: { nome: string } | null;
  clientes: { nome: string; telefone: string | null } | null;
  colaboradorId: string | null;
  colaboradores: { nome: string } | null;
  reputacaoCliente: { media: number; quantidade: number } | null;
  jaAvaliado: boolean;
};

type Aba = "pendente" | "confirmado" | "concluido" | "cancelado";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Aguardando" },
  { valor: "confirmado", rotulo: "Confirmados" },
  { valor: "concluido", rotulo: "Concluídos" },
  { valor: "cancelado", rotulo: "Cancelados" },
];

function cabecalhoDoDia(dataISO: string): string {
  const data = new Date(dataISO);
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  const mesmoData = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mesmoData(data, hoje)) return "Hoje";
  if (mesmoData(data, amanha)) return "Amanhã";
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("pendente");
  const [limiteHorasRemarcar, setLimiteHorasRemarcar] = useState(2);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [visualizacao, setVisualizacao] = useState<"lista" | "calendario">("lista");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => setLimiteHorasRemarcar(d.limiteHorasRemarcar ?? 2));
    fetch("/api/painel/configuracoes").then((r) => r.json()).then((d) => setPerfil({ id: d.id, nomeNegocio: d.nomeNegocio, fotoUrl: d.fotoUrl, slug: d.slug }));
    fetch("/api/colaboradores").then((r) => r.json()).then((d) => setColaboradores((d.colaboradores ?? []).filter((c: any) => c.ativo)));
  }, []);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [avaliados, setAvaliados] = useState<Set<string>>(new Set());
  const [verAvaliacoesDeCliente, setVerAvaliacoesDeCliente] = useState<string | null>(null);
  const [remarcando, setRemarcando] = useState<string | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  async function remarcar(id: string) {
    if (!novaData || !novaHora) return;
    await fetch("/api/painel/agendamentos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, novoInicio: new Date(`${novaData}T${novaHora}:00`).toISOString() }),
    });
    setRemarcando(null);
    carregar();
  }

  async function carregar() {
    setErro(null);
    const resp = await fetch("/api/painel/agendamentos");
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(data.erro === "não autorizado" ? "Sua sessão expirou — atualize a página e entre de novo." : "Não foi possível carregar os agendamentos.");
      setCarregando(false);
      return;
    }
    setAgendamentos(data.agendamentos ?? []);
    setAvaliados(new Set((data.agendamentos ?? []).filter((a: Agendamento) => a.jaAvaliado).map((a: Agendamento) => a.id)));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function bloquearCliente(clienteId: string) {
    if (!confirm("Bloquear esse cliente? Ele não vai mais conseguir agendar nesse estabelecimento (com você ou qualquer colaborador).")) return;
    const resp = await fetch("/api/painel/clientes-bloqueados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    });
    if (resp.ok) alert("Cliente bloqueado.");
  }

  async function mudarStatus(id: string, status: "confirmado" | "concluido" | "cancelado") {
    await fetch("/api/painel/agendamentos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    carregar();
  }

  const contagens = useMemo(() => {
    const mapa: Record<Aba, number> = { pendente: 0, confirmado: 0, concluido: 0, cancelado: 0 };
    for (const a of agendamentos) if (a.status in mapa) mapa[a.status as Aba]++;
    return mapa;
  }, [agendamentos]);

  const gruposPorDia = useMemo(() => {
    const filtrados = agendamentos
      .filter((a) => a.status === aba)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    const grupos = new Map<string, Agendamento[]>();
    for (const a of filtrados) {
      const chave = new Date(a.inicio).toDateString();
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(a);
    }
    return [...grupos.entries()];
  }, [agendamentos, aba]);

  return (
    <div className={visualizacao === "calendario" ? "booqly-agenda-page max-w-5xl space-y-6" : "booqly-agenda-page max-w-4xl space-y-6"}>
      <div className="booqly-agenda-heading flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Agenda</h1>
          <p className="mt-1 text-ink/60">Seus agendamentos, organizados por status e por dia.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {perfil && <CompartilharHorariosHoje nomeNegocio={perfil.nomeNegocio} fotoUrl={perfil.fotoUrl} slug={perfil.slug} />}
          <div className="booqly-view-toggle flex overflow-hidden rounded-xl border border-ink/10 text-xs font-semibold">
            <button onClick={() => setVisualizacao("lista")} className={`px-3 py-1.5 ${visualizacao === "lista" ? "bg-brand text-[var(--brand-fg)]" : "text-ink/60"}`}>
              Lista
            </button>
            <button onClick={() => setVisualizacao("calendario")} className={`px-3 py-1.5 ${visualizacao === "calendario" ? "bg-brand text-[var(--brand-fg)]" : "text-ink/60"}`}>
              Calendário
            </button>
          </div>
        </div>
      </div>

      {visualizacao === "calendario" ? (
        <CalendarioAgenda agendamentos={agendamentos} colaboradores={colaboradores} profissionalId={perfil?.id ?? null} onMudarStatus={mudarStatus} />
      ) : (
        <>
      <div className="booqly-agenda-tabs flex flex-wrap gap-x-3 gap-y-1 border-b border-ink/10">
        {ABAS.map((item) => (
          <button
            key={item.valor} onClick={() => setAba(item.valor)}
            className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
              aba === item.valor ? "border-brand text-ink" : "border-transparent text-ink/50"
            }`}
          >
            {item.rotulo} ({contagens[item.valor]})
          </button>
        ))}
      </div>

      {carregando && <p className="text-sm text-ink/50">Carregando...</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {!carregando && !erro && gruposPorDia.length === 0 && (
        <p className="text-sm text-ink/50">Nada por aqui nesse status.</p>
      )}

      <div className="space-y-5">
        {gruposPorDia.map(([diaChave, itensDoDia]) => (
          <div key={diaChave}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
              {cabecalhoDoDia(itensDoDia[0].inicio)}
            </p>
            <div className="space-y-2">
              {itensDoDia.map((a) => (
                <div key={a.id} className="booqly-appointment-card rounded-2xl border border-ink/10 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-0.5 truncate text-ink/70">
                        {a.servicos?.nome}
                        {a.colaboradores ? ` (${a.colaboradores.nome})` : ""} <span className="text-ink/40">—</span> {a.clientes?.nome}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {a.clientes?.telefone && (
                      <a
                        href={`https://wa.me/${a.clientes.telefone.replace(/\D/g, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs text-ink/60 hover:bg-ink/10"
                      >
                        📞 {a.clientes.telefone}
                      </a>
                    )}
                    <button
                      onClick={() => setVerAvaliacoesDeCliente(a.clienteId)}
                      className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs text-ink/60 hover:bg-ink/10"
                    >
                      <EstrelasExibicao media={a.reputacaoCliente?.media ?? 0} quantidade={a.reputacaoCliente?.quantidade ?? 0} />
                    </button>
                    <button
                      onClick={() => bloquearCliente(a.clienteId)}
                      className="rounded-lg bg-red-50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      Bloquear cliente
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 border-t border-ink/5 pt-3 text-xs">
                    {a.status === "pendente" && (
                      <button onClick={() => mudarStatus(a.id, "confirmado")} className="font-medium text-brand hover:underline">
                        Confirmar
                      </button>
                    )}
                    {a.status === "confirmado" && new Date(a.inicio).getTime() < Date.now() && (
                      <button onClick={() => mudarStatus(a.id, "concluido")} className="font-medium text-brand hover:underline">
                        Marcar como concluído
                      </button>
                    )}
                    {a.status === "concluido" && !avaliados.has(a.id) && (
                      <button onClick={() => setAvaliando(a.id)} className="font-medium text-brand hover:underline">
                        Avaliar cliente
                      </button>
                    )}
                    {a.status !== "concluido" && a.status !== "cancelado" && new Date(a.inicio).getTime() - Date.now() > limiteHorasRemarcar * 3_600_000 && (
                      <button onClick={() => setRemarcando(remarcando === a.id ? null : a.id)} className="font-medium text-brand hover:underline">
                        Remarcar
                      </button>
                    )}
                    {a.status !== "concluido" && a.status !== "cancelado" && new Date(a.inicio).getTime() > Date.now() && (
                      <button onClick={() => mudarStatus(a.id, "cancelado")} className="text-red-600 hover:underline">
                        Cancelar
                      </button>
                    )}
                  </div>

                  {remarcando === a.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-3">
                      <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)}
                        className="rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                      <input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)}
                        className="rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                      <button onClick={() => remarcar(a.id)} disabled={!novaData || !novaHora}
                        className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-50">
                        Confirmar novo horário
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {avaliando && (
        <AvaliarClienteModal
          agendamentoId={avaliando}
          endpoint="/api/painel/avaliar-cliente"
          onFechar={() => setAvaliando(null)}
          onEnviado={() => { setAvaliados((s) => new Set(s).add(avaliando)); setAvaliando(null); }}
        />
      )}
        </>
      )}

      {verAvaliacoesDeCliente && (
        <AvaliacoesClienteModal clienteId={verAvaliacoesDeCliente} onFechar={() => setVerAvaliacoesDeCliente(null)} />
      )}
    </div>
  );
}
