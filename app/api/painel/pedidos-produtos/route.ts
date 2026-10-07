// GET/PUT /api/painel/pedidos-produtos — pedidos pagos aguardando
// retirada no estabelecimento, e marcar como retirado.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pedidos } = await admin
    .from("pedidos_produtos")
    .select("id, produto_nome, quantidade, valor_total_centavos, forma_pagamento, status, cliente_id, criado_em")
    .eq("profissional_id", user.id)
    .in("status", ["pago_aguardando_retirada", "retirado"])
    .order("criado_em", { ascending: false });

  const clienteIds = [...new Set((pedidos ?? []).map((p) => p.cliente_id))];
  const { data: clientes } = clienteIds.length > 0
    ? await admin.from("clientes").select("id, nome").in("id", clienteIds)
    : { data: [] };
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  const resultado = (pedidos ?? []).map((p) => ({
    id: p.id,
    produtoNome: p.produto_nome,
    quantidade: p.quantidade,
    valorTotalCentavos: p.valor_total_centavos,
    formaPagamento: p.forma_pagamento,
    status: p.status,
    clienteNome: mapaClientes.get(p.cliente_id) ?? "Cliente",
    criadoEm: p.criado_em,
  }));

  return NextResponse.json({ pedidos: resultado });
}

const schema = z.object({ id: z.string().uuid() });

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("pedidos_produtos")
    .update({ status: "retirado" })
    .eq("id", validado.data.id)
    .eq("profissional_id", user.id)
    .eq("status", "pago_aguardando_retirada");
  if (error) return NextResponse.json({ erro: "Não foi possível marcar como retirado." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
