"use client";
import { useState } from "react";

export function AbasAgendarLoja({ formularioAgendar, loja }: { formularioAgendar: React.ReactNode; loja: React.ReactNode | null }) {
  const [aba, setAba] = useState<"agendar" | "loja">("agendar");

  if (!loja) return <>{formularioAgendar}</>;

  return (
    <div className="w-full">
      <div className="mb-6 mt-7 flex justify-center gap-8">
        <button onClick={() => setAba("agendar")} className="text-center">
          <span className={aba === "agendar" ? "text-base font-semibold text-ink" : "text-base font-normal text-ink/40"}>
            Agendar
          </span>
          <div className={`mx-auto mt-1.5 h-[3px] w-6 rounded-full ${aba === "agendar" ? "bg-brand" : "bg-transparent"}`} />
        </button>
        <button onClick={() => setAba("loja")} className="text-center">
          <span className={aba === "loja" ? "text-base font-semibold text-ink" : "text-base font-normal text-ink/40"}>
            Loja
          </span>
          <div className={`mx-auto mt-1.5 h-[3px] w-6 rounded-full ${aba === "loja" ? "bg-brand" : "bg-transparent"}`} />
        </button>
      </div>
      {aba === "agendar" ? formularioAgendar : loja}
    </div>
  );
}
