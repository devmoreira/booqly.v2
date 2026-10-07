"use client";
import { useEffect, useState } from "react";
import { UploadFoto } from "@/components/UploadFoto";
import Link from "next/link";

type Produto = { id: string; nome: string; preco_centavos: number; foto_url: string | null; estoque: number; ativo: boolean };
type Pedido = {
  id: string; produtoNome: string; quantidade: number; valorTotalCentavos: number;
  formaPagamento: string; status: string; clienteNome: string; criadoEm: string;
};
type Aba = "produtos" | "pedidos";

export default function LojaPage() {
  const [premium, setPremium] = useState<boolean | null>(null);
  const [aba, setAba] = useState<Aba>("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregarProdutos() {
    const d = await fetch("/api/painel/produtos").then((r) => r.json());
    setPremium(d.premium);
    setProdutos(d.produtos ?? []);
    setCarregando(false);
  }
  async function carregarPedidos() {
    const d = await fetch("/api/painel/pedidos-produtos").then((r) => r.json());
    setPedidos(d.pedidos ?? []);
  }

  useEffect(() => { carregarProdutos(); carregarPedidos(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const resp = await fetch("/api/painel/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, precoCentavos: Math.round(parseFloat(preco.replace(",", ".")) * 100), estoque: Number(estoque) }),
    });
    const dados = await resp.json().catch(() => ({}));
    setSalvando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível adicionar."); return; }
    setNome(""); setPreco(""); setEstoque("");
    carregarProdutos();
  }

  async function alternarAtivo(p: Produto) {
    await fetch("/api/painel/produtos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, ativo: !p.ativo }),
    });
    carregarProdutos();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esse produto de vez?")) return;
    await fetch("/api/painel/produtos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregarProdutos();
  }

  async function marcarRetirado(id: string) {
    await fetch("/api/painel/pedidos-produtos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    carregarPedidos();
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  if (!premium) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-display text-2xl font-bold">Loja</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A loja de produtos é exclusiva do plano <strong>Premium</strong> — venda produtos pra retirar
          no local, sem se preocupar com frete.{" "}
          <Link href="/assinatura" className="underline">Fazer upgrade</Link>
        </div>
      </div>
    );
  }

  const pendentes = pedidos.filter((p) => p.status === "pago_aguardando_retirada");
  const jaRetirados = pedidos.filter((p) => p.status === "retirado");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Loja</h1>
        <p className="mt-1 text-ink/60">Venda produtos pra retirar no local — o cliente paga antes, pela mesma forma de pagamento do agendamento.</p>
      </div>

      <div className="flex border-b border-ink/10">
        <button onClick={() => setAba("produtos")} className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "produtos" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}>
          Produtos
        </button>
        <button onClick={() => setAba("pedidos")} className={`mr-5 border-b-2 px-1 pb-2.5 text-sm font-medium ${aba === "pedidos" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}>
          Pedidos {pendentes.length > 0 && `(${pendentes.length})`}
        </button>
      </div>

      {aba === "produtos" ? (
        <div className="space-y-6">
          <form onSubmit={adicionar} className="space-y-3 rounded-lg border border-ink/10 p-4">
            <h2 className="font-medium">Adicionar produto</h2>
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto"
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input required value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Preço (ex: 39,90)"
                className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
              <input required type="number" min={0} value={estoque} onChange={(e) => setEstoque(e.target.value)} placeholder="Estoque"
                className="w-28 rounded-lg border border-ink/15 px-3 py-2 text-sm" />
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button disabled={salvando} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
              {salvando ? "Adicionando..." : "Adicionar"}
            </button>
          </form>

          <div className="space-y-2">
            {produtos.length === 0 && <p className="text-sm text-ink/50">Nenhum produto ainda.</p>}
            {produtos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3 text-sm">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink/5">
                  {p.foto_url && <img src={p.foto_url} alt={p.nome} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-ink/50">
                    R$ {(p.preco_centavos / 100).toFixed(2)} · {p.estoque} em estoque
                    {p.estoque === 0 && <span className="text-red-600"> — esgotado</span>}
                  </p>
                  <div className="mt-1 max-w-[160px]">
                    <UploadFoto
                      fotoAtual={p.foto_url} endpoint="/api/painel/produtos/foto" campoExtra={{ produtoId: p.id }}
                      rotulo="Foto" ocultarPreview
                      onEnviado={() => carregarProdutos()}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <button onClick={() => alternarAtivo(p)} className={p.ativo ? "text-ink/60 hover:underline" : "text-brand hover:underline"}>
                    {p.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => excluir(p.id)} className="text-red-600 hover:underline">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-medium">Aguardando retirada</h2>
            {pendentes.length === 0 && <p className="text-sm text-ink/50">Nenhum pedido aguardando.</p>}
            <div className="space-y-2">
              {pendentes.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div>
                    <p className="font-medium">{p.quantidade}x {p.produtoNome}</p>
                    <p className="text-ink/60">{p.clienteNome} — R$ {(p.valorTotalCentavos / 100).toFixed(2)} ({p.formaPagamento})</p>
                  </div>
                  <button onClick={() => marcarRetirado(p.id)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-[var(--brand-fg)]">
                    Marcar como retirado
                  </button>
                </div>
              ))}
            </div>
          </div>

          {jaRetirados.length > 0 && (
            <div>
              <h2 className="mb-2 font-medium text-ink/60">Já retirados</h2>
              <div className="space-y-2">
                {jaRetirados.map((p) => (
                  <div key={p.id} className="rounded-lg border border-ink/10 p-3 text-sm text-ink/50">
                    {p.quantidade}x {p.produtoNome} — {p.clienteNome}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
