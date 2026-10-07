"use client";
export function SeletorEstrelas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= valor ? "text-amber-400" : "text-ink/20"}`}
          aria-label={`${n} estrela(s)`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function EstrelasExibicao({ media, quantidade }: { media: number; quantidade: number }) {
  if (quantidade === 0) return <span className="text-sm text-ink/50">Sem avaliações ainda</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-400">★</span>
      <span className="font-medium">{media.toFixed(1)}</span>
      <span className="text-ink/50">({quantidade})</span>
    </span>
  );
}
