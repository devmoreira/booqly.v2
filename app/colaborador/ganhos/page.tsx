"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { baixarPdfGanhos, baixarCsvGanhos } from "@/lib/relatorio-ganhos";

type Linha = { data: string; servico: string; cliente: string; valorCentavos: number };

function primeiroDiaDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function GanhosColaboradorPage() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [detalhado, setDetalhado] = useState<Linha[]>([]);
  const [totalGeralCentavos, setTotalGeralCentavos] = useState(0);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const params = new URLSearchParams({ dataInicio, dataFim });
    const d = await fetch(`/api/colaborador/ganhos?${params}`).then((r) => r.json());
    setDetalhado(d.detalhado ?? []);
    setTotalGeralCentavos(d.totalGeralCentavos ?? 0);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/colaborador" className="text-sm text-brand hover:underline">← Voltar</Link>
      <h1 className="mt-2 font-display text-2xl font-bold">Seus ganhos</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-ink/60">De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
            className="mt-1 block rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-ink/60">Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
            className="mt-1 block rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>
        <button onClick={carregar} className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium">
          Filtrar
        </button>
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-ink/50">Carregando...</p>
      ) : (
        <>
          <div className="mt-6 rounded-xl2 border border-brand bg-brand/10 p-5">
            <p className="text-sm text-ink/60">Total no período</p>
            <p className="text-2xl font-bold">{(totalGeralCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          </div>

          <div className="mt-6 space-y-2">
            {detalhado.length === 0 && <p className="text-sm text-ink/50">Nenhum atendimento concluído nesse período.</p>}
            {detalhado.map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
                <div>
                  <p className="font-medium">{l.servico} — {l.cliente}</p>
                  <p className="text-ink/50">{new Date(l.data).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className="font-medium">{(l.valorCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => baixarPdfGanhos({
                titulo: "Relatório de ganhos", periodo: { dataInicio, dataFim },
                linhas: detalhado, totalCentavos: totalGeralCentavos, incluirColaborador: false,
              })}
              className="rounded-lg border border-ink/15 px-5 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Baixar PDF
            </button>
            <button
              onClick={() => baixarCsvGanhos({ periodo: { dataInicio, dataFim }, linhas: detalhado, incluirColaborador: false })}
              className="rounded-lg border border-ink/15 px-5 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Baixar planilha (contador)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
