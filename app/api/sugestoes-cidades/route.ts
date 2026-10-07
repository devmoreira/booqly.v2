// GET /api/sugestoes-cidades?prefixo=
// Sugestões de cidade pra autocompletar — só cidades onde já existe
// pelo menos um estabelecimento cadastrado (não faz sentido sugerir
// uma cidade vazia).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const prefixo = req.nextUrl.searchParams.get("prefixo");
  if (!prefixo || prefixo.length < 2) return NextResponse.json({ cidades: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from("profissionais")
    .select("cidade, estado")
    .ilike("cidade", `${prefixo}%`)
    .limit(50);

  const vistos = new Set<string>();
  const cidades: { cidade: string; estado: string }[] = [];
  for (const item of data ?? []) {
    const chave = `${item.cidade}/${item.estado}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      cidades.push(item);
    }
  }

  return NextResponse.json({ cidades: cidades.slice(0, 6) });
}
