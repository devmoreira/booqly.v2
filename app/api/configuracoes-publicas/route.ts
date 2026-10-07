// GET /api/configuracoes-publicas
// Configurações da plataforma que não são segredo nenhum e várias
// telas (cliente e profissional) precisam ler — sem exigir login.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOME_PLATAFORMA } from "@/lib/nome-plataforma";

export async function GET() {
  const admin = createAdminClient();
  const [{ data: config }, { data: tutoriaisData }] = await Promise.all([
    admin.from("configuracoes_plataforma").select("limite_horas_remarcar, funcionalidade_cupons_ativa, gateway_asaas_ativo, gateway_mercadopago_ativo").eq("id", 1).single(),
    admin.from("tutoriais_video").select("titulo, url").order("ordem"),
  ]);

  return NextResponse.json({
    limiteHorasRemarcar: config?.limite_horas_remarcar ?? 2,
    nomePlataforma: NOME_PLATAFORMA,
    tutoriais: tutoriaisData ?? [],
    cuponsAtiva: config?.funcionalidade_cupons_ativa ?? true,
    gatewayAsaasAtivo: config?.gateway_asaas_ativo ?? true,
    gatewayMercadopagoAtivo: config?.gateway_mercadopago_ativo ?? true,
  });
}
