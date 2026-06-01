// v1.0
import {
  type FlightSegment,
  MaxStops,
  type PassengerInfo,
  SeatType,
  TripType,
  type TripTypeValue,
  type SeatTypeValue,
  type MaxStopsValue,
} from "./base";

export interface DateSearchFiltersInput {
  trip_type?: TripTypeValue;
  passenger_info: PassengerInfo;
  flight_segments: FlightSegment[];
  seat_type?: SeatTypeValue;
  stops?: MaxStopsValue;
  from_date: string;
  to_date: string;
  duration?: number | null;
}

export class DateSearchFilters {
  trip_type: TripTypeValue;
  passenger_info: PassengerInfo;
  flight_segments: FlightSegment[];
  seat_type: SeatTypeValue;
  stops: MaxStopsValue;
  from_date: string;
  to_date: string;
  duration: number | null;

  constructor(input: DateSearchFiltersInput) {
    this.trip_type = input.trip_type ?? TripType.ONE_WAY;
    this.passenger_info = input.passenger_info;
    this.flight_segments = input.flight_segments;
    if (!this.flight_segments || this.flight_segments.length === 0) {
      throw new TypeError("DateSearchFilters requires at least one flight segment");
    }
    this.seat_type = input.seat_type ?? SeatType.ECONOMY;
    this.stops = input.stops ?? MaxStops.ANY;
    this.from_date = input.from_date;
    this.to_date = input.to_date;
    this.duration = input.duration ?? null;
  }
}
