"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type Tema = "verde" | "preto" | "branco";
const ThemeContext = createContext<{ tema: Tema; setTema: (t: Tema) => void }>({
  tema: "verde",
  setTema: () => {},
});

export function ThemeProvider({ children, temaInicial = "verde" }: { children: ReactNode; temaInicial?: Tema }) {
  const [tema, setTema] = useState<Tema>(temaInicial);
  return (
    <div data-theme={tema}>
      <ThemeContext.Provider value={{ tema, setTema }}>{children}</ThemeContext.Provider>
    </div>
  );
}

export function useTema() {
  return useContext(ThemeContext);
}
