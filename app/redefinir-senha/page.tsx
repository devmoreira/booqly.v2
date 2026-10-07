"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Página que o link do e-mail de verificação abre. O Supabase, ao
// clicar no link, já cria uma sessão temporária de "recuperação" —
// aqui só confere se essa sessão existe e deixa definir a senha nova.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { setErro("As senhas não são iguais."); return; }

    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setSucesso(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!pronto) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-ink/60">
          Esse link não é mais válido, ou já expirou. Peça um novo em "Esqueci minha senha".
        </p>
      </main>
    );
  }

  if (sucesso) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-medium">Senha alterada! ✅</p>
        <p className="mt-1 text-ink/60">Redirecionando pro login...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full">
        <h1 className="font-display text-2xl font-bold">Nova senha</h1>
        <p className="mt-1 text-ink/60">Identidade confirmada — defina sua nova senha.</p>

        <form onSubmit={salvar} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Nova senha</label>
            <input
              required type="password" minLength={8} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirmar nova senha</label>
            <input
              required type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 outline-none focus:border-brand"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="submit" disabled={salvando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
