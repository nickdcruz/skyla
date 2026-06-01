// v1.1
/**
 * Flight search orchestrator — GetShoppingResults.
 * 1:1 port of fli/search/flights.py.
 */

import type { FlightResult } from "../models/google-flights/base";
import { TripType } from "../models/google-flights/base";
import { FlightSearchFilters } from "../models/google-flights/flights";
import { type Client, getClient } from "./client";
import { parseFlightRow } from "./decoders";
import { SearchParseError } from "./exceptions";
import { buildTfsToken, type LegSpec } from "./proto";
import { withLocaleParams } from "./urls";
import { parseFirstWrbPayload } from "./wire";

export interface SearchOptions {
  topN?: number;
  currency?: string | null;
  language?: string | null;
  country?: string | null;
}

export class SearchFlights {
  static readonly BASE_URL =
    "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

  private readonly client: Client;
  private _lastSessionId: string | null = null;

  constructor(client?: Client) {
    this.client = client ?? getClient();
  }

  /** Search for flights using the given filters. */
  async search(
    filters: FlightSearchFilters,
    options: SearchOptions = {},
  ): Promise<Array<FlightResult | FlightResult[]> | null> {
    const topN = options.topN ?? 5;
    const flights = await this._fetchFlights(filters, {
      currency: options.currency ?? null,
      language: options.language ?? null,
      country: options.country ?? null,
      captureSession: true,
    });
    if (flights == null) return null;
    if (filters.trip_type === TripType.ONE_WAY) return flights;
    return this._expandMultiLeg(flights, filters, {
      topN,
      currency: options.currency ?? null,
      language: options.language ?? null,
      country: options.country ?? null,
    });
  }

  private async _fetchFlights(
    filters: FlightSearchFilters,
    opts: {
      currency: string | null;
      language: string | null;
      country: string | null;
      captureSession: boolean;
    },
  ): Promise<FlightResult[] | null> {
    const encoded = filters.encode();
    const url = withLocaleParams(
      SearchFlights.BASE_URL,
      opts.currency,
      opts.language,
      opts.country,
    );
    const response = await this.client.post(url, { body: `f.req=${encoded}` });
    const inner = parseFirstWrbPayload(response.text);
    if (inner == null) return null;

    if (opts.captureSession) this._captureSessionId(inner);

    if (!Array.isArray(inner)) {
      throw new SearchParseError("Shopping response shape changed — top-level is not an array");
    }

    const flightsRaw: unknown[] = [];
    for (const i of [2, 3]) {
      const block = inner[i];
      if (Array.isArray(block) && Array.isArray(block[0])) {
        for (const item of block[0]) flightsRaw.push(item);
      }
    }

    const flights: FlightResult[] = [];
    const failureSamples: string[] = [];
    let anyFailure = false;
    for (const row of flightsRaw) {
      if (!Array.isArray(row)) continue;
      try {
        flights.push(parseFlightRow(row));
      } catch (err) {
        anyFailure = true;
        const reason = `${err instanceof Error ? err.name : "Error"}: ${err instanceof Error ? err.message : String(err)}`;
        if (!failureSamples.includes(reason) && failureSamples.length < 3) {
          failureSamples.push(reason);
        }
      }
    }

    if (flightsRaw.length > 0 && anyFailure && flights.length === 0) {
      const sample = failureSamples.join("; ");
      throw new SearchParseError(
        `Parsed 0/${flightsRaw.length} flight rows — Google response shape may have changed (sample reasons: ${sample})`,
      );
    }

    return flights.length > 0 ? flights : null;
  }

  /**
   * Build a Google Flights deep-link URL for a specific itinerary.
   */
  buildFlightBookingUrl(
    flight: FlightResult | FlightResult[],
    options: { currency?: string | null; language?: string | null; country?: string | null } = {},
  ): string {
    const results: FlightResult[] = Array.isArray(flight) ? flight : [flight];
    const isOneWay = results.length !== 2;

    const iata = (x: unknown): string => String(x).replace(/^_/, "");
    const depDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let url: string;
    try {
      const segments: LegSpec[][] = results.map((result) =>
        result.legs.map((leg) => ({
          origin: iata(leg.departure_airport),
          depDate: depDate(leg.departure_datetime),
          dest: iata(leg.arrival_airport),
          airline: iata(leg.airline),
          flightNumber: leg.flight_number,
        })),
      );
      const tfs = buildTfsToken(segments, { isOneWay });
      url = `https://www.google.com/travel/flights/booking?tfs=${tfs}`;
    } catch {
      url = "https://www.google.com/travel/flights";
    }

    return withLocaleParams(
      url,
      options.currency ?? null,
      options.language ?? null,
      options.country ?? null,
    );
  }

  private _captureSessionId(inner: unknown): void {
    if (!Array.isArray(inner)) return;
    const first = inner[0];
    if (!Array.isArray(first)) return;
    const session = first[4];
    if (typeof session === "string" && session.length > 0) {
      this._lastSessionId = session;
    }
  }

  private async _expandMultiLeg(
    flights: FlightResult[],
    filters: FlightSearchFilters,
    opts: {
      topN: number;
      currency: string | null;
      language: string | null;
      country: string | null;
    },
  ): Promise<Array<FlightResult[]>> {
    const numSegments = filters.flight_segments.length;
    const selectedCount = filters.flight_segments.filter((s) => s.selected_flight != null).length;
    if (selectedCount >= numSegments - 1) {
      return flights.map((f) => [f]);
    }

    const candidates = flights.slice(0, opts.topN);

    const expand = async (
      outbound: FlightResult,
    ): Promise<[FlightResult, FlightResult[] | Array<FlightResult[]> | null]> => {
      const nextFilters = cloneFilters(filters);
      const seg = nextFilters.flight_segments[selectedCount];
      if (seg) seg.selected_flight = outbound;
      const subFlights = await this._fetchFlights(nextFilters, {
        currency: opts.currency,
        language: opts.language,
        country: opts.country,
        captureSession: false,
      });
      if (subFlights == null) return [outbound, null];
      if (selectedCount + 1 < numSegments - 1) {
        const expanded = await this._expandMultiLeg(subFlights, nextFilters, opts);
        return [outbound, expanded];
      }
      return [outbound, subFlights];
    };

    const expansions = await Promise.all(candidates.map(expand));

    const combos: FlightResult[][] = [];
    for (const [outbound, nextResults] of expansions) {
      if (nextResults == null) continue;
      for (const nxt of nextResults) {
        if (Array.isArray(nxt)) {
          combos.push([outbound, ...nxt]);
        } else {
          combos.push([outbound, nxt as FlightResult]);
        }
      }
    }
    return combos;
  }
}

function cloneFilters(filters: FlightSearchFilters): FlightSearchFilters {
  const out = Object.create(FlightSearchFilters.prototype) as FlightSearchFilters;
  Object.assign(out, {
    trip_type: filters.trip_type,
    passenger_info: { ...filters.passenger_info },
    flight_segments: filters.flight_segments.map((s) => {
      const clone = Object.create(Object.getPrototypeOf(s)) as typeof s;
      Object.assign(clone, {
        departure_airport: s.departure_airport,
        arrival_airport: s.arrival_airport,
        travel_date: s.travel_date,
        time_restrictions: s.time_restrictions,
        selected_flight: s.selected_flight,
      });
      return clone;
    }),
    stops: filters.stops,
    seat_type: filters.seat_type,
    price_limit: filters.price_limit ? { ...filters.price_limit } : null,
    airlines: filters.airlines ? [...filters.airlines] : null,
    airlines_exclude: filters.airlines_exclude ? [...filters.airlines_exclude] : null,
    alliances: filters.alliances ? [...filters.alliances] : null,
    alliances_exclude: filters.alliances_exclude ? [...filters.alliances_exclude] : null,
    max_duration: filters.max_duration,
    layover_restrictions: filters.layover_restrictions ? { ...filters.layover_restrictions } : null,
    sort_by: filters.sort_by,
    exclude_basic_economy: filters.exclude_basic_economy,
    emissions: filters.emissions,
    bags: filters.bags ? { ...filters.bags } : null,
    show_all_results: filters.show_all_results,
  });
  return out;
}
