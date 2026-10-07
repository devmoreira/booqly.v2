import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";

const schema = z.object({
  telefone: z.string().min(10).max(20),
});

function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return resposta({ erro: "Dados inválidos." }, 400);

  const telefone = telefoneParaE164(validado.data.telefone);
  if (!telefone) return resposta({ erro: "Celular inválido." }, 400);

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_CODIGO_TEMPLATE;
  const templateLanguage = process.env.WHATSAPP_CODIGO_TEMPLATE_LANGUAGE ?? "pt_BR";

  if (!phoneNumberId || !accessToken || !templateName) {
    console.error("[WhatsApp cadastro] Configuração de envio ausente.");
    return resposta({ erro: "O envio do código pelo WhatsApp ainda não está configurado no servidor." }, 500);
  }

  const admin = createAdminClient();
  const agora = Date.now();
  const sessentaSegundosAtras = new Date(agora - 60_000).toISOString();

  const { data: ultimo } = await admin
    .from("verificacoes_whatsapp")
    .select("criado_em")
    .eq("telefone", telefone)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo?.criado_em && new Date(ultimo.criado_em).getTime() > new Date(sessentaSegundosAtras).getTime()) {
    return resposta({ erro: "Aguarde 60 segundos antes de pedir um novo código." }, 429);
  }

  const codigoNumerico = String(randomInt(100000, 1000000));
  const codigo = `AGD-${codigoNumerico}`;

  const { error: erroInsercao } = await admin.from("verificacoes_whatsapp").insert({
    user_id: null,
    telefone,
    codigo,
    verificado_em: null,
  });

  if (erroInsercao) {
    console.error("[WhatsApp cadastro] Erro ao salvar código:", erroInsercao);
    return resposta({ erro: "Não foi possível gerar o código. Tente novamente." }, 500);
  }

  const url = `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: telefone.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: codigoNumerico }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: codigoNumerico }],
        },
      ],
    },
  };

  try {
    const metaResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const metaBody = await metaResponse.json().catch(() => null);

    if (!metaResponse.ok) {
      console.error("[WhatsApp cadastro] Meta recusou envio:", {
        status: metaResponse.status,
        erro: metaBody?.error?.message ?? "erro desconhecido",
        codigo: metaBody?.error?.code,
      });
      await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", codigo);
      return resposta({ erro: "A Meta não aceitou o envio do código. Verifique o modelo de autenticação do WhatsApp." }, 502);
    }

    console.info("[WhatsApp cadastro] Código enviado pelo WhatsApp.", {
      telefone,
      messageId: metaBody?.messages?.[0]?.id ?? null,
    });

    return resposta({ ok: true, expiracaoMinutos: 5 }, 200);
  } catch (erro) {
    console.error("[WhatsApp cadastro] Falha ao chamar a Meta:", erro);
    await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", codigo);
    return resposta({ erro: "Não foi possível enviar o código pelo WhatsApp." }, 502);
  }
}
