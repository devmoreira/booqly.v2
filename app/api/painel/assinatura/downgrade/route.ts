// POST /api/painel/assinatura/downgrade { planoId }
// Troca pra um plano MAIS BARATO — diferente do upgrade, não cobra
// nada agora (o profissional já pagou o ciclo atual, não tem
// reembolso). Só troca o plano na hora, mantendo a mesma data de
// renovação. Limitado a 1x por mês, pra não ficar indo e voltando.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarAssinaturaAsaas, cancelarAssinaturaAsaas } from "@/lib/payments/asaas-assinatura";
import { obterNomePlataforma } from "@/lib/nome-plataforma";

const DIAS_ENTRE_DOWNGRADES = 30;

const schema = z.object({ planoId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "plano inválido" }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: profissional }, { data: assinaturaAtiva }, { data: novoPlano }] = await Promise.all([
    admin.from("profissionais").select("id, ultimo_downgrade_em, asaas_customer_id, asaas_subscription_id").eq("id", user.id).maybeSingle(),
    admin
      .from("assinaturas")
      .select("id, fim, plano_id, planos_assinatura(valor_centavos)")
      .eq("profissional_id", user.id)
      .eq("status", "ativa")
      .gt("fim", new Date().toISOString())
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("planos_assinatura").select("nome, nivel, valor_centavos, duracao_meses, ativo").eq("id", validado.data.planoId).single(),
  ]);

  if (!profissional) return NextResponse.json({ erro: "profissional não encontrado" }, { status: 404 });
  if (!novoPlano || !novoPlano.ativo) return NextResponse.json({ erro: "Plano não encontrado" }, { status: 404 });
  if (!assinaturaAtiva) return NextResponse.json({ erro: "Você não tem uma assinatura ativa pra trocar." }, { status: 400 });

  const planoAtual = assinaturaAtiva.planos_assinatura as any;
  if (assinaturaAtiva.plano_id === validado.data.planoId) {
    return NextResponse.json({ erro: "Você já está nesse plano." }, { status: 400 });
  }
  if (novoPlano.valor_centavos >= planoAtual.valor_centavos) {
    return NextResponse.json({ erro: "Essa troca só funciona pra planos mais baratos que o atual." }, { status: 400 });
  }

  // O plano Básico tem um limite de colaboradores ativos — não deixa
  // trocar se isso deixaria a conta acima do que o novo plano permite.
  if (novoPlano.nivel === "basico") {
    const LIMITE_COLABORADORES_BASICO = 2;
    const { count } = await admin.from("colaboradores").select("id", { count: "exact", head: true }).eq("profissional_id", user.id).eq("ativo", true);
    if ((count ?? 0) > LIMITE_COLABORADORES_BASICO) {
      return NextResponse.json({
        erro: `Você tem ${count} colaboradores ativos, e o plano Básico permite até ${LIMITE_COLABORADORES_BASICO}. Desative alguns antes de trocar de plano.`,
      }, { status: 400 });
    }
  }

  if (profissional.ultimo_downgrade_em) {
    const diasDesdeUltimoDowngrade = (Date.now() - new Date(profissional.ultimo_downgrade_em).getTime()) / 86_400_000;
    if (diasDesdeUltimoDowngrade < DIAS_ENTRE_DOWNGRADES) {
      const diasFaltando = Math.ceil(DIAS_ENTRE_DOWNGRADES - diasDesdeUltimoDowngrade);
      return NextResponse.json({ erro: `Você só pode trocar pra um plano mais barato 1x por mês. Tenta de novo em ${diasFaltando} dia(s).` }, { status: 400 });
    }
  }

  // Troca o plano na hora, mantendo a mesma data de fim — sem cobrar
  // nada agora (o ciclo atual já foi pago no valor do plano antigo).
  const { error: erroAssinatura } = await admin
    .from("assinaturas")
    .update({ plano_id: validado.data.planoId })
    .eq("id", assinaturaAtiva.id);
  if (erroAssinatura) return NextResponse.json({ erro: "Não foi possível trocar de plano" }, { status: 500 });

  await admin.from("profissionais").update({ ultimo_downgrade_em: new Date().toISOString() }).eq("id", user.id);

  // Ajusta a assinatura recorrente do Asaas pro valor novo (mais
  // barato), só cobrando de novo quando o ciclo atual terminar.
  try {
    if (profissional.asaas_customer_id) {
      if (profissional.asaas_subscription_id) {
        await cancelarAssinaturaAsaas(profissional.asaas_subscription_id).catch((erro) =>
          console.error("Falha ao cancelar assinatura antiga no downgrade:", erro)
        );
      }
      const nomePlataforma = await obterNomePlataforma();
      const { subscriptionId } = await criarAssinaturaAsaas({
        customerId: profissional.asaas_customer_id,
        valorCentavos: novoPlano.valor_centavos,
        duracaoMeses: novoPlano.duracao_meses,
        externalReference: `assinatura_${profissional.id}_${validado.data.planoId}_sem-cupom`,
        descricao: `Assinatura ${nomePlataforma} — ${novoPlano.nome}`,
        nextDueDate: assinaturaAtiva.fim.slice(0, 10),
      });
      await admin.from("profissionais").update({ asaas_subscription_id: subscriptionId }).eq("id", profissional.id);
    }
  } catch (erro) {
    console.error("Falha ao criar assinatura recorrente nova após downgrade:", erro);
  }

  return NextResponse.json({ ok: true });
}
