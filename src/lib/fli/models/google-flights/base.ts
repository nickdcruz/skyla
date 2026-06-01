// v1.0
// Enums and base types for Google Flights protobuf-style filter construction.

export const TripType = {
  ROUND_TRIP: 1,
  ONE_WAY: 2,
  MULTI_CITY: 3,
} as const;
export type TripTypeValue = (typeof TripType)[keyof typeof TripType];

export const SeatType = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
} as const;
export type SeatTypeValue = (typeof SeatType)[keyof typeof SeatType];

export const MaxStops = {
  ANY: 0,
  NON_STOP: 1,
  ONE_STOP_OR_FEWER: 2,
  TWO_STOPS_OR_FEWER: 3,
} as const;
export type MaxStopsValue = (typeof MaxStops)[keyof typeof MaxStops];

export const SortBy = {
  TOP_FLIGHTS: 0,
  BEST: 0,
  CHEAPEST: 1,
  DEPARTURE_TIME: 2,
  ARRIVAL_TIME: 3,
  DURATION: 4,
} as const;
export type SortByValue = (typeof SortBy)[keyof typeof SortBy];

export const EmissionsFilter = {
  ANY: 0,
  LESS: 1,
} as const;
export type EmissionsFilterValue = (typeof EmissionsFilter)[keyof typeof EmissionsFilter];

export const Alliance = {
  STAR_ALLIANCE: 1,
  SKYTEAM: 2,
  ONEWORLD: 3,
} as const;
export type Alliance = (typeof Alliance)[keyof typeof Alliance];

export interface PassengerInfo {
  adults: number;
  children: number;
  infants_in_seat: number;
  infants_on_lap: number;
}

export interface PriceLimit {
  max_price: number;
  currency?: string | null;
}

export interface LayoverRestrictions {
  airports?: string[] | null;
  max_duration_minutes?: number | null;
}

export interface BagsFilter {
  carry_on?: number | null;
  checked?: number | null;
}

// FlightSegment input format mirrors fli-js shape:
// departure_airport / arrival_airport are arrays-of-arrays with [code, terminal?] tuples.
export interface FlightSegmentInput {
  departure_airport: Array<Array<[string, number]>> | Array<[string, number]> | string[];
  arrival_airport: Array<Array<[string, number]>> | Array<[string, number]> | string[];
  travel_date: string; // ISO date YYYY-MM-DD
  time_restrictions?: TimeRestrictions | null;
}

export interface TimeRestrictions {
  earliest_departure?: number | null; // minutes from midnight
  latest_departure?: number | null;
  earliest_arrival?: number | null;
  latest_arrival?: number | null;
}

function normaliseAirportList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const walk = (item: unknown): void => {
    if (typeof item === "string") { out.push(item); return; }
    if (Array.isArray(item)) {
      // [code, terminal] tuple form
      if (item.length === 2 && typeof item[0] === "string" && typeof item[1] === "number") {
        out.push(item[0]);
        return;
      }
      for (const inner of item) walk(inner);
    }
  };
  walk(input);
  return out;
}

export class FlightSegment {
  departure_airport: string[];
  arrival_airport: string[];
  travel_date: string;
  time_restrictions: TimeRestrictions | null;
  // Preserve original nested form for any downstream serialiser that wants it.
  rawDeparture: unknown;
  rawArrival: unknown;

  constructor(input: FlightSegmentInput) {
    this.departure_airport = normaliseAirportList(input.departure_airport);
    this.arrival_airport = normaliseAirportList(input.arrival_airport);
    if (this.departure_airport.length === 0) throw new TypeError("FlightSegment requires at least one departure airport");
    if (this.arrival_airport.length === 0) throw new TypeError("FlightSegment requires at least one arrival airport");
    this.travel_date = input.travel_date;
    this.time_restrictions = input.time_restrictions ?? null;
    this.rawDeparture = input.departure_airport;
    this.rawArrival = input.arrival_airport;
  }
}
