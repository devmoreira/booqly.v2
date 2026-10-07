// GET/PUT /api/painel/lembrete-inativos/automatico
// Configuração do lembrete que dispara SOZINHO (via cron), diferente
// do manual — profissional configura uma vez e esquece.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("configuracoes_lembrete_automatico")
    .select("ativo, dias_sem_visita, mensagem")
    .eq("profissional_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ativo: data?.ativo ?? false,
    diasSemVisita: data?.dias_sem_visita ?? 60,
    mensagem: data?.mensagem ?? "",
  });
}

const schema = z.object({
  ativo: z.boolean(),
  diasSemVisita: z.number().int().min(7).max(365),
  mensagem: z.string().max(180).optional(),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  if (!(await temAcessoPremium(user.id))) {
    return NextResponse.json({ erro: "Lembrete automático é um recurso do plano Premium." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("configuracoes_lembrete_automatico").upsert({
    profissional_id: user.id,
    ativo: validado.data.ativo,
    dias_sem_visita: validado.data.diasSemVisita,
    mensagem: validado.data.mensagem || null,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
