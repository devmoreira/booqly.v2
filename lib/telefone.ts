// Valida e formata telefone brasileiro — usado tanto na tela (cliente
// digitando) quanto no servidor (nunca confiar só na validação do
// navegador). O cliente digita só DDD + número, sem precisar saber
// que por trás disso vira o formato internacional +55...
export function formatarTelefoneParaExibicao(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

// Converte pro formato final (+55DDDNUMERO) e confere se tem a
// quantidade certa de dígitos — retorna null se estiver incompleto ou
// errado (nunca deixa passar "123" ou um número com dígitos demais).
export function telefoneParaE164(valor: string): string | null {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && digitos.length > 11) digitos = digitos.slice(2);
  // DDD (2 dígitos) + número: 8 dígitos (fixo) ou 9 dígitos (celular)
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  const ddd = digitos.slice(0, 2);
  if (Number(ddd) < 11 || Number(ddd) > 99) return null; // DDDs válidos no Brasil vão de 11 a 99
  return `+55${digitos}`;
}
