// GET /api/categorias-servico
// Lista pública das categorias de serviço ativas — usada no cadastro
// do profissional e na busca (autocomplete + rótulos).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categorias_servico")
    .select("valor, rotulo, sinonimos")
    .eq("ativo", true)
    .order("rotulo");
  return NextResponse.json({ categorias: data ?? [] });
}
