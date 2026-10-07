"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RemarcarModal } from "./RemarcarModal";
import { AvaliarEstabelecimentoModal } from "@/components/AvaliarEstabelecimentoModal";

const ROTULO_STATUS: Record<string, string> = {
  pendente: "Aguardando confirmação", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};

type Item = {
  id: string; inicio: string; status: string;
  profissionalId: string; servicoId: string; colaboradorId: string | null;
  nomeNegocio: string; fotoEstabelecimento: string | null; slugEstabelecimento: string; nomeServico: string;
  nomeAtendente: string; fotoAtendente: string | null; jaAvaliado: boolean;
};

function Avatar({ nome, foto, cor }: { nome: string; foto: string | null; cor: string }) {
  if (foto) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink/5">
        <img src={foto} alt={nome} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-white"
      style={{ backgroundColor: cor }}
    >
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

export function ListaAgendamentos({ itens }: { itens: Item[] }) {
  const [remarcando, setRemarcando] = useState<Item | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [limiteHorasRemarcar, setLimiteHorasRemarcar] = useState(2);

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => setLimiteHorasRemarcar(d.limiteHorasRemarcar ?? 2));
  }, []);
  const [avaliando, setAvaliando] = useState<Item | null>(null);
  const [avaliados, setAvaliados] = useState<Set<string>>(
    new Set(itens.filter((i) => i.jaAvaliado).map((i) => i.id))
  );

  async function cancelar(id: string) {
    if (!confirm("Tem certeza que quer cancelar esse agendamento?")) return;
    setCancelando(id);
    await fetch("/api/cliente/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agendamentoId: id }),
    });
    setCancelando(null);
    window.location.reload();
  }

  // O "próximo horário" é o item pendente/confirmado mais próximo no
  // futuro — vira um cartão de destaque separado do resto da lista.
  const { proximo, resto } = useMemo(() => {
    const futuros = itens
      .filter((i) => (i.status === "pendente" || i.status === "confirmado") && new Date(i.inicio).getTime() > Date.now())
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    const proximoItem = futuros[0] ?? null;
    return { proximo: proximoItem, resto: itens.filter((i) => i.id !== proximoItem?.id) };
  }, [itens]);

  function renderAcoes(a: Item) {
    const podeRemarcar =
      (a.status === "pendente" || a.status === "confirmado") &&
      new Date(a.inicio).getTime() - Date.now() > limiteHorasRemarcar * 3_600_000;
    const podeAvaliar = a.status === "concluido" && !avaliados.has(a.id);
    if (!podeRemarcar && !podeAvaliar) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-3">
        {podeRemarcar && (
          <>
            <button onClick={() => setRemarcando(a)} className="text-xs font-medium hover:underline">
              Remarcar horário
            </button>
            <button
              onClick={() => cancelar(a.id)} disabled={cancelando === a.id}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
            >
              {cancelando === a.id ? "Cancelando..." : "Cancelar"}
            </button>
          </>
        )}
        {podeAvaliar && (
          <button onClick={() => setAvaliando(a)} className="text-xs font-medium text-brand hover:underline">
            Avaliar estabelecimento
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {itens.length === 0 && <p className="text-sm text-ink/50">Nenhum agendamento ainda.</p>}

      {proximo && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/40">Seu próximo horário</p>
          <div className="rounded-2xl bg-brand p-5 text-[var(--brand-fg)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide opacity-80">
                  {new Date(proximo.inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {new Date(proximo.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="mt-1 truncate text-lg font-medium">{proximo.nomeServico}</p>
                {proximo.slugEstabelecimento ? (
                  <Link href={`/${proximo.slugEstabelecimento}`} className="text-sm opacity-90 hover:underline">
                    {proximo.nomeNegocio}
                  </Link>
                ) : (
                  <p className="text-sm opacity-90">{proximo.nomeNegocio}</p>
                )}
                {proximo.nomeAtendente && proximo.nomeAtendente !== proximo.nomeNegocio && (
                  <p className="text-xs opacity-75">Atendido por {proximo.nomeAtendente}</p>
                )}
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface/20 text-base font-medium">
                {proximo.fotoEstabelecimento
                  ? <img src={proximo.fotoEstabelecimento} alt={proximo.nomeNegocio} className="h-full w-full object-cover" />
                  : proximo.nomeNegocio.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="mt-3">
              <span className="rounded-lg bg-surface/15 px-3 py-1 text-xs font-medium">
                {ROTULO_STATUS[proximo.status]}
              </span>
            </div>
            <div className="mt-3 [&_button]:text-[var(--brand-fg)] [&_button]:opacity-90 [&_button:hover]:opacity-100 [&_button]:hover:underline">
              {renderAcoes(proximo)}
            </div>
          </div>
        </div>
      )}

      {resto.length > 0 && (
        <div>
          {proximo && <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/40">Anteriores</p>}
          <div className="space-y-2">
            {resto.map((a) => {
              const cor = a.status === "cancelado" ? "#9ca3af" : a.status === "concluido" ? "#16a34a" : "#d97706";
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-ink/10 p-3 text-sm">
                  <Avatar nome={a.nomeNegocio} foto={a.fotoEstabelecimento} cor={cor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {a.slugEstabelecimento ? (
                          <Link href={`/${a.slugEstabelecimento}`} className="truncate font-medium text-brand hover:underline">
                            {a.nomeNegocio}
                          </Link>
                        ) : (
                          <p className="truncate font-medium">{a.nomeNegocio}</p>
                        )}
                        <p className="text-ink/60">{a.nomeServico}</p>
                        {a.nomeAtendente && a.nomeAtendente !== a.nomeNegocio && (
                          <div className="mt-1 flex items-center gap-1.5">
                            {a.fotoAtendente && (
                              <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-ink/10">
                                <img src={a.fotoAtendente} alt={a.nomeAtendente} className="h-full w-full object-cover" />
                              </div>
                            )}
                            <p className="text-xs text-ink/40">Atendido por {a.nomeAtendente}</p>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
                        {ROTULO_STATUS[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink/40">
                      {new Date(a.inicio).toLocaleDateString("pt-BR")} às{" "}
                      {new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {renderAcoes(a)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {remarcando && (
        <RemarcarModal
          agendamentoId={remarcando.id}
          profissionalId={remarcando.profissionalId}
          servicoId={remarcando.servicoId}
          colaboradorId={remarcando.colaboradorId}
          onFechar={() => setRemarcando(null)}
        />
      )}

      {avaliando && (
        <AvaliarEstabelecimentoModal
          agendamentoId={avaliando.id}
          nomeNegocio={avaliando.nomeNegocio}
          onFechar={() => setAvaliando(null)}
          onEnviado={() => { setAvaliados((s) => new Set(s).add(avaliando.id)); setAvaliando(null); }}
        />
      )}
    </div>
  );
}
