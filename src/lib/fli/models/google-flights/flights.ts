// v1.0
import { AIRLINE_NAMES, type Airline } from "../airline";
import {
  type Alliance,
  type BagsFilter,
  EmissionsFilter,
  type FlightSegment,
  type LayoverRestrictions,
  MaxStops,
  type PassengerInfo,
  type PriceLimit,
  SeatType,
  SortBy,
  TripType,
  type TripTypeValue,
  type SeatTypeValue,
  type MaxStopsValue,
  type SortByValue,
  type EmissionsFilterValue,
} from "./base";

function airlineSortKey(a: Airline): string {
  return AIRLINE_NAMES[a as string] ?? String(a);
}

export interface FlightSearchFiltersInput {
  trip_type?: TripTypeValue;
  passenger_info: PassengerInfo;
  flight_segments: FlightSegment[];
  stops?: MaxStopsValue;
  seat_type?: SeatTypeValue;
  price_limit?: PriceLimit | null;
  airlines?: Airline[] | null;
  airlines_exclude?: Airline[] | null;
  alliances?: Alliance[] | null;
  alliances_exclude?: Alliance[] | null;
  max_duration?: number | null;
  layover_restrictions?: LayoverRestrictions | null;
  sort_by?: SortByValue;
  exclude_basic_economy?: boolean;
  emissions?: EmissionsFilterValue;
  bags?: BagsFilter | null;
  show_all_results?: boolean;
}

export class FlightSearchFilters {
  trip_type: TripTypeValue;
  passenger_info: PassengerInfo;
  flight_segments: FlightSegment[];
  stops: MaxStopsValue;
  seat_type: SeatTypeValue;
  price_limit: PriceLimit | null;
  airlines: Airline[] | null;
  airlines_exclude: Airline[] | null;
  alliances: Alliance[] | null;
  alliances_exclude: Alliance[] | null;
  max_duration: number | null;
  layover_restrictions: LayoverRestrictions | null;
  sort_by: SortByValue;
  exclude_basic_economy: boolean;
  emissions: EmissionsFilterValue;
  bags: BagsFilter | null;
  show_all_results: boolean;

  constructor(input: FlightSearchFiltersInput) {
    this.trip_type = input.trip_type ?? TripType.ONE_WAY;
    this.passenger_info = input.passenger_info;
    this.flight_segments = input.flight_segments;
    if (!this.flight_segments || this.flight_segments.length === 0) {
      throw new TypeError("FlightSearchFilters requires at least one flight segment");
    }
    this.stops = input.stops ?? MaxStops.ANY;
    this.seat_type = input.seat_type ?? SeatType.ECONOMY;
    this.price_limit = input.price_limit ?? null;
    this.airlines = input.airlines ? [...input.airlines].sort((a, b) => airlineSortKey(a).localeCompare(airlineSortKey(b))) : null;
    this.airlines_exclude = input.airlines_exclude ? [...input.airlines_exclude].sort((a, b) => airlineSortKey(a).localeCompare(airlineSortKey(b))) : null;
    this.alliances = input.alliances ?? null;
    this.alliances_exclude = input.alliances_exclude ?? null;
    this.max_duration = input.max_duration ?? null;
    this.layover_restrictions = input.layover_restrictions ?? null;
    this.sort_by = input.sort_by ?? SortBy.BEST;
    this.exclude_basic_economy = input.exclude_basic_economy ?? false;
    this.emissions = input.emissions ?? EmissionsFilter.ANY;
    this.bags = input.bags ?? null;
    this.show_all_results = input.show_all_results ?? false;
  }
}
