// POST /api/admin/geocodificar-cidades { cidades: [{cidade, estado}] }
// Devolve latitude/longitude reais de cada cidade — usa cache no banco
// pra não bater no serviço de geocodificação de novo, e respeita o
// limite de 1 pedido por segundo do Nominatim (OpenStreetMap, gratuito)
// pras cidades que ainda não estão em cache.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  cidades: z.array(z.object({ cidade: z.string(), estado: z.string() })).max(50),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const resultado: { cidade: string; estado: string; latitude: number | null; longitude: number | null }[] = [];

  for (const { cidade, estado } of validado.data.cidades) {
    const { data: emCache } = await db
      .from("cidades_geocodificadas")
      .select("latitude, longitude")
      .eq("cidade", cidade).eq("estado", estado)
      .maybeSingle();

    if (emCache) {
      resultado.push({ cidade, estado, latitude: emCache.latitude, longitude: emCache.longitude });
      continue;
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Brazil&city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(estado)}`,
        { headers: { "User-Agent": "Booqly/1.0 (contato via painel admin)" } }
      );
      const encontrados = await resp.json();
      const lat = encontrados?.[0]?.lat ? parseFloat(encontrados[0].lat) : null;
      const lon = encontrados?.[0]?.lon ? parseFloat(encontrados[0].lon) : null;

      await db.from("cidades_geocodificadas").upsert({ cidade, estado, latitude: lat, longitude: lon, atualizado_em: new Date().toISOString() });
      resultado.push({ cidade, estado, latitude: lat, longitude: lon });
    } catch (erro) {
      console.error(`Falha ao geocodificar ${cidade}/${estado}:`, erro);
      resultado.push({ cidade, estado, latitude: null, longitude: null });
    }

    // Nominatim pede no máximo 1 pedido por segundo — só espera quando
    // de fato precisou consultar (não quando já veio do cache).
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ cidades: resultado });
}
