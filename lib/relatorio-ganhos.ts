// Gera o PDF (visual, pra imprimir/guardar) e o CSV (formato que
// qualquer contador consegue importar em planilha) do relatório de
// ganhos — usado tanto na tela do profissional quanto na do colaborador.
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";

export type LinhaGanho = { data: string; servico: string; cliente: string; colaborador?: string; valorCentavos: number };

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function baixarPdfGanhos(params: {
  titulo: string; periodo: { dataInicio: string; dataFim: string };
  linhas: LinhaGanho[]; totalCentavos: number; incluirColaborador: boolean;
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(params.titulo, 14, 18);
  doc.setFontSize(10);
  doc.text(
    `Período: ${formatarData(params.periodo.dataInicio)} a ${formatarData(params.periodo.dataFim)}`,
    14, 26
  );

  const colunas = params.incluirColaborador
    ? ["Data", "Cliente", "Serviço", "Colaborador", "Valor"]
    : ["Data", "Cliente", "Serviço", "Valor"];

  const linhas = params.linhas.map((l) =>
    params.incluirColaborador
      ? [formatarData(l.data), l.cliente, l.servico, l.colaborador ?? "", formatarMoeda(l.valorCentavos)]
      : [formatarData(l.data), l.cliente, l.servico, formatarMoeda(l.valorCentavos)]
  );

  autoTable(doc, { head: [colunas], body: linhas, startY: 32, styles: { fontSize: 9 } });

  const finalY = (doc as any).lastAutoTable.finalY ?? 32;
  doc.setFontSize(12);
  doc.text(`Total: ${formatarMoeda(params.totalCentavos)}`, 14, finalY + 10);

  doc.save(`ganhos-${params.periodo.dataInicio}-a-${params.periodo.dataFim}.pdf`);
}

export function baixarCsvGanhos(params: {
  periodo: { dataInicio: string; dataFim: string };
  linhas: LinhaGanho[]; incluirColaborador: boolean;
}) {
  const cabecalho = params.incluirColaborador
    ? ["Data", "Cliente", "Serviço", "Colaborador", "Valor (R$)"]
    : ["Data", "Cliente", "Serviço", "Valor (R$)"];

  const linhas = params.linhas.map((l) => {
    const base = [formatarData(l.data), l.cliente, l.servico];
    if (params.incluirColaborador) base.push(l.colaborador ?? "");
    base.push((l.valorCentavos / 100).toFixed(2).replace(".", ","));
    return base;
  });

  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  // BOM no início evita que o Excel abra os acentos quebrados
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ganhos-${params.periodo.dataInicio}-a-${params.periodo.dataFim}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
