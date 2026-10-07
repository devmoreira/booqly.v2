"use client";

import { Suspense, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import { formatarTelefoneParaExibicao, telefoneParaE164 } from "@/lib/telefone";

import { Logo } from "@/components/Logo";



type Modo = "cliente" | "profissional";



function LoginPageContent() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next");

  // Nunca aceita URL externa/aberta. Hoje só permitimos o destino protegido de busca.

  const destinoCliente = nextParam === "/cliente/buscar" ? "/cliente/buscar" : "/cliente";

  const [modo, setModo] = useState<Modo>("cliente");

  const [nomePlataforma, setNomePlataforma] = useState("");



  useEffect(() => {

    fetch("/api/configuracoes-publicas").then((r) => r.json()).then((d) => {

      if (d.nomePlataforma) setNomePlataforma(d.nomePlataforma);

    });

  }, []);



  // Profissional (dono/colaborador)

  const [loginId, setLoginId] = useState("");

  const [senha, setSenha] = useState("");

  const [manterConexao, setManterConexao] = useState(true);



  // Cliente

  const [telefone, setTelefone] = useState("");

  const [nome, setNome] = useState("");

  const [precisaNome, setPrecisaNome] = useState(false);

  const [verificacao, setVerificacao] = useState<{ telefone: string; codigo: string; linkWhatsapp: string } | null>(null);



  const [erro, setErro] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(false);



  function trocarModo(novoModo: Modo) {

    setModo(novoModo);

    setErro(null);

  }



  async function entrarProfissional(e: React.FormEvent) {

    e.preventDefault();

    setErro(null);

    setCarregando(true);

    const resp = await fetch("/api/auth/login", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ loginId, senha, manterConexao }),

    });

    setCarregando(false);

    if (!resp.ok) {

      const data = await resp.json().catch(() => ({}));

      setErro(data.erro ?? "Não foi possível entrar.");

      return;

    }

    const dados = await resp.json();

    router.push(dados.tipo === "colaborador" ? "/colaborador" : "/painel");

    router.refresh();

  }



  async function entrarCliente(e: React.FormEvent) {

    e.preventDefault();

    setErro(null);



    const telefoneValido = telefoneParaE164(telefone);

    if (!telefoneValido) {

      setErro("Telefone incompleto — digite o DDD e o número todo.");

      return;

    }



    setCarregando(true);

    const resp = await fetch("/api/cliente/entrar", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ telefone: telefoneValido, nome: precisaNome ? nome : undefined }),

    });

    const dados = await resp.json();

    setCarregando(false);

    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível entrar."); return; }

    if (dados.precisaNome) { setPrecisaNome(true); return; }

    if (dados.logadoDireto) { router.push(destinoCliente); router.refresh(); return; }

    if (dados.precisaVerificar) {

      setVerificacao({ telefone: dados.telefone, codigo: dados.codigo, linkWhatsapp: dados.linkWhatsapp });

      return;

    }

  }



  // Enquanto a tela de verificação está aberta, confere de tempos em

  // tempos se a mensagem já chegou no WhatsApp.

  useEffect(() => {

    if (!verificacao) return;



    let ativo = true;

    let verificando = false;

    let controlador: AbortController | null = null;



    const verificarStatus = async () => {

      // Evita duas consultas simultâneas se o servidor demorar mais que o intervalo.

      if (!ativo || verificando) return;

      verificando = true;

      controlador = new AbortController();



      try {

        const params = new URLSearchParams({

          telefone: verificacao.telefone,

          codigo: verificacao.codigo,

        });



        const resp = await fetch(`/api/cliente/verificar-status?${params.toString()}`, {

          method: "GET",

          cache: "no-store",

          signal: controlador.signal,

        });



        if (!resp.ok) return;



        const dados = await resp.json().catch(() => null);

        if (ativo && dados?.verificado) {

          ativo = false;

          router.push(destinoCliente);

          router.refresh();

        }

      } catch (erro) {

        // Falhas momentâneas de rede/rota não devem gerar unhandledRejection

        // nem interromper o restante da tela de login. O próximo intervalo tenta novamente.

        if (erro instanceof DOMException && erro.name === "AbortError") return;

        if (ativo) console.warn("Não foi possível verificar o status do login do cliente. Tentaremos novamente.");

      } finally {

        verificando = false;

        controlador = null;

      }

    };



    // Faz a primeira consulta sem esperar 3 segundos.

    void verificarStatus();

    const intervalo = window.setInterval(() => {

      void verificarStatus();

    }, 3000);



    return () => {

      ativo = false;

      window.clearInterval(intervalo);

      controlador?.abort();

    };

  }, [verificacao, router, destinoCliente]);



  return (

    <main className="booqly-login min-h-[100svh] w-full overflow-x-clip bg-[#030907] text-white bg-[url('/backgrounds/booqly-login-bg.jpg')] bg-cover bg-center lg:bg-none">

      <div className="relative min-h-[100svh] w-full overflow-x-clip">

        <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-brand/15 blur-3xl" />

        <div className="pointer-events-none absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-brand/10 blur-3xl" />

        <div className="booqly-login-shell relative mx-auto flex min-h-[100svh] w-full max-w-[1240px] items-start px-3 py-4 sm:px-5 sm:py-6 md:px-8 lg:items-center lg:px-6 lg:py-8">

          <div className="booqly-login-card grid min-w-0 w-full grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-[#07110e]/95 shadow-[0_30px_90px_rgba(0,0,0,.48)] backdrop-blur-xl sm:rounded-[24px] lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)]">

            <section className="booqly-premium-photo relative hidden min-w-0 overflow-hidden p-7 lg:flex lg:min-h-[min(680px,calc(100svh-4rem))] lg:flex-col lg:justify-between xl:p-9">

              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,7,.84),rgba(3,9,7,.46)),radial-gradient(circle_at_20%_20%,rgba(20,255,124,0.18),transparent_32%),radial-gradient(circle_at_75%_80%,rgba(20,255,124,0.10),transparent_30%)]" />

              <div className="relative z-10">

                <Logo className="text-3xl text-white" nome={nomePlataforma} />

                <div className="mt-10 max-w-lg xl:mt-14">

                  <p className="mb-5 text-sm font-semibold uppercase tracking-[0.28em] text-brand">Booqly</p>

                  <h1 className="font-display text-[2.55rem] font-bold leading-[1.02] tracking-tight xl:text-5xl">Agende, pague e<span className="block text-brand">acompanhe seus horários.</span></h1>

                  <p className="mt-6 max-w-lg text-lg leading-8 text-white/55">Uma experiência simples para clientes e profissionais organizarem a rotina, receberem pagamentos e cuidarem dos seus atendimentos.</p>

                </div>

                <div className="mt-7 grid max-w-lg gap-3 sm:grid-cols-3 xl:mt-9">

                  {[

                    ["⚡", "Agendamentos rápidos", "Poucos cliques para marcar"],

                    ["✓", "Pagamento seguro", "Pix, cartão e mais"],

                    ["★", "Mais praticidade", "Tudo em um só lugar"],

                  ].map(([icone, titulo, texto]) => (

                    <div key={titulo} className="rounded-2xl border border-white/10 bg-surface/[0.035] p-4 backdrop-blur-sm">

                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-lg text-brand">{icone}</div>

                      <p className="text-sm font-semibold text-white">{titulo}</p>

                      <p className="mt-1 text-xs leading-5 text-white/40">{texto}</p>

                    </div>

                  ))}

                </div>

              </div>

              <div className="relative z-10 flex items-end justify-between gap-8">

                <div><p className="font-display text-2xl italic text-brand">Simplifique sua rotina.</p><p className="mt-2 text-sm text-white/35">Seu tempo vale mais.</p></div>

                <div className="hidden h-40 w-64 rounded-[28px] border border-brand/20 bg-gradient-to-br from-brand/10 to-transparent shadow-[0_0_60px_rgba(20,255,124,0.08)] xl:block" />

              </div>

            </section>

            <section className="booqly-login-form relative flex min-h-0 min-w-0 flex-col justify-center bg-[#09120f] px-4 py-6 text-white sm:px-7 sm:py-8 lg:min-h-[min(680px,calc(100svh-4rem))] lg:px-8 lg:py-8 xl:px-9">

              <div className="mx-auto w-full min-w-0 max-w-[420px]">

                <div className="mb-6 sm:mb-8 lg:hidden"><Logo className="text-2xl" nome={nomePlataforma} /></div>

                <div className="mb-8"><p className="text-sm font-medium text-ink/45">Bem-vindo ao Booqly</p><h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Entre na sua conta</h2><p className="mt-2 text-sm leading-6 text-ink/50">Acesse seus agendamentos e continue de onde parou.</p></div>

                <FormularioLogin modo={modo} trocarModo={trocarModo} loginId={loginId} setLoginId={setLoginId} senha={senha} setSenha={setSenha} telefone={telefone} setTelefone={setTelefone} nome={nome} setNome={setNome} precisaNome={precisaNome} erro={erro} carregando={carregando} entrarProfissional={entrarProfissional} entrarCliente={entrarCliente} verificacao={verificacao} manterConexao={manterConexao} setManterConexao={setManterConexao} />

              </div>

            </section>

          </div>

        </div>

      </div>

    </main>

  );





}



function FormularioLogin({

  modo, trocarModo, loginId, setLoginId, senha, setSenha,

  telefone, setTelefone, nome, setNome, precisaNome, erro, carregando,

  entrarProfissional, entrarCliente, verificacao, manterConexao, setManterConexao,

}: {

  modo: Modo; trocarModo: (m: Modo) => void;

  loginId: string; setLoginId: (v: string) => void;

  senha: string; setSenha: (v: string) => void;

  telefone: string; setTelefone: (v: string) => void;

  nome: string; setNome: (v: string) => void;

  precisaNome: boolean; erro: string | null; carregando: boolean;

  entrarProfissional: (e: React.FormEvent) => void;

  entrarCliente: (e: React.FormEvent) => void;

  verificacao: { telefone: string; codigo: string; linkWhatsapp: string } | null;

  manterConexao: boolean; setManterConexao: (v: boolean) => void;

}) {

  const [esqueciSenha, setEsqueciSenha] = useState(false);

  const [loginEsqueciSenha, setLoginEsqueciSenha] = useState("");

  const [verificacaoSenha, setVerificacaoSenha] = useState<{ codigo: string; linkWhatsapp: string; telefoneMascarado: string } | null>(null);

  const [identidadeConfirmadaSenha, setIdentidadeConfirmadaSenha] = useState(false);

  const [pedindoVerificacaoSenha, setPedindoVerificacaoSenha] = useState(false);

  const [novaSenhaEsqueci, setNovaSenhaEsqueci] = useState("");

  const [confirmarSenhaEsqueci, setConfirmarSenhaEsqueci] = useState("");

  const [salvandoSenhaEsqueci, setSalvandoSenhaEsqueci] = useState(false);

  const [mensagemEsqueciSenha, setMensagemEsqueciSenha] = useState<string | null>(null);



  async function pedirVerificacaoEsqueciSenha() {

    setMensagemEsqueciSenha(null);

    setPedindoVerificacaoSenha(true);

    const resp = await fetch("/api/auth/esqueci-senha", {

      method: "POST", headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ loginId: loginEsqueciSenha }),

    });

    const dados = await resp.json();

    setPedindoVerificacaoSenha(false);

    if (!resp.ok) { setMensagemEsqueciSenha(dados.erro ?? "Não foi possível gerar a verificação."); return; }

    setVerificacaoSenha(dados);

  }



  useEffect(() => {

    if (!verificacaoSenha || identidadeConfirmadaSenha) return;

    const intervalo = setInterval(async () => {

      const resp = await fetch(`/api/auth/esqueci-senha?loginId=${encodeURIComponent(loginEsqueciSenha)}&codigo=${encodeURIComponent(verificacaoSenha.codigo)}`);

      const dados = await resp.json();

      if (dados.verificado) { clearInterval(intervalo); setIdentidadeConfirmadaSenha(true); }

    }, 3000);

    return () => clearInterval(intervalo);

  }, [verificacaoSenha, identidadeConfirmadaSenha, loginEsqueciSenha]);



  async function salvarNovaSenhaEsqueci() {

    setMensagemEsqueciSenha(null);

    if (novaSenhaEsqueci.length < 8) { setMensagemEsqueciSenha("A senha precisa ter pelo menos 8 caracteres."); return; }

    if (novaSenhaEsqueci !== confirmarSenhaEsqueci) { setMensagemEsqueciSenha("A confirmação não bate com a senha nova."); return; }

    setSalvandoSenhaEsqueci(true);

    const resp = await fetch("/api/auth/esqueci-senha", {

      method: "PUT", headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ loginId: loginEsqueciSenha, codigo: verificacaoSenha?.codigo, novaSenha: novaSenhaEsqueci }),

    });

    const dados = await resp.json().catch(() => ({}));

    setSalvandoSenhaEsqueci(false);

    if (!resp.ok) { setMensagemEsqueciSenha(dados.erro ?? "Não foi possível trocar a senha."); return; }

    setMensagemEsqueciSenha("Senha trocada! Já pode entrar com a senha nova.");

  }



  return (

    <>

      <div className="relative mb-7 flex gap-7 border-b border-ink/10">

        <button onClick={() => trocarModo("cliente")} className={`relative pb-3 text-sm font-semibold transition ${modo === "cliente" ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}>Cliente{modo === "cliente" && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}</button>

        <button onClick={() => trocarModo("profissional")} className={`relative pb-3 text-sm font-semibold transition ${modo === "profissional" ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}>Profissional{modo === "profissional" && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}</button>

      </div>

      {verificacao ? (

        <div className="space-y-5 rounded-2xl border border-ink/10 bg-surface p-5 text-center shadow-sm">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-2xl">📲</div>

          <div><p className="font-display text-lg font-bold">Confirme pelo WhatsApp</p><p className="mt-2 text-sm leading-6 text-ink/55">Toque no botão abaixo — vai abrir o WhatsApp com uma mensagem já escrita. Só apertar enviar.</p></div>

          <a href={verificacao.linkWhatsapp} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl bg-brand py-3 font-semibold text-[var(--brand-fg)] shadow-[0_10px_25px_rgba(20,180,90,0.18)] transition hover:-translate-y-0.5">Abrir WhatsApp e confirmar</a>

          <p className="text-xs text-ink/35">Aguardando confirmação...</p>

        </div>

      ) : modo === "cliente" ? (

        <form onSubmit={entrarCliente} className="space-y-5">

          <div><label className="text-sm font-semibold">Seu telefone</label><input required type="tel" inputMode="tel" autoComplete="tel" value={telefone} onChange={(e) => setTelefone(formatarTelefoneParaExibicao(e.target.value))} placeholder="(27) 99999-9999" disabled={precisaNome} className="booqly-login-input mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3.5 text-white outline-none transition placeholder:text-white/30 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-60" /></div>

          {precisaNome && <div><label className="text-sm font-semibold">Primeira vez por aqui — qual seu nome?</label><input required type="text" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} className="booqly-login-input mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3.5 text-white outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" /></div>}

          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</p>}

          <button type="submit" disabled={carregando} className="w-full rounded-xl bg-brand py-3.5 font-semibold text-[var(--brand-fg)] shadow-[0_10px_25px_rgba(20,180,90,0.18)] transition hover:-translate-y-0.5 disabled:opacity-60">{carregando ? "Entrando..." : "Entrar"}</button>

          <p className="text-center text-xs leading-5 text-ink/40">Acompanhe seus atendimentos e seu saldo de indicação</p>

        </form>

      ) : (

        <form onSubmit={entrarProfissional} className="space-y-5">

          <div><label className="text-sm font-semibold">Nome da empresa ou login</label><input required type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="barbearia-do-joao ou b.joao" className="booqly-login-input mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3.5 text-white outline-none transition placeholder:text-white/30 focus:border-brand focus:ring-4 focus:ring-brand/10" /></div>

          <div><label className="text-sm font-semibold">Senha</label><input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="booqly-login-input mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3.5 text-white outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" /><div className="mt-2 flex justify-end"><button type="button" onClick={() => setEsqueciSenha(true)} className="text-xs font-medium text-ink/45 transition hover:text-brand hover:underline">Esqueci minha senha</button></div></div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-surface p-3"><input type="checkbox" checked={manterConexao} onChange={(e) => setManterConexao(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" /><span><span className="block text-sm font-semibold">Manter conexão</span><span className="block text-xs text-ink/45">Lembrar-me neste dispositivo.</span></span></label>

          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</p>}

          <button type="submit" disabled={carregando} className="w-full rounded-xl bg-brand py-3.5 font-semibold text-[var(--brand-fg)] shadow-[0_10px_25px_rgba(20,180,90,0.18)] transition hover:-translate-y-0.5 disabled:opacity-60">{carregando ? "Entrando..." : "Entrar"}</button>

          <p className="text-center text-sm text-ink/45">Não tem conta? <Link href="/cadastro" className="font-semibold text-brand hover:underline">Criar conta grátis</Link></p>

        </form>

      )}

      {esqueciSenha && (

        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 backdrop-blur-sm" onClick={() => setEsqueciSenha(false)}>

          <div className="relative my-auto w-full max-w-sm max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1410] p-5 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>

            <button onClick={() => setEsqueciSenha(false)} aria-label="Fechar" className="absolute right-4 top-4 text-ink/40 hover:text-ink">✕</button>

            {identidadeConfirmadaSenha ? (

              <>

                <p className="font-display text-lg font-bold">✓ Identidade confirmada</p><p className="mt-1 text-sm text-ink/55">Agora escolha sua nova senha.</p>

                <input type="password" autoComplete="new-password" value={novaSenhaEsqueci} onChange={(e) => setNovaSenhaEsqueci(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" className="booqly-login-input mt-4 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3 text-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />

                <input type="password" autoComplete="new-password" value={confirmarSenhaEsqueci} onChange={(e) => setConfirmarSenhaEsqueci(e.target.value)} placeholder="Confirmar nova senha" className="booqly-login-input mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3 text-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />

                {mensagemEsqueciSenha && <p className="mt-2 text-sm text-ink/60">{mensagemEsqueciSenha}</p>}<button onClick={salvarNovaSenhaEsqueci} disabled={salvandoSenhaEsqueci} className="mt-3 w-full rounded-xl bg-brand py-3 font-semibold text-[var(--brand-fg)] disabled:opacity-50">{salvandoSenhaEsqueci ? "Salvando..." : "Salvar nova senha"}</button>

              </>

            ) : verificacaoSenha ? (

              <>

                <p className="font-display text-lg font-bold">Confirme pelo WhatsApp</p><p className="mt-2 text-sm leading-6 text-ink/55">Toque no botão — vai abrir o WhatsApp com uma mensagem já escrita, saindo do número {verificacaoSenha.telefoneMascarado}.</p><a href={verificacaoSenha.linkWhatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 block w-full rounded-xl bg-brand py-3 text-center font-semibold text-[var(--brand-fg)]">Abrir WhatsApp e confirmar</a><p className="mt-2 text-xs text-ink/35">Aguardando confirmação...</p>

              </>

            ) : (

              <>

                <p className="font-display text-lg font-bold">Esqueci minha senha</p><p className="mt-1 text-sm leading-6 text-ink/55">Digite seu login — mandamos um código pra confirmar pelo WhatsApp cadastrado.</p><input type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={loginEsqueciSenha} onChange={(e) => setLoginEsqueciSenha(e.target.value)} placeholder="barbearia-do-joao ou b.joao" className="booqly-login-input mt-4 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1814] px-4 py-3 text-white outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />{mensagemEsqueciSenha && <p className="mt-2 text-sm text-red-600">{mensagemEsqueciSenha}</p>}<button onClick={pedirVerificacaoEsqueciSenha} disabled={!loginEsqueciSenha || pedindoVerificacaoSenha} className="mt-3 w-full rounded-xl bg-brand py-3 font-semibold text-[var(--brand-fg)] disabled:opacity-50">{pedindoVerificacaoSenha ? "Gerando..." : "Continuar"}</button>

              </>

            )}

          </div>

        </div>

      )}

    </>

  );



}


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#030907] text-white">Carregando...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
