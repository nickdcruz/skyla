// v1.0
import { getClient, type Client } from "./client";
import { decodeDateResponse, type DecodedDatePrice } from "./decoders";
import { encodeBatchExecuteBody, GOOGLE_FLIGHTS_DATES_URL, parseBatchExecuteResponse } from "./wire";
import { buildDateSearchPayload } from "./proto";
import type { DateSearchFilters } from "../models/google-flights/dates";

const RPC_ID = "YlrQNd";

export class SearchDates {
  private readonly client: Client;

  constructor(client?: Client) {
    this.client = client ?? getClient();
  }

  async search(filters: DateSearchFilters): Promise<DecodedDatePrice[] | null> {
    const payload = buildDateSearchPayload(filters);
    const body = encodeBatchExecuteBody(RPC_ID, payload);
    try {
      const res = await this.client.post(GOOGLE_FLIGHTS_DATES_URL, { body });
      const parsed = parseBatchExecuteResponse(res.text);
      if (parsed == null) return null;
      const decoded = decodeDateResponse(parsed);
      if (decoded.length === 0) return null;
      return decoded;
    } catch (err) {
      console.error("[SearchDates] search failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }
}
