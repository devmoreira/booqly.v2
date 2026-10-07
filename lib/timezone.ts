// O servidor pode rodar em qualquer fuso horário (localmente é o fuso
// do seu computador; na Vercel, é UTC por padrão). Sem cuidado, isso
// faz toda a agenda "andar" — um horário de 14h vira 11h ou 17h
// dependendo de onde o código está rodando. Essas funções sempre
// trabalham no horário de Brasília, não importa onde o servidor esteja.
const FUSO = "America/Sao_Paulo"; // Brasil não tem mais horário de verão desde 2019

// Constrói o instante exato a partir de uma data+hora "de parede" no
// horário de Brasília — ex: horaBrasilParaData("2026-08-25", "14:00")
export function horaBrasilParaData(dataISO: string, horaHHMM: string): Date {
  return new Date(`${dataISO}T${horaHHMM}:00-03:00`);
}

// Formata um instante de volta pra "HH:MM" no horário de Brasília
export function formatarHoraBrasil(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(data);
}

// Dia da semana (0=domingo...6=sábado) de uma data, no horário de
// Brasília — ancorado ao meio-dia pra nunca cair na virada errada
export function diaDaSemanaBrasil(dataISO: string): number {
  const meioDia = horaBrasilParaData(dataISO, "12:00");
  const nomeDia = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(meioDia);
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return mapa[nomeDia];
}
