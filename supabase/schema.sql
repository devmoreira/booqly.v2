-- ============================================================
-- Booqly — Schema inicial (Fase 1 + estrutura pronta p/ Fase 2/3)
-- Cole este arquivo inteiro no Supabase: SQL Editor -> New query -> Run
-- ============================================================

-- Cada profissional (dono do estabelecimento) que usa o Booqly
create table profissionais (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_negocio text not null,
  nome_proprietario text not null,
  slug text unique not null, -- URL pública (booqly.com.br/slug) E identificador de login
  endereco text not null,
  categoria text not null default 'barbearia'
    check (categoria in ('barbearia', 'salao', 'manicure', 'cabeleireiro', 'esteticista', 'personal_trainer', 'nutricionista', 'outro')),
  cidade text not null,
  estado text not null, -- sigla, ex: 'ES'
  tema text not null default 'verde' check (tema in ('verde', 'preto', 'branco')),
  layout text not null default 'classico' check (layout in ('classico', 'moderno', 'minimalista')),
  is_admin boolean not null default false, -- só quem tem isso marcado vê /admin
  teste_iniciado_em timestamptz not null default now(),
  asaas_customer_id text,      -- id do profissional como "cliente" no Asaas (cobrança da assinatura)
  asaas_subscription_id text,  -- id da assinatura recorrente no Asaas
  -- Dados necessários pra criar a SUBCONTA no Asaas (receber pagamento de cliente, com split)
  cpf_cnpj text,
  data_nascimento date,       -- obrigatório se pessoa física (CPF)
  tipo_empresa text check (tipo_empresa in ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION')), -- obrigatório se CNPJ
  telefone_contato text,
  celular text,
  renda_mensal numeric(12,2), -- exigido pelo Asaas (renda ou faturamento)
  cep text,
  numero_endereco text,
  complemento_endereco text,
  bairro text,
  asaas_subconta_id text,
  asaas_wallet_id text,        -- usado no split de cada cobrança
  asaas_subconta_status text not null default 'nao_iniciado'
    check (asaas_subconta_status in ('nao_iniciado', 'pendente', 'aprovado', 'recusado')),
  -- Modelo simplificado de repasse: sem subconta, o profissional só
  -- informa a própria chave Pix e o sistema transfere automaticamente
  -- (agendado pra data certa) depois que o cliente paga.
  pix_chave text,
  pix_chave_tipo text check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  criado_em timestamptz not null default now()
);

-- Acelera a busca "estabelecimentos na minha cidade, dessa categoria"
create index idx_profissionais_busca on profissionais (cidade, categoria);

-- Colaboradores (ex: os 5 barbeiros de uma barbearia). Cada um tem login
-- próprio (auth.users), mas está sempre vinculado ao profissional dono.
create table colaboradores (
  id uuid primary key references auth.users(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  nome text not null,
  login_id text not null unique, -- ex: "b.joao" (inicial da empresa + "." + nome)
  ativo boolean not null default true,
  -- Repasse automático: se o colaborador tiver chave Pix cadastrada,
  -- ele recebe a própria fatia automaticamente (o resto fica com o dono).
  -- Sem isso preenchido, 100% do repasse continua indo pro dono, como antes.
  pix_chave text,
  pix_chave_tipo text check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  percentual_comissao numeric(5,2), -- % do valor do serviço que fica com ELE; o resto vai pro dono
  confirmacao_automatica boolean not null default false, -- true = agendamento já nasce confirmado, sem precisar aprovar
  criado_em timestamptz not null default now()
);

-- NOTA: o teste grátis aqui é controlado só por conta (e-mail). Sem uma
-- trava adicional (telefone verificado, CNPJ/CPF, etc.), é possível
-- burlar criando contas novas com e-mails diferentes. Ficou assim por
-- decisão do usuário — dá pra reforçar depois se virar problema.

-- ============================================================
-- PLANOS E ASSINATURA
-- ============================================================
-- Planos configuráveis pelo admin (nome, duração, valor)
create table planos_assinatura (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- ex: "Mensal", "Anual"
  duracao_meses int not null, -- 1 = mensal, 12 = anual, etc.
  valor_centavos int not null,
  nivel text not null default 'basico' check (nivel in ('basico', 'premium')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cupons de desconto na assinatura (ex: campanha de lançamento)
create table cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null, -- sempre guardado em maiúsculo
  tipo text not null check (tipo in ('percentual', 'fixo')),
  valor numeric(10,2) not null, -- percentual (20.00 = 20%) ou valor fixo em reais
  publico text not null default 'profissional' check (publico in ('profissional', 'cliente')),
  -- 'profissional' = desconto na assinatura da plataforma (como já era)
  -- 'cliente' = desconto no agendamento do cliente final — a PLATAFORMA
  -- absorve esse valor, o profissional recebe como se não tivesse desconto
  ativo boolean not null default true,
  validade timestamptz, -- null = sem data de validade
  usos_maximos int, -- null = uso ilimitado
  usos_atuais int not null default 0,
  criado_em timestamptz not null default now()
);

-- Histórico de assinaturas de cada profissional
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  plano_id uuid references planos_assinatura(id),
  cupom_id uuid references cupons(id),
  status text not null default 'ativa' check (status in ('ativa', 'vencida', 'cancelada')),
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  criado_em timestamptz not null default now()
);

-- Configuração de cobrança de cada profissional (as 3 opções que você definiu)
create table configuracoes_cobranca (
  profissional_id uuid primary key references profissionais(id) on delete cascade,
  metodo text not null default 'pos_servico'
    check (metodo in ('taxa_agendamento', 'pagamento_total', 'pos_servico')),
  taxa_tipo text check (taxa_tipo in ('percentual', 'fixo')),
  taxa_valor numeric(10,2), -- percentual (ex: 20.00 = 20%) ou valor fixo em reais
  aceita_pix boolean not null default true,
  aceita_credito boolean not null default true,
  aceita_debito boolean not null default true
);

-- Serviços oferecidos por cada profissional
create table servicos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  nome text not null,
  duracao_minutos int not null,
  preco_centavos int not null,
  ativo boolean not null default true
);

-- Horário de funcionamento por dia da semana (0 = domingo ... 6 = sábado)
create table horarios_funcionamento (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  ativo boolean not null default true,
  unique (profissional_id, dia_semana)
);

-- Bloqueios pontuais (ex: almoço, folga, feriado) — tira horários da
-- disponibilidade sem precisar apagar o dia inteiro do funcionamento
create table bloqueios_agenda (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  colaborador_id uuid references colaboradores(id) on delete cascade, -- null = bloqueio geral do estabelecimento
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  criado_em timestamptz not null default now()
);

-- Clientes que agendam (podem ou não ter conta)
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  criado_em timestamptz not null default now()
);

-- Um telefone só pode pertencer a UM cliente (evita duplicar cadastro
-- quando a mesma pessoa agenda de novo ou entra na área do cliente).
-- "where telefone is not null" permite vários agendamentos avulsos sem
-- telefone (visitante que não quis informar).
create unique index idx_clientes_telefone_unico on clientes (telefone) where telefone is not null;

-- Sessão de login do cliente (login só por telefone, sem senha — por
-- decisão do usuário: simples e sem custo, mas menos seguro do que
-- verificar por SMS. Se algum dia quiser reforçar, é só validar o
-- telefone com um código antes de criar a sessão aqui).
create table sessoes_clientes (
  token uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

-- Agendamentos
create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  colaborador_id uuid references colaboradores(id) on delete set null, -- null = atendido pelo dono/qualquer um
  servico_id uuid not null references servicos(id),
  cliente_id uuid not null references clientes(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'concluido', 'cancelado')),
  status_pagamento text not null default 'nao_cobrado'
    check (status_pagamento in ('nao_cobrado', 'pendente', 'pago_parcial', 'pago_total', 'falhou')),
  valor_pago_centavos int not null default 0,
  lembrete_3h_enviado boolean not null default false,
  lembrete_30min_enviado boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Memória de curto prazo da conversa da Izabel com cada telefone —
-- necessário porque agendar um horário novo leva várias mensagens (qual
-- estabelecimento, qual serviço, qual dia...). Guarda só o essencial,
-- e expira sozinha (a Izabel some do assunto depois de um tempo parado).
create table conversas_whatsapp (
  telefone text primary key,
  historico jsonb not null default '[]'::jsonb, -- últimas mensagens trocadas
  ultima_mensagem_id text, -- evita processar a mesma mensagem duas vezes
  atualizado_em timestamptz not null default now()
);

-- Registro de cada cobrança feita (histórico, pode ter mais de uma por agendamento
-- quando o método é "taxa_agendamento": 1 cobrança da taxa + 1 do restante)
create table cobrancas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references agendamentos(id) on delete cascade,
  gateway text not null check (gateway in ('asaas', 'mercadopago')),
  cobranca_id_externo text not null,
  forma text not null check (forma in ('pix', 'credito', 'debito')),
  valor_centavos int not null,
  tipo text not null check (tipo in ('taxa_agendamento', 'restante', 'total')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou', 'estornado')),
  repasse_status text not null default 'nao_iniciado' check (repasse_status in ('nao_iniciado', 'agendado', 'concluido', 'falhou', 'cancelado')),
  repasse_id_externo text,
  repasse_data date, -- data em que o dinheiro deve cair pro profissional
  comissao_plataforma_centavos int, -- quanto a PLATAFORMA reteve nessa cobrança
    -- de verdade, gravado no momento do repasse (não recalculado depois —
    -- se você mudar o valor da comissão no futuro, o histórico continua correto)
  criado_em timestamptz not null default now()
);

-- Sistema de afiliados: config por profissional
create table configuracoes_afiliados (
  profissional_id uuid primary key references profissionais(id) on delete cascade,
  ativo boolean not null default false,
  indicacoes_necessarias int not null default 3 -- quantos indicados até ganhar 1 serviço grátis
);

-- Pontuação acumulada de cada cliente, por profissional
create table pontos_afiliados (
  cliente_id uuid not null references clientes(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  pontos int not null default 0,
  primary key (cliente_id, profissional_id)
);

-- Área de streaming (YouTube / m3u), controlada pelo admin da plataforma
create table configuracoes_plataforma (
  id int primary key default 1,
  gateway_pagamento_ativo text not null default 'asaas' check (gateway_pagamento_ativo in ('asaas', 'mercadopago')),
  asaas_api_key text,
  asaas_ambiente text not null default 'sandbox' check (asaas_ambiente in ('sandbox', 'production')),
  asaas_webhook_token text,
  mercadopago_access_token text,
  streaming_ativo boolean not null default false,
  teste_gratis_horas int not null default 240, -- 240h = 10 dias; edite pelo painel admin
  comissao_plataforma_centavos int not null default 100, -- valor fixo (em centavos) descontado por cobrança — não é mais %
  resend_api_key text,           -- usado pra mandar e-mail de notificação (novo agendamento etc)
  resend_email_remetente text,   -- ex: "Booqly <avisos@seudominio.com.br>"
  -- Assistente Izabel (WhatsApp)
  whatsapp_ativo boolean not null default false,
  whatsapp_phone_number_id text,   -- da conta WhatsApp Business (Meta)
  whatsapp_access_token text,
  whatsapp_verify_token text,      -- inventado por você, confirma o webhook com a Meta
  whatsapp_app_secret text,        -- "App Secret" do painel de desenvolvedor da Meta —
                                    -- usado só pra confirmar que a mensagem é mesmo da Meta
  anthropic_api_key text,          -- usada pra Izabel "pensar" (Claude)
  -- Rodapé da página inicial
  rodape_descricao text,
  rodape_instagram text,
  rodape_whatsapp text,
  rodape_facebook text,
  rodape_tiktok text,
  rodape_email_suporte text,
  check (id = 1) -- garante que só existe 1 linha (configuração global)
);
insert into configuracoes_plataforma (id) values (1);

-- NOTA DE SEGURANÇA: as chaves de pagamento acima ficam no banco (em vez do
-- .env) pra você poder trocá-las pelo painel de admin, sem editar código.
-- Isso só é seguro porque essa tabela está travada por RLS (veja mais
-- abaixo) — só rotas do servidor, usando a service role key, conseguem
-- ler ou escrever aqui. O navegador nunca tem acesso direto a essas chaves.
create table conteudos_streaming (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null check (tipo in ('youtube', 'm3u')),
  url text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Reserva temporária de horário enquanto o pagamento não confirma. O
-- agendamento de verdade só é criado quando o Pix/cartão é confirmado
-- (webhook) — até lá, isso aqui é só o que segura o horário pra ninguém
-- mais conseguir marcar em cima.
create table checkouts_pendentes (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  colaborador_id uuid references colaboradores(id) on delete cascade,
  servico_id uuid not null references servicos(id),
  cliente_id uuid not null references clientes(id) on delete cascade,
  indicado_por_cliente_id uuid references clientes(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  metodo text not null check (metodo in ('taxa_agendamento', 'pagamento_total')),
  forma_pagamento text not null check (forma_pagamento in ('pix', 'credito', 'debito')),
  valor_centavos int not null, -- valor que o CLIENTE realmente paga (já com desconto de cupom, se houver)
  valor_original_centavos int not null, -- valor sem desconto — é a base do repasse pro profissional
  cupom_id uuid references cupons(id),
  desconto_centavos int not null default 0, -- quanto a PLATAFORMA está bancando desse desconto
  cobranca_id_externo text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'expirado', 'falhou')),
  agendamento_id uuid references agendamentos(id), -- preenchido só depois que o pagamento confirma
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);
alter table checkouts_pendentes enable row level security; -- travada: só o servidor acessa
create index idx_checkouts_pendentes_profissional on checkouts_pendentes (profissional_id, inicio);

-- Trava de idempotência dos webhooks do Asaas — impede processar o
-- mesmo aviso de pagamento duas vezes (o Asaas pode reenviar).
create table webhooks_asaas_processados (
  chave text primary key, -- "{idDoPagamento}:{status}"
  criado_em timestamptz not null default now()
);
alter table webhooks_asaas_processados enable row level security;

-- Avaliação do ESTABELECIMENTO feita pelo cliente — pública, qualquer
-- um vê (aparece na página do profissional). Só depois do serviço
-- concluído, e só uma vez por agendamento.
create table avaliacoes_estabelecimento (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  agendamento_id uuid not null references agendamentos(id) on delete cascade unique,
  nota int not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now()
);
alter table avaliacoes_estabelecimento enable row level security;
create policy "qualquer um vê avaliações de estabelecimento" on avaliacoes_estabelecimento
  for select using (true);
-- inserir só via rota do servidor (confere que o agendamento é do
-- cliente logado e já foi concluído)

-- Avaliação do CLIENTE feita pelo profissional/colaborador — NUNCA
-- pública, e o próprio cliente também não vê. Só quem atende (qualquer
-- estabelecimento da plataforma) consegue consultar, tipo reputação
-- de passageiro no Uber.
create table avaliacoes_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  colaborador_id uuid references colaboradores(id) on delete set null,
  agendamento_id uuid not null references agendamentos(id) on delete cascade unique,
  nota int not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now()
);
alter table avaliacoes_cliente enable row level security; -- travada: só o servidor acessa

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
-- O Postgres NÃO cria índice automático em chave estrangeira (só na
-- chave primária) — sem isso, filtros por profissional_id/cliente_id
-- ficam cada vez mais lentos conforme o banco cresce.
create index idx_agendamentos_profissional on agendamentos (profissional_id, inicio);
create index idx_agendamentos_cliente on agendamentos (cliente_id);
create index idx_agendamentos_colaborador on agendamentos (colaborador_id);
create index idx_agendamentos_servico on agendamentos (servico_id);
create index idx_cobrancas_agendamento on cobrancas (agendamento_id);
create index idx_colaboradores_profissional on colaboradores (profissional_id);
create index idx_servicos_profissional on servicos (profissional_id);
create index idx_sessoes_clientes_cliente on sessoes_clientes (cliente_id);
create index idx_assinaturas_profissional on assinaturas (profissional_id);
create index idx_bloqueios_agenda_profissional on bloqueios_agenda (profissional_id, inicio);

-- ============================================================
-- SEGURANÇA (RLS — Row Level Security)
-- ============================================================
-- Regra geral do Booqly: o NAVEGADOR do cliente (quem agenda) NUNCA
-- escreve direto no banco. Toda escrita que envolve dinheiro ou dados
-- de cliente passa por uma rota do servidor (app/api/.../route.ts),
-- que usa a "service role key" (lib/supabase/admin.ts) — essa chave
-- ignora o RLS e SÓ pode existir no servidor, nunca no navegador.
-- Por isso, as tabelas abaixo ficam travadas por padrão: com RLS
-- ativado e SEM nenhuma política pra anon/authenticated, ninguém de
-- fora consegue ler ou escrever nelas usando a chave pública — só o
-- servidor, com a service role, consegue.

alter table profissionais enable row level security;
alter table colaboradores enable row level security;
alter table servicos enable row level security;
alter table horarios_funcionamento enable row level security;
alter table bloqueios_agenda enable row level security;
alter table agendamentos enable row level security;
alter table configuracoes_cobranca enable row level security;
alter table configuracoes_afiliados enable row level security;
alter table clientes enable row level security;              -- travada: só o servidor acessa
alter table sessoes_clientes enable row level security;       -- travada: só o servidor acessa
alter table conversas_whatsapp enable row level security;      -- travada: só o servidor acessa
alter table cobrancas enable row level security;              -- travada: só o servidor acessa
alter table pontos_afiliados enable row level security;       -- travada: só o servidor acessa
alter table configuracoes_plataforma enable row level security; -- travada: só o admin (servidor) acessa
alter table conteudos_streaming enable row level security;
alter table planos_assinatura enable row level security;
alter table assinaturas enable row level security;
alter table cupons enable row level security; -- travada: só o servidor acessa

-- profissionais: perfil é público pra busca, mas só o dono cria/edita o próprio
create policy "profissional vê o próprio perfil completo" on profissionais
  for select using ((select auth.uid()) = id);
-- OBS: dados públicos de OUTROS profissionais (busca, página [slug]) são
-- lidos pelo servidor com a chave de serviço (admin), sempre selecionando
-- só colunas seguras no código — nunca pela chave pública/anon, já que
-- essa tabela guarda dados sensíveis (CPF/CNPJ, chave de API de
-- pagamento criptografada, chave Pix).
create policy "profissional cria o próprio perfil no cadastro" on profissionais
  for insert with check ((select auth.uid()) = id);
create policy "profissional edita o próprio perfil" on profissionais
  for update using ((select auth.uid()) = id);

-- colaboradores: o dono gerencia os próprios colaboradores; o colaborador
-- vê o próprio registro (pra saber a qual estabelecimento pertence).
-- NUNCA existe uma política pública aqui — diferente de profissionais/
-- serviços, essa tabela guarda dado sensível (chave Pix, login_id,
-- percentual de comissão), e RLS controla LINHAS, não COLUNAS: uma
-- política pública de "select" exporia esses campos pra qualquer um
-- com a chave anônima, direto pela API do Supabase, sem passar pelas
-- nossas rotas. Nome/foto pra exibição pública são buscados só via
-- rotas do servidor, com o cliente admin (que ignora RLS de propósito).
create policy "dono gerencia os próprios colaboradores" on colaboradores
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);
create policy "colaborador vê o próprio registro" on colaboradores
  for select using ((select auth.uid()) = id);

create policy "profissional gerencia os próprios serviços" on servicos
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);

-- Serviços ativos também precisam ser visíveis publicamente (o cliente vê
-- a lista de serviços na página do profissional antes de agendar)
create policy "qualquer um vê serviços ativos" on servicos
  for select using (ativo = true);

create policy "profissional gerencia o próprio horário de funcionamento" on horarios_funcionamento
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);
create policy "qualquer um vê o horário de funcionamento" on horarios_funcionamento
  for select using (true);

create policy "profissional gerencia os próprios bloqueios" on bloqueios_agenda
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);

create policy "profissional gerencia os próprios agendamentos" on agendamentos
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);
create policy "colaborador vê os próprios agendamentos" on agendamentos
  for select using ((select auth.uid()) = colaborador_id);
create policy "colaborador atualiza os próprios agendamentos" on agendamentos
  for update using ((select auth.uid()) = colaborador_id) with check ((select auth.uid()) = colaborador_id);

create policy "profissional gerencia a própria config de cobrança" on configuracoes_cobranca
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);
create policy "qualquer um vê a config de cobrança" on configuracoes_cobranca
  for select using (true);

create policy "profissional gerencia a própria config de afiliados" on configuracoes_afiliados
  for all using ((select auth.uid()) = profissional_id) with check ((select auth.uid()) = profissional_id);

-- Vídeos de streaming: só os ativos ficam visíveis publicamente; quem
-- cadastra/edita é sempre o admin, via servidor (service role) — por
-- isso não existe política de insert/update aqui.
create policy "qualquer um vê conteúdo de streaming ativo" on conteudos_streaming
  for select using (ativo = true);

-- Planos: qualquer um vê os planos ativos (pra tela de "assine agora"),
-- mas só o servidor (admin) cria/edita
create policy "qualquer um vê planos ativos" on planos_assinatura
  for select using (ativo = true);

-- Assinaturas: o profissional vê a própria assinatura; criar/editar é
-- sempre via servidor (confirmação de pagamento)
create policy "profissional vê a própria assinatura" on assinaturas
  for select using ((select auth.uid()) = profissional_id);

-- clientes fica travada pra qualquer acesso direto, MAS o profissional
-- precisa conseguir ver o nome/telefone de quem agendou com ele. Essa
-- política libera isso só pra clientes que têm um agendamento de
-- verdade com aquele profissional — nunca a lista inteira de clientes.
create policy "profissional vê clientes dos próprios agendamentos" on clientes
  for select using (
    exists (
      select 1 from agendamentos
      where agendamentos.cliente_id = clientes.id
      and agendamentos.profissional_id = (select auth.uid())
    )
  );

-- View com a média de avaliação de cada estabelecimento — usada na
-- página inicial pra mostrar os mais bem avaliados, sem precisar
-- calcular isso na mão toda vez que alguém abre o site.
create view ranking_estabelecimentos as
select
  p.id as profissional_id,
  p.nome_negocio,
  p.slug,
  p.categoria,
  p.cidade,
  p.estado,
  coalesce(avg(a.nota), 0) as media,
  count(a.id) as quantidade,
  p.foto_url
from profissionais p
left join avaliacoes_estabelecimento a on a.profissional_id = p.id
group by p.id;

-- Faz a view respeitar o RLS de quem está consultando, em vez de rodar
-- com a permissão de quem criou ela (boa prática de segurança do
-- Postgres/Supabase — mesmo não tendo dado sensível aqui, evita
-- armadilha futura se alguém adicionar uma coluna sensível sem perceber)
alter view ranking_estabelecimentos set (security_invoker = true);

-- Fotos de perfil (profissional) e de serviço — ambas opcionais
alter table profissionais add column if not exists foto_url text;
alter table servicos add column if not exists foto_url text;

-- Bucket público de imagens (avatares e fotos de serviço) — qualquer
-- um pode VER um arquivo pelo link direto (o próprio bucket já é
-- "public", isso não depende de política nenhuma aqui), mas ninguém
-- de fora consegue LISTAR todos os arquivos, e só o servidor (chave
-- de serviço) consegue enviar arquivo novo.
insert into storage.buckets (id, name, public)
values ('publico', 'publico', true)
on conflict (id) do nothing;

-- Foto de perfil do colaborador — opcional, ele mesmo cadastra
alter table colaboradores add column if not exists foto_url text;

-- CPF/CNPJ fica vinculado ao telefone, junto com o nome (tarefa: nome
-- e documento fixos por telefone, pra evitar fraude de identidade)
alter table clientes add column if not exists cpf_cnpj text;

-- Permite o cliente "esconder" um item do próprio histórico sem apagar
-- o registro de verdade (o profissional e os relatórios continuam
-- intactos — só some da visão do cliente)
alter table agendamentos add column if not exists oculto_para_cliente boolean not null default false;

-- Liga/desliga funcionalidades inteiras do sistema, do jeito admin
alter table configuracoes_plataforma add column if not exists funcionalidade_cupons_ativa boolean not null default true;
alter table configuracoes_plataforma add column if not exists funcionalidade_afiliados_ativa boolean not null default true;
alter table configuracoes_plataforma add column if not exists funcionalidade_teste_gratis_ativa boolean not null default true;

-- Taxas que o ASAAS cobra da plataforma (não do cliente/profissional) —
-- usadas só pra calcular o lucro líquido real da plataforma nos
-- relatórios. Valores padrão são a tabela pública do Asaas; ajuste
-- aqui se você negociar uma taxa diferente com eles.
alter table configuracoes_plataforma add column if not exists taxa_asaas_pix_centavos int not null default 199;
alter table configuracoes_plataforma add column if not exists taxa_asaas_credito_percentual numeric(5,2) not null default 2.99;
alter table configuracoes_plataforma add column if not exists taxa_asaas_credito_centavos_fixos int not null default 49;
alter table configuracoes_plataforma add column if not exists taxa_asaas_debito_percentual numeric(5,2) not null default 1.89;



-- Perguntas frequentes da home — controladas 100% pelo admin
create table perguntas_frequentes (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Inscrições de notificação push do navegador — um cliente pode ter
-- mais de um aparelho inscrito (celular + computador, por exemplo).
create table inscricoes_push (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  endpoint text not null unique,
  chave_p256dh text not null,
  chave_auth text not null,
  criado_em timestamptz not null default now()
);
create index idx_inscricoes_push_cliente on inscricoes_push (cliente_id);
alter table inscricoes_push enable row level security; -- travada: só o servidor acessa (mesmo padrão de sessoes_clientes)

-- Dados de subconta Asaas do COLABORADOR — mesmo motivo do profissional:
-- precisa de walletId próprio pra receber a fatia dele automaticamente
-- no Split, sem precisar de repasse manual.
alter table colaboradores add column if not exists cpf_cnpj text;
alter table colaboradores add column if not exists data_nascimento date;
alter table colaboradores add column if not exists tipo_empresa text check (tipo_empresa in ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'));
alter table colaboradores add column if not exists telefone_contato text;
alter table colaboradores add column if not exists celular text;
alter table colaboradores add column if not exists renda_mensal numeric(12,2);
alter table colaboradores add column if not exists endereco text;
alter table colaboradores add column if not exists cep text;
alter table colaboradores add column if not exists numero_endereco text;
alter table colaboradores add column if not exists complemento_endereco text;
alter table colaboradores add column if not exists bairro text;
alter table colaboradores add column if not exists asaas_subconta_id text;
alter table colaboradores add column if not exists asaas_wallet_id text;
alter table colaboradores add column if not exists asaas_subconta_status text not null default 'nao_iniciado'
  check (asaas_subconta_status in ('nao_iniciado', 'pendente', 'aprovado', 'recusado'));

-- Guarda quanto ficou retido pra plataforma numa cobrança paga via
-- Split — calculado na hora da cobrança (valor - o que foi
-- distribuído pro profissional/colaborador), pro relatório de Ganhos
-- continuar certo mesmo pras cobranças que passam pelo Split.
alter table checkouts_pendentes add column if not exists comissao_split_centavos int;

-- Afiliado de revenda: um profissional indica OUTRO profissional novo
-- pra assinar o Booqly, e ganha uma comissão em dinheiro só na
-- PRIMEIRA assinatura paga dele (diferente do programa de indicação
-- de cliente, que é outra coisa).
alter table profissionais add column if not exists indicado_por_profissional_id uuid references profissionais(id);

create table comissoes_indicacao_profissional (
  id uuid primary key default gen_random_uuid(),
  profissional_indicador_id uuid not null references profissionais(id) on delete cascade,
  profissional_indicado_id uuid not null references profissionais(id) on delete cascade,
  assinatura_id uuid references assinaturas(id),
  valor_centavos int not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'usado')),
  pago_em timestamptz,
  criado_em timestamptz not null default now()
);
create index idx_comissoes_indicacao_indicador on comissoes_indicacao_profissional (profissional_indicador_id);

alter table configuracoes_plataforma add column if not exists valor_comissao_indicacao_profissional_centavos int not null default 0;
-- 0 = programa desligado; admin define um valor pra ativar

-- Guarda a divisão exata do split, pra calcular certinho o subsídio de
-- cupom depois (quanto cada um — profissional/colaborador — recebeu),
-- sem precisar recalcular tudo de novo no webhook.
alter table checkouts_pendentes add column if not exists split_profissional_centavos int;
alter table checkouts_pendentes add column if not exists split_colaborador_centavos int;

-- Registro do subsídio de cupom pago pela plataforma (transferência
-- separada, fora do Split, cobrindo o desconto que o cliente recebeu —
-- assim o profissional/colaborador recebem o valor cheio, como se não
-- tivesse cupom nenhum).
alter table cobrancas add column if not exists subsidio_cupom_centavos int;
alter table cobrancas add column if not exists subsidio_cupom_status text check (subsidio_cupom_status in ('pago', 'falhou'));

-- Lembrete de 1h antes via notificação push (diferente do lembrete de
-- 3h que já existe via WhatsApp — são horários e canais diferentes)
alter table agendamentos add column if not exists lembrete_1h_push_enviado boolean not null default false;

-- Inscrições de notificação push do PROFISSIONAL (mesma ideia da do
-- cliente, só que pro dono/colaborador ver aviso de novo agendamento
-- sem precisar de WhatsApp, que tem custo real por mensagem).
create table inscricoes_push_profissional (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  endpoint text not null unique,
  chave_p256dh text not null,
  chave_auth text not null,
  criado_em timestamptz not null default now()
);
create index idx_inscricoes_push_profissional on inscricoes_push_profissional (profissional_id);
alter table inscricoes_push_profissional enable row level security; -- travada: só o servidor acessa

-- NOVO MODELO DE PAGAMENTO: cada profissional traz a própria conta e
-- chave de API do Asaas OU Mercado Pago — o dinheiro do cliente cai
-- direto na conta DELE, nunca passa pela nossa. Substitui de vez o
-- modelo de subconta/Split.
alter table profissionais add column if not exists gateway_pagamento text check (gateway_pagamento in ('asaas', 'mercadopago'));
alter table profissionais add column if not exists chave_api_pagamento_criptografada text;
alter table profissionais add column if not exists gateway_ambiente text not null default 'sandbox' check (gateway_ambiente in ('sandbox', 'production'));
alter table profissionais add column if not exists gateway_status text not null default 'nao_configurado' check (gateway_status in ('nao_configurado', 'valido', 'invalido'));

-- Colaborador recebe a fatia dele por Pix normal (não é mais Split) —
-- volta a precisar de uma chave Pix, dessa vez só pra RECEBER repasse
-- comum, sem precisar de conta própria em gateway nenhum.
alter table colaboradores add column if not exists pix_chave text;
alter table colaboradores add column if not exists pix_chave_tipo text check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));

-- Guarda quanto seria a fatia do colaborador nesse agendamento
-- específico, calculada na hora da cobrança — usado pra saber quanto
-- repassar (e quanto subsidiar, se teve cupom) depois que confirma.
alter table checkouts_pendentes add column if not exists colaborador_valor_centavos int;

-- Limite de uso de um cupom POR ESTABELECIMENTO, separado do limite
-- geral (usos_maximos, que já existia e continua valendo pra
-- plataforma inteira). Null = sem limite por empresa.
alter table cupons add column if not exists usos_maximos_por_empresa int;

create table cupom_usos_por_profissional (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references cupons(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  usos_atuais int not null default 0,
  unique (cupom_id, profissional_id)
);

-- Chave Pix da PRÓPRIA plataforma — destino de qualquer valor que
-- precise ser recuperado do profissional (ex: subsídio de cupom
-- quando o agendamento é cancelado depois de já ter sido pago).
alter table configuracoes_plataforma add column if not exists pix_chave text;
alter table configuracoes_plataforma add column if not exists pix_chave_tipo text check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));

-- Rastreamento da recuperação do subsídio quando um agendamento com
-- cupom é cancelado depois de pago.
alter table cobrancas add column if not exists subsidio_recuperacao_status text
  check (subsidio_recuperacao_status in ('recuperado', 'falhou', 'colaborador_pendente'));
alter table cobrancas add column if not exists subsidio_recuperado_centavos int;

-- Recuperação de subsídio de cupom quando o cliente cancela DEPOIS do
-- pagamento já ter confirmado (e o subsídio já ter sido pago).
alter table cobrancas add column if not exists subsidio_recuperacao_status text
  check (subsidio_recuperacao_status in ('recuperado', 'falhou', 'colaborador_pendente'));
alter table cobrancas add column if not exists subsidio_recuperado_centavos int;

-- Chave Pix PRÓPRIA da plataforma, usada como destino quando
-- recuperamos um subsídio de cupom da conta do profissional.
alter table configuracoes_plataforma add column if not exists pix_chave text;
alter table configuracoes_plataforma add column if not exists pix_chave_tipo text
  check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));

-- Quantas horas antes do horário marcado ainda é permitido remarcar —
-- configurável pelo admin, em vez de fixo no código. Vale tanto pro
-- cliente quanto pro profissional.
alter table configuracoes_plataforma add column if not exists limite_horas_remarcar int not null default 2;

-- Liga/desliga a busca de novos estabelecimentos DENTRO da área do
-- cliente logado (a busca da home continua sempre ligada — essa é só
-- a versão extra, acessível sem precisar sair da conta).
alter table configuracoes_plataforma add column if not exists funcionalidade_busca_cliente_ativa boolean not null default true;

-- Essas 3 tabelas ficaram sem RLS habilitado por descuido — travadas
-- (sem política nenhuma) pra só o servidor (chave de serviço) acessar,
-- mesmo padrão de sessoes_clientes e outras tabelas sensíveis.
alter table comissoes_indicacao_profissional enable row level security;
alter table cupom_usos_por_profissional enable row level security;
alter table perguntas_frequentes enable row level security;

-- Status do repasse pro COLABORADOR (separado do repasse_status, que já
-- existia e representa o dinheiro do CLIENTE chegando no profissional).
alter table cobrancas add column if not exists repasse_colaborador_status text
  check (repasse_colaborador_status in ('nao_aplicavel', 'pago', 'falhou'));

-- Rastreia o último login do profissional, pra identificar contas
-- inativas há muito tempo (e permitir ao admin excluir, evitando
-- poluição de dados mortos no banco).
alter table profissionais add column if not exists ultimo_acesso timestamptz;

-- Prazo padrão (em dias) sugerido pro admin ao listar inativos —
-- só um valor de referência pra tela, não trava exclusão nenhuma sozinho.
alter table configuracoes_plataforma add column if not exists dias_inatividade_sugerido int not null default 180;

-- Cupom pode ser da PLATAFORMA (profissional_id nulo — admin cria,
-- vale em qualquer estabelecimento, plataforma banca o desconto) ou
-- do PRÓPRIO PROFISSIONAL (só vale no estabelecimento dele, e o
-- desconto sai do bolso dele mesmo — sem subsídio nenhum da plataforma).
alter table cupons add column if not exists profissional_id uuid references profissionais(id) on delete cascade;

-- Indique e ganhe EM DINHEIRO pro cliente — separado do sistema de
-- pontos que já existia. Cliente indica um PROFISSIONAL novo pra
-- assinar (não um amigo cliente) — ganha comissão fixa na primeira
-- assinatura paga dele, igual à indicação entre profissionais. O saldo
-- pode ser usado como desconto num agendamento; o SAQUE em dinheiro é
-- pago manualmente pelo admin (mesmo fluxo da indicação profissional).
alter table configuracoes_plataforma add column if not exists valor_comissao_indicacao_cliente_centavos int not null default 0;

-- Cliente indica um PROFISSIONAL novo (não um amigo) — mesmo modelo da
-- indicação entre profissionais, só que quem indica é um cliente.
create table comissoes_indicacao_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_indicador_id uuid not null references clientes(id) on delete cascade,
  profissional_indicado_id uuid not null references profissionais(id) on delete cascade,
  assinatura_id uuid references assinaturas(id),
  valor_centavos int not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'usado')),
  pago_em timestamptz,
  criado_em timestamptz not null default now()
);
create index idx_comissoes_indicacao_cliente_indicador on comissoes_indicacao_cliente (cliente_indicador_id);
alter table comissoes_indicacao_cliente enable row level security;

-- Guarda qual cliente indicou esse profissional pra assinar — usado pra
-- creditar a comissão na primeira assinatura paga dele.
alter table profissionais add column if not exists indicado_por_cliente_id uuid references clientes(id);

-- Guarda quanto do desconto veio de SALDO de indicação (separado do
-- desconto_centavos, que é só cupom) — precisa saber pra subsidiar
-- certinho na conclusão, já que saldo é sempre bancado pela plataforma.
alter table checkouts_pendentes add column if not exists desconto_saldo_centavos int;

-- Categorias de serviço viram uma tabela gerenciável pelo admin, em vez
-- de lista fixa no código. "sinonimos" alimenta a busca inteligente
-- (a pessoa digita "barbeiro" e o sistema reconhece como "barbearia").
create table categorias_servico (
  valor text primary key,
  rotulo text not null,
  sinonimos text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table categorias_servico enable row level security;

insert into categorias_servico (valor, rotulo, sinonimos) values
  ('barbearia', 'Barbearia', array['barbeiro', 'corte', 'barba']),
  ('salao', 'Salão de beleza', array['cabelo', 'salão']),
  ('manicure', 'Manicure', array['unha', 'pedicure']),
  ('cabeleireiro', 'Cabeleireiro', array['cabelo', 'corte']),
  ('esteticista', 'Esteticista', array['limpeza de pele', 'estética']),
  ('depilacao', 'Depilação', array['cera', 'depilação']),
  ('sobrancelha', 'Design de sobrancelha', array['sobrancelha', 'micropigmentação']),
  ('massoterapia', 'Massoterapia', array['massagem', 'massoterapeuta']),
  ('tatuagem', 'Tatuagem e piercing', array['tatuador', 'piercing']),
  ('personal_trainer', 'Personal trainer', array['personal', 'academia', 'treino']),
  ('nutricionista', 'Nutricionista', array['nutrição', 'dieta']),
  ('psicologo', 'Psicólogo/terapeuta', array['psicologia', 'terapia']),
  ('fisioterapeuta', 'Fisioterapeuta', array['fisioterapia']),
  ('fonoaudiologo', 'Fonoaudiólogo', array['fono']),
  ('pilates_yoga', 'Pilates/Yoga', array['pilates', 'yoga']),
  ('odontologia', 'Consultório odontológico', array['dentista', 'odonto']),
  ('veterinario', 'Veterinário/Banho e tosa', array['veterinária', 'pet', 'banho e tosa']),
  ('consultoria', 'Consultoria', array['consultor', 'advogado', 'contador']),
  ('aula_particular', 'Aula particular', array['professor', 'aula', 'reforço']),
  ('fotografo', 'Fotógrafo', array['fotografia', 'ensaio']),
  ('estetica_automotiva', 'Estética automotiva', array['lavagem de carro', 'estética automotiva']),
  ('outro', 'Outro', array['outro'])
on conflict (valor) do nothing;

-- Troca a lista fixa (CHECK) por uma referência de verdade na tabela
-- nova — assim o admin consegue adicionar categoria sem mexer em código.
alter table profissionais drop constraint if exists profissionais_categoria_check;
alter table profissionais add constraint profissionais_categoria_fkey
  foreign key (categoria) references categorias_servico(valor);

-- SISTEMA UNIFICADO DE SAQUE — vale pra indicação de profissional, de
-- cliente, e a nova de colaborador. Fluxo: usuário pede o saque (com a
-- própria chave Pix), fica "solicitado" até o prazo definido pelo admin
-- passar, e um cron paga automaticamente depois disso.
alter table configuracoes_plataforma add column if not exists prazo_saque_dias int not null default 3;

create table solicitacoes_saque (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('profissional', 'cliente', 'colaborador')),
  beneficiario_id uuid not null,
  valor_centavos int not null,
  pix_chave text not null,
  pix_chave_tipo text not null check (pix_chave_tipo in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  solicitado_em timestamptz not null default now(),
  pago_em timestamptz
);
create index idx_solicitacoes_saque_pendentes on solicitacoes_saque (status, solicitado_em);
alter table solicitacoes_saque enable row level security;

-- As comissões existentes ganham um status novo ("solicitado") e um
-- vínculo com o pedido de saque, pra saber quais ficam "pagas" quando
-- o cron processar aquele pedido específico.
alter table comissoes_indicacao_profissional drop constraint if exists comissoes_indicacao_profissional_status_check;
alter table comissoes_indicacao_profissional add constraint comissoes_indicacao_profissional_status_check
  check (status in ('pendente', 'solicitado', 'pago', 'usado'));
alter table comissoes_indicacao_profissional add column if not exists solicitacao_saque_id uuid references solicitacoes_saque(id);

alter table comissoes_indicacao_cliente drop constraint if exists comissoes_indicacao_cliente_status_check;
alter table comissoes_indicacao_cliente add constraint comissoes_indicacao_cliente_status_check
  check (status in ('pendente', 'solicitado', 'pago', 'usado'));
alter table comissoes_indicacao_cliente add column if not exists solicitacao_saque_id uuid references solicitacoes_saque(id);

-- NOVO: colaborador também pode indicar um profissional novo pra
-- assinar — mesmo modelo de profissional e cliente.
alter table profissionais add column if not exists indicado_por_colaborador_id uuid references colaboradores(id);
alter table configuracoes_plataforma add column if not exists valor_comissao_indicacao_colaborador_centavos int not null default 0;

create table comissoes_indicacao_colaborador (
  id uuid primary key default gen_random_uuid(),
  colaborador_indicador_id uuid not null references colaboradores(id) on delete cascade,
  profissional_indicado_id uuid not null references profissionais(id) on delete cascade,
  assinatura_id uuid references assinaturas(id),
  valor_centavos int not null,
  status text not null default 'pendente' check (status in ('pendente', 'solicitado', 'pago')),
  solicitacao_saque_id uuid references solicitacoes_saque(id),
  criado_em timestamptz not null default now()
);
create index idx_comissoes_indicacao_colaborador_indicador on comissoes_indicacao_colaborador (colaborador_indicador_id);
alter table comissoes_indicacao_colaborador enable row level security;

-- Trava de verdade contra reserva dupla, no nível do banco (não só na
-- aplicação) — impossível dois agendamentos com o mesmo profissional
-- (e colaborador, quando tiver) terem horários que se sobrepõem, mesmo
-- que duas requisições cheguem exatamente ao mesmo tempo.
create extension if not exists btree_gist;

alter table agendamentos add constraint agendamentos_sem_sobreposicao
  exclude using gist (
    profissional_id with =,
    coalesce(colaborador_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    tsrange(inicio, fim) with &&
  )
  where (status <> 'cancelado');

-- Bloqueio de cliente por estabelecimento — profissional OU colaborador
-- podem bloquear (vale pro estabelecimento inteiro, não só pra quem
-- bloqueou). Cliente bloqueado não consegue mais agendar ali.
create table clientes_bloqueados (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  bloqueado_em timestamptz not null default now(),
  unique (profissional_id, cliente_id)
);
alter table clientes_bloqueados enable row level security;

-- Lembrete AUTOMÁTICO pra clientes sumidos — diferente do manual (que
-- já existia): o profissional configura uma vez (dias sem visita +
-- mensagem opcional) e o sistema dispara sozinho, via cron, sempre que
-- um cliente cruzar esse limite. Exclusivo do Premium, igual o manual.
create table configuracoes_lembrete_automatico (
  profissional_id uuid primary key references profissionais(id) on delete cascade,
  ativo boolean not null default false,
  dias_sem_visita int not null default 60,
  mensagem text,
  atualizado_em timestamptz not null default now()
);
alter table configuracoes_lembrete_automatico enable row level security;

-- Registra quem já recebeu o lembrete automático, pra não mandar todo
-- dia pra sempre — só manda de novo depois que o cliente visitar de
-- novo e ficar sumido outra vez.
create table lembretes_automaticos_enviados (
  profissional_id uuid not null references profissionais(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  enviado_em timestamptz not null default now(),
  primary key (profissional_id, cliente_id)
);
alter table lembretes_automaticos_enviados enable row level security;

-- Rastreia pedidos de troca de plano (upgrade) — criado porque o
-- Asaas limita "externalReference" a 100 caracteres, e não cabem 3
-- UUIDs juntos ali. Guarda os dados aqui, e usa só o ID desse
-- registro (um UUID só) na referência da cobrança.
create table trocas_de_plano_pendentes (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  assinatura_id uuid not null references assinaturas(id) on delete cascade,
  novo_plano_id uuid not null references planos_assinatura(id),
  criado_em timestamptz not null default now()
);
alter table trocas_de_plano_pendentes enable row level security;

-- Rastreia a última vez que o profissional trocou pra um plano MAIS
-- BARATO — limitado a 1x por mês, pra evitar ficar trocando pra cima e
-- pra baixo repetidamente só pra aproveitar o crédito proporcional.
alter table profissionais add column if not exists ultimo_downgrade_em timestamptz;

-- Horário de almoço do colaborador — durante esse intervalo, ele não
-- aparece disponível pra agendamento (mas o estabelecimento como um
-- todo pode continuar aberto, se outro colaborador estiver livre).
alter table colaboradores add column if not exists almoco_inicio time;
alter table colaboradores add column if not exists almoco_fim time;

-- Instagram do PRÓPRIO profissional (diferente do rodape_instagram, que
-- é da plataforma inteira) — aparece na página pública dele.
alter table profissionais add column if not exists instagram text;

-- Vídeo tutorial (YouTube) de como o profissional cadastra no Asaas e
-- pega a chave de API — configurado pelo admin, aparece pro profissional
-- em Painel → Receber pagamentos.
alter table configuracoes_plataforma add column if not exists tutorial_asaas_video_url text;

-- Até 3 vídeos tutoriais (título + link do YouTube cada), configurados
-- pelo admin — substitui o campo único tutorial_asaas_video_url.
alter table configuracoes_plataforma add column if not exists tutorial_video1_titulo text;
alter table configuracoes_plataforma add column if not exists tutorial_video1_url text;
alter table configuracoes_plataforma add column if not exists tutorial_video2_titulo text;
alter table configuracoes_plataforma add column if not exists tutorial_video2_url text;
alter table configuracoes_plataforma add column if not exists tutorial_video3_titulo text;
alter table configuracoes_plataforma add column if not exists tutorial_video3_url text;

-- Nome da plataforma — usado em todo lugar que hoje mostra "Booqly"
-- fixo no texto (logo, rodapé, termos, notificações). Editável pelo
-- admin, pra quando o nome definitivo do projeto for decidido.
alter table configuracoes_plataforma add column if not exists nome_plataforma text not null default 'Booqly';

-- Nome da plataforma, configurável pelo admin — hoje "Booqly" é só o
-- valor padrão, não fixo no código. Usado em toda parte visível ao
-- usuário: logo, e-mails, PDFs, descrição de cobranças, textos legais.
alter table configuracoes_plataforma add column if not exists nome_plataforma text not null default 'Booqly';

-- Vídeos tutoriais (YouTube) configurados pelo admin — sem limite de
-- quantidade, substitui os 3 campos fixos de antes. Aparecem pro
-- profissional em Painel → Passo a passo, na ordem definida aqui.
create table tutoriais_video (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  url text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table tutoriais_video enable row level security;

-- Cache de geocodificação (cidade/estado → latitude/longitude) — evita
-- chamar o serviço de geocodificação toda vez que o admin abre o mapa
-- de profissionais. Preenchido sob demanda, nunca com coordenada
-- inventada — sempre vem de uma busca real.
create table cidades_geocodificadas (
  cidade text not null,
  estado text not null,
  latitude double precision,
  longitude double precision,
  atualizado_em timestamptz not null default now(),
  primary key (cidade, estado)
);
alter table cidades_geocodificadas enable row level security;

-- Verificação de telefone do cliente por WhatsApp — o CLIENTE manda
-- uma mensagem pra gente (sempre grátis, é conversa iniciada por ele),
-- com um código; nosso webhook confirma e libera o login. Só pedida de
-- novo se o cliente clicar em Sair (a sessão normal já dura até isso
-- acontecer).
create table verificacoes_whatsapp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  telefone text not null,
  codigo text not null,
  nome text, -- só usado se for cadastro novo (telefone nunca visto antes)
  verificado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index idx_verificacoes_whatsapp_telefone_codigo on verificacoes_whatsapp (telefone, codigo);
create index idx_verificacoes_whatsapp_user_telefone on verificacoes_whatsapp (user_id, telefone, criado_em desc);
alter table verificacoes_whatsapp enable row level security;

-- (fim do arquivo de verificação de WhatsApp — a tabela verificacoes_whatsapp
-- já foi definida acima, uma vez só, pro fluxo de login do cliente)

-- Loja de produtos — exclusiva do plano Premium. Só retirada no local,
-- sem frete: o cliente paga antecipado (mesmo fluxo de pagamento que já
-- existe pra serviço) e passa pra pegar quando quiser.
create table produtos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  nome text not null,
  preco_centavos int not null,
  foto_url text,
  estoque int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table produtos enable row level security;

create table pedidos_produtos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null, -- se o produto for excluído depois, o pedido continua existindo (o nome já foi salvo abaixo)
  produto_nome text not null, -- cópia do nome no momento da compra (se o produto mudar de nome depois, o pedido antigo mantém o nome de quando foi comprado)
  quantidade int not null check (quantidade > 0),
  valor_unitario_centavos int not null,
  valor_total_centavos int not null,
  forma_pagamento text not null check (forma_pagamento in ('pix', 'credito', 'debito')),
  cobranca_id_externo text,
  status text not null default 'pendente' check (status in ('pendente', 'pago_aguardando_retirada', 'retirado', 'expirado', 'falhou')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);
alter table pedidos_produtos enable row level security;

-- Story permanente do estabelecimento (até 3 fotos, tipo destaque do
-- Instagram) — aparece como um anel colorido na foto de perfil, na
-- página pública de agendamento.
create table stories_estabelecimento (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  foto_url text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table stories_estabelecimento enable row level security;

alter table configuracoes_plataforma add column if not exists gateway_asaas_ativo boolean not null default true;
alter table configuracoes_plataforma add column if not exists gateway_mercadopago_ativo boolean not null default true;

-- Comunidade por categoria — cada profissional só vê/participa da
-- comunidade da própria categoria (barbeiro só vê barbeiro). Cada
-- categoria libera sozinha quando bate o número mínimo de assinantes
-- pagos ATIVOS naquela categoria (configurável, ver
-- configuracoes_plataforma.comunidade_minimo_assinantes) — sem
-- precisar de uma tabela de "desbloqueio", é sempre calculado na hora.
alter table configuracoes_plataforma add column if not exists comunidade_minimo_assinantes int not null default 50;

create table comunidade_posts (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  categoria text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);
alter table comunidade_posts enable row level security;
create index idx_comunidade_posts_categoria on comunidade_posts (categoria, criado_em desc);

create table comunidade_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references comunidade_posts(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);
alter table comunidade_comentarios enable row level security;

create table comunidade_curtidas (
  post_id uuid not null references comunidade_posts(id) on delete cascade,
  profissional_id uuid not null references profissionais(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, profissional_id)
);
alter table comunidade_curtidas enable row level security;

create table comunidade_denuncias (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references comunidade_posts(id) on delete cascade,
  comentario_id uuid references comunidade_comentarios(id) on delete cascade,
  denunciado_por uuid not null references profissionais(id) on delete cascade,
  motivo text,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint denuncia_tem_um_alvo check ((post_id is not null) <> (comentario_id is not null))
);
alter table comunidade_denuncias enable row level security;


-- Reserva/desconto atômico de estoque para compras confirmadas.
-- O UPDATE só acontece se ainda houver unidades suficientes, evitando
-- que duas compras simultâneas deixem o estoque negativo ou vendam além
-- do disponível.
create or replace function decrementar_estoque_produto(p_produto_id uuid, p_quantidade int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  atualizado boolean;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    return false;
  end if;

  update produtos
     set estoque = estoque - p_quantidade
   where id = p_produto_id
     and ativo = true
     and estoque >= p_quantidade;

  atualizado := found;
  return atualizado;
end;
$$;

revoke all on function decrementar_estoque_produto(uuid, int) from public;
grant execute on function decrementar_estoque_produto(uuid, int) to service_role;

-- Recursos da página pública /recursos — controlados 100% pelo admin.
-- O campo {{nome}} pode ser usado no título/descrição e é substituído
-- automaticamente pelo nome atual da plataforma na página pública.
create table if not exists recursos_site (
  id uuid primary key default gen_random_uuid(),
  titulo text not null unique,
  texto text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists idx_recursos_site_ordem on recursos_site (ordem, criado_em);
alter table recursos_site enable row level security;
