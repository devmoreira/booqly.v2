// Filtros de conteúdo pra Comunidade: palavrão e link fora da lista
// permitida (só YouTube e Instagram). Usado antes de salvar post ou
// comentário — cada bloqueio devolve um motivo pra mostrar pra pessoa.

const PALAVROES = [
  "porra", "caralho", "merda", "puta", "cuzao", "cuzão", "buceta", "arrombado",
  "viado", "cacete", "foder", "fodase", "foda-se", "desgraça", "otario", "otário",
  "idiota", "imbecil", "retardado", "burro",
];

export function contemPalavrao(texto: string): boolean {
  const normalizado = texto.toLowerCase();
  return PALAVROES.some((p) => normalizado.includes(p));
}

export function censurarPalavroes(texto: string): string {
  let resultado = texto;
  for (const p of PALAVROES) {
    const regex = new RegExp(p, "gi");
    resultado = resultado.replace(regex, "*".repeat(p.length));
  }
  return resultado;
}

const DOMINIOS_PERMITIDOS = ["youtube.com", "youtu.be", "instagram.com"];

// Devolve o primeiro link que NÃO é permitido, ou null se todos os
// links do texto (se houver algum) forem do YouTube/Instagram.
export function linkNaoPermitido(texto: string): string | null {
  const urls = texto.match(/https?:\/\/[^\s]+/gi) ?? [];
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const permitido = DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith("." + d));
      if (!permitido) return url;
    } catch {
      return url; // não parseou como URL válida — trata como não permitido, por segurança
    }
  }
  return null;
}
