// v1.0
// Helpers for encoding Google Flights "f.req" wire payloads.

export const GOOGLE_FLIGHTS_SEARCH_URL =
  "https://www.google.com/_/TravelFrontendUi/data/batchexecute?rpcids=H4cFwe&source-path=%2Ftravel%2Fflights&f.sid=-1&bl=boq_travel-frontend-ui_20240101.00_p0&hl=en&soc-app=162&soc-platform=1&soc-device=1&_reqid=1&rt=c";

export const GOOGLE_FLIGHTS_DATES_URL =
  "https://www.google.com/_/TravelFrontendUi/data/batchexecute?rpcids=YlrQNd&source-path=%2Ftravel%2Fflights&f.sid=-1&bl=boq_travel-frontend-ui_20240101.00_p0&hl=en&soc-app=162&soc-platform=1&soc-device=1&_reqid=1&rt=c";

export function encodeBatchExecuteBody(rpcId: string, payload: unknown): string {
  // Google batchexecute body is x-www-form-urlencoded with an "f.req" parameter
  // whose value is a JSON-encoded array of [["<rpcId>", "<inner-json>", null, "generic"]].
  const innerJson = JSON.stringify(payload);
  const reqArray = [[[rpcId, innerJson, null, "generic"]]];
  const reqJson = JSON.stringify(reqArray);
  return `f.req=${encodeURIComponent(reqJson)}&at=`;
}

export function parseBatchExecuteResponse(text: string): unknown {
  // Strip the )]}'  prefix that Google uses to protect against XSSI.
  const trimmed = text.replace(/^\)]\}'\s*/, "");
  // The body is a length-prefixed multipart envelope. We greedily JSON.parse
  // and look for the first wrb.fr response payload.
  // The naive approach: find every JSON.parse-able substring starting with '['.
  const matches: unknown[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed[i] === "[") {
      // Try to balance brackets.
      let depth = 0;
      let inStr = false;
      let esc = false;
      let j = i;
      for (; j < trimmed.length; j++) {
        const c = trimmed[j];
        if (inStr) {
          if (esc) { esc = false; continue; }
          if (c === "\\") { esc = true; continue; }
          if (c === '"') { inStr = false; continue; }
        } else {
          if (c === '"') { inStr = true; continue; }
          if (c === "[") depth++;
          else if (c === "]") { depth--; if (depth === 0) { j++; break; } }
        }
      }
      const candidate = trimmed.slice(i, j);
      try {
        const parsed = JSON.parse(candidate);
        matches.push(parsed);
      } catch { /* not valid json; skip */ }
      i = j;
    } else {
      i++;
    }
  }
  // Look for the wrb.fr entry containing inner json string.
  for (const m of matches) {
    if (!Array.isArray(m)) continue;
    for (const row of m) {
      if (Array.isArray(row) && row[0] === "wrb.fr" && typeof row[2] === "string") {
        try { return JSON.parse(row[2]); } catch { /* ignore */ }
      }
    }
  }
  return null;
}
