import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfissionalAdminOuNull } from "@/lib/auth-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacaoPushBroadcastClientes, enviarNotificacaoPushBroadcastProfissionais } from "@/lib/push";

export async function GET() {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const db = createAdminClient();
  const { data } = await db.from("cupons").select("*").order("criado_em", { ascending: false });
  return NextResponse.json({ cupons: data ?? [] });
}

const schema = z.object({
  codigo: z.string().min(3).max(30),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.number().positive(),
  publico: z.enum(["profissional", "cliente"]).default("profissional"),
  validade: z.string().datetime().optional(),
  usosMaximos: z.number().int().positive().optional(),
  usosMaximosPorEmpresa: z.number().int().positive().optional(),
  descricao: z.string().max(200).optional(),
  notificar: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });

  const db = createAdminClient();
  const { data: config } = await db.from("configuracoes_plataforma").select("funcionalidade_cupons_ativa").eq("id", 1).single();
  if (config?.funcionalidade_cupons_ativa === false) {
    return NextResponse.json({ erro: "O sistema de cupons está desativado. Religue em Funcionalidades primeiro." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const validado = schema.safeParse(corpo);
  if (!validado.success) return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });

  const { error } = await db.from("cupons").insert({
    codigo: validado.data.codigo.toUpperCase().trim(),
    tipo: validado.data.tipo,
    valor: validado.data.valor,
    publico: validado.data.publico,
    validade: validado.data.validade ?? null,
    usos_maximos: validado.data.usosMaximos ?? null,
    usos_maximos_por_empresa: validado.data.usosMaximosPorEmpresa ?? null,
  });
  if (error) {
    const mensagem = error.code === "23505" ? "Já existe um cupom com esse código." : "Não foi possível criar o cupom.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  if (validado.data.notificar) {
    const valorFormatado = validado.data.tipo === "percentual" ? `${validado.data.valor}%` : `R$ ${validado.data.valor.toFixed(2)}`;
    const corpoMensagem = validado.data.descricao?.trim()
      ? validado.data.descricao.trim()
      : `Use o código ${validado.data.codigo.toUpperCase()} e ganhe ${valorFormatado} de desconto.`;

    const payload = { titulo: "Novo cupom disponível! 🎁", corpo: corpoMensagem, url: "/" };

    const enviar = validado.data.publico === "cliente"
      ? enviarNotificacaoPushBroadcastClientes(payload)
      : enviarNotificacaoPushBroadcastProfissionais(payload);

    enviar.catch((erro) => console.error("Falha ao anunciar cupom novo:", erro));
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const admin = await getProfissionalAdminOuNull();
  if (!admin) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const { id, excluir } = await req.json().catch(() => ({ id: null, excluir: false }));
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
  const db = createAdminClient();

  if (excluir) {
    // Exclusão de verdade — só funciona se o cupom nunca foi usado. Se já
    // tiver histórico (agendamento ou assinatura vinculada), o próprio
    // banco recusa (chave estrangeira), e devolvemos mensagem clara.
    const { error } = await db.from("cupons").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ erro: "Esse cupom já foi usado — não dá pra excluir, só desativar." }, { status: 400 });
      }
      return NextResponse.json({ erro: "Não foi possível excluir o cupom." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  await db.from("cupons").update({ ativo: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
