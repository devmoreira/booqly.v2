"use client";
import { useRef, useState } from "react";
import { RecortarFotoModal } from "./RecortarFotoModal";

export function UploadFoto({
  fotoAtual, endpoint, campoExtra, rotulo, formato = "circular", ocultarPreview = false,
  onEnviado,
}: {
  fotoAtual: string | null; endpoint: string; campoExtra?: Record<string, string>;
  rotulo: string; formato?: "circular" | "quadrado"; ocultarPreview?: boolean;
  onEnviado: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivoParaAjustar, setArquivoParaAjustar] = useState<File | null>(null);

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setArquivoParaAjustar(arquivo); // abre o editor — só envia depois de confirmar o recorte
    e.target.value = ""; // deixa escolher o mesmo arquivo de novo, se quiser
  }

  async function enviarRecorte(blob: Blob) {
    setArquivoParaAjustar(null);
    setEnviando(true);

    const formData = new FormData();
    formData.append("foto", blob, "foto.jpg");
    if (campoExtra) Object.entries(campoExtra).forEach(([k, v]) => formData.append(k, v));

    const resp = await fetch(endpoint, { method: "POST", body: formData });
    setEnviando(false);
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setErro(d.erro ?? "Não foi possível enviar a foto.");
      return;
    }
    const dados = await resp.json();
    onEnviado(dados.fotoUrl);
  }

  const classeFormato = formato === "circular" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-center gap-3">
      {!ocultarPreview && (
        <div className={`h-24 w-24 shrink-0 overflow-hidden bg-ink/5 ${classeFormato}`}>
          {fotoAtual && <img src={fotoAtual} alt={rotulo} className="h-full w-full object-cover object-center" />}
        </div>
      )}
      <div>
        <button
          type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
          className="rounded-lg border border-ink/15 px-4 py-1.5 text-xs font-medium hover:bg-ink/5 disabled:opacity-60"
        >
          {enviando ? "Enviando..." : fotoAtual ? `Trocar ${rotulo.toLowerCase()}` : `Adicionar ${rotulo.toLowerCase()}`}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={aoEscolherArquivo} className="hidden" />
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </div>

      {arquivoParaAjustar && (
        <RecortarFotoModal
          arquivo={arquivoParaAjustar} formato={formato}
          onCancelar={() => setArquivoParaAjustar(null)}
          onConfirmar={enviarRecorte}
        />
      )}
    </div>
  );
}
