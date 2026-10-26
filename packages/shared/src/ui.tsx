"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Clock, X } from "lucide-react";
import { useEffect } from "react";
import { cn, TIER_META } from "./format";
import type { OrderStatus, TierName } from "./types";

/** A number that counts up / down smoothly whenever `value` changes. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 18, mass: 0.8 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function TierBadge({ tier, className }: { tier: TierName; className?: string }) {
  const m = TIER_META[tier];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wider text-ink-950", className)}
      style={{ background: m.gradient }}
    >
      {m.label}
    </span>
  );
}

const STATUS_STYLES: Record<OrderStatus, { label: string; cls: string; Icon: typeof Check }> = {
  pending: { label: "Pending", cls: "bg-amber-400/15 text-amber-300 ring-amber-300/30", Icon: Clock },
  approved: { label: "Approved", cls: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/40", Icon: Check },
  rejected: { label: "Rejected", cls: "bg-rose-400/15 text-rose-300 ring-rose-300/30", Icon: X },
};

/** Status chip that morphs (flip + colour change) when the status changes. */
export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("relative inline-flex h-7 items-center overflow-hidden rounded-full px-3 text-xs font-bold ring-1 transition-colors duration-700", s.cls, className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ y: 14, opacity: 0, rotateX: -70 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: -14, opacity: 0, rotateX: 70 }}
          transition={{ duration: 0.28 }}
          className="inline-flex items-center gap-1.5"
        >
          <s.Icon className="h-3.5 w-3.5" strokeWidth={3} />
          {s.label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.06]", className)} />;
}
