import type { SiteConfig } from "./site";
import type { Ticket, TierName } from "./types";

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

// Set from the white-label settings by <SiteProvider>
let CURRENCY = "ETB";
export const currency = () => CURRENCY;
export const money = (n: number) => `${n.toLocaleString("en-US")} ${CURRENCY}`;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayParts(iso: string) {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
    weekday: WEEKDAYS[d.getDay()],
    year: d.getFullYear(),
  };
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

export function countdown(iso: string, now = Date.now()) {
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: diff === 0,
  };
}

const grad = (a: string, b: string) => `linear-gradient(135deg,${a},${b})`;
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

export const TIER_META: Record<TierName, { label: string; gradient: string; text: string; ring: string }> = {
  regular: { label: "Regular", gradient: grad("#5b8cff", "#7c5cff"), text: "#9db8ff", ring: mix("#7c8cff", 55) },
  vip: { label: "VIP", gradient: grad("#ff7ab0", "#ff4f93"), text: "#ff9cc6", ring: mix("#ff6faa", 55) },
  vvip: { label: "VVIP", gradient: grad("#ffc857", "#ff8a3d"), text: "#ffd58a", ring: mix("#ffbe50", 60) },
};

/** Applies tier names/colours and the currency from the white-label settings. */
export function applyRuntime(site: SiteConfig) {
  CURRENCY = site.tickets.currency || "ETB";
  (Object.keys(TIER_META) as TierName[]).forEach((k) => {
    const [a, b] = site.tickets.colors[k];
    TIER_META[k] = {
      label: site.tickets.labels[k] || TIER_META[k].label,
      gradient: grad(a, b),
      text: `color-mix(in srgb, ${a} 70%, white)`,
      ring: mix(a, 55),
    };
  });
}

export const PAY_LABEL: Record<string, string> = {
  telebirr: "Telebirr",
  cbe: "CBE",
  abyssinia: "Bank of Abyssinia",
};

/**
 * The text inside every ticket QR code. It is readable by any QR app (name, section, amount),
 * while the Tikit admin scanner only needs the token in the second slot.
 */
export function qrPayload(t: Pick<Ticket, "token" | "name" | "tier" | "price" | "orderCode">) {
  return ["TIKIT", t.token, t.name, t.tier.toUpperCase(), `${t.price} ${CURRENCY}`, t.orderCode].join("|");
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
