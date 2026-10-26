"use client";

import { ApiError, Skeleton, Spinner, TIER_META, TierBadge, cn, fmtDateTime, img, money, type TierName, type TikitEvent } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Pencil, Play, Radio, RotateCcw, Square, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GalleryField, ImageField } from "@/components/ImageUpload";
import { PageHeader } from "@/components/Shell";
import { useAdmin } from "@/lib/admin";
import { usePoll } from "@/lib/hooks";

const CATEGORIES = ["Music", "Party", "Festival", "Comedy", "Conference", "Sports", "Theatre", "Other"];
const TIERS: TierName[] = ["regular", "vip", "vvip"];

interface TierDraft {
  on: boolean;
  price: string;
  capacity: string;
  perks: string;
}
interface Draft {
  title: string;
  description: string;
  category: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
  cover: string;
  gallery: string[];
  tiers: Record<TierName, TierDraft>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function emptyDraft(): Draft {
  const start = new Date(Date.now() + 7 * 864e5);
  start.setHours(19, 0, 0, 0);
  const end = new Date(start.getTime() + 5 * 36e5);
  return {
    title: "", description: "", category: "Music", venue: "", city: "Addis Ababa",
    startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(end.toISOString()),
    cover: "", gallery: [],
    tiers: {
      regular: { on: true, price: "500", capacity: "300", perks: "General entry" },
      vip: { on: true, price: "1500", capacity: "80", perks: "Front zone + welcome drink" },
      vvip: { on: false, price: "4000", capacity: "20", perks: "Private lounge + table service" },
    },
  };
}

function toDraft(e: TikitEvent): Draft {
  const d = emptyDraft();
  d.tiers = { regular: { ...d.tiers.regular, on: false }, vip: { ...d.tiers.vip, on: false }, vvip: { ...d.tiers.vvip, on: false } };
  e.tiers.forEach((t) => {
    d.tiers[t.name] = { on: true, price: String(t.price), capacity: String(t.capacity), perks: t.perks };
  });
  return { ...d, title: e.title, description: e.description, category: e.category, venue: e.venue, city: e.city, startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), cover: e.cover, gallery: e.gallery };
}

export default function EventsPage() {
  const { call, toast } = useAdmin();
  const { data: events, loading, reload } = usePoll(() => call<TikitEvent[]>("/api/admin/events"), 8000);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);

  const sorted = [...(events ?? [])].sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  const setStatus = async (e: TikitEvent, status: "live" | "ended" | "auto") => {
    try {
      await call(`/api/admin/events/${e.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast(status === "live" ? `${e.title} is now live` : status === "ended" ? `${e.title} has ended` : "Back to automatic timing");
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update", "err");
    }
  };

  const remove = async (e: TikitEvent) => {
    if (!confirm(`Delete “${e.title}”? This can't be undone.`)) return;
    try {
      await call(`/api/admin/events/${e.id}`, { method: "DELETE" });
      toast("Event deleted");
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete", "err");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Events">
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, draft: emptyDraft() })}><CalendarPlus className="h-4 w-4" />New event</button>
      </PageHeader>

      {loading && !events && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64" />)}</div>}
      {events && sorted.length === 0 && (
        <div className="glass rounded-3xl p-14 text-center">
          <p className="font-display text-xl font-bold">No events yet</p>
          <p className="mt-1 text-sm text-fog-400">Create your first event and it appears on the customer website instantly.</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {sorted.map((e) => (
          <motion.article layout key={e.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass overflow-hidden rounded-3xl">
            <div className="relative h-40 bg-brand-gradient">
              {e.cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img(e.cover)} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
              <span className={cn("absolute left-4 top-4 rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider", e.status === "live" ? "bg-rose-500" : e.status === "upcoming" ? "bg-black/60 backdrop-blur" : "bg-black/60 text-fog-300 backdrop-blur")}>
                {e.status === "live" && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                {e.status}{e.override && " · manual"}
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-display text-xl font-bold">{e.title}</h3>
              <p className="mt-1 text-sm text-fog-400">{fmtDateTime(e.startsAt)} · {e.venue}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.tiers.map((t) => (
                  <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-xs font-semibold text-fog-300">
                    <TierBadge tier={t.name} className="!py-0.5" />{money(t.price)} · {t.available}/{t.capacity}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setEditing({ id: e.id, draft: toDraft(e) })}><Pencil className="h-3.5 w-3.5" />Edit</button>
                <Link href={`/events/${e.id}`} className="btn btn-ghost !px-4 !py-2.5 text-sm"><Users className="h-3.5 w-3.5" />Attendance · {e.checkedIn}</Link>
                {e.status !== "live" && <button className="btn btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus(e, "live")}><Play className="h-3.5 w-3.5" />Go live</button>}
                {e.status === "live" && <button className="btn btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus(e, "ended")}><Square className="h-3.5 w-3.5" />End event</button>}
                {e.override && <button className="btn btn-ghost !px-4 !py-2.5 text-sm" onClick={() => setStatus(e, "auto")}><RotateCcw className="h-3.5 w-3.5" />Auto</button>}
                <button className="btn btn-danger ml-auto !px-3 !py-2.5" aria-label="Delete event" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <EventForm
            id={editing.id}
            initial={editing.draft}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function EventForm({ id, initial, onClose, onSaved }: { id: string | null; initial: Draft; onClose: () => void; onSaved: () => void }) {
  const { call, toast } = useAdmin();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setTier = (t: TierName, patch: Partial<TierDraft>) => setD((p) => ({ ...p, tiers: { ...p.tiers, [t]: { ...p.tiers[t], ...patch } } }));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const save = async () => {
    setErr("");
    const tiers = TIERS.filter((t) => d.tiers[t].on).map((t) => ({
      name: t,
      price: Math.round(Number(d.tiers[t].price)),
      capacity: Math.round(Number(d.tiers[t].capacity)),
      perks: d.tiers[t].perks,
    }));
    if (!d.title.trim()) return setErr("Give the event a title.");
    if (!d.venue.trim()) return setErr("Add the venue.");
    if (!d.startsAt || !d.endsAt || new Date(d.endsAt) <= new Date(d.startsAt)) return setErr("The end time must be after the start time.");
    if (tiers.length === 0) return setErr("Turn on at least one ticket type.");
    if (tiers.some((t) => !Number.isFinite(t.price) || t.price < 0 || !Number.isFinite(t.capacity) || t.capacity < 0)) return setErr("Check the ticket prices and capacities.");
    setBusy(true);
    try {
      const body = JSON.stringify({
        title: d.title, description: d.description, category: d.category, venue: d.venue, city: d.city,
        startsAt: new Date(d.startsAt).toISOString(), endsAt: new Date(d.endsAt).toISOString(),
        cover: d.cover, gallery: d.gallery, tiers,
      });
      await call(id ? `/api/admin/events/${id}` : "/api/admin/events", { method: id ? "PUT" : "POST", body });
      toast(id ? "Event saved" : "Event created. It's live on the website.");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-ink-850 shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-xl font-extrabold">{id ? "Edit event" : "New event"}</h2>
          <button onClick={() => !busy && onClose()} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Title</label><input className="field" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Addis Neon Nights" /></div>
            <div><label className="label">Category</label>
              <select className="field" value={d.category} onChange={(e) => set("category", e.target.value)}>
                {[...new Set([d.category, ...CATEGORIES])].map((c) => <option key={c} value={c} className="bg-ink-800">{c}</option>)}
              </select>
            </div>
            <div><label className="label">City</label><input className="field" value={d.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Venue</label><input className="field" value={d.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Skyline Terrace" /></div>
            <div><label className="label">Starts</label><input type="datetime-local" className="field" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></div>
            <div><label className="label">Ends</label><input type="datetime-local" className="field" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={4} className="field resize-y" value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell people what to expect…" /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
            <ImageField label="Cover image" value={d.cover} onChange={(v) => set("cover", v)} hint="Wide photo or poster, shown on cards and the event page." />
            <GalleryField label="Gallery" value={d.gallery} onChange={(v) => set("gallery", v)} />
          </div>

          <div>
            <span className="label">Ticket types</span>
            <div className="space-y-3">
              {TIERS.map((t) => {
                const x = d.tiers[t];
                return (
                  <div key={t} className={cn("rounded-2xl border p-4 transition", x.on ? "border-white/20 bg-white/[0.05]" : "border-white/10 opacity-60")}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={x.on} onChange={(e) => setTier(t, { on: e.target.checked })} className="h-5 w-5 accent-[var(--color-brand-500)]" />
                      <span className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-ink-950" style={{ background: TIER_META[t].gradient }}>{TIER_META[t].label}</span>
                    </label>
                    {x.on && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                        <div><label className="label">Price</label><input inputMode="numeric" className="field" value={x.price} onChange={(e) => setTier(t, { price: e.target.value.replace(/\D/g, "") })} /></div>
                        <div><label className="label">Tickets</label><input inputMode="numeric" className="field" value={x.capacity} onChange={(e) => setTier(t, { capacity: e.target.value.replace(/\D/g, "") })} /></div>
                        <div><label className="label">What&apos;s included</label><input className="field" value={x.perks} onChange={(e) => setTier(t, { perks: e.target.value })} /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {id && <p className="mt-2 text-xs text-fog-500">Changing &quot;Tickets&quot; keeps tickets already sold: availability is recalculated.</p>}
          </div>

          {err && <p role="alert" className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/30">{err}</p>}
        </div>

        <div className="flex gap-3 border-t border-white/[0.07] px-6 py-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary flex-1 py-4" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <><Radio className="h-4 w-4" />{id ? "Save changes" : "Publish event"}</>}</button>
        </div>
      </motion.div>
    </div>
  );
}
