// Página pública do profissional, na raiz do domínio.
// Ex: booqly.com.br/barbearia-do-joao
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgendarForm } from "./AgendarForm";
import { LojaPublica } from "./LojaPublica";
import { AbasAgendarLoja } from "./AbasAgendarLoja";
import { StoryAvatar } from "./StoryAvatar";
import { EstatisticaAvaliacoesClicavel } from "@/components/EstatisticaAvaliacoesClicavel";
import { getClienteLogado } from "@/lib/session-cliente";
import { temAcessoPremium } from "@/lib/assinatura";

// Nunca deixa essa página em cache — ela tem dado que muda a toda hora
// (estoque da loja, horários disponíveis, agendamentos) e um valor
// (a data de "hoje", usada no campo de data do formulário) que ficaria
// desatualizado depois de alguns dias em cache, causando erro de
// hidratação quando o navegador recalcula a data certa por conta própria.
export const dynamic = "force-dynamic";

export default async function PaginaProfissional({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: profissional, error: erroProfissional } = await admin
    .from("profissionais")
    .select("id, nome_negocio, slug, categoria, cidade, estado, tema, gateway_status, foto_url, instagram, endereco, numero_endereco, bairro")
    .eq("slug", slug)
    .maybeSingle();

  // "Não encontrado" é esperado o tempo todo (slug digitado errado, bot
  // pedindo /robots.txt, /favicon.ico, etc.) — só vale logar se for um
  // erro de verdade (conexão, permissão), não a ausência de resultado.
  if (erroProfissional) console.error(`Erro ao buscar profissional pelo slug "${slug}":`, erroProfissional);
  if (!profissional) return notFound();

  const { data: servicos } = await admin
    .from("servicos")
    .select("id, nome, duracao_minutos, preco_centavos, foto_url")
    .eq("profissional_id", profissional.id)
    .eq("ativo", true)
    .order("nome");

  const { data: colaboradores } = await admin
    .from("colaboradores")
    .select("id, nome")
    .eq("profissional_id", profissional.id)
    .eq("ativo", true)
    .order("nome");

  const { data: configCobranca } = await admin
    .from("configuracoes_cobranca")
    .select("metodo, aceita_pix, aceita_credito, aceita_debito")
    .eq("profissional_id", profissional.id)
    .maybeSingle();

  const { data: funcionalidades } = await admin
    .from("configuracoes_plataforma")
    .select("funcionalidade_cupons_ativa")
    .eq("id", 1)
    .single();
  const cuponsAtivosGlobal = funcionalidades?.funcionalidade_cupons_ativa ?? true;

  const clienteLogado = await getClienteLogado();
  let documentoSalvo: string | null = null;
  if (clienteLogado) {
    const { data: clienteCompleto } = await admin.from("clientes").select("cpf_cnpj").eq("id", clienteLogado.id).single();
    documentoSalvo = clienteCompleto?.cpf_cnpj ?? null;
  }

  const profissionalTemPremium = await temAcessoPremium(profissional.id);
  const { data: produtosLoja } = profissionalTemPremium
    ? await admin.from("produtos").select("id, nome, preco_centavos, foto_url, estoque").eq("profissional_id", profissional.id).eq("ativo", true).gt("estoque", 0).order("criado_em")
    : { data: null };

  const { data: fotosStory } = await admin.from("stories_estabelecimento").select("foto_url").eq("profissional_id", profissional.id).order("ordem");

  const { data: avaliacoes } = await admin
    .from("avaliacoes_estabelecimento")
    .select("nota, comentario, criado_em")
    .eq("profissional_id", profissional.id)
    .order("criado_em", { ascending: false })
    .limit(10);

  const { data: todasNotas } = await admin
    .from("avaliacoes_estabelecimento")
    .select("nota")
    .eq("profissional_id", profissional.id);

  const totalAvaliacoes = todasNotas?.length ?? 0;
  const mediaAvaliacoes = totalAvaliacoes > 0
    ? todasNotas!.reduce((soma, a) => soma + a.nota, 0) / totalAvaliacoes
    : 0;

  const iniciais = profissional.nome_negocio
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((palavra: string) => palavra[0]?.toUpperCase())
    .join("");

  const { data: categoriaInfo } = await admin.from("categorias_servico").select("rotulo").eq("valor", profissional.categoria).maybeSingle();

  const pagamentoDisponivel = profissional.gateway_status === "valido";

  return (
    <main className="mx-auto max-w-md overflow-x-hidden px-6 py-12" data-theme={profissional.tema}>
      <div className="flex flex-col items-center text-center">
        <StoryAvatar fotos={(fotosStory ?? []).map((f) => f.foto_url)}>
          <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-4xl font-bold text-[var(--brand-fg)]">
            {profissional.foto_url
              ? <img src={profissional.foto_url} alt={profissional.nome_negocio} className="h-full w-full object-cover object-center" />
              : (iniciais || "?")}
          </div>
        </StoryAvatar>
        <h1 className="mt-3 font-display text-xl font-bold">{profissional.nome_negocio}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {categoriaInfo?.rotulo ?? profissional.categoria} · {profissional.cidade}/{profissional.estado}
        </p>
        {profissional.instagram && (
          <a
            href={`https://instagram.com/${profissional.instagram}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-sm text-ink/60 hover:text-brand hover:underline"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            @{profissional.instagram}
          </a>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [profissional.endereco, profissional.numero_endereco, profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ")
          )}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-sm text-ink/60 hover:text-brand hover:underline"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          Ver no mapa
        </a>

        <div className="mt-4 flex w-full max-w-xs justify-around border-y border-ink/10 py-3">
          <div>
            <p className="font-bold">{servicos?.length ?? 0}</p>
            <p className="text-xs text-ink/50">Serviços</p>
          </div>
          <EstatisticaAvaliacoesClicavel
            totalAvaliacoes={totalAvaliacoes} mediaAvaliacoes={mediaAvaliacoes} avaliacoes={avaliacoes ?? []}
          />
          <div>
            <p className="font-bold">{totalAvaliacoes > 0 ? mediaAvaliacoes.toFixed(1) : "—"}</p>
            <p className="text-xs text-ink/50">Nota</p>
          </div>
        </div>
      </div>

      {(!servicos || servicos.length === 0) && (
        <p className="mt-8 text-center text-sm text-ink/50">Este estabelecimento ainda não cadastrou serviços.</p>
      )}

      {servicos && servicos.length > 0 && (
        <Suspense fallback={<p className="mt-8 text-sm text-ink/50">Carregando...</p>}>
          <AbasAgendarLoja
            formularioAgendar={
              <AgendarForm
                profissionalId={profissional.id}
                slug={profissional.slug}
                servicos={servicos}
                colaboradores={colaboradores ?? []}
                cuponsAtivos={cuponsAtivosGlobal}
                metodoCobranca={configCobranca?.metodo ?? "pos_servico"}
                pagamentoDisponivel={pagamentoDisponivel}
                aceitaPix={configCobranca?.aceita_pix ?? true}
                aceitaCredito={configCobranca?.aceita_credito ?? true}
                aceitaDebito={configCobranca?.aceita_debito ?? true}
                clienteLogado={clienteLogado ? { nome: clienteLogado.nome, telefone: clienteLogado.telefone, documento: documentoSalvo } : null}
              />
            }
            loja={
              profissionalTemPremium && produtosLoja && produtosLoja.length > 0
                ? <LojaPublica produtos={produtosLoja} clienteLogado={clienteLogado ? { nome: clienteLogado.nome, telefone: clienteLogado.telefone, documento: documentoSalvo } : null} />
                : null
            }
          />
        </Suspense>
      )}
    </main>
  );
}
