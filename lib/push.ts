// Dispara notificação push de verdade pro navegador do cliente. Usa a
// biblioteca web-push, que cuida de toda a criptografia exigida pelo
// protocolo — a gente só monta o conteúdo e chama.
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configurado = false;
function garantirConfiguracao() {
  if (configurado) return;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas no .env");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@booqly.com.br",
    publica,
    privada
  );
  configurado = true;
}

export async function enviarNotificacaoPush(
  clienteId: string,
  payload: { titulo: string; corpo: string; url?: string }
) {
  garantirConfiguracao();
  const admin = createAdminClient();
  const { data: inscricoes } = await admin
    .from("inscricoes_push")
    .select("id, endpoint, chave_p256dh, chave_auth")
    .eq("cliente_id", clienteId);

  if (!inscricoes || inscricoes.length === 0) return; // cliente não ativou notificação em nenhum aparelho

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.chave_p256dh, auth: inscricao.chave_auth },
          },
          JSON.stringify(payload)
        );
      } catch (erro: any) {
        // 410/404 = essa inscrição não existe mais (cliente desinstalou,
        // limpou dados, etc.) — apaga do banco pra não tentar de novo
        if (erro?.statusCode === 410 || erro?.statusCode === 404) {
          await admin.from("inscricoes_push").delete().eq("id", inscricao.id);
        } else {
          console.error("Falha ao enviar notificação push:", erro?.message ?? erro);
        }
      }
    })
  );
}

export async function enviarNotificacaoPushProfissional(
  profissionalId: string,
  payload: { titulo: string; corpo: string; url?: string }
) {
  garantirConfiguracao();
  const admin = createAdminClient();
  const { data: inscricoes } = await admin
    .from("inscricoes_push_profissional")
    .select("id, endpoint, chave_p256dh, chave_auth")
    .eq("profissional_id", profissionalId);

  if (!inscricoes || inscricoes.length === 0) return; // profissional não ativou notificação em nenhum aparelho

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.chave_p256dh, auth: inscricao.chave_auth },
          },
          JSON.stringify(payload)
        );
      } catch (erro: any) {
        if (erro?.statusCode === 410 || erro?.statusCode === 404) {
          await admin.from("inscricoes_push_profissional").delete().eq("id", inscricao.id);
        } else {
          console.error("Falha ao enviar notificação push pro profissional:", erro?.message ?? erro);
        }
      }
    })
  );
}

// Manda a mesma notificação pra TODOS os clientes (ou todos os
// profissionais) que já ativaram push — usado pra anunciar cupom novo.
// Processa em blocos, pra não estourar muitas chamadas de uma vez só
// se a base for grande.
async function enviarParaTodasAsInscricoes(
  tabela: "inscricoes_push" | "inscricoes_push_profissional",
  payload: { titulo: string; corpo: string; url?: string }
) {
  garantirConfiguracao();
  const admin = createAdminClient();
  const { data: inscricoes } = await admin.from(tabela).select("id, endpoint, chave_p256dh, chave_auth");
  if (!inscricoes || inscricoes.length === 0) return;

  const TAMANHO_BLOCO = 50;
  for (let i = 0; i < inscricoes.length; i += TAMANHO_BLOCO) {
    const bloco = inscricoes.slice(i, i + TAMANHO_BLOCO);
    await Promise.all(
      bloco.map(async (inscricao) => {
        try {
          await webpush.sendNotification(
            { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.chave_p256dh, auth: inscricao.chave_auth } },
            JSON.stringify(payload)
          );
        } catch (erro: any) {
          if (erro?.statusCode === 410 || erro?.statusCode === 404) {
            await admin.from(tabela).delete().eq("id", inscricao.id);
          } else {
            console.error(`Falha ao enviar push em massa (${tabela}):`, erro?.message ?? erro);
          }
        }
      })
    );
  }
}

export async function enviarNotificacaoPushBroadcastClientes(payload: { titulo: string; corpo: string; url?: string }) {
  await enviarParaTodasAsInscricoes("inscricoes_push", payload);
}

export async function enviarNotificacaoPushBroadcastProfissionais(payload: { titulo: string; corpo: string; url?: string }) {
  await enviarParaTodasAsInscricoes("inscricoes_push_profissional", payload);
}
