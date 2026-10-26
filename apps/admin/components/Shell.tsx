"use client";

import { AnimatedNumber, Logo, cn, useSite } from "@tikit/shared";
import { motion } from "framer-motion";
import { CalendarRange, LayoutDashboard, LogOut, ReceiptText, ScanLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdmin } from "@/lib/admin";
import { beep, usePoll } from "@/lib/hooks";
import type { Stats } from "@/lib/types";
import { useEffect, useRef } from "react";

const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/orders", label: "Orders", Icon: ReceiptText, badge: true },
  { href: "/events", label: "Events", Icon: CalendarRange },
  { href: "/scan", label: "Scanner", Icon: ScanLine },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { call, logout } = useAdmin();
  const { site } = useSite();
  const { data: stats } = usePoll(() => call<Stats>("/api/admin/stats"), 6000);
  const pending = stats?.pending ?? 0;

  // a soft ping when a new order arrives
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (stats == null) return;
    if (prev.current !== null && stats.pending > prev.current) beep("ping");
    prev.current = stats.pending;
  }, [stats]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/[0.07] bg-ink-900/60 p-5 backdrop-blur-xl lg:flex">
        <Link href="/" className="px-2 pt-1">
          <Logo size={36} subtitle={site.brand.adminSubtitle} />
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, Icon, badge }) => (
            <Link key={href} href={href} className={cn("relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors", active(href) ? "text-white" : "text-fog-400 hover:text-white")}>
              {active(href) && <motion.span layoutId="side-pill" className="absolute inset-0 -z-10 rounded-2xl bg-white/[0.09] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon className="h-[1.15rem] w-[1.15rem]" />
              {label}
              {badge && pending > 0 && (
                <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1.5 text-xs font-extrabold text-ink-950">
                  <AnimatedNumber value={pending} />
                </span>
              )}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-fog-400 transition hover:bg-white/[0.06] hover:text-white">
          <LogOut className="h-[1.15rem] w-[1.15rem]" />
          Lock console
        </button>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        {/* top bar (mobile) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.07] bg-ink-950/80 px-4 backdrop-blur-xl lg:hidden">
          <Logo size={28} subtitle={site.brand.adminSubtitle} className="[&_span:first-child]:!text-lg" />
          <button onClick={logout} aria-label="Lock console" className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      </div>

      {/* bottom tabs (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/[0.08] bg-ink-950/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, label, Icon, badge }) => (
          <Link key={href} href={href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-bold", active(href) ? "text-white" : "text-fog-500")}>
            <span className="relative">
              <Icon className="h-5 w-5" />
              {badge && pending > 0 && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[0.6rem] font-extrabold text-ink-950">{pending}</span>}
            </span>
            {label}
            {active(href) && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-gradient" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-300">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
