// GET /api/painel/horarios-livres-hoje
// Calcula os horários vagos de HOJE (a partir de agora), em blocos de
// 30min, dentro do horário de funcionamento — pra gerar o story de
// "compartilhar vagas de hoje". Não depende de um serviço específico
// (não usa duração), então é só um panorama de "quando não tem nada
// marcado ainda".
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const agora = new Date();
  const diaSemana = agora.getDay();

  const { data: horarioHoje } = await admin
    .from("horarios_funcionamento")
    .select("hora_inicio, hora_fim, ativo")
    .eq("profissional_id", user.id)
    .eq("dia_semana", diaSemana)
    .maybeSingle();

  if (!horarioHoje?.ativo) return NextResponse.json({ horarios: [] });

  const inicioDoDia = new Date(agora);
  const [hIni, mIni] = horarioHoje.hora_inicio.split(":").map(Number);
  inicioDoDia.setHours(hIni, mIni, 0, 0);

  const fimDoDia = new Date(agora);
  const [hFim, mFim] = horarioHoje.hora_fim.split(":").map(Number);
  fimDoDia.setHours(hFim, mFim, 0, 0);

  const comecoDaBusca = new Date(Math.max(agora.getTime(), inicioDoDia.getTime()));

  const inicioISO = new Date(agora); inicioISO.setHours(0, 0, 0, 0);
  const fimISO = new Date(agora); fimISO.setHours(23, 59, 59, 999);

  const [{ data: ocupados }, { data: bloqueios }] = await Promise.all([
    admin.from("agendamentos")
      .select("inicio, fim")
      .eq("profissional_id", user.id)
      .in("status", ["pendente", "confirmado"])
      .gte("inicio", inicioISO.toISOString())
      .lte("inicio", fimISO.toISOString()),
    admin.from("bloqueios_agenda")
      .select("inicio, fim")
      .eq("profissional_id", user.id)
      .gte("inicio", inicioISO.toISOString())
      .lte("fim", fimISO.toISOString()),
  ]);

  const ocupacoes = [...(ocupados ?? []), ...(bloqueios ?? [])].map((o) => ({
    inicio: new Date(o.inicio).getTime(),
    fim: new Date(o.fim).getTime(),
  }));

  const livres: string[] = [];
  const passo = 30 * 60_000; // blocos de 30 minutos
  for (let t = comecoDaBusca.getTime(); t + passo <= fimDoDia.getTime(); t += passo) {
    const ocupado = ocupacoes.some((o) => t < o.fim && t + passo > o.inicio);
    if (!ocupado) {
      livres.push(new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }
  }

  return NextResponse.json({ horarios: livres.slice(0, 6) }); // no máximo 6, pra caber bem no story
}
