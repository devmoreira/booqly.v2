// Comparação seguras de segredos (tokens, senhas de webhook/cron) —
// nunca usar !== direto pra isso. Comparação normal vaza, pela
// diferença mínima de tempo de resposta, quantos caracteres do início
// bateram, permitindo "adivinhar" o segredo aos poucos com tentativas
// suficientes. timingSafeEqual sempre leva o mesmo tempo.
import { timingSafeEqual } from "crypto";

export function segredosIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
