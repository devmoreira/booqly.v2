// GET/POST /api/comunidade/posts
// Lista ou cria posts da comunidade da categoria do profissional
// logado. Só funciona se a comunidade daquela categoria já desbloqueou.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularStatusAcesso } from "@/lib/assinatura";
import { censurarPalavroes, linkNaoPermitido } from "@/lib/filtro-comunidade";

async function categoriaDesbloqueada(admin: ReturnType<typeof createAdminClient>, categoria: string): Promise<boolean> {
  const { data: config } = await admin.from("configuracoes_plataforma").select("comunidade_minimo_assinantes").eq("id", 1).single();
  const minimo = config?.comunidade_minimo_assinantes ?? 50;
  const { data: mesmaCategoria } = await admin.from("profissionais").select("id").eq("categoria", categoria);
  let quantidadeAtiva = 0;
  for (const p of mesmaCategoria ?? []) {
    const status = await calcularStatusAcesso(p.id);
    if (status.liberado && status.motivo !== "teste_gratis") quantidadeAtiva++;
    if (quantidadeAtiva >= minimo) return true;
  }
  return false;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profissionais").select("categoria").eq("id", user.id).single();
  if (!perfil) return NextResponse.json({ erro: "perfil não encontrado" }, { status: 404 });

  if (!(await categoriaDesbloqueada(admin, perfil.categoria))) {
    return NextResponse.json({ desbloqueada: false, posts: [] });
  }

  const { data: posts } = await admin
    .from("comunidade_posts")
    .select("id, profissional_id, texto, criado_em")
    .eq("categoria", perfil.categoria)
    .order("criado_em", { ascending: false })
    .limit(100);

  const idsAutores = [...new Set((posts ?? []).map((p) => p.profissional_id))];
  type Autor = { id: string; nome_negocio: string; foto_url: string | null };
  const { data: autores } = idsAutores.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio, foto_url").in("id", idsAutores) as { data: Autor[] | null }
    : { data: [] as Autor[] };
  const mapaAutores = new Map((autores ?? []).map((a) => [a.id, a]));

  const idsPosts = (posts ?? []).map((p) => p.id);
  const [{ data: comentarios }, { data: curtidas }] = await Promise.all([
    idsPosts.length > 0
      ? admin.from("comunidade_comentarios").select("id, post_id, profissional_id, texto, criado_em").in("post_id", idsPosts).order("criado_em")
      : Promise.resolve({ data: [] as any[] }),
    idsPosts.length > 0
      ? admin.from("comunidade_curtidas").select("post_id, profissional_id").in("post_id", idsPosts)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const idsComentaristas = [...new Set((comentarios ?? []).map((c) => c.profissional_id))];
  const { data: comentaristas } = idsComentaristas.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio, foto_url").in("id", idsComentaristas) as { data: Autor[] | null }
    : { data: [] as Autor[] };
  const mapaComentaristas = new Map((comentaristas ?? []).map((a) => [a.id, a]));

  const resultado = (posts ?? []).map((p) => ({
    id: p.id,
    texto: p.texto,
    criadoEm: p.criado_em,
    autorId: p.profissional_id,
    autorNome: mapaAutores.get(p.profissional_id)?.nome_negocio ?? "Profissional",
    autorFoto: mapaAutores.get(p.profissional_id)?.foto_url ?? null,
    ehAutor: p.profissional_id === user.id,
    curtidas: (curtidas ?? []).filter((c) => c.post_id === p.id).length,
    euCurti: (curtidas ?? []).some((c) => c.post_id === p.id && c.profissional_id === user.id),
    comentarios: (comentarios ?? []).filter((c) => c.post_id === p.id).map((c) => ({
      id: c.id,
      texto: c.texto,
      criadoEm: c.criado_em,
      autorId: c.profissional_id,
      autorNome: mapaComentaristas.get(c.profissional_id)?.nome_negocio ?? "Profissional",
      autorFoto: mapaComentaristas.get(c.profissional_id)?.foto_url ?? null,
      ehAutor: c.profissional_id === user.id,
    })),
  }));

  return NextResponse.json({ desbloqueada: true, posts: resultado });
}

const schema = z.object({ texto: z.string().min(3).max(1000) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Escreva um texto entre 3 e 1000 caracteres." }, { status: 400 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("profissionais").select("categoria").eq("id", user.id).single();
  if (!perfil) return NextResponse.json({ erro: "perfil não encontrado" }, { status: 404 });

  if (!(await categoriaDesbloqueada(admin, perfil.categoria))) {
    return NextResponse.json({ erro: "A comunidade da sua categoria ainda não desbloqueou." }, { status: 403 });
  }

  const linkRuim = linkNaoPermitido(validado.data.texto);
  if (linkRuim) {
    return NextResponse.json({ erro: `Só é permitido link do YouTube ou Instagram. Remova: ${linkRuim}` }, { status: 400 });
  }

  const textoFinal = censurarPalavroes(validado.data.texto);

  const { data: post, error } = await admin.from("comunidade_posts").insert({
    profissional_id: user.id,
    categoria: perfil.categoria,
    texto: textoFinal,
  }).select("id").single();

  if (error || !post) return NextResponse.json({ erro: "Não foi possível publicar." }, { status: 500 });
  return NextResponse.json({ ok: true, id: post.id }, { status: 201 });
}
