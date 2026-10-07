"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { baixarPdfGanhos, baixarCsvGanhos } from "@/lib/relatorio-ganhos";
import { AtivarNotificacoesProfissional } from "@/components/AtivarNotificacoesProfissional";

type Resumo = {
  pendentes: number;
  agendamentosHoje: { id: string; inicio: string; status: string; servico: string | null; cliente: string | null }[];
  concluidosNoMes: number;
  totalClientes: number;
  statusAcesso:
    | { liberado: true; motivo: "teste_gratis"; testeExpiraEm: string }
    | { liberado: true; motivo: "assinatura_ativa"; assinaturaExpiraEm: string }
    | { liberado: false };
};

type LinhaGanho = { data: string; servico: string; cliente: string; colaborador: string; valorCentavos: number };
type PorColaborador = { nome: string; quantidade: number; totalCentavos: number };

const ROTULO_STATUS: Record<string, string> = {
  pendente: "Aguardando", confirmado: "Confirmado", concluido: "Concluído",
};
const COR_STATUS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800", confirmado: "bg-brand/10 text-brand", concluido: "bg-ink/5 text-ink/60",
};

function primeiroDiaDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function formatarReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PainelHome() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [nomePlataforma, setNomePlataforma] = useState("");
  const [porColaborador, setPorColaborador] = useState<PorColaborador[]>([]);
  const [detalhado, setDetalhado] = useState<LinhaGanho[]>([]);
  const [totalGeralCentavos, setTotalGeralCentavos] = useState(0);
  const [carregandoGanhos, setCarregandoGanhos] = useState(true);
  const [mostrarDetalheGanhos, setMostrarDetalheGanhos] = useState(false);

  useEffect(() => {
    fetch("/api/painel/visao-geral")
      .then((r) => r.json())
      .then((d) => (d.erro ? setErro(d.erro) : setResumo(d)));
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => { if (d.nomePlataforma) setNomePlataforma(d.nomePlataforma); });
    carregarGanhos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarGanhos() {
    setCarregandoGanhos(true);
    const params = new URLSearchParams({ dataInicio, dataFim });
    const d = await fetch(`/api/painel/ganhos?${params}`).then((r) => r.json());
    setPorColaborador(d.porColaborador ?? []);
    setDetalhado(d.detalhado ?? []);
    setTotalGeralCentavos(d.totalGeralCentavos ?? 0);
    setCarregandoGanhos(false);
  }

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!resumo) return <p className="text-ink/60">Carregando...</p>;

  const diasRestantesTeste =
    resumo.statusAcesso.liberado && resumo.statusAcesso.motivo === "teste_gratis"
      ? Math.max(0, Math.ceil((new Date(resumo.statusAcesso.testeExpiraEm).getTime() - Date.now()) / 86_400_000))
      : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold">Visão geral</h1>
        <span className="text-sm text-ink/50">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      <AtivarNotificacoesProfissional />

      {resumo.statusAcesso.liberado && resumo.statusAcesso.motivo === "teste_gratis" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand bg-brand/10 p-4 text-sm">
          <span>Você está no teste grátis — {diasRestantesTeste === 0 ? "termina hoje" : `faltam ${diasRestantesTeste} dia(s)`}.</span>
          <Link href="/assinatura" className="shrink-0 rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
            Assinar agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo="Aguardando" valor={resumo.pendentes} destaque={resumo.pendentes > 0} />
        <Cartao rotulo="Hoje" valor={resumo.agendamentosHoje.length} />
        <Cartao rotulo="Concluídos no mês" valor={resumo.concluidosNoMes} />
        <Cartao rotulo="Clientes" valor={resumo.totalClientes} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Hoje</h2>
          <Link href="/painel/agenda" className="text-sm text-brand hover:underline">Ver agenda completa</Link>
        </div>
        <div className="space-y-2">
          {resumo.agendamentosHoje.length === 0 && (
            <p className="text-sm text-ink/50">Nenhum agendamento pra hoje.</p>
          )}
          {resumo.agendamentosHoje.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
              <div>
                <span className="w-12 shrink-0 font-medium">
                  {new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>{" "}
                — {a.servico} — {a.cliente}
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${COR_STATUS[a.status] ?? "bg-ink/5 text-ink/60"}`}>
                {ROTULO_STATUS[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl2 bg-ink/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Ganhos no período</h2>
          <button onClick={() => setMostrarDetalheGanhos((v) => !v)} className="text-sm text-brand hover:underline">
            {mostrarDetalheGanhos ? "Esconder detalhe" : "Ver relatório completo"}
          </button>
        </div>
        {carregandoGanhos ? (
          <p className="mt-3 text-sm text-ink/50">Carregando...</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold">{formatarReais(totalGeralCentavos)}</p>
            <p className="mt-1 text-sm text-ink/50">
              {new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR")} a {new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>

            {mostrarDetalheGanhos && (
              <div className="mt-5 space-y-5 border-t border-ink/10 pt-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-ink/60">De</label>
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                      className="mt-1 block rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-ink/60">Até</label>
                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                      className="mt-1 block rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm" />
                  </div>
                  <button onClick={carregarGanhos} className="rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-medium">
                    Filtrar
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Por colaborador</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {porColaborador.length === 0 && <p className="text-sm text-ink/50">Nenhum atendimento concluído nesse período.</p>}
                    {porColaborador.map((c) => (
                      <div key={c.nome} className="rounded-lg border border-ink/10 bg-surface p-3 text-sm">
                        <p className="truncate font-medium">{c.nome}</p>
                        <p className="text-xs text-ink/50">{c.quantidade} atendimento(s)</p>
                        <p className="mt-1 font-medium">{formatarReais(c.totalCentavos)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => baixarPdfGanhos({
                      titulo: `Relatório de ganhos — ${nomePlataforma}`,
                      periodo: { dataInicio, dataFim }, linhas: detalhado, totalCentavos: totalGeralCentavos, incluirColaborador: true,
                    })}
                    className="rounded-lg border border-ink/15 bg-surface px-5 py-2 text-sm font-medium hover:bg-ink/5"
                  >
                    Baixar PDF
                  </button>
                  <button
                    onClick={() => baixarCsvGanhos({ periodo: { dataInicio, dataFim }, linhas: detalhado, incluirColaborador: true })}
                    className="rounded-lg border border-ink/15 bg-surface px-5 py-2 text-sm font-medium hover:bg-ink/5"
                  >
                    Baixar planilha (contador)
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-xl2 p-4 ${destaque ? "bg-amber-100" : "bg-ink/[0.03]"}`}>
      <p className={`text-2xl font-bold ${destaque ? "text-amber-800" : ""}`}>{valor}</p>
      <p className={`mt-1 text-xs ${destaque ? "text-amber-800" : "text-ink/60"}`}>{rotulo}</p>
    </div>
  );
}
