"use client";
import { useEffect, useState } from "react";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type DiaConfig = { diaSemana: number; horaInicio: string; horaFim: string; ativo: boolean };
type Bloqueio = { id: string; inicio: string; fim: string; motivo: string | null };
type Aba = "funcionamento" | "almoco" | "bloqueios";
type Colaborador = { id: string; nome: string; almoco_inicio: string | null; almoco_fim: string | null };

export default function HorariosPage() {
  const [aba, setAba] = useState<Aba>("funcionamento");

  // Horário de funcionamento
  const [dias, setDias] = useState<DiaConfig[]>(
    DIAS.map((_, i) => ({ diaSemana: i, horaInicio: "09:00", horaFim: "18:00", ativo: i >= 1 && i <= 5 }))
  );
  const [carregandoHorarios, setCarregandoHorarios] = useState(true);
  const [salvandoHorarios, setSalvandoHorarios] = useState(false);
  const [mensagemHorarios, setMensagemHorarios] = useState<string | null>(null);

  // Horário de almoço por colaborador
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(true);
  const [almocoEdit, setAlmocoEdit] = useState<Record<string, { inicio: string; fim: string }>>({});
  const [salvandoAlmocoDe, setSalvandoAlmocoDe] = useState<string | null>(null);
  const [mensagemAlmocoDe, setMensagemAlmocoDe] = useState<{ id: string; texto: string } | null>(null);

  // Bloqueios pontuais
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [dataBloqueio, setDataBloqueio] = useState("");
  const [horaInicioBloqueio, setHoraInicioBloqueio] = useState("12:00");
  const [horaFimBloqueio, setHoraFimBloqueio] = useState("14:00");
  const [motivoBloqueio, setMotivoBloqueio] = useState("");
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/painel/horarios").then((r) => r.json()).then((d) => {
      if (d.horarios?.length > 0) {
        setDias((atual) => atual.map((dia) => {
          const salvo = d.horarios.find((h: any) => h.dia_semana === dia.diaSemana);
          return salvo ? { diaSemana: dia.diaSemana, horaInicio: salvo.hora_inicio.slice(0, 5), horaFim: salvo.hora_fim.slice(0, 5), ativo: salvo.ativo } : dia;
        }));
      }
      setCarregandoHorarios(false);
    });
    carregarBloqueios();
    carregarColaboradores();
  }, []);

  async function carregarColaboradores() {
    const d = await fetch("/api/colaboradores").then((r) => r.json());
    const lista: Colaborador[] = d.colaboradores ?? [];
    setColaboradores(lista);
    setAlmocoEdit(Object.fromEntries(lista.map((c) => [c.id, {
      inicio: c.almoco_inicio?.slice(0, 5) ?? "",
      fim: c.almoco_fim?.slice(0, 5) ?? "",
    }])));
    setCarregandoColaboradores(false);
  }

  async function salvarAlmoco(id: string) {
    const valores = almocoEdit[id] ?? { inicio: "", fim: "" };
    setSalvandoAlmocoDe(id);
    setMensagemAlmocoDe(null);
    const resp = await fetch("/api/colaboradores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        almocoInicio: valores.inicio || (valores.fim ? undefined : null),
        almocoFim: valores.fim || (valores.inicio ? undefined : null),
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    setSalvandoAlmocoDe(null);
    setMensagemAlmocoDe({ id, texto: resp.ok ? "Salvo." : (dados.erro ?? "Não foi possível salvar.") });
  }

  function atualizarDia(diaSemana: number, campo: keyof DiaConfig, valor: any) {
    setDias((atual) => atual.map((d) => (d.diaSemana === diaSemana ? { ...d, [campo]: valor } : d)));
  }

  async function salvarHorarios() {
    setSalvandoHorarios(true);
    setMensagemHorarios(null);
    const resp = await fetch("/api/painel/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dias }),
    });
    const dados = await resp.json().catch(() => ({}));
    setSalvandoHorarios(false);
    setMensagemHorarios(resp.ok ? "Horários salvos." : (dados.erro ?? "Não foi possível salvar."));
  }

  async function carregarBloqueios() {
    const d = await fetch("/api/painel/bloqueios").then((r) => r.json());
    setBloqueios(d.bloqueios ?? []);
  }

  async function adicionarBloqueio(e: React.FormEvent) {
    e.preventDefault();
    setErroBloqueio(null);
    const resp = await fetch("/api/painel/bloqueios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inicio: new Date(`${dataBloqueio}T${horaInicioBloqueio}:00`).toISOString(),
        fim: new Date(`${dataBloqueio}T${horaFimBloqueio}:00`).toISOString(),
        motivo: motivoBloqueio || undefined,
      }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErroBloqueio(dados.erro ?? "Não foi possível criar o bloqueio.");
      return;
    }
    setMotivoBloqueio("");
    carregarBloqueios();
  }

  async function removerBloqueio(id: string) {
    await fetch("/api/painel/bloqueios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregarBloqueios();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Horários</h1>
        <p className="mt-1 text-ink/60">Funcionamento geral e bloqueios pontuais da sua agenda.</p>
      </div>

      <div className="flex border-b border-ink/10">
        <button
          onClick={() => setAba("funcionamento")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "funcionamento" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Funcionamento
        </button>
        <button
          onClick={() => setAba("almoco")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "almoco" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Horário de almoço
        </button>
        <button
          onClick={() => setAba("bloqueios")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "bloqueios" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Bloqueios pontuais
        </button>
      </div>

      {aba === "funcionamento" && (
        <section>
          <p className="text-sm text-ink/60">Define em que dias e horários o cliente consegue agendar.</p>

          {carregandoHorarios ? (
            <p className="mt-3 text-sm text-ink/50">Carregando...</p>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {dias.map((d) => (
                  <div key={d.diaSemana} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3">
                    <label className="flex w-32 items-center gap-2 text-sm">
                      <input type="checkbox" checked={d.ativo} onChange={(e) => atualizarDia(d.diaSemana, "ativo", e.target.checked)} />
                      {DIAS[d.diaSemana]}
                    </label>
                    <input
                      type="time" disabled={!d.ativo} value={d.horaInicio}
                      onChange={(e) => atualizarDia(d.diaSemana, "horaInicio", e.target.value)}
                      className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm disabled:opacity-40"
                    />
                    <span className="text-ink/40">até</span>
                    <input
                      type="time" disabled={!d.ativo} value={d.horaFim}
                      onChange={(e) => atualizarDia(d.diaSemana, "horaFim", e.target.value)}
                      className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm disabled:opacity-40"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button onClick={salvarHorarios} disabled={salvandoHorarios} className="rounded-lg bg-brand px-6 py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60">
                  {salvandoHorarios ? "Salvando..." : "Salvar horários"}
                </button>
                {mensagemHorarios && <p className="mt-2 text-sm text-ink/60">{mensagemHorarios}</p>}
              </div>
            </>
          )}
        </section>
      )}

      {aba === "almoco" && (
        <section>
          <p className="text-sm text-ink/60">
            Durante esse intervalo, o colaborador não aparece disponível pra agendamento —
            mesmo que o estabelecimento continue aberto (outros podem seguir atendendo).
          </p>

          {carregandoColaboradores ? (
            <p className="mt-3 text-sm text-ink/50">Carregando...</p>
          ) : colaboradores.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">Você ainda não tem colaboradores cadastrados.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {colaboradores.map((c) => (
                <div key={c.id} className="rounded-lg border border-ink/10 p-3">
                  <p className="text-sm font-medium">{c.nome}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="time"
                      value={almocoEdit[c.id]?.inicio ?? ""}
                      onChange={(e) => setAlmocoEdit((atual) => ({ ...atual, [c.id]: { inicio: e.target.value, fim: atual[c.id]?.fim ?? "" } }))}
                      className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink/40">até</span>
                    <input
                      type="time"
                      value={almocoEdit[c.id]?.fim ?? ""}
                      onChange={(e) => setAlmocoEdit((atual) => ({ ...atual, [c.id]: { inicio: atual[c.id]?.inicio ?? "", fim: e.target.value } }))}
                      className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => salvarAlmoco(c.id)}
                      disabled={salvandoAlmocoDe === c.id}
                      className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)] disabled:opacity-60"
                    >
                      {salvandoAlmocoDe === c.id ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-ink/50">Deixe os dois em branco pra não ter almoço fixo.</p>
                  {mensagemAlmocoDe?.id === c.id && <p className="mt-1 text-xs text-ink/60">{mensagemAlmocoDe.texto}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {aba === "bloqueios" && (
        <section>
          <p className="text-sm text-ink/60">Ex: almoço, folga, feriado — o cliente não vê esses horários como disponíveis.</p>

          <form onSubmit={adicionarBloqueio} className="mt-3 space-y-3 rounded-lg border border-ink/10 p-4">
            <input required type="date" value={dataBloqueio} onChange={(e) => setDataBloqueio(e.target.value)}
              className="w-full rounded-lg border border-ink/15 px-3 py-2" />
            <div className="flex items-center gap-2">
              <input required type="time" value={horaInicioBloqueio} onChange={(e) => setHoraInicioBloqueio(e.target.value)}
                className="rounded-lg border border-ink/15 px-3 py-2" />
              <span className="text-ink/40">até</span>
              <input required type="time" value={horaFimBloqueio} onChange={(e) => setHoraFimBloqueio(e.target.value)}
                className="rounded-lg border border-ink/15 px-3 py-2" />
            </div>
            <input value={motivoBloqueio} onChange={(e) => setMotivoBloqueio(e.target.value)}
              placeholder="Motivo (opcional)" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
            {erroBloqueio && <p className="text-sm text-red-600">{erroBloqueio}</p>}
            <button className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)]">
              Bloquear
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {bloqueios.length === 0 && <p className="text-sm text-ink/50">Nenhum bloqueio futuro.</p>}
            {bloqueios.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {new Date(b.inicio).toLocaleDateString("pt-BR")} — {new Date(b.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {" às "}
                    {new Date(b.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {b.motivo && <p className="text-ink/50">{b.motivo}</p>}
                </div>
                <button onClick={() => removerBloqueio(b.id)} className="text-red-600 hover:underline">Remover</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
