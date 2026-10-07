"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BotaoLocalizacao } from "./BotaoLocalizacao";

// Carregada uma vez por sessão do navegador (compartilhada entre todas
// as instâncias da busca) — assim não precisa buscar de novo toda hora.
let CATEGORIAS: { valor: string; rotulo: string; sinonimos: string[] }[] = [];
let categoriasCarregando: Promise<void> | null = null;
function garantirCategoriasCarregadas(): Promise<void> {
  if (CATEGORIAS.length > 0) return Promise.resolve();
  if (!categoriasCarregando) {
    categoriasCarregando = fetch("/api/categorias-servico")
      .then((r) => r.json())
      .then((d) => { CATEGORIAS = d.categorias ?? []; });
  }
  return categoriasCarregando;
}

type Sugestao = { cidade: string; estado: string };
type Resultado = { nome_negocio: string; slug: string; categoria: string; cidade: string; estado: string };

// Entende vários jeitos de digitar:
// "Guarapari, barbearia" (com vírgula) · "guarapari barbearia" (sem
// vírgula) · "barbeiro" sozinho (reconhece como sinônimo de barbearia,
// busca em qualquer cidade) · ou só a cidade (mostra sugestões pra completar).
function interpretarBusca(textoBruto: string) {
  const texto = textoBruto.trim();
  if (!texto) return { cidade: "", categoria: "", pronto: false };

  if (texto.includes(",")) {
    const [parteCidade, parteServico] = texto.split(",");
    const cidade = parteCidade.trim();
    const servicoDigitado = (parteServico ?? "").trim().toLowerCase();
    const achada = servicoDigitado
      ? CATEGORIAS.find((c) => [c.rotulo.toLowerCase(), ...c.sinonimos].some((s) => servicoDigitado.includes(s) || s.includes(servicoDigitado)))
      : undefined;
    return { cidade, categoria: achada?.valor ?? "", pronto: true };
  }

  const textoMin = texto.toLowerCase();
  let categoriaEncontrada: typeof CATEGORIAS[number] | undefined;
  let sinonimoUsado = "";
  for (const c of CATEGORIAS) {
    const encontrado = [c.rotulo.toLowerCase(), ...c.sinonimos].find((s) => textoMin.includes(s));
    if (encontrado) { categoriaEncontrada = c; sinonimoUsado = encontrado; break; }
  }

  if (categoriaEncontrada) {
    // Tira o sinônimo do meio do texto — o que sobrar é a cidade
    // (pode sobrar vazio, e aí a busca é só pelo serviço, em qualquer lugar)
    const cidade = textoMin.replace(sinonimoUsado, "").trim();
    return { cidade, categoria: categoriaEncontrada.valor, pronto: true };
  }

  // Nada reconhecido como serviço — trata tudo como cidade (mostra sugestões)
  return { cidade: texto, categoria: "", pronto: false };
}

export function BuscaOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [categoriaManual, setCategoriaManual] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [, forcarAtualizacao] = useState(0);

  useEffect(() => {
    garantirCategoriasCarregadas().then(() => forcarAtualizacao((n) => n + 1));
  }, []);

  const { cidade, categoria: categoriaDetectada, pronto } = interpretarBusca(texto);
  const categoria = categoriaManual ?? categoriaDetectada;

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPainelAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  // Ainda não reconheceu um serviço no texto: mostra sugestão de cidade
  useEffect(() => {
    if (pronto) { setSugestoes([]); return; }
    if (cidade.length < 2) { setSugestoes([]); setResultados(null); return; }
    const atraso = setTimeout(() => {
      fetch(`/api/sugestoes-cidades?prefixo=${encodeURIComponent(cidade)}`)
        .then((r) => r.json())
        .then((d) => setSugestoes(d.cidades ?? []));
    }, 250);
    return () => clearTimeout(atraso);
  }, [cidade, pronto]);

  // Já reconheceu cidade e/ou serviço o suficiente: busca direto
  useEffect(() => {
    if (!pronto) return;
    if (!cidade && !categoria) return; // nada reconhecível ainda
    setCarregando(true);
    const atraso = setTimeout(() => {
      const params = new URLSearchParams();
      if (cidade) params.set("cidade", cidade);
      if (categoria) params.set("categoria", categoria);
      fetch(`/api/buscar-estabelecimentos?${params}`)
        .then((r) => r.json())
        .then((d) => setResultados(d.resultados ?? []))
        .finally(() => setCarregando(false));
    }, 350);
    return () => clearTimeout(atraso);
  }, [cidade, categoria, pronto]);

  function escolherCidade(cidadeEscolhida: string) {
    setTexto(`${cidadeEscolhida}, `); // já deixa pronto pra continuar digitando o serviço
    setCategoriaManual(null);
    setSugestoes([]);
  }

  function usarLocalizacao(cidadeDetectada: string) {
    setTexto(`${cidadeDetectada}, `);
    setCategoriaManual(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border-[1.5px] border-ink/15 bg-surface px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.72 11.24 7.01 11.49a1.5 1.5 0 0 0 1.98 0C13.28 21.24 20 15.25 20 10c0-4.42-3.58-8-8-8z" fill="var(--brand)" />
            <circle cx="12" cy="10" r="3" fill="white" />
          </svg>
          <input
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setCategoriaManual(null); }}
            onFocus={() => setPainelAberto(true)}
            placeholder="cidade, serviço"
            suppressHydrationWarning
            className="w-full min-w-0 text-base outline-none"
          />
        </div>
        <button
          onClick={() => setPainelAberto(true)}
          className="shrink-0 whitespace-nowrap rounded-lg bg-brand px-4 py-3 text-base font-medium text-[var(--brand-fg)] sm:px-8 sm:py-4"
        >
          Buscar
        </button>
      </div>

      {painelAberto && (cidade.length > 0 || categoria) && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[70vh] overflow-y-auto rounded-xl2 border border-ink/10 bg-surface p-3 shadow-lg">
          {!pronto ? (
            <>
              <div className="px-2 pb-2">
                <BotaoLocalizacao aoDetectar={usarLocalizacao} />
              </div>
              {sugestoes.map((s) => (
                <button
                  key={`${s.cidade}-${s.estado}`}
                  onClick={() => escolherCidade(s.cidade)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink/5"
                >
                  <span className="text-ink/40">📍</span>
                  <span>
                    <span className="block text-sm font-medium">{s.cidade}</span>
                    <span className="block text-xs text-ink/50">{s.estado}, Brasil</span>
                  </span>
                </button>
              ))}
              {cidade.length >= 2 && sugestoes.length === 0 && (
                <p className="px-2 py-2 text-sm text-ink/50">Nenhuma cidade encontrada ainda.</p>
              )}
              <p className="px-2 pt-1 text-xs text-ink/40">Dica: digite "{cidade}, barbearia" pra já filtrar pelo serviço</p>
            </>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto px-2 pb-2">
                <button
                  onClick={() => setCategoriaManual("")}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${categoria === "" ? "border-brand bg-brand/10" : "border-ink/15"}`}
                >
                  Todas
                </button>
                {CATEGORIAS.map((c) => (
                  <button
                    key={c.valor} onClick={() => setCategoriaManual(c.valor)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${categoria === c.valor ? "border-brand bg-brand/10" : "border-ink/15"}`}
                  >
                    {c.rotulo}
                  </button>
                ))}
              </div>
              {carregando && <p className="px-2 py-2 text-sm text-ink/50">Buscando...</p>}
              {!carregando && resultados !== null && resultados.length === 0 && (
                <p className="px-2 py-2 text-sm text-ink/50">
                  {cidade ? `Nenhum estabelecimento encontrado em "${cidade}" ainda.` : "Nenhum estabelecimento encontrado ainda."}
                </p>
              )}
              {(resultados ?? []).map((r) => (
                <Link
                  key={r.slug} href={`/${r.slug}`} onClick={() => setPainelAberto(false)}
                  className="block rounded-lg px-2 py-2 hover:bg-ink/5"
                >
                  <p className="text-sm font-medium">{r.nome_negocio}</p>
                  <p className="text-xs text-ink/50">
                    {CATEGORIAS.find((c) => c.valor === r.categoria)?.rotulo ?? r.categoria} — {r.cidade}/{r.estado}
                  </p>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
