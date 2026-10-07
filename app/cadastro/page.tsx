"use client";
import { useEffect, useState } from "react";
import { formatarTelefoneParaExibicao, telefoneParaE164 } from "@/lib/telefone";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Etapa = "dados" | "whatsapp" | "concluido";

export default function CadastroPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-6">Carregando...</main>}>
      <CadastroConteudo />
    </Suspense>
  );
}

function CadastroConteudo() {
  const searchParams = useSearchParams();
  const indicadoPorSlug = searchParams.get("indicado_por") ?? undefined;
  const indicadoPorClienteId = searchParams.get("indicado_por_cliente") ?? undefined;
  const indicadoPorColaboradorId = searchParams.get("indicado_por_colaborador") ?? undefined;
  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [codigoWhatsapp, setCodigoWhatsapp] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeProprietario, setNomeProprietario] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [categoria, setCategoria] = useState("barbearia");
  const [categorias, setCategorias] = useState<{ valor: string; rotulo: string }[]>([]);

  useEffect(() => {
    fetch("/api/categorias-servico").then((r) => r.json()).then((d) => setCategorias(d.categorias ?? []));
  }, []);

  function validar(): string | null {
    if (email !== confirmarEmail) return "Os e-mails não coincidem.";
    if (senha !== confirmarSenha) return "As senhas não coincidem.";
    if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
    if (!telefoneParaE164(celular)) return "Digite um celular válido, com DDD.";
    return null;
  }

  async function enviarCodigo(mostrarErro = true) {
    const telefone = telefoneParaE164(celular);
    if (!telefone) return false;

    const resp = await fetch("/api/auth/cadastro/enviar-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone }),
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      if (mostrarErro) setErro(data.erro ?? "Não foi possível enviar o código pelo WhatsApp.");
      return false;
    }
    return true;
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    const erroValidacao = validar();
    if (erroValidacao) { setErro(erroValidacao); return; }
    setErro(null);
    setCarregando(true);

    // A conta do Supabase só será criada DEPOIS da confirmação do WhatsApp.
    // Isso evita disparo de e-mail e contas órfãs durante a etapa de verificação.
    const enviado = await enviarCodigo(true);
    if (!enviado) {
      setCarregando(false);
      return;
    }
    setCarregando(false);
    setEtapa("whatsapp");
  }

  async function confirmarWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    const codigo = codigoWhatsapp.replace(/\D/g, "");
    if (codigo.length !== 6) {
      setErro("Digite o código de 6 dígitos recebido no WhatsApp.");
      return;
    }

    setErro(null);
    setCarregando(true);
    const respCadastro = await fetch("/api/auth/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        senha,
        nomeEmpresa,
        nomeProprietario,
        celular: telefoneParaE164(celular),
        codigoWhatsapp: codigo,
        endereco,
        numeroEndereco,
        cidade,
        estado,
        categoria,
        indicadoPorSlug,
        indicadoPorClienteId,
        indicadoPorColaboradorId,
      }),
    });
    setCarregando(false);

    if (!respCadastro.ok) {
      const data = await respCadastro.json().catch(() => ({}));
      setErro(data.erro ?? "Código inválido ou expirado.");
      return;
    }
    setEtapa("concluido");
  }

  async function reenviarCodigo() {
    if (reenviando) return;
    setErro(null);
    setReenviando(true);
    await enviarCodigo(true);
    setReenviando(false);
  }

  if (etapa === "concluido") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-bold">Cadastro confirmado!</h1>
        <p className="mt-3 text-ink/60">
          Seu WhatsApp foi confirmado e sua conta está ativa. Você já pode entrar no Booqly.
        </p>
        <Link href="/login" className="mt-6 font-medium text-ink underline">Ir para o login</Link>
      </main>
    );
  }

  if (etapa === "whatsapp") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
        <h1 className="font-display text-2xl font-bold">Confirme seu WhatsApp</h1>
        <p className="mt-2 text-sm text-ink/60">
          Enviamos um código de 6 dígitos para <strong>{celular}</strong>. Ele vale por 5 minutos.
        </p>

        <form onSubmit={confirmarWhatsapp} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium">Código do WhatsApp</label>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigoWhatsapp}
              onChange={(e) => setCodigoWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-brand"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60"
          >
            {carregando ? "Confirmando..." : "Confirmar WhatsApp"}
          </button>
        </form>

        <button
          type="button"
          onClick={reenviarCodigo}
          disabled={reenviando}
          className="mt-4 text-sm font-medium text-ink underline disabled:opacity-50"
        >
          {reenviando ? "Enviando novo código..." : "Não recebeu? Enviar outro código"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl font-bold">Criar conta</h1>
      <p className="mt-1 text-sm text-ink/60">Leva menos de 2 minutos.</p>

      <form onSubmit={criarConta} className="mt-8 space-y-4">
        <Campo label="Nome da empresa" value={nomeEmpresa} onChange={setNomeEmpresa} placeholder="Barbearia do João" />
        <Campo label="Nome do proprietário" value={nomeProprietario} onChange={setNomeProprietario} />
        <div>
          <label className="text-sm font-medium">Celular (WhatsApp)</label>
          <input required type="tel" value={celular} onChange={(e) => setCelular(formatarTelefoneParaExibicao(e.target.value))}
            placeholder="(27) 99999-9999" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          <p className="mt-1 text-xs text-ink/50">Usado para confirmar seu WhatsApp e também para recuperação de acesso.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2">
            {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </div>
        <Campo label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua, número, bairro" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Campo label="Cidade" value={cidade} onChange={setCidade} /></div>
          <div className="w-24">
            <label className="text-sm font-medium">UF</label>
            <input required maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
          </div>
        </div>
        <Campo label="Email" type="email" value={email} onChange={setEmail} />
        <Campo label="Confirmar email" type="email" value={confirmarEmail} onChange={setConfirmarEmail} />
        <Campo label="Senha" type="password" value={senha} onChange={setSenha} />
        <Campo label="Confirmar senha" type="password" value={confirmarSenha} onChange={setConfirmarSenha} />

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit" disabled={carregando}
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60"
        >
          {carregando ? "Criando e enviando código..." : "Criar conta"}
        </button>
      </form>

      <p className="mt-3 text-center text-xs text-ink/50">
        Ao continuar, você concorda com os{" "}
        <a href="/termos" target="_blank" className="underline">Termos de Uso</a>{" "}
        e a{" "}
        <a href="/privacidade" target="_blank" className="underline">Política de Privacidade</a>.
      </p>

      <p className="mt-6 text-center text-sm text-ink/60">
        Já tem conta? <Link href="/login" className="font-medium text-ink underline">Entrar</Link>
      </p>
    </main>
  );
}

function Campo({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        required type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 outline-none focus:border-brand"
      />
    </div>
  );
}
