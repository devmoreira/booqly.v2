import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificacaoConfirmada } from "@/lib/verificacao-whatsapp";
import { telefoneParaE164 } from "@/lib/telefone";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body?.confirmacao !== "EXCLUIR MINHA CONTA" || typeof body?.codigoVerificacao !== "string") {
    return NextResponse.json({ erro: "Confirmação inválida. Digite EXCLUIR MINHA CONTA." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: perfil, error } = await admin.from("profissionais")
    .select("id, celular, telefone_contato, is_admin, conta_excluida")
    .eq("id", user.id).maybeSingle();
  if (error || !perfil) return NextResponse.json({ erro: "Conta profissional não encontrada." }, { status: 404 });
  if (perfil.is_admin) return NextResponse.json({ erro: "A conta administrativa não pode ser excluída por este fluxo." }, { status: 403 });
  if (perfil.conta_excluida) return NextResponse.json({ erro: "Esta conta já foi excluída." }, { status: 410 });

  const phone = perfil.celular || perfil.telefone_contato;
  const e164 = phone ? telefoneParaE164(phone) : null;
  if (!e164 || !(await verificacaoConfirmada(e164, body.codigoVerificacao))) {
    return NextResponse.json({ erro: "Confirme sua identidade pelo WhatsApp cadastrado. A verificação expira em 5 minutos." }, { status: 403 });
  }

  // Mantém o histórico operacional/financeiro para não romper vínculos de pagamentos,
  // notas e agendamentos. A conta é desativada e os dados de identificação do perfil
  // são anonimizados; registros legais/financeiros devem seguir a política de retenção.
  const { error: updateError } = await admin.from("profissionais").update({
    conta_excluida: true,
    conta_excluida_em: new Date().toISOString(),
    nome_negocio: "Estabelecimento desativado",
    slug: `conta-excluida-${user.id}`,
    endereco: "Não disponível", numero_endereco: null, complemento_endereco: null,
    bairro: null, cidade: "Não disponível", estado: "NA", instagram: null,
    foto_url: null, celular: null,
  }).eq("id", user.id);
  if (updateError) {
    console.error("Falha ao anonimizar conta profissional:", updateError);
    return NextResponse.json({ erro: "Não foi possível concluir a exclusão. Nenhuma sessão foi encerrada; contate o suporte." }, { status: 500 });
  }

  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    email: `excluida-${user.id}@conta-inativa.booqly.invalid`,
    ban_duration: "876000h",
    user_metadata: { conta_excluida: true },
  });
  if (authError) {
    console.error("Falha ao bloquear login da conta excluída:", authError);
    return NextResponse.json({ erro: "Os dados foram anonimizados, mas não foi possível bloquear o login. Contate o suporte imediatamente." }, { status: 500 });
  }
  await admin.from("verificacoes_whatsapp").delete().eq("telefone", e164).eq("codigo", body.codigoVerificacao);
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
