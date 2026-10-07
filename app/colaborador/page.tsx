// Dashboard do colaborador — mostra os recursos do dia a dia de
// atendimento, sem as configurações administrativas do dono.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FotoPerfilColaborador } from "./FotoPerfilColaborador";
import { SairButton } from "@/components/SairButton";

export default async function ColaboradorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: colaborador } = await admin
    .from("colaboradores")
    .select("nome, profissional_id, foto_url, profissionais!colaboradores_profissional_id_fkey(nome_negocio)")
    .eq("id", user.id)
    .single();

  if (!colaborador) redirect("/login"); // não é colaborador — é dono, vai pro /painel

  return (
    <main className="booqly-colaborador-page mx-auto max-w-3xl px-6 py-10">
      <div className="booqly-colaborador-heading flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Olá, {colaborador.nome}</h1>
          <p className="mt-1 text-ink/60">
            Atendendo por {(colaborador.profissionais as any)?.nome_negocio ?? "seu estabelecimento"}.
          </p>
        </div>
        <SairButton className="shrink-0 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50" />
      </div>

      <div className="mt-4">
        <FotoPerfilColaborador fotoInicial={colaborador.foto_url} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/colaborador/agenda" className="rounded-xl2 border border-ink/10 p-4 text-center hover:border-brand/40 hover:bg-ink/5">
          <svg className="mx-auto h-6 w-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <p className="mt-2 text-sm font-medium">Ver agenda</p>
        </Link>
        <Link href="/colaborador/indicacao" className="rounded-xl2 border border-ink/10 p-4 text-center hover:border-brand/40 hover:bg-ink/5">
          <svg className="mx-auto h-6 w-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="8" width="18" height="13" rx="1" />
            <path d="M12 8v13M3 12h18M12 8c-1.5-3-5-4-5-1.5S9 8 12 8c3 0 5-1 5-3.5S13.5 5 12 8Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-2 text-sm font-medium">Indique e ganhe</p>
        </Link>
        <Link href="/colaborador/ganhos" className="col-span-2 rounded-xl2 border border-ink/10 p-4 text-center hover:border-brand/40 hover:bg-ink/5">
          <svg className="mx-auto h-6 w-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9.5c0-1 1-1.5 2.5-1.5s2.5.7 2.5 1.5-1 1.2-2.5 1.5-2.5.7-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5M12 6.5v1M12 16.5v1" strokeLinecap="round" />
          </svg>
          <p className="mt-2 text-sm font-medium">Ver ganhos</p>
        </Link>
      </div>
    </main>
  );
}
