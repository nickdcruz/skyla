// v1.0
// Best-effort currency extraction + formatting helpers.

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
  // ISO code at start or end?
  const isoEnd = trimmed.match(/\b([A-Z]{3})\b\s*$/);
  if (isoEnd && CURRENCY_SYMBOL_MAP[isoEnd[1]!]) return CURRENCY_SYMBOL_MAP[isoEnd[1]!]!;
  const isoStart = trimmed.match(/^([A-Z]{3})\b/);
  if (isoStart && CURRENCY_SYMBOL_MAP[isoStart[1]!]) return CURRENCY_SYMBOL_MAP[isoStart[1]!]!;
  // Multi-char symbols (try longer keys first)
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
