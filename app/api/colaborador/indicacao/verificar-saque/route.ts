import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarVerificacaoWhatsapp, verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

async function colaboradorLogado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("colaboradores")
    .select("id, telefone, login_id, profissional_id")
    .eq("id", user.id).maybeSingle();
  if (!data) return null;

  // Para o registro principal, aceita o celular do próprio profissional.
  let bruto = data.telefone;
  if (!bruto && data.login_id?.startsWith("principal-")) {
    const { data: profissional } = await admin.from("profissionais")
      .select("celular, telefone_contato").eq("id", data.profissional_id).maybeSingle();
    bruto = profissional?.celular || profissional?.telefone_contato || null;
  }
  return { ...data, telefoneE164: bruto ? telefoneParaE164(bruto) : null };
}

export async function POST() {
  const colaborador = await colaboradorLogado();
  if (!colaborador) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  if (!colaborador.telefoneE164) {
    return NextResponse.json({ erro: "Cadastre um WhatsApp válido para este colaborador antes de solicitar o saque." }, { status: 400 });
  }
  const v = await criarVerificacaoWhatsapp(colaborador.telefoneE164);
  if (!v) return NextResponse.json({ erro: "Não foi possível iniciar a confirmação pelo WhatsApp." }, { status: 500 });
  return NextResponse.json({
    codigo: v.codigo,
    linkWhatsapp: v.linkWhatsapp,
    telefoneMascarado: `•••••${colaborador.telefoneE164.slice(-4)}`,
  });
}

export async function GET(req: NextRequest) {
  const colaborador = await colaboradorLogado();
  if (!colaborador) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo || !colaborador.telefoneE164) return NextResponse.json({ verificado: false });
  return NextResponse.json({ verificado: await verificacaoConfirmada(colaborador.telefoneE164, codigo) });
}
