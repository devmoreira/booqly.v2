"use client";
import { useEffect, useState } from "react";

export default function AdminRodapePage() {
  const [descricao, setDescricao] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [emailSuporte, setEmailSuporte] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/rodape").then((r) => r.json()).then((d) => {
      setDescricao(d.rodape_descricao ?? "");
      setInstagram(d.rodape_instagram ?? "");
      setWhatsapp(d.rodape_whatsapp ?? "");
      setFacebook(d.rodape_facebook ?? "");
      setTiktok(d.rodape_tiktok ?? "");
      setEmailSuporte(d.rodape_email_suporte ?? "");
      setCarregando(false);
    });
  }, []);

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    const resp = await fetch("/api/admin/rodape", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rodapeDescricao: descricao,
        rodapeInstagram: instagram,
        rodapeWhatsapp: whatsapp,
        rodapeFacebook: facebook,
        rodapeTiktok: tiktok,
        rodapeEmailSuporte: emailSuporte,
      }),
    });
    setSalvando(false);
    setMensagem(resp.ok ? "Salvo." : "Não foi possível salvar — confira se os links começam com https://");
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Rodapé da página inicial</h1>
        <p className="mt-1 text-ink/60">
          Os ícones de rede social só aparecem se você preencher o link — sem isso, ficam
          escondidos (nunca mostramos um link quebrado).
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">Descrição (abaixo do nome)</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Instagram (link completo)</label>
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
          placeholder="https://instagram.com/seuperfil"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">WhatsApp (link completo, ex: https://wa.me/55...)</label>
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="https://wa.me/5527999999999"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Facebook (link completo)</label>
        <input value={facebook} onChange={(e) => setFacebook(e.target.value)}
          placeholder="https://facebook.com/seuperfil"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">TikTok (link completo)</label>
        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)}
          placeholder="https://tiktok.com/@seuperfil"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">E-mail de suporte</label>
        <input value={emailSuporte} onChange={(e) => setEmailSuporte(e.target.value)}
          placeholder="suporte@seudominio.com.br"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
      </div>

      <div>
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-brand px-6 py-2.5 font-medium text-[var(--brand-fg)] disabled:opacity-60">
          {salvando ? "Salvando..." : "Salvar rodapé"}
        </button>
        {mensagem && <p className="mt-2 text-sm text-ink/60">{mensagem}</p>}
      </div>
    </div>
  );
}
