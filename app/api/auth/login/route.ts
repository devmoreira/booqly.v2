// POST /api/auth/login { loginId, senha }
// loginId pode ser o "nome da empresa" (dono) ou "b.joao" (colaborador).
// Essa rota descobre qual e-mail está por trás e faz o login de verdade,
// no servidor, gravando a sessão nos cookies — o navegador nunca vê
// nenhum e-mail nesse processo.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const schema = z.object({ loginId: z.string().min(2), senha: z.string().min(1), manterConexao: z.boolean().optional() });

// Mesma conversão usada no cadastro: "Barbearia do João" -> "barbearia-do-joao".
// Assim o login funciona digitando do jeito natural, com espaço e acento.
function normalizarLoginId(valor: string) {
  return valor.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "Preencha login e senha" }, { status: 400 });
  const loginId = normalizarLoginId(validado.data.loginId);

  const admin = createAdminClient();

  // Tenta como dono do estabelecimento (login = slug da empresa)
  const { data: dono } = await admin
    .from("profissionais")
    .select("id")
    .eq("slug", loginId)
    .maybeSingle();

  // Ou como colaborador (login = "b.joao")
  const { data: colaborador } = !dono
    ? await admin.from("colaboradores").select("id, ativo").eq("login_id", loginId).maybeSingle()
    : { data: null };

  const userId = dono?.id ?? (colaborador?.ativo ? colaborador.id : null);
  if (!userId) return NextResponse.json({ erro: "Login ou senha incorretos" }, { status: 401 });

  const { data: usuarioAuth } = await admin.auth.admin.getUserById(userId);
  const email = usuarioAuth?.user?.email;
  if (!email) return NextResponse.json({ erro: "Login ou senha incorretos" }, { status: 401 });

  const supabase = await createServerClient(validado.data.manterConexao === false);
  const { error } = await supabase.auth.signInWithPassword({ email, password: validado.data.senha });
  if (error) return NextResponse.json({ erro: "Login ou senha incorretos" }, { status: 401 });

  if (dono) {
    admin.from("profissionais").update({ ultimo_acesso: new Date().toISOString() }).eq("id", dono.id)
      .then(({ error }) => { if (error) console.error("Falha ao registrar último acesso:", error); });
  }

  return NextResponse.json({ ok: true, tipo: dono ? "dono" : "colaborador" });
}
