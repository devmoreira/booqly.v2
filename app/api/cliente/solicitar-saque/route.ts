// POST /api/cliente/solicitar-saque { pixChave, pixChaveTipo }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClienteLogado } from "@/lib/session-cliente";
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
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const telefone = telefoneParaE164(cliente.telefone);
  if (!telefone) return NextResponse.json({ erro: "Telefone cadastrado inválido." }, { status: 400 });

  const confirmado = await verificacaoConfirmada(telefone, validado.data.codigoVerificacao);
  if (!confirmado) return NextResponse.json({ erro: "Confirme este saque pelo WhatsApp antes de continuar." }, { status: 403 });

  const resultado = await solicitarSaque("cliente", cliente.id, validado.data.pixChave, validado.data.pixChaveTipo);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 400 });

  // Código de uso único: não pode autorizar um segundo saque.
  const admin = createAdminClient();
  await admin.from("verificacoes_whatsapp").delete()
    .eq("telefone", telefone)
    .eq("codigo", validado.data.codigoVerificacao);

  return NextResponse.json({ ok: true, valorCentavos: resultado.valorCentavos });
}
