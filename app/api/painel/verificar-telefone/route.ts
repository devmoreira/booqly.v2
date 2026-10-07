// POST /api/painel/verificar-telefone — gera a verificação
// GET /api/painel/verificar-telefone?codigo= — confere se já confirmou
// Sempre usa o celular JÁ CADASTRADO do profissional logado (nunca um
// telefone vindo do corpo da requisição) — é isso que garante que só
// o dono de verdade da conta consegue confirmar.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarVerificacaoWhatsapp, verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

async function pegarTelefoneDoProfissional(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profissionais").select("celular, telefone_contato").eq("id", userId).maybeSingle();
  const bruto = data?.celular || data?.telefone_contato;
  return bruto ? telefoneParaE164(bruto) : null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const telefone = await pegarTelefoneDoProfissional(user.id);
  if (!telefone) {
    return NextResponse.json({ erro: "Você não tem um celular cadastrado. Adicione um na aba Estabelecimento antes de trocar a senha." }, { status: 400 });
  }

  const verificacao = await criarVerificacaoWhatsapp(telefone);
  if (!verificacao) return NextResponse.json({ erro: "Não foi possível gerar a verificação. Tente de novo." }, { status: 500 });

  return NextResponse.json({
    codigo: verificacao.codigo,
    linkWhatsapp: verificacao.linkWhatsapp,
    telefoneMascarado: `•••••${telefone.slice(-4)}`,
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) return NextResponse.json({ erro: "código não informado" }, { status: 400 });

  const telefone = await pegarTelefoneDoProfissional(user.id);
  if (!telefone) return NextResponse.json({ verificado: false });

  return NextResponse.json({ verificado: await verificacaoConfirmada(telefone, codigo) });
}
