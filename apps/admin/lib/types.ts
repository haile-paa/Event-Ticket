import type { Order, TikitEvent, Ticket, TierName } from "@tikit/shared";

export interface EventStat {
  id: string;
  title: string;
  status: "upcoming" | "live" | "past";
  revenue: number;
  sold: number;
  capacity: number;
  checkedIn: number;
  pending: number;
  byTier: Partial<Record<TierName, number>>;
}

export interface Stats {
  revenue: number;
  ticketsSold: number;
  pending: number;
  approved: number;
  rejected: number;
  checkedIn: number;
  events: EventStat[];
}

export interface AttendeesResponse {
  event: TikitEvent;
  tickets: Ticket[];
  total: number;
  checkedIn: number;
}

export interface CheckinResponse {
  result: "accepted" | "already" | "wrong_event" | "invalid";
  message: string;
  ticket?: Ticket;
  attendance: number;
  total: number;
}

export type AdminOrder = Order;
