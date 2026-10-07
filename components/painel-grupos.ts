export const GRUPOS = [
  { titulo: "Principal", itens: [{ href: "/painel", rotulo: "Visão geral" }, { href: "/painel/agenda", rotulo: "Agenda" }] },
  { titulo: "Gestão", itens: [
    { href: "/painel/servicos", rotulo: "Serviços" }, { href: "/painel/horarios", rotulo: "Horários" },
    { href: "/painel/colaboradores", rotulo: "Colaboradores" }, { href: "/painel/clientes-bloqueados", rotulo: "Clientes bloqueados" },
    { href: "/painel/loja", rotulo: "Loja" }, { href: "/painel/story", rotulo: "Story" }, { href: "/painel/comunidade", rotulo: "Comunidade" },
  ] },
  { titulo: "Crescimento", itens: [
    { href: "/painel/lembrete-clientes", rotulo: "Lembrete pra clientes" }, { href: "/painel/cupons", rotulo: "Cupons" }, { href: "/painel/revenda", rotulo: "Indique e ganhe" },
  ] },
  { titulo: "Financeiro", itens: [{ href: "/painel/receber", rotulo: "Receber pagamentos" }, { href: "/assinatura", rotulo: "Assinatura" }] },
  { titulo: "Conta", itens: [{ href: "/painel/configuracoes", rotulo: "Configurações" }, { href: "/painel/tutorial", rotulo: "Passo a passo" }] },
];

export const ITENS = GRUPOS.flatMap((g) => g.itens);
