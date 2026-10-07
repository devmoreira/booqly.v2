// Avisa o profissional (notificação push) quando um agendamento é
// criado de verdade. Compartilhado entre a rota de agendamento (fluxo
// sem pagamento) e o webhook do Asaas (fluxo com pagamento — só avisa
// depois que o pagamento confirma, não antes).
//
// Não usa WhatsApp nem e-mail aqui de propósito — WhatsApp tinha custo
// real por mensagem enviada, e o e-mail (Resend) foi removido do
// projeto. Notifica só por push, que é gratuito.
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacaoPushProfissional } from "@/lib/push";

export async function notificarNovoAgendamento(
  admin: ReturnType<typeof createAdminClient>,
  profissionalId: string,
  servicoId: string,
  nomeCliente: string,
  inicio: Date
) {
  const { data: servico } = await admin.from("servicos").select("nome").eq("id", servicoId).single();

  const linhaData = `${inicio.toLocaleDateString("pt-BR")} às ${inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  await enviarNotificacaoPushProfissional(profissionalId, {
    titulo: "Novo agendamento! 📅",
    corpo: `${servico?.nome ?? "Serviço"} — ${nomeCliente}, ${linhaData}. Toque pra confirmar.`,
    url: "/painel/agenda",
  }).catch((erro) => console.error("Falha ao enviar push de novo agendamento:", erro));
}
