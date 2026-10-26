"use client";

import { Skeleton, cn, useSite, type EventStatus, type TikitEvent } from "@tikit/shared";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { CalendarX2, LayoutGrid, List, RefreshCw, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { EventCard } from "./EventCard";

const TAB_KEYS: EventStatus[] = ["upcoming", "live", "past"];

export function EventsExplorer({
  events,
  loading,
  error,
  reload,
}: {
  events: TikitEvent[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const { site, t } = useSite();
  const TABS = TAB_KEYS.map((key) => ({ key, label: t(`tabs.${key}`) }));
  const [tab, setTab] = useState<EventStatus>("upcoming");
  const [category, setCategory] = useState("All");
  const [view, setView] = useState<"grid" | "list">("grid");

  const counts = useMemo(() => {
    const c: Record<EventStatus, number> = { upcoming: 0, live: 0, past: 0 };
    events?.forEach((e) => (c[e.status] += 1));
    return c;
  }, [events]);

  const inTab = useMemo(() => {
    const list = (events ?? []).filter((e) => e.status === tab);
    return tab === "past" ? list.sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)) : list;
  }, [events, tab]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(inTab.map((e) => e.category)))], [inTab]);
  const shown = category === "All" ? inTab : inTab.filter((e) => e.category === category);

  const switchTab = (t: EventStatus) => {
    setTab(t);
    setCategory("All");
  };

  return (
    <section id="events" className="mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-300">{site.events.eyebrow}</p>
          <h2 className="mt-2 text-4xl font-extrabold sm:text-5xl">{site.events.title1} <span className="text-gradient">{site.events.title2}</span></h2>
        </div>
        <div className="flex items-center gap-3">
          <LayoutGroup id="tabs">
            <div className="glass flex rounded-full p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={cn("relative rounded-full px-4 py-2 text-sm font-bold transition-colors", tab === t.key ? "text-white" : "text-fog-400 hover:text-white")}
                >
                  {tab === t.key && (
                    <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-brand-gradient shadow-lg shadow-hot-500/30" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {t.key === "live" && counts.live > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />}
                    {t.label}
                    <span className="text-xs opacity-70">{counts[t.key]}</span>
                  </span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="glass hidden rounded-full p-1 sm:flex">
            {([["grid", LayoutGrid], ["list", List]] as const).map(([k, Icon]) => (
              <button key={k} onClick={() => setView(k)} aria-label={`${k} view`} className={cn("grid h-9 w-9 place-items-center rounded-full transition", view === k ? "bg-white/15 text-white" : "text-fog-400 hover:text-white")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {categories.length > 2 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition", category === c ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 text-fog-400 hover:border-white/25 hover:text-white")}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {error && !events ? (
          <div className="glass grid place-items-center rounded-3xl px-6 py-16 text-center">
            <WifiOff className="h-10 w-10 text-fog-400" />
            <p className="mt-4 font-display text-xl font-bold">We couldn&apos;t load the events</p>
            <p className="mt-1 max-w-sm text-sm text-fog-400">{error}</p>
            <button onClick={reload} className="btn btn-ghost mt-6"><RefreshCw className="h-4 w-4" />Try again</button>
          </div>
        ) : loading && !events ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[26rem]" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="glass grid place-items-center rounded-3xl px-6 py-16 text-center">
            <CalendarX2 className="h-10 w-10 text-fog-400" />
            <p className="mt-4 font-display text-xl font-bold">{t("list.empty")}</p>
            <p className="mt-1 text-sm text-fog-400">{tab === "upcoming" ? "New events are announced all the time. Check back soon." : tab === "live" ? "No event is happening right now." : "Past events will show up here."}</p>
          </div>
        ) : (
          <motion.div layout className={cn(view === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4")}>
            <AnimatePresence mode="popLayout">
              {shown.map((e, i) => (
                <EventCard key={e.id} event={e} view={view} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}
