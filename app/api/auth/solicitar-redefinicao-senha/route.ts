// POST /api/auth/solicitar-redefinicao-senha { loginId }
// Manda um e-mail de verificação (link do próprio Supabase, sem custo
// de terceiro) pro profissional confirmar que é ele mesmo antes de
// poder trocar a senha. Usado tanto em "esqueci minha senha" (sem
// estar logado) quanto em "trocar senha" dentro do painel (já logado,
// mas confirma de novo por segurança).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ loginId: z.string().min(2).max(60) });

function normalizarLoginId(valor: string): string {
  return valor.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Digite seu login" }, { status: 400 });

  const admin = createAdminClient();
  const loginIdNormalizado = normalizarLoginId(validado.data.loginId);
  const { data: dono } = await admin.from("profissionais").select("id").eq("slug", loginIdNormalizado).maybeSingle();
  if (!dono) {
    // Não diz se o login existe ou não — evita que alguém descubra
    // quais logins são de verdade só testando um por um.
    return NextResponse.json({ ok: true });
  }

  const { data: usuarioAuth } = await admin.auth.admin.getUserById(dono.id);
  const email = usuarioAuth?.user?.email;
  if (!email) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const origin = req.nextUrl.origin;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/redefinir-senha` });

  return NextResponse.json({ ok: true });
}
