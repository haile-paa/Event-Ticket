"use client";

import { ApiError, PAY_LABEL, Skeleton, Spinner, StatusPill, TIER_META, cn, fmtDateTime, img, money, timeAgo, type OrderStatus } from "@tikit/shared";
import type { Order } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Maximize2, MessageSquareText, Phone, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { useAdmin } from "@/lib/admin";
import { beep, usePoll } from "@/lib/hooks";

type Tab = OrderStatus | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];
const QUICK_REASONS = ["Payment not received", "Wrong amount sent", "Screenshot unclear", "Duplicate order"];

export default function OrdersPage() {
  const { call, toast } = useAdmin();
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const { data, loading, error, reload, setData } = usePoll(() => call<Order[]>("/api/admin/orders"), 4000);
  const [zoom, setZoom] = useState<string | null>(null);

  const orders = data ?? [];
  const counts = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
    all: orders.length,
  }), [orders]);

  const shown = orders.filter((o) => {
    if (tab !== "all" && o.status !== tab) return false;
    const n = q.trim().toLowerCase();
    return !n || o.name.toLowerCase().includes(n) || o.phone.includes(n) || o.code.toLowerCase().includes(n) || o.eventTitle.toLowerCase().includes(n);
  });

  const patch = (id: string, next: Order) => setData((d) => (d ? d.map((o) => (o.id === id ? next : o)) : d));

  const approve = async (o: Order) => {
    try {
      const r = await call<Order>(`/api/admin/orders/${o.id}/approve`, { method: "POST" });
      patch(o.id, { ...o, status: r.status, decidedAt: r.decidedAt });
      beep("ok");
      toast(`Approved ${o.name} · ${o.totalTickets} ticket${o.totalTickets > 1 ? "s" : ""} issued`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not approve", "err");
      reload();
    }
  };
  const reject = async (o: Order, reason: string) => {
    try {
      const r = await call<Order>(`/api/admin/orders/${o.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      patch(o.id, { ...o, status: r.status, rejectReason: r.rejectReason, decidedAt: r.decidedAt });
      toast(`Rejected ${o.name}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not reject", "err");
      reload();
    }
  };

  return (
    <>
      <PageHeader eyebrow="Payments" title="Orders">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
          <input className="field w-64 !rounded-full pl-10" placeholder="Search name, phone, code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </PageHeader>

      <div className="glass mb-6 flex w-fit max-w-full overflow-x-auto rounded-full p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors", tab === t.key ? "text-white" : "text-fog-400 hover:text-white")}>
            {tab === t.key && <motion.span layoutId="orders-tab" className="absolute inset-0 rounded-full bg-brand-gradient" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative">{t.label} <span className="text-xs opacity-75">{counts[t.key]}</span></span>
          </button>
        ))}
      </div>

      {error && !data && <p className="glass rounded-3xl p-8 text-center text-rose-200">{error}</p>}
      {loading && !data && <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-56" />)}</div>}
      {data && shown.length === 0 && (
        <div className="glass rounded-3xl p-14 text-center">
          <p className="font-display text-xl font-bold">{tab === "pending" ? "All caught up 🎉" : "No orders here"}</p>
          <p className="mt-1 text-sm text-fog-400">{tab === "pending" ? "New payments will appear here automatically." : "Try another tab or search."}</p>
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {shown.map((o) => (
            <OrderCard key={o.id} o={o} onApprove={() => approve(o)} onReject={(r) => reject(o, r)} onZoom={setZoom} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {zoom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-4 backdrop-blur">
            <button className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="Payment proof" className="max-h-[90vh] max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function OrderCard({ o, onApprove, onReject, onZoom }: { o: Order; onApprove: () => Promise<void>; onReject: (reason: string) => Promise<void>; onZoom: (url: string) => void }) {
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async (kind: "approve" | "reject", fn: () => Promise<void>) => {
    setBusy(kind);
    await fn();
    setBusy("");
    setRejecting(false);
  };
  const copySms = async () => {
    try { await navigator.clipboard.writeText(o.proof.smsText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="glass overflow-hidden rounded-3xl">
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_16rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={o.status} />
            <span className="font-mono text-xs text-fog-500">{o.code}</span>
            <span className="text-xs text-fog-500" title={fmtDateTime(o.createdAt)}>· {timeAgo(o.createdAt)}</span>
          </div>
          <h3 className="mt-3 break-words font-display text-2xl font-extrabold">{o.name}</h3>
          <a href={`tel:${o.phone}`} className="mt-1 inline-flex items-center gap-2 text-brand-300 hover:text-white"><Phone className="h-4 w-4" />{o.phone}</a>

          <p className="mt-4 text-sm text-fog-400">{o.eventTitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {o.items.map((it) => (
              <span key={it.tier} className="rounded-full px-3 py-1 text-xs font-extrabold text-ink-950" style={{ background: TIER_META[it.tier].gradient }}>{it.qty} × {TIER_META[it.tier].label}</span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-1">
            <p className="font-display text-3xl font-extrabold">{money(o.total)}</p>
            <p className="pb-1 text-sm text-fog-400">via <b className="text-fog-200">{PAY_LABEL[o.method] ?? o.method}</b></p>
          </div>
          {o.status === "rejected" && o.rejectReason && <p className="mt-3 rounded-xl bg-rose-500/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/25">Reason: {o.rejectReason}</p>}
        </div>

        <div className="space-y-3">
          {o.proof.imageUrl && (
            <button onClick={() => onZoom(img(o.proof.imageUrl))} className="group relative block w-full overflow-hidden rounded-2xl ring-1 ring-white/15" aria-label="View payment screenshot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(o.proof.imageUrl)} alt="Payment screenshot" className="h-44 w-full bg-black/40 object-cover object-top transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100"><Maximize2 className="h-6 w-6" /></span>
            </button>
          )}
          {o.proof.smsText && (
            <div className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
              <div className="mb-1.5 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.18em] text-fog-400">
                <span className="flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" />Bank SMS</span>
                <button onClick={copySms} className="inline-flex items-center gap-1 normal-case tracking-normal hover:text-white">{copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
              </div>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fog-200">{o.proof.smsText}</p>
            </div>
          )}
        </div>
      </div>

      {o.status === "pending" && (
        <div className="border-t border-white/[0.07] bg-black/20 p-4">
          <AnimatePresence mode="wait" initial={false}>
            {rejecting ? (
              <motion.div key="rej" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map((r) => (
                    <button key={r} onClick={() => setReason(r)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", reason === r ? "border-rose-300 bg-rose-500/25 text-white" : "border-white/15 text-fog-300 hover:border-white/30")}>{r}</button>
                  ))}
                </div>
                <input className="field" placeholder="Reason shown to the customer (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                <div className="flex gap-3">
                  <button className="btn btn-ghost" onClick={() => setRejecting(false)} disabled={busy !== ""}>Cancel</button>
                  <button className="btn btn-danger flex-1" onClick={() => run("reject", () => onReject(reason))} disabled={busy !== ""}>{busy === "reject" ? <Spinner className="h-4 w-4" /> : <><X className="h-4 w-4" />Confirm reject</>}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="act" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3">
                <button className="btn btn-danger flex-1" onClick={() => setRejecting(true)} disabled={busy !== ""}><X className="h-4 w-4" />Reject</button>
                <button className="btn btn-success flex-[2] py-4" onClick={() => run("approve", onApprove)} disabled={busy !== ""}>{busy === "approve" ? <Spinner className="h-4 w-4 !border-emerald-900/30 !border-t-emerald-900" /> : <><Check className="h-4 w-4" strokeWidth={3} />Approve &amp; issue tickets</>}</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.article>
  );
}
