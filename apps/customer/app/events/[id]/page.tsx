"use client";

import { AnimatedNumber, Skeleton, TIER_META, TierBadge, cn, dayParts, fmtTime, img, money, publicApi, useSite, type TierName } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, CalendarX2, Clock, Images, MapPin, Minus, Plus, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckoutSheet, type Selection } from "@/components/CheckoutSheet";
import { StatusChip } from "@/components/EventCard";
import { Lightbox } from "@/components/Lightbox";
import { Countdown } from "@/components/NextUp";
import { isSoldOut } from "@/components/eventUtils";
import { usePoll } from "@/lib/hooks";

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { site, t } = useSite();
  const MAX_PER_TIER = site.tickets.maxPerTier;
  // refresh often: ticket availability and the live attendance number change while you look at the page
  const { data: event, loading, error } = usePoll(() => publicApi.event(id), 6000, [id]);

  const [sel, setSel] = useState<Selection>({});
  const [checkout, setCheckout] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (loading && !event) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Skeleton className="h-[22rem]" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]"><Skeleton className="h-64" /><Skeleton className="h-96" /></div>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="mx-auto grid max-w-md place-items-center px-6 py-32 text-center">
        <CalendarX2 className="h-12 w-12 text-fog-400" />
        <h1 className="mt-5 text-3xl font-extrabold">Event not found</h1>
        <p className="mt-2 text-fog-400">{error || "This event may have been removed."}</p>
        <Link href="/" className="btn btn-primary mt-8">Browse events</Link>
      </div>
    );
  }

  const d = dayParts(event.startsAt);
  const canBuy = event.status !== "past";
  const images = [event.cover, ...event.gallery].filter(Boolean);
  const count = Object.values(sel).reduce((n, q) => n + (q ?? 0), 0);
  const total = event.tiers.reduce((n, t) => n + t.price * (sel[t.name] ?? 0), 0);

  const setQty = (tier: TierName, qty: number, available: number) => {
    const q = Math.max(0, Math.min(qty, MAX_PER_TIER, available));
    setSel((s) => ({ ...s, [tier]: q }));
  };

  return (
    <>
      {/* ---------- cover ---------- */}
      <section className="relative">
        <div className="relative h-[46vh] min-h-[340px] w-full overflow-hidden">
          {event.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img(event.cover)} alt={event.title} className={cn("h-full w-full object-cover", event.status === "past" && "grayscale-[.4]")} />
          ) : (
            <div className="h-full w-full bg-brand-gradient" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/20" />
        </div>
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
            <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-black/60"><ArrowLeft className="h-4 w-4" />All events</Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">{event.category}</span>
              <StatusChip event={event} />
            </div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">{event.title}</motion.h1>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_400px]">
        {/* ---------- left ---------- */}
        <div className="min-w-0 space-y-10">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { Icon: CalendarDays, label: "Date", value: `${d.weekday}, ${d.day} ${d.month} ${d.year}` },
              { Icon: Clock, label: "Time", value: `${fmtTime(event.startsAt)} – ${fmtTime(event.endsAt)}` },
              { Icon: MapPin, label: "Venue", value: `${event.venue}${event.city ? `, ${event.city}` : ""}` },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="glass rounded-2xl p-4">
                <Icon className="h-5 w-5 text-brand-300" />
                <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-fog-500">{label}</p>
                <p className="mt-0.5 font-display text-base font-bold leading-snug">{value}</p>
              </div>
            ))}
          </div>

          {event.status === "live" && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-3xl border border-rose-400/30 p-6" style={{ background: "linear-gradient(120deg, rgba(244,63,94,.22), color-mix(in srgb, var(--color-brand-500) 16%, transparent))" }}>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-rose-200"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />{t("event.liveAttendance")}</p>
              <div className="mt-3 flex items-end gap-4">
                <p className="font-display text-6xl font-extrabold tabular-nums leading-none sm:text-7xl"><AnimatedNumber value={event.checkedIn} /></p>
                <p className="pb-2 text-fog-200"><Users className="mr-1.5 inline h-4 w-4" />{t("event.insideNow")}</p>
              </div>
            </motion.div>
          )}
          {event.status === "upcoming" && (
            <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-brand-300">{t("event.doorsOpen")}</p>
                <p className="mt-1 text-sm text-fog-400">{t("event.doorsOpenSub")}</p>
              </div>
              <Countdown iso={event.startsAt} size="lg" />
            </div>
          )}
          {event.status === "past" && (
            <div className="glass flex items-center gap-5 rounded-3xl p-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><Users className="h-6 w-6" /></span>
              <div>
                <p className="font-display text-4xl font-extrabold tabular-nums"><AnimatedNumber value={event.checkedIn} /></p>
                <p className="text-sm text-fog-400">{t("event.attended")}</p>
              </div>
            </div>
          )}

          <section>
            <h2 className="text-2xl font-bold">{t("event.about")}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-fog-300">{event.description || "More details coming soon."}</p>
          </section>

          {images.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-2xl font-bold"><Images className="h-5 w-5 text-brand-300" />{event.status === "past" ? t("event.moments") : t("event.gallery")}</h2>
              <div className="mt-4 grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-4">
                {images.slice(0, 5).map((src, i) => (
                  <motion.button
                    key={src + i}
                    type="button"
                    onClick={() => setLightbox(i)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn("group relative overflow-hidden rounded-2xl ring-1 ring-white/10", i === 0 && "col-span-2 row-span-2")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(src)} alt={`${event.title} photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    {i === 4 && images.length > 5 && (
                      <span className="absolute inset-0 grid place-items-center bg-black/60 font-display text-2xl font-bold">+{images.length - 5}</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---------- ticket picker ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass overflow-hidden rounded-[2rem]">
            <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient"><Ticket className="h-5 w-5" /></span>
              <div>
                <h2 className="font-display text-xl font-bold">{canBuy ? t("event.buyTitle") : t("event.closedTitle")}</h2>
                <p className="text-xs text-fog-400">{canBuy ? t("event.buySub") : t("event.closedSub")}</p>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {event.tiers.map((tier) => {
                const qty = sel[tier.name] ?? 0;
                const out = tier.available <= 0;
                const pct = tier.capacity ? Math.max(0, Math.min(100, (tier.available / tier.capacity) * 100)) : 0;
                const meta = TIER_META[tier.name];
                return (
                  <div key={tier.name} className={cn("rounded-2xl border p-4 transition", qty > 0 ? "bg-white/[0.07]" : "border-white/10 bg-white/[0.03]", out && "opacity-55")} style={qty > 0 ? { borderColor: meta.ring } : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <TierBadge tier={tier.name} />
                        <p className="mt-2 font-display text-2xl font-extrabold">{money(tier.price)}</p>
                        {tier.perks && <p className="mt-1 text-xs leading-snug text-fog-400">{tier.perks}</p>}
                      </div>
                      {canBuy && (
                        <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 ring-1 ring-white/10">
                          <button type="button" disabled={out || qty === 0} onClick={() => setQty(tier.name, qty - 1, tier.available)} aria-label={`Fewer ${meta.label} tickets`} className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/15 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                          <span className="w-7 text-center font-display text-lg font-bold tabular-nums">{qty}</span>
                          <button type="button" disabled={out || qty >= Math.min(MAX_PER_TIER, tier.available)} onClick={() => setQty(tier.name, qty + 1, tier.available)} aria-label={`More ${meta.label} tickets`} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                    {canBuy && (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <motion.div className="h-full rounded-full" style={{ background: meta.gradient }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                        <p className="mt-1.5 text-[0.72rem] font-semibold text-fog-400">{out ? t("status.soldOut") : tier.available <= 20 ? `Only ${tier.available} left!` : `${tier.available} available`}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {canBuy && (
              <div className="border-t border-white/10 p-5">
                <div className="mb-4 flex items-end justify-between">
                  <span className="text-sm text-fog-400">{count > 0 ? `${count} ticket${count > 1 ? "s" : ""}` : "No tickets selected"}</span>
                  <span className="font-display text-3xl font-extrabold tabular-nums"><AnimatePresence mode="popLayout" initial={false}><motion.span key={total} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="inline-block">{money(total)}</motion.span></AnimatePresence></span>
                </div>
                <button type="button" disabled={count === 0 || isSoldOut(event)} onClick={() => setCheckout(true)} className="btn btn-primary w-full py-4 text-base">
                  {isSoldOut(event) ? t("status.soldOut") : count === 0 ? t("event.selectButton") : t("event.buyButton")}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {checkout && <CheckoutSheet event={event} selection={sel} onClose={() => setCheckout(false)} />}
      </AnimatePresence>
      <Lightbox images={images} index={lightbox} onChange={setLightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
