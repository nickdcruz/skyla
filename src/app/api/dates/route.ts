// v1.1
import { NextRequest, NextResponse } from "next/server";
import { SearchDates } from "@/lib/fli/search/dates";
import { DateSearchFilters } from "@/lib/fli/models/google-flights/dates";
import { FlightSegment, SeatType, MaxStops, TripType } from "@/lib/fli/models/google-flights/base";
import type { DateRangeRequest } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SEAT_MAP: Record<string, number> = {
  ECONOMY: SeatType.ECONOMY, PREMIUM_ECONOMY: SeatType.PREMIUM_ECONOMY,
  BUSINESS: SeatType.BUSINESS, FIRST: SeatType.FIRST,
};
const STOP_MAP: Record<string, number> = {
  ANY: MaxStops.ANY, NON_STOP: MaxStops.NON_STOP, ONE_STOP_OR_FEWER: MaxStops.ONE_STOP_OR_FEWER,
  TWO_STOPS_OR_FEWER: MaxStops.TWO_OR_FEWER_STOPS,
};

export async function POST(req: NextRequest) {
  try {
    const body: DateRangeRequest = await req.json();
    const { origin, destination, fromDate, toDate, cabinClass, adults, stops } = body;

    if (!origin || !destination || !fromDate || !toDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const segment = new FlightSegment({
      departure_airport: [[[origin, 0]]],
      arrival_airport: [[[destination, 0]]],
      travel_date: fromDate,
    });

    const seat = SEAT_MAP[cabinClass ?? "ECONOMY"] ?? SeatType.ECONOMY;
    const stopVal = STOP_MAP[stops ?? "ANY"] ?? MaxStops.ANY;

    const filters = new DateSearchFilters({
      trip_type: TripType.ONE_WAY as 2,
      passenger_info: { adults: adults ?? 1, children: 0, infants_in_seat: 0, infants_on_lap: 0 },
      flight_segments: [segment],
      seat_type: seat as 1 | 2 | 3 | 4,
      stops: stopVal as 0 | 1 | 2 | 3,
      from_date: fromDate,
      to_date: toDate,
    });

    const searcher = new SearchDates();
    const results = await searcher.search(filters);

    if (!results) {
      return NextResponse.json({ prices: [], message: "No date prices returned" });
    }

    const prices = results.map((r) => ({
      date: r.date[0] ? r.date[0].toISOString().split("T")[0] : "",
      returnDate: r.date[1] ? r.date[1].toISOString().split("T")[0] : undefined,
      price: r.price,
      currency: r.currency ?? "USD",
    }));

    prices.sort((a, b) => a.price - b.price);
    return NextResponse.json({ prices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Date search failed";
    console.error("Date search error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
