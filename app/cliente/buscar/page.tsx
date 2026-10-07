import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { BuscaOverlay } from "@/components/BuscaOverlay";
import { SugestoesBusca } from "./SugestoesBusca";
import { getClienteLogado } from "@/lib/session-cliente";

export default async function BuscarClientePage() {
  const cliente = await getClienteLogado();
  if (!cliente) redirect("/login?next=%2Fcliente%2Fbuscar");

  const admin = createAdminClient();
  const { data: funcionalidades } = await admin
    .from("configuracoes_plataforma")
    .select("funcionalidade_busca_cliente_ativa")
    .eq("id", 1)
    .single();

  if (funcionalidades?.funcionalidade_busca_cliente_ativa === false) redirect("/cliente");

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Encontre um novo estabelecimento</h1>
      <p className="mt-1 text-ink/60">Busque por cidade ou tipo de serviço, sem precisar sair da sua conta.</p>
      <div className="mt-6">
        <BuscaOverlay />
      </div>
      <SugestoesBusca />
    </div>
  );
}
