"use client";
import { useState } from "react";

type PedidoProduto = {
  id: string; produtoNome: string; quantidade: number; valorTotalCentavos: number;
  formaPagamento: string; status: string; estabelecimentoNome: string; criadoEm: string;
};

const ROTULO_STATUS: Record<string, string> = {
  pago_aguardando_retirada: "Aguardando você retirar",
  retirado: "Já retirado",
  expirado: "Expirado",
  falhou: "Pagamento falhou",
};

export function AbasHistoricoCliente({
  agendamentos, pedidosProduto,
}: { agendamentos: React.ReactNode; pedidosProduto: PedidoProduto[] }) {
  const [aba, setAba] = useState<"agendamentos" | "compras">("agendamentos");

  return (
    <div className="mt-3">
      <div className="flex border-b border-ink/10">
        <button onClick={() => setAba("agendamentos")} className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "agendamentos" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}>
          Agendamentos
        </button>
        <button onClick={() => setAba("compras")} className={`border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "compras" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}>
          Compras
        </button>
      </div>

      <div className="mt-4">
        {aba === "agendamentos" ? (
          agendamentos
        ) : pedidosProduto.length === 0 ? (
          <p className="text-sm text-ink/50">Você ainda não comprou nenhum produto.</p>
        ) : (
          <div className="space-y-2">
            {pedidosProduto.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{p.quantidade}x {p.produtoNome}</p>
                    <p className="text-ink/50">{p.estabelecimentoNome}</p>
                  </div>
                  <p className="font-medium">R$ {(p.valorTotalCentavos / 100).toFixed(2)}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className={p.status === "pago_aguardando_retirada" ? "font-medium text-brand" : "text-ink/50"}>
                    {ROTULO_STATUS[p.status] ?? p.status}
                  </span>
                  <span className="text-ink/40">{new Date(p.criadoEm).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
