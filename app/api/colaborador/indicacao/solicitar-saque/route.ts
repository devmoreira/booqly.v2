// POST /api/colaborador/indicacao/solicitar-saque { pixChave, pixChaveTipo }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { solicitarSaque } from "@/lib/saque";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneParaE164 } from "@/lib/telefone";
import { verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

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
  const { data: colaborador } = await admin.from("colaboradores")
    .select("telefone, login_id, profissional_id").eq("id", user.id).maybeSingle();
  if (!colaborador) return NextResponse.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  let bruto = colaborador.telefone;
  if (!bruto && colaborador.login_id?.startsWith("principal-")) {
    const { data: profissional } = await admin.from("profissionais")
      .select("celular, telefone_contato").eq("id", colaborador.profissional_id).maybeSingle();
    bruto = profissional?.celular || profissional?.telefone_contato || null;
  }
  const telefone = bruto ? telefoneParaE164(bruto) : null;
  if (!telefone) return NextResponse.json({ erro: "Cadastre um WhatsApp válido antes de solicitar o saque." }, { status: 400 });

  if (!(await verificacaoConfirmada(telefone, validado.data.codigoVerificacao))) {
    return NextResponse.json({ erro: "Confirme este saque pelo WhatsApp antes de continuar." }, { status: 403 });
  }

  const resultado = await solicitarSaque("colaborador", user.id, validado.data.pixChave, validado.data.pixChaveTipo);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 400 });

  await admin.from("verificacoes_whatsapp").delete()
    .eq("telefone", telefone).eq("codigo", validado.data.codigoVerificacao);
  return NextResponse.json({ ok: true, valorCentavos: resultado.valorCentavos });
}
