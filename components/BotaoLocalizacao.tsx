"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Usa a geolocalização do navegador (pede permissão pro usuário — nunca
// acontece sem ele autorizar) pra descobrir a cidade sozinho, sem
// precisar digitar. Depois de ter as coordenadas, usa um serviço
// gratuito (Nominatim/OpenStreetMap) pra converter isso em nome de cidade.
//
// Se "aoDetectar" for passado, chama ele com a cidade encontrada em vez
// de navegar a página (usado dentro do overlay de busca, que não deve
// recarregar nada).
export function BotaoLocalizacao({
  categoriaAtual, aoDetectar,
}: { categoriaAtual?: string; aoDetectar?: (cidade: string) => void }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function usarLocalizacao() {
    if (!navigator.geolocation) {
      setErro("Seu navegador não suporta localização automática.");
      return;
    }
    setErro(null);
    setCarregando(true);

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        try {
          const { latitude, longitude } = posicao.coords;
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const dados = await resp.json();
          const cidade = dados?.address?.city || dados?.address?.town || dados?.address?.municipality || dados?.address?.village;
          if (!cidade) {
            setErro("Não consegui identificar sua cidade. Digite manualmente.");
            setCarregando(false);
            return;
          }
          if (aoDetectar) {
            aoDetectar(cidade);
            setCarregando(false);
            return;
          }
          const params = new URLSearchParams({ cidade });
          if (categoriaAtual) params.set("categoria", categoriaAtual);
          router.push(`/?${params}`);
        } catch {
          setErro("Não consegui identificar sua cidade. Digite manualmente.");
          setCarregando(false);
        }
      },
      () => {
        setErro("Permissão de localização negada. Digite sua cidade manualmente.");
        setCarregando(false);
      }
    );
  }

  return (
    <div>
      <button
        type="button" onClick={usarLocalizacao} disabled={carregando}
        className="text-sm font-medium text-brand hover:underline disabled:opacity-60"
      >
        {carregando ? "Localizando..." : "📍 Usar minha localização"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
