import Link from "next/link";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditarNome } from "./EditarNome";
import { AtivarNotificacoes } from "./AtivarNotificacoes";

export default async function ClienteHomePage() {
  const cliente = await getClienteLogado();
  if (!cliente) return null; // o layout já redireciona antes de chegar aqui

  const admin = createAdminClient();

  const { data: proximo } = await admin
    .from("agendamentos")
    .select("id, inicio, profissional_id, servico_id")
    .eq("cliente_id", cliente.id)
    .in("status", ["pendente", "confirmado"])
    .gte("inicio", new Date().toISOString())
    .order("inicio")
    .limit(1)
    .maybeSingle();

  let nomeEstabelecimento: string | null = null;
  let nomeServico: string | null = null;
  let linkMapa: string | null = null;
  if (proximo) {
    const [{ data: prof, error: erroProf }, { data: serv }] = await Promise.all([
      admin.from("profissionais").select("nome_negocio, endereco, numero_endereco, bairro, cidade, estado").eq("id", proximo.profissional_id).single(),
      admin.from("servicos").select("nome").eq("id", proximo.servico_id).single(),
    ]);
    if (erroProf) console.error(`Home do cliente: falha ao buscar profissional_id=${proximo.profissional_id}:`, erroProf);
    nomeEstabelecimento = prof?.nome_negocio ?? null;
    nomeServico = serv?.nome ?? null;
    if (prof) {
      const enderecoCompleto = [prof.endereco, prof.numero_endereco, prof.bairro, prof.cidade, prof.estado].filter(Boolean).join(", ");
      linkMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <EditarNome nomeAtual={cliente.nome} />

      <AtivarNotificacoes />

      <div>
        <h1 className="font-display text-xl font-bold">Próximo agendamento</h1>
        {proximo ? (
          <div className="mt-3 rounded-xl2 border border-brand bg-brand/10 p-5">
            <p className="font-medium">{nomeEstabelecimento}</p>
            <p className="text-ink/60">{nomeServico}</p>
            <p className="mt-1 text-sm text-ink/50">
              {new Date(proximo.inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              {" às "}
              {new Date(proximo.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {linkMapa && (
              <a href={linkMapa} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
                📍 Ver no mapa
              </a>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">Você não tem nenhum agendamento futuro.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/cliente/historico" className="min-w-0 rounded-xl2 border border-ink/10 p-5 hover:border-brand">
          <p className="text-sm text-ink/60">Ver</p>
          <p className="font-medium">Histórico completo</p>
        </Link>
      </div>
    </div>
  );
}
