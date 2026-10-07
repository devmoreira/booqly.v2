// POST /api/painel/lembrete-inativos { mensagem }
// Manda um push em massa pra TODOS os clientes que já tiveram
// atendimento concluído aqui, sem filtro de dias — recurso exclusivo
// do plano Premium. (O filtro por dias sem visitar existe só na
// versão automática, configurável em outra seção dessa mesma tela.)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";
import { enviarNotificacaoPush } from "@/lib/push";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  return NextResponse.json({ premium: await temAcessoPremium(user.id) });
}

const schema = z.object({
  mensagem: z.string().min(5).max(180).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  if (!(await temAcessoPremium(user.id))) {
    return NextResponse.json({ erro: "Enviar lembrete em massa é um recurso do plano Premium." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) {
    return NextResponse.json({ erro: validado.error.errors[0]?.message === "String must contain at least 5 character(s)"
      ? "A mensagem precisa ter pelo menos 5 caracteres, ou deixe em branco pra usar a padrão."
      : "dados inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profissional } = await admin.from("profissionais").select("nome_negocio").eq("id", user.id).single();

  // Todo cliente que já teve atendimento concluído aqui, sem repetir.
  const { data: agendamentos } = await admin
    .from("agendamentos")
    .select("cliente_id")
    .eq("profissional_id", user.id)
    .eq("status", "concluido");

  const clientesAlvo = [...new Set((agendamentos ?? []).map((a) => a.cliente_id))];

  const corpoMensagem = validado.data.mensagem?.trim()
    || `Faz um tempinho que você não aparece aqui na ${profissional?.nome_negocio ?? "gente"} — que tal marcar um horário?`;

  let enviados = 0;
  for (const clienteId of clientesAlvo) {
    try {
      await enviarNotificacaoPush(clienteId, {
        titulo: `${profissional?.nome_negocio ?? "Seu estabelecimento"} sentiu sua falta! 👋`,
        corpo: corpoMensagem,
        url: `/`,
      });
      enviados++;
    } catch (erro) {
      console.error(`Falha ao enviar lembrete pro cliente ${clienteId}:`, erro);
    }
  }

  return NextResponse.json({ ok: true, totalClientesInativos: clientesAlvo.length, enviados });
}
