"use client";

import { Logo, cn, useSite } from "@tikit/shared";
import { motion } from "framer-motion";
import { AtSign, Mail, MessageCircle, Phone, Send, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMyOrderIds } from "@/lib/myOrders";

/** Animated gradient glow that sits behind every page. */
export function Backdrop() {
  const { site } = useSite();
  const anim = site.theme.animatedBackground ? "animate-blob" : "";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <div className={`absolute -left-40 -top-40 h-[34rem] w-[34rem] ${anim} rounded-full bg-brand-600/30 blur-[120px]`} />
      <div className={`absolute -right-32 top-1/4 h-[30rem] w-[30rem] ${anim} rounded-full bg-hot-500/20 blur-[120px] [animation-delay:-6s]`} />
      <div className={`absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] ${anim} rounded-full bg-sun-500/10 blur-[140px] [animation-delay:-11s]`} />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function Navbar() {
  const path = usePathname();
  const ids = useMyOrderIds();
  const { t } = useSite();
  const links = [
    { href: "/#events", label: t("nav.events"), match: (p: string) => p === "/" || p.startsWith("/events") },
    { href: "/tickets", label: t("nav.tickets"), match: (p: string) => p.startsWith("/tickets") || p.startsWith("/orders") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Home">
          <Logo size={34} />
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.match(path);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active ? "text-white" : "text-fog-400 hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-white/10 ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="inline-flex items-center gap-1.5">
                  {l.label}
                  {l.href === "/tickets" && ids.length > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-gradient px-1 text-[0.68rem] font-extrabold text-white">
                      {ids.length}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const { site } = useSite();
  const c = site.contact;
  const links: { href: string; label: string; Icon: typeof Phone }[] = [];
  if (c.phone) links.push({ href: `tel:${c.phone.replace(/\s/g, "")}`, label: c.phone, Icon: Phone });
  if (c.email) links.push({ href: `mailto:${c.email}`, label: c.email, Icon: Mail });
  if (c.whatsapp) links.push({ href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp", Icon: MessageCircle });
  if (c.telegram) links.push({ href: `https://t.me/${c.telegram.replace(/^@/, "")}`, label: "Telegram", Icon: Send });
  if (c.instagram) links.push({ href: `https://instagram.com/${c.instagram.replace(/^@/, "")}`, label: "Instagram", Icon: AtSign });
  return (
    <footer className="mt-24 border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-10 text-sm text-fog-500 sm:flex-row sm:px-6">
        <Logo size={28} />
        <div className="flex flex-col items-center gap-3 text-center">
          {site.footer.text && (
            <p className="flex items-center gap-2">
              <Ticket className="h-4 w-4 shrink-0" /> {site.footer.text}
            </p>
          )}
          {links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {links.map(({ href, label, Icon }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-fog-300 transition hover:bg-white/[0.12] hover:text-white">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
          )}
          {c.address && <p className="text-xs">{c.address}</p>}
        </div>
        <p>{site.footer.copyright || `© ${new Date().getFullYear()} ${site.brand.name}`}</p>
      </div>
    </footer>
  );
}
