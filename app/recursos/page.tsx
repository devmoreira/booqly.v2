import Link from "next/link";
import { Logo } from "@/components/Logo";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RECURSOS_PADRAO = [
  { titulo: "Agenda online", texto: "Cliente marca sozinho, direto na página do seu estabelecimento, sem precisar de app." },
  { titulo: "Pagamento na sua própria conta", texto: "Conecte sua conta Asaas ou Mercado Pago — Pix e cartão caem direto pra você, sem intermediário no meio do caminho." },
  { titulo: "Escolha como cobrar", texto: "Taxa só pra reservar o horário, pagamento total antecipado, ou cobrança só depois do atendimento — você decide." },
  { titulo: "Colaboradores", texto: "Cadastre sua equipe, cada um com login e agenda próprios, foto de perfil, e confirmação automática configurável." },
  { titulo: "Repasse automático pro colaborador", texto: "A fatia de cada atendimento vai por Pix pro colaborador certo, assim que o cliente paga." },
  { titulo: "Horário de almoço por colaborador", texto: "Cada colaborador pode ter seu próprio intervalo — durante o almoço, ele some da disponibilidade, sem bloquear o estabelecimento inteiro." },
  { titulo: "Bloqueios pontuais", texto: "Folga, feriado, imprevisto — bloqueia um horário específico e o cliente nem vê como disponível." },
  { titulo: "Bloquear cliente problemático", texto: "Se algum cliente for um problema recorrente, profissional ou colaborador pode bloqueá-lo — ele para de conseguir agendar ali." },
  { titulo: "Categorias de serviço inteligentes", texto: "Busca reconhece sinônimos (ex: \"cabelo\" encontra salão e barbearia) — o cliente acha o que precisa mesmo sem saber o termo exato." },
  { titulo: "Cupom de desconto", texto: "Crie campanhas de desconto pros seus clientes, sem mexer em preço nenhum — quem banca a diferença é a plataforma, não você." },
  { titulo: "Indique e ganhe", texto: "Cliente indica amigo, colaborador indica outro estabelecimento, você indica outro profissional — todo mundo tem um jeito de ganhar saldo indicando." },
  { titulo: "Reputação cruzada", texto: "A avaliação de um cliente vale em qualquer estabelecimento do {{nome}} — profissionais sabem quem estão atendendo, e o cliente também avalia onde foi." },
  { titulo: "Lembrete pra clientes que sumiram", texto: "Configure uma vez e o sistema avisa sozinho quem não volta há um tempo — ou mande uma notificação manual quando quiser (Premium)." },
  { titulo: "Notificação no celular", texto: "Cliente e profissional recebem aviso direto na tela, sem precisar abrir o app: confirmação, lembrete, novo agendamento — funciona até no iPhone." },
  { titulo: "Histórico completo", texto: "Cliente vê a foto do estabelecimento e de quem atendeu em cada visita passada; profissional vê tudo organizado por status e por dia." },
  { titulo: "Relatório de ganhos", texto: "Acompanhe faturamento por período e por colaborador, e baixe pra levar pro seu contador." },
  { titulo: "Calendário por colaborador", texto: "Alterne entre lista e uma visão de calendário com uma coluna por colaborador — dá pra ver o dia inteiro da equipe de relance." },
  { titulo: "Loja de produtos (Premium)", texto: "Venda produto pro cliente retirar no local — pomada, shampoo, o que fizer sentido pro seu negócio. Cliente paga antecipado, você não se preocupa com frete." },
  { titulo: "Story do estabelecimento", texto: "Até 3 fotos em destaque na sua página, igual Instagram — o cliente clica na sua foto de perfil e vê em tela cheia." },
  { titulo: "Comunidade de {{nome}}", texto: "Converse com outros profissionais da sua área (barbeiro com barbeiro, manicure com manicure) — troque dica, tire dúvida, sem misturar categorias diferentes." },
];

export default async function RecursosPage() {
  const nome = await obterNomePlataforma();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recursos_site")
    .select("id, titulo, texto, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });

  const recursos = error || !data?.length ? RECURSOS_PADRAO : data;
  const recursosComNome = recursos.map((recurso) => ({
    ...recurso,
    titulo: recurso.titulo.replaceAll("{{nome}}", nome),
    texto: recurso.texto.replaceAll("{{nome}}", nome),
  }));

  return (
    <main className="min-h-screen bg-paper">
      <header className="booqly-landing-header border-b border-ink/10">
        <div className="mx-auto flex h-[72px] max-w-[1024px] items-center justify-between px-5 sm:px-7">
          <Link href="/"><Logo className="text-xl sm:text-2xl" /></Link>
          <Link href="/cadastro" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)]">
            Criar conta
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-14 text-center">
        <h1 className="font-display text-3xl font-bold">Tudo que seu estabelecimento precisa</h1>
        <p className="mt-3 text-ink/60">
          Agenda, pagamento, equipe e fidelização — num sistema só, sem precisar juntar
          vários aplicativos diferentes.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recursosComNome.map((r) => (
            <div key={"id" in r ? r.id : r.titulo} className="rounded-xl2 border border-ink/10 bg-surface p-5">
              <p className="font-medium">{r.titulo}</p>
              <p className="mt-1 text-sm text-ink/60">{r.texto}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/cadastro" className="rounded-lg bg-brand px-6 py-3 font-medium text-[var(--brand-fg)] hover:opacity-90">
            Criar minha conta grátis
          </Link>
        </div>
      </section>
    </main>
  );
}
