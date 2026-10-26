"use client";

import { AnimatedNumber, TierBadge, cn, fmtTime, money, type TikitEvent } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CameraOff, Check, Keyboard, Phone, ShieldAlert, TicketX, TriangleAlert, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { useAdmin } from "@/lib/admin";
import { beep, usePoll } from "@/lib/hooks";
import type { CheckinResponse } from "@/lib/types";

const READER_ID = "tikit-qr-reader";

const LOOK: Record<CheckinResponse["result"], { title: string; cls: string; ring: string; Icon: typeof Check }> = {
  accepted: { title: "Accepted", cls: "from-emerald-400 to-emerald-600 text-emerald-950", ring: "ring-emerald-300", Icon: Check },
  already: { title: "Already scanned", cls: "from-amber-300 to-amber-500 text-amber-950", ring: "ring-amber-200", Icon: TriangleAlert },
  wrong_event: { title: "Wrong event", cls: "from-orange-400 to-rose-500 text-white", ring: "ring-orange-200", Icon: ShieldAlert },
  invalid: { title: "Invalid ticket", cls: "from-rose-500 to-rose-700 text-white", ring: "ring-rose-300", Icon: TicketX },
};

/** html5-qrcode throws if you stop a scanner that is not running (React dev mode starts and stops it twice). */
async function safeStop(s: import("html5-qrcode").Html5Qrcode) {
  try {
    const st = s.getState(); // 2 = scanning, 3 = paused
    if (st === 2 || st === 3) await s.stop();
  } catch {
    /* already stopped */
  }
  try {
    s.clear();
  } catch {
    /* ignore */
  }
}

export default function ScanPage() {
  const { call } = useAdmin();
  const { data: events, reload } = usePoll(() => call<TikitEvent[]>("/api/admin/events"), 4000);
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [recent, setRecent] = useState<(CheckinResponse & { at: number })[]>([]);
  const [camera, setCamera] = useState<"starting" | "on" | "error">("starting");
  const [camError, setCamError] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const openEvents = (events ?? []).filter((e) => e.status !== "past");
  useEffect(() => {
    if (!eventId && events) {
      const pick = events.find((e) => e.status === "live") ?? events.find((e) => e.status === "upcoming");
      if (pick) setEventId(pick.id);
    }
  }, [events, eventId]);
  const event = events?.find((e) => e.id === eventId);

  // refs so the camera callback always sees fresh values without restarting the camera
  const eventRef = useRef(eventId);
  const lockRef = useRef(false);
  const lastRef = useRef({ text: "", at: 0 });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    eventRef.current = eventId;
  }, [eventId]);

  const submit = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (lockRef.current || !eventRef.current) return;
      if (text === lastRef.current.text && now - lastRef.current.at < 3000) return;
      lockRef.current = true;
      lastRef.current = { text, at: now };
      setBusy(true);
      try {
        const r = await call<CheckinResponse>("/api/admin/checkin", { method: "POST", body: JSON.stringify({ token: text, eventId: eventRef.current }) });
        beep(r.result === "accepted" ? "ok" : "bad");
        if (navigator.vibrate) navigator.vibrate(r.result === "accepted" ? 80 : [120, 60, 120]);
        setResult(r);
        setRecent((l) => [{ ...r, at: Date.now() }, ...l].slice(0, 8));
        reload();
      } catch {
        beep("bad");
        setResult({ result: "invalid", message: "Could not reach the server. Try again.", attendance: 0, total: 0 });
      } finally {
        setBusy(false);
        setTimeout(() => (lockRef.current = false), 900);
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setResult(null), 6000);
      }
    },
    [call, reload],
  );
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // camera
  useEffect(() => {
    let stopped = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        scanner = new Html5Qrcode(READER_ID, { verbose: false });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s }; } },
          (text) => void submitRef.current(text),
          () => {},
        );
        if (stopped) {
          await safeStop(scanner);
          return;
        }
        setCamera("on");
      } catch (e) {
        if (stopped) return;
        setCamera("error");
        const msg = e instanceof Error ? e.message : String(e);
        setCamError(/permission|denied|NotAllowed/i.test(msg) ? "Camera permission was denied. Allow camera access in your browser settings." : /secure|https/i.test(msg) ? "The camera needs HTTPS (or localhost)." : "Could not start the camera on this device.");
      }
    })();
    return () => {
      stopped = true;
      if (scanner) {
        void safeStop(scanner);
      }
    };
  }, []);

  const look = result ? LOOK[result.result] : null;
  const attendance = event?.checkedIn ?? result?.attendance ?? 0;

  return (
    <>
      <PageHeader eyebrow="Gate" title="Ticket scanner">
        <select className="field !w-auto min-w-56 !rounded-full" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event being scanned">
          {openEvents.length === 0 && <option value="" className="bg-ink-800">No open events</option>}
          {openEvents.map((e) => <option key={e.id} value={e.id} className="bg-ink-800">{e.status === "live" ? "● " : ""}{e.title}</option>)}
        </select>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <div className="glass relative overflow-hidden rounded-[2rem] p-3">
            <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-black sm:aspect-[4/3]">
              <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
              {camera !== "on" && (
                <div className="absolute inset-0 grid place-items-center bg-ink-900 p-6 text-center">
                  {camera === "starting" ? (
                    <div className="flex flex-col items-center gap-3 text-fog-400"><Camera className="h-10 w-10 animate-pulse" /><p className="text-sm font-semibold">Starting camera…</p></div>
                  ) : (
                    <div className="flex max-w-xs flex-col items-center gap-3"><CameraOff className="h-10 w-10 text-fog-400" /><p className="text-sm text-fog-300">{camError}</p><p className="text-xs text-fog-500">You can still type or paste a ticket code below.</p></div>
                  )}
                </div>
              )}
              {camera === "on" && (
                <>
                  {[["left-6 top-6", "border-l-4 border-t-4 rounded-tl-2xl"], ["right-6 top-6", "border-r-4 border-t-4 rounded-tr-2xl"], ["bottom-6 left-6", "border-b-4 border-l-4 rounded-bl-2xl"], ["bottom-6 right-6", "border-b-4 border-r-4 rounded-br-2xl"]].map(([pos, b]) => (
                    <span key={pos} className={cn("pointer-events-none absolute h-10 w-10 border-white/90", pos, b)} />
                  ))}
                  <motion.span className="pointer-events-none absolute inset-x-8 h-0.5 rounded bg-gradient-to-r from-transparent via-hot-400 to-transparent shadow-[0_0_18px_var(--color-hot-500)]" animate={{ top: ["12%", "88%", "12%"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
                </>
              )}

              <AnimatePresence>
                {result && look && (
                  <motion.button
                    key={result.ticket?.id ?? result.message}
                    type="button"
                    onClick={() => setResult(null)}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className={cn("absolute inset-x-3 bottom-3 rounded-3xl bg-gradient-to-br p-5 text-left shadow-2xl ring-4", look.cls, look.ring)}
                  >
                    <div className="flex items-center gap-3">
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 14 }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/20"><look.Icon className="h-6 w-6" strokeWidth={3} /></motion.span>
                      <div><p className="font-display text-2xl font-extrabold leading-none">{look.title}</p><p className="mt-1 text-sm font-semibold opacity-80">{result.message}</p></div>
                    </div>
                    {result.ticket && (
                      <div className="mt-4 rounded-2xl bg-black/20 p-4">
                        <p className="break-words font-display text-2xl font-extrabold">{result.ticket.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold opacity-90"><Phone className="h-3.5 w-3.5" />{result.ticket.phone}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                          <TierBadge tier={result.ticket.tier} />
                          <span>{money(result.ticket.price)}</span>
                          <span>Ticket {result.ticket.seq} of {result.ticket.ofTotal}</span>
                          <span className="font-mono text-xs opacity-80">{result.ticket.orderCode}</span>
                        </div>
                        {result.result === "already" && result.ticket.checkedInAt && <p className="mt-3 text-sm font-bold">First scanned at {fmtTime(result.ticket.checkedInAt)}</p>}
                      </div>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
              {busy && <div className="absolute right-4 top-4 h-3 w-3 animate-ping rounded-full bg-white" />}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void submit(manual.trim()); setManual(""); } }} className="mt-4 flex gap-3">
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
              <input className="field !rounded-full pl-11" placeholder="Camera not working? Paste or type the ticket code" value={manual} onChange={(e) => setManual(e.target.value)} />
            </div>
            <button className="btn btn-ghost" disabled={!manual.trim() || !eventId}>Check</button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="glass relative overflow-hidden rounded-3xl p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-fog-300"><Users className="h-4 w-4" />Attendance</p>
            <p className="mt-2 font-display text-7xl font-extrabold tabular-nums leading-none"><AnimatedNumber value={attendance} /></p>
            <p className="mt-2 text-sm text-fog-400">{event ? event.title : "Choose an event"}</p>
          </div>

          <div className="glass rounded-3xl p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-fog-300">Recent scans</h2>
            {recent.length === 0 ? (
              <p className="mt-4 text-sm text-fog-500">Scanned tickets will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recent.map((r, i) => {
                  const l = LOOK[r.result];
                  return (
                    <li key={r.at + "-" + i} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br", l.cls)}><l.Icon className="h-4 w-4" strokeWidth={3} /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{r.ticket?.name ?? "Unknown code"}</p><p className="text-xs text-fog-500">{l.title}</p></div>
                      {r.ticket && <TierBadge tier={r.ticket.tier} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
