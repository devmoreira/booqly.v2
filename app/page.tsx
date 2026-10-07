import Link from "next/link";
import { MenuMobileLanding } from "@/components/MenuMobileLanding";
import { Logo } from "@/components/Logo";
import { obterNomePlataforma } from "@/lib/nome-plataforma";
import { BuscaOverlay } from "@/components/BuscaOverlay";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstrelasExibicao } from "@/components/SeletorEstrelas";

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5.2-3.2 8.7-8 10-4.8-1.3-8-4.8-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "zap") return <svg {...common}><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
  if (name === "chat") return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9.2 9.2 0 0 1-3.7-.8L4 20l1.3-3.4A7.1 7.1 0 0 1 4 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="booqly-feature-mini">
      <span className="booqly-icon-box"><Icon name={icon} size={19} /></span>
      <div><p className="font-semibold text-white">{title}</p><p className="text-xs text-white/50">{text}</p></div>
    </div>
  );
}

function StepCard({ number, icon, title, text }: { number: string; icon: string; title: string; text: string }) {
  return (
    <div className="booqly-step-card">
      <div className="booqly-step-icon"><Icon name={icon} size={24} /></div>
      <p className="mt-3 text-sm font-bold"><span className="text-brand">{number}.</span> {title}</p>
      <p className="mt-1 text-xs leading-5 text-ink/55">{text}</p>
    </div>
  );
}

export default async function LandingPage() {
  const nomePlataforma = await obterNomePlataforma();
  const admin = createAdminClient();

  const [{ data: topEstabelecimentos }, { data: categoriasData }, { data: config }, { data: perguntasFrequentes }, { data: avaliacoes }] = await Promise.all([
    admin.from("ranking_estabelecimentos")
      .select("nome_negocio, slug, categoria, cidade, estado, media, quantidade, foto_url")
      .gt("quantidade", 0).order("media", { ascending: false }).order("quantidade", { ascending: false }).limit(4),
    admin.from("categorias_servico").select("valor, rotulo"),
    admin.from("configuracoes_plataforma")
      .select("rodape_descricao, rodape_instagram, rodape_whatsapp, rodape_facebook, rodape_tiktok, rodape_email_suporte")
      .eq("id", 1).single(),
    admin.from("perguntas_frequentes").select("id, pergunta, resposta").eq("ativo", true).order("ordem").limit(4),
    admin.from("avaliacoes_estabelecimento")
      .select("cliente_id, nota, comentario, criado_em")
      .not("comentario", "is", null).order("criado_em", { ascending: false }).limit(3),
  ]);

  const mapaCategorias = new Map((categoriasData ?? []).map((c) => [c.valor, c.rotulo]));
  const clienteIds = [...new Set((avaliacoes ?? []).map((a) => a.cliente_id).filter(Boolean))];
  const { data: clientes } = clienteIds.length
    ? await admin.from("clientes").select("id, nome").in("id", clienteIds)
    : { data: [] as { id: string; nome: string }[] };
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  const depoimentos = (avaliacoes ?? []).map((a) => ({
    nome: mapaClientes.get(a.cliente_id) || "Cliente Booqly",
    comentario: a.comentario || "Experiência simples, rápida e prática.",
    nota: a.nota,
  }));

  return (
    <main className="booqly-landing min-h-screen overflow-x-hidden bg-[#03100b] text-white">
      <header id="topo" className="booqly-landing-header sticky top-0 z-40">
        <div className="mx-auto flex h-[72px] max-w-[1024px] items-center justify-between px-5 sm:px-7">
          <Logo className="text-xl sm:text-2xl" nome={nomePlataforma} />
          <nav className="hidden items-center gap-8 text-[13px] md:flex">
            <Link href="#topo" className="booqly-header-link is-active">Início</Link>
            <Link href="#recursos" className="booqly-header-link">Serviços</Link>
            <Link href="/planos" className="booqly-header-link">Planos</Link>
            <Link href="/ajuda" className="booqly-header-link">Ajuda</Link>
          </nav>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/login" className="flex items-center gap-2 text-sm text-white/85 hover:text-brand"><span className="text-lg">♙</span> Entrar</Link>
            <Link href="/cadastro" className="booqly-header-cta">Criar conta</Link>
          </div>
          <div className="md:hidden"><MenuMobileLanding /></div>
        </div>
      </header>

      <section className="booqly-home-hero">
        <div className="mx-auto grid max-w-[1024px] items-center gap-8 px-5 py-10 sm:px-7 sm:py-14 lg:grid-cols-[.92fr_1.08fr] lg:gap-3 lg:py-16">
          <div className="relative z-10 max-w-[470px]">
            <div className="booqly-pill"><span />Agendamentos online de forma simples</div>
            <h1 className="mt-5 font-display text-[2.55rem] font-extrabold leading-[.98] tracking-[-.045em] sm:text-5xl lg:text-[3.05rem]">
              Tudo pra facilitar<br />
              <span className="text-brand">seu dia a dia</span>
            </h1>
            <p className="mt-5 max-w-[430px] text-sm leading-6 text-white/72 sm:text-[15px]">
              Receba na hora, sem burocracia. Pix, cartão e repasse automático pro seu colaborador.
            </p>
            <div className="mt-5 max-w-[430px]"><BuscaOverlay /></div>
            <div className="mt-5 grid max-w-[460px] grid-cols-3 gap-3">
              <Feature icon="calendar" title="Agendamento online" text="24h por dia" />
              <Feature icon="shield" title="Pagamento seguro" text="Pix, cartão e mais" />
              <Feature icon="zap" title="Repasse automático" text="para seu colaborador" />
            </div>
          </div>
          <div className="relative min-h-[320px] lg:min-h-[410px]">
            <img src="/backgrounds/landing-hero-device.png" alt="Agenda Booqly em notebook e celular" className="booqly-hero-device" />
          </div>
        </div>
      </section>

      <section id="recursos" className="booqly-how border-y border-brand/10">
        <div className="mx-auto grid max-w-[1024px] items-center gap-7 px-5 py-7 sm:px-7 sm:py-8 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <div className="booqly-pill mb-3">Como funciona</div>
            <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">Encontre o serviço ideal<br />e agende em poucos cliques</h2>
            <p className="mt-2 max-w-[350px] text-sm leading-5 text-white/55">Escolha o que você precisa, selecione o melhor horário disponível. E seu agendamento está confirmado.</p>
            <Link href="/cliente/buscar" className="booqly-green-btn mt-4">Buscar agora <Icon name="arrow" size={17} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StepCard number="1" icon="search" title="Busque" text="Encontre o serviço, profissional ou estabelecimento." />
            <StepCard number="2" icon="calendar" title="Escolha" text="Veja os horários disponíveis e selecione o melhor para você." />
            <StepCard number="3" icon="check" title="Confirme" text="Finalize o agendamento e receba a confirmação." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1024px] px-5 py-8 sm:px-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><div className="booqly-section-label"><span /> Mais bem avaliados</div><p className="mt-1 text-xs text-white/50 sm:text-sm">Profissionais e estabelecimentos que fazem a diferença.</p></div>
          <Link href="/buscar" className="hidden text-xs font-semibold text-brand sm:block">Ver todos →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(topEstabelecimentos ?? []).map((r) => (
            <Link key={r.slug} href={`/${r.slug}`} className="booqly-rated-card">
              <div className="booqly-rated-photo" style={{ backgroundImage: r.foto_url ? `url(${r.foto_url})` : undefined }}>
                {!r.foto_url && <span>{r.nome_negocio.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-bold">{r.nome_negocio}</p>
                <div className="mt-1 flex items-center gap-1 text-[11px]"><span className="text-yellow-400">★</span><strong>{Number(r.media || 0).toFixed(1)}</strong><span className="text-white/45">({r.quantidade} avaliações)</span></div>
                <p className="mt-1 text-[10px] text-white/45">{mapaCategorias.get(r.categoria) ?? r.categoria}</p>
                <p className="text-[10px] text-white/45">{r.cidade} - {r.estado}</p>
              </div>
            </Link>
          ))}
          {(!topEstabelecimentos || topEstabelecimentos.length === 0) && <div className="col-span-full rounded-2xl border border-white/10 p-6 text-sm text-white/50">Os estabelecimentos mais bem avaliados aparecerão aqui.</div>}
        </div>
      </section>

      <section className="booqly-pro-section">
        <div className="mx-auto grid max-w-[1024px] items-center gap-7 px-5 py-8 sm:px-7 lg:grid-cols-[.9fr_1.1fr]">
          <div className="booqly-feature-visual"><img src="/backgrounds/landing-feature-phone.png" alt="Experiência Booqly para clientes" /></div>
          <div>
            <div className="booqly-pill mb-3">Para profissionais</div>
            <h2 className="font-display text-2xl font-extrabold leading-[1.05] sm:text-3xl">Mais controle, mais clientes,<br />mais resultados</h2>
            <p className="mt-2 max-w-[500px] text-sm leading-5 text-white/55">O Booqly é a solução completa para quem quer organizar, atrair e fidelizar clientes.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {["Agenda inteligente e organizada", "Receba e gerencie pagamentos", "Relatórios e métricas de desempenho", "Gerencie sua equipe", "Divulgação fácil nas redes sociais", "Suporte especializado"].map((item) => <div key={item} className="flex items-center gap-2 text-xs text-white/75"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-black"><Icon name="check" size={13} /></span>{item}</div>)}
            </div>
            <Link href="/cadastro" className="booqly-green-btn mt-5 inline-flex">Comece agora <Icon name="arrow" size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1024px] px-5 py-8 sm:px-7">
        <div className="mb-4 flex items-end justify-between"><div><div className="booqly-section-label"><span /> Depoimentos</div><h2 className="mt-1 font-display text-2xl font-extrabold">Quem usa, recomenda!</h2><p className="text-xs text-white/50">Veja o que nossos clientes dizem sobre o Booqly.</p></div><span className="hidden text-xs font-semibold text-brand sm:block">Experiências reais →</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {(depoimentos.length ? depoimentos : [
            { nome: "Cliente Booqly", comentario: "Uma experiência simples, prática e rápida para organizar meus horários.", nota: 5 },
            { nome: "Profissional Booqly", comentario: "Minha agenda ficou muito mais organizada e fácil de acompanhar.", nota: 5 },
            { nome: "Cliente Booqly", comentario: "Gostei da praticidade para encontrar horários e confirmar o atendimento.", nota: 5 },
          ]).map((d, i) => (
            <article key={`${d.nome}-${i}`} className="booqly-testimonial">
              <div className="flex items-center gap-3"><div className="booqly-avatar">{d.nome.split(" ").map((p: string) => p[0]).slice(0,2).join("").toUpperCase()}</div><div><p className="text-xs font-bold">{d.nome}</p><p className="text-[10px] text-white/45">Cliente Booqly</p></div></div>
              <div className="mt-2 text-[11px] tracking-[2px] text-yellow-400">{"★".repeat(Math.max(1, Math.min(5, d.nota || 5)))}</div>
              <p className="mt-2 text-xs leading-5 text-white/62">“{d.comentario}”</p>
            </article>
          ))}
        </div>
      </section>

      <section className="booqly-faq border-t border-brand/10">
        <div className="mx-auto grid max-w-[1024px] gap-7 px-5 py-8 sm:px-7 lg:grid-cols-[.72fr_1.28fr]">
          <div><div className="booqly-pill mb-3">Dúvidas frequentes</div><h2 className="font-display text-2xl font-extrabold">Perguntas frequentes</h2><p className="mt-1 max-w-[330px] text-sm text-white/50">Tire suas dúvidas sobre o Booqly.</p></div>
          <div className="space-y-2">{(perguntasFrequentes ?? []).map((item) => <details key={item.id} className="booqly-faq-item"><summary>{item.pergunta}<span>›</span></summary><p>{item.resposta}</p></details>)}{(!perguntasFrequentes || perguntasFrequentes.length === 0) && <><details className="booqly-faq-item"><summary>Como funciona o agendamento?<span>›</span></summary><p>O cliente busca um serviço, escolhe um profissional e um horário disponível e confirma o agendamento.</p></details><details className="booqly-faq-item"><summary>É seguro realizar pagamentos pelo sistema?<span>›</span></summary><p>O Booqly utiliza integrações de pagamento e confirmações no servidor para processar as cobranças.</p></details></>}</div>
        </div>
      </section>

      <footer className="booqly-footer">
        <div className="mx-auto grid max-w-[1024px] gap-8 px-5 py-9 sm:grid-cols-2 sm:px-7 md:grid-cols-4">
          <div><Logo className="text-2xl" nome={nomePlataforma} /><p className="mt-2 max-w-[260px] text-xs leading-5 text-white/45">{config?.rodape_descricao || "Agendamento online simples para clientes, profissionais e estabelecimentos."}</p><p className="mt-3 text-[10px] text-white/35">© {new Date().getFullYear()} {nomePlataforma}. Todos os direitos reservados.</p></div>
          <div><p className="text-xs font-bold">Para clientes</p><div className="mt-3 space-y-2 text-xs text-white/50"><Link href="/buscar" className="block hover:text-brand">Buscar estabelecimento</Link><Link href="/cliente" className="block hover:text-brand">Área do cliente</Link></div></div>
          <div><p className="text-xs font-bold">Para profissionais</p><div className="mt-3 space-y-2 text-xs text-white/50"><Link href="/cadastro" className="block hover:text-brand">Criar conta</Link><Link href="/login" className="block hover:text-brand">Entrar</Link></div></div>
          <div><p className="text-xs font-bold">Ajuda</p><div className="mt-3 space-y-2 text-xs text-white/50"><Link href="/ajuda" className="block hover:text-brand">Central de ajuda</Link><Link href="/termos" className="block hover:text-brand">Termos de Uso</Link><Link href="/privacidade" className="block hover:text-brand">Política de Privacidade</Link></div></div>
        </div>
        {(config?.rodape_instagram || config?.rodape_whatsapp || config?.rodape_facebook || config?.rodape_tiktok) && <div className="border-t border-white/10"><div className="mx-auto flex max-w-[1024px] justify-end gap-4 px-5 py-3 text-xs text-white/45 sm:px-7">{config.rodape_instagram && <a href={config.rodape_instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}{config.rodape_facebook && <a href={config.rodape_facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}{config.rodape_tiktok && <a href={config.rodape_tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>}</div></div>}
      </footer>

      <Link href="/ajuda" aria-label="Abrir ajuda" className="booqly-float-help"><Icon name="chat" size={22} /></Link>
    </main>
  );
}
