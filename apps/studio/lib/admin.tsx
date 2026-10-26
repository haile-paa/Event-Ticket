"use client";

import { ApiError, Logo, Spinner, api, setApiBase } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, Link2, Plus, Server, Trash2, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * The Studio connects to ONE client server at a time. Each client = an API address + the secret
 * DEV_KEY of that server. Saved clients live only in this browser (localStorage).
 */
export interface Client {
  name: string;
  url: string;
  key: string;
}

const STORE = "tikit.studio.clients";
type Call = <T>(path: string, init?: RequestInit) => Promise<T>;

interface Ctx {
  client: Client;
  call: Call;
  logout: () => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
}
const C = createContext<Ctx | null>(null);

export function useAdmin() {
  const c = useContext(C);
  if (!c) throw new Error("useAdmin outside <StudioProvider>");
  return c;
}

function loadClients(): Client[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(v) ? v.filter((c) => c && c.url && c.key) : [];
  } catch {
    return [];
  }
}
function saveClients(list: Client[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface Toast { id: number; msg: string; kind: "ok" | "err" }

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 5200 : 2800);
  }, []);

  const connect = useCallback((c: Client) => {
    setApiBase(c.url);
    setClient(c);
  }, []);
  const logout = useCallback(() => setClient(null), []);

  const call: Call = useCallback(
    async (path, init) => {
      try {
        return await api(path, { ...init, devKey: client?.key ?? "" });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setClient(null);
        throw e;
      }
    },
    [client],
  );

  return (
    <>
      {client ? (
        <C.Provider key={client.url} value={{ client, call, logout, toast }}>
          {children}
        </C.Provider>
      ) : (
        <Connect onDone={connect} toast={toast} />
      )}
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
    </>
  );
}

function Connect({ onDone, toast }: { onDone: (c: Client) => void; toast: (m: string, k?: "ok" | "err") => void }) {
  const [saved, setSaved] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://localhost:8080");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const l = loadClients();
    setSaved(l);
    setAdding(l.length === 0);
  }, []);

  const tryConnect = async (c: Client, remember: boolean) => {
    setBusy(true);
    setErr("");
    try {
      setApiBase(c.url);
      await api("/api/studio/login", { method: "POST", devKey: c.key });
      if (remember) {
        const list = [...loadClients().filter((x) => x.url !== c.url), c];
        saveClients(list);
      }
      onDone(c);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not connect");
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim().replace(/\/$/, "");
    if (!/^https?:\/\//.test(u)) return setErr("The address must start with http:// or https://");
    void tryConnect({ name: name.trim() || u.replace(/^https?:\/\//, ""), url: u, key: key.trim() }, true);
  };

  const remove = (c: Client) => {
    const l = loadClients().filter((x) => x.url !== c.url);
    saveClients(l);
    setSaved(l);
    toast("Client removed from this browser");
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass w-full max-w-md rounded-[2rem] p-8">
        <Logo size={44} className="mx-auto w-fit" subtitle="Developer Studio" />
        <h1 className="mt-7 text-center text-2xl font-extrabold">Choose a client</h1>
        <p className="mt-1 text-center text-sm text-fog-400">Connect to the server of the event organizer you are setting up.</p>

        {saved.length > 0 && (
          <div className="mt-6 space-y-2">
            {saved.map((c) => (
              <div key={c.url} className="flex items-center gap-2 rounded-2xl bg-white/[0.05] p-1.5 ring-1 ring-white/10">
                <button disabled={busy} onClick={() => void tryConnect(c, false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.07]">
                  <Server className="h-4 w-4 shrink-0 text-brand-300" />
                  <span className="min-w-0"><b className="block truncate text-sm">{c.name}</b><span className="block truncate text-xs text-fog-500">{c.url}</span></span>
                </button>
                <button onClick={() => remove(c)} aria-label={`Remove ${c.name}`} className="grid h-9 w-9 place-items-center rounded-full text-fog-500 hover:bg-white/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {!adding && (
              <button onClick={() => setAdding(true)} className="btn btn-ghost w-full"><Plus className="h-4 w-4" />Add a new client</button>
            )}
          </div>
        )}

        {adding && (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div><label className="label">Client name (only for you)</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Habesha Events" /></div>
            <div>
              <label className="label">API address</label>
              <div className="relative"><Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" /><input className="field pl-11" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.client.com" inputMode="url" /></div>
            </div>
            <div>
              <label className="label">Developer key (DEV_KEY)</label>
              <div className="relative"><KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" /><input type="password" autoFocus className="field pl-11" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></div>
            </div>
            <button className="btn btn-primary w-full py-4" disabled={busy || !key.trim() || !url.trim()}>{busy ? <Spinner className="h-4 w-4" /> : "Connect"}</button>
            <p className="text-center text-xs text-fog-500">Saved clients are stored only in this browser.</p>
          </form>
        )}
        {err && <p role="alert" className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">{err}</p>}
      </motion.div>
    </div>
  );
}
