"use client";

import { countdown, dayParts, type TikitEvent } from "@tikit/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useNow } from "@/lib/hooks";

export function Countdown({ iso, size = "md" }: { iso: string; size?: "md" | "lg" }) {
  const now = useNow(1000);
  const c = countdown(iso, now);
  const cells: [number, string][] = [
    [c.days, "days"],
    [c.hours, "hrs"],
    [c.minutes, "min"],
    [c.seconds, "sec"],
  ];
  return (
    <div className="flex gap-2">
      {cells.map(([v, label]) => (
        <div
          key={label}
          className={`rounded-xl bg-white/[0.07] text-center ring-1 ring-white/10 ${size === "lg" ? "min-w-[4.2rem] px-3 py-3" : "min-w-[3.2rem] px-2.5 py-2"}`}
        >
          <p className={`font-display font-extrabold tabular-nums leading-none ${size === "lg" ? "text-3xl" : "text-xl"}`}>{String(v).padStart(2, "0")}</p>
          <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-widest text-fog-400">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** "Next up" teaser under the hero headline. */
export function NextUp({ events }: { events: TikitEvent[] }) {
  const next = events.filter((e) => e.status === "upcoming").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  if (!next) return null;
  const d = dayParts(next.startsAt);
  return (
    <Link href={`/events/${next.id}`} className="glass group flex max-w-md flex-wrap items-center gap-4 rounded-3xl p-4 transition hover:bg-white/[0.09]">
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-brand-300">Next up · {d.day} {d.month}</p>
        <p className="mt-1 truncate font-display text-lg font-bold">{next.title}</p>
        <div className="mt-3"><Countdown iso={next.startsAt} /></div>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition group-hover:bg-brand-gradient">
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
