"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { SairButton } from "./SairButton";

import { GRUPOS } from "./painel-grupos";
function Icon({ label }: { label: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (label === "Visão geral") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5M9 20v-6h6v6"/></svg>;
  if (label === "Agenda") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
  if (label === "Serviços") return <svg {...common}><path d="m4 4 16 16M14.5 5.5 18 2l4 4-3.5 3.5M9.5 14.5 6 18l-4-4 3.5-3.5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></svg>;
  if (label === "Horários") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
  if (label === "Colaboradores") return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-3.2 2.4-5 6-5s5.5 1.8 6 5M15 15c3.3.1 5.3 1.7 6 5"/></svg>;
  if (label === "Clientes bloqueados") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-3.2 2.4-5 6-5 1.2 0 2.3.2 3.1.6"/><circle cx="17.5" cy="16.5" r="4"/><path d="m14.7 13.7 5.6 5.6"/></svg>;
  if (label === "Loja") return <svg {...common}><path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10c0 2 3 2 4.5 0 1.5 2 4.5 2 6 0 1.5 2 4.5 2 7.5 0M9 20v-5h6v5"/></svg>;
  if (label === "Story") return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/></svg>;
  if (label === "Comunidade") return <svg {...common}><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2.5 20c.5-3 2.3-4.5 5.5-4.5S13 17 13.5 20M10.5 20c.5-3 2.3-4.5 5.5-4.5s5 1.5 5.5 4.5"/></svg>;
  if (label === "Lembrete pra clientes") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path d="M18.5 3.5 21 1"/></svg>;
  if (label === "Cupons") return <svg {...common}><path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 0 0-6V5H3v4Z"/><path d="M13 7v2M13 13v4"/></svg>;
  if (label === "Indique e ganhe") return <svg {...common}><path d="M4 12v8h16v-8M2 8h20v4H2zM12 8v12"/><path d="M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z"/></svg>;
  if (label === "Receber pagamentos") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/></svg>;
  if (label === "Assinatura") return <svg {...common}><path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/><path d="M9 12h6M12 9v6"/></svg>;
  if (label === "Configurações") return <svg {...common}><path d="m12 3 1 2.2 2.4.5 1.8-1.4 2 2-1.4 1.8.5 2.4L21 12l-2.2 1-.5 2.4 1.4 1.8-2 2-1.8-1.4-2.4.5L12 21l-1-2.2-2.4-.5-1.8 1.4-2-2 1.4-1.8-.5-2.4L3 12l2.2-1 .5-2.4-1.4-1.8 2-2 1.8 1.4 2.4-.5L12 3Z"/><circle cx="12" cy="12" r="3"/></svg>;
  if (label === "Passo a passo") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg>;
  if (label === "Admin") return <svg {...common}><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"/><path d="M9 12h6M12 9v6"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>;
}

export function Sidebar({ isAdmin = false, premium = true, nomePlataforma }: { isAdmin?: boolean; premium?: boolean; nomePlataforma?: string }) {
  const pathname = usePathname();
  const ativo = (href: string) => href === "/painel" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="booqly-sidebar hidden w-[248px] shrink-0 border-r md:flex md:flex-col">
      <div className="flex h-[76px] items-center border-b px-7">
        <Logo className="text-lg" nome={nomePlataforma} />
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter((item) => premium || (item.href !== "/painel/lembrete-clientes" && item.href !== "/painel/loja"));
          if (!itens.length) return null;
          return (
            <div key={grupo.titulo} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/35">{grupo.titulo}</p>
              <div className="space-y-1">
                {itens.map((item) => (
                  <Link key={item.href} href={item.href} className={`booqly-nav-item ${ativo(item.href) ? "is-active" : ""}`}>
                    <Icon label={item.rotulo} />
                    <span>{item.rotulo}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {isAdmin && (
          <div className="mt-4 border-t pt-5">
            <Link href="/admin/pagamentos" className="booqly-nav-item text-brand"><Icon label="Admin" /><span>Painel admin</span></Link>
          </div>
        )}
      </nav>
      <div className="border-t p-5">
        <SairButton className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink/55 transition hover:bg-ink/5 hover:text-ink" />
      </div>
    </aside>
  );
}
