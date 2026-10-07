"use client";
import { useState } from "react";
import { UploadFoto } from "@/components/UploadFoto";

export function FotoPerfilColaborador({ fotoInicial }: { fotoInicial: string | null }) {
  const [fotoUrl, setFotoUrl] = useState(fotoInicial);
  return (
    <UploadFoto
      fotoAtual={fotoUrl} endpoint="/api/colaborador/foto-perfil" rotulo="Foto"
      onEnviado={setFotoUrl}
    />
  );
}
