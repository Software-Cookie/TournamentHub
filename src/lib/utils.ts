import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format integer paise as Indian Rupees. */
export function formatMoney(paise: number | null | undefined, currency = "INR") {
  const v = (paise ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: v % 1 === 0 ? 0 : 2,
  }).format(v);
}

export function rupeesToPaise(rupees: number) {
  return Math.round(rupees * 100);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const TZ = "Asia/Kolkata";

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ, ...opts }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ,
  }).format(new Date(d));
}

export function formatTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(d));
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function mapsLink(venue: { mapUrl?: string | null; name: string; addressLine: string; city: string; latitude?: number | null; longitude?: number | null } | null | undefined) {
  if (!venue) return null;
  if (venue.mapUrl) return venue.mapUrl;
  if (venue.latitude != null && venue.longitude != null)
    return `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.addressLine}, ${venue.city}`)}`;
}

export function mapsEmbed(venue: { name: string; addressLine: string; city: string; latitude?: number | null; longitude?: number | null } | null | undefined) {
  if (!venue) return null;
  const q = venue.latitude != null && venue.longitude != null ? `${venue.latitude},${venue.longitude}` : `${venue.name}, ${venue.addressLine}, ${venue.city}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
