import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db
    .from("configuracoes_plataforma")
    .select("rodape_descricao, rodape_instagram, rodape_whatsapp, rodape_facebook, rodape_tiktok, rodape_email_suporte")
    .eq("id", 1)
    .single();

  return NextResponse.json(data ?? {});
}

const schema = z.object({
  rodapeDescricao: z.string().max(300).optional(),
  rodapeInstagram: z.string().url().optional().or(z.literal("")),
  rodapeWhatsapp: z.string().url().optional().or(z.literal("")),
  rodapeFacebook: z.string().url().optional().or(z.literal("")),
  rodapeTiktok: z.string().url().optional().or(z.literal("")),
  rodapeEmailSuporte: z.string().email().optional().or(z.literal("")),
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) {
    console.error("Rodapé: dados inválidos recebidos:", corpo, validado.error.errors);
    return NextResponse.json({ erro: `Dados inválidos: ${validado.error.errors[0]?.message ?? "verifique os campos"}` }, { status: 400 });
  }

  const dados: Record<string, unknown> = {};
  if (validado.data.rodapeDescricao !== undefined) dados.rodape_descricao = validado.data.rodapeDescricao;
  if (validado.data.rodapeInstagram !== undefined) dados.rodape_instagram = validado.data.rodapeInstagram || null;
  if (validado.data.rodapeWhatsapp !== undefined) dados.rodape_whatsapp = validado.data.rodapeWhatsapp || null;
  if (validado.data.rodapeFacebook !== undefined) dados.rodape_facebook = validado.data.rodapeFacebook || null;
  if (validado.data.rodapeTiktok !== undefined) dados.rodape_tiktok = validado.data.rodapeTiktok || null;
  if (validado.data.rodapeEmailSuporte !== undefined) dados.rodape_email_suporte = validado.data.rodapeEmailSuporte || null;

  const db = createAdminClient();
  const { error } = await db.from("configuracoes_plataforma").update(dados).eq("id", 1);
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
