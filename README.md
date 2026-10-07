# Booqly — código inicial (Fase 1)

O que já está pronto nesta versão:
- Landing page com um único botão "Criar conta" (busca de estabelecimento fica discreta no menu)
- Cadastro em um passo (dados da empresa → confirmação por e-mail), sem login com Google
- Login por "nome da empresa" (dono) ou "inicial.nome" (colaborador) — não por e-mail
- Bloqueio automático de acesso ao painel quando o teste grátis (ou assinatura) vence,
  redirecionando pra tela de assinatura com os planos cadastrados
- Painel de colaboradores: o dono cadastra colaboradores, cada um com login e dashboard próprios
- Admin: planos de assinatura (nome, duração, valor) e duração do teste grátis — tudo pelo painel
- Landing page com dois caminhos: "sou profissional" (cadastro) e "sou cliente" (busca)
- Login e cadastro (email/senha + Google) — via Supabase Auth, já capturando cidade/estado/categoria
- Página pública do profissional na raiz do domínio: booqly.com.br/nome-do-estabelecimento
- Busca de estabelecimentos por cidade + categoria: booqly.com.br/buscar
- Estrutura do painel do profissional (Visão geral, Agenda, Serviços, Configurações)
- Configuração das 3 formas de pagamento (taxa de agendamento, pagamento total, pós-serviço)
- Sistema de temas (verde / preto / branco)
- Banco de dados completo (`supabase/schema.sql`) já com as tabelas de afiliados e streaming
  prontas para as próximas fases
- Adaptador de pagamento pronto pra trocar entre Asaas e Mercado Pago (`lib/payments`)

O que ainda NÃO está funcional nesta versão (vem nas próximas fases):
- Cobrança de verdade (o código já sabe *como* cobrar, mas ainda não está ligado às telas)
- Sistema de afiliados calculando pontos automaticamente
- Área de streaming
- Assistente Kivra no WhatsApp

## Nota de versão
Este projeto usa Next.js 16 (a versão 14 saiu de suporte de segurança em outubro/2025,
e a 15 tinha 3 vulnerabilidades altas em bibliotecas internas sem correção fora da v16).
Next.js 16 exige **Node.js 20.9 ou mais novo** — confira com `node --version` no terminal;
se estiver mais antigo, baixe a versão LTS atual em nodejs.org.
Se você já rodou `npm install` numa cópia anterior, apague `node_modules` e
`package-lock.json` antes de instalar de novo, pra não ficar mistura de versão.

## Configuração adicional necessária (além do Supabase e do Asaas)

### Confirmação de e-mail (Supabase)
No painel do Supabase: **Authentication -> Providers -> Email** e confirme que
"Confirm email" está ativado. O template do e-mail pode ser personalizado em
**Authentication -> Email Templates -> Confirm signup**.

### Marcar seu primeiro usuário como admin
Depois de criar sua própria conta pelo cadastro normal, vá no Supabase, em
**Table Editor -> profissionais**, ache sua linha e mude `is_admin` para `true`.
Isso libera o acesso a `/admin` pra você.

## Como rodar na sua máquina

### 1. Instale as dependências
Abra esta pasta no terminal (ou no VS Code, menu Terminal → New Terminal) e rode:

```
npm install
```

### 2. Configure o Supabase
1. Copie o arquivo `.env.example` e renomeie a cópia para `.env.local`
2. No painel do Supabase, vá em **Settings → API**
3. Cole a "Project URL" em `NEXT_PUBLIC_SUPABASE_URL`
4. Cole a "anon public key" em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Cole a "service_role key" em `SUPABASE_SERVICE_ROLE_KEY`
6. No Supabase, vá em **SQL Editor → New query**, cole todo o conteúdo do arquivo
   `supabase/schema.sql` deste projeto e clique em Run — isso cria todas as tabelas

### 3. Ative o login com Google (opcional, pode pular por enquanto)
No Supabase: **Authentication → Providers → Google** e siga as instruções da própria
tela (pede um Client ID/Secret do Google Cloud Console).

### 4. Configure o Asaas
1. No `.env.local`, cole sua chave de API sandbox em `ASAAS_API_KEY`
2. Deixe `ASAAS_ENV=sandbox` por enquanto (assim nenhum pagamento real é feito)

### 5. Rode o projeto
```
npm run dev
```
Abra **http://localhost:3000** no navegador.

## Como funciona a troca de gateway (Asaas → Mercado Pago no futuro)
Toda a lógica de pagamento passa por `lib/payments/adapter.ts`. Quando você quiser
trocar, é só mudar o valor `gateway_pagamento_ativo` na tabela `configuracoes_plataforma`
do Supabase (de `'asaas'` para `'mercadopago'`) — o resto do sistema continua funcionando
sem nenhuma outra alteração. Na Fase 2 colocamos um botão pra isso direto no painel admin.

## Sobre o antifraude do teste grátis
Por decisão sua, o cadastro ficou só com e-mail/senha, sem trava de telefone/CNPJ. Isso
significa que alguém pode criar contas novas com e-mails diferentes pra sempre ganhar
teste grátis de novo. Se isso virar problema na prática, dá pra reforçar depois — por
exemplo, exigindo CNPJ/CPF único, ou verificação de telefone.

## Segurança (importante, principalmente por causa do pagamento)

**Regra de ouro do projeto: o navegador do cliente nunca escreve direto no banco de
dados quando envolve dinheiro ou dados de outra pessoa.** Toda ação sensível passa por
uma rota do servidor (arquivos em `app/api/.../route.ts`), que:

1. **Valida os dados de verdade no servidor** — com a biblioteca `zod`. Mesmo que
   alguém tente mandar uma requisição fake direto pra API (sem passar pelo site), ela
   é rejeitada se os dados não baterem com o formato esperado.
2. **Nunca confia em preço/duração vindos do navegador** — a rota de agendamento
   (`app/api/agendamentos/route.ts`) sempre busca o preço real do serviço no banco,
   ignorando qualquer valor que venha da requisição. Isso evita alguém manipular o
   preço no próprio navegador antes de enviar.
3. **Usa duas chaves do Supabase com poderes diferentes**:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave pública, pode ir no navegador, mas só
     acessa o que as regras de RLS (Row Level Security) do banco permitem.
   - `SUPABASE_SERVICE_ROLE_KEY` — chave mestra, ignora todas as regras. Só existe
     em `lib/supabase/admin.ts`, e esse arquivo **só pode ser usado dentro de rotas do
     servidor**. Se essa chave vazasse pro navegador, qualquer pessoa leria/apagaria
     o banco inteiro — por isso ela nunca leva o prefixo `NEXT_PUBLIC_`.
4. **Tabelas de cliente, cobrança e pontos de afiliado ficam travadas por padrão**
   (RLS ativado, sem nenhuma política pra chave pública) — só o servidor consegue
   tocar nelas. Isso já corrige uma falha que existia numa versão anterior do schema,
   em que essas tabelas ficavam sem trava nenhuma.
5. **O webhook do Asaas verifica um token antes de processar qualquer coisa**
   (`app/api/webhooks/asaas/route.ts`). Sem esse token — que você mesmo cria e cola
   no painel do Asaas — a requisição é rejeitada. Isso impede alguém forjar um
   "pagamento confirmado" falso.
6. **O Booqly nunca vê número de cartão de crédito.** O Pix e o cartão são
   processados na página/checkout hospedado do próprio Asaas — o Booqly só recebe
   "pago" ou "não pago". Isso tira o projeto do escopo de PCI-DSS (a certificação
   pesada que quem manipula número de cartão precisaria ter).

O que falta configurar quando for pro ar de verdade (não afeta o teste local):
- HTTPS obrigatório (a Vercel já entrega isso de graça, sem configuração)
- Rate limiting nas rotas de API (limitar quantas requisições por IP/minuto — evita
  abuso; dá pra usar o Vercel Firewall ou a biblioteca Upstash Ratelimit)
- Backup automático do banco (o Supabase já oferece isso nos planos pagos)

## Dúvidas ao testar
Volte na nossa conversa e me diga o que aconteceu (print de erro ajuda bastante) que eu
te ajudo a resolver.
