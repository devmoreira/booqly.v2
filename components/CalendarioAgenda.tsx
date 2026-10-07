"use client";
import { useMemo, useState } from "react";

type Agendamento = {
  id: string; inicio: string; fim: string; status: string;
  servicos: { nome: string } | null;
  clientes: { nome: string; telefone: string | null } | null;
  colaboradorId: string | null;
};
type Colaborador = { id: string; nome: string; almoco_inicio: string | null; almoco_fim: string | null };

const CORES_STATUS: Record<string, { bg: string; borda: string; texto: string }> = {
  pendente: { bg: "#FAECE7", borda: "#D85A30", texto: "#712B13" },
  confirmado: { bg: "#E1F5EE", borda: "#0F6E56", texto: "#085041" },
  concluido: { bg: "#E1F5EE", borda: "#0F6E56", texto: "#085041" },
  cancelado: { bg: "#F1EFE8", borda: "#B4B2A9", texto: "#5F5E5A" },
};

const HORA_INICIO = 8, HORA_FIM = 20; // faixa exibida no grid — cobre o horário comercial comum

export function CalendarioAgenda({
  agendamentos, colaboradores, profissionalId, onMudarStatus,
}: { agendamentos: Agendamento[]; colaboradores: Colaborador[]; profissionalId: string | null; onMudarStatus: (id: string, status: "confirmado" | "concluido" | "cancelado") => void }) {
  const [dia, setDia] = useState(new Date());
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null);

  // A coluna do "colaborador principal" (o próprio dono, criado
  // automaticamente no cadastro) já representa o dono — por isso não
  // existe mais uma coluna extra separada só pra ele.
  const colunas = useMemo(() => colaboradores.map((c) => ({ id: c.id, nome: c.nome })), [colaboradores]);

  const doDia = useMemo(() => {
    return agendamentos
      .filter((a) => new Date(a.inicio).toDateString() === dia.toDateString() && a.status !== "cancelado")
      .map((a) => ({ ...a, colaboradorId: a.colaboradorId ?? profissionalId }));
  }, [agendamentos, dia, profissionalId]);

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

  function posicaoNaHora(dataISO: string, hora: number) {
    const d = new Date(dataISO);
    return d.getHours() === hora;
  }

  function estaNoAlmoco(colaboradorId: string | null, hora: number) {
    const colab = colaboradores.find((c) => c.id === colaboradorId);
    if (!colab?.almoco_inicio || !colab?.almoco_fim) return false;
    const inicio = parseInt(colab.almoco_inicio.slice(0, 2), 10);
    const fim = parseInt(colab.almoco_fim.slice(0, 2), 10);
    return hora >= inicio && hora < fim;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <button onClick={() => setDia((d) => new Date(d.getTime() - 86_400_000))} className="text-ink/50 hover:text-ink">←</button>
        <span className="font-medium">{dia.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
        <button onClick={() => setDia((d) => new Date(d.getTime() + 86_400_000))} className="text-ink/50 hover:text-ink">→</button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `44px repeat(${colunas.length}, minmax(110px, 1fr))` }}>
          <div />
          {colunas.map((c) => (
            <div key={c.id ?? "voce"} className="pb-1.5 text-center text-xs font-medium">{c.nome}</div>
          ))}

          {horas.map((hora) => (
            <div key={hora} className="contents">
              <div className="pr-1 text-right text-xs text-ink/40">{hora}h</div>
              {colunas.map((c) => {
                const ag = doDia.find((a) => a.colaboradorId === c.id && posicaoNaHora(a.inicio, hora));
                const cor = ag ? CORES_STATUS[ag.status] ?? CORES_STATUS.pendente : null;
                if (ag && cor) {
                  return (
                    <button
                      key={c.id ?? "voce"} onClick={() => setSelecionado(ag)}
                      className="min-h-[32px] rounded p-1 text-left text-[11px] leading-tight"
                      style={{ background: cor.bg, borderLeft: `3px solid ${cor.borda}`, color: cor.texto }}
                    >
                      {ag.servicos?.nome ?? "Agendamento"}
                      {ag.clientes?.nome ? ` — ${ag.clientes.nome}` : ""}
                    </button>
                  );
                }
                if (estaNoAlmoco(c.id, hora)) {
                  return <div key={c.id ?? "voce"} className="min-h-[32px] rounded bg-ink/5 p-1 text-[10px] text-ink/40">Almoço</div>;
                }
                return <div key={c.id ?? "voce"} className="min-h-[32px] rounded bg-ink/[0.03]" />;
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-ink/60">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#D85A30" }} />Pendente</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#0F6E56" }} />Confirmado/concluído</span>
      </div>

      {selecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setSelecionado(null)}>
          <div className="w-full max-w-sm rounded-xl2 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium">{selecionado.servicos?.nome ?? "Agendamento"}</p>
            <p className="mt-1 text-sm text-ink/60">{selecionado.clientes?.nome}</p>
            <p className="mt-1 text-sm text-ink/60">
              {new Date(selecionado.inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
            <div className="mt-4 flex gap-3 text-sm">
              {selecionado.status === "pendente" && (
                <button onClick={() => { onMudarStatus(selecionado.id, "confirmado"); setSelecionado(null); }} className="font-medium text-brand hover:underline">
                  Confirmar
                </button>
              )}
              {selecionado.status === "confirmado" && (
                <button onClick={() => { onMudarStatus(selecionado.id, "concluido"); setSelecionado(null); }} className="font-medium text-brand hover:underline">
                  Marcar como concluído
                </button>
              )}
              {selecionado.status !== "cancelado" && selecionado.status !== "concluido" && (
                <button onClick={() => { onMudarStatus(selecionado.id, "cancelado"); setSelecionado(null); }} className="text-red-600 hover:underline">
                  Cancelar
                </button>
              )}
              <button onClick={() => setSelecionado(null)} className="text-ink/50 hover:underline">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
