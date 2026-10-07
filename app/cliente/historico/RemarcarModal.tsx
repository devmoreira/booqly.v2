"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function RemarcarModal({
  agendamentoId, profissionalId, servicoId, colaboradorId, onFechar,
}: {
  agendamentoId: string; profissionalId: string; servicoId: string; colaboradorId: string | null; onFechar: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setHoraEscolhida("");
    setHorarios([]);
    if (!data) return;
    setCarregando(true);
    const params = new URLSearchParams({ profissionalId, servicoId, data, ignorarAgendamentoId: agendamentoId });
    if (colaboradorId) params.set("colaboradorId", colaboradorId);
    fetch(`/api/disponibilidade?${params}`)
      .then((r) => r.json())
      .then((d) => setHorarios(d.horarios ?? []))
      .finally(() => setCarregando(false));
  }, [data, agendamentoId, profissionalId, servicoId, colaboradorId]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    const resp = await fetch("/api/cliente/reagendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agendamentoId, data, hora: horaEscolhida }),
    });
    setEnviando(false);
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setErro(d.erro ?? "Não foi possível remarcar.");
      return;
    }
    onFechar();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl2 bg-surface p-6">
        <p className="font-medium">Remarcar horário</p>
        <div className="mt-4">
          <label className="text-sm font-medium">Nova data</label>
          <input required type="date" min={new Date().toISOString().slice(0, 10)} value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full min-w-0 rounded-lg border border-ink/15 px-3 py-2 text-ink" />
        </div>
        {data && (
          <div className="mt-4">
            <label className="text-sm font-medium">Horário</label>
            {carregando && <p className="mt-1 text-sm text-ink/50">Carregando...</p>}
            {!carregando && horarios.length === 0 && <p className="mt-1 text-sm text-ink/50">Nenhum horário disponível.</p>}
            <div className="mt-2 grid grid-cols-4 gap-2">
              {horarios.map((h) => (
                <button key={h} onClick={() => setHoraEscolhida(h)}
                  className={`rounded-lg border py-2 text-sm ${horaEscolhida === h ? "border-brand bg-brand/10 font-medium" : "border-ink/15"}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onFechar} className="flex-1 rounded-lg border border-ink/15 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={confirmar} disabled={!horaEscolhida || enviando}
            className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60"
          >
            {enviando ? "Remarcando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
