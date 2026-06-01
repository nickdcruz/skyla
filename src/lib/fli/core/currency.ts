// v1.1
// Best-effort currency extraction + formatting helpers.

// Known ISO 4217 codes to search for in decoded protobuf price tokens.
// Ordered so the most common travel currencies are checked first.
const KNOWN_ISO_CODES = [
  "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY", "HKD", "CNY",
  "MYR", "THB", "IDR", "INR", "KRW", "NZD", "AED", "SAR", "CHF",
  "SEK", "NOK", "DKK", "BRL", "MXN", "ZAR", "RUB", "TRY", "TWD",
  "PHP", "VND", "ILS", "PLN", "CZK", "QAR",
];

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "$": "USD", "US$": "USD", "USD": "USD",
  "S$": "SGD", "SGD": "SGD",
  "HK$": "HKD", "HKD": "HKD",
  "C$": "CAD", "CA$": "CAD", "CAD": "CAD",
  "A$": "AUD", "AU$": "AUD", "AUD": "AUD",
  "NZ$": "NZD", "NZD": "NZD",
  "NT$": "TWD", "TWD": "TWD",
  "RM": "MYR", "MYR": "MYR",
  "Rp": "IDR", "IDR": "IDR",
  "₱": "PHP", "PHP": "PHP",
  "₹": "INR", "INR": "INR", "Rs": "INR",
  "₩": "KRW", "KRW": "KRW",
  "¥": "JPY", "JPY": "JPY",
  "￥": "CNY", "CNY": "CNY", "RMB": "CNY",
  "€": "EUR", "EUR": "EUR",
  "£": "GBP", "GBP": "GBP",
  "₺": "TRY", "TRY": "TRY",
  "₽": "RUB", "RUB": "RUB",
  "฿": "THB", "THB": "THB",
  "₫": "VND", "VND": "VND",
  "د.إ": "AED", "AED": "AED",
  "ر.س": "SAR", "SAR": "SAR",
  "R$": "BRL", "BRL": "BRL",
  "₪": "ILS", "ILS": "ILS",
  "R": "ZAR", "ZAR": "ZAR",
  "CHF": "CHF",
  "kr": "SEK", "SEK": "SEK",
};

export function extractCurrencyFromPriceToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Google Flights price tokens are base64-encoded protobuf blobs. The ISO
  // currency code is stored as a plain ASCII string field inside the protobuf,
  // so decoding the base64 and scanning the raw bytes for a known 3-letter
  // code is the only reliable extraction method.
  //
  // The old approach scanned the raw base64 string as plain text, which caused
  // false matches (e.g. "R" → "ZAR") because base64 characters happen to
  // coincide with currency symbol substrings.
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("latin1");
    // Only proceed if the decoded length is plausibly a protobuf (>= 10 bytes).
    // Short garbage decodes of plain-text tokens won't match anything anyway.
    if (decoded.length >= 10) {
      for (const code of KNOWN_ISO_CODES) {
        if (decoded.includes(code)) return code;
      }
    }
  } catch {
    // Not valid base64 — fall through to plain-text symbol matching.
  }

  // Plain-text fallback for tokens like "$137", "USD 137", "S$250", etc.
  // ISO code at start or end?
  const isoEnd = trimmed.match(/\b([A-Z]{3})\b\s*$/);
  if (isoEnd && CURRENCY_SYMBOL_MAP[isoEnd[1]!]) return CURRENCY_SYMBOL_MAP[isoEnd[1]!]!;
  const isoStart = trimmed.match(/^([A-Z]{3})\b/);
  if (isoStart && CURRENCY_SYMBOL_MAP[isoStart[1]!]) return CURRENCY_SYMBOL_MAP[isoStart[1]!]!;
  // Multi-char symbols (try longer keys first to avoid "R" matching before "R$")
  const keys = Object.keys(CURRENCY_SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (trimmed.includes(k)) return CURRENCY_SYMBOL_MAP[k]!;
  }
  return null;
}

export function formatPrice(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "-";
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}
