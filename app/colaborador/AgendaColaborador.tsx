"use client";
import { useEffect, useMemo, useState } from "react";
import { AvaliarClienteModal } from "@/components/AvaliarClienteModal";
import { AvaliacoesClienteModal } from "@/components/AvaliacoesClienteModal";
import { EstrelasExibicao } from "@/components/SeletorEstrelas";

type Agendamento = {
  id: string; inicio: string; fim: string; status: string; clienteId: string;
  servicos: { nome: string } | null;
  clientes: { nome: string; telefone: string | null } | null;
  reputacaoCliente: { media: number; quantidade: number } | null;
  jaAvaliado: boolean;
};

const ROTULO_STATUS: Record<string, string> = {
  pendente: "Aguardando confirmação", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AgendaColaborador() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [avaliados, setAvaliados] = useState<Set<string>>(new Set());
  const [verAvaliacoesDeCliente, setVerAvaliacoesDeCliente] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  async function carregar() {
    setErro(null);
    const resp = await fetch("/api/colaborador/agendamentos");
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro("Não foi possível carregar sua agenda.");
      setCarregando(false);
      return;
    }
    setAgendamentos(data.agendamentos ?? []);
    setAvaliados(new Set((data.agendamentos ?? []).filter((a: Agendamento) => a.jaAvaliado).map((a: Agendamento) => a.id)));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function bloquearCliente(clienteId: string) {
    if (!confirm("Bloquear esse cliente? Ele não vai mais conseguir agendar nesse estabelecimento.")) return;
    const resp = await fetch("/api/colaborador/clientes-bloqueados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    });
    if (resp.ok) alert("Cliente bloqueado.");
  }

  async function mudarStatus(id: string, status: "confirmado" | "concluido" | "cancelado") {
    await fetch("/api/colaborador/agendamentos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    carregar();
  }

  // O "próximo" é o pendente/confirmado mais próximo no futuro. "Resto
  // do dia" é tudo mais que acontece HOJE (não dias futuros). Histórico
  // é tudo já concluído, mais recente primeiro.
  const { proximo, restoDoDia, historico } = useMemo(() => {
    const agora = new Date();
    const futuros = agendamentos
      .filter((a) => (a.status === "pendente" || a.status === "confirmado") && new Date(a.inicio).getTime() > agora.getTime())
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    const proximoItem = futuros[0] ?? null;

    const restoDoDiaLista = agendamentos
      .filter((a) => a.id !== proximoItem?.id && (a.status === "pendente" || a.status === "confirmado") && mesmoDia(new Date(a.inicio), agora))
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    const historicoLista = agendamentos
      .filter((a) => a.status === "concluido")
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

    return { proximo: proximoItem, restoDoDia: restoDoDiaLista, historico: historicoLista };
  }, [agendamentos]);

  function Acoes({ a, destacado = false }: { a: Agendamento; destacado?: boolean }) {
    const corTexto = destacado ? "text-[var(--brand-fg)]" : "text-brand";
    const corCancelar = destacado ? "text-[var(--brand-fg)]" : "text-red-600";
    return (
      <div className={`mt-2 flex flex-wrap gap-3 pt-2 text-xs ${destacado ? "border-t border-white/20" : "border-t border-ink/5"}`}>
        {a.status === "pendente" && (
          <button onClick={() => mudarStatus(a.id, "confirmado")} className={`font-medium hover:underline ${corTexto}`}>
            Confirmar
          </button>
        )}
        {a.status === "confirmado" && new Date(a.inicio).getTime() < Date.now() && (
          <button onClick={() => mudarStatus(a.id, "concluido")} className={`font-medium hover:underline ${corTexto}`}>
            Marcar concluído
          </button>
        )}
        {a.status === "concluido" && !avaliados.has(a.id) && (
          <button onClick={() => setAvaliando(a.id)} className={`font-medium hover:underline ${corTexto}`}>
            Avaliar cliente
          </button>
        )}
        {a.status !== "concluido" && a.status !== "cancelado" && new Date(a.inicio).getTime() > Date.now() && (
          <button onClick={() => mudarStatus(a.id, "cancelado")} className={`hover:underline ${corCancelar}`}>
            Cancelar
          </button>
        )}
      </div>
    );
  }

  function Extras({ a, destacado = false }: { a: Agendamento; destacado?: boolean }) {
    const pill = destacado
      ? "bg-surface/15 text-[var(--brand-fg)] hover:bg-surface/25"
      : "bg-ink/5 text-ink/60 hover:bg-ink/10";
    const pillBloquear = destacado
      ? "bg-surface/15 text-[var(--brand-fg)] hover:bg-surface/25"
      : "bg-red-50 text-red-600 hover:bg-red-100";
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {a.clientes?.telefone && (
          <a
            href={`https://wa.me/${a.clientes.telefone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className={`rounded-lg px-2 py-1 text-xs ${pill}`}
          >
            📞
          </a>
        )}
        <button
          onClick={() => setVerAvaliacoesDeCliente(a.clienteId)}
          className={`rounded-lg px-2 py-1 text-xs ${pill}`}
        >
          <EstrelasExibicao media={a.reputacaoCliente?.media ?? 0} quantidade={a.reputacaoCliente?.quantidade ?? 0} />
        </button>
        <button
          onClick={() => bloquearCliente(a.clienteId)}
          className={`rounded-lg px-2 py-1 text-xs ${pillBloquear}`}
        >
          Bloquear
        </button>
      </div>
    );
  }

  if (carregando) return <p className="mt-8 text-sm text-ink/50">Carregando...</p>;
  if (erro) return <p className="mt-8 text-sm text-red-600">{erro}</p>;
  if (agendamentos.length === 0) return <p className="mt-8 text-sm text-ink/50">Nenhum atendimento na sua agenda ainda.</p>;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Seu próximo</p>
        <button onClick={() => setVerHistorico((v) => !v)} className="text-xs font-medium text-brand hover:underline">
          {verHistorico ? "Ver resto do dia" : "Histórico"}
        </button>
      </div>

      {proximo ? (
        <div className="mt-2 rounded-2xl bg-brand p-5 text-[var(--brand-fg)]">
          <p className="text-xs uppercase tracking-wide opacity-80">
            {new Date(proximo.inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {new Date(proximo.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 text-lg font-medium">{proximo.servicos?.nome}</p>
          <p className="text-sm opacity-90">{proximo.clientes?.nome}</p>
          <div className="mt-3">
            <Extras a={proximo} destacado />
            <Acoes a={proximo} destacado />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink/50">Nenhum atendimento futuro por enquanto.</p>
      )}

      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink/40">
        {verHistorico ? "Histórico" : "Resto do dia"}
      </p>
      <div className="space-y-2">
        {(verHistorico ? historico : restoDoDia).length === 0 && (
          <p className="text-sm text-ink/50">{verHistorico ? "Nenhum atendimento concluído ainda." : "Nada mais pra hoje."}</p>
        )}
        {(verHistorico ? historico : restoDoDia).map((a) => (
          <div key={a.id} className="rounded-xl2 border border-ink/10 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {new Date(a.inicio).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-ink/60">{a.servicos?.nome} <span className="text-ink/40">—</span> {a.clientes?.nome}</p>
              </div>
              <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/60">{ROTULO_STATUS[a.status] ?? a.status}</span>
            </div>
            <Extras a={a} />
            <Acoes a={a} />
          </div>
        ))}
      </div>

      {avaliando && (
        <AvaliarClienteModal
          agendamentoId={avaliando}
          endpoint="/api/colaborador/avaliar-cliente"
          onFechar={() => setAvaliando(null)}
          onEnviado={() => { setAvaliados((s) => new Set(s).add(avaliando)); setAvaliando(null); }}
        />
      )}

      {verAvaliacoesDeCliente && (
        <AvaliacoesClienteModal clienteId={verAvaliacoesDeCliente} onFechar={() => setVerAvaliacoesDeCliente(null)} />
      )}
    </div>
  );
}
