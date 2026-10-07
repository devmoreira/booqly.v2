"use client";
import { useEffect, useState } from "react";

type Video = { id: string; titulo: string | null; url: string };

export default function AdminTutoriaisPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const d = await fetch("/api/admin/tutoriais").then((r) => r.json());
    setVideos(d.tutoriais ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAdicionando(true);
    const resp = await fetch("/api/admin/tutoriais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: novoTitulo || undefined, url: novaUrl }),
    });
    const dados = await resp.json().catch(() => ({}));
    setAdicionando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível adicionar."); return; }
    setNovoTitulo(""); setNovaUrl("");
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover esse vídeo da lista?")) return;
    await fetch("/api/admin/tutoriais", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Vídeos tutoriais</h1>
        <p className="mt-1 text-ink/60">
          Aparecem pro profissional em Painel → Passo a passo, na ordem em que você adicionar.
          Adicione quantos quiser.
        </p>
      </div>

      <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <h2 className="font-medium">Adicionar vídeo</h2>
        <input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Título (opcional) — ex: Como criar sua conta no Asaas"
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        <input required value={novaUrl} onChange={(e) => setNovaUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={adicionando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {adicionando ? "Adicionando..." : "Adicionar"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-medium">{videos.length} vídeo(s) cadastrado(s)</h2>
        {carregando ? (
          <p className="text-sm text-ink/50">Carregando...</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-ink/50">Nenhum vídeo ainda.</p>
        ) : (
          videos.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{v.titulo || "(sem título)"}</p>
                <p className="truncate text-xs text-ink/50">{v.url}</p>
              </div>
              <button onClick={() => excluir(v.id)} className="shrink-0 pl-3 text-red-600 hover:underline">
                Excluir
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
