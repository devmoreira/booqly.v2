// POST /api/painel/revenda/solicitar-saque
// O saque só é criado depois da confirmação do celular cadastrado via WhatsApp.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { verificacaoConfirmada } from "@/lib/verificacao-whatsapp";
import { solicitarSaque } from "@/lib/saque";

const schema = z.object({
  pixChave: z.string().min(3).max(80),
  pixChaveTipo: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
  codigoVerificacao: z.string().regex(/^AGD-\d{6}$/),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profissionais").select("celular, telefone_contato").eq("id", user.id).maybeSingle();
  const bruto = perfil?.celular || perfil?.telefone_contato;
  const telefone = bruto ? telefoneParaE164(bruto) : null;
  if (!telefone) return NextResponse.json({ erro: "Celular cadastrado não encontrado." }, { status: 400 });

  const confirmado = await verificacaoConfirmada(telefone, validado.data.codigoVerificacao);
  if (!confirmado) return NextResponse.json({ erro: "Confirme este saque pelo WhatsApp antes de continuar." }, { status: 403 });

  const resultado = await solicitarSaque("profissional", user.id, validado.data.pixChave, validado.data.pixChaveTipo);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 400 });

  // Código de uso único: depois que o saque foi criado, não pode autorizar outro saque.
  await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", validado.data.codigoVerificacao);
  return NextResponse.json({ ok: true, valorCentavos: resultado.valorCentavos });
}
