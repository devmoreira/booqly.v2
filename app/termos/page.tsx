import { obterNomePlataforma } from "@/lib/nome-plataforma";
export default async function TermosPage() {
  const nome = await obterNomePlataforma();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-bold">Termos de Uso</h1>
      <p className="mt-1 text-sm text-ink/50">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/80">
        <section>
          <h2 className="font-medium text-ink">1. O que é o {nome}</h2>
          <p className="mt-1">
            O {nome} é uma plataforma de agendamento online que conecta profissionais autônomos
            e estabelecimentos (barbearias, salões, manicures e similares) a seus clientes. O
            {nome} atua exclusivamente como plataforma tecnológica de intermediação — não presta
            os serviços anunciados pelos profissionais nem se responsabiliza pela qualidade deles.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">2. Cadastro</h2>
          <p className="mt-1">
            O profissional é responsável pela veracidade das informações fornecidas no cadastro,
            incluindo dados de contato, CPF/CNPJ e informações usadas para recebimento de
            pagamentos.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">3. Pagamentos</h2>
          <p className="mt-1">
            Cada profissional conecta sua própria conta em uma instituição de pagamento de sua
            escolha (Asaas ou Mercado Pago) para receber diretamente os valores pagos por seus
            clientes. <strong>O {nome} não recebe, retém ou processa esses valores em nenhum
            momento</strong> — o dinheiro é transferido diretamente da instituição de pagamento
            para a conta do profissional, sem intermediação financeira do {nome}.
          </p>
          <p className="mt-2">
            O {nome} não se responsabiliza por atrasos, falhas, tarifas ou qualquer problema
            decorrente da instituição de pagamento escolhida pelo profissional. Cabe ao
            profissional configurar corretamente sua própria conta e manter suas credenciais de
            acesso em segurança.
          </p>
          <p className="mt-2">
            Quando há colaboradores vinculados a um atendimento, o repasse da comissão devida a
            eles é feito automaticamente por transferência Pix, a partir da própria conta do
            profissional, imediatamente após a confirmação do pagamento do cliente.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">4. Cupons de desconto</h2>
          <p className="mt-1">
            Quando o {nome} disponibiliza um cupom de desconto para clientes finais, o valor do
            desconto é assumido pelo {nome} — por meio de transferência própria, feita
            separadamente do pagamento do cliente — de forma que o profissional (e o colaborador,
            quando aplicável) recebe o valor integral do serviço, como se o cupom não tivesse sido
            aplicado.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">5. Cancelamentos e reembolsos</h2>
          <p className="mt-1">
            Clientes podem cancelar ou remarcar agendamentos conforme as regras definidas na
            plataforma (incluindo prazos mínimos de antecedência). Em caso de cancelamento de um
            agendamento já pago, o estorno é processado diretamente pela instituição de pagamento
            conectada pelo profissional.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">6. Assinatura da plataforma</h2>
          <p className="mt-1">
            O uso da plataforma pelo profissional é gratuito durante o período de teste. Após esse
            período, é necessário assinar um dos planos disponíveis (Básico ou Premium) para
            continuar utilizando o sistema. A cobrança da assinatura é feita pelo {nome},
            diretamente, e pode exigir CPF ou CNPJ do profissional para emissão da cobrança.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">7. Programas de indicação</h2>
          <p className="mt-1">
            O {nome} pode disponibilizar programas de indicação distintos: um para clientes
            (indicação de amigos, com recompensa em serviços) e outro para profissionais
            (indicação de novos estabelecimentos, com recompensa em dinheiro na primeira
            assinatura paga do indicado). As condições de cada programa podem ser alteradas ou
            encerradas a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">8. Colaboradores</h2>
          <p className="mt-1">
            Colaboradores cadastrados por um profissional atuam sob a responsabilidade exclusiva
            desse profissional. O vínculo entre profissional e colaborador não configura, em
            nenhuma hipótese, relação de emprego com o {nome}.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">9. Notificações</h2>
          <p className="mt-1">
            Clientes e profissionais podem optar por ativar notificações no navegador para
            receber avisos sobre agendamentos (confirmação, lembretes) e novidades da plataforma.
            Essa ativação é sempre opcional e pode ser desfeita a qualquer momento, nas
            configurações do próprio navegador.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">10. Limitação de responsabilidade</h2>
          <p className="mt-1">
            O {nome} atua como intermediário tecnológico entre profissionais e clientes. Não nos
            responsabilizamos pela qualidade dos serviços prestados pelos profissionais
            cadastrados, nem por falhas das instituições de pagamento escolhidas por cada
            profissional.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink">11. Contato</h2>
          <p className="mt-1">Dúvidas sobre estes termos podem ser enviadas ao suporte da plataforma.</p>
        </section>
      </div>
    </main>
  );
}
