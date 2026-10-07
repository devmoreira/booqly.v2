// GET /api/planos — lista pública dos planos ativos, pra tela de assinatura
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const db = createAdminClient();
  const { data } = await db
    .from("planos_assinatura")
    .select("id, nome, duracao_meses, valor_centavos, nivel")
    .eq("ativo", true)
    .order("duracao_meses");
  return NextResponse.json({ planos: data ?? [] });
}
