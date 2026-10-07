// GET/PUT /api/admin/configuracoes
// Único jeito de ler/alterar as configurações globais da plataforma.
// Confirma que quem está chamando é admin ANTES de qualquer leitura ou escrita.
//
// IMPORTANTE: a chave asaasApiKey aqui é a conta DA PLATAFORMA — usada
// só pra cobrar assinatura dos profissionais e cobrir subsídio de
// cupom. O pagamento do cliente pro profissional usa a conta de CADA
// profissional, configurada no painel individual dele (não aqui).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";

// Esconde o valor de um segredo, mostrando só se ele "está configurado" —
// assim o navegador nunca recebe a chave inteira de volta, só a
// confirmação de que ela existe (pra mostrar "•••• configurado" na tela).
function ocultar(valor: string | null) {
  return valor ? `configurado (${valor.slice(0, 4)}••••)` : null;
}

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db.from("configuracoes_plataforma").select("*").eq("id", 1).single();
  if (!data) return NextResponse.json({ erro: "configuração não encontrada" }, { status: 500 });

  return NextResponse.json({
    asaasAmbiente: data.asaas_ambiente,
    asaasApiKey: ocultar(data.asaas_api_key),
    asaasWebhookToken: ocultar(data.asaas_webhook_token),
    testeGratisHoras: data.teste_gratis_horas,
    valorComissaoIndicacaoProfissionalCentavos: data.valor_comissao_indicacao_profissional_centavos,
    valorComissaoIndicacaoClienteCentavos: data.valor_comissao_indicacao_cliente_centavos,
    valorComissaoIndicacaoColaboradorCentavos: data.valor_comissao_indicacao_colaborador_centavos,
    prazoSaqueDias: data.prazo_saque_dias,
    limiteHorasRemarcar: data.limite_horas_remarcar,
  });
}

const schema = z.object({
  asaasAmbiente: z.literal("production").optional(),
  asaasApiKey: z.string().min(10).optional(), // só manda se for TROCAR a chave
  asaasWebhookToken: z.string().min(10).optional(),
  testeGratisHoras: z.number().int().min(1).max(8760).optional(), // até 1 ano
  valorComissaoIndicacaoProfissionalCentavos: z.number().int().min(0).optional(),
  valorComissaoIndicacaoClienteCentavos: z.number().int().min(0).optional(),
  valorComissaoIndicacaoColaboradorCentavos: z.number().int().min(0).optional(),
  prazoSaqueDias: z.number().int().min(0).max(30).optional(),
  limiteHorasRemarcar: z.number().int().min(0).max(168).optional(), // até 7 dias
});

export async function PUT(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) {
    return NextResponse.json({ erro: "dados inválidos", detalhes: validado.error.flatten() }, { status: 400 });
  }

  const dadosParaSalvar: Record<string, unknown> = {};
  if (validado.data.asaasAmbiente) dadosParaSalvar.asaas_ambiente = "production";
  if (validado.data.asaasApiKey) dadosParaSalvar.asaas_api_key = validado.data.asaasApiKey;
  if (validado.data.asaasWebhookToken) dadosParaSalvar.asaas_webhook_token = validado.data.asaasWebhookToken;
  if (validado.data.testeGratisHoras !== undefined) dadosParaSalvar.teste_gratis_horas = validado.data.testeGratisHoras;
  if (validado.data.valorComissaoIndicacaoProfissionalCentavos !== undefined) dadosParaSalvar.valor_comissao_indicacao_profissional_centavos = validado.data.valorComissaoIndicacaoProfissionalCentavos;
  if (validado.data.valorComissaoIndicacaoClienteCentavos !== undefined) dadosParaSalvar.valor_comissao_indicacao_cliente_centavos = validado.data.valorComissaoIndicacaoClienteCentavos;
  if (validado.data.valorComissaoIndicacaoColaboradorCentavos !== undefined) dadosParaSalvar.valor_comissao_indicacao_colaborador_centavos = validado.data.valorComissaoIndicacaoColaboradorCentavos;
  if (validado.data.prazoSaqueDias !== undefined) dadosParaSalvar.prazo_saque_dias = validado.data.prazoSaqueDias;
  if (validado.data.limiteHorasRemarcar !== undefined) dadosParaSalvar.limite_horas_remarcar = validado.data.limiteHorasRemarcar;

  const db = createAdminClient();
  const { error } = await db.from("configuracoes_plataforma").update(dadosParaSalvar).eq("id", 1);
  if (error) {
    console.error("Erro ao salvar configurações do admin:", error);
    return NextResponse.json({ erro: `falha ao salvar: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
