// GET/POST/DELETE /api/colaboradores
// O dono do estabelecimento gerencia os colaboradores por aqui. O login
// de cada colaborador é gerado automaticamente: inicial da empresa +
// "." + nome (ex: empresa "Barbearia do João" + colaborador "Pedro" = "b.pedro").
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temAcessoPremium } from "@/lib/assinatura";
import { telefoneParaE164 } from "@/lib/telefone";

async function pegarDonoLogado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profissionais").select("id, slug").eq("id", user.id).maybeSingle();
  return perfil;
}

export async function GET() {
  const dono = await pegarDonoLogado();
  if (!dono) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("colaboradores")
    .select("id, nome, login_id, ativo, percentual_comissao, confirmacao_automatica, foto_url, pix_chave, pix_chave_tipo, telefone, almoco_inicio, almoco_fim")
    .eq("profissional_id", dono.id);
  return NextResponse.json({ colaboradores: data ?? [] });
}

function gerarLoginId(slugEmpresa: string, nomeColaborador: string) {
  const inicial = slugEmpresa.charAt(0);
  const nomeSlug = nomeColaborador.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "").slice(0, 30);
  return `${inicial}.${nomeSlug}`;
}

const schema = z.object({
  nome: z.string().min(2).max(80),
  senha: z.string().min(8),
  telefone: z.string().min(10).max(20),
});

export async function POST(req: NextRequest) {
  const dono = await pegarDonoLogado();
  if (!dono) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  // Plano Básico tem um limite de colaboradores — Premium é ilimitado
  const LIMITE_COLABORADORES_BASICO = 2;
  const admin = createAdminClient();
  const premium = await temAcessoPremium(dono.id);
  if (!premium) {
    const { count } = await admin.from("colaboradores").select("id", { count: "exact", head: true }).eq("profissional_id", dono.id).eq("ativo", true);
    if ((count ?? 0) >= LIMITE_COLABORADORES_BASICO) {
      return NextResponse.json({
        erro: `O plano Básico permite até ${LIMITE_COLABORADORES_BASICO} colaboradores. Faça upgrade pro Premium pra cadastrar mais.`,
      }, { status: 403 });
    }
  }

  const telefone = telefoneParaE164(validado.data.telefone);
  if (!telefone) return NextResponse.json({ erro: "Telefone do colaborador inválido." }, { status: 400 });

  const loginId = gerarLoginId(dono.slug, validado.data.nome);

  // Colaborador não tem e-mail próprio necessariamente — usa um e-mail
  // interno, invisível pro usuário, só pra existir no sistema de login.
  const emailInterno = `${loginId}@colaboradores.booqly.internal`;

  const { data: usuario, error: erroAuth } = await admin.auth.admin.createUser({
    email: emailInterno,
    password: validado.data.senha,
    email_confirm: true, // colaborador não precisa confirmar e-mail (não é dele de verdade)
  });
  if (erroAuth || !usuario.user) {
    return NextResponse.json({ erro: "Não foi possível criar o colaborador (login já existe?)" }, { status: 400 });
  }

  const { error: erroPerfil } = await admin.from("colaboradores").insert({
    id: usuario.user.id,
    profissional_id: dono.id,
    nome: validado.data.nome,
    login_id: loginId,
    telefone,
  });
  if (erroPerfil) {
    await admin.auth.admin.deleteUser(usuario.user.id);
    return NextResponse.json({ erro: "Não foi possível salvar o colaborador" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, loginId }, { status: 201 });
}

const schemaEditar = z.object({
  id: z.string().uuid(),
  percentualComissao: z.number().min(0).max(100).optional(),
  confirmacaoAutomatica: z.boolean().optional(),
  novaSenha: z.string().min(8).optional(),
  pixChave: z.string().min(3).max(80).optional(),
  pixChaveTipo: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).optional(),
  telefone: z.string().min(10).max(20).optional(),
  almocoInicio: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  almocoFim: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  ativo: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const dono = await pegarDonoLogado();
  if (!dono) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const corpo = await req.json().catch(() => null);
  const validado = schemaEditar.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  if (validado.data.almocoInicio !== undefined || validado.data.almocoFim !== undefined) {
    const inicio = validado.data.almocoInicio;
    const fim = validado.data.almocoFim;
    if ((inicio && !fim) || (!inicio && fim)) {
      return NextResponse.json({ erro: "Preencha início e fim do almoço juntos, ou deixe os dois em branco." }, { status: 400 });
    }
    if (inicio && fim && fim <= inicio) {
      return NextResponse.json({ erro: "O fim do almoço precisa ser depois do início." }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: colaborador } = await admin.from("colaboradores").select("profissional_id").eq("id", validado.data.id).single();
  if (!colaborador || colaborador.profissional_id !== dono.id) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }

  if (validado.data.ativo === true) {
    const LIMITE_COLABORADORES_BASICO = 2;
    const premium = await temAcessoPremium(dono.id);
    if (!premium) {
      const { count } = await admin.from("colaboradores").select("id", { count: "exact", head: true }).eq("profissional_id", dono.id).eq("ativo", true);
      if ((count ?? 0) >= LIMITE_COLABORADORES_BASICO) {
        return NextResponse.json({
          erro: `O plano Básico permite até ${LIMITE_COLABORADORES_BASICO} colaboradores ativos. Desative outro antes de reativar esse, ou faça upgrade pro Premium.`,
        }, { status: 403 });
      }
    }
  }

  if (validado.data.novaSenha) {
    const { error: erroSenha } = await admin.auth.admin.updateUserById(validado.data.id, { password: validado.data.novaSenha });
    if (erroSenha) return NextResponse.json({ erro: "Não foi possível trocar a senha" }, { status: 500 });
  }

  const dados: Record<string, unknown> = {};
  if (validado.data.percentualComissao !== undefined) dados.percentual_comissao = validado.data.percentualComissao;
  if (validado.data.confirmacaoAutomatica !== undefined) dados.confirmacao_automatica = validado.data.confirmacaoAutomatica;
  if (validado.data.pixChave !== undefined) dados.pix_chave = validado.data.pixChave;
  if (validado.data.pixChaveTipo !== undefined) dados.pix_chave_tipo = validado.data.pixChaveTipo;
  if (validado.data.telefone !== undefined) {
    const telefone = telefoneParaE164(validado.data.telefone);
    if (!telefone) return NextResponse.json({ erro: "Telefone do colaborador inválido." }, { status: 400 });
    dados.telefone = telefone;
  }
  if (validado.data.almocoInicio !== undefined) dados.almoco_inicio = validado.data.almocoInicio;
  if (validado.data.almocoFim !== undefined) dados.almoco_fim = validado.data.almocoFim;
  if (validado.data.ativo !== undefined) dados.ativo = validado.data.ativo;

  if (Object.keys(dados).length > 0) {
    const { error } = await admin.from("colaboradores").update(dados).eq("id", validado.data.id);
    if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const dono = await pegarDonoLogado();
  if (!dono) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const admin = createAdminClient();
  // Confere que o colaborador é mesmo desse dono antes de apagar
  const { data: colaborador } = await admin.from("colaboradores").select("profissional_id").eq("id", id).single();
  if (!colaborador || colaborador.profissional_id !== dono.id) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }
  await admin.auth.admin.deleteUser(id); // cascade apaga a linha em colaboradores também
  return NextResponse.json({ ok: true });
}
