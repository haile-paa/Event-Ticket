"use client";

import { AnimatedNumber, Skeleton, TIER_META, cn, currency, money, useSite, type TierName } from "@tikit/shared";
import { motion } from "framer-motion";
import { ArrowRight, Banknote, Clock, ScanLine, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/Shell";
import { useAdmin } from "@/lib/admin";
import { usePoll } from "@/lib/hooks";
import type { Stats } from "@/lib/types";

const TIERS: TierName[] = ["regular", "vip", "vvip"];

export default function Dashboard() {
  const { call } = useAdmin();
  const { site } = useSite();
  const { data: s, loading } = usePoll(() => call<Stats>("/api/admin/stats"), 5000);

  const cards = s
    ? [
        { label: "Revenue", value: s.revenue, Icon: Banknote, suffix: ` ${currency()}`, tint: "from-emerald-400/25" },
        { label: "Tickets sold", value: s.ticketsSold, Icon: Ticket, tint: "from-brand-500/30" },
        { label: "Pending orders", value: s.pending, Icon: Clock, tint: "from-amber-400/25", href: "/orders" },
        { label: "Checked in", value: s.checkedIn, Icon: Users, tint: "from-hot-500/25", href: "/scan" },
      ]
    : [];

  const chart = (s?.events ?? []).filter((e) => e.revenue > 0 || e.status !== "past").slice(0, 8).map((e) => ({ name: e.title.length > 14 ? e.title.slice(0, 13) + "…" : e.title, revenue: e.revenue }));
  const colors = [site.theme.primary, site.theme.secondary, site.theme.accent];

  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard">
        <Link href="/scan" className="btn btn-primary"><ScanLine className="h-4 w-4" />Open scanner</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading && !s && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        {cards.map(({ label, value, Icon, suffix, tint, href }, i) => {
          const body = (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className={cn("glass relative h-full overflow-hidden rounded-3xl p-5 transition", href && "hover:bg-white/[0.09]")}>
              <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl", tint)} />
              <Icon className="h-5 w-5 text-fog-300" />
              <p className="mt-4 font-display text-3xl font-extrabold tabular-nums sm:text-4xl">
                <AnimatedNumber value={value} />
                {suffix && <span className="ml-1 text-base font-bold text-fog-400">{suffix}</span>}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-fog-400">{label}</p>
            </motion.div>
          );
          return href ? <Link key={label} href={href}>{body}</Link> : <div key={label}>{body}</div>;
        })}
      </div>

      {s && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="glass rounded-3xl p-5">
            <h2 className="text-lg font-bold">Revenue by event</h2>
            <p className="text-xs text-fog-400">Approved orders only</p>
            <div className="mt-4 h-64">
              {chart.length === 0 || chart.every((c) => c.revenue === 0) ? (
                <p className="grid h-full place-items-center text-sm text-fog-500">No approved orders yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.07)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#8a87b3", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8a87b3", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,.05)" }} contentStyle={{ background: "#12121e", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff" }} formatter={(v) => [money(Number(v)), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[10, 10, 4, 4]}>
                      {chart.map((_, i) => <Cell key={i} fill={colors[i % 3]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="glass rounded-3xl p-5">
            <h2 className="text-lg font-bold">Orders</h2>
            <div className="mt-4 space-y-3">
              {[
                ["Approved", s.approved, "bg-emerald-400"],
                ["Pending", s.pending, "bg-amber-400"],
                ["Rejected", s.rejected, "bg-rose-400"],
              ].map(([label, n, color]) => {
                const total = Math.max(1, s.approved + s.pending + s.rejected);
                return (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-fog-300">{label}</span><b>{n as number}</b></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className={cn("h-full rounded-full", color as string)} initial={{ width: 0 }} animate={{ width: `${((n as number) / total) * 100}%` }} transition={{ duration: 0.8 }} /></div>
                  </div>
                );
              })}
            </div>
            <Link href="/orders" className="btn btn-ghost mt-6 w-full">Review orders <ArrowRight className="h-4 w-4" /></Link>
          </section>
        </div>
      )}

      {s && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Events</h2>
          <div className="space-y-3">
            {s.events.length === 0 && <p className="glass rounded-3xl p-8 text-center text-fog-400">No events yet. <Link className="font-bold text-brand-300" href="/events">Create your first event</Link>.</p>}
            {s.events.map((e) => {
              const pct = e.capacity ? Math.min(100, (e.sold / e.capacity) * 100) : 0;
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="glass block rounded-3xl p-5 transition hover:bg-white/[0.09]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider", e.status === "live" ? "bg-rose-500 text-white" : e.status === "upcoming" ? "bg-brand-500/25 text-brand-300" : "bg-white/10 text-fog-400")}>{e.status}</span>
                      <h3 className="font-display text-lg font-bold">{e.title}</h3>
                    </div>
                    <div className="flex items-center gap-5 text-sm text-fog-300">
                      {e.pending > 0 && <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-300">{e.pending} pending</span>}
                      <span><b className="text-white">{e.checkedIn}</b> in</span>
                      <b className="font-display text-white">{money(e.revenue)}</b>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-brand-gradient" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} /></div>
                    <span className="text-xs font-semibold text-fog-400">{e.sold} / {e.capacity} sold</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {TIERS.map((t) => (e.byTier[t] ? <span key={t} className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold text-ink-950" style={{ background: TIER_META[t].gradient }}>{TIER_META[t].label} · {e.byTier[t]}</span> : null))}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
