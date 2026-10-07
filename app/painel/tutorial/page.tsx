"use client";
import { useEffect, useState } from "react";

type Tutorial = { titulo: string | null; url: string };

function idDoYoutube(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
  return match?.[1] ?? null;
}

export default function TutorialPage() {
  const [tutoriais, setTutoriais] = useState<Tutorial[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => {
      setTutoriais(d.tutoriais ?? []);
      setCarregando(false);
    });
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Passo a passo</h1>
        <p className="mt-1 text-ink/60">Funcionalidades do sistema, e suas configurações.</p>
      </div>

      {carregando ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : tutoriais.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum vídeo tutorial configurado ainda.</p>
      ) : (
        <div className="space-y-6">
          {tutoriais.map((t, i) => {
            const id = idDoYoutube(t.url);
            if (!id) return null;
            return (
              <div key={i} className="space-y-2">
                {t.titulo && <h2 className="font-medium">{t.titulo}</h2>}
                <div className="aspect-video overflow-hidden rounded-lg border border-ink/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${id}`}
                    className="h-full w-full" allowFullScreen
                    title={t.titulo ?? `Tutorial ${i + 1}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
