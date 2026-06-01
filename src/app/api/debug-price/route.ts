// v1.0 — TEMPORARY DEBUG ENDPOINT — remove after price investigation
import { NextResponse } from "next/server";
import { FlightSearchFilters } from "@/lib/fli/models/google-flights/flights";
import { FlightSegment, SeatType, MaxStops, TripType, SortBy } from "@/lib/fli/models/google-flights/base";
import { getClient } from "@/lib/fli/search/client";
import { withLocaleParams } from "@/lib/fli/search/urls";
import { parseFirstWrbPayload } from "@/lib/fli/search/wire";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BASE_URL = "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

export async function GET() {
  try {
    // SIN → DPS, 2026-08-01, economy, 1 adult, one-way
    const segment = new FlightSegment({
      departure_airport: [[["SIN", 0]]],
      arrival_airport:   [[["DPS", 0]]],
      travel_date: "2026-08-01",
    });

    const filters = new FlightSearchFilters({
      trip_type: TripType.ONE_WAY as 2,
      passenger_info: { adults: 1, children: 0, infants_in_seat: 0, infants_on_lap: 0 },
      flight_segments: [segment],
      seat_type: SeatType.ECONOMY as 1,
      stops: MaxStops.ANY as 0,
      sort_by: SortBy.BEST as 1,
      show_all_results: true,
    });

    const encoded = filters.encode();
    const url = withLocaleParams(BASE_URL, "USD", "en", "US");
    const client = getClient();
    const response = await client.post(url, { body: `f.req=${encoded}` });
    const inner = parseFirstWrbPayload(response.text);

    if (!Array.isArray(inner)) {
      return NextResponse.json({ error: "inner is not array", type: typeof inner });
    }

    // Collect first 3 raw rows from blocks [2] and [3]
    const rawRows: unknown[] = [];
    for (const i of [2, 3]) {
      const block = inner[i];
      if (Array.isArray(block) && Array.isArray(block[0])) {
        for (const item of block[0]) {
          if (rawRows.length < 3) rawRows.push(item);
        }
      }
    }

    // For each raw row, dump the price block (row[1]) in full
    const priceBlocks = rawRows.map((row, idx) => {
      if (!Array.isArray(row)) return { idx, error: "row not array" };
      const pb = row[1];
      if (!Array.isArray(pb)) return { idx, error: "price block not array", pb };
      const head = pb[0];
      const currencyToken = pb[1];
      const headLast = Array.isArray(head) ? head[head.length - 1] : null;
      const headAll = Array.isArray(head) ? head : null;
      return {
        idx,
        priceBlock_length: pb.length,
        head: headAll,
        head_last: headLast,
        currency_token: currencyToken,
        // Also dump full row[0] top-level keys to understand structure
        row0_length: Array.isArray(row[0]) ? (row[0] as unknown[]).length : null,
      };
    });

    return NextResponse.json({
      numRows: rawRows.length,
      priceBlocks,
      // Also return raw first row (truncated) for manual inspection
      firstRowKeys: Array.isArray(rawRows[0]) ? (rawRows[0] as unknown[]).map((v, i) => ({ i, type: typeof v, isArray: Array.isArray(v) })) : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
