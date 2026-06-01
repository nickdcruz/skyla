// v1.0
// Build the Google Flights "TFS" filter payload as a JS array tree.
// The shape is reverse-engineered from Google's batchexecute requests for the
// /travel/flights surface. It is intentionally permissive: unknown fields are
// omitted rather than rejected.

import type { FlightSearchFilters } from "../models/google-flights/flights";
import type { DateSearchFilters } from "../models/google-flights/dates";
import { TripType } from "../models/google-flights/base";

function buildSegmentPayload(seg: { departure_airport: string[]; arrival_airport: string[]; travel_date: string }): unknown[] {
  return [
    [seg.departure_airport.map((a) => [a, 0])],
    [seg.arrival_airport.map((a) => [a, 0])],
    null,
    0, // stops marker, overridden by global filter
    [],
    null,
    seg.travel_date,
    null,
    [],
    [],
    [],
    null,
    null,
    [],
    3,
  ];
}

export function buildFlightSearchPayload(filters: FlightSearchFilters): unknown[] {
  const segments = filters.flight_segments.map((s) =>
    buildSegmentPayload({ departure_airport: s.departure_airport, arrival_airport: s.arrival_airport, travel_date: s.travel_date }),
  );

  const passengers: number[] = [];
  for (let i = 0; i < filters.passenger_info.adults; i++) passengers.push(1);
  for (let i = 0; i < filters.passenger_info.children; i++) passengers.push(2);
  for (let i = 0; i < filters.passenger_info.infants_in_seat; i++) passengers.push(3);
  for (let i = 0; i < filters.passenger_info.infants_on_lap; i++) passengers.push(4);

  return [
    null,
    [
      null,
      null,
      filters.trip_type,
      null,
      [],
      filters.seat_type,
      passengers,
      [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        filters.stops,
      ],
      null,
      null,
      null,
      null,
      null,
      null,
      segments,
      null,
      null,
      null,
      1, // emit "search flights" mode
    ],
    filters.sort_by,
    filters.show_all_results ? 0 : 1,
    0,
  ];
}

export function buildDateSearchPayload(filters: DateSearchFilters): unknown[] {
  const passengers: number[] = [];
  for (let i = 0; i < filters.passenger_info.adults; i++) passengers.push(1);
  for (let i = 0; i < filters.passenger_info.children; i++) passengers.push(2);
  for (let i = 0; i < filters.passenger_info.infants_in_seat; i++) passengers.push(3);
  for (let i = 0; i < filters.passenger_info.infants_on_lap; i++) passengers.push(4);

  const segments = filters.flight_segments.map((s) =>
    buildSegmentPayload({ departure_airport: s.departure_airport, arrival_airport: s.arrival_airport, travel_date: filters.from_date }),
  );

  return [
    null,
    [
      null,
      null,
      filters.trip_type ?? TripType.ONE_WAY,
      null,
      [],
      filters.seat_type,
      passengers,
      [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        filters.stops,
      ],
      null,
      null,
      null,
      null,
      null,
      null,
      segments,
    ],
    [filters.from_date, filters.to_date],
    null,
    1,
    1,
  ];
}

// Token builders used for booking URLs.
export function buildTfsToken(filters: FlightSearchFilters): string {
  // Minimal TFS encoding: serialise filter to JSON and base64url it so we have
  // a deterministic token. Real Google "tfs" tokens are protobufs; this still
  // round-trips through encodeURIComponent for use in URLs.
  const payload = {
    type: filters.trip_type,
    seat: filters.seat_type,
    stops: filters.stops,
    sort: filters.sort_by,
    segments: filters.flight_segments.map((s) => ({
      from: s.departure_airport, to: s.arrival_airport, date: s.travel_date,
    })),
    pax: filters.passenger_info,
  };
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64url");
  }
  // Fallback for non-Node environments.
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildBookingToken(flightRaw: unknown): string | null {
  if (flightRaw && typeof flightRaw === "object" && "booking_token" in flightRaw) {
    const tok = (flightRaw as { booking_token?: unknown }).booking_token;
    if (typeof tok === "string" && tok.length > 0) return tok;
  }
  return null;
}
