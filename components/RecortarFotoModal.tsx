"use client";
import { useEffect, useRef, useState } from "react";

// Editor simples: o profissional escolhe uma foto, pode dar zoom
// (aumentar/diminuir) e arrastar pra posicionar, dentro de um círculo
// guia — evita a foto vir cortada estranho sem controle nenhum.
export function RecortarFotoModal({
  arquivo, formato = "circular", onCancelar, onConfirmar,
}: { arquivo: File; formato?: "circular" | "quadrado"; onCancelar: () => void; onConfirmar: (blob: Blob) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagemRef = useRef<HTMLImageElement | null>(null);
  const corFundoRef = useRef("#f4f4f4");
  const [zoom, setZoom] = useState(1);
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const TAMANHO = 400;

  // Pega uma cor aproximada da própria foto (média geral dela) — assim,
  // se sobrar espaço vazio (zoom bem baixo), preenche com essa cor em
  // vez de ficar preto (JPEG não tem transparência de verdade).
  function calcularCorMedia(img: HTMLImageElement): string {
    const auxiliar = document.createElement("canvas");
    auxiliar.width = 1;
    auxiliar.height = 1;
    const ctxAux = auxiliar.getContext("2d");
    if (!ctxAux) return "#f4f4f4";
    ctxAux.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctxAux.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }

  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      imagemRef.current = img;
      corFundoRef.current = calcularCorMedia(img);
      // Começa já preenchendo o quadro todo, sem sobrar borda vazia
      const escalaMinima = Math.max(TAMANHO / img.width, TAMANHO / img.height);
      setZoom(escalaMinima);
      desenhar(img, escalaMinima, { x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  function desenhar(img: HTMLImageElement, z: number, pos: { x: number; y: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = TAMANHO;
    canvas.height = TAMANHO;
    ctx.fillStyle = corFundoRef.current;
    ctx.fillRect(0, 0, TAMANHO, TAMANHO);
    const largura = img.width * z;
    const altura = img.height * z;
    const cx = TAMANHO / 2 - largura / 2 + pos.x;
    const cy = TAMANHO / 2 - altura / 2 + pos.y;
    ctx.drawImage(img, cx, cy, largura, altura);
  }

  useEffect(() => {
    if (imagemRef.current) desenhar(imagemRef.current, zoom, posicao);
  }, [zoom, posicao]);

  function aoIniciarArraste(e: React.MouseEvent | React.TouchEvent) {
    const ponto = "touches" in e ? e.touches[0] : e;
    arrastando.current = { x: ponto.clientX - posicao.x, y: ponto.clientY - posicao.y };
  }
  function aoArrastar(e: React.MouseEvent | React.TouchEvent) {
    if (!arrastando.current) return;
    const ponto = "touches" in e ? e.touches[0] : e;
    setPosicao({ x: ponto.clientX - arrastando.current.x, y: ponto.clientY - arrastando.current.y });
  }
  function aoSoltarArraste() {
    arrastando.current = null;
  }

  function confirmar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onConfirmar(blob); }, "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl2 bg-surface p-5">
        <p className="font-medium">Ajustar foto</p>
        <p className="mt-1 text-xs text-ink/50">
          Arraste pra posicionar e use o controle pra dar zoom. Pra ficar nítida, use uma
          foto quadrada com pelo menos <strong>500 × 500 pixels</strong>.
        </p>

        <div className="mt-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={TAMANHO} height={TAMANHO}
            className={`cursor-move touch-none border border-ink/10 ${formato === "circular" ? "rounded-full" : "rounded-lg"}`}
            onMouseDown={aoIniciarArraste} onMouseMove={aoArrastar} onMouseUp={aoSoltarArraste} onMouseLeave={aoSoltarArraste}
            onTouchStart={aoIniciarArraste} onTouchMove={aoArrastar} onTouchEnd={aoSoltarArraste}
          />
        </div>

        <input
          type="range" min={0.2} max={4} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-4 w-full"
        />

        <div className="mt-4 flex gap-2">
          <button onClick={onCancelar} className="flex-1 rounded-lg border border-ink/15 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button onClick={confirmar} className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-[var(--brand-fg)]">
            Usar essa foto
          </button>
        </div>
      </div>
    </div>
  );
}
