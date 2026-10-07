"use client";
import { useRouter } from "next/navigation";

export function SairButton({ destino = "/login", className }: { destino?: string; className?: string }) {
  const router = useRouter();
  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.push(destino);
    router.refresh();
  }
  return (
    <button onClick={sair} className={className ?? "text-sm text-ink/60 hover:text-ink hover:underline"}>
      Sair
    </button>
  );
}
