// v1.1
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { FlightData, DatePriceData } from "@/types";

// ─── Currency config ────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = [
  { code: "SGD", label: "SGD" },
  { code: "USD", label: "USD" },
  { code: "AUD", label: "AUD" },
  { code: "GBP", label: "GBP" },
  { code: "EUR", label: "EUR" },
  { code: "JPY", label: "JPY" },
  { code: "HKD", label: "HKD" },
  { code: "MYR", label: "MYR" },
  { code: "AED", label: "AED" },
];

// Fallback rates (USD base) in case frankfurter.app is down
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, SGD: 1.34, AUD: 1.54, GBP: 0.79, EUR: 0.92,
  JPY: 157, HKD: 7.78, MYR: 4.72, AED: 3.67, ZAR: 18.5,
};

// ─── Airport autocomplete ────────────────────────────────────────────────────
interface AirportSuggestion { code: string; name: string; display: string; }

function AirportInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (code: string, name: string) => void; placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AirportSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 1) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { airports: AirportSuggestion[] };
        setSuggestions(data.airports ?? []);
        setOpen(true);
      } catch { setSuggestions([]); }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </label>
      <input
        className="input-field"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query && setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
          overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {suggestions.map((s) => (
            <button key={s.code} type="button" style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", background: "none", border: "none",
              cursor: "pointer", color: "var(--text-primary)", fontSize: 14,
              borderBottom: "1px solid var(--border)",
            }}
            onMouseDown={() => { onChange(s.code, s.name); setQuery(s.display); setOpen(false); }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <span style={{ fontWeight: 600, color: "var(--gold)", marginRight: 8 }}>{s.code}</span>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Currency selector ────────────────────────────────────────────────────────
function CurrencySelector({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>Display in</span>
      {CURRENCY_OPTIONS.map((c) => (
        <button key={c.code} type="button" onClick={() => onChange(c.code)} style={{
          padding: "4px 10px", borderRadius: 6, border: `1px solid ${selected === c.code ? "var(--gold)" : "var(--border)"}`,
          background: selected === c.code ? "rgba(201,168,76,0.12)" : "var(--bg-surface)",
          color: selected === c.code ? "var(--gold)" : "var(--text-muted)",
          fontSize: 12, fontWeight: selected === c.code ? 600 : 400, cursor: "pointer",
          transition: "all 0.15s ease",
        }}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Flight card ──────────────────────────────────────────────────────────────
function FlightCard({ flight, formatPrice }: { flight: FlightData; formatPrice: (price: number | null, currency: string | null) => string }) {
  const outbound = flight.legs[0];
  return (
    <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 12, transition: "all 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            {flight.primaryAirlineName ?? outbound?.airlineName ?? "Unknown Airline"}
            {flight.stops === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--green)", background: "rgba(76,175,125,0.1)", padding: "2px 8px", borderRadius: 4 }}>Nonstop</span>}
            {flight.stops === 1 && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>1 stop</span>}
            {flight.stops > 1 && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>{flight.stops} stops</span>}
          </div>
          {flight.legs.map((leg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < flight.legs.length - 1 ? 8 : 0 }}>
              <div style={{ textAlign: "center", minWidth: 48 }}>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{leg.departureTime}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{leg.departureAirport}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDuration(leg.duration)}</div>
                <div style={{ height: 1, width: "100%", background: "var(--border)", position: "relative" }}>
                  <div style={{ position: "absolute", right: 0, top: -3, width: 7, height: 7, borderRight: "2px solid var(--border)", borderTop: "2px solid var(--border)", transform: "rotate(45deg)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{leg.flightNumber}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 48 }}>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                  {leg.arrivalTime}{leg.overnight ? <sup style={{ fontSize: 10, color: "var(--gold)" }}>+1</sup> : ""}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{leg.arrivalAirport}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "right", minWidth: 140 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
            {formatPrice(flight.price, flight.currency)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, marginBottom: 12 }}>
            {formatDuration(flight.totalDuration)} total
          </div>
          <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ fontSize: 13, padding: "8px 20px" }}>
            Book
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Price calendar ────────────────────────────────────────────────────────────
function PriceCalendar({ prices, origin, destination, onSelectDate, formatPrice }: {
  prices: DatePriceData[];
  origin: string;
  destination: string;
  onSelectDate: (date: string) => void;
  formatPrice: (price: number | null, currency: string | null) => string;
}) {
  if (prices.length === 0) return null;
  const min = Math.min(...prices.map((p) => p.price));
  const max = Math.max(...prices.map((p) => p.price));
  const range = max - min || 1;

  function getColor(price: number): string {
    const ratio = (price - min) / range;
    if (ratio < 0.25) return "var(--green)";
    if (ratio < 0.5) return "var(--gold)";
    if (ratio < 0.75) return "#e8a84c";
    return "var(--red)";
  }

  const top5 = [...prices].slice(0, 5);

  return (
    <div>
      <h3 style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
        Best dates - {origin} to {destination}
      </h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {top5.map((p, i) => (
          <button key={i} type="button" onClick={() => onSelectDate(p.date)} style={{
            background: i === 0 ? "rgba(76,175,125,0.1)" : "var(--bg-card)",
            border: `1px solid ${i === 0 ? "var(--green)" : "var(--border)"}`,
            borderRadius: 10, padding: "12px 16px", cursor: "pointer",
            color: "var(--text-primary)", textAlign: "left", minWidth: 120,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: getColor(p.price) }}>
              {formatPrice(p.price, p.currency)}
            </div>
            {i === 0 && <div style={{ fontSize: 10, color: "var(--green)", marginTop: 2 }}>Cheapest</div>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 8 }}>
        {prices.map((p, i) => {
          const heightPct = 20 + 80 * (1 - (p.price - min) / range);
          return (
            <button key={i} type="button" title={`${p.date}: ${formatPrice(p.price, p.currency)}`}
              onClick={() => onSelectDate(p.date)}
              style={{
                minWidth: 8, flex: "0 0 8px", height: `${heightPct}%`,
                background: getColor(p.price), borderRadius: 2, border: "none",
                cursor: "pointer", opacity: 0.8, transition: "opacity 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mode, setMode] = useState<"specific" | "flexible">("specific");

  // Search state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [tripType, setTripType] = useState<"ONE_WAY" | "ROUND_TRIP">("ONE_WAY");
  const [cabinClass, setCabinClass] = useState<"ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST">("ECONOMY");
  const [adults, setAdults] = useState(1);
  const [stops, setStops] = useState<"ANY" | "NON_STOP" | "ONE_STOP_OR_FEWER">("ANY");
  const [sortBy, setSortBy] = useState<"BEST" | "CHEAPEST" | "DURATION" | "DEPARTURE_TIME">("BEST");
  const [flexFromDate, setFlexFromDate] = useState("");
  const [flexToDate, setFlexToDate] = useState("");

  // Results state
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [prices, setPrices] = useState<DatePriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Currency state
  const [displayCurrency, setDisplayCurrency] = useState("SGD");
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);

  // Fetch live exchange rates on mount (from USD as base)
  useEffect(() => {
    const codes = CURRENCY_OPTIONS.map((c) => c.code).filter((c) => c !== "USD").join(",") + ",ZAR,THB,IDR";
    fetch(`https://api.frankfurter.app/latest?from=USD&to=${codes}`)
      .then((r) => r.json())
      .then((data: { rates?: Record<string, number> }) => {
        if (data.rates) setRates({ ...FALLBACK_RATES, ...data.rates, USD: 1 });
      })
      .catch(() => {}); // silently use fallback rates
  }, []);

  // Convert and format price from source currency to display currency
  const formatPrice = useCallback((price: number | null, sourceCurrency: string | null): string => {
    if (price == null) return "-";
    const src = sourceCurrency ?? "USD";
    const srcRate = rates[src] ?? 1;
    const dstRate = rates[displayCurrency] ?? 1;
    const converted = price * dstRate / srcRate;
    try {
      return new Intl.NumberFormat("en-SG", {
        style: "currency", currency: displayCurrency, maximumFractionDigits: 0,
      }).format(converted);
    } catch {
      return `${displayCurrency} ${Math.round(converted).toLocaleString()}`;
    }
  }, [rates, displayCurrency]);

  const today = new Date().toISOString().split("T")[0]!;

  async function handleSearch() {
    if (!origin || !destination) { setError("Please select origin and destination airports."); return; }
    if (mode === "specific" && !departureDate) { setError("Please select a departure date."); return; }
    if (mode === "flexible" && (!flexFromDate || !flexToDate)) { setError("Please select a date range."); return; }
    if (mode === "specific" && tripType === "ROUND_TRIP" && !returnDate) { setError("Please select a return date."); return; }

    setLoading(true); setError(null); setFlights([]); setPrices([]); setSearched(true);

    try {
      if (mode === "specific") {
        const res = await fetch("/api/flights", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ origin, destination, departureDate,
            returnDate: tripType === "ROUND_TRIP" ? returnDate : undefined,
            tripType, cabinClass, adults, stops, sortBy }),
        });
        const data = (await res.json()) as { flights?: FlightData[]; error?: string };
        if (data.error) throw new Error(data.error);
        setFlights(data.flights ?? []);
      } else {
        const res = await fetch("/api/dates", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ origin, destination, fromDate: flexFromDate, toDate: flexToDate, cabinClass, adults, stops }),
        });
        const data = (await res.json()) as { prices?: DatePriceData[]; error?: string };
        if (data.error) throw new Error(data.error);
        setPrices(data.prices ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectDate(date: string) {
    setMode("specific"); setDepartureDate(date);
    setFlights([]); setPrices([]); setSearched(false);
  }

  function swapAirports() { setOrigin(destination); setDestination(origin); }

  const hasResults = flights.length > 0 || prices.length > 0;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      {/* Hero */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12 }}>
          Find your next <span className="gold-gradient">flight</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
          Real-time prices from Google Flights. Flexible date search finds you the cheapest window to fly.
        </p>
      </div>

      {/* Mode tabs + currency selector row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-surface)", borderRadius: 10, padding: 4 }}>
          {(["specific", "flexible"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{
              padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: mode === m ? "var(--bg-card)" : "transparent",
              color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}>
              {m === "specific" ? "Specific Dates" : "Flexible / Cheapest"}
            </button>
          ))}
        </div>

        {/* Currency toggle button */}
        <button type="button" onClick={() => setShowCurrencySelector((v) => !v)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8,
          border: `1px solid ${showCurrencySelector ? "var(--gold)" : "var(--border)"}`,
          background: showCurrencySelector ? "rgba(201,168,76,0.08)" : "var(--bg-surface)",
          color: showCurrencySelector ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
        }}>
          <span style={{ fontSize: 15 }}>&#9654;</span>
          {displayCurrency}
          <span style={{ fontSize: 10, opacity: 0.6 }}>{showCurrencySelector ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Currency selector panel */}
      {showCurrencySelector && (
        <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 16 }}>
          <CurrencySelector selected={displayCurrency} onChange={(c) => { setDisplayCurrency(c); setShowCurrencySelector(false); }} />
        </div>
      )}

      {/* Search form */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 32 }}>
        {mode === "specific" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["ONE_WAY", "ROUND_TRIP"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTripType(t)} className="btn-secondary" style={{
                background: tripType === t ? "rgba(201,168,76,0.1)" : "transparent",
                borderColor: tripType === t ? "var(--gold)" : "var(--border)",
                color: tripType === t ? "var(--gold)" : "var(--text-muted)", fontSize: 13,
              }}>
                {t === "ONE_WAY" ? "One Way" : "Round Trip"}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "end", marginBottom: 16 }}>
          <AirportInput label="From" value={origin} onChange={(code) => setOrigin(code)} placeholder="SIN, Singapore..." />
          <button type="button" onClick={swapAirports} style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8,
            width: 40, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-muted)", fontSize: 16, flexShrink: 0,
          }} title="Swap airports">
            &#8644;
          </button>
          <AirportInput label="To" value={destination} onChange={(code) => setDestination(code)} placeholder="LHR, London..." />
        </div>

        {mode === "specific" ? (
          <div style={{ display: "grid", gridTemplateColumns: tripType === "ROUND_TRIP" ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Departure</label>
              <input type="date" className="input-field" value={departureDate} min={today} onChange={(e) => setDepartureDate(e.target.value)} />
            </div>
            {tripType === "ROUND_TRIP" && (
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Return</label>
                <input type="date" className="input-field" value={returnDate} min={departureDate || today} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>From Date</label>
              <input type="date" className="input-field" value={flexFromDate} min={today} onChange={(e) => setFlexFromDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>To Date</label>
              <input type="date" className="input-field" value={flexToDate} min={flexFromDate || today} onChange={(e) => setFlexToDate(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Cabin Class</label>
            <select className="input-field" value={cabinClass} onChange={(e) => setCabinClass(e.target.value as typeof cabinClass)} style={{ appearance: "none" }}>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First Class</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Passengers</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46 }}>
              <button type="button" onClick={() => setAdults((a) => Math.max(1, a - 1))} className="btn-secondary" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}>-</button>
              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{adults}</span>
              <button type="button" onClick={() => setAdults((a) => Math.min(9, a + 1))} className="btn-secondary" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}>+</button>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Stops</label>
            <select className="input-field" value={stops} onChange={(e) => setStops(e.target.value as typeof stops)} style={{ appearance: "none" }}>
              <option value="ANY">Any</option>
              <option value="NON_STOP">Nonstop only</option>
              <option value="ONE_STOP_OR_FEWER">1 stop or fewer</option>
            </select>
          </div>
          {mode === "specific" && (
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Sort By</label>
              <select className="input-field" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{ appearance: "none" }}>
                <option value="BEST">Best</option>
                <option value="CHEAPEST">Cheapest</option>
                <option value="DURATION">Shortest</option>
                <option value="DEPARTURE_TIME">Departure</option>
              </select>
            </div>
          )}
        </div>

        <button type="button" className="btn-primary" onClick={handleSearch} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? (
            <>
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Searching...
            </>
          ) : (
            <><span>&#9992;</span>{mode === "specific" ? "Search Flights" : "Find Cheapest Dates"}</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.3)", borderRadius: 10, padding: "14px 18px", marginBottom: 24, color: "var(--red)", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
      )}

      {/* Results header with currency selector */}
      {!loading && hasResults && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {flights.length > 0 ? `${flights.length} flight${flights.length !== 1 ? "s" : ""} found` : `${prices.length} date${prices.length !== 1 ? "s" : ""} found`}
          </h2>
          <CurrencySelector selected={displayCurrency} onChange={setDisplayCurrency} />
        </div>
      )}

      {/* Flexible date results */}
      {!loading && mode === "flexible" && prices.length > 0 && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <PriceCalendar prices={prices} origin={origin} destination={destination} onSelectDate={handleSelectDate} formatPrice={formatPrice} />
        </div>
      )}

      {/* Specific date results */}
      {!loading && flights.length > 0 && (
        <div>{flights.map((f) => <FlightCard key={f.id} flight={f} formatPrice={formatPrice} />)}</div>
      )}

      {/* Empty state */}
      {!loading && searched && flights.length === 0 && prices.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#9992;</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No flights found</div>
          <div style={{ fontSize: 13 }}>Try adjusting your search - different dates or removing stop filters often helps.</div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
