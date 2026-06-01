// v1.1
/**
 * Core data models and enums for the Google Flights API.
 *
 * 1:1 port of fli/models/google_flights/base.py — keeps the same enum
 * integer values (the API uses them on the wire) and the same model field
 * names.
 */

import { parseIsoDate } from "../../core/dates";
import type { Airline } from "../airline";
import type { Airport } from "../airport";

// ---------------------------------------------------------------------------
// Enums (numeric values must match the Google Flights wire format)
// ---------------------------------------------------------------------------

export const SeatType = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
} as const;
export type SeatTypeValue = (typeof SeatType)[keyof typeof SeatType];

export const SortBy = {
  TOP_FLIGHTS: 0,
  BEST: 1,
  CHEAPEST: 2,
  DEPARTURE_TIME: 3,
  ARRIVAL_TIME: 4,
  DURATION: 5,
  EMISSIONS: 6,
} as const;
export type SortByValue = (typeof SortBy)[keyof typeof SortBy];

export const TripType = {
  ROUND_TRIP: 1,
  ONE_WAY: 2,
  MULTI_CITY: 3,
} as const;
export type TripTypeValue = (typeof TripType)[keyof typeof TripType];

export const MaxStops = {
  ANY: 0,
  NON_STOP: 1,
  ONE_STOP_OR_FEWER: 2,
  TWO_OR_FEWER_STOPS: 3,
} as const;
export type MaxStopsValue = (typeof MaxStops)[keyof typeof MaxStops];

export const EmissionsFilter = {
  ALL: 0,
  LESS: 1,
} as const;
export type EmissionsFilterValue = (typeof EmissionsFilter)[keyof typeof EmissionsFilter];

export const Alliance = {
  ONEWORLD: "ONEWORLD",
  SKYTEAM: "SKYTEAM",
  STAR_ALLIANCE: "STAR_ALLIANCE",
} as const;
export type Alliance = (typeof Alliance)[keyof typeof Alliance];

// ---------------------------------------------------------------------------
// Simple value types
// ---------------------------------------------------------------------------

export interface BagsFilter {
  checked_bags: number;
  carry_on: boolean;
}

export interface TimeRestrictions {
  earliest_departure?: number | null;
  latest_departure?: number | null;
  earliest_arrival?: number | null;
  latest_arrival?: number | null;
}

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
  min_duration?: number | null;
  max_duration?: number | null;
}

export interface Amenities {
  wifi?: boolean | null;
  power?: boolean | null;
  usb_power?: boolean | null;
  in_seat_video?: boolean | null;
  on_demand_video?: boolean | null;
  legroom_rating?: number | null;
}

export interface Layover {
  airport: Airport;
  duration: number;
  overnight: boolean;
  change_of_airport: boolean;
  city?: string | null;
  airport_name?: string | null;
}

export interface FlightLeg {
  airline: Airline;
  flight_number: string;
  departure_airport: Airport;
  arrival_airport: Airport;
  departure_datetime: Date;
  arrival_datetime: Date;
  duration: number;
  departure_airport_name?: string | null;
  arrival_airport_name?: string | null;
  operating_airline?: Airline | null;
  operating_flight_number?: string | null;
  aircraft?: string | null;
  legroom?: string | null;
  legroom_short?: string | null;
  amenities?: Amenities | null;
  overnight?: boolean;
  co2_emissions_g?: number | null;
}

export interface BookingOption {
  vendor_code: string | null;
  vendor_name: string | null;
  is_airline_direct: boolean;
  price: number | null;
  currency: string | null;
  fare_name: string | null;
  booking_url: string | null;
  google_click_url: string | null;
  flights: Array<[string, string]> | null;
}

export interface FlightResult {
  legs: FlightLeg[];
  price: number | null;
  currency: string | null;
  duration: number;
  stops: number;
  layovers?: Layover[] | null;
  co2_emissions_g?: number | null;
  co2_emissions_typical_g?: number | null;
  co2_emissions_delta_pct?: number | null;
  emissions_tag?: string | null;
  self_transfer?: boolean | null;
  mixed_cabin?: boolean | null;
  primary_airline?: Airline | null;
  primary_airline_name?: string | null;
  booking_token?: string | null;
}

// ---------------------------------------------------------------------------
// FlightSegment
// ---------------------------------------------------------------------------

export type AirportEntry = [string, number];

export interface FlightSegmentInput {
  departure_airport: AirportEntry[][];
  arrival_airport: AirportEntry[][];
  travel_date: string;
  time_restrictions?: TimeRestrictions | null;
  selected_flight?: FlightResult | null;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export class FlightSegment {
  readonly departure_airport: AirportEntry[][];
  readonly arrival_airport: AirportEntry[][];
  travel_date: string;
  readonly time_restrictions: TimeRestrictions | null;
  selected_flight: FlightResult | null;

  constructor(input: FlightSegmentInput) {
    if (!input.departure_airport?.length || !input.arrival_airport?.length) {
      throw new Error("Both departure and arrival airports must be specified");
    }

    // travel_date must be a valid ISO date and not in the past.
    const travelDate = parseIsoDate(input.travel_date);
    if (travelDate < todayUtc()) {
      throw new Error("Travel date cannot be in the past");
    }

    this.departure_airport = input.departure_airport;
    this.arrival_airport = input.arrival_airport;
    this.travel_date = input.travel_date;
    this.time_restrictions = input.time_restrictions ?? null;
    this.selected_flight = input.selected_flight ?? null;
  }
}
