"use client";

import { AnimatedNumber, img, useSite, type TikitEvent } from "@tikit/shared";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";

/** Shows every event that is happening right now, with the live number of people inside. */
export function LiveBanner({ events }: { events: TikitEvent[] }) {
  const { t } = useSite();
  const live = events.filter((e) => e.status === "live");
  if (live.length === 0) return null;
  return (
    <section className="mx-auto mb-16 max-w-6xl px-4 sm:px-6">
      <div className="space-y-4">
        {live.map((e) => (
          <motion.div key={e.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link
              href={`/events/${e.id}`}
              className="group relative flex flex-col gap-5 overflow-hidden rounded-[1.75rem] border border-rose-400/30 p-5 sm:flex-row sm:items-center sm:p-6"
              style={{ background: "linear-gradient(110deg, rgba(244,63,94,.22), color-mix(in srgb, var(--color-brand-500) 18%, transparent) 60%, color-mix(in srgb, var(--color-sun-500) 12%, transparent))" }}
            >
              {e.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img(e.cover)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20 blur-sm" />
              )}
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-white" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  {t("live.banner")}
                </span>
                <h3 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{e.title}</h3>
                <p className="mt-1 text-fog-300">{e.venue}, {e.city}</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="rounded-2xl bg-black/35 px-6 py-4 text-center ring-1 ring-white/10 backdrop-blur">
                  <p className="font-display text-5xl font-extrabold tabular-nums leading-none"><AnimatedNumber value={e.checkedIn} /></p>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-fog-300"><Users className="h-3.5 w-3.5" />{t("live.attending")}</p>
                </div>
                <span className="btn btn-primary hidden sm:inline-flex">{t("event.buyButton")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
