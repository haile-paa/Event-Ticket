"use client";

import { Logo, SitePreview, TIER_META, TicketCard, cn, img, money, useSite, type SiteConfig, type Ticket } from "@tikit/shared";
import { ArrowRight, CalendarDays, MapPin, Sparkles, Zap } from "lucide-react";

const DEMO_TICKET: Ticket = {
  id: "demo", token: "demo7h2qmxk4", orderId: "o", orderCode: "TK-7H2QMX", eventId: "e", eventTitle: "Addis Neon Nights",
  name: "Abebe Kebede", phone: "0911234567", tier: "vip", price: 2000, seq: 1, ofTotal: 2, checkedIn: false, checkedInAt: null, createdAt: "",
};
const DEMO_EVENT = { id: "e", title: "Addis Neon Nights", cover: "", venue: "Skyline Terrace", city: "Addis Ababa", startsAt: new Date(Date.now() + 9 * 864e5).toISOString(), endsAt: new Date(Date.now() + 10 * 864e5).toISOString(), status: "upcoming" as const };

function Inner() {
  const { site, t } = useSite();
  const h = site.hero;
  const marquee = site.marquee.filter(Boolean);
  const d = new Date(DEMO_EVENT.startsAt);

  return (
    <div className="bg-ink-950 text-fog-100">
      {/* nav */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-5">
        <Logo size={28} className="[&_span:first-child]:!text-lg" />
        <div className="hidden gap-4 text-xs font-semibold text-fog-400 sm:flex"><span className="text-white">{t("nav.events")}</span><span>{t("nav.tickets")}</span></div>
      </div>

      {/* hero */}
      <div className="relative overflow-hidden px-5 pb-8 pt-8">
        <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-hot-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 sm:grid-cols-[1.1fr_1fr]">
          <div>
            {h.badge && <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-fog-200"><Sparkles className="h-3 w-3 text-sun-400" />{h.badge}</span>}
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.05] sm:text-4xl">{h.line1}<br /><span className="text-gradient">{h.line2}</span></h1>
            <p className="mt-3 text-sm leading-relaxed text-fog-300">{h.subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="btn btn-primary !px-5 !py-3 !text-sm">{h.ctaPrimary}<ArrowRight className="h-4 w-4" /></span>
              {h.ctaSecondary && <span className="btn btn-ghost !px-5 !py-3 !text-sm">{h.ctaSecondary}</span>}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[16rem]">
            {h.show3D ? (
              <div className="relative aspect-[1.65] rotate-[-6deg] overflow-hidden rounded-2xl p-4 shadow-2xl" style={{ background: "linear-gradient(135deg, var(--color-brand-500), var(--color-hot-500) 55%, var(--color-sun-500))" }}>
                <p className="font-display text-2xl font-extrabold leading-[0.95] text-ink-950">{h.ticketLine1}<br />{h.ticketLine2}</p>
                <p className="mt-2 text-[0.55rem] font-bold tracking-widest text-ink-950/70">{h.ticketSub}</p>
                <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink-950" />
                <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink-950" />
                <span className="absolute inset-y-3 right-[28%] border-l-2 border-dashed border-ink-950/40" />
              </div>
            ) : h.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img(h.imageUrl)} alt="" className="aspect-[1.2] w-full rounded-2xl object-cover ring-1 ring-white/15" />
            ) : (
              <div className="grid aspect-[1.2] place-items-center rounded-2xl border border-dashed border-white/20 text-xs text-fog-500">Hero image</div>
            )}
          </div>
        </div>
      </div>

      {marquee.length > 0 && (
        <div className="overflow-hidden border-y border-white/[0.07] bg-white/[0.02] py-2.5">
          <div className="flex w-max gap-6 whitespace-nowrap px-4">
            {marquee.slice(0, 6).map((m, i) => (
              <span key={i} className="flex items-center gap-6 font-display text-sm font-bold uppercase text-fog-500">{m}<Zap className="h-3.5 w-3.5 text-brand-400" /></span>
            ))}
          </div>
        </div>
      )}

      {/* event card + tiers */}
      <div className="px-5 py-8">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-brand-300">{site.events.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-extrabold">{site.events.title1} <span className="text-gradient">{site.events.title2}</span></h2>
        <div className="glass mt-4 max-w-xs overflow-hidden rounded-3xl">
          <div className="relative h-28 bg-brand-gradient">
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
            <div className="absolute left-3 top-3 rounded-xl bg-black/55 px-2.5 py-1.5 text-center ring-1 ring-white/15"><p className="font-display text-lg font-extrabold leading-none">{String(d.getDate()).padStart(2, "0")}</p><p className="text-[0.55rem] font-bold tracking-[0.2em] text-brand-300">{d.toLocaleString("en", { month: "short" }).toUpperCase()}</p></div>
            <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-[0.6rem] font-extrabold uppercase text-ink-950">{t("status.almostGone")}</span>
          </div>
          <div className="p-4">
            <h3 className="font-display text-lg font-bold">{DEMO_EVENT.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fog-400"><CalendarDays className="h-3 w-3" />Saturday, 7:00 PM</p>
            <p className="flex items-center gap-1.5 text-xs text-fog-400"><MapPin className="h-3 w-3" />{DEMO_EVENT.venue}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["regular", "vip", "vvip"] as const).map((k) => (
                <span key={k} className="rounded-full px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase text-ink-950" style={{ background: TIER_META[k].gradient }}>{TIER_META[k].label}</span>
              ))}
            </div>
            <p className="mt-3 text-sm text-fog-400">from <b className="font-display text-base text-white">{money(800)}</b></p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="btn btn-primary !px-4 !py-2.5 !text-xs">{t("event.buyButton")}</span>
          <span className="btn btn-ghost !px-4 !py-2.5 !text-xs">{t("checkout.continue")}</span>
          <span className="btn btn-success !px-4 !py-2.5 !text-xs">{t("status.live")}</span>
        </div>
      </div>

      {/* receipt */}
      <div className="px-5 pb-8">
        <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-fog-500">Digital receipt</p>
        <TicketCard ticket={{ ...DEMO_TICKET, eventTitle: DEMO_EVENT.title }} event={DEMO_EVENT} />
      </div>

      {/* footer */}
      <div className="border-t border-white/[0.06] px-5 py-5 text-center text-xs text-fog-500">
        {site.footer.text && <p>{site.footer.text}</p>}
        <p className="mt-1">{site.footer.copyright || `© ${new Date().getFullYear()} ${site.brand.name}`}</p>
      </div>
    </div>
  );
}

export function Preview({ config, device }: { config: SiteConfig; device: "desktop" | "mobile" }) {
  return (
    <div className={cn("mx-auto overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl transition-all duration-500", device === "mobile" ? "max-w-[390px]" : "max-w-full")}>
      <SitePreview config={config} className="font-sans [font-family:var(--font-sans)]">
        <Inner />
      </SitePreview>
    </div>
  );
}
