"use client";
import { useEffect, useRef, useState } from "react";

type Foto = { id: string; foto_url: string; ordem: number };
const LIMITE = 3;

export default function StoryPage() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const d = await fetch("/api/painel/story").then((r) => r.json());
    setFotos(d.fotos ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function enviarFoto(arquivo: File) {
    setErro(null);
    setEnviando(true);
    const formData = new FormData();
    formData.append("foto", arquivo);
    const resp = await fetch("/api/painel/story/foto", { method: "POST", body: formData });
    const dados = await resp.json().catch(() => ({}));
    setEnviando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível enviar."); return; }
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover essa foto do story?")) return;
    await fetch("/api/painel/story", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Story do estabelecimento</h1>
        <p className="mt-1 text-ink/60">
          Aparece como um destaque na sua foto, igual Instagram. Até {LIMITE} fotos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fotos.map((f) => (
          <div key={f.id} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink/5">
            <img src={f.foto_url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => excluir(f.id)}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {fotos.length < LIMITE && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="flex aspect-[9/16] items-center justify-center rounded-xl border-2 border-dashed border-ink/20 text-2xl text-ink/40 disabled:opacity-50"
          >
            {enviando ? "..." : "+"}
          </button>
        )}
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f); e.target.value = ""; }}
      />

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <p className="text-xs text-ink/40">{fotos.length} de {LIMITE} fotos usadas</p>
    </div>
  );
}
