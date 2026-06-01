// v1.0
import { TokenBucketRateLimiter } from "./concurrency";
import { SearchClientError, SearchConnectionError, SearchHTTPError, SearchTimeoutError } from "./exceptions";

export interface ClientOptions {
  callsPerSecond?: number;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ClientResponse {
  text: string;
  status: number;
}

const CHROME_HEADERS: Record<string, string> = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "content-type": "application/x-www-form-urlencoded",
  "pragma": "no-cache",
  "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-arch": '"x86"',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-full-version-list": '"Chromium";v="131.0.6778.205", "Google Chrome";v="131.0.6778.205", "Not_A Brand";v="24.0.0.0"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-model": '""',
  "sec-ch-ua-platform": '"Windows"',
  "sec-ch-ua-platform-version": '"19.0.0"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-same-domain": "1",
};

export class Client {
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.rateLimiter = new TokenBucketRateLimiter(options.callsPerSecond ?? 10, 1);
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.retries = options.retries ?? 3;
    this.backoffMs = options.backoffMs ?? 1_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async post(url: string, options: { body: string }): Promise<ClientResponse> {
    await this.rateLimiter.acquire(1);
    let lastError: Error = new Error("No attempts made");
    for (let attempt = 0; attempt < this.retries; attempt++) {
      if (attempt > 0) {
        const wait = this.backoffMs * 2 ** (attempt - 1);
        await new Promise<void>((r) => setTimeout(r, wait));
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let response: Response;
        try {
          response = await this.fetchImpl(url, {
            method: "POST",
            headers: CHROME_HEADERS,
            body: options.body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (!response.ok) {
          if (response.status >= 500) {
            lastError = new SearchHTTPError(`HTTP ${response.status}`, response.status);
            continue;
          }
          throw new SearchHTTPError(`HTTP ${response.status}`, response.status);
        }
        const text = await response.text();
        return { text, status: response.status };
      } catch (err) {
        if (err instanceof SearchClientError) throw err;
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            lastError = new SearchTimeoutError(`Request timed out after ${this.timeoutMs}ms`);
            continue;
          }
          const msg = err.message.toLowerCase();
          if (msg.includes("econnreset") || msg.includes("enotfound") || msg.includes("network") || msg.includes("failed to fetch")) {
            lastError = new SearchConnectionError(err.message);
            continue;
          }
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}

let _client: Client | null = null;
export function getClient(): Client {
  if (_client == null) _client = new Client();
  return _client;
}
