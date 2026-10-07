"use client";
import { useEffect, useState } from "react";

type Subsidio = {
  id: string; criadoEm: string; valorCentavos: number; subsidioCentavos: number;
  status: "pago" | "falhou"; profissional: string; cliente: string;
};

export default function AdminSubsidiosCupomPage() {
  const [subsidios, setSubsidios] = useState<Subsidio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [somenteFalhas, setSomenteFalhas] = useState(false);

  useEffect(() => {
    fetch("/api/admin/subsidios-cupom").then((r) => r.json()).then((d) => {
      setSubsidios(d.subsidios ?? []);
      setCarregando(false);
    });
  }, []);

  function formatarReais(centavos: number) {
    return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const lista = somenteFalhas ? subsidios.filter((s) => s.status === "falhou") : subsidios;
  const totalFalhas = subsidios.filter((s) => s.status === "falhou").length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Subsídios de cupom</h1>
        <p className="mt-1 text-ink/60">
          Toda vez que um cliente usa um cupom com desconto, a plataforma cobre a diferença
          por Pix — aqui você vê se cada uma dessas transferências foi paga ou falhou.
        </p>
      </div>

      {totalFalhas > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {totalFalhas} transferência(s) falhou/falharam — o motivo mais comum é saldo
          insuficiente na sua conta Asaas (Admin → Pagamentos).
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={somenteFalhas} onChange={(e) => setSomenteFalhas(e.target.checked)} />
        Mostrar só as que falharam
      </label>

      {carregando ? (
        <p className="text-ink/60">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum subsídio {somenteFalhas ? "com falha" : "registrado"} ainda.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
              <div>
                <p><strong>{s.profissional}</strong> — cliente {s.cliente}</p>
                <p className="text-xs text-ink/50">
                  {new Date(s.criadoEm).toLocaleString("pt-BR")} — subsídio de {formatarReais(s.subsidioCentavos)}
                  {" "}(agendamento de {formatarReais(s.valorCentavos)})
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.status === "pago" ? "bg-brand/10 text-brand" : "bg-red-100 text-red-700"}`}>
                  {s.status === "pago" ? "Pago" : "Falhou"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
