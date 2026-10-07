// POST /api/auth/cadastro
// Cadastro profissional: o WhatsApp é a única confirmação.
// O usuário do Supabase Auth só é criado aqui, depois de o código WhatsApp
// ter sido confirmado pelo webhook. email_confirm=true evita e-mail nativo.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email().max(254),
  senha: z.string().min(8).max(128),
  nomeEmpresa: z.string().min(2).max(120),
  nomeProprietario: z.string().min(2).max(120),
  celular: z.string().min(10).max(20),
  codigoWhatsapp: z.string().regex(/^\d{6}$/, "Código do WhatsApp inválido."),
  endereco: z.string().min(3).max(200),
  numeroEndereco: z.string().trim().min(1, "Informe o número do estabelecimento.").max(20),
  cidade: z.string().min(2).max(100),
  estado: z.string().length(2),
  categoria: z.enum(["barbearia", "salao", "manicure", "cabeleireiro", "esteticista", "personal_trainer", "nutricionista", "outro"]),
  indicadoPorSlug: z.string().optional(),
  indicadoPorClienteId: z.string().uuid().optional(),
  indicadoPorColaboradorId: z.string().uuid().optional(),
});

function gerarSlug(nome: string) {
  return nome.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) {
    return NextResponse.json({ erro: "Dados inválidos", detalhes: validado.error.flatten() }, { status: 400 });
  }
  const d = validado.data;
  const telefone = d.celular.startsWith("+") ? d.celular : `+${d.celular.replace(/\D/g, "")}`;
  const codigoWhatsapp = `AGD-${d.codigoWhatsapp}`;
  const admin = createAdminClient();

  const { data: verificacao } = await admin
    .from("verificacoes_whatsapp")
    .select("id, verificado_em")
    .eq("telefone", telefone)
    .eq("codigo", codigoWhatsapp)
    .gte("criado_em", new Date(Date.now() - 5 * 60_000).toISOString())
    .maybeSingle();

  if (!verificacao?.verificado_em) {
    return NextResponse.json({ erro: "Confirme o código enviado para seu WhatsApp antes de concluir o cadastro." }, { status: 400 });
  }

  const { data: authCriado, error: erroAuth } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.senha,
    email_confirm: true,
  });
  if (erroAuth || !authCriado.user) {
    const mensagem = erroAuth?.message?.toLowerCase().includes("already")
      ? "Esse e-mail já está cadastrado. Faça login ou use outro e-mail."
      : "Não foi possível criar sua conta. Tente novamente.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
  const userId = authCriado.user.id;

  // Vincula a verificação pré-cadastro à conta recém-criada.
  await admin.from("verificacoes_whatsapp").update({ user_id: userId }).eq("id", verificacao.id);

  const slug = gerarSlug(d.nomeEmpresa);

  let indicadoPorProfissionalId: string | null = null;
  if (d.indicadoPorSlug) {
    const { data: indicador } = await admin.from("profissionais").select("id").eq("slug", d.indicadoPorSlug).maybeSingle();
    indicadoPorProfissionalId = indicador?.id ?? null;
  }

  let indicadoPorClienteId: string | null = null;
  if (d.indicadoPorClienteId) {
    const { data: clienteIndicador } = await admin.from("clientes").select("id").eq("id", d.indicadoPorClienteId).maybeSingle();
    indicadoPorClienteId = clienteIndicador?.id ?? null;
  }

  let indicadoPorColaboradorId: string | null = null;
  if (d.indicadoPorColaboradorId) {
    const { data: colaboradorIndicador } = await admin.from("colaboradores").select("id").eq("id", d.indicadoPorColaboradorId).maybeSingle();
    indicadoPorColaboradorId = colaboradorIndicador?.id ?? null;
  }

  // O Supabase às vezes demora uma fração de segundo pra "assentar" o
  // usuário recém-criado antes dele aparecer pra outras conexões — se a
  // gente tentar inserir o perfil rápido demais, dá erro de chave
  // estrangeira mesmo o usuário existindo de verdade. Em vez de só
  // tentar de novo às cegas, confirma ativamente que o usuário já
  // existe (via getUserById) antes de tentar criar o perfil.
  let usuarioConfirmado = false;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const { data, error: erroBusca } = await admin.auth.admin.getUserById(userId);
    if (data?.user) { usuarioConfirmado = true; break; }
    if (erroBusca) console.error(`Tentativa ${tentativa + 1} de achar usuário ${userId} falhou:`, erroBusca);
    await new Promise((r) => setTimeout(r, 750));
  }

  let erroPerfil = null;
  if (usuarioConfirmado) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const resultado = await admin.from("profissionais").insert({
        id: userId,
        nome_negocio: d.nomeEmpresa,
        nome_proprietario: d.nomeProprietario,
        celular: d.celular,
        slug,
        endereco: d.endereco,
        numero_endereco: d.numeroEndereco,
        cidade: d.cidade,
        estado: d.estado.toUpperCase(),
        categoria: d.categoria,
        indicado_por_profissional_id: indicadoPorProfissionalId,
        indicado_por_cliente_id: indicadoPorClienteId,
        indicado_por_colaborador_id: indicadoPorColaboradorId,
      });
      erroPerfil = resultado.error;
      if (!erroPerfil) break;
      if (erroPerfil.code !== "23503") break; // erro diferente — não adianta tentar de novo
      await new Promise((r) => setTimeout(r, 700 * (tentativa + 1)));
    }
  } else {
    erroPerfil = { message: "Usuário não encontrado após criação" } as any;
    console.error("Usuário não apareceu no auth.users a tempo:", userId);
  }

  if (erroPerfil) {
    console.error("Erro ao criar perfil do profissional:", erroPerfil);
    // A conta de login (auth.users) já existe nesse ponto — se o perfil
    // falhar, desfaz a criação da conta também.
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ erro: "Não foi possível criar seu perfil. Tente novamente." }, { status: 400 });
  }

  // O próprio dono já nasce como "colaborador principal" — conta pra
  // agenda por colaborador e pro limite de colaboradores do plano
  // (Básico: o principal + 1 que ele adicionar = 2 no total). Reaproveita
  // o mesmo id do profissional (que já existe em auth.users), então não
  // precisa de login separado — o dono entra sempre pelo login normal
  // dele mesmo.
  const { error: erroColaboradorPrincipal } = await admin.from("colaboradores").insert({
    id: userId,
    profissional_id: userId,
    nome: d.nomeProprietario,
    login_id: `principal-${userId}`,
  });
  if (erroColaboradorPrincipal) {
    console.error("Erro ao criar colaborador principal (não bloqueia o cadastro):", erroColaboradorPrincipal);
  }

  return NextResponse.json({ ok: true, loginId: slug }, { status: 201 });
}
