// GET /api/cliente/sugestoes-busca?lat=&lng=
// Duas listas pro cliente logado: estabelecimentos que ele já visitou,
// e estabelecimentos bem avaliados na cidade dele, SÓ nas categorias
// que ele já visitou antes (descoberta a partir da localização do
// celular, via geocodificação reversa gratuita — não temos coordenadas
// exatas de cada estabelecimento salvas, então "perto de você" aqui é
// por cidade, não distância exata em metros).
import { NextRequest, NextResponse } from "next/server";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();

  // Já visitado — estabelecimentos distintos onde ele já teve
  // agendamento, do mais recente pro mais antigo.
  const { data: agendamentos } = await admin
    .from("agendamentos")
    .select("profissional_id, inicio")
    .eq("cliente_id", cliente.id)
    .eq("status", "concluido")
    .order("inicio", { ascending: false })
    .limit(50);

  const idsVisitadosEmOrdem: string[] = [];
  for (const a of agendamentos ?? []) {
    if (!idsVisitadosEmOrdem.includes(a.profissional_id)) idsVisitadosEmOrdem.push(a.profissional_id);
  }

  const { data: visitadosCompleto } = idsVisitadosEmOrdem.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio, slug, categoria, cidade, estado, foto_url").in("id", idsVisitadosEmOrdem)
    : { data: [] as any[] };
  const mapaVisitados = new Map((visitadosCompleto ?? []).map((p) => [p.id, p]));
  const jaVisitados = idsVisitadosEmOrdem.slice(0, 5).map((id) => mapaVisitados.get(id)).filter(Boolean);

  // Categorias que ele já visitou — usadas pra filtrar "perto de você",
  // já que ele só quer ver sugestão do tipo de serviço que já usa.
  const categoriasVisitadas = [...new Set((visitadosCompleto ?? []).map((p) => p.categoria))];

  // Perto de você — só roda se o navegador mandou lat/lng E ele já
  // tiver visitado alguma categoria antes (sem histórico, não tem
  // categoria nenhuma pra sugerir).
  let pertoDeVoce: any[] = [];
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (lat && lng && categoriasVisitadas.length > 0) {
    try {
      const respGeo = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
        { headers: { "User-Agent": "Booqly/1.0" } }
      );
      const dadosGeo = await respGeo.json();
      // O Nominatim varia o campo que traz o nome da cidade dependendo da
      // região — tenta vários antes de desistir.
      const cidade =
        dadosGeo?.address?.city || dadosGeo?.address?.town || dadosGeo?.address?.municipality ||
        dadosGeo?.address?.city_district || dadosGeo?.address?.county;

      if (!cidade) {
        console.error("Geocodificação não retornou cidade reconhecível:", JSON.stringify(dadosGeo?.address));
      } else {
        // Correspondência "contém", sem se importar com acento — evita
        // falhar por causa de diferença de formatação entre o que o
        // Nominatim devolve e o que o profissional digitou no cadastro.
        const cidadeSemAcento = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const { data: candidatos } = await admin
          .from("profissionais")
          .select("id, nome_negocio, slug, categoria, cidade, estado, foto_url")
          .in("categoria", categoriasVisitadas)
          .not("id", "in", `(${idsVisitadosEmOrdem.join(",") || "00000000-0000-0000-0000-000000000000"})`)
          .limit(200);

        pertoDeVoce = (candidatos ?? [])
          .filter((p) => p.cidade?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(cidadeSemAcento.toLowerCase()))
          .slice(0, 5);
      }
    } catch (erro) {
      console.error("Falha ao geocodificar localização do cliente:", erro);
    }
  }

  return NextResponse.json({ jaVisitados, pertoDeVoce });
}
