// POST /api/colaboradores/foto — o DONO envia a foto de um colaborador
// (precisa do campo "colaboradorId" junto no formulário).
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
  const colaboradorId = formData?.get("colaboradorId") as string | null;
  if (!arquivo || !colaboradorId) return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return NextResponse.json({ erro: "Use uma imagem JPG, PNG ou WEBP" }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ erro: "A imagem precisa ter até 5MB" }, { status: 400 });

  // Confere que esse colaborador é mesmo desse dono
  const { data: colaborador } = await supabase.from("colaboradores").select("id").eq("id", colaboradorId).eq("profissional_id", user.id).maybeSingle();
  if (!colaborador) return NextResponse.json({ erro: "Colaborador não encontrado" }, { status: 404 });

  const admin = createAdminClient();
  const extensao = arquivo.name.split(".").pop() || "jpg";
  const caminho = `avatares-colaboradores/${colaboradorId}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await admin.storage.from("publico").upload(caminho, arquivo, { upsert: true });
  if (erroUpload) return NextResponse.json({ erro: "Não foi possível enviar a imagem" }, { status: 500 });

  const { data: urlPublica } = admin.storage.from("publico").getPublicUrl(caminho);

  const { error: erroSalvar } = await admin.from("colaboradores").update({ foto_url: urlPublica.publicUrl }).eq("id", colaboradorId);
  if (erroSalvar) return NextResponse.json({ erro: "Não foi possível salvar a foto" }, { status: 500 });

  return NextResponse.json({ fotoUrl: urlPublica.publicUrl });
}
