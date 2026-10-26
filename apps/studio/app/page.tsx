"use client";

import {
  ApiError, COPY_DEFAULTS, COPY_ITEMS, DEFAULT_SITE, FONT_CHOICES, PRESETS, Spinner, api, cn, isHex, mergeSite,
  type PayMethod, type SiteConfig, type TierName,
} from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2, Download, KeyRound, Landmark, LayoutTemplate, Monitor, Palette, RotateCcw, Save, Search, ShieldCheck,
  Smartphone, Tags, Ticket, Type, Upload, Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageField } from "@/components/ImageUpload";
import { Preview } from "@/components/Preview";
import { PageHeader } from "@/components/Shell";
import { useAdmin } from "@/lib/admin";

type TabKey = "brand" | "colors" | "home" | "texts" | "tickets" | "payments" | "security" | "backup";
const TABS: { key: TabKey; label: string; Icon: typeof Palette }[] = [
  { key: "brand", label: "Brand", Icon: Building2 },
  { key: "colors", label: "Colors & fonts", Icon: Palette },
  { key: "home", label: "Homepage", Icon: LayoutTemplate },
  { key: "texts", label: "All texts", Icon: Type },
  { key: "tickets", label: "Tickets", Icon: Ticket },
  { key: "payments", label: "Payments", Icon: Landmark },
  { key: "security", label: "Security", Icon: ShieldCheck },
  { key: "backup", label: "Client packs", Icon: Tags },
];
const TIERS: TierName[] = ["regular", "vip", "vvip"];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ----------------------------- small controls ----------------------------- */

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-fog-400">{hint}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Text({ label, value, onChange, placeholder, long, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; long?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {long ? <textarea rows={3} className="field resize-y" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <p className="mt-1.5 text-xs text-fog-500">{hint}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.07]">
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-xs text-fog-400">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-emerald-400" : "bg-white/20")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", value ? "left-[1.4rem]" : "left-0.5")} />
      </span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <label className="relative h-12 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/20" style={{ background: isHex(value) ? value : "#000" }}>
          <input type="color" value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} picker`} />
        </label>
        <input
          className={cn("field font-mono uppercase", !isHex(text) && "!border-rose-400")}
          value={text}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
            setText(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
        />
      </div>
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function CustomizerPage() {
  const { call, toast } = useAdmin();
  const [tab, setTab] = useState<TabKey>("brand");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loaded, setLoaded] = useState(false);

  const [saved, setSaved] = useState<SiteConfig>(DEFAULT_SITE);
  const [draft, setDraft] = useState<SiteConfig>(DEFAULT_SITE);
  const [savedPay, setSavedPay] = useState<PayMethod[]>([]);
  const [payDraft, setPayDraft] = useState<PayMethod[]>([]);
  const [saving, setSaving] = useState(false);
  const [copyQuery, setCopyQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [site, pay] = await Promise.all([api<unknown>("/api/site"), call<{ methods: PayMethod[] }>("/api/studio/payment-methods")]);
        const s = mergeSite(site);
        setSaved(s);
        setDraft(clone(s));
        setSavedPay(pay.methods);
        setPayDraft(clone(pay.methods));
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load settings", "err");
      } finally {
        setLoaded(true);
      }
    })();
  }, [call, toast]);

  const siteDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const payDirty = useMemo(() => JSON.stringify(payDraft) !== JSON.stringify(savedPay), [payDraft, savedPay]);
  const dirty = siteDirty || payDirty;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const upd = useCallback((fn: (c: SiteConfig) => void) => setDraft((p) => { const n = clone(p); fn(n); return n; }), []);
  const updPay = (key: string, patch: Partial<PayMethod>) => setPayDraft((p) => p.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const save = async () => {
    setSaving(true);
    try {
      if (payDirty) {
        const r = await call<{ methods: PayMethod[] }>("/api/studio/payment-methods", { method: "PUT", body: JSON.stringify({ methods: payDraft }) });
        setSavedPay(r.methods);
        setPayDraft(clone(r.methods));
      }
      if (siteDirty) {
        await call("/api/studio/site", { method: "PUT", body: JSON.stringify(draft) });
        setSaved(clone(draft));
      }
      toast("Saved. Both websites update within a minute (or on refresh).");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save", "err");
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    setDraft(clone(saved));
    setPayDraft(clone(savedPay));
  };

  /* ---- backup ---- */
  const fileRef = useRef<HTMLInputElement>(null);
  const exportPack = () => {
    const pack = { format: "tikit-config", version: 1, exportedAt: new Date().toISOString(), site: draft, payments: payDraft };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(draft.brand.name || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-config.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importPack = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.format !== "tikit-config" || typeof j.site !== "object") throw new Error("This is not a client pack file.");
      setDraft(mergeSite(j.site));
      if (Array.isArray(j.payments)) {
        setPayDraft((cur) => cur.map((m) => { const x = (j.payments as PayMethod[]).find((p) => p.key === m.key); return x ? { ...m, label: x.label ?? m.label, accountName: x.accountName ?? "", accountNumber: x.accountNumber ?? "", note: x.note ?? "", enabled: !!x.enabled } : m; }));
      }
      toast("Pack loaded into the editor. Review it and press Save.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read that file", "err");
    }
  };

  /* ---- security ---- */
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const changePin = async () => {
    if (pin1.trim().length < 4) return toast("Use at least 4 characters", "err");
    if (pin1 !== pin2) return toast("The two PINs don't match", "err");
    try {
      await call("/api/studio/pin", { method: "PUT", body: JSON.stringify({ new: pin1.trim() }) });
      setPin1("");
      setPin2("");
      toast("PIN changed");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not change the PIN", "err");
    }
  };

  const copyItems = COPY_ITEMS.filter((i) => !copyQuery.trim() || (i.label + " " + i.value + " " + i.group).toLowerCase().includes(copyQuery.trim().toLowerCase()));
  const groups = [...new Set(copyItems.map((i) => i.group))];
  const overrides = Object.keys(draft.copy).filter((k) => draft.copy[k]).length;

  if (!loaded) return <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div>;

  return (
    <>
      <PageHeader eyebrow="Developer Studio" title="Customize this client">
        <p className="max-w-sm text-sm text-fog-400">Change the brand, design, texts and payment accounts without touching code. Everything on the right is a live preview.</p>
      </PageHeader>

      <div className="glass mb-6 flex gap-1 overflow-x-auto rounded-full p-1">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={cn("relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors", tab === key ? "text-white" : "text-fog-400 hover:text-white")}>
            {tab === key && <motion.span layoutId="cust-tab" className="absolute inset-0 rounded-full bg-brand-gradient" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,34rem)_1fr]">
        {/* ------------------------------ editor ------------------------------ */}
        <div className="min-w-0 space-y-5 pb-28">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-5">
              {tab === "brand" && (
                <>
                  <Card title="Name & identity" hint="Shown in the menu, footer, browser tab, receipts and the admin console.">
                    <Text label="Brand name" value={draft.brand.name} onChange={(v) => upd((c) => { c.brand.name = v; })} placeholder="tikit" />
                    <Text label="Tagline" value={draft.brand.tagline} onChange={(v) => upd((c) => { c.brand.tagline = v; })} hint="Used in the browser tab title." />
                    <Text label="Admin console subtitle" value={draft.brand.adminSubtitle} onChange={(v) => upd((c) => { c.brand.adminSubtitle = v; })} />
                    <Toggle label="Show brand name next to the logo" value={draft.brand.showWordmark} onChange={(v) => upd((c) => { c.brand.showWordmark = v; })} hint="Turn off if your logo image already contains the name." />
                    <Toggle label="Gradient dot after the name" value={draft.brand.showDot} onChange={(v) => upd((c) => { c.brand.showDot = v; })} />
                  </Card>
                  <Card title="Logo" hint="Upload the client's logo (PNG, SVG, WEBP). Leave empty to use the built-in ticket mark in the brand colors.">
                    <ImageField label="Logo image" value={draft.brand.logoUrl} onChange={(v) => upd((c) => { c.brand.logoUrl = v; })} aspect="aspect-[3/1]" contain hint="Transparent background works best. Height is scaled automatically." />
                    <ImageField label="Browser icon (favicon)" value={draft.brand.faviconUrl} onChange={(v) => upd((c) => { c.brand.faviconUrl = v; })} aspect="aspect-[4/1]" contain hint="Optional. Falls back to the logo." />
                  </Card>
                  <Card title="Search & sharing">
                    <Text label="Browser tab title (optional)" value={draft.seo.title} onChange={(v) => upd((c) => { c.seo.title = v; })} placeholder={`${draft.brand.name} — ${draft.brand.tagline}`} />
                    <Text label="Description" long value={draft.seo.description} onChange={(v) => upd((c) => { c.seo.description = v; })} />
                  </Card>
                  <Card title="Contact details" hint="Shown as buttons in the website footer. Leave blank to hide.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Text label="Phone" value={draft.contact.phone} onChange={(v) => upd((c) => { c.contact.phone = v; })} placeholder="+251 911 000 000" />
                      <Text label="Email" value={draft.contact.email} onChange={(v) => upd((c) => { c.contact.email = v; })} />
                      <Text label="WhatsApp number" value={draft.contact.whatsapp} onChange={(v) => upd((c) => { c.contact.whatsapp = v; })} placeholder="251911000000" />
                      <Text label="Telegram username" value={draft.contact.telegram} onChange={(v) => upd((c) => { c.contact.telegram = v; })} placeholder="@yourname" />
                      <Text label="Instagram username" value={draft.contact.instagram} onChange={(v) => upd((c) => { c.contact.instagram = v; })} />
                    </div>
                    <Text label="Address" value={draft.contact.address} onChange={(v) => upd((c) => { c.contact.address = v; })} />
                  </Card>
                </>
              )}

              {tab === "colors" && (
                <>
                  <Card title="Quick themes" hint="Start from a preset, then fine-tune the colors below.">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {PRESETS.map((p) => {
                        const on = draft.theme.primary === p.primary && draft.theme.secondary === p.secondary && draft.theme.accent === p.accent && draft.theme.background === p.background;
                        return (
                          <button key={p.name} onClick={() => upd((c) => { c.theme.primary = p.primary; c.theme.secondary = p.secondary; c.theme.accent = p.accent; c.theme.background = p.background; })} className={cn("rounded-2xl p-3 text-left ring-1 transition", on ? "bg-white/10 ring-white/60" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]")}>
                            <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(110deg, ${p.primary}, ${p.secondary} 60%, ${p.accent})` }} />
                            <span className="mt-2 block text-xs font-bold">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                  <Card title="Brand colors">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ColorField label="Primary" value={draft.theme.primary} onChange={(v) => upd((c) => { c.theme.primary = v; })} />
                      <ColorField label="Secondary" value={draft.theme.secondary} onChange={(v) => upd((c) => { c.theme.secondary = v; })} />
                      <ColorField label="Accent" value={draft.theme.accent} onChange={(v) => upd((c) => { c.theme.accent = v; })} />
                      <ColorField label="Background (dark)" value={draft.theme.background} onChange={(v) => upd((c) => { c.theme.background = v; })} />
                    </div>
                    <p className="text-xs text-fog-500">Shades are generated automatically. The background is kept dark so the text stays readable.</p>
                    <Toggle label="Animated glow background" value={draft.theme.animatedBackground} onChange={(v) => upd((c) => { c.theme.animatedBackground = v; })} />
                  </Card>
                  <Card title="Typography">
                    <div>
                      <label className="label">Font pair</label>
                      <select className="field" value={draft.theme.font} onChange={(e) => upd((c) => { c.theme.font = e.target.value; })}>
                        {FONT_CHOICES.map((f) => <option key={f.key} value={f.key} className="bg-ink-800">{f.label}</option>)}
                      </select>
                      <p className="mt-1.5 text-xs text-fog-500">Choose “Noto Sans Ethiopic” if the site will be written in Amharic. Amharic text always has a fallback font.</p>
                    </div>
                  </Card>
                </>
              )}

              {tab === "home" && (
                <>
                  <Card title="Hero (top of the homepage)">
                    <Text label="Small badge" value={draft.hero.badge} onChange={(v) => upd((c) => { c.hero.badge = v; })} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Text label="Headline, line 1" value={draft.hero.line1} onChange={(v) => upd((c) => { c.hero.line1 = v; })} />
                      <Text label="Headline, line 2 (colored)" value={draft.hero.line2} onChange={(v) => upd((c) => { c.hero.line2 = v; })} />
                    </div>
                    <Text label="Subtitle" long value={draft.hero.subtitle} onChange={(v) => upd((c) => { c.hero.subtitle = v; })} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Text label="Main button" value={draft.hero.ctaPrimary} onChange={(v) => upd((c) => { c.hero.ctaPrimary = v; })} />
                      <Text label="Second button (blank = hide)" value={draft.hero.ctaSecondary} onChange={(v) => upd((c) => { c.hero.ctaSecondary = v; })} />
                    </div>
                  </Card>
                  <Card title="Hero visual" hint="A floating 3D ticket with your colors, or your own image.">
                    <Toggle label="Show the 3D ticket" value={draft.hero.show3D} onChange={(v) => upd((c) => { c.hero.show3D = v; })} />
                    {draft.hero.show3D ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Text label="Ticket text, line 1" value={draft.hero.ticketLine1} onChange={(v) => upd((c) => { c.hero.ticketLine1 = v; })} />
                          <Text label="Ticket text, line 2" value={draft.hero.ticketLine2} onChange={(v) => upd((c) => { c.hero.ticketLine2 = v; })} />
                        </div>
                        <Text label="Small line under the ticket text" value={draft.hero.ticketSub} onChange={(v) => upd((c) => { c.hero.ticketSub = v; })} />
                      </>
                    ) : (
                      <ImageField label="Hero image" value={draft.hero.imageUrl} onChange={(v) => upd((c) => { c.hero.imageUrl = v; })} aspect="aspect-[4/3]" />
                    )}
                  </Card>
                  <Card title="Scrolling banner" hint="One phrase per line. Leave empty to hide the strip.">
                    <textarea rows={5} className="field resize-y" value={draft.marquee.join("\n")} onChange={(e) => upd((c) => { c.marquee = e.target.value.split("\n"); })} />
                  </Card>
                  <Card title="Events section">
                    <Text label="Small heading" value={draft.events.eyebrow} onChange={(v) => upd((c) => { c.events.eyebrow = v; })} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Text label="Title" value={draft.events.title1} onChange={(v) => upd((c) => { c.events.title1 = v; })} />
                      <Text label="Title (colored)" value={draft.events.title2} onChange={(v) => upd((c) => { c.events.title2 = v; })} />
                    </div>
                  </Card>
                  <Card title="How it works">
                    <Toggle label="Show this section" value={draft.howItWorks.show} onChange={(v) => upd((c) => { c.howItWorks.show = v; })} />
                    {draft.howItWorks.show && (
                      <>
                        <Text label="Small heading" value={draft.howItWorks.eyebrow} onChange={(v) => upd((c) => { c.howItWorks.eyebrow = v; })} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Text label="Title" value={draft.howItWorks.title1} onChange={(v) => upd((c) => { c.howItWorks.title1 = v; })} />
                          <Text label="Title (colored)" value={draft.howItWorks.title2} onChange={(v) => upd((c) => { c.howItWorks.title2 = v; })} />
                        </div>
                        {draft.howItWorks.steps.slice(0, 4).map((s, i) => (
                          <div key={i} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-fog-400">Step {i + 1}</p>
                            <div className="space-y-3">
                              <input className="field" value={s.title} onChange={(e) => upd((c) => { c.howItWorks.steps[i].title = e.target.value; })} />
                              <textarea rows={2} className="field resize-none" value={s.text} onChange={(e) => upd((c) => { c.howItWorks.steps[i].text = e.target.value; })} />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </Card>
                  <Card title="Footer">
                    <Text label="Footer line" value={draft.footer.text} onChange={(v) => upd((c) => { c.footer.text = v; })} />
                    <Text label="Copyright text (blank = automatic)" value={draft.footer.copyright} onChange={(v) => upd((c) => { c.footer.copyright = v; })} />
                  </Card>
                </>
              )}

              {tab === "texts" && (
                <>
                  <Card title="Every label on the customer website" hint="Change any word below (great for translating to Amharic or Oromo). Leave a field empty to keep the default. Use {name} where shown.">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
                      <input className="field !rounded-full pl-10" placeholder="Search texts…" value={copyQuery} onChange={(e) => setCopyQuery(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-fog-400">
                      <span>{overrides} customised</span>
                      {overrides > 0 && <button onClick={() => upd((c) => { c.copy = {}; })} className="inline-flex items-center gap-1 font-bold text-brand-300 hover:text-white"><Undo2 className="h-3.5 w-3.5" />Reset all</button>}
                    </div>
                  </Card>
                  {groups.map((g) => (
                    <Card key={g} title={g}>
                      {copyItems.filter((i) => i.group === g).map((i) => (
                        <div key={i.key}>
                          <label className="label">{i.label}</label>
                          {i.long ? (
                            <textarea rows={3} className="field resize-y" placeholder={COPY_DEFAULTS[i.key]} value={draft.copy[i.key] ?? ""} onChange={(e) => upd((c) => { if (e.target.value) c.copy[i.key] = e.target.value; else delete c.copy[i.key]; })} />
                          ) : (
                            <input className="field" placeholder={COPY_DEFAULTS[i.key] || "(empty)"} value={draft.copy[i.key] ?? ""} onChange={(e) => upd((c) => { if (e.target.value) c.copy[i.key] = e.target.value; else delete c.copy[i.key]; })} />
                          )}
                        </div>
                      ))}
                    </Card>
                  ))}
                  {groups.length === 0 && <p className="glass rounded-3xl p-8 text-center text-fog-400">No text matches “{copyQuery}”.</p>}
                </>
              )}

              {tab === "tickets" && (
                <>
                  <Card title="Money & limits">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Text label="Currency label" value={draft.tickets.currency} onChange={(v) => upd((c) => { c.tickets.currency = v.slice(0, 8); })} hint="Shown after every price, e.g. ETB, USD, Birr." />
                      <div>
                        <label className="label">Max tickets per type, per order</label>
                        <input type="number" min={1} max={50} className="field" value={draft.tickets.maxPerTier} onChange={(e) => upd((c) => { c.tickets.maxPerTier = Math.min(50, Math.max(1, Number(e.target.value) || 1)); })} />
                      </div>
                    </div>
                  </Card>
                  <Card title="Ticket sections" hint="Rename the sections and pick their colors. They appear on event pages, receipts and the admin console.">
                    {TIERS.map((t) => (
                      <div key={t} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                        <div className="mb-3 flex items-center gap-3">
                          <span className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-ink-950" style={{ background: `linear-gradient(135deg, ${draft.tickets.colors[t][0]}, ${draft.tickets.colors[t][1]})` }}>{draft.tickets.labels[t] || t}</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Text label="Name" value={draft.tickets.labels[t]} onChange={(v) => upd((c) => { c.tickets.labels[t] = v; })} />
                          <ColorField label="Color 1" value={draft.tickets.colors[t][0]} onChange={(v) => upd((c) => { c.tickets.colors[t][0] = v; })} />
                          <ColorField label="Color 2" value={draft.tickets.colors[t][1]} onChange={(v) => upd((c) => { c.tickets.colors[t][1] = v; })} />
                        </div>
                      </div>
                    ))}
                  </Card>
                </>
              )}

              {tab === "payments" && (
                <Card title="Payment accounts" hint="Customers see these when they choose how to pay. Telebirr shows the number; banks show the account to transfer to.">
                  {payDraft.map((m) => (
                    <div key={m.key} className={cn("rounded-2xl p-4 ring-1 transition", m.enabled ? "bg-white/[0.05] ring-white/15" : "bg-white/[0.02] opacity-70 ring-white/10")}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-lg font-bold">{m.label}</p>
                        <button type="button" role="switch" aria-checked={m.enabled} aria-label={`Enable ${m.label}`} onClick={() => updPay(m.key, { enabled: !m.enabled })} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", m.enabled ? "bg-emerald-400" : "bg-white/20")}>
                          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", m.enabled ? "left-[1.4rem]" : "left-0.5")} />
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Text label="Display name" value={m.label} onChange={(v) => updPay(m.key, { label: v })} />
                        <Text label="Account holder name" value={m.accountName} onChange={(v) => updPay(m.key, { accountName: v })} />
                        <Text label={m.key === "telebirr" ? "Telebirr number" : "Account number"} value={m.accountNumber} onChange={(v) => updPay(m.key, { accountNumber: v })} />
                        <Text label="Instruction shown to customers" value={m.note} onChange={(v) => updPay(m.key, { note: v })} />
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {tab === "security" && (
                <Card title="Admin PIN" hint="Set or reset the organizer's admin PIN (their owner console). Takes effect immediately.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="label">New PIN</label><input type="password" className="field" value={pin1} onChange={(e) => setPin1(e.target.value)} autoComplete="new-password" /></div>
                    <div><label className="label">Repeat new PIN</label><input type="password" className="field" value={pin2} onChange={(e) => setPin2(e.target.value)} autoComplete="new-password" /></div>
                  </div>
                  <button className="btn btn-primary" onClick={changePin} disabled={!pin1 || !pin2}><KeyRound className="h-4 w-4" />Change PIN</button>
                  <p className="text-xs text-fog-500">Tip: set a different PIN for every client before you hand the system over.</p>
                </Card>
              )}

              {tab === "backup" && (
                <>
                  <Card title="Client packs" hint="A pack is one file with a client's whole setup: brand, logo link, colors, texts, tickets and payment accounts. Keep one per customer and load it into any fresh install in one click.">
                    <div className="flex flex-wrap gap-3">
                      <button className="btn btn-primary" onClick={exportPack}><Download className="h-4 w-4" />Export pack</button>
                      <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Import pack</button>
                      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importPack(e.target.files?.[0]); e.target.value = ""; }} />
                    </div>
                    <p className="text-xs text-fog-500">Importing only fills the editor. Nothing changes on the live websites until you press Save. Uploaded images (logo, hero) are stored on the server, so re-upload them for a new install.</p>
                  </Card>
                  <Card title="Start over">
                    <button className="btn btn-danger" onClick={() => { if (confirm("Reset all design and text settings to the defaults? (Payment accounts are not touched.) You can still discard before saving.")) setDraft(clone(DEFAULT_SITE)); }}><RotateCcw className="h-4 w-4" />Reset design &amp; texts to defaults</button>
                  </Card>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ------------------------------ preview ------------------------------ */}
        <div className="min-w-0 xl:sticky xl:top-8 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-fog-400">Live preview</p>
            <div className="glass hidden rounded-full p-1 sm:flex">
              {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setDevice(k)} aria-label={`${k} preview`} className={cn("grid h-8 w-10 place-items-center rounded-full transition", device === k ? "bg-white/15 text-white" : "text-fog-400 hover:text-white")}><Icon className="h-4 w-4" /></button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[1.75rem] xl:pr-1">
            <Preview config={draft} device={device} />
          </div>
        </div>
      </div>

      {/* ------------------------------ save bar ------------------------------ */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full border border-white/15 bg-ink-800/95 py-2.5 pl-6 pr-2.5 shadow-2xl backdrop-blur-xl lg:bottom-6 lg:left-[17rem] lg:right-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />Unsaved changes</span>
            <span className="flex gap-2">
              <button className="btn btn-ghost !px-4 !py-2.5 text-sm" onClick={discard} disabled={saving}>Discard</button>
              <button className="btn btn-primary !px-5 !py-2.5 text-sm" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <><Save className="h-4 w-4" />Save changes</>}</button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
