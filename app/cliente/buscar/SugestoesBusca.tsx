"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Estabelecimento = { id: string; nome_negocio: string; slug: string; categoria: string; cidade: string; estado: string; foto_url: string | null };

const CORES = ["#16a34a", "#d97706", "#2563eb", "#dc2626", "#7c3aed"];

function Avatar({ nome, foto, indice }: { nome: string; foto: string | null; indice: number }) {
  if (foto) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink/5">
        <img src={foto} alt={nome} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-white"
      style={{ backgroundColor: CORES[indice % CORES.length] }}
    >
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

function Cartao({ item, indice, tag }: { item: Estabelecimento; indice: number; tag: string }) {
  return (
    <Link href={`/${item.slug}`} className="flex items-center gap-3 rounded-xl border border-ink/10 p-3 text-sm hover:border-brand/40">
      <Avatar nome={item.nome_negocio} foto={item.foto_url} indice={indice} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.nome_negocio}</p>
        <p className="text-xs text-ink/50">{tag} — {item.cidade}/{item.estado}</p>
      </div>
    </Link>
  );
}

export function SugestoesBusca() {
  const [jaVisitados, setJaVisitados] = useState<Estabelecimento[]>([]);
  const [pertoDeVoce, setPertoDeVoce] = useState<Estabelecimento[]>([]);
  const [pedindoLocalizacao, setPedindoLocalizacao] = useState(false);

  async function carregar(lat?: number, lng?: number) {
    const params = lat && lng ? `?lat=${lat}&lng=${lng}` : "";
    const d = await fetch(`/api/cliente/sugestoes-busca${params}`).then((r) => r.json());
    setJaVisitados(d.jaVisitados ?? []);
    setPertoDeVoce(d.pertoDeVoce ?? []);
  }

  useEffect(() => {
    carregar();
    if ("geolocation" in navigator) {
      setPedindoLocalizacao(true);
      navigator.geolocation.getCurrentPosition(
        (posicao) => { setPedindoLocalizacao(false); carregar(posicao.coords.latitude, posicao.coords.longitude); },
        () => { setPedindoLocalizacao(false); },
        { timeout: 8000 }
      );
    }
  }, []);

  if (jaVisitados.length === 0 && pertoDeVoce.length === 0 && !pedindoLocalizacao) {
    return null;
  }

  return (
    <div className="mt-8 space-y-6">
      {jaVisitados.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Já visitado</p>
          <div className="space-y-2">
            {jaVisitados.map((item, i) => <Cartao key={item.id} item={item} indice={i} tag="Você já foi aqui" />)}
          </div>
        </div>
      )}

      {pertoDeVoce.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Perto de você</p>
          <div className="space-y-2">
            {pertoDeVoce.map((item, i) => <Cartao key={item.id} item={item} indice={i} tag="Na sua cidade" />)}
          </div>
        </div>
      )}

      {pedindoLocalizacao && <p className="text-sm text-ink/50">Buscando sua localização...</p>}
    </div>
  );
}
