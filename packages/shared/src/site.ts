import type { TierName } from "./types";

/* ------------------------------------------------------------------
   White-label configuration. Everything a client may want to change
   lives here. The owner edits it in the admin "Customizer" page; it is
   saved in MongoDB and both websites apply it at runtime.
------------------------------------------------------------------- */

export interface SiteConfig {
  brand: {
    name: string;
    tagline: string;
    logoUrl: string; // "" = built-in ticket mark
    faviconUrl: string; // "" = use logo / built-in mark
    showWordmark: boolean;
    showDot: boolean;
    adminSubtitle: string;
  };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    font: string; // key of FONT_CHOICES
    animatedBackground: boolean;
  };
  hero: {
    badge: string;
    line1: string;
    line2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    show3D: boolean;
    ticketLine1: string;
    ticketLine2: string;
    ticketSub: string;
    imageUrl: string; // used instead of the 3D ticket when 3D is off
  };
  marquee: string[];
  events: { eyebrow: string; title1: string; title2: string };
  howItWorks: { show: boolean; eyebrow: string; title1: string; title2: string; steps: { title: string; text: string }[] };
  footer: { text: string; copyright: string };
  contact: { phone: string; email: string; whatsapp: string; telegram: string; instagram: string; address: string };
  tickets: {
    currency: string;
    maxPerTier: number;
    labels: Record<TierName, string>;
    colors: Record<TierName, [string, string]>;
  };
  seo: { title: string; description: string };
  copy: Record<string, string>; // overrides for COPY_DEFAULTS
}

export const DEFAULT_SITE: SiteConfig = {
  brand: {
    name: "tikit",
    tagline: "Every night, ticketed",
    logoUrl: "",
    faviconUrl: "",
    showWordmark: true,
    showDot: true,
    adminSubtitle: "Console",
  },
  theme: {
    primary: "#7c5cff",
    secondary: "#ff4f93",
    accent: "#ffb02e",
    background: "#06060b",
    font: "default",
    animatedBackground: true,
  },
  hero: {
    badge: "Tickets without the hassle",
    line1: "Feel the night",
    line2: "before it starts.",
    subtitle:
      "Discover the best events in town, pay with Telebirr, CBE or Bank of Abyssinia, and carry your QR ticket in your pocket. No sign-up. No stress.",
    ctaPrimary: "Explore events",
    ctaSecondary: "My tickets",
    show3D: true,
    ticketLine1: "ADMIT",
    ticketLine2: "ONE.",
    ticketSub: "ALL ACCESS  ·  VVIP",
    imageUrl: "",
  },
  marquee: ["Live music", "Comedy nights", "Festivals", "Tech meetups", "Rooftop parties", "Concerts", "Cultural shows", "Promo nights"],
  events: { eyebrow: "What's on", title1: "Find your", title2: "next night" },
  howItWorks: {
    show: true,
    eyebrow: "How it works",
    title1: "From couch to front row in",
    title2: "four taps",
    steps: [
      { title: "Pick your tickets", text: "Choose Regular, VIP or VVIP and as many seats as you need for your crew." },
      { title: "Pay your way", text: "Send money with Telebirr, CBE or Bank of Abyssinia, then upload the screenshot or SMS." },
      { title: "Get your QR ticket", text: "We confirm in minutes. Your QR ticket appears right here, ready to download." },
      { title: "Walk right in", text: "Show the QR at the gate. One scan and you're inside. No printing, no queues." },
    ],
  },
  footer: { text: "Pay with Telebirr, CBE or Bank of Abyssinia · QR tickets · No sign-up", copyright: "", },
  contact: { phone: "", email: "", whatsapp: "", telegram: "", instagram: "", address: "" },
  tickets: {
    currency: "ETB",
    maxPerTier: 10,
    labels: { regular: "Regular", vip: "VIP", vvip: "VVIP" },
    colors: {
      regular: ["#5b8cff", "#7c5cff"],
      vip: ["#ff7ab0", "#ff4f93"],
      vvip: ["#ffc857", "#ff8a3d"],
    },
  },
  seo: { title: "", description: "Discover events, pay with Telebirr, CBE or Bank of Abyssinia, and get your QR ticket in minutes. No sign-up needed." },
  copy: {},
};

/* ------------------------------ text dictionary ------------------------------ */

export interface CopyItem {
  key: string;
  group: string;
  label: string;
  value: string;
  long?: boolean;
}

const C = (group: string, items: [string, string, string, boolean?][]): CopyItem[] =>
  items.map(([key, label, value, long]) => ({ key, group, label, value, long }));

export const COPY_ITEMS: CopyItem[] = [
  ...C("Navigation & lists", [
    ["nav.events", "Menu: events", "Events"],
    ["nav.tickets", "Menu: my tickets", "My tickets"],
    ["tabs.upcoming", "Tab: upcoming", "Upcoming"],
    ["tabs.live", "Tab: live", "Live now"],
    ["tabs.past", "Tab: past", "Past events"],
    ["status.live", "Badge: live", "Live now"],
    ["status.ended", "Badge: ended", "Ended"],
    ["status.soldOut", "Badge: sold out", "Sold out"],
    ["status.almostGone", "Badge: almost gone", "Almost gone"],
    ["list.empty", "Empty list title", "Nothing here yet"],
    ["list.attended", "Past event count label", "attended"],
    ["list.inside", "Live event count label", "inside now"],
    ["live.banner", "Live banner badge", "Happening now"],
    ["live.attending", "Live banner counter", "attending"],
  ]),
  ...C("Event page", [
    ["event.liveAttendance", "Live attendance title", "Live attendance"],
    ["event.insideNow", "Live attendance text", "people are inside right now"],
    ["event.attended", "Past attendance text", "people attended this event"],
    ["event.doorsOpen", "Countdown title", "Doors open in"],
    ["event.doorsOpenSub", "Countdown text", "Grab your tickets before they're gone."],
    ["event.about", "About heading", "About this event"],
    ["event.gallery", "Gallery heading", "Gallery"],
    ["event.moments", "Gallery heading (past event)", "Moments"],
    ["event.buyTitle", "Ticket box title", "Choose your tickets"],
    ["event.buySub", "Ticket box subtitle", "Pay with Telebirr, CBE or Bank of Abyssinia"],
    ["event.closedTitle", "Sales closed title", "Ticket sales closed"],
    ["event.closedSub", "Sales closed text", "This event has ended."],
    ["event.buyButton", "Buy button", "Buy tickets"],
    ["event.selectButton", "Button when nothing selected", "Select tickets"],
  ]),
  ...C("Checkout", [
    ["checkout.title", "Sheet title", "Checkout"],
    ["checkout.step1", "Step 1 name", "Your details"],
    ["checkout.step2", "Step 2 name", "Pay"],
    ["checkout.step3", "Step 3 name", "Proof"],
    ["checkout.name", "Name field", "Full name"],
    ["checkout.phone", "Phone field", "Phone number"],
    ["checkout.privacy", "Privacy note", "No account needed. Your name appears on your ticket and the organiser may call this number.", true],
    ["checkout.continue", "Continue button", "Continue"],
    ["checkout.placeOrder", "Place order button", "Place order"],
    ["checkout.sendExactly", "Send exactly label", "Send exactly"],
    ["checkout.uploadTitle", "Upload box title", "Upload your payment screenshot"],
    ["checkout.pendingNote", "Note before placing order", "After you place the order it shows as Pending. As soon as the organiser confirms your payment, your QR ticket appears on the same page.", true],
  ]),
  ...C("Order status", [
    ["order.pendingTitle", "Pending title", "Payment under review"],
    ["order.pendingText", "Pending text", "We're checking your payment now. This page updates by itself, so you can keep it open. Your tickets appear here the moment it's approved.", true],
    ["order.approvedTitle", "Approved title ({name} = first name)", "You're in, {name}!"],
    ["order.approvedText", "Approved text", "Payment approved. Save your ticket to your phone.", true],
    ["order.rejectedTitle", "Rejected title", "Payment not confirmed"],
    ["order.rejectedText", "Rejected text", "We couldn't approve this order, so no money was kept and your tickets were released.", true],
    ["order.download", "Download button", "Download ticket"],
    ["order.screenshotTip", "Screenshot tip", "You can also just take a screenshot of the ticket. Each QR works once, so share only with the person who will use it.", true],
  ]),
  ...C("Ticket receipt", [
    ["ticket.holder", "Holder label", "Ticket holder"],
    ["ticket.section", "Section label", "Section"],
    ["ticket.amount", "Amount label", "Amount paid"],
    ["ticket.entrance", "Entrance note", "Show this QR code at the entrance. One scan = one person in.", true],
    ["ticket.checkedIn", "Checked-in stamp", "Checked in"],
    ["ticket.receiptNote", "Extra receipt note (optional)", ""],
  ]),
  ...C("My tickets page", [
    ["wallet.eyebrow", "Eyebrow", "Your wallet"],
    ["wallet.title", "Title", "My tickets"],
    ["wallet.subtitle", "Subtitle", "Orders you placed on this device. Pending ones update automatically.", true],
    ["wallet.empty", "Empty title", "No tickets on this device yet"],
    ["wallet.find", "Find order heading", "Find an order"],
  ]),
];

export const COPY_DEFAULTS: Record<string, string> = Object.fromEntries(COPY_ITEMS.map((i) => [i.key, i.value]));

/* ----------------------------------- fonts ----------------------------------- */

export interface FontChoice {
  key: string;
  label: string;
  display: string;
  sans: string;
  google?: string; // Google Fonts "family=" query, omitted for the bundled default
}

export const FONT_CHOICES: FontChoice[] = [
  { key: "default", label: "Bricolage + Jakarta (default)", display: '"Bricolage Grotesque Variable"', sans: '"Plus Jakarta Sans Variable"' },
  { key: "grotesk", label: "Space Grotesk + Inter", display: '"Space Grotesk"', sans: '"Inter"', google: "Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700" },
  { key: "sora", label: "Sora + DM Sans", display: '"Sora"', sans: '"DM Sans"', google: "Sora:wght@600;800&family=DM+Sans:wght@400;500;700" },
  { key: "outfit", label: "Outfit + Manrope", display: '"Outfit"', sans: '"Manrope"', google: "Outfit:wght@600;800&family=Manrope:wght@400;500;700" },
  { key: "serif", label: "Playfair Display + Lato (elegant)", display: '"Playfair Display"', sans: '"Lato"', google: "Playfair+Display:wght@600;800&family=Lato:wght@400;700" },
  { key: "poppins", label: "Poppins (friendly)", display: '"Poppins"', sans: '"Poppins"', google: "Poppins:wght@400;500;600;700;800" },
  { key: "ethiopic", label: "Noto Sans Ethiopic (Amharic)", display: '"Noto Sans Ethiopic"', sans: '"Noto Sans Ethiopic"', google: "Noto+Sans+Ethiopic:wght@400;600;800" },
];

export const fontByKey = (key: string) => FONT_CHOICES.find((f) => f.key === key) ?? FONT_CHOICES[0];

/* ----------------------------------- colors ----------------------------------- */

export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Lightens (positive) or darkens (negative) a hex colour by `amount` of lightness (0-1). */
export function shade(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, l + amount);
}

/** Black or white text, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#0a0a12" : "#ffffff";
}

export function themeVars(t: SiteConfig["theme"]): Record<string, string> {
  const d = DEFAULT_SITE.theme;
  const primary = isHex(t.primary) ? t.primary : d.primary;
  const secondary = isHex(t.secondary) ? t.secondary : d.secondary;
  const accent = isHex(t.accent) ? t.accent : d.accent;
  const bg = isHex(t.background) ? t.background : d.background;
  // keep the background dark so the light text stays readable
  const [bh, bs, bl] = hexToHsl(bg);
  const base = hslToHex(bh, bs, Math.min(bl, 0.12));
  const f = fontByKey(t.font);
  const fallback = ', "Noto Sans Ethiopic", ui-sans-serif, system-ui, sans-serif';
  return {
    "--color-brand-300": shade(primary, 0.2),
    "--color-brand-400": shade(primary, 0.1),
    "--color-brand-500": primary,
    "--color-brand-600": shade(primary, -0.08),
    "--color-brand-700": shade(primary, -0.16),
    "--color-hot-400": shade(secondary, 0.1),
    "--color-hot-500": secondary,
    "--color-hot-600": shade(secondary, -0.08),
    "--color-sun-300": shade(accent, 0.18),
    "--color-sun-400": shade(accent, 0.08),
    "--color-sun-500": accent,
    "--color-ink-950": base,
    "--color-ink-900": shade(base, 0.025),
    "--color-ink-850": shade(base, 0.045),
    "--color-ink-800": shade(base, 0.065),
    "--color-ink-700": shade(base, 0.1),
    "--color-ink-600": shade(base, 0.15),
    "--color-ink-500": shade(base, 0.21),
    "--font-display": f.display + fallback,
    "--font-sans": f.sans + fallback,
  };
}

/* ------------------------------- presets ------------------------------- */

export const PRESETS: { name: string; primary: string; secondary: string; accent: string; background: string }[] = [
  { name: "Neon Night", primary: "#7c5cff", secondary: "#ff4f93", accent: "#ffb02e", background: "#06060b" },
  { name: "Ocean", primary: "#0ea5e9", secondary: "#6366f1", accent: "#22d3ee", background: "#050a14" },
  { name: "Emerald", primary: "#10b981", secondary: "#14b8a6", accent: "#facc15", background: "#04100c" },
  { name: "Sunset", primary: "#f97316", secondary: "#e11d48", accent: "#fbbf24", background: "#120806" },
  { name: "Royal Gold", primary: "#a78bfa", secondary: "#d946ef", accent: "#f5c542", background: "#0a0612" },
  { name: "Ethiopia", primary: "#16a34a", secondary: "#dc2626", accent: "#facc15", background: "#07100a" },
  { name: "Mono", primary: "#e5e7eb", secondary: "#9ca3af", accent: "#ffffff", background: "#08080a" },
];

/* ------------------------------- merge / helpers ------------------------------- */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T;
  if (isObj(base)) {
    const out: Json = { ...base };
    if (isObj(over)) {
      for (const k of Object.keys(base)) {
        if (k in over && over[k] !== undefined && over[k] !== null) out[k] = merge((base as Json)[k], over[k]);
      }
      // free-form maps (like copy) keep every key
      if ("copy" in base) out.copy = isObj(over.copy) ? over.copy : {};
    }
    return out as T;
  }
  return (typeof over === typeof base ? over : base) as T;
}

/** Combines what the server saved with the built-in defaults, so a missing option never breaks the page. */
export function mergeSite(saved: unknown): SiteConfig {
  const m = merge(DEFAULT_SITE, saved);
  const steps = [...m.howItWorks.steps];
  DEFAULT_SITE.howItWorks.steps.forEach((s, i) => {
    steps[i] = { title: steps[i]?.title ?? s.title, text: steps[i]?.text ?? s.text };
  });
  m.howItWorks.steps = steps.slice(0, 8);
  m.tickets.maxPerTier = Math.min(50, Math.max(1, Math.round(Number(m.tickets.maxPerTier)) || 10));
  return m;
}

export function copyText(site: SiteConfig, key: string, vars?: Record<string, string | number>): string {
  const raw = site.copy[key] !== undefined && site.copy[key] !== "" ? site.copy[key] : COPY_DEFAULTS[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : raw;
}
