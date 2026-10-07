// Calcula se o profissional pode usar o sistema agora: ainda está no
// teste grátis, tem assinatura paga ativa, ou está bloqueado.
import { createAdminClient } from "@/lib/supabase/admin";

export type StatusAcesso =
  | { liberado: true; motivo: "teste_gratis"; testeExpiraEm: string }
  | { liberado: true; motivo: "assinatura_ativa"; assinaturaExpiraEm: string }
  | { liberado: false; motivo: "teste_expirado" | "assinatura_vencida" | "perfil_nao_encontrado" };

export async function calcularStatusAcesso(profissionalId: string): Promise<StatusAcesso> {
  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("profissionais")
    .select("teste_iniciado_em")
    .eq("id", profissionalId)
    .maybeSingle();

  // Isso acontece se quem está logado não é dono de estabelecimento
  // nenhum (ex: um colaborador acessando por engano uma rota do dono) —
  // nunca deveria travar o sistema, só significa "sem acesso aqui".
  if (!perfil) {
    return { liberado: false, motivo: "perfil_nao_encontrado" };
  }

  const { data: config } = await admin
    .from("configuracoes_plataforma")
    .select("teste_gratis_horas, funcionalidade_teste_gratis_ativa")
    .eq("id", 1)
    .single();

  // Desligado no admin = ninguém precisa pagar nada, acesso livre pra
  // todo mundo (é um "modo gratuito geral" temporário, não uma trava).
  if (config?.funcionalidade_teste_gratis_ativa === false) {
    return { liberado: true, motivo: "teste_gratis", testeExpiraEm: new Date("2099-12-31").toISOString() };
  }

  const horasTeste = config?.teste_gratis_horas ?? 240;
  const testeExpiraEm = new Date(new Date(perfil.teste_iniciado_em).getTime() + horasTeste * 3_600_000);
  const aindaEmTeste = testeExpiraEm.getTime() > Date.now();

  // Confere PRIMEIRO se já existe assinatura paga ativa — quem já
  // escolheu e pagou um plano específico (ex: Básico) não deveria
  // "ganhar" Premium de graça só porque ainda está dentro da janela
  // de teste grátis. O teste grátis é só pra quem ainda não decidiu.
  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("fim, status")
    .eq("profissional_id", profissionalId)
    .eq("status", "ativa")
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assinatura && new Date(assinatura.fim).getTime() > Date.now()) {
    return { liberado: true, motivo: "assinatura_ativa", assinaturaExpiraEm: assinatura.fim };
  }

  if (aindaEmTeste) {
    return { liberado: true, motivo: "teste_gratis", testeExpiraEm: testeExpiraEm.toISOString() };
  }

  return { liberado: false, motivo: assinatura ? "assinatura_vencida" : "teste_expirado" };
}

// Decide se o profissional tem acesso aos recursos PREMIUM
// (colaboradores ilimitados).
//
// Durante o teste grátis, liberamos Premium também — é de propósito:
// mostra tudo que o sistema oferece pra aumentar a chance de assinar
// o Premium depois que o teste acabar. MAS isso só vale enquanto a
// pessoa ainda não escolheu um plano de verdade — calcularStatusAcesso
// já prioriza a assinatura paga sobre o teste grátis, então quem
// assinou Básico não fica com Premium de graça só por ainda estar
// dentro da janela de teste.
export async function temAcessoPremium(profissionalId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: perfil } = await admin.from("profissionais").select("is_admin").eq("id", profissionalId).maybeSingle();
  if (perfil?.is_admin) return true;

  const status = await calcularStatusAcesso(profissionalId);
  if (!status.liberado) return false;
  if (status.motivo === "teste_gratis") return true;

  // Assinatura ativa — confere se o PLANO especificamente é Premium
  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("plano_id")
    .eq("profissional_id", profissionalId)
    .eq("status", "ativa")
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assinatura?.plano_id) return false;
  const { data: plano } = await admin.from("planos_assinatura").select("nivel").eq("id", assinatura.plano_id).maybeSingle();
  return plano?.nivel === "premium";
}
