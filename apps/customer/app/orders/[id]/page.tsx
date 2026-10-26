"use client";

import { PAY_LABEL, Skeleton, StatusPill, TIER_META, TicketCard, fmtDateTime, money, publicApi, timeAgo, useSite, type OrderStatus } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Clock, Download, Hourglass, RefreshCw, ShieldCheck, Smartphone, TicketX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { downloadNodeAsPng } from "@/lib/download";
import { usePoll } from "@/lib/hooks";
import { rememberOrder } from "@/lib/myOrders";

async function celebrate() {
  const { default: confetti } = await import("canvas-confetti");
  const colors = ["#7c5cff", "#ff4f93", "#ffb02e", "#34d399", "#ffffff"];
  confetti({ particleCount: 150, spread: 95, startVelocity: 48, origin: { y: 0.3 }, colors });
  setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors }), 400);
}

function DrawnIcon({ kind }: { kind: "ok" | "no" }) {
  const ok = kind === "ok";
  const color = ok ? "#34d399" : "#fb7185";
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <motion.span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.18 }} initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.15, 1] }} transition={{ duration: 0.8 }} />
      <svg viewBox="0 0 120 120" className="relative h-28 w-28">
        <motion.circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} />
        {ok ? (
          <motion.path d="M36 62l16 16 32-34" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.45 }} />
        ) : (
          <>
            <motion.path d="M42 42l36 36" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.3 }} />
            <motion.path d="M78 42L42 78" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.75, duration: 0.3 }} />
          </>
        )}
      </svg>
    </div>
  );
}

function PendingView() {
  const { t } = useSite();
  const steps = [
    { label: "Order placed", state: "done" },
    { label: "Payment under review", state: "active" },
    { label: "Tickets issued", state: "todo" },
  ] as const;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid h-36 w-36 place-items-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="absolute inset-4 animate-pulse-ring rounded-full border-2 border-amber-300/60" style={{ animationDelay: `${i * 0.65}s` }} />
        ))}
        <motion.span animate={{ rotate: [0, 180, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative grid h-20 w-20 place-items-center rounded-full bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/40">
          <Hourglass className="h-9 w-9" />
        </motion.span>
      </div>
      <h1 className="mt-4 text-4xl font-extrabold">{t("order.pendingTitle")}</h1>
      <p className="mt-3 max-w-sm text-fog-300">{t("order.pendingText")}</p>

      <div className="mt-8 flex w-full max-w-sm items-start">
        {steps.map((s, i) => (
          <div key={s.label} className="relative flex flex-1 flex-col items-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${s.state === "todo" ? "bg-white/10" : "bg-gradient-to-r from-emerald-400 to-amber-300"}`} />}
            <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${s.state === "done" ? "bg-emerald-400 text-ink-950" : s.state === "active" ? "bg-amber-300 text-ink-950" : "bg-ink-700 text-fog-500"}`}>
              {s.state === "done" ? <Check className="h-4 w-4" strokeWidth={3.5} /> : s.state === "active" ? <Clock className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`mt-2 px-1 text-[0.7rem] font-semibold leading-tight ${s.state === "todo" ? "text-fog-500" : "text-fog-200"}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useSite();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  // fast while waiting for the organiser, slower once tickets are issued (to show "checked in")
  const { data: order, loading, error, reload } = usePoll(() => publicApi.order(id), status === "rejected" ? null : status === "approved" ? 10000 : 3500, [id, status]);

  const prev = useRef<OrderStatus | null>(null);
  useEffect(() => {
    const s = order?.status ?? null;
    if (!s) return;
    if (prev.current === "pending" && s === "approved") celebrate();
    prev.current = s;
    setStatus(s);
  }, [order?.status]);
  useEffect(() => {
    if (order) rememberOrder(order.id);
  }, [order]);

  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (loading && !order) {
    return <div className="mx-auto max-w-xl px-4 pt-14"><Skeleton className="h-[30rem]" /></div>;
  }
  if (!order) {
    return (
      <div className="mx-auto grid max-w-md place-items-center px-6 py-28 text-center">
        <TicketX className="h-12 w-12 text-fog-400" />
        <h1 className="mt-5 text-3xl font-extrabold">Order not found</h1>
        <p className="mt-2 text-fog-400">{error || "Check the link and try again."}</p>
        <Link href="/tickets" className="btn btn-primary mt-8">Find my order</Link>
      </div>
    );
  }

  const tickets = order.tickets;
  const current = tickets[Math.min(idx, tickets.length - 1)];

  const saveOne = async () => {
    if (!cardRef.current || !current) return;
    setSaving(true);
    try {
      await downloadNodeAsPng(cardRef.current, `tikit-${current.orderCode}-${current.seq}.png`);
    } finally {
      setSaving(false);
    }
  };
  const saveAll = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < tickets.length; i++) {
        setIdx(i);
        await new Promise((r) => setTimeout(r, 450));
        if (cardRef.current) await downloadNodeAsPng(cardRef.current, `tikit-${tickets[i].orderCode}-${tickets[i].seq}.png`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fog-400 hover:text-white"><ChevronLeft className="h-4 w-4" />My tickets</Link>
        <StatusPill status={order.status} />
      </div>

      <AnimatePresence mode="wait">
        {order.status === "pending" && (
          <motion.div key="pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }} transition={{ duration: 0.4 }}>
            <PendingView />
          </motion.div>
        )}

        {order.status === "approved" && (
          <motion.div key="approved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
            <div className="flex flex-col items-center text-center">
              <DrawnIcon kind="ok" />
              <h1 className="mt-2 text-4xl font-extrabold text-gradient">{t("order.approvedTitle", { name: order.name.split(" ")[0] })}</h1>
              <p className="mt-2 max-w-sm text-fog-300">{t("order.approvedText")}{tickets.length > 1 ? ` (${tickets.length})` : ""}</p>
            </div>

            {current && (
              <div className="mt-8">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={current.id} initial={{ opacity: 0, x: 50, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -50, rotate: -2 }} transition={{ duration: 0.28 }}>
                    <TicketCard ref={cardRef} ticket={current} event={order.event} />
                  </motion.div>
                </AnimatePresence>

                {tickets.length > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-4">
                    <button onClick={() => setIdx((i) => (i - 1 + tickets.length) % tickets.length)} aria-label="Previous ticket" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></button>
                    <div className="flex items-center gap-2">
                      {tickets.map((t, i) => (
                        <button key={t.id} onClick={() => setIdx(i)} aria-label={`Ticket ${i + 1}`} className={`h-2.5 rounded-full transition-all ${i === idx ? "w-7" : "w-2.5 bg-white/25"}`} style={i === idx ? { background: TIER_META[t.tier].gradient } : undefined} />
                      ))}
                    </div>
                    <button onClick={() => setIdx((i) => (i + 1) % tickets.length)} aria-label="Next ticket" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronRight className="h-5 w-5" /></button>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button onClick={saveOne} disabled={saving} className="btn btn-primary flex-1 py-4"><Download className="h-4 w-4" />{saving ? "…" : tickets.length > 1 ? `${t("order.download")} ${current.seq}` : t("order.download")}</button>
                  {tickets.length > 1 && <button onClick={saveAll} disabled={saving} className="btn btn-ghost flex-1 py-4"><Download className="h-4 w-4" />Download all {tickets.length}</button>}
                </div>
                <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs text-fog-400"><Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t("order.screenshotTip")}</p>
              </div>
            )}
          </motion.div>
        )}

        {order.status === "rejected" && (
          <motion.div key="rejected" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
            <DrawnIcon kind="no" />
            <h1 className="mt-2 text-4xl font-extrabold">{t("order.rejectedTitle")}</h1>
            <p className="mt-3 max-w-sm text-fog-300">{t("order.rejectedText")}</p>
            <div className="mt-5 w-full rounded-2xl bg-rose-500/12 p-4 text-left ring-1 ring-rose-400/30">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-rose-300">Reason from the organiser</p>
              <p className="mt-1 text-rose-100">{order.rejectReason || "We could not confirm your payment."}</p>
            </div>
            <Link href={`/events/${order.eventId}`} className="btn btn-primary mt-7"><RefreshCw className="h-4 w-4" />Try again</Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* summary */}
      <div className="glass mt-10 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-fog-500">Order {order.code}</p>
            <p className="mt-1 truncate font-display text-lg font-bold">{order.eventTitle}</p>
            {order.event && <p className="text-xs text-fog-400">{fmtDateTime(order.event.startsAt)}</p>}
          </div>
          <p className="font-display text-xl font-extrabold">{money(order.total)}</p>
        </div>
        <div className="my-4 h-px bg-white/10" />
        <ul className="space-y-1.5 text-sm">
          {order.items.map((it) => (
            <li key={it.tier} className="flex justify-between text-fog-300"><span>{it.qty} × {TIER_META[it.tier].label}</span><span>{money(it.qty * it.unitPrice)}</span></li>
          ))}
        </ul>
        <div className="my-4 h-px bg-white/10" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fog-400">
          <span>Paid with {PAY_LABEL[order.method] ?? order.method}</span>
          <span>Placed {timeAgo(order.createdAt)}</span>
        </div>
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-fog-500"><ShieldCheck className="h-3.5 w-3.5" />Order code <b className="font-mono text-fog-300">{order.code}</b> + your phone number finds this order on any device.</p>
    </div>
  );
}
