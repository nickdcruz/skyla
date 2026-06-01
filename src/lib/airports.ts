// v1.0
import { AIRPORT_NAMES } from "./fli/models/airport";

export interface AirportOption {
  code: string;
  name: string;
  display: string;
}

const AIRPORT_LIST: AirportOption[] = Object.entries(AIRPORT_NAMES).map(([code, name]) => ({
  code,
  name,
  display: `${code} - ${name}`,
}));

export function searchAirports(query: string, limit = 10): AirportOption[] {
  if (!query || query.length < 1) return AIRPORT_LIST.slice(0, limit);
  const q = query.toUpperCase().trim();
  const results: AirportOption[] = [];
  // Exact IATA code match first
  for (const a of AIRPORT_LIST) {
    if (a.code === q) { results.push(a); break; }
  }
  // Code starts with
  for (const a of AIRPORT_LIST) {
    if (a.code !== q && a.code.startsWith(q)) results.push(a);
    if (results.length >= limit) break;
  }
  // Name contains
  const ql = query.toLowerCase();
  for (const a of AIRPORT_LIST) {
    if (!results.find((r) => r.code === a.code) && a.name.toLowerCase().includes(ql)) {
      results.push(a);
    }
    if (results.length >= limit) break;
  }
  return results.slice(0, limit);
}
