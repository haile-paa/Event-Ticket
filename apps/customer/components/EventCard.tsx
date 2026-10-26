"use client";

import { AnimatedNumber, cn, dayParts, fmtTime, img, money, useSite, type TikitEvent } from "@tikit/shared";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { isFewLeft, isSoldOut, minPrice } from "./eventUtils";

export function StatusChip({ event }: { event: TikitEvent }) {
  const { t } = useSite();
  if (event.status === "live")
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white shadow-lg shadow-rose-500/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-white" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {t("status.live")}
      </span>
    );
  if (event.status === "past")
    return <span className="rounded-full bg-black/60 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-fog-300 backdrop-blur">{t("status.ended")}</span>;
  if (isSoldOut(event))
    return <span className="rounded-full bg-black/70 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white backdrop-blur">{t("status.soldOut")}</span>;
  if (isFewLeft(event))
    return <span className="rounded-full bg-amber-400 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-ink-950">{t("status.almostGone")}</span>;
  return null;
}

function Cover({ event, className }: { event: TikitEvent; className?: string }) {
  return event.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img(event.cover)}
      alt={event.title}
      loading="lazy"
      className={cn("h-full w-full object-cover transition duration-700 group-hover:scale-110", event.status === "past" && "grayscale-[.65] group-hover:grayscale-0", className)}
    />
  ) : (
    <div className="h-full w-full bg-brand-gradient" />
  );
}

export function EventCard({ event, view, index }: { event: TikitEvent; view: "grid" | "list"; index: number }) {
  const { t } = useSite();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 220, damping: 22 });
  const gx = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const gy = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(380px circle at ${gx}% ${gy}%, rgba(255,255,255,0.16), transparent 45%)`;

  const d = dayParts(event.startsAt);
  const price = minPrice(event);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      >
        <Link href={`/events/${event.id}`} className="group glass flex items-stretch gap-4 overflow-hidden rounded-3xl p-3 transition hover:bg-white/[0.08] sm:gap-6">
          <div className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-2xl sm:w-52">
            <Cover event={event} />
            <div className="absolute left-2 top-2"><StatusChip event={event} /></div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-300">{d.weekday} · {d.day} {d.month} · {fmtTime(event.startsAt)}</p>
            <h3 className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">{event.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-fog-400"><MapPin className="h-3.5 w-3.5 shrink-0" />{event.venue}, {event.city}</p>
          </div>
          <div className="hidden flex-col items-end justify-center gap-2 pr-3 sm:flex">
            {event.status === "past" ? (
              <span className="flex items-center gap-1.5 text-sm text-fog-300"><Users className="h-4 w-4" />{event.checkedIn.toLocaleString("en-US")} {t("list.attended")}</span>
            ) : (
              <span className="text-sm text-fog-400">from <b className="font-display text-lg text-white">{money(price)}</b></span>
            )}
            <ArrowUpRight className="h-5 w-5 text-fog-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className="relative will-change-transform"
    >
      <Link href={`/events/${event.id}`} className="group glass relative block overflow-hidden rounded-[1.75rem] transition-shadow hover:shadow-[0_30px_80px_-30px_color-mix(in_srgb,var(--color-brand-500)_60%,transparent)]">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Cover event={event} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-col items-center rounded-2xl bg-black/55 px-3 py-2 text-center backdrop-blur-md ring-1 ring-white/15">
            <span className="font-display text-2xl font-extrabold leading-none">{d.day}</span>
            <span className="mt-0.5 text-[0.65rem] font-bold tracking-[0.2em] text-brand-300">{d.month}</span>
          </div>
          <div className="absolute right-4 top-4"><StatusChip event={event} /></div>
          <span className="absolute bottom-4 left-4 rounded-full bg-white/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">{event.category}</span>
        </div>
        <div className="p-5 pt-4">
          <h3 className="line-clamp-1 font-display text-[1.35rem] font-bold">{event.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-fog-400">
            <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{d.weekday}, {fmtTime(event.startsAt)}</p>
            <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{event.venue}, {event.city}</span></p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            {event.status === "past" ? (
              <span className="flex items-center gap-2 text-sm text-fog-300"><Users className="h-4 w-4" /><AnimatedNumber value={event.checkedIn} /> {t("list.attended")}</span>
            ) : event.status === "live" ? (
              <span className="flex items-center gap-2 text-sm text-fog-300"><Users className="h-4 w-4 text-rose-300" /><b className="text-white"><AnimatedNumber value={event.checkedIn} /></b> {t("list.inside")}</span>
            ) : (
              <span className="text-sm text-fog-400">from <b className="font-display text-lg text-white">{money(price)}</b></span>
            )}
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition group-hover:bg-brand-gradient">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
      </Link>
    </motion.div>
  );
}
