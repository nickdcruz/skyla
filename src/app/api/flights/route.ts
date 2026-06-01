// v1.1
import { NextRequest, NextResponse } from "next/server";
import { SearchFlights } from "@/lib/fli/search/flights";
import { FlightSearchFilters } from "@/lib/fli/models/google-flights/flights";
import { FlightSegment, SeatType, MaxStops, TripType, SortBy } from "@/lib/fli/models/google-flights/base";
import type { SearchRequest } from "@/types";

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
const SORT_MAP: Record<string, number> = {
  BEST: SortBy.BEST, CHEAPEST: SortBy.CHEAPEST, DURATION: SortBy.DURATION,
  DEPARTURE_TIME: SortBy.DEPARTURE_TIME, ARRIVAL_TIME: SortBy.ARRIVAL_TIME,
  TOP_FLIGHTS: SortBy.TOP_FLIGHTS,
};

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: SearchRequest = await req.json();
    const { origin, destination, departureDate, returnDate, tripType, cabinClass, adults, stops, sortBy } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const segments = [];
    segments.push(new FlightSegment({
      departure_airport: [[[origin, 0]]],
      arrival_airport: [[[destination, 0]]],
      travel_date: departureDate,
    }));

    if (tripType === "ROUND_TRIP" && returnDate) {
      segments.push(new FlightSegment({
        departure_airport: [[[destination, 0]]],
        arrival_airport: [[[origin, 0]]],
        travel_date: returnDate,
      }));
    }

    const seat = SEAT_MAP[cabinClass ?? "ECONOMY"] ?? SeatType.ECONOMY;
    const stopVal = STOP_MAP[stops ?? "ANY"] ?? MaxStops.ANY;
    const sort = SORT_MAP[sortBy ?? "BEST"] ?? SortBy.BEST;

    const filters = new FlightSearchFilters({
      trip_type: (tripType === "ROUND_TRIP" ? TripType.ROUND_TRIP : TripType.ONE_WAY) as 1 | 2,
      passenger_info: { adults: adults ?? 1, children: 0, infants_in_seat: 0, infants_on_lap: 0 },
      flight_segments: segments,
      seat_type: seat as 1 | 2 | 3 | 4,
      stops: stopVal as 0 | 1 | 2 | 3,
      sort_by: sort as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      show_all_results: true,
    });

    const searcher = new SearchFlights();
    const results = await searcher.search(filters);

    if (!results) {
      return NextResponse.json({ flights: [], message: "No results from Google Flights" });
    }

    const AIRLINE_NAMES_MAP: Record<string, string> = {};
    try {
      const mod = await import("@/lib/fli/models/airline");
      Object.assign(AIRLINE_NAMES_MAP, mod.AIRLINE_NAMES);
    } catch { /* ignore */ }

    const AIRPORT_NAMES_MAP: Record<string, string> = {};
    try {
      const mod = await import("@/lib/fli/models/airport");
      Object.assign(AIRPORT_NAMES_MAP, mod.AIRPORT_NAMES);
    } catch { /* ignore */ }

    const normalised = results.flat().slice(0, 50);
    const flights = normalised.map((flight, idx: number) => {
      const legsData = (flight.legs ?? []).map((leg) => ({
        airline: String(leg.airline ?? "").replace(/^_/, ""),
        airlineName: AIRLINE_NAMES_MAP[String(leg.airline ?? "").replace(/^_/, "")] ?? String(leg.airline ?? ""),
        flightNumber: String(leg.flight_number ?? ""),
        departureAirport: String(leg.departure_airport ?? ""),
        arrivalAirport: String(leg.arrival_airport ?? ""),
        departureAirportName: leg.departure_airport_name ?? AIRPORT_NAMES_MAP[String(leg.departure_airport ?? "")] ?? String(leg.departure_airport ?? ""),
        arrivalAirportName: leg.arrival_airport_name ?? AIRPORT_NAMES_MAP[String(leg.arrival_airport ?? "")] ?? String(leg.arrival_airport ?? ""),
        departureTime: formatTime(leg.departure_datetime),
        arrivalTime: formatTime(leg.arrival_datetime),
        duration: leg.duration ?? 0,
        aircraft: leg.aircraft ?? null,
        legroom: leg.legroom ?? null,
        wifi: leg.amenities?.wifi ?? null,
        overnight: leg.overnight ?? false,
      }));

      const bookingUrl = searcher.buildFlightBookingUrl(flight);

      return {
        id: `flight-${idx}`,
        price: flight.price,
        currency: flight.currency ?? "USD",
        totalDuration: flight.duration,
        stops: flight.stops,
        legs: legsData,
        bookingUrl,
        emissionsTag: flight.emissions_tag ?? null,
        primaryAirline: flight.primary_airline ? String(flight.primary_airline).replace(/^_/, "") : null,
        primaryAirlineName: flight.primary_airline_name ?? null,
      };
    });

    return NextResponse.json({ flights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    console.error("Flight search error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
