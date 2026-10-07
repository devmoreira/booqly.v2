// Criptografia da chave de API de pagamento de cada profissional. Usa
// AES-256-GCM com uma chave secreta que fica SÓ na variável de ambiente
// (nunca no banco) — mesmo se o banco vazar, a chave de ninguém fica
// exposta sem essa senha mestra, que só existe no seu servidor.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function pegarChaveSecreta(): Buffer {
  const segredo = process.env.CHAVE_CRIPTOGRAFIA_PAGAMENTOS;
  if (!segredo) throw new Error("CHAVE_CRIPTOGRAFIA_PAGAMENTOS não configurada no .env");
  return scryptSync(segredo, "agendify-salt-fixo", 32);
}

export function criptografar(textoPuro: string): string {
  const chave = pegarChaveSecreta();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave, iv);
  const criptografado = Buffer.concat([cipher.update(textoPuro, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Guarda tudo junto, separado por ":", em base64 — fácil de armazenar numa coluna text
  return [iv.toString("base64"), tag.toString("base64"), criptografado.toString("base64")].join(":");
}

export function descriptografar(textoCriptografado: string): string {
  const [ivB64, tagB64, dadosB64] = textoCriptografado.split(":");
  const chave = pegarChaveSecreta();
  const decipher = createDecipheriv("aes-256-gcm", chave, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decriptografado = Buffer.concat([decipher.update(Buffer.from(dadosB64, "base64")), decipher.final()]);
  return decriptografado.toString("utf8");
}
