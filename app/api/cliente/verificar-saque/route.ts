// Verificação por WhatsApp antes de autorizar saque do "Indique um profissional" do cliente.
import { NextRequest, NextResponse } from "next/server";
import { getClienteLogado } from "@/lib/session-cliente";
import { telefoneParaE164 } from "@/lib/telefone";
import { criarVerificacaoWhatsapp, verificacaoConfirmada } from "@/lib/verificacao-whatsapp";

async function telefoneDoCliente() {
  const cliente = await getClienteLogado();
  if (!cliente) return { cliente: null, telefone: null };
  return { cliente, telefone: telefoneParaE164(cliente.telefone) };
}

export async function POST() {
  const { cliente, telefone } = await telefoneDoCliente();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  if (!telefone) return NextResponse.json({ erro: "O telefone cadastrado do cliente não é válido. Atualize seu cadastro antes de solicitar um saque." }, { status: 400 });

  const verificacao = await criarVerificacaoWhatsapp(telefone);
  if (!verificacao) return NextResponse.json({ erro: "Não foi possível iniciar a confirmação pelo WhatsApp." }, { status: 500 });

  return NextResponse.json({
    codigo: verificacao.codigo,
    linkWhatsapp: verificacao.linkWhatsapp,
    telefoneMascarado: `•••••${telefone.slice(-4)}`,
  });
}

export async function GET(req: NextRequest) {
  const { cliente, telefone } = await telefoneDoCliente();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo || !telefone) return NextResponse.json({ verificado: false });
  return NextResponse.json({ verificado: await verificacaoConfirmada(telefone, codigo) });
}
