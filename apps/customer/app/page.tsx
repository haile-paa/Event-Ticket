"use client";

import { img, publicApi, useSite } from "@tikit/shared";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, ScanLine, Smartphone, Sparkles, Star, Ticket, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { EventsExplorer } from "@/components/EventsExplorer";
import { LiveBanner } from "@/components/LiveBanner";
import { NextUp } from "@/components/NextUp";
import { usePoll } from "@/lib/hooks";

// Three.js only runs in the browser
const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const STEP_ICONS = [Ticket, Smartphone, QrCode, ScanLine, Star, Sparkles, Zap, Ticket];

export default function Home() {
  const { site } = useSite();
  const { data: events, loading, error, reload } = usePoll(() => publicApi.events(), 12000);
  const h = site.hero;
  const sceneColors = useMemo<[string, string, string]>(
    () => [site.theme.primary, site.theme.secondary, site.theme.accent],
    [site.theme.primary, site.theme.secondary, site.theme.accent],
  );
  const marquee = site.marquee.filter(Boolean);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-16 pt-10 sm:px-6 lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr] lg:pt-4">
        <div className="relative z-10">
          {h.badge && (
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fog-200">
              <Sparkles className="h-3.5 w-3.5 text-sun-400" /> {h.badge}
            </motion.span>
          )}
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.6 }} className="mt-6 text-[2.9rem] font-extrabold leading-[1.02] sm:text-7xl">
            {h.line1}
            <br />
            <span className="text-gradient">{h.line2}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }} className="mt-6 max-w-md text-lg leading-relaxed text-fog-300">
            {h.subtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }} className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#events" className="btn btn-primary px-7 py-4 text-base">
              {h.ctaPrimary} <ArrowRight className="h-4 w-4" />
            </a>
            {h.ctaSecondary && (
              <Link href="/tickets" className="btn btn-ghost px-7 py-4 text-base">
                {h.ctaSecondary}
              </Link>
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10">
            <NextUp events={events ?? []} />
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.8 }} className="relative h-[360px] sm:h-[460px] lg:h-[560px]">
          <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-brand-600/40 via-hot-500/25 to-sun-500/20 blur-3xl" />
          {h.show3D ? (
            <HeroScene colors={sceneColors} line1={h.ticketLine1} line2={h.ticketLine2} sub={h.ticketSub} />
          ) : h.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img(h.imageUrl)} alt="" className="relative h-full w-full rounded-[2rem] object-cover ring-1 ring-white/15" />
          ) : null}
        </motion.div>
      </section>

      {/* ---------- marquee ---------- */}
      {marquee.length > 0 && (
        <div className="relative mb-20 overflow-hidden border-y border-white/[0.07] bg-white/[0.02] py-4">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
            {[...marquee, ...marquee, ...marquee, ...marquee].map((m, i) => (
              <span key={i} className="flex items-center gap-10 font-display text-2xl font-bold uppercase tracking-wide text-fog-500">
                {m}
                <Zap className="h-5 w-5 text-brand-400" />
              </span>
            ))}
          </div>
        </div>
      )}

      {events && <LiveBanner events={events} />}

      <EventsExplorer events={events} loading={loading} error={error} reload={reload} />

      {/* ---------- how it works ---------- */}
      {site.howItWorks.show && (
        <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-300">{site.howItWorks.eyebrow}</p>
          <h2 className="mt-2 max-w-xl text-4xl font-extrabold sm:text-5xl">
            {site.howItWorks.title1} <span className="text-gradient">{site.howItWorks.title2}</span>
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {site.howItWorks.steps.map(({ title, text }, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * 0.08 }} className="glass group relative overflow-hidden rounded-3xl p-6 transition hover:-translate-y-1 hover:bg-white/[0.08]">
                  <span className="absolute right-5 top-4 font-display text-6xl font-extrabold text-white/[0.05]">{i + 1}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gradient shadow-lg shadow-hot-500/25">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fog-400">{text}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
