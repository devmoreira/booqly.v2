"use client";
import { useRouter } from "next/navigation";

export function SairClienteButton() {
  const router = useRouter();
  async function sair() {
    await fetch("/api/cliente/sair", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <button onClick={sair} className="text-red-600 hover:underline">Sair</button>;
}
