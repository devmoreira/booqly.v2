// GET /api/cliente/verificar-status?telefone=&codigo=
// Chamada repetidamente pela tela de login enquanto espera o cliente
// mandar a mensagem no WhatsApp. Quando o webhook confirmar, aqui é
// onde a sessão de verdade é criada (mesma lógica que era feita na
// hora, antes de existir a verificação).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarSessaoCliente } from "@/lib/sessao-cliente";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const telefone = req.nextUrl.searchParams.get("telefone");
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!telefone || !codigo) return NextResponse.json({ erro: "dados inválidos" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const admin = createAdminClient();
  const { data: verificacao } = await admin
    .from("verificacoes_whatsapp")
    .select("telefone, nome, verificado_em, criado_em")
    .eq("telefone", telefone).eq("codigo", codigo)
    .maybeSingle();

  if (!verificacao) return NextResponse.json({ erro: "Código não encontrado. Peça um novo." }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const minutosDesdeGeracao = (Date.now() - new Date(verificacao.criado_em).getTime()) / 60_000;
  if (minutosDesdeGeracao >= 5) {
    await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", codigo);
    return NextResponse.json({ erro: "Esse código expirou após 5 minutos. Peça um novo." }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }

  if (!verificacao.verificado_em) return NextResponse.json({ verificado: false }, { headers: { "Cache-Control": "no-store" } });

  const resultado = await criarSessaoCliente(telefone, verificacao.nome);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 500, headers: { "Cache-Control": "no-store" } });

  await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", codigo);

  return NextResponse.json({ verificado: true }, { headers: { "Cache-Control": "no-store" } });
}
