"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Profissional = {
  id: string; nome_negocio: string; slug: string;
  cidade: string | null; estado: string | null;
  ultimo_acesso: string | null; criado_em: string;
};

type AbaPrincipal = "visao-geral" | "inatividade";
type AbaVisaoGeral = "mapa" | "lista";

function diasDesde(dataISO: string | null): number | null {
  if (!dataISO) return null;
  return Math.floor((Date.now() - new Date(dataISO).getTime()) / 86_400_000);
}

export default function AdminProfissionaisPage() {
  const [abaPrincipal, setAbaPrincipal] = useState<AbaPrincipal>("visao-geral");
  const [abaVisaoGeral, setAbaVisaoGeral] = useState<AbaVisaoGeral>("mapa");

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [diasSugerido, setDiasSugerido] = useState(180);
  const [limiteDias, setLimiteDias] = useState("180");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  async function carregar() {
    const d = await fetch("/api/admin/profissionais").then((r) => r.json());
    setProfissionais(d.profissionais ?? []);
    setDiasSugerido(d.diasInatividadeSugerido ?? 180);
    setLimiteDias(String(d.diasInatividadeSugerido ?? 180));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  const inativos = profissionais.filter((p) => {
    const dias = diasDesde(p.ultimo_acesso);
    return dias === null || dias >= Number(limiteDias || diasSugerido);
  });

  function alternarSelecao(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!confirm(`Excluir ${selecionados.size} conta(s) de profissional de vez? Isso apaga TODOS os dados (agendamentos, clientes, cobranças) e não pode ser desfeito.`)) return;
    setExcluindo(true);
    await fetch("/api/admin/profissionais", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selecionados] }),
    });
    setExcluindo(false);
    setSelecionados(new Set());
    carregar();
  }

  async function excluirUm(id: string, nome: string) {
    if (!confirm(`Excluir a conta de "${nome}" de vez? Isso apaga TODOS os dados dela e não pode ser desfeito.`)) return;
    await fetch("/api/admin/profissionais", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  // --- Estatísticas da Visão geral ---
  const stats = useMemo(() => {
    const agora = new Date();
    const novosEsteMes = profissionais.filter((p) => {
      const d = new Date(p.criado_em);
      return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
    }).length;

    const porEstado = new Map<string, number>();
    const porCidade = new Map<string, { cidade: string; estado: string; count: number }>();
    for (const p of profissionais) {
      if (p.estado) porEstado.set(p.estado, (porEstado.get(p.estado) ?? 0) + 1);
      if (p.cidade && p.estado) {
        const chave = `${p.cidade}|${p.estado}`;
        const atual = porCidade.get(chave);
        porCidade.set(chave, { cidade: p.cidade, estado: p.estado, count: (atual?.count ?? 0) + 1 });
      }
    }

    const cidadesDetalhado = [...porCidade.values()].sort((a, b) => b.count - a.count);
    const topCidades: [string, number][] = cidadesDetalhado.slice(0, 8).map((c) => [`${c.cidade}, ${c.estado}`, c.count]);

    return {
      total: profissionais.length,
      novosEsteMes,
      estadosAtendidos: porEstado.size,
      porEstado,
      topCidades,
      cidadesDetalhado,
    };
  }, [profissionais]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Profissionais</h1>
        <p className="mt-1 text-ink/60">Visão geral de quem está cadastrado, e limpeza de contas inativas.</p>
      </div>

      <div className="flex border-b border-ink/10">
        <button
          onClick={() => setAbaPrincipal("visao-geral")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${abaPrincipal === "visao-geral" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Visão geral
        </button>
        <button
          onClick={() => setAbaPrincipal("inatividade")}
          className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${abaPrincipal === "inatividade" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Inatividade
        </button>
      </div>

      {carregando ? (
        <p className="text-ink/60">Carregando...</p>
      ) : abaPrincipal === "visao-geral" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-ink/5 p-4">
              <p className="text-sm text-ink/60">Total cadastrado</p>
              <p className="mt-1 text-2xl font-medium">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-ink/5 p-4">
              <p className="text-sm text-ink/60">Novos este mês</p>
              <p className="mt-1 text-2xl font-medium">+{stats.novosEsteMes}</p>
            </div>
            <div className="rounded-lg bg-ink/5 p-4">
              <p className="text-sm text-ink/60">Estados atendidos</p>
              <p className="mt-1 text-2xl font-medium">{stats.estadosAtendidos}</p>
            </div>
          </div>

          <div className="flex border-b border-ink/10">
            <button
              onClick={() => setAbaVisaoGeral("mapa")}
              className={`mr-5 pb-2 text-sm font-medium ${abaVisaoGeral === "mapa" ? "border-b-2 border-ink text-ink" : "text-ink/50"}`}
            >
              Mapa
            </button>
            <button
              onClick={() => setAbaVisaoGeral("lista")}
              className={`mr-5 pb-2 text-sm font-medium ${abaVisaoGeral === "lista" ? "border-b-2 border-ink text-ink" : "text-ink/50"}`}
            >
              Lista completa
            </button>
          </div>

          {abaVisaoGeral === "mapa" ? (
            <MapaBrasil topCidades={stats.topCidades} cidadesDetalhado={stats.cidadesDetalhado} />
          ) : (
            <ListaCompleta profissionais={profissionais} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink/10 p-4">
            <div>
              <label className="text-xs text-ink/60">Considerar inativo há mais de (dias)</label>
              <input type="number" min={1} value={limiteDias} onChange={(e) => setLimiteDias(e.target.value)}
                className="mt-1 block w-32 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
            </div>
            <button
              onClick={excluirSelecionados}
              disabled={selecionados.size === 0 || excluindo}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {excluindo ? "Excluindo..." : `Excluir selecionados (${selecionados.size})`}
            </button>
            <button
              onClick={() => setSelecionados(new Set(inativos.map((p) => p.id)))}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Selecionar todos os inativos ({inativos.length})
            </button>
          </div>

          <div className="space-y-2">
            {profissionais.map((p) => {
              const dias = diasDesde(p.ultimo_acesso);
              const ehInativo = dias === null || dias >= Number(limiteDias || diasSugerido);
              return (
                <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${ehInativo ? "border-amber-300 bg-amber-50" : "border-ink/10"}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternarSelecao(p.id)} />
                    <div>
                      <p className="font-medium">{p.nome_negocio}</p>
                      <p className="text-xs text-ink/50">
                        {dias === null ? "Nunca acessou" : `Último acesso há ${dias} dia(s)`} — cadastrado em {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => excluirUm(p.id, p.nome_negocio)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ListaCompleta({ profissionais }: { profissionais: Profissional[] }) {
  const ordenados = [...profissionais].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/15 text-left text-xs text-ink/50">
            <th className="pb-2 pr-4 font-medium">Estabelecimento</th>
            <th className="pb-2 pr-4 font-medium">Cidade</th>
            <th className="pb-2 pr-4 font-medium">UF</th>
            <th className="pb-2 font-medium">Cadastrado em</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((p) => (
            <tr key={p.id} className="border-b border-ink/5">
              <td className="py-2.5 pr-4">{p.nome_negocio}</td>
              <td className="py-2.5 pr-4 text-ink/70">{p.cidade ?? "—"}</td>
              <td className="py-2.5 pr-4 text-ink/70">{p.estado ?? "—"}</td>
              <td className="py-2.5 text-ink/70">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function carregarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

type CidadeDetalhe = { cidade: string; estado: string; count: number };

function MapaBrasil({ topCidades, cidadesDetalhado }: { topCidades: [string, number][]; cidadesDetalhado: CidadeDetalhe[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [geocodificando, setGeocodificando] = useState(cidadesDetalhado.length > 0);

  useEffect(() => {
    let cancelado = false;
    async function desenhar() {
      // D3 e topojson não são dependências do projeto — carregados só
      // nessa tela específica, via CDN, sob demanda.
      await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js");
      await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js");
      if (cancelado) return;

      const d3lib = (window as any).d3;
      const topojsonlib = (window as any).topojson;
      if (!d3lib || !topojsonlib || !containerRef.current) return;

      // Coordenada real de cada cidade — geocodificada de verdade (com
      // cache no banco), nunca inventada. Cai pro centro do estado só
      // se a geocodificação dessa cidade específica falhar.
      let pontosCidade: { lat: number; lon: number; count: number }[] = [];
      if (cidadesDetalhado.length > 0) {
        const respGeo = await fetch("/api/admin/geocodificar-cidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cidades: cidadesDetalhado.map((c) => ({ cidade: c.cidade, estado: c.estado })) }),
        });
        const dadosGeo = await respGeo.json().catch(() => ({ cidades: [] }));
        if (cancelado) return;
        setGeocodificando(false);

        pontosCidade = (dadosGeo.cidades ?? [])
          .map((g: any, i: number) => ({ lat: g.latitude, lon: g.longitude, count: cidadesDetalhado[i].count }))
          .filter((p: any) => p.lat != null && p.lon != null);
      }

      const container = containerRef.current;
      container.innerHTML = "";
      const svg = d3lib.select(container).append("svg").attr("viewBox", "0 0 500 500").attr("width", "100%");
      const raiz = svg.append("g");

      const resp = await fetch("https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/bra.topo.json");
      const bra = await resp.json();
      if (cancelado) return;

      const features = topojsonlib.feature(bra, bra.objects.bra).features;
      const proj = d3lib.geoMercator().fitSize([480, 480], topojsonlib.feature(bra, bra.objects.bra));
      const path = d3lib.geoPath(proj);

      raiz.selectAll("path").data(features).join("path")
        .attr("d", path)
        .attr("stroke", "#fff").attr("stroke-width", 1)
        .attr("fill", "#7BC9A0");

      // Sigla de cada estado no centro geográfico dele (calculado pela
      // própria d3, nunca inventado) — nome completo não caberia nos
      // estados menores.
      raiz.selectAll("text.sigla-estado").data(features).join("text").attr("class", "sigla-estado")
        .attr("transform", (d: any) => { const c = path.centroid(d); return `translate(${c[0]},${c[1]})`; })
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("font-size", "7px").attr("font-weight", "500").attr("fill", "#04342C").attr("opacity", "0.55")
        .text((d: any) => siglaPorNome(d.properties.name));

      // Ponto na coordenada real de cada cidade (geocodificada) —
      // tamanho proporcional a quantos profissionais tem lá.
      const grupos = raiz.selectAll("g.ponto").data(pontosCidade).join("g").attr("class", "ponto")
        .attr("transform", (d: any) => { const c = proj([d.lon, d.lat]); return `translate(${c[0]},${c[1]})`; });

      grupos.append("circle")
        .attr("r", (d: any) => Math.max(4, Math.sqrt(d.count) * 2.5))
        .attr("fill", "#D85A30").attr("class", "pulso-anel-admin");
      grupos.append("circle")
        .attr("r", (d: any) => Math.max(4, Math.sqrt(d.count) * 2.5))
        .attr("fill", "#D85A30").attr("stroke", "#fff").attr("stroke-width", 2);

      const zoom = d3lib.zoom().scaleExtent([1, 8]).on("zoom", (event: any) => raiz.attr("transform", event.transform));
      svg.call(zoom);
    }
    desenhar();
    return () => { cancelado = true; };
  }, [cidadesDetalhado]);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl bg-ink/5 p-4 shadow-sm">
        <p className="mb-2 text-xs text-ink/40">
          {geocodificando ? "Localizando cidades..." : "Roda do mouse (ou pinça) pra ampliar · arraste pra mover"}
        </p>
        <div ref={containerRef} className="overflow-hidden rounded-lg" />
        <style>{`.pulso-anel-admin { animation: pulsarAdmin 2.2s ease-out infinite; transform-origin: center; transform-box: fill-box; } @keyframes pulsarAdmin { 0% { opacity: 0.55; transform: scale(1); } 100% { opacity: 0; transform: scale(2.6); } }`}</style>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Cidades com mais profissionais</p>
        <div className="space-y-2">
          {topCidades.length === 0 && <p className="text-sm text-ink/50">Sem dados de localização ainda.</p>}
          {topCidades.map(([cidade, n]) => (
            <div key={cidade} className="flex justify-between border-b border-ink/5 pb-1.5 text-sm">
              <span>{cidade}</span>
              <span className="font-medium">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Nome completo → sigla, só pra exibição no mapa (o nome completo vem
// da própria geografia real carregada, isso aqui só abrevia pra caber).
const NOME_PARA_SIGLA: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA",
  "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
  "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
  "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI",
  "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
  "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO",
};

function siglaPorNome(nomeCompleto: string): string {
  return NOME_PARA_SIGLA[nomeCompleto] ?? "";
}
