// POST /api/painel/story/foto — envia uma nova foto do story (limite
// de 3 no total). Mesmo padrão de upload já usado pra colaborador/produto.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO = 8 * 1024 * 1024; // 8MB
const LIMITE_FOTOS = 3;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const arquivo = formData?.get("foto") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Nenhuma imagem enviada" }, { status: 400 });
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return NextResponse.json({ erro: "Use uma imagem JPG, PNG ou WEBP" }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ erro: "A imagem precisa ter até 8MB" }, { status: 400 });

  const admin = createAdminClient();
  const { count } = await admin.from("stories_estabelecimento").select("id", { count: "exact", head: true }).eq("profissional_id", user.id);
  if ((count ?? 0) >= LIMITE_FOTOS) {
    return NextResponse.json({ erro: `Você já tem ${LIMITE_FOTOS} fotos no story. Remova uma antes de adicionar outra.` }, { status: 400 });
  }

  const extensao = arquivo.name.split(".").pop() || "jpg";
  const caminho = `fotos-story/${user.id}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await admin.storage.from("publico").upload(caminho, arquivo, { upsert: true });
  if (erroUpload) {
    console.error("Erro ao enviar foto de story pro storage:", erroUpload);
    return NextResponse.json({ erro: `Não foi possível enviar a imagem: ${erroUpload.message}` }, { status: 500 });
  }

  const { data: urlPublica } = admin.storage.from("publico").getPublicUrl(caminho);

  const { error: erroSalvar } = await admin.from("stories_estabelecimento").insert({
    profissional_id: user.id,
    foto_url: urlPublica.publicUrl,
    ordem: count ?? 0,
  });
  if (erroSalvar) {
    console.error("Erro ao salvar foto de story:", erroSalvar);
    return NextResponse.json({ erro: "Não foi possível salvar a foto" }, { status: 500 });
  }

  return NextResponse.json({ fotoUrl: urlPublica.publicUrl }, { status: 201 });
}
