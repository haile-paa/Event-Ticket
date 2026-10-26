export type TierName = "regular" | "vip" | "vvip";
export type EventStatus = "upcoming" | "live" | "past";
export type PayKey = "telebirr" | "cbe" | "abyssinia";
export type OrderStatus = "pending" | "approved" | "rejected";

export interface Tier {
  name: TierName;
  price: number;
  capacity: number;
  available: number;
  perks: string;
}

export interface TikitEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
  cover: string;
  gallery: string[];
  tiers: Tier[];
  checkedIn: number;
  override: "" | "live" | "ended";
  createdAt: string;
  status: EventStatus;
}

export interface EventBrief {
  id: string;
  title: string;
  cover: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
}

export interface PayMethod {
  key: PayKey;
  label: string;
  accountName: string;
  accountNumber: string;
  note: string;
  enabled: boolean;
}

export interface OrderItem {
  tier: TierName;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  code: string;
  eventId: string;
  eventTitle: string;
  name: string;
  phone: string;
  method: PayKey;
  items: OrderItem[];
  totalTickets: number;
  total: number;
  proof: { imageUrl: string; smsText: string };
  status: OrderStatus;
  rejectReason: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface Ticket {
  id: string;
  token: string;
  orderId: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  name: string;
  phone: string;
  tier: TierName;
  price: number;
  seq: number;
  ofTotal: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
}

export interface OrderView extends Order {
  tickets: Ticket[];
  event?: EventBrief;
}
