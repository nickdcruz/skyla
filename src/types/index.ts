// v1.0
export interface SearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  adults: number;
  stops: "ANY" | "NON_STOP" | "ONE_STOP_OR_FEWER";
  airlines?: string[];
  alliances?: string[];
  sortBy: "BEST" | "CHEAPEST" | "DURATION" | "DEPARTURE_TIME";
}

export interface DateRangeRequest {
  origin: string;
  destination: string;
  fromDate: string;
  toDate: string;
  cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  adults: number;
  stops: "ANY" | "NON_STOP" | "ONE_STOP_OR_FEWER";
}

export interface FlightLegData {
  airline: string;
  airlineName: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAirportName: string;
  arrivalAirportName: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  aircraft: string | null;
  legroom: string | null;
  wifi: boolean | null;
  overnight: boolean;
}

export interface FlightData {
  id: string;
  price: number | null;
  currency: string | null;
  totalDuration: number;
  stops: number;
  legs: FlightLegData[];
  bookingUrl: string;
  emissionsTag: string | null;
  primaryAirline: string | null;
  primaryAirlineName: string | null;
}

export interface DatePriceData {
  date: string;
  returnDate?: string;
  price: number;
  currency: string | null;
}

export interface AirportOption {
  code: string;
  name: string;
}
