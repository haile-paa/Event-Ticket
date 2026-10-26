"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Loads data now and keeps refreshing it while the tab is visible. */
export function usePoll<T>(fn: () => Promise<T>, ms: number | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const load = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    if (!ms) return;
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, load, ...deps]);

  return { data, error, loading, reload: load, setData };
}

let audio: AudioContext | null = null;

/** Short beep: "ok" (two rising tones), "bad" (low buzz) or "ping" (single soft tone). */
export function beep(kind: "ok" | "bad" | "ping" = "ping") {
  try {
    audio = audio ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    const tones: [number, number, number][] =
      kind === "ok" ? [[660, 0, 0.12], [990, 0.12, 0.18]] : kind === "bad" ? [[170, 0, 0.35]] : [[880, 0, 0.14]];
    tones.forEach(([freq, at, dur]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === "bad" ? "sawtooth" : "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + dur + 0.05);
    });
  } catch {
    /* sound is optional */
  }
}
