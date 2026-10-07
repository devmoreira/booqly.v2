// Confirma, no servidor, se quem está logado é admin da plataforma.
// Usado tanto nas páginas /admin/* (pra redirecionar quem não é admin)
// quanto nas rotas /api/admin/* (pra rejeitar a requisição).
import { createClient } from "@/lib/supabase/server";

export async function getProfissionalAdminOuNull() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profissionais")
    .select("id, nome_negocio, is_admin")
    .eq("id", user.id)
    .single();

  if (!perfil || !perfil.is_admin) return null;
  return perfil;
}
