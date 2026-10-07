// GET /api/painel/avaliacoes-cliente?clienteId=...
// Reputação do cliente é cruzada entre estabelecimentos (tipo Uber) —
// qualquer profissional/colaborador logado pode consultar.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) return NextResponse.json({ erro: "clienteId obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: avaliacoes } = await admin
    .from("avaliacoes_cliente")
    .select("nota, comentario, criado_em, profissional_id")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });

  const profissionalIds = [...new Set((avaliacoes ?? []).map((a) => a.profissional_id))];
  const { data: profissionais } = profissionalIds.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio").in("id", profissionalIds)
    : { data: [] as { id: string; nome_negocio: string }[] };
  const mapaProfissionais = new Map((profissionais ?? []).map((p) => [p.id, p.nome_negocio]));

  const lista = (avaliacoes ?? []).map((a) => ({
    nota: a.nota,
    comentario: a.comentario,
    criadoEm: a.criado_em,
    estabelecimento: mapaProfissionais.get(a.profissional_id) ?? "Estabelecimento",
  }));

  return NextResponse.json({ avaliacoes: lista });
}
