"use client";
import { useEffect, useState } from "react";
import { UploadFoto } from "@/components/UploadFoto";

type Colaborador = {
  id: string; nome: string; login_id: string; ativo: boolean;
  percentual_comissao: number | null; confirmacao_automatica: boolean; foto_url: string | null;
  pix_chave: string | null; pix_chave_tipo: string | null; telefone: string | null;
  almoco_inicio: string | null; almoco_fim: string | null;
};

const TIPOS_CHAVE = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [mensagemPrincipal, setMensagemPrincipal] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [telefoneEdit, setTelefoneEdit] = useState("");
  const [ultimoLoginCriado, setUltimoLoginCriado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [percentualEdit, setPercentualEdit] = useState("");
  const [pixChaveEdit, setPixChaveEdit] = useState("");
  const [pixTipoEdit, setPixTipoEdit] = useState("CPF");
  const [trocandoSenhaDe, setTrocandoSenhaDe] = useState<string | null>(null);
  const [novaSenhaEdit, setNovaSenhaEdit] = useState("");
  const [mensagemSenha, setMensagemSenha] = useState<string | null>(null);

  async function carregar() {
    const data = await fetch("/api/colaboradores").then((r) => r.json());
    setColaboradores(data.colaboradores ?? []);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setUltimoLoginCriado(null);
    const resp = await fetch("/api/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha, telefone }),
    });
    const data = await resp.json();
    if (!resp.ok) { setErro(data.erro ?? "Não foi possível adicionar."); return; }
    setUltimoLoginCriado(data.loginId);
    setNome(""); setSenha(""); setTelefone("");
    carregar();
  }

  async function remover(id: string) {
    await fetch("/api/colaboradores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregar();
  }

  function abrirEdicao(c: Colaborador) {
    setEditando(c.id);
    setTrocandoSenhaDe(null);
    setPercentualEdit(c.percentual_comissao != null ? String(c.percentual_comissao) : "");
    setPixChaveEdit(c.pix_chave ?? "");
    setPixTipoEdit(c.pix_chave_tipo ?? "CPF");
    setTelefoneEdit(c.telefone ?? "");
  }

  async function salvarEdicao(id: string) {
    setErro(null);
    const resp = await fetch("/api/colaboradores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        percentualComissao: percentualEdit ? parseFloat(percentualEdit.replace(",", ".")) : undefined,
        pixChave: pixChaveEdit || undefined,
        pixChaveTipo: pixChaveEdit ? pixTipoEdit : undefined,
        telefone: telefoneEdit || undefined,
      }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setErro(dados.erro ?? "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    carregar();
  }

  async function alternarConfirmacaoAutomatica(c: Colaborador) {
    await fetch("/api/colaboradores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, confirmacaoAutomatica: !c.confirmacao_automatica }),
    });
    carregar();
  }

  async function alternarAtivoPrincipal(c: Colaborador) {
    setMensagemPrincipal(null);
    const resp = await fetch("/api/colaboradores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, ativo: !c.ativo }),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      setMensagemPrincipal(dados.erro ?? "Não foi possível fazer isso.");
      return;
    }
    carregar();
  }

  async function trocarSenha(id: string) {
    if (novaSenhaEdit.length < 8) { setMensagemSenha("A senha precisa ter pelo menos 8 caracteres."); return; }
    const resp = await fetch("/api/colaboradores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, novaSenha: novaSenhaEdit }),
    });
    setMensagemSenha(resp.ok ? "Senha atualizada!" : "Não foi possível trocar a senha.");
    if (resp.ok) setNovaSenhaEdit("");
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Colaboradores</h1>
        <p className="mt-1 text-ink/60">Cada colaborador ganha um login próprio pra atender.</p>
      </div>

      <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
        <input required value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do colaborador" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <input required value={telefone} onChange={(e) => setTelefone(e.target.value)}
          placeholder="WhatsApp do colaborador (com DDD)" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        <input required type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha (defina uma pra ele começar)" className="w-full rounded-lg border border-ink/15 px-3 py-2" />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)]">
          Adicionar colaborador
        </button>
      </form>

      {ultimoLoginCriado && (
        <p className="rounded-lg bg-brand/10 p-3 text-sm">
          Colaborador criado! O login dele é <strong>{ultimoLoginCriado}</strong> — repasse
          esse login e a senha que você definiu.
        </p>
      )}

      <div className="space-y-2">
        {colaboradores.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink/10 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink/5">
                  {c.foto_url && <img src={c.foto_url} alt={c.nome} className="h-full w-full object-cover object-center" />}
                </div>
                <div>
                  <p className="font-medium">
                    {c.nome} {c.login_id.startsWith("principal-") && <span className="ml-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink/50">Principal — é você</span>}
                  </p>
                  {!c.login_id.startsWith("principal-") && (
                    <p className="text-ink/50">
                      login: {c.login_id} — comissão: {c.percentual_comissao ?? 0}%
                      {c.pix_chave ? " · Pix configurado" : " · sem Pix (repasse não funciona sem isso)"}
                    </p>
                  )}
                  <label className="mt-1 flex items-center gap-2 text-xs text-ink/60">
                    <input
                      type="checkbox" checked={c.confirmacao_automatica}
                      onChange={() => alternarConfirmacaoAutomatica(c)}
                    />
                    Confirmar agendamentos automaticamente (sem precisar aprovar)
                  </label>
                  {c.login_id.startsWith("principal-") && mensagemPrincipal && (
                    <p className="mt-1 text-xs text-red-600">{mensagemPrincipal}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-3">
                {c.login_id.startsWith("principal-") ? (
                  <button onClick={() => alternarAtivoPrincipal(c)} className={c.ativo ? "text-ink/60 hover:underline" : "text-brand hover:underline"}>
                    {c.ativo ? "Desativar" : "Ativar"}
                  </button>
                ) : (
                  <>
                    <button onClick={() => abrirEdicao(c)} className="text-brand hover:underline">
                      Editar comissão/Pix
                    </button>
                    <button onClick={() => { setTrocandoSenhaDe(c.id); setEditando(null); setMensagemSenha(null); }} className="text-brand hover:underline">
                      Trocar senha
                    </button>
                    <button onClick={() => remover(c.id)} className="text-red-600 hover:underline">Remover</button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 border-t border-ink/5 pt-3">
              <UploadFoto
                fotoAtual={c.foto_url} endpoint="/api/colaboradores/foto" campoExtra={{ colaboradorId: c.id }}
                rotulo="Foto" ocultarPreview
                onEnviado={(url) => setColaboradores((atual) => atual.map((item) => (item.id === c.id ? { ...item, foto_url: url } : item)))}
              />
            </div>

            {editando === c.id && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <div className="flex items-center gap-2">
                  <input value={percentualEdit} onChange={(e) => setPercentualEdit(e.target.value)}
                    placeholder="% que fica com ele" className="w-32 rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                  <span className="text-xs text-ink/50">% do valor do serviço</span>
                </div>
                <input value={telefoneEdit} onChange={(e) => setTelefoneEdit(e.target.value)}
                  placeholder="WhatsApp do colaborador (usado para autorizar saques)"
                  className="w-full rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                <div className="flex flex-wrap gap-2">
                  <select value={pixTipoEdit} onChange={(e) => setPixTipoEdit(e.target.value)}
                    className="rounded-lg border border-ink/15 px-2 py-1.5 text-xs">
                    {TIPOS_CHAVE.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={pixChaveEdit} onChange={(e) => setPixChaveEdit(e.target.value)}
                    placeholder="Chave Pix do colaborador (pra receber o repasse)"
                    className="flex-1 rounded-lg border border-ink/15 px-2 py-1.5 text-xs" />
                </div>
                <p className="text-xs text-ink/50">
                  O repasse é feito automaticamente por Pix normal, saindo da sua própria conta,
                  assim que o pagamento do cliente confirmar.
                </p>
                {erro && <p className="text-xs text-red-600">{erro}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => salvarEdicao(c.id)} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
                    Salvar
                  </button>
                  <button onClick={() => setEditando(null)} className="rounded-lg border border-ink/15 px-4 py-1.5 text-xs">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {trocandoSenhaDe === c.id && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <input
                  type="password" minLength={8} value={novaSenhaEdit} onChange={(e) => setNovaSenhaEdit(e.target.value)}
                  placeholder="Nova senha pra esse colaborador"
                  className="w-full rounded-lg border border-ink/15 px-2 py-1.5 text-xs"
                />
                {mensagemSenha && <p className="text-xs text-ink/60">{mensagemSenha}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => trocarSenha(c.id)} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
                    Salvar nova senha
                  </button>
                  <button onClick={() => { setTrocandoSenhaDe(null); setNovaSenhaEdit(""); setMensagemSenha(null); }} className="rounded-lg border border-ink/15 px-4 py-1.5 text-xs">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
