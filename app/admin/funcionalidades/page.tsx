"use client";
import { useEffect, useState } from "react";

export default function AdminFuncionalidadesPage() {
  const [cuponsAtiva, setCuponsAtiva] = useState(true);
  const [testeGratisAtiva, setTesteGratisAtiva] = useState(true);
  const [buscaClienteAtiva, setBuscaClienteAtiva] = useState(true);
  const [gatewayAsaasAtivo, setGatewayAsaasAtivo] = useState(true);
  const [gatewayMercadopagoAtivo, setGatewayMercadopagoAtivo] = useState(true);
  const [comunidadeMinimo, setComunidadeMinimo] = useState(50);
  const [salvandoMinimo, setSalvandoMinimo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/funcionalidades").then((r) => r.json()).then((d) => {
      setCuponsAtiva(d.funcionalidade_cupons_ativa ?? true);
      setTesteGratisAtiva(d.funcionalidade_teste_gratis_ativa ?? true);
      setBuscaClienteAtiva(d.funcionalidade_busca_cliente_ativa ?? true);
      setGatewayAsaasAtivo(d.gateway_asaas_ativo ?? true);
      setGatewayMercadopagoAtivo(d.gateway_mercadopago_ativo ?? true);
      setComunidadeMinimo(d.comunidade_minimo_assinantes ?? 50);
      setCarregando(false);
    });
  }, []);

  async function salvar(campo: Record<string, boolean | number>) {
    setSalvando(true);
    await fetch("/api/admin/funcionalidades", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campo),
    });
    setSalvando(false);
  }

  if (carregando) return <p className="text-ink/60">Carregando...</p>;

  const ITENS = [
    {
      chave: "cuponsAtiva", ativo: cuponsAtiva, set: setCuponsAtiva,
      titulo: "Cupons de desconto",
      descricao: "Desliga o campo de cupom no agendamento e o gerenciamento de cupons.",
    },
    {
      chave: "testeGratisAtiva", ativo: testeGratisAtiva, set: setTesteGratisAtiva,
      titulo: "Teste grátis",
      descricao: "Desligado, novos profissionais precisam assinar direto — sem período de teste.",
    },
    {
      chave: "buscaClienteAtiva", ativo: buscaClienteAtiva, set: setBuscaClienteAtiva,
      titulo: "Busca dentro da área do cliente",
      descricao: "Deixa o cliente logado buscar um novo estabelecimento sem sair da conta. A busca da home continua funcionando de qualquer jeito.",
    },
    {
      chave: "gatewayAsaasAtivo", ativo: gatewayAsaasAtivo, set: setGatewayAsaasAtivo,
      titulo: "Gateway: Asaas",
      descricao: "Desligado, some da lista de opções pra conectar, e quem já usa Asaas para de conseguir cobrar (avisado por push).",
    },
    {
      chave: "gatewayMercadopagoAtivo", ativo: gatewayMercadopagoAtivo, set: setGatewayMercadopagoAtivo,
      titulo: "Gateway: Mercado Pago",
      descricao: "Desligado, some da lista de opções pra conectar, e quem já usa Mercado Pago para de conseguir cobrar (avisado por push).",
    },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Funcionalidades</h1>
        <p className="mt-1 text-ink/60">
          Liga e desliga recursos inteiros do sistema. Desligado, o recurso some das
          telas de todo mundo (botões, campos e menus ficam ocultos).
        </p>
      </div>

      {ITENS.map((item) => (
        <div key={item.chave} className="flex items-center justify-between rounded-lg border border-ink/10 p-4">
          <div className="pr-4">
            <p className="font-medium">{item.titulo}</p>
            <p className="text-sm text-ink/60">{item.descricao}</p>
          </div>
          <button
            disabled={salvando}
            onClick={() => { item.set(!item.ativo); salvar({ [item.chave]: !item.ativo }); }}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${item.ativo ? "bg-brand text-[var(--brand-fg)]" : "border border-ink/15"}`}
          >
            {item.ativo ? "Ativado" : "Desativado"}
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-ink/10 p-4">
        <div>
          <p className="font-medium">Comunidade: mínimo de assinantes pra desbloquear</p>
          <p className="mt-1 text-sm text-ink/60">
            Cada categoria (barbeiro, manicure, etc.) só libera a própria comunidade quando bate
            esse número de assinantes Básico/Premium ATIVOS naquela categoria. Vale igual pra todas.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="number" min={1} value={comunidadeMinimo}
            onChange={(e) => setComunidadeMinimo(Number(e.target.value))}
            className="w-20 rounded-lg border border-ink/15 px-2 py-2 text-sm"
          />
          <button
            onClick={async () => { setSalvandoMinimo(true); await salvar({ comunidadeMinimoAssinantes: comunidadeMinimo }); setSalvandoMinimo(false); }}
            disabled={salvandoMinimo}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-fg)] disabled:opacity-60"
          >
            {salvandoMinimo ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
