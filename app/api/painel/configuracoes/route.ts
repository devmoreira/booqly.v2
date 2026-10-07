// GET/PUT /api/painel/configuracoes
// Configurações do PRÓPRIO profissional logado — dados do negócio
// (nome, endereço), forma de cobrança, e conta (e-mail, senha).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificacaoConfirmada } from "@/lib/verificacao-whatsapp";
import { telefoneParaE164 } from "@/lib/telefone";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const [{ data: perfil }, { data: cobranca }] = await Promise.all([
    supabase.from("profissionais").select("tema, foto_url, nome_negocio, endereco, numero_endereco, complemento_endereco, bairro, cidade, estado, instagram, slug, celular").eq("id", user.id).maybeSingle(),
    supabase.from("configuracoes_cobranca").select("*").eq("profissional_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    id: user.id,
    tema: perfil?.tema ?? "verde",
    fotoUrl: perfil?.foto_url ?? null,
    nomeNegocio: perfil?.nome_negocio ?? "",
    endereco: perfil?.endereco ?? "",
    numeroEndereco: perfil?.numero_endereco ?? "",
    complementoEndereco: perfil?.complemento_endereco ?? "",
    bairro: perfil?.bairro ?? "",
    cidade: perfil?.cidade ?? "",
    estado: perfil?.estado ?? "",
    slug: perfil?.slug ?? "",
    celular: perfil?.celular ?? "",
    instagram: perfil?.instagram ?? "",
    email: user.email ?? "",
    metodo: cobranca?.metodo ?? "pos_servico",
    taxaTipo: cobranca?.taxa_tipo ?? "percentual",
    taxaValor: cobranca?.taxa_valor ?? 0,
  });
}

const schema = z.object({
  tema: z.enum(["verde", "preto", "branco"]).optional(), // sem uso na tela do profissional por enquanto
  nomeNegocio: z.string().min(2).max(80).optional(),
  endereco: z.string().min(3).max(160).optional(),
  numeroEndereco: z.string().max(20).optional(),
  complementoEndereco: z.string().max(80).optional(),
  bairro: z.string().max(80).optional(),
  cidade: z.string().min(2).max(80).optional(),
  estado: z.string().length(2).optional(),
  instagram: z.string().max(50).optional(),
  celular: z.union([z.literal(""), z.string().min(10).max(20)]).optional(),
  metodo: z.enum(["taxa_agendamento", "pagamento_total", "pos_servico"]),
  taxaTipo: z.enum(["percentual", "fixo"]),
  taxaValor: z.number().min(0),
  novaSenha: z.string().min(8).optional(),
  codigoVerificacao: z.string().optional(), // exigido junto com novaSenha
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: validado.error.errors[0]?.message ?? "dados inválidos" }, { status: 400 });
  const d = validado.data;

  const dadosPerfil: Record<string, string> = {};
  if (d.tema) dadosPerfil.tema = d.tema;
  if (d.nomeNegocio) dadosPerfil.nome_negocio = d.nomeNegocio;
  if (d.endereco) dadosPerfil.endereco = d.endereco;
  if (d.cidade) dadosPerfil.cidade = d.cidade;
  if (d.estado) dadosPerfil.estado = d.estado.toUpperCase();
  // Esses três são opcionais de verdade — a pessoa pode querer limpar
  // (ex: remover o complemento), não só preencher.
  if (d.numeroEndereco !== undefined) dadosPerfil.numero_endereco = d.numeroEndereco;
  if (d.complementoEndereco !== undefined) dadosPerfil.complemento_endereco = d.complementoEndereco;
  if (d.bairro !== undefined) dadosPerfil.bairro = d.bairro;
  if (d.instagram !== undefined) dadosPerfil.instagram = d.instagram.replace(/^@/, "").trim();
  if (d.celular !== undefined) dadosPerfil.celular = d.celular;

  const [{ error: erroPerfil }, { error: erroCobranca }] = await Promise.all([
    Object.keys(dadosPerfil).length > 0
      ? supabase.from("profissionais").update(dadosPerfil).eq("id", user.id)
      : Promise.resolve({ error: null }),
    supabase.from("configuracoes_cobranca").upsert({
      profissional_id: user.id,
      metodo: d.metodo,
      taxa_tipo: d.taxaTipo,
      taxa_valor: d.taxaValor,
    }),
  ]);

  const erro = erroPerfil || erroCobranca;
  if (erro) {
    console.error("Erro ao salvar configurações:", erro);
    return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  }

  // Trocar a senha exige verificação por WhatsApp CONFIRMADA de
  // verdade — nunca só a senha nova sozinha. Sem essa checagem no
  // servidor, alguém poderia pular a etapa de verificação da tela e
  // trocar a senha só chamando essa rota direto.
  if (d.novaSenha) {
    if (!d.codigoVerificacao) {
      return NextResponse.json({ erro: "Confirme sua identidade pelo WhatsApp antes de trocar a senha." }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data: perfilTelefone } = await admin.from("profissionais").select("celular, telefone_contato").eq("id", user.id).maybeSingle();
    const bruto = perfilTelefone?.celular || perfilTelefone?.telefone_contato;
    const telefone = bruto ? telefoneParaE164(bruto) : null;
    if (!telefone || !(await verificacaoConfirmada(telefone, d.codigoVerificacao))) {
      return NextResponse.json({ erro: "Verificação por WhatsApp ainda não confirmada." }, { status: 403 });
    }

    const { error: erroSenha } = await supabase.auth.updateUser({ password: d.novaSenha });
    if (erroSenha) return NextResponse.json({ erro: `Não foi possível trocar a senha: ${erroSenha.message}` }, { status: 400 });

    await admin.from("verificacoes_whatsapp").delete().eq("telefone", telefone).eq("codigo", d.codigoVerificacao);
  }

  return NextResponse.json({ ok: true });
}
