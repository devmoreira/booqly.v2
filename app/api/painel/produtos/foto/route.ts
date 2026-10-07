// POST /api/painel/produtos/foto — o dono envia a foto de um produto
// (precisa do campo "produtoId" junto no formulário).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const arquivo = formData?.get("foto") as File | null;
  const produtoId = formData?.get("produtoId") as string | null;
  if (!arquivo || !produtoId) return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return NextResponse.json({ erro: "Use uma imagem JPG, PNG ou WEBP" }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ erro: "A imagem precisa ter até 5MB" }, { status: 400 });

  const admin = createAdminClient();
  const { data: produto } = await admin.from("produtos").select("id").eq("id", produtoId).eq("profissional_id", user.id).maybeSingle();
  if (!produto) return NextResponse.json({ erro: "Produto não encontrado" }, { status: 404 });

  const extensao = arquivo.name.split(".").pop() || "jpg";
  const caminho = `fotos-produtos/${produtoId}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await admin.storage.from("publico").upload(caminho, arquivo, { upsert: true });
  if (erroUpload) {
    console.error("Erro ao enviar foto de produto pro storage:", erroUpload);
    return NextResponse.json({ erro: `Não foi possível enviar a imagem: ${erroUpload.message}` }, { status: 500 });
  }

  const { data: urlPublica } = admin.storage.from("publico").getPublicUrl(caminho);

  const { error: erroSalvar } = await admin.from("produtos").update({ foto_url: urlPublica.publicUrl }).eq("id", produtoId);
  if (erroSalvar) {
    console.error("Erro ao salvar foto_url do produto:", erroSalvar);
    return NextResponse.json({ erro: "Não foi possível salvar a foto" }, { status: 500 });
  }

  return NextResponse.json({ fotoUrl: urlPublica.publicUrl });
}
