// GET/POST /api/webhooks/whatsapp
// GET: verificação inicial exigida pela Meta ao cadastrar o webhook.
// POST: recebe as mensagens de verdade e confirma códigos de login enviados pelo cliente.
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredosIguais } from "@/lib/comparar-segredo";

export const runtime = "nodejs";

function respostaSemCache(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function extrairMensagens(corpo: any): any[] {
  const mensagens: any[] = [];

  for (const entry of Array.isArray(corpo?.entry) ? corpo.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (Array.isArray(value?.messages)) {
        mensagens.push(...value.messages);
      }
    }
  }

  return mensagens;
}

export async function GET(req: NextRequest) {
  const modo = req.nextUrl.searchParams.get("hub.mode");
  const tokenRecebido = req.nextUrl.searchParams.get("hub.verify_token");
  const desafio = req.nextUrl.searchParams.get("hub.challenge");

  const tokenEsperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!tokenEsperado) {
    console.error("[WhatsApp webhook] WHATSAPP_VERIFY_TOKEN não configurado.");
    return respostaSemCache({ erro: "webhook não configurado" }, 500);
  }

  if (modo === "subscribe" && tokenRecebido && segredosIguais(tokenRecebido, tokenEsperado)) {
    console.info("[WhatsApp webhook] Verificação GET da Meta concluída com sucesso.");
    return new Response(desafio ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  console.error("[WhatsApp webhook] Verificação GET da Meta recusada: token inválido ou parâmetros ausentes.");
  return respostaSemCache({ erro: "não autorizado" }, 403);
}

export async function POST(req: NextRequest) {
  console.info("[WhatsApp webhook] POST recebido da Meta.");

  const corpoTexto = await req.text();

  // A Meta assina todo POST com HMAC-SHA256 do corpo, usando o App Secret.
  // Sem essa validação, qualquer pessoa poderia fingir que confirmou um código.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[WhatsApp webhook] WHATSAPP_APP_SECRET não configurado — POST recusado.");
    return respostaSemCache({ erro: "webhook não configurado" }, 500);
  }

  const assinaturaRecebida = req.headers
    .get("x-hub-signature-256")
    ?.replace(/^sha256=/i, "")
    .trim() ?? "";

  const assinaturaEsperada = createHmac("sha256", appSecret)
    .update(corpoTexto)
    .digest("hex");

  if (!assinaturaRecebida || !segredosIguais(assinaturaRecebida, assinaturaEsperada)) {
    console.error("[WhatsApp webhook] Assinatura inválida — mensagem ignorada.");
    return respostaSemCache({ erro: "não autorizado" }, 403);
  }

  let corpo: any;
  try {
    corpo = JSON.parse(corpoTexto);
  } catch {
    console.error("[WhatsApp webhook] POST recebido, mas o corpo não é JSON válido.");
    return respostaSemCache({ ok: true });
  }

  try {
    const mensagens = extrairMensagens(corpo);

    console.info(`[WhatsApp webhook] Payload válido. ${mensagens.length} mensagem(ns) encontrada(s).`);

    // Eventos de status (sent/delivered/read) também chegam no webhook,
    // mas não possuem value.messages. Eles devem ser reconhecidos e ignorados.
    if (mensagens.length === 0) {
      const quantidadeStatus = Array.isArray(corpo?.entry)
        ? corpo.entry.reduce((total: number, entry: any) => {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            return total + changes.reduce(
              (subtotal: number, change: any) =>
                subtotal + (Array.isArray(change?.value?.statuses) ? change.value.statuses.length : 0),
              0,
            );
          }, 0)
        : 0;

      if (quantidadeStatus > 0) {
        console.info(`[WhatsApp webhook] ${quantidadeStatus} atualização(ões) de status recebida(s).`);
      } else {
        console.info("[WhatsApp webhook] Evento recebido sem messages/statuses relevantes para o login.");
      }

      return respostaSemCache({ ok: true });
    }

    const admin = createAdminClient();
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60_000).toISOString();

    for (const msg of mensagens) {
      const numeroBruto = String(msg?.from ?? "").replace(/\D/g, "");
      const telefoneRemetente = numeroBruto ? `+${numeroBruto}` : "";
      const tipoMensagem = String(msg?.type ?? "");
      const texto = String(msg?.text?.body ?? "").trim();

      console.info(
        `[WhatsApp webhook] Mensagem recebida: tipo=${tipoMensagem || "desconhecido"}, telefone=${telefoneRemetente || "não informado"}.`,
      );

      if (!telefoneRemetente) {
        console.warn("[WhatsApp webhook] Mensagem ignorada: remetente sem número de telefone.");
        continue;
      }

      // Aceita: AGD-123456, AGD 123456, AGD123456 e AGD:123456.
      const codigoEncontrado = texto.match(/\bAGD\s*[-:]?\s*(\d{6})\b/i)?.[1];
      if (!codigoEncontrado) {
        console.info("[WhatsApp webhook] Nenhum código AGD de 6 dígitos encontrado na mensagem.");
        continue;
      }

      const codigo = `AGD-${codigoEncontrado}`;
      const agora = new Date().toISOString();

      const { data: atualizados, error } = await admin
        .from("verificacoes_whatsapp")
        .update({ verificado_em: agora })
        .eq("telefone", telefoneRemetente)
        .eq("codigo", codigo)
        .gte("criado_em", cincoMinutosAtras)
        .is("verificado_em", null)
        .select("id");

      if (error) {
        console.error("[WhatsApp webhook] Erro ao atualizar verificacoes_whatsapp:", error);
        continue;
      }

      const quantidadeAtualizada = atualizados?.length ?? 0;

      if (quantidadeAtualizada > 0) {
        console.info(
          `[WhatsApp webhook] SUCESSO: código ${codigo} confirmado para ${telefoneRemetente}.`,
        );
      } else {
        console.warn(
          `[WhatsApp webhook] Código ${codigo} recebido de ${telefoneRemetente}, mas nenhuma verificação pendente foi encontrada dentro dos últimos 5 minutos.`,
        );
      }
    }
  } catch (erro) {
    console.error("[WhatsApp webhook] Erro ao processar payload:", erro);
  }

  // A Meta espera 200 para não ficar reenviando o mesmo evento indefinidamente.
  return respostaSemCache({ ok: true });
}
