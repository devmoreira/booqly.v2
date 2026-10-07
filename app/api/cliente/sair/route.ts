import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESSAO_CLIENTE } from "@/lib/session-cliente";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO_CLIENTE);
  return NextResponse.json({ ok: true });
}
