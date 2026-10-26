"use client";

import { ApiError, Logo, Spinner, api, useSite } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const KEY = "tikit.admin.pin";

type Call = <T>(path: string, init?: RequestInit) => Promise<T>;

interface AdminCtx {
  call: Call;
  logout: () => void;
  setPin: (pin: string) => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside <AdminProvider>");
  return c;
}

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err";
}

/** PIN gate + API helper + toasts for the whole admin console. */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { site } = useSite();
  const [pin, setPinState] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 5200 : 2800);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setPinState(null);
  }, []);

  const setPin = useCallback((p: string) => {
    try {
      sessionStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
    setPinState(p);
  }, []);

  // restore the PIN typed earlier in this browser tab and check it is still valid
  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY) || "";
    } catch {
      /* ignore */
    }
    if (!saved) {
      setChecking(false);
      return;
    }
    api("/api/admin/login", { method: "POST", body: JSON.stringify({ pin: saved }) })
      .then(() => setPinState(saved))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  const call: Call = useCallback(
    async (path, init) => {
      try {
        return await api(path, { ...init, pin: pin ?? "" });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) logout();
        throw e;
      }
    },
    [pin, logout],
  );

  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ call, logout, setPin, toast }}>
      {pin === null ? <Login onDone={setPin} name={site.brand.name} /> : children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ring-1 backdrop-blur-xl ${
                t.kind === "ok" ? "bg-emerald-500/90 text-emerald-950 ring-emerald-300/40" : "bg-rose-500/90 text-white ring-rose-300/40"
              }`}
            >
              {t.kind === "ok" ? <Check className="h-4 w-4 shrink-0" strokeWidth={3} /> : <TriangleAlert className="h-4 w-4 shrink-0" />}
              {t.msg}
              <button onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} className="ml-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function Login({ onDone, name }: { onDone: (pin: string) => void; name: string }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ pin }) });
      onDone(pin.trim());
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass w-full max-w-sm rounded-[2rem] p-8 text-center"
      >
        <Logo size={44} className="mx-auto" subtitle="Owner console" />
        <h1 className="mt-8 text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-fog-400">Enter the admin PIN to manage {name}.</p>
        <div className="relative mt-6">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
          <input
            autoFocus
            type="password"
            inputMode="text"
            autoComplete="current-password"
            className="field pl-11 text-center text-lg tracking-[0.4em]"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            aria-label="Admin PIN"
          />
        </div>
        {err && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">
            {err}
          </p>
        )}
        <button className="btn btn-primary mt-5 w-full py-4" disabled={busy || !pin.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : "Unlock"}
        </button>
      </motion.form>
    </div>
  );
}
