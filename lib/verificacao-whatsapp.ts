// Compartilhado entre o login "esqueci senha" do profissional e a
// troca de senha dentro do painel — mesma tabela e mesmo webhook que
// já verificam o telefone do cliente no login (grátis: quem inicia a
// conversa é sempre a pessoa, nunca a gente).
import { createAdminClient } from "@/lib/supabase/admin";
import { randomInt } from "crypto";

function gerarCodigo(): string {
  return `AGD-${randomInt(100000, 1000000)}`;
}

export async function criarVerificacaoWhatsapp(telefoneE164: string) {
  const codigo = gerarCodigo();
  const admin = createAdminClient();
  const { error } = await admin.from("verificacoes_whatsapp").insert({ telefone: telefoneE164, codigo });
  if (error) {
    console.error("Erro ao criar verificação de WhatsApp:", error);
    return null;
  }

  const numeroWhatsappBooqly = process.env.WHATSAPP_NUMERO_VERIFICACAO;
  if (!numeroWhatsappBooqly) {
    console.error("WHATSAPP_NUMERO_VERIFICACAO não configurado.");
    return null;
  }

  const mensagem = encodeURIComponent(`Confirmar: ${codigo}`);
  return { codigo, linkWhatsapp: `https://wa.me/${numeroWhatsappBooqly}?text=${mensagem}` };
}

export async function verificacaoConfirmada(telefoneE164: string, codigo: string): Promise<boolean> {
  const admin = createAdminClient();
  const cincoMinutosAtras = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await admin
    .from("verificacoes_whatsapp")
    .select("verificado_em, criado_em")
    .eq("telefone", telefoneE164).eq("codigo", codigo)
    .maybeSingle();

  if (!data) return false;

  if (data.criado_em < cincoMinutosAtras) {
    await admin.from("verificacoes_whatsapp")
      .delete().eq("telefone", telefoneE164).eq("codigo", codigo);
    return false;
  }

  return !!data.verificado_em;
}
