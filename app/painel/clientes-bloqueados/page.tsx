"use client";
import { useEffect, useState } from "react";

type Bloqueado = { id: string; clienteId: string; nome: string; telefone: string; bloqueadoEm: string };

export default function ClientesBloqueadosPage() {
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const d = await fetch("/api/painel/clientes-bloqueados").then((r) => r.json());
    setBloqueados(d.bloqueados ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function desbloquear(clienteId: string) {
    await fetch("/api/painel/clientes-bloqueados", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    });
    carregar();
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Clientes bloqueados</h1>
        <p className="mt-1 text-ink/60">Esses clientes não conseguem agendar no seu estabelecimento.</p>
      </div>
      <div className="space-y-2">
        {bloqueados.length === 0 && <p className="text-sm text-ink/50">Nenhum cliente bloqueado.</p>}
        {bloqueados.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
            <div>
              <p className="font-medium">{b.nome}</p>
              <p className="text-xs text-ink/50">{b.telefone} — bloqueado em {new Date(b.bloqueadoEm).toLocaleDateString("pt-BR")}</p>
            </div>
            <button onClick={() => desbloquear(b.clienteId)} className="text-brand hover:underline">Desbloquear</button>
          </div>
        ))}
      </div>
    </div>
  );
}
