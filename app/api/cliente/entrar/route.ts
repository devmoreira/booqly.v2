// POST /api/cliente/entrar { telefone, nome? }
// Não loga direto — gera um código e devolve o link do WhatsApp pra o
// CLIENTE mandar a mensagem de verificação (grátis, ele que inicia a
// conversa). O login de verdade só acontece depois, quando o webhook
// confirma que a mensagem chegou (ver /api/cliente/verificar-status).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarSessaoCliente } from "@/lib/sessao-cliente";

const schema = z.object({
  telefone: z.string().min(8).max(20),
  nome: z.string().min(2).max(120).optional(),
});

function gerarCodigo(): string {
  return `AGD-${randomInt(100000, 1000000)}`;
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Digite um telefone válido" }, { status: 400 });

  const telefoneValidado = telefoneParaE164(validado.data.telefone);
  if (!telefoneValidado) return NextResponse.json({ erro: "Telefone inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existente } = await admin
    .from("clientes")
    .select("id")
    .eq("telefone", telefoneValidado)
    .maybeSingle();

  if (!existente && !validado.data.nome) {
    // Primeira vez com esse telefone — a tela precisa pedir o nome antes.
    return NextResponse.json({ precisaNome: true });
  }

  const numeroWhatsappBooqly = process.env.WHATSAPP_NUMERO_VERIFICACAO;

  // Modo de contingência: enquanto o número de WhatsApp comercial não
  // estiver configurado (ex: durante a configuração inicial na Meta),
  // volta a logar direto, sem verificação — do jeito que era antes
  // dessa funcionalidade existir. Assim que a variável de ambiente for
  // configurada, a verificação volta a valer sozinha, sem precisar
  // mexer em mais nada.
  if (!numeroWhatsappBooqly) {
    if (process.env.NODE_ENV === "production") {
      console.error("WHATSAPP_NUMERO_VERIFICACAO não configurado — login do cliente recusado em produção por segurança.");
      return NextResponse.json({ erro: "O login por WhatsApp está temporariamente indisponível." }, { status: 503 });
    }
    console.warn("WHATSAPP_NUMERO_VERIFICACAO não configurado — login direto permitido apenas em desenvolvimento.");
    const resultado = await criarSessaoCliente(telefoneValidado, validado.data.nome);
    if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
    return NextResponse.json({ logadoDireto: true });
  }

  const codigo = gerarCodigo();
  const { error } = await admin.from("verificacoes_whatsapp").insert({
    telefone: telefoneValidado,
    codigo,
    nome: existente ? null : validado.data.nome,
  });
  if (error) {
    console.error("Erro ao criar verificação de WhatsApp:", error);
    return NextResponse.json({ erro: "Não foi possível gerar a verificação" }, { status: 500 });
  }

  const mensagem = encodeURIComponent(`Confirmar cadastro: ${codigo}`);
  const linkWhatsapp = `https://wa.me/${numeroWhatsappBooqly}?text=${mensagem}`;

  return NextResponse.json({ precisaVerificar: true, codigo, telefone: telefoneValidado, linkWhatsapp });
}
