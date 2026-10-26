import type { TikitEvent } from "@tikit/shared";

export const minPrice = (e: TikitEvent) => (e.tiers.length ? Math.min(...e.tiers.map((t) => t.price)) : 0);
export const totalAvailable = (e: TikitEvent) => e.tiers.reduce((n, t) => n + t.available, 0);
export const totalCapacity = (e: TikitEvent) => e.tiers.reduce((n, t) => n + t.capacity, 0);
export const isSoldOut = (e: TikitEvent) => e.tiers.length > 0 && totalAvailable(e) === 0;
export const isFewLeft = (e: TikitEvent) => {
  const cap = totalCapacity(e);
  const left = totalAvailable(e);
  return cap > 0 && left > 0 && left / cap <= 0.15;
};
