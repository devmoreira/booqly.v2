import Link from "next/link";
import { AgendaColaborador } from "../AgendaColaborador";

export default function AgendaColaboradorPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/colaborador" className="text-sm text-ink/60 hover:underline">← Voltar</Link>
      <div className="mt-2">
        <h1 className="font-display text-2xl font-bold">Sua agenda</h1>
        <p className="mt-1 text-ink/60">Seus atendimentos, organizados por status e por dia.</p>
      </div>
      <AgendaColaborador />
    </main>
  );
}
