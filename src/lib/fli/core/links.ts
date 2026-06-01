// v1.0
const GOOGLE_FLIGHTS_URL = "https://www.google.com/travel/flights";
export function withLocaleParams(url: string, currency: string | null | undefined, language: string | null | undefined, country: string | null | undefined): string {
  const params: string[] = [];
  if (currency) params.push(`curr=${encodeURIComponent(currency.toUpperCase())}`);
  if (language) params.push(`hl=${encodeURIComponent(language)}`);
  if (country) params.push(`gl=${encodeURIComponent(country.toUpperCase())}`);
  if (params.length === 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.join("&")}`;
}
export interface GoogleFlightsUrlOptions {
  currency?: string | null;
  language?: string | null;
  country?: string | null;
}
export function googleFlightsUrl(origin: string, destination: string, departureDate: string, returnDate?: string | null, options: GoogleFlightsUrlOptions = {}): string {
  let query = `Flights from ${origin} to ${destination} on ${departureDate}`;
  if (returnDate) query += ` through ${returnDate}`;
  const url = `${GOOGLE_FLIGHTS_URL}?q=${encodeURIComponent(query)}`;
  return withLocaleParams(url, options.currency ?? null, options.language ?? null, options.country ?? null);
}
