"use client";

import { Logo } from "@tikit/shared";
import { ArrowLeftRight } from "lucide-react";
import { useAdmin } from "@/lib/admin";

export function Shell({ children }: { children: React.ReactNode }) {
  const { client, logout } = useAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/[0.07] bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
        <Logo size={30} subtitle="Developer Studio" className="[&_span:first-child]:!text-lg" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden min-w-0 truncate rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-fog-300 ring-1 ring-white/10 sm:block">
            Editing: <b className="text-white">{client.name}</b> <span className="text-fog-500">· {client.url.replace(/^https?:\/\//, "")}</span>
          </span>
          <button onClick={logout} className="btn btn-ghost !px-4 !py-2 !text-xs"><ArrowLeftRight className="h-3.5 w-3.5" />Switch client</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
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
