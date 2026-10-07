// GET /api/buscar-estabelecimentos?cidade=&categoria=
// Pública — usada pelo overlay de busca da home, sem recarregar a página.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const cidade = req.nextUrl.searchParams.get("cidade");
  const categoria = req.nextUrl.searchParams.get("categoria");
  if (!cidade && !categoria) return NextResponse.json({ resultados: [] });

  const admin = createAdminClient();
  let query = admin.from("profissionais").select("nome_negocio, slug, categoria, cidade, estado");
  if (cidade) query = query.ilike("cidade", `%${cidade}%`);
  if (categoria) query = query.eq("categoria", categoria);
  const { data } = await query.limit(20);

  return NextResponse.json({ resultados: data ?? [] });
}
