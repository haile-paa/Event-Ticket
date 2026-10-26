"use client";

import { img } from "./api";
import { cn } from "./format";
import { useSite } from "./SiteProvider";

/** The built-in mark: a ticket with a punched "T" and a spark. Colours follow the theme. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const { site } = useSite();
  if (site.brand.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img(site.brand.logoUrl)} alt="" width={size} height={size} className={cn("object-contain", className)} style={{ height: size, width: "auto", maxWidth: size * 3 }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="tikit-g" x1="6" y1="10" x2="58" y2="54" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--color-brand-400)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--color-hot-500)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-sun-500)" }} />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 32 32)">
        <path
          d="M14 14H50a8 8 0 0 1 8 8V27a5 5 0 0 0 0 10V42a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V37a5 5 0 0 0 0-10V22a8 8 0 0 1 8-8Z"
          fill="url(#tikit-g)"
        />
        <path d="M21 22H43a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 43 28H35.5v13.2a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5V28H21a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 21 22Z" fill="#0A0A12" />
        <path d="M47 18.5v27" stroke="#0A0A12" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="2.2 3.2" strokeLinecap="round" />
      </g>
      <path d="M54 4l1.7 4.3L60 10l-4.3 1.7L54 16l-1.7-4.3L48 10l4.3-1.7L54 4Z" style={{ fill: "var(--color-sun-300)" }} />
    </svg>
  );
}

/** Mark + brand name, both taken from the white-label settings. */
export function Logo({
  size = 36,
  wordmark,
  subtitle,
  className,
}: {
  size?: number;
  wordmark?: boolean;
  subtitle?: string;
  className?: string;
}) {
  const { site } = useSite();
  const showWord = wordmark ?? site.brand.showWordmark;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showWord && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.45rem] font-extrabold tracking-tight text-white">
            {site.brand.name}
            {site.brand.showDot && <span className="text-gradient">.</span>}
          </span>
          {subtitle && <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-fog-400">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
