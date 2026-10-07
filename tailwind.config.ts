import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A cor "brand" muda de valor via variável CSS --brand,
        // trocada pelo ThemeProvider (verde / preto / branco).
        brand: {
          DEFAULT: "var(--brand)",
          fg: "var(--brand-fg)",
          soft: "var(--brand-soft)",
        },
        ink: "var(--ink-strong)",
        paper: "var(--paper)",
        surface: "var(--surface)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
