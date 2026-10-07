"use client";
import { useEffect, useState } from "react";

type Denuncia = { id: string; motivo: string | null; criadoEm: string; tipo: "post" | "comentario"; texto: string };

export default function AdminComunidadeDenunciasPage() {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const d = await fetch("/api/admin/comunidade-denuncias").then((r) => r.json());
    setDenuncias(d.denuncias ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function resolver(id: string, excluirConteudo: boolean) {
    await fetch("/api/admin/comunidade-denuncias", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, excluirConteudo }),
    });
    carregar();
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Denúncias da Comunidade</h1>
        <p className="mt-1 text-ink/60">Posts e comentários denunciados por profissionais, aguardando revisão.</p>
      </div>

      {denuncias.length === 0 && <p className="text-sm text-ink/50">Nenhuma denúncia pendente.</p>}

      <div className="space-y-3">
        {denuncias.map((d) => (
          <div key={d.id} className="rounded-lg border border-ink/10 p-3">
            <p className="text-xs uppercase text-ink/40">{d.tipo}</p>
            <p className="mt-1 text-sm">{d.texto}</p>
            {d.motivo && <p className="mt-1 text-xs text-ink/50">Motivo: {d.motivo}</p>}
            <div className="mt-2 flex gap-3 text-sm">
              <button onClick={() => resolver(d.id, true)} className="text-red-600 hover:underline">Excluir conteúdo</button>
              <button onClick={() => resolver(d.id, false)} className="text-ink/50 hover:underline">Ignorar denúncia</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
