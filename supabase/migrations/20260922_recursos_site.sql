-- Recursos exibidos na página pública /recursos.
-- O admin pode adicionar, editar, ocultar e excluir recursos.

create table if not exists recursos_site (
  id uuid primary key default gen_random_uuid(),
  titulo text not null unique,
  texto text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_recursos_site_ordem on recursos_site (ordem, criado_em);

-- Migra para o banco os recursos que já existiam na página pública.
-- O ON CONFLICT evita duplicar se esta migration for executada novamente.
insert into recursos_site (titulo, texto, ordem, ativo) values
  ('Agenda online', 'Cliente marca sozinho, direto na página do seu estabelecimento, sem precisar de app.', 0, true),
  ('Pagamento na sua própria conta', 'Conecte sua conta Asaas ou Mercado Pago — Pix e cartão caem direto pra você, sem intermediário no meio do caminho.', 1, true),
  ('Escolha como cobrar', 'Taxa só pra reservar o horário, pagamento total antecipado, ou cobrança só depois do atendimento — você decide.', 2, true),
  ('Colaboradores', 'Cadastre sua equipe, cada um com login e agenda próprios, foto de perfil, e confirmação automática configurável.', 3, true),
  ('Repasse automático pro colaborador', 'A fatia de cada atendimento vai por Pix pro colaborador certo, assim que o cliente paga.', 4, true),
  ('Horário de almoço por colaborador', 'Cada colaborador pode ter seu próprio intervalo — durante o almoço, ele some da disponibilidade, sem bloquear o estabelecimento inteiro.', 5, true),
  ('Bloqueios pontuais', 'Folga, feriado, imprevisto — bloqueia um horário específico e o cliente nem vê como disponível.', 6, true),
  ('Bloquear cliente problemático', 'Se algum cliente for um problema recorrente, profissional ou colaborador pode bloqueá-lo — ele para de conseguir agendar ali.', 7, true),
  ('Categorias de serviço inteligentes', 'Busca reconhece sinônimos (ex: "cabelo" encontra salão e barbearia) — o cliente acha o que precisa mesmo sem saber o termo exato.', 8, true),
  ('Cupom de desconto', 'Crie campanhas de desconto pros seus clientes, sem mexer em preço nenhum — quem banca a diferença é a plataforma, não você.', 9, true),
  ('Indique e ganhe', 'Cliente indica amigo, colaborador indica outro estabelecimento, você indica outro profissional — todo mundo tem um jeito de ganhar saldo indicando.', 10, true),
  ('Reputação cruzada', 'A avaliação de um cliente vale em qualquer estabelecimento do {{nome}} — profissionais sabem quem estão atendendo, e o cliente também avalia onde foi.', 11, true),
  ('Lembrete pra clientes que sumiram', 'Configure uma vez e o sistema avisa sozinho quem não volta há um tempo — ou mande uma notificação manual quando quiser (Premium).', 12, true),
  ('Notificação no celular', 'Cliente e profissional recebem aviso direto na tela, sem precisar abrir o app: confirmação, lembrete, novo agendamento — funciona até no iPhone.', 13, true),
  ('Histórico completo', 'Cliente vê a foto do estabelecimento e de quem atendeu em cada visita passada; profissional vê tudo organizado por status e por dia.', 14, true),
  ('Relatório de ganhos', 'Acompanhe faturamento por período e por colaborador, e baixe pra levar pro seu contador.', 15, true),
  ('Calendário por colaborador', 'Alterne entre lista e uma visão de calendário com uma coluna por colaborador — dá pra ver o dia inteiro da equipe de relance.', 16, true),
  ('Loja de produtos (Premium)', 'Venda produto pro cliente retirar no local — pomada, shampoo, o que fizer sentido pro seu negócio. Cliente paga antecipado, você não se preocupa com frete.', 17, true),
  ('Story do estabelecimento', 'Até 3 fotos em destaque na sua página, igual Instagram — o cliente clica na sua foto de perfil e vê em tela cheia.', 18, true),
  ('Comunidade de {{nome}}', 'Converse com outros profissionais da sua área (barbeiro com barbeiro, manicure com manicure) — troque dica, tire dúvida, sem misturar categorias diferentes.', 19, true)
on conflict (titulo) do nothing;

alter table recursos_site enable row level security;
