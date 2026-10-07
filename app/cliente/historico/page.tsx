import { redirect } from "next/navigation";
import { getClienteLogado } from "@/lib/session-cliente";
import { createAdminClient } from "@/lib/supabase/admin";
import { ListaAgendamentos } from "./ListaAgendamentos";
import { AbasHistoricoCliente } from "./AbasHistoricoCliente";

export default async function HistoricoClientePage() {
  const cliente = await getClienteLogado();
  if (!cliente) redirect("/login");

  const admin = createAdminClient();
  const { data: agendamentos } = await admin
    .from("agendamentos")
    .select("id, inicio, status, profissional_id, servico_id, colaborador_id")
    .eq("cliente_id", cliente.id)
    .eq("oculto_para_cliente", false)
    .order("inicio", { ascending: false });

  const { data: pedidosProduto } = await admin
    .from("pedidos_produtos")
    .select("id, produto_nome, quantidade, valor_total_centavos, forma_pagamento, status, profissional_id, criado_em")
    .eq("cliente_id", cliente.id)
    .neq("status", "pendente")
    .order("criado_em", { ascending: false });

  const idsProfissionaisPedidos = [...new Set((pedidosProduto ?? []).map((p) => p.profissional_id))];
  const { data: profissionaisDosPedidos } = idsProfissionaisPedidos.length > 0
    ? await admin.from("profissionais").select("id, nome_negocio").in("id", idsProfissionaisPedidos)
    : { data: [] as { id: string; nome_negocio: string }[] };
  const mapaProfissionaisPedidos = new Map((profissionaisDosPedidos ?? []).map((p) => [p.id, p.nome_negocio]));

  const pedidosProdutoComNome = (pedidosProduto ?? []).map((p) => ({
    id: p.id,
    produtoNome: p.produto_nome,
    quantidade: p.quantidade,
    valorTotalCentavos: p.valor_total_centavos,
    formaPagamento: p.forma_pagamento,
    status: p.status,
    estabelecimentoNome: mapaProfissionaisPedidos.get(p.profissional_id) ?? "Estabelecimento",
    criadoEm: p.criado_em,
  }));

  const lista = agendamentos ?? [];
  const profissionalIds = [...new Set(lista.map((a) => a.profissional_id))];
  const servicoIds = [...new Set(lista.map((a) => a.servico_id))];
  const colaboradorIds = [...new Set(lista.map((a) => a.colaborador_id).filter(Boolean))] as string[];
  const agendamentoIds = lista.map((a) => a.id);

  const [{ data: profissionais }, { data: servicos }, { data: avaliacoesJaFeitas }, { data: colaboradores }] = await Promise.all([
    profissionalIds.length > 0
      ? admin.from("profissionais").select("id, nome_negocio, slug, foto_url").in("id", profissionalIds)
      : Promise.resolve({ data: [] as { id: string; nome_negocio: string; slug: string; foto_url: string | null }[] }),
    servicoIds.length > 0
      ? admin.from("servicos").select("id, nome").in("id", servicoIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    agendamentoIds.length > 0
      ? admin.from("avaliacoes_estabelecimento").select("agendamento_id").in("agendamento_id", agendamentoIds)
      : Promise.resolve({ data: [] as { agendamento_id: string }[] }),
    colaboradorIds.length > 0
      ? admin.from("colaboradores").select("id, nome, foto_url").in("id", colaboradorIds)
      : Promise.resolve({ data: [] as { id: string; nome: string; foto_url: string | null }[] }),
  ]);
  const mapaProfissionais = new Map((profissionais ?? []).map((p) => [p.id, p]));
  const mapaServicos = new Map((servicos ?? []).map((s) => [s.id, s]));
  const mapaColaboradores = new Map((colaboradores ?? []).map((c) => [c.id, c]));
  const idsJaAvaliados = new Set((avaliacoesJaFeitas ?? []).map((a) => a.agendamento_id));

  const itens = lista.map((a) => {
    const profissional = mapaProfissionais.get(a.profissional_id);
    // Quando teve colaborador, quem atendeu foi ele; sem colaborador,
    // foi o próprio dono do estabelecimento.
    const atendente = a.colaborador_id ? mapaColaboradores.get(a.colaborador_id) : null;
    return {
      id: a.id,
      inicio: a.inicio,
      status: a.status,
      profissionalId: a.profissional_id,
      servicoId: a.servico_id,
      colaboradorId: a.colaborador_id,
      nomeNegocio: profissional?.nome_negocio ?? "",
      fotoEstabelecimento: profissional?.foto_url ?? null,
      slugEstabelecimento: profissional?.slug ?? "",
      nomeServico: mapaServicos.get(a.servico_id)?.nome ?? "",
      nomeAtendente: atendente?.nome ?? profissional?.nome_negocio ?? "",
      fotoAtendente: atendente?.foto_url ?? profissional?.foto_url ?? null,
      jaAvaliado: idsJaAvaliados.has(a.id),
    };
  });

  return (
    <div>
      <h1 className="font-display text-xl font-bold">Seu histórico</h1>
      <AbasHistoricoCliente
        agendamentos={<ListaAgendamentos itens={itens} />}
        pedidosProduto={pedidosProdutoComNome}
      />
    </div>
  );
}
