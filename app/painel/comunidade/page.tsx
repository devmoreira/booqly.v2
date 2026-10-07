"use client";
import { useEffect, useState } from "react";

type Comentario = { id: string; texto: string; criadoEm: string; autorNome: string; autorFoto: string | null; ehAutor: boolean };
type Post = {
  id: string; texto: string; criadoEm: string; autorId: string; autorNome: string; autorFoto: string | null;
  ehAutor: boolean; curtidas: number; euCurti: boolean; comentarios: Comentario[];
};

export default function ComunidadePage() {
  const [carregando, setCarregando] = useState(true);
  const [desbloqueada, setDesbloqueada] = useState(false);
  const [quantidadeAtiva, setQuantidadeAtiva] = useState(0);
  const [minimo, setMinimo] = useState(50);
  const [categoria, setCategoria] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [comentandoEm, setComentandoEm] = useState<string | null>(null);
  const [textoComentario, setTextoComentario] = useState("");

  async function carregar() {
    const status = await fetch("/api/comunidade/status").then((r) => r.json());
    setDesbloqueada(status.desbloqueada);
    setQuantidadeAtiva(status.quantidadeAtiva);
    setMinimo(status.minimo);
    setCategoria(status.categoria);
    if (status.desbloqueada) {
      const d = await fetch("/api/comunidade/posts").then((r) => r.json());
      setPosts(d.posts ?? []);
    }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setPublicando(true);
    const resp = await fetch("/api/comunidade/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const dados = await resp.json().catch(() => ({}));
    setPublicando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível publicar."); return; }
    setTexto("");
    carregar();
  }

  async function curtir(postId: string) {
    await fetch("/api/comunidade/curtir", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    carregar();
  }

  async function enviarComentario(postId: string) {
    if (!textoComentario.trim()) return;
    await fetch("/api/comunidade/comentarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, texto: textoComentario }),
    });
    setTextoComentario("");
    setComentandoEm(null);
    carregar();
  }

  async function excluirPost(id: string) {
    if (!confirm("Excluir esse post?")) return;
    await fetch(`/api/comunidade/posts/${id}`, { method: "DELETE" });
    carregar();
  }

  async function denunciar(postId: string) {
    if (!confirm("Denunciar esse post pro admin revisar?")) return;
    await fetch("/api/comunidade/denunciar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    alert("Denúncia enviada.");
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  if (!desbloqueada) {
    const progresso = Math.min(100, Math.round((quantidadeAtiva / minimo) * 100));
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-bold">Comunidade</h1>
        <div className="rounded-lg border border-ink/10 p-6 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-3 font-medium">Quase lá!</p>
          <p className="mt-1 text-sm text-ink/60">
            A comunidade da sua categoria libera quando {minimo} profissionais assinantes estiverem
            usando o Booqly.
          </p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-ink/10">
            <div className="h-full bg-brand" style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-2 text-sm font-medium">{quantidadeAtiva} de {minimo}</p>
          <p className="mt-3 text-xs text-ink/50">Convide colegas da sua área pra acelerar isso!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink/40">Sua comunidade</p>
        <h1 className="font-display text-2xl font-bold capitalize">{categoria}</h1>
      </div>

      <form onSubmit={publicar} className="space-y-2 rounded-lg border border-ink/10 p-3">
        <textarea
          value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Compartilhe uma dica ou faça uma pergunta..."
          rows={3} className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2 text-sm"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink/40">Só link do YouTube/Instagram é permitido.</p>
          <button disabled={publicando || !texto.trim()} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-50">
            {publicando ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {posts.length === 0 && <p className="text-sm text-ink/50">Ninguém postou nada ainda — seja o primeiro!</p>}
        {posts.map((p) => (
          <div key={p.id} className="rounded-lg border border-ink/10 p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-ink/10">
                  {p.autorFoto && <img src={p.autorFoto} alt="" className="h-full w-full object-cover" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.autorNome}</p>
                  <p className="text-xs text-ink/40">{new Date(p.criadoEm).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              {p.ehAutor ? (
                <button onClick={() => excluirPost(p.id)} className="text-xs text-red-600 hover:underline">Excluir</button>
              ) : (
                <button onClick={() => denunciar(p.id)} className="text-xs text-ink/40 hover:underline">Denunciar</button>
              )}
            </div>
            <p className="mt-2 text-sm">{p.texto}</p>
            <div className="mt-2 flex gap-4 border-t border-ink/10 pt-2 text-xs text-ink/50">
              <button onClick={() => curtir(p.id)} className={p.euCurti ? "font-medium text-brand" : ""}>❤️ {p.curtidas}</button>
              <button onClick={() => setComentandoEm(comentandoEm === p.id ? null : p.id)}>💬 {p.comentarios.length} comentários</button>
            </div>

            {p.comentarios.length > 0 && (
              <div className="mt-2 space-y-1.5 border-l-2 border-ink/10 pl-3">
                {p.comentarios.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs font-medium">{c.autorNome}</p>
                    <p className="text-xs text-ink/70">{c.texto}</p>
                  </div>
                ))}
              </div>
            )}

            {comentandoEm === p.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={textoComentario} onChange={(e) => setTextoComentario(e.target.value)}
                  placeholder="Escreva um comentário..." className="flex-1 rounded-lg border border-ink/15 px-2 py-1 text-xs"
                />
                <button onClick={() => enviarComentario(p.id)} className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-[var(--brand-fg)]">
                  Enviar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
