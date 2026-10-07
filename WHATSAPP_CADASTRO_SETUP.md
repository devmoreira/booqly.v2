# Configuração do código de confirmação do WhatsApp no cadastro

O cadastro agora funciona assim:

1. O usuário preenche os dados e cria a conta no Supabase.
2. O Booqly gera um código AGD de 6 dígitos.
3. O backend envia esse código pela WhatsApp Cloud API usando um template de autenticação da Meta.
4. A tela pede o código recebido.
5. O backend só cria o perfil em `profissionais` depois que o código válido, dentro de 10 minutos, estiver confirmado.
6. O webhook continua aceitando `AGD-123456`, `AGD 123456`, `AGD123456` e `AGD:123456` caso o cliente responda o código pelo próprio WhatsApp.

## 1. Criar o template na Meta

No Gerenciador do WhatsApp, crie um template de categoria **Authentication / Autenticação**.

Sugestão de nome:

`booqly_codigo_verificacao`

Configuração:

- Idioma: `Português (Brasil)` (`pt_BR`)
- Categoria: `AUTHENTICATION`
- Botão OTP: `COPY_CODE`
- Expiração: 10 minutos

A Meta exige que templates de autenticação tenham um botão OTP. O envio pela Cloud API usa o código no corpo e também no componente do botão.

## 2. Variáveis do `.env.local`

Além das variáveis que o Booqly já usa para o webhook, configure:

```dotenv
WHATSAPP_PHONE_NUMBER_ID=1238310332708320
WHATSAPP_ACCESS_TOKEN=COLOQUE_SEU_TOKEN_AQUI
WHATSAPP_CODIGO_TEMPLATE=booqly_codigo_verificacao
WHATSAPP_CODIGO_TEMPLATE_LANGUAGE=pt_BR
```

Não coloque o token no GitHub, ZIP ou código-fonte.

## 3. Banco de dados

Aplique esta migration no Supabase:

`supabase/migrations/20260925_verificacao_whatsapp_cadastro.sql`

Ela adiciona `user_id` à tabela `verificacoes_whatsapp` para impedir que um código válido de um telefone seja usado para finalizar o cadastro de outro usuário.

## 4. Teste

Depois de configurar a Meta e o `.env.local`:

- abra `/cadastro`;
- informe um número de WhatsApp real;
- clique em `Criar conta`;
- o Booqly deve mostrar `Confirme seu WhatsApp`;
- o código deve chegar no WhatsApp;
- informe os 6 dígitos na tela;
- o cadastro deve mostrar `Cadastro confirmado!`.

Se a Meta rejeitar o template, o terminal mostrará apenas o status e a mensagem de erro da Meta, sem imprimir o token de acesso.
