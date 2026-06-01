// v1.0
// Decoders for the Google Flights batchexecute response trees.
//
// The response is a deeply nested JSON array. We walk it defensively, pulling
// out flight cards by looking for substructures that match a known shape:
//   [legs[], total_duration, ..., price, currency, ...]
// All extraction is best-effort. Anything we can't parse becomes null.

import { asInt, asNonNegativeInt, asStr, safeGet } from "./helpers";
import { extractCurrencyFromPriceToken } from "../core/currency";
import { AIRLINE_NAMES } from "../models/airline";
import { AIRPORT_NAMES } from "../models/airport";

export interface DecodedLeg {
  airline: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_airport_name?: string;
  arrival_airport_name?: string;
  departure_datetime: Date;
  arrival_datetime: Date;
  duration: number;
  aircraft?: string;
  legroom?: string;
  amenities?: { wifi?: boolean } | null;
  overnight?: boolean;
}

export interface DecodedFlight {
  legs: DecodedLeg[];
  duration: number;
  stops: number;
  price: number | null;
  currency: string | null;
  emissions_tag: string | null;
  primary_airline: string | null;
  primary_airline_name: string | null;
  booking_token: string | null;
}

export interface DecodedDatePrice {
  date: [Date, Date | null];
  price: number;
  currency: string | null;
}

function parseDateTimeParts(parts: unknown): Date | null {
  if (!Array.isArray(parts) || parts.length < 3) return null;
  const [y, m, d, hh, mm] = parts.map((p) => (typeof p === "number" ? p : 0));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, hh ?? 0, mm ?? 0, 0));
}

function looksLikeLeg(node: unknown): boolean {
  if (!Array.isArray(node) || node.length < 5) return false;
  // Heuristic: contains an IATA-looking string in slot 0 (airline) and another in slot 3/4 (airport code).
  const a0 = safeGet(node, 0);
  return typeof a0 === "string" && /^[A-Z0-9]{2,3}$/.test(a0);
}

function decodeLeg(raw: unknown): DecodedLeg | null {
  if (!Array.isArray(raw)) return null;
  const airline = asStr(safeGet(raw, 0)) ?? "";
  const flightNumber = asStr(safeGet(raw, 1)) ?? "";
  const departureAirport = asStr(safeGet(raw, 3)) ?? asStr(safeGet(raw, 2)) ?? "";
  const arrivalAirport = asStr(safeGet(raw, 6)) ?? asStr(safeGet(raw, 5)) ?? "";
  const depParts = safeGet(raw, 8);
  const arrParts = safeGet(raw, 10);
  const dep = parseDateTimeParts(depParts) ?? new Date(0);
  const arr = parseDateTimeParts(arrParts) ?? new Date(0);
  const duration = asNonNegativeInt(safeGet(raw, 11)) ?? 0;
  if (!airline || !departureAirport || !arrivalAirport) return null;
  const airlineKey = airline.startsWith("_") ? airline.slice(1) : airline;
  return {
    airline,
    flight_number: flightNumber || `${airline} ${asInt(safeGet(raw, 2)) ?? ""}`.trim(),
    departure_airport: departureAirport,
    arrival_airport: arrivalAirport,
    departure_airport_name: AIRPORT_NAMES[departureAirport],
    arrival_airport_name: AIRPORT_NAMES[arrivalAirport],
    departure_datetime: dep,
    arrival_datetime: arr,
    duration,
    aircraft: asStr(safeGet(raw, 17)) ?? undefined,
    legroom: undefined,
    amenities: null,
    overnight: dep.getTime() > 0 && arr.getTime() > 0 && (arr.getUTCDate() !== dep.getUTCDate()),
    // airline_name lookup for downstream serialisers
    ...((): Record<string, string | undefined> => ({ airline_name: AIRLINE_NAMES[airlineKey] })),
  } as DecodedLeg;
}

function tryDecodeFlightCard(node: unknown): DecodedFlight | null {
  if (!Array.isArray(node)) return null;
  // Find a sub-array of legs
  const legsRaw = node.find((c) => Array.isArray(c) && c.length > 0 && c.every(looksLikeLeg));
  if (!Array.isArray(legsRaw)) return null;
  const legs: DecodedLeg[] = [];
  for (const lr of legsRaw) {
    const decoded = decodeLeg(lr);
    if (decoded) legs.push(decoded);
  }
  if (legs.length === 0) return null;

  // Scan the rest of node for a price token.
  let price: number | null = null;
  let currency: string | null = null;
  const priceCandidates: Array<{ amount: number; currency: string | null }> = [];
  const walk = (n: unknown): void => {
    if (n == null) return;
    if (typeof n === "number" && n > 0 && n < 100000 && Number.isInteger(n)) {
      // ambiguous; keep as fallback only
    }
    if (typeof n === "string") {
      const cur = extractCurrencyFromPriceToken(n);
      if (cur) {
        const m = n.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)/);
        if (m) priceCandidates.push({ amount: parseFloat(m[1]!), currency: cur });
      }
    } else if (Array.isArray(n)) {
      for (const c of n) walk(c);
    }
  };
  walk(node);
  if (priceCandidates.length > 0) {
    // Choose the largest amount, which is typically the total fare.
    priceCandidates.sort((a, b) => b.amount - a.amount);
    price = priceCandidates[0]!.amount;
    currency = priceCandidates[0]!.currency;
  }

  const totalDuration = legs.reduce((sum, l) => sum + l.duration, 0);
  const stops = Math.max(0, legs.length - 1);
  const primary = legs[0]?.airline ?? null;
  const primaryKey = primary && primary.startsWith("_") ? primary.slice(1) : primary;

  return {
    legs,
    duration: totalDuration,
    stops,
    price,
    currency,
    emissions_tag: null,
    primary_airline: primary,
    primary_airline_name: primaryKey ? (AIRLINE_NAMES[primaryKey] ?? null) : null,
    booking_token: null,
  };
}

export function decodeFlightResponse(parsed: unknown): DecodedFlight[][] {
  // Walk the parsed tree and gather flight cards.
  const cards: DecodedFlight[] = [];
  const seen = new WeakSet<object>();
  const walk = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (seen.has(n as object)) return;
    seen.add(n as object);
    if (Array.isArray(n)) {
      const decoded = tryDecodeFlightCard(n);
      if (decoded) {
        cards.push(decoded);
        return;
      }
      for (const c of n) walk(c);
    }
  };
  walk(parsed);
  return [cards];
}

export function decodeDateResponse(parsed: unknown): DecodedDatePrice[] {
  const out: DecodedDatePrice[] = [];
  const seen = new WeakSet<object>();
  const walk = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (seen.has(n as object)) return;
    seen.add(n as object);
    if (Array.isArray(n)) {
      // Look for [["YYYY-MM-DD"], price] shapes.
      if (n.length >= 2) {
        const dateSlot = safeGet(n, 0);
        const priceSlot = safeGet(n, 1);
        let dateStr: string | null = null;
        if (Array.isArray(dateSlot)) {
          const s = safeGet(dateSlot, 0);
          if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) dateStr = s;
        } else if (typeof dateSlot === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateSlot)) {
          dateStr = dateSlot;
        }
        if (dateStr && typeof priceSlot === "number" && priceSlot > 0) {
          const [y, m, d] = dateStr.split("-").map(Number);
          out.push({ date: [new Date(Date.UTC(y!, m! - 1, d!)), null], price: priceSlot, currency: null });
          return;
        }
      }
      for (const c of n) walk(c);
    }
  };
  walk(parsed);
  return out;
}
