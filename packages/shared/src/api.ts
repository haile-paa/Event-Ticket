import type { EventStatus, OrderView, PayMethod, TikitEvent } from "./types";

export let API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

/** Points every call at another server (the developer Studio switches between client servers). */
export function setApiBase(url: string) {
  API_URL = url.trim().replace(/\/$/, "");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Turns "/uploads/x.jpg" into a full URL that points at the Go API. */
export const img = (url?: string | null): string => {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : API_URL + url;
};

export async function api<T>(path: string, init: (RequestInit & { pin?: string; devKey?: string }) = {}): Promise<T> {
  const { pin, devKey, headers, body, ...rest } = init;
  const h = new Headers(headers);
  if (pin) h.set("X-Admin-Pin", pin);
  if (devKey) h.set("X-Dev-Key", devKey);
  if (body && !(body instanceof FormData) && !h.has("Content-Type")) h.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...rest, body, headers: h, cache: "no-store" });
  } catch {
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** Calls used by the customer website (no sign-in needed). */
export const publicApi = {
  events: (status?: EventStatus) => api<TikitEvent[]>(`/api/events${status ? `?status=${status}` : ""}`),
  event: (id: string) => api<TikitEvent>(`/api/events/${id}`),
  paymentMethods: () => api<{ methods: PayMethod[] }>("/api/payment-methods"),
  createOrder: (form: FormData) => api<OrderView>("/api/orders", { method: "POST", body: form }),
  order: (id: string) => api<OrderView>(`/api/orders/${id}`),
  orders: (ids: string[]) => api<OrderView[]>(`/api/orders?ids=${ids.join(",")}`),
  lookup: (code: string, phone: string) =>
    api<OrderView>(`/api/orders/lookup?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`),
};
