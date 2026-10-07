"use client";
import { useEffect, useState } from "react";

type Produto = { id: string; nome: string; preco_centavos: number; foto_url: string | null; estoque: number };
type ItemCarrinho = { produto: Produto; quantidade: number };

export function LojaPublica({
  produtos, clienteLogado,
}: { produtos: Produto[]; clienteLogado: { nome: string; telefone: string; documento?: string | null } | null }) {
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "credito" | "debito">("pix");
  const [documento, setDocumento] = useState(clienteLogado?.documento ?? "");
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<{ pedidoId: string; qrCodePix?: string; qrCodeImagemBase64?: string; linkPagamento?: string } | null>(null);
  const [statusPedido, setStatusPedido] = useState<string | null>(null);

  const itens: ItemCarrinho[] = produtos
    .filter((p) => carrinho[p.id] > 0)
    .map((p) => ({ produto: p, quantidade: carrinho[p.id] }));
  const totalCentavos = itens.reduce((soma, i) => soma + i.produto.preco_centavos * i.quantidade, 0);

  function adicionar(p: Produto) {
    setCarrinho((c) => ({ ...c, [p.id]: Math.min((c[p.id] ?? 0) + 1, p.estoque) }));
  }
  function remover(p: Produto) {
    setCarrinho((c) => ({ ...c, [p.id]: Math.max((c[p.id] ?? 0) - 1, 0) }));
  }

  // Só suporta 1 produto por compra pra manter simples — se tiver mais
  // de um no carrinho, pede pra finalizar um de cada vez.
  async function comprar() {
    setErro(null);
    if (itens.length === 0) { setErro("Adicione pelo menos um produto."); return; }
    if (itens.length > 1) { setErro("Por enquanto, finalize um produto por vez."); return; }
    if (!documento || documento.replace(/\D/g, "").length < 11) { setErro("Digite um CPF válido."); return; }

    setComprando(true);
    const resp = await fetch("/api/pedidos-produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        produtoId: itens[0].produto.id,
        quantidade: itens[0].quantidade,
        formaPagamento,
        documento: documento.replace(/\D/g, ""),
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    setComprando(false);
    if (!resp.ok) { setErro(dados.erro ?? "Não foi possível comprar."); return; }
    setPagamento({ pedidoId: dados.pedidoId, ...dados.pagamento });
    setStatusPedido("pendente");
  }

  useEffect(() => {
    if (!pagamento || statusPedido !== "pendente") return;
    const intervalo = setInterval(async () => {
      const resp = await fetch(`/api/pedido-produto-status?id=${pagamento.pedidoId}`);
      const dados = await resp.json();
      if (dados.status && dados.status !== "pendente") { setStatusPedido(dados.status); clearInterval(intervalo); }
    }, 3000);
    return () => clearInterval(intervalo);
  }, [pagamento, statusPedido]);

  if (!clienteLogado) {
    return <p className="mt-8 text-center text-sm text-ink/50">Faça login como cliente pra comprar produtos.</p>;
  }

  if (pagamento) {
    if (statusPedido === "pago_aguardando_retirada") {
      return (
        <div className="mt-8 rounded-lg bg-brand/10 p-4 text-center text-sm">
          <p className="font-medium">Pagamento confirmado! 🎉</p>
          <p className="mt-1 text-ink/60">Passe no estabelecimento pra retirar quando quiser.</p>
        </div>
      );
    }
    if (statusPedido === "expirado" || statusPedido === "falhou") {
      return (
        <div className="mt-8 rounded-lg bg-red-50 p-4 text-center text-sm text-red-700">
          {statusPedido === "expirado" ? "O tempo pra pagar acabou." : "O pagamento falhou."} Tente de novo.
          <button onClick={() => { setPagamento(null); setStatusPedido(null); }} className="mt-2 block underline">Voltar</button>
        </div>
      );
    }
    return (
      <div className="mt-8 space-y-3 text-center">
        {pagamento.qrCodeImagemBase64 && (
          <img src={`data:image/png;base64,${pagamento.qrCodeImagemBase64}`} alt="QR code Pix" className="mx-auto h-48 w-48" />
        )}
        {pagamento.qrCodePix && (
          <p className="break-all rounded-lg bg-ink/5 p-2 text-xs text-ink/60">{pagamento.qrCodePix}</p>
        )}
        {pagamento.linkPagamento && (
          <a href={pagamento.linkPagamento} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-brand py-2 text-sm font-medium text-[var(--brand-fg)]">
            Abrir pagamento
          </a>
        )}
        <p className="text-xs text-ink/50">Aguardando confirmação...</p>
      </div>
    );
  }

  if (produtos.length === 0) {
    return <p className="mt-8 text-center text-sm text-ink/50">Nenhum produto disponível no momento.</p>;
  }

  return (
    <div className="mt-6 w-full max-w-sm">
      <div className="space-y-2">
        {produtos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3 text-sm">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink/5">
              {p.foto_url && <img src={p.foto_url} alt={p.nome} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{p.nome}</p>
              <p className="text-ink/50">R$ {(p.preco_centavos / 100).toFixed(2)}{p.estoque <= 3 && ` · ${p.estoque} restantes`}</p>
            </div>
            {carrinho[p.id] > 0 ? (
              <div className="flex items-center gap-2">
                <button onClick={() => remover(p)} className="h-6 w-6 rounded-full border border-ink/15 text-sm">-</button>
                <span>{carrinho[p.id]}</span>
                <button onClick={() => adicionar(p)} className="h-6 w-6 rounded-full border border-ink/15 text-sm">+</button>
              </div>
            ) : (
              <button onClick={() => adicionar(p)} className="rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand">
                Adicionar
              </button>
            )}
          </div>
        ))}
      </div>

      {itens.length > 0 && (
        <div className="mt-4 rounded-lg bg-ink/5 p-3">
          {itens.map((i) => (
            <div key={i.produto.id} className="flex justify-between text-sm text-ink/60">
              <span>{i.produto.nome} × {i.quantidade}</span>
              <span>R$ {((i.produto.preco_centavos * i.quantidade) / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 text-sm font-medium">
            <span>Total</span>
            <span>R$ {(totalCentavos / 100).toFixed(2)}</span>
          </div>

          <div className="mt-3 flex gap-2">
            {(["pix", "credito", "debito"] as const).map((f) => (
              <button key={f} onClick={() => setFormaPagamento(f)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${formaPagamento === f ? "border-brand bg-brand/10 font-medium text-brand" : "border-ink/15 text-ink/60"}`}>
                {f === "pix" ? "Pix" : f === "credito" ? "Crédito" : "Débito"}
              </button>
            ))}
          </div>

          <label className="mt-2 block text-xs font-medium text-ink/70">
            Seu CPF (necessário pra processar o pagamento)
          </label>
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          {formaPagamento !== "pix" && (
            <p className="mt-1 text-xs text-ink/50">
              Use o CPF de quem é titular do cartão — se for diferente, o banco pode recusar o pagamento.
            </p>
          )}

          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          <button onClick={comprar} disabled={comprando}
            className="mt-2 w-full rounded-lg bg-brand py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60">
            {comprando ? "Gerando pagamento..." : "Pagar e reservar"}
          </button>
          <p className="mt-2 text-center text-xs text-ink/40">Retirada no local — pague agora, pegue quando quiser.</p>
        </div>
      )}
    </div>
  );
}
