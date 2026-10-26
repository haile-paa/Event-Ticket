"use client";

import { AnimatedNumber, Skeleton, TIER_META, TierBadge, cn, fmtTime, type TierName } from "@tikit/shared";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Phone, ScanLine, Search, Undo2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAdmin } from "@/lib/admin";
import { usePoll } from "@/lib/hooks";
import type { AttendeesResponse, CheckinResponse } from "@/lib/types";

type Filter = "all" | "in" | "waiting";
const TIERS: TierName[] = ["regular", "vip", "vvip"];

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { call, toast } = useAdmin();
  const { data, loading, error, reload } = usePoll(() => call<AttendeesResponse>(`/api/admin/events/${id}/attendees`), 4000, [id]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tier, setTier] = useState<TierName | "all">("all");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.tickets ?? []).filter((t) => {
      if (filter === "in" && !t.checkedIn) return false;
      if (filter === "waiting" && t.checkedIn) return false;
      if (tier !== "all" && t.tier !== tier) return false;
      return !n || t.name.toLowerCase().includes(n) || t.phone.includes(n) || t.orderCode.toLowerCase().includes(n);
    });
  }, [data, q, filter, tier]);

  if (loading && !data) return <Skeleton className="h-96" />;
  if (!data) return <p className="glass rounded-3xl p-10 text-center text-rose-200">{error || "Event not found"}</p>;

  const { event } = data;
  const inside = data.checkedIn;
  const pct = data.total ? Math.min(100, (inside / data.total) * 100) : 0;
  const byTier = TIERS.map((t) => ({ t, total: data.tickets.filter((x) => x.tier === t).length, in: data.tickets.filter((x) => x.tier === t && x.checkedIn).length }));

  const checkIn = async (token: string) => {
    try {
      const r = await call<CheckinResponse>("/api/admin/checkin", { method: "POST", body: JSON.stringify({ token, eventId: id }) });
      toast(r.message, r.result === "accepted" ? "ok" : "err");
      reload();
    } catch {
      toast("Could not check in", "err");
    }
  };
  const undo = async (ticketId: string) => {
    try {
      await call(`/api/admin/tickets/${ticketId}/undo`, { method: "POST" });
      toast("Check-in undone");
      reload();
    } catch {
      toast("Could not undo", "err");
    }
  };

  return (
    <>
      <Link href="/events" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fog-400 hover:text-white"><ArrowLeft className="h-4 w-4" />All events</Link>

      <section className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider", event.status === "live" ? "bg-rose-500" : "bg-white/10 text-fog-300")}>
              {event.status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{event.status}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{event.title}</h1>
            <p className="mt-1 text-sm text-fog-400">{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)} · {event.venue}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-7xl font-extrabold tabular-nums leading-none sm:text-8xl"><AnimatedNumber value={inside} /></p>
            <p className="mt-2 text-sm font-semibold text-fog-300">checked in · of {data.total} tickets</p>
          </div>
        </div>
        <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-brand-gradient" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {byTier.map(({ t, total, in: n }) => (
            <div key={t} className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
              <TierBadge tier={t} />
              <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{n}<span className="text-base text-fog-500"> / {total}</span></p>
            </div>
          ))}
        </div>
        <Link href="/scan" className="btn btn-primary relative mt-6"><ScanLine className="h-4 w-4" />Scan tickets</Link>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
          <input className="field !rounded-full pl-10" placeholder="Search name, phone, order…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="glass flex rounded-full p-1">
            {([["all", "All"], ["in", "Inside"], ["waiting", "Not yet"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold transition", filter === k ? "bg-white/15 text-white" : "text-fog-400 hover:text-white")}>{l}</button>
            ))}
          </div>
          <select className="field !w-auto !rounded-full !py-2" value={tier} onChange={(e) => setTier(e.target.value as TierName | "all")} aria-label="Filter by ticket type">
            <option value="all" className="bg-ink-800">All types</option>
            {TIERS.map((t) => <option key={t} value={t} className="bg-ink-800">{TIER_META[t].label}</option>)}
          </select>
        </div>
      </div>

      <div className="glass mt-4 overflow-hidden rounded-3xl">
        {list.length === 0 ? (
          <p className="p-10 text-center text-fog-400">{data.total === 0 ? "No tickets have been issued for this event yet." : "No one matches."}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", t.checkedIn ? "bg-emerald-400 text-ink-950" : "bg-white/10 text-fog-500")}>{t.checkedIn ? <Check className="h-5 w-5" strokeWidth={3} /> : <UserCheck className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{t.name}</p>
                  <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-white"><Phone className="h-3.5 w-3.5" />{t.phone}</a>
                </div>
                <TierBadge tier={t.tier} />
                <span className="w-16 text-sm text-fog-400">#{t.seq}/{t.ofTotal}</span>
                <span className="font-mono text-xs text-fog-500">{t.orderCode}</span>
                {t.checkedIn ? (
                  <button onClick={() => undo(t.id)} className="btn btn-ghost !px-3.5 !py-2 text-xs"><Undo2 className="h-3.5 w-3.5" />{t.checkedInAt ? fmtTime(t.checkedInAt) : "Undo"}</button>
                ) : (
                  <button onClick={() => checkIn(t.token)} className="btn btn-success !px-3.5 !py-2 text-xs"><Check className="h-3.5 w-3.5" strokeWidth={3} />Check in</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
