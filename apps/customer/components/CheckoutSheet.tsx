"use client";

import {
  ApiError,
  Spinner,
  TIER_META,
  cn,
  useSite,
  money,
  publicApi,
  type PayKey,
  type PayMethod,
  type TierName,
  type TikitEvent,
} from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Copy, ImagePlus, Landmark, Lock, MessageSquareText, Smartphone, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadProfile, rememberOrder, saveProfile } from "@/lib/myOrders";

export type Selection = Partial<Record<TierName, number>>;


const BRAND: Record<PayKey, { grad: string; Icon: typeof Smartphone; blurb: string }> = {
  telebirr: { grad: "linear-gradient(135deg,#22d3ee,#3b82f6)", Icon: Smartphone, blurb: "Mobile money" },
  cbe: { grad: "linear-gradient(135deg,#c084fc,#7c3aed)", Icon: Landmark, blurb: "Bank transfer" },
  abyssinia: { grad: "linear-gradient(135deg,#fcd34d,#f59e0b)", Icon: Landmark, blurb: "Bank transfer" },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className="btn btn-ghost !px-3.5 !py-2 text-xs" aria-label={`Copy ${label}`}>
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function CheckoutSheet({ event, selection, onClose }: { event: TikitEvent; selection: Selection; onClose: () => void }) {
  const router = useRouter();
  const { t } = useSite();
  const STEPS = [t("checkout.step1"), t("checkout.step2"), t("checkout.step3")];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [methods, setMethods] = useState<PayMethod[] | null>(null);
  const [method, setMethod] = useState<PayKey | null>(null);
  const [mode, setMode] = useState<"image" | "sms">("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sms, setSms] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () =>
      (Object.entries(selection) as [TierName, number][])
        .filter(([, q]) => q > 0)
        .map(([tier, qty]) => ({ tier, qty, price: event.tiers.find((t) => t.name === tier)?.price ?? 0 })),
    [selection, event.tiers],
  );
  const total = items.reduce((n, i) => n + i.qty * i.price, 0);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const chosen = methods?.find((m) => m.key === method) ?? null;

  useEffect(() => {
    const p = loadProfile();
    setName(p.name);
    setPhone(p.phone);
    publicApi
      .paymentMethods()
      .then((r) => setMethods(r.methods))
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load payment methods"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const cleanPhone = phone.replace(/[\s\-()]/g, "");
  const phoneOk = /^\+?\d{9,15}$/.test(cleanPhone);
  const nameOk = name.trim().length >= 2;

  const pickFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Please choose an image (a screenshot of your payment).");
    if (f.size > 10 * 1024 * 1024) return setErr("That image is bigger than 10 MB. Try a smaller screenshot.");
    setErr("");
    setFile(f);
  }, []);

  const go = (n: number) => {
    setErr("");
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const next = () => {
    if (step === 0) {
      if (!nameOk) return setErr("Please enter your full name.");
      if (!phoneOk) return setErr("Please enter a valid phone number, like 0911 234 567.");
      go(1);
    } else if (step === 1) {
      if (!method) return setErr("Choose how you'd like to pay.");
      go(2);
    }
  };

  const submit = async () => {
    setErr("");
    if (!method) return;
    if (mode === "image" && !file) return setErr("Add your payment screenshot, or switch to “SMS text”.");
    if (mode === "sms" && sms.trim().length < 10) return setErr("Paste the full SMS you received from the bank.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("eventId", event.id);
      fd.set("name", name.trim());
      fd.set("phone", cleanPhone);
      fd.set("method", method);
      fd.set("items", JSON.stringify(items.map(({ tier, qty }) => ({ tier, qty }))));
      if (mode === "image" && file) fd.set("proof", file);
      else fd.set("sms", sms.trim());
      const order = await publicApi.createOrder(fd);
      rememberOrder(order.id);
      saveProfile({ name: name.trim(), phone: cleanPhone });
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        initial={{ opacity: 0, y: 70, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 70 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-ink-850 shadow-2xl sm:max-w-lg sm:rounded-[2rem]"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-brand-300">{t("checkout.title")}</p>
            <h3 className="mt-1 truncate font-display text-2xl font-extrabold">{event.title}</h3>
          </div>
          <button onClick={() => !busy && onClose()} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-colors duration-500", i < step ? "bg-emerald-400 text-ink-950" : i === step ? "bg-brand-gradient text-white" : "bg-white/10 text-fog-400")}>
                {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : i + 1}
              </span>
              <span className={cn("hidden text-xs font-bold sm:block", i === step ? "text-white" : "text-fog-500")}>{s}</span>
              {i < STEPS.length - 1 && (
                <span className="relative h-0.5 flex-1 overflow-hidden rounded bg-white/10">
                  <motion.span className="absolute inset-y-0 left-0 bg-emerald-400" animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* summary */}
        <div className="mx-6 mt-5 flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
          <div className="flex flex-wrap gap-1.5">
            {items.map((i) => (
              <span key={i.tier} className="rounded-full px-2.5 py-1 text-xs font-bold text-ink-950" style={{ background: TIER_META[i.tier].gradient }}>
                {i.qty} × {TIER_META[i.tier].label}
              </span>
            ))}
          </div>
          <p className="font-display text-xl font-extrabold">{money(total)}</p>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-5">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -36 }}
              transition={{ duration: 0.22 }}
            >
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="label" htmlFor="c-name">{t("checkout.name")}</label>
                    <input id="c-name" className="field" placeholder="e.g. Abebe Kebede" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="c-phone">{t("checkout.phone")}</label>
                    <input id="c-phone" className="field" placeholder="0911 234 567" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <p className="flex items-center gap-2 text-xs text-fog-400"><Lock className="h-3.5 w-3.5 shrink-0" />{t("checkout.privacy")}</p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  {!methods && !err && <div className="grid place-items-center py-10"><Spinner /></div>}
                  {methods?.map((m) => {
                    const b = BRAND[m.key];
                    const active = method === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMethod(m.key)}
                        className={cn("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition", active ? "border-brand-400 bg-brand-500/15 ring-4 ring-brand-500/15" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]")}
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-ink-950" style={{ background: b.grad }}><b.Icon className="h-6 w-6" /></span>
                        <span className="flex-1">
                          <span className="block font-display text-lg font-bold">{m.label}</span>
                          <span className="block text-xs text-fog-400">{b.blurb}</span>
                        </span>
                        <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 transition", active ? "border-brand-400 bg-brand-400" : "border-white/25")}>
                          {active && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                        </span>
                      </button>
                    );
                  })}

                  <AnimatePresence initial={false}>
                    {chosen && (
                      <motion.div key={chosen.key} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-1 rounded-2xl p-5 ring-1 ring-white/15" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--color-brand-500) 18%, transparent), color-mix(in srgb, var(--color-hot-500) 10%, transparent))" }}>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-fog-300">{t("checkout.sendExactly")}</p>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="font-display text-3xl font-extrabold">{money(total)}</p>
                            <CopyButton text={String(total)} label="amount" />
                          </div>
                          <div className="my-4 h-px bg-white/10" />
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-fog-300">{chosen.key === "telebirr" ? "Telebirr number" : "Account number"}</p>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="font-mono text-2xl font-bold tracking-wider">{chosen.accountNumber}</p>
                            <CopyButton text={chosen.accountNumber.replace(/\s/g, "")} label="account number" />
                          </div>
                          <p className="mt-2 text-sm text-fog-300">Account name: <b className="text-white">{chosen.accountName}</b></p>
                          {chosen.note && <p className="mt-1 text-xs text-fog-400">{chosen.note}</p>}
                        </div>
                        <ol className="mt-3 space-y-1.5 px-1 text-xs leading-relaxed text-fog-400">
                          <li><b className="text-fog-200">1.</b> Pay the amount above in your {chosen.key === "telebirr" ? "Telebirr app" : "banking app"}.</li>
                          <li><b className="text-fog-200">2.</b> Take a screenshot of the receipt, or copy the confirmation SMS.</li>
                          <li><b className="text-fog-200">3.</b> Tap Continue and place your order with that proof.</li>
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="glass grid grid-cols-2 rounded-full p-1">
                    {([["image", "Screenshot", ImagePlus], ["sms", "SMS text", MessageSquareText]] as const).map(([k, label, Icon]) => (
                      <button key={k} type="button" onClick={() => { setMode(k); setErr(""); }} className={cn("relative flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors", mode === k ? "text-white" : "text-fog-400")}>
                        {mode === k && <motion.span layoutId="proof-mode" className="absolute inset-0 rounded-full bg-brand-gradient" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <span className="relative flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
                      </button>
                    ))}
                  </div>

                  {mode === "image" ? (
                    <div>
                      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                      {preview ? (
                        <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/15">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="Payment screenshot preview" className="max-h-72 w-full bg-black/40 object-contain" />
                          <button type="button" onClick={() => setFile(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 hover:bg-black" aria-label="Remove screenshot"><X className="h-4 w-4" /></button>
                          <button type="button" onClick={() => fileInput.current?.click()} className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold hover:bg-black">Change</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                          onDragLeave={() => setDrag(false)}
                          onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
                          className={cn("flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-brand-400 bg-brand-500/15" : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]")}
                        >
                          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient shadow-lg shadow-hot-500/25"><Upload className="h-6 w-6" /></span>
                          <span className="font-display text-lg font-bold">{t("checkout.uploadTitle")}</span>
                          <span className="text-xs text-fog-400">Tap to choose a photo, or drop it here · JPG, PNG up to 10 MB</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="label" htmlFor="c-sms">Paste the bank SMS</label>
                      <textarea id="c-sms" rows={6} className="field resize-none font-mono text-sm" placeholder="Dear customer, you have transferred ETB … Transaction ID …" value={sms} onChange={(e) => setSms(e.target.value)} />
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-brand-300 hover:text-white"
                        onClick={async () => {
                          try { setSms(await navigator.clipboard.readText()); } catch { /* user can paste manually */ }
                        }}
                      >
                        <ClipboardPaste className="h-3.5 w-3.5" />Paste from clipboard
                      </button>
                    </div>
                  )}
                  <p className="text-xs leading-relaxed text-fog-400">{t("checkout.pendingNote")}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {err && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/30">
                {err}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* footer */}
        <div className="flex items-center gap-3 border-t border-white/[0.07] px-6 py-4">
          {step > 0 && (
            <button type="button" disabled={busy} onClick={() => go(step - 1)} className="btn btn-ghost !px-4" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
          )}
          {step < 2 ? (
            <button type="button" onClick={next} className="btn btn-primary flex-1 py-4">{t("checkout.continue")} <ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={submit} disabled={busy} className="btn btn-primary flex-1 py-4">
              {busy ? <><Spinner className="h-4 w-4" />Placing order…</> : <>{t("checkout.placeOrder")} · {money(total)}</>}
            </button>
          )}
        </div>
        <p className="sr-only">{count} tickets</p>
      </motion.div>
    </div>
  );
}
