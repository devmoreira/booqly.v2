// POST /api/painel/pix-subsidio { pixChave, pixChaveTipo }
// Salva a chave Pix PRÓPRIA do profissional (não a de gateway) — usada
// só quando a plataforma precisa cobrir um subsídio de cupom de cliente.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  pixChave: z.string().min(3).max(80),
  pixChaveTipo: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("profissionais").update({
    pix_chave: validado.data.pixChave,
    pix_chave_tipo: validado.data.pixChaveTipo,
  }).eq("id", user.id);

  if (error) return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
