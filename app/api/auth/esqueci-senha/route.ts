// POST { loginId } — inicia a verificação
// GET ?loginId=&codigo= — confere se já confirmou
// PUT { loginId, codigo, novaSenha } — define a nova senha (só se
// a verificação daquele loginId realmente confirmou antes)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarVerificacaoWhatsapp, verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

async function pegarProfissionalPorLogin(loginId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profissionais").select("id, celular, telefone_contato").eq("slug", loginId).maybeSingle();
  if (!data) return null;
  const bruto = data.celular || data.telefone_contato;
  const telefone = bruto ? telefoneParaE164(bruto) : null;
  return telefone ? { id: data.id, telefone } : null;
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = z.object({ loginId: z.string().min(1) }).safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const profissional = await pegarProfissionalPorLogin(validado.data.loginId);
  if (!profissional) {
    return NextResponse.json({ erro: "Não encontramos essa conta, ou ela não tem celular cadastrado. Fale com o suporte." }, { status: 404 });
  }

  const verificacao = await criarVerificacaoWhatsapp(profissional.telefone);
  if (!verificacao) return NextResponse.json({ erro: "Não foi possível gerar a verificação. Tente de novo." }, { status: 500 });

  return NextResponse.json({
    codigo: verificacao.codigo,
    linkWhatsapp: verificacao.linkWhatsapp,
    telefoneMascarado: `•••••${profissional.telefone.slice(-4)}`,
  });
}

export async function GET(req: NextRequest) {
  const loginId = req.nextUrl.searchParams.get("loginId");
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!loginId || !codigo) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const profissional = await pegarProfissionalPorLogin(loginId);
  if (!profissional) return NextResponse.json({ verificado: false });

  return NextResponse.json({ verificado: await verificacaoConfirmada(profissional.telefone, codigo) });
}

const schemaSenha = z.object({
  loginId: z.string().min(1),
  codigo: z.string().min(1),
  novaSenha: z.string().min(8),
});

export async function PUT(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schemaSenha.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Preencha tudo — a senha precisa ter pelo menos 8 caracteres." }, { status: 400 });

  const profissional = await pegarProfissionalPorLogin(validado.data.loginId);
  if (!profissional) return NextResponse.json({ erro: "Conta não encontrada" }, { status: 404 });

  const confirmado = await verificacaoConfirmada(profissional.telefone, validado.data.codigo);
  if (!confirmado) return NextResponse.json({ erro: "Verificação ainda não confirmada pelo WhatsApp" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profissional.id, { password: validado.data.novaSenha });
  if (error) return NextResponse.json({ erro: `Não foi possível trocar a senha: ${error.message}` }, { status: 400 });

  // Verificação de uso único — apaga depois de usada, pra ninguém
  // reaproveitar o mesmo código depois.
  await admin.from("verificacoes_whatsapp").delete().eq("telefone", profissional.telefone).eq("codigo", validado.data.codigo);

  return NextResponse.json({ ok: true });
}
