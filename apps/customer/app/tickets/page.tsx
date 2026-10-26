"use client";

import { ApiError, Skeleton, StatusPill, img, money, publicApi, timeAgo, useSite, type OrderView } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, QrCode, Search, TicketX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePoll } from "@/lib/hooks";
import { rememberOrder, useMyOrderIds } from "@/lib/myOrders";

function OrderRow({ o, i }: { o: OrderView; i: number }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Link href={`/orders/${o.id}`} className="glass group flex items-center gap-4 rounded-3xl p-3 pr-5 transition hover:bg-white/[0.09]">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand-gradient sm:h-24 sm:w-24">
          {o.event?.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img(o.event.cover)} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusPill status={o.status} />
            <span className="font-mono text-xs text-fog-500">{o.code}</span>
          </div>
          <p className="mt-1.5 truncate font-display text-lg font-bold">{o.eventTitle}</p>
          <p className="text-xs text-fog-400">{o.totalTickets} ticket{o.totalTickets > 1 ? "s" : ""} · {money(o.total)} · {timeAgo(o.createdAt)}</p>
        </div>
        <span className="hidden items-center gap-1.5 text-sm font-bold text-fog-300 transition group-hover:text-white sm:flex">
          {o.status === "approved" ? <><QrCode className="h-4 w-4" />Open ticket</> : "View"}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}

export default function MyTickets() {
  const { t } = useSite();
  const router = useRouter();
  const ids = useMyOrderIds();
  const key = ids.join(",");
  const { data: orders, loading } = usePoll(() => (ids.length ? publicApi.orders(ids) : Promise.resolve([] as OrderView[])), 8000, [key]);

  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const o = await publicApi.lookup(code.trim(), phone.trim());
      rememberOrder(o.id);
      router.push(`/orders/${o.id}`);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-300">{t("wallet.eyebrow")}</p>
      <h1 className="mt-2 text-5xl font-extrabold"><span className="text-gradient">{t("wallet.title")}</span></h1>
      <p className="mt-3 text-fog-400">{t("wallet.subtitle")}</p>

      <div className="mt-8 space-y-3">
        {loading && !orders && ids.length > 0 && [0, 1].map((i) => <Skeleton key={i} className="h-28" />)}
        <AnimatePresence>{orders?.map((o, i) => <OrderRow key={o.id} o={o} i={i} />)}</AnimatePresence>
        {ids.length === 0 && (
          <div className="glass grid place-items-center rounded-3xl px-6 py-14 text-center">
            <TicketX className="h-10 w-10 text-fog-400" />
            <p className="mt-4 font-display text-xl font-bold">{t("wallet.empty")}</p>
            <p className="mt-1 max-w-xs text-sm text-fog-400">Buy tickets for an event and they&apos;ll show up here. Ordered on another phone? Find it below.</p>
            <Link href="/#events" className="btn btn-primary mt-6">Browse events</Link>
          </div>
        )}
      </div>

      <form onSubmit={find} className="glass mt-12 rounded-3xl p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Search className="h-5 w-5 text-brand-300" />{t("wallet.find")}</h2>
        <p className="mt-1 text-sm text-fog-400">Use the order code (like TK-7H2QMX) and the phone number you ordered with.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-code">Order code</label>
            <input id="f-code" className="field font-mono uppercase" placeholder="TK-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="f-phone">Phone number</label>
            <input id="f-phone" className="field" placeholder="0911 234 567" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
        </div>
        {err && <p role="alert" className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/30">{err}</p>}
        <button className="btn btn-primary mt-5" disabled={busy || !code || !phone}>{busy ? "Searching…" : "Find my order"}</button>
      </form>
    </div>
  );
}
