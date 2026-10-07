// Verificação por WhatsApp antes de autorizar saque do "Indique e ganhe".
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarVerificacaoWhatsapp, verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

async function telefoneDoProfissional(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profissionais").select("celular, telefone_contato").eq("id", userId).maybeSingle();
  const bruto = data?.celular || data?.telefone_contato;
  return bruto ? telefoneParaE164(bruto) : null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const telefone = await telefoneDoProfissional(user.id);
  if (!telefone) return NextResponse.json({ erro: "Cadastre seu celular em Configurações antes de solicitar um saque." }, { status: 400 });

  const verificacao = await criarVerificacaoWhatsapp(telefone);
  if (!verificacao) return NextResponse.json({ erro: "Não foi possível iniciar a confirmação pelo WhatsApp." }, { status: 500 });
  return NextResponse.json({ codigo: verificacao.codigo, linkWhatsapp: verificacao.linkWhatsapp, telefoneMascarado: `•••••${telefone.slice(-4)}` });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) return NextResponse.json({ erro: "código não informado" }, { status: 400 });
  const telefone = await telefoneDoProfissional(user.id);
  if (!telefone) return NextResponse.json({ verificado: false });
  return NextResponse.json({ verificado: await verificacaoConfirmada(telefone, codigo) });
}
