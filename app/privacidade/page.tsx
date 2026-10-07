import { obterNomePlataforma } from "@/lib/nome-plataforma";
export default async function PrivacidadePage() {
  const nome = await obterNomePlataforma();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-bold">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-ink/50">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/80">
        <section>
          <h2 className="font-medium text-ink">1. Quais dados coletamos</h2>
          <p className="mt-1">
            <strong>Do profissional:</strong> nome, e-mail, endereço, categoria do negócio,
            CPF/CNPJ (quando necessário para assinatura ou pagamento) e, se ele optar por receber
            pagamentos online, a chave de API da própria conta de pagamento (Asaas ou Mercado
            Pago) — guardada de forma criptografada.
          </p>
          <p className="mt-1">
            <strong>Do colaborador:</strong> nome, foto (opcional) e chave Pix, usada apenas para
            o repasse automático da comissão.
          </p>
          <p className="mt-1">
            <strong>Do cliente:</strong> nome e telefone, usados para identificação e login na
            área do cliente, e CPF, quando exigido pela instituição de pagamento para processar
            Pix ou cartão.
          </p>
          <p className="mt-1">
            Também podemos coletar dados técnicos de notificação, quando você ativa notificações
            no navegador.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">2. Como usamos esses dados</h2>
          <p className="mt-1">
            Os dados são usados exclusivamente para viabilizar o agendamento, o pagamento dos
            serviços, a comunicação entre cliente e profissional, e o funcionamento dos programas
            de indicação e notificação. Não vendemos dados pessoais a terceiros.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">3. Compartilhamento com terceiros</h2>
          <p className="mt-1">
            <strong>Pagamento do cliente ao profissional:</strong> processado diretamente pela
            instituição de pagamento escolhida pelo profissional (Asaas ou Mercado Pago) — o
            {nome} nunca recebe esses dados de pagamento (número de cartão, por exemplo), só a
            confirmação de que o pagamento ocorreu.
          </p>
          <p className="mt-1">
            <strong>Assinatura da plataforma e subsídio de cupom:</strong> processados pela conta
            Asaas do próprio {nome}.
          </p>
          <p className="mt-1">
            <strong>Notificações:</strong> processadas pelo próprio navegador do usuário (Web
            Push), sem compartilhamento com um serviço externo de terceiros além do necessário
            para a entrega técnica da notificação.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">4. Segurança</h2>
          <p className="mt-1">
            Utilizamos controles de acesso a nível de banco de dados (Row Level Security) para
            garantir que cada usuário só acesse seus próprios dados. Senhas nunca são armazenadas
            em texto simples. Chaves de API de pagamento são armazenadas com criptografia
            (AES-256), e nunca ficam visíveis, nem para nossa própria equipe, depois de salvas.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">5. Cookies e sessão</h2>
          <p className="mt-1">
            Usamos cookies estritamente necessários para manter sua sessão de login ativa
            (cliente, profissional ou colaborador). Não usamos cookies de rastreamento
            publicitário.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">6. Seus direitos</h2>
          <p className="mt-1">
            Você pode solicitar a correção ou exclusão dos seus dados a qualquer momento, entrando
            em contato com o suporte da plataforma, conforme previsto na Lei Geral de Proteção de
            Dados (LGPD).
          </p>
        </section>
      </div>
    </main>
  );
}
