// POST /api/painel/push/inscrever { endpoint, keys: { p256dh, auth } }
// Salva a inscrição de notificação push do profissional logado — mesmo
// padrão de segurança do lado do cliente (nunca aceita um ID vindo da
// tela, sempre usa quem está de verdade autenticado na sessão).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("inscricoes_push_profissional").upsert({
    profissional_id: user.id,
    endpoint: validado.data.endpoint,
    chave_p256dh: validado.data.keys.p256dh,
    chave_auth: validado.data.keys.auth,
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ erro: "Não foi possível ativar as notificações" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
