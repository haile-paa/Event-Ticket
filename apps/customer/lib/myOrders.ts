"use client";

import { useEffect, useState } from "react";

// There are no accounts on Tikit. The browser simply remembers which orders were placed on this device.
const KEY = "tikit.orders.v1";
const PROFILE = "tikit.profile.v1";
const EVT = "tikit:orders";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberOrder(id: string) {
  try {
    const next = [id, ...read().filter((x) => x !== id)].slice(0, 40);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* private mode: ignore */
  }
}

export function useMyOrderIds() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export function loadProfile(): { name: string; phone: string } {
  try {
    const v = JSON.parse(localStorage.getItem(PROFILE) || "{}");
    return { name: v.name || "", phone: v.phone || "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export function saveProfile(p: { name: string; phone: string }) {
  try {
    localStorage.setItem(PROFILE, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
