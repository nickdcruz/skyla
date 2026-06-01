// v1.0
import { googleFlightsUrl, withLocaleParams } from "../core/links";
import { getClient, type Client } from "./client";
import { decodeFlightResponse, type DecodedFlight } from "./decoders";
import { encodeBatchExecuteBody, GOOGLE_FLIGHTS_SEARCH_URL, parseBatchExecuteResponse } from "./wire";
import { buildFlightSearchPayload, buildBookingToken } from "./proto";
import type { FlightSearchFilters } from "../models/google-flights/flights";

const RPC_ID = "H4cFwe";

export class SearchFlights {
  private readonly client: Client;

  constructor(client?: Client) {
    this.client = client ?? getClient();
  }

  async search(filters: FlightSearchFilters): Promise<DecodedFlight[][] | null> {
    const payload = buildFlightSearchPayload(filters);
    const body = encodeBatchExecuteBody(RPC_ID, payload);
    try {
      const res = await this.client.post(GOOGLE_FLIGHTS_SEARCH_URL, { body });
      const parsed = parseBatchExecuteResponse(res.text);
      if (parsed == null) return null;
      const decoded = decodeFlightResponse(parsed);
      if (!decoded || decoded.length === 0 || decoded[0]!.length === 0) return null;
      return decoded;
    } catch (err) {
      // Surface a clean null on connectivity failure; callers decide UX.
      console.error("[SearchFlights] search failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  buildFlightBookingUrl(flight: DecodedFlight): string {
    // Build a Google Flights URL pointing at the same origin/destination/date.
    // Booking tokens (if surfaced) override the simple query.
    const legs = flight.legs;
    if (!legs || legs.length === 0) return "https://www.google.com/travel/flights";
    const origin = legs[0]!.departure_airport;
    const destination = legs[legs.length - 1]!.arrival_airport;
    const dep = legs[0]!.departure_datetime;
    const depDate = `${dep.getUTCFullYear()}-${String(dep.getUTCMonth() + 1).padStart(2, "0")}-${String(dep.getUTCDate()).padStart(2, "0")}`;
    const url = googleFlightsUrl(origin, destination, depDate, null);
    const token = buildBookingToken(flight);
    if (token) {
      const sep = url.includes("?") ? "&" : "?";
      return withLocaleParams(`${url}${sep}tfs=${encodeURIComponent(token)}`, null, null, null);
    }
    return url;
  }
}
