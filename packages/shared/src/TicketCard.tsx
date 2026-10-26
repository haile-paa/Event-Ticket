"use client";

import { img } from "./api";
import { TIER_META, dayParts, fmtTime, money, qrPayload } from "./format";
import { Logo } from "./Logo";
import { useSite } from "./SiteProvider";
import type { EventBrief, Ticket } from "./types";
import { Calendar, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { forwardRef } from "react";

/** The digital receipt: event, name, section, amount and the entrance QR code. */
export const TicketCard = forwardRef<HTMLDivElement, { ticket: Ticket; event?: EventBrief }>(function TicketCard({ ticket, event }, ref) {
  const meta = TIER_META[ticket.tier];
  const d = event ? dayParts(event.startsAt) : null;
  const { t } = useSite();

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[23rem] overflow-hidden rounded-[2rem] text-white"
      style={{ background: "#0e0e18", boxShadow: `0 40px 90px -35px ${meta.ring}, 0 0 0 1px rgba(255,255,255,.08)` }}
    >
      {/* header */}
      <div className="relative h-44 overflow-hidden" style={{ background: meta.gradient }}>
        {event?.cover && (
          <div data-export-skip="true" className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(event.cover)} alt="" crossOrigin="anonymous" className="h-full w-full object-cover opacity-80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e18] via-[#0e0e18]/55 to-transparent" />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          <Logo size={28} className="[&_span]:!text-base" />
        </div>
        <span className="absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-ink-950" style={{ background: meta.gradient }}>
          {meta.label}
        </span>
        <div className="absolute inset-x-5 bottom-4">
          <h3 className="font-display text-2xl font-extrabold leading-tight">{ticket.eventTitle}</h3>
        </div>
      </div>

      {/* details */}
      <div className="px-5 pb-5 pt-3">
        {event && d && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-fog-300">
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{d.weekday.slice(0, 3)}, {d.day} {d.month} {d.year} · {fmtTime(event.startsAt)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fog-500">{t("ticket.holder")}</p>
            <p className="mt-0.5 break-words font-display text-xl font-bold">{ticket.name}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fog-500">{t("ticket.section")}</p>
            <p className="mt-0.5 font-display text-lg font-bold" style={{ color: meta.text }}>{meta.label}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fog-500">{t("ticket.amount")}</p>
            <p className="mt-0.5 font-display text-lg font-bold">{money(ticket.price)}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fog-500">Ticket</p>
            <p className="mt-0.5 font-display text-lg font-bold">{ticket.seq} <span className="text-fog-500">of {ticket.ofTotal}</span></p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fog-500">Order</p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-wide">{ticket.orderCode}</p>
          </div>
        </div>
      </div>

      {/* perforation */}
      <div className="relative h-6">
        <span className="absolute -left-3 top-0 h-6 w-6 rounded-full" style={{ background: "#06060b" }} />
        <span className="absolute -right-3 top-0 h-6 w-6 rounded-full" style={{ background: "#06060b" }} />
        <div className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-white/15" />
      </div>

      {/* QR */}
      <div className="flex flex-col items-center px-5 pb-6 pt-3">
        <div className="rounded-2xl bg-white p-3.5 shadow-xl shadow-black/40">
          <QRCodeSVG value={qrPayload(ticket)} size={176} level="Q" bgColor="#ffffff" fgColor="#0a0a12" marginSize={0} />
        </div>
        <p className="mt-3 font-mono text-[0.7rem] tracking-[0.25em] text-fog-500">{ticket.token.toUpperCase().match(/.{1,4}/g)?.join(" ")}</p>
        <p className="mt-1 text-center text-xs text-fog-400">{t("ticket.entrance")}</p>
        {t("ticket.receiptNote") && <p className="mt-2 text-center text-[0.7rem] text-fog-500">{t("ticket.receiptNote")}</p>}
      </div>

      {ticket.checkedIn && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950/65 backdrop-blur-[2px]">
          <span className="-rotate-12 rounded-xl border-4 border-emerald-400 px-6 py-2 font-display text-3xl font-extrabold uppercase tracking-widest text-emerald-400">{t("ticket.checkedIn")}</span>
        </div>
      )}
    </div>
  );
});
