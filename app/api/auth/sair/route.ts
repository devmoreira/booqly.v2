// POST /api/auth/sair — encerra a sessão do dono ou do colaborador
// (os dois usam a mesma autenticação do Supabase).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
