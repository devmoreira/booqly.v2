"use client";
import { useEffect, useState } from "react";

// Desenha o story (formato vertical, tipo Instagram) num <canvas> e usa
// o compartilhamento nativo do celular pra abrir o menu de "enviar
// pra..." (WhatsApp, Instagram, etc). No desktop, ou se o navegador não
// suportar compartilhar arquivo, cai pra baixar a imagem.
export function CompartilharHorariosHoje({ nomeNegocio, fotoUrl, slug }: { nomeNegocio: string; fotoUrl: string | null; slug: string }) {
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    fetch("/api/painel/horarios-livres-hoje").then((r) => r.json()).then((d) => setHorarios(d.horarios ?? []));
  }, []);

  function arredondar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function carregarFoto(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function gerarImagem(): Promise<Blob | null> {
    const largura = 1080, altura = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = largura; canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fundo
    ctx.fillStyle = "#EAF6F0";
    ctx.fillRect(0, 0, largura, altura);

    // Anéis decorativos sutis
    ctx.strokeStyle = "rgba(15,110,86,0.08)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(960, 170, 375, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(15,110,86,0.06)";
    ctx.beginPath(); ctx.arc(960, 170, 580, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(216,90,48,0.08)";
    ctx.beginPath(); ctx.arc(40, 1800, 290, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(216,90,48,0.05)";
    ctx.beginPath(); ctx.arc(40, 1800, 480, 0, Math.PI * 2); ctx.stroke();

    // Cabeçalho: foto (ou inicial) + nome
    const cx = 110, cy = 110, raio = 60;
    if (fotoUrl) {
      const img = await carregarFoto(fotoUrl);
      if (img) {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, cx - raio, cy - raio, raio * 2, raio * 2);
        ctx.restore();
      }
    }
    if (!fotoUrl) {
      ctx.fillStyle = "#0F6E56";
      ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "600 46px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(nomeNegocio.charAt(0).toUpperCase(), cx, cy + 4);
    }
    ctx.fillStyle = "#04342C"; ctx.font = "600 40px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(nomeNegocio, cx + raio + 24, cy);

    // Título
    ctx.fillStyle = "#04342C"; ctx.font = "600 62px Arial"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Vagas hoje", 88, 320);
    ctx.fillStyle = "#5F5E5A"; ctx.font = "400 34px Arial";
    ctx.fillText(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }), 88, 372);

    // Horários
    let y = 460;
    for (const h of horarios ?? []) {
      arredondar(ctx, 88, y, largura - 176, 96, 16);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.fillStyle = "#0F6E56"; ctx.font = "600 46px Arial"; ctx.textBaseline = "middle";
      ctx.fillText(h, 120, y + 48);
      y += 112;
    }

    // Rodapé
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#5F5E5A"; ctx.font = "400 32px Arial";
    ctx.fillText("Agende pelo link", largura / 2, altura - 140);
    ctx.fillStyle = "#D85A30"; ctx.font = "600 38px Arial";
    ctx.fillText(`${window.location.origin.replace(/^https?:\/\//, "")}/${slug}`, largura / 2, altura - 90);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  async function compartilhar() {
    setGerando(true);
    const blob = await gerarImagem();
    setGerando(false);
    if (!blob) return;

    const arquivo = new File([blob], "vagas-hoje.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: "Vagas hoje" });
        return;
      } catch {
        // pessoa cancelou o compartilhamento — sem problema, não faz nada
        return;
      }
    }

    // Sem suporte a compartilhar arquivo (a maioria dos navegadores de
    // computador) — baixa a imagem em vez disso.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vagas-hoje.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (horarios !== null && horarios.length === 0) return null; // agenda cheia hoje — não faz sentido compartilhar

  return (
    <button
      onClick={compartilhar}
      disabled={horarios === null || gerando}
      className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
    >
      {gerando ? "Gerando imagem..." : "Compartilhar horários de hoje"}
    </button>
  );
}
