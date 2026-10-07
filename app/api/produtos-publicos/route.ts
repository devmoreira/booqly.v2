// GET /api/produtos-publicos?slug=barbearia-do-joao
// Lista os produtos ativos e em estoque de um estabelecimento — só
// aparece pra quem tem Premium (a loja é exclusiva desse plano).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ erro: "slug obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profissional } = await admin.from("profissionais").select("id").eq("slug", slug).maybeSingle();
  if (!profissional) return NextResponse.json({ produtos: [] });

  const premium = await temAcessoPremium(profissional.id);
  if (!premium) return NextResponse.json({ produtos: [] });

  const { data } = await admin
    .from("produtos")
    .select("id, nome, preco_centavos, foto_url, estoque")
    .eq("profissional_id", profissional.id)
    .eq("ativo", true)
    .gt("estoque", 0)
    .order("criado_em");

  return NextResponse.json({ produtos: data ?? [] });
}
