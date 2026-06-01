// v1.0
export class TokenBucketRateLimiter {
  private readonly capacityValue: number;
  private readonly refillPerSecond: number;
  private tokens: number;
  private lastRefill: number;
  private queue: Promise<void> = Promise.resolve();
  constructor(calls: number, period: number) {
    if (calls <= 0) throw new Error("calls must be positive");
    if (period <= 0) throw new Error("period must be positive");
    this.capacityValue = calls;
    this.refillPerSecond = calls / period;
    this.tokens = calls;
    this.lastRefill = performance.now() / 1000;
  }
  get capacity(): number { return Math.floor(this.capacityValue); }
  private refill(): void {
    const now = performance.now() / 1000;
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacityValue, this.tokens + elapsed * this.refillPerSecond);
      this.lastRefill = now;
    }
  }
  async acquire(tokens = 1, timeoutMs: number | null = null): Promise<boolean> {
    if (tokens <= 0) return true;
    if (tokens > this.capacityValue) throw new Error(`tokens=${tokens} exceeds capacity=${this.capacity}`);
    const deadline = timeoutMs == null ? null : performance.now() + timeoutMs;
    let release: () => void = () => {};
    const slot = new Promise<void>((res) => { release = res; });
    const prev = this.queue;
    this.queue = prev.then(() => slot);
    await prev;
    try {
      while (true) {
        this.refill();
        if (this.tokens >= tokens) { this.tokens -= tokens; return true; }
        const deficit = tokens - this.tokens;
        const waitS = deficit / this.refillPerSecond;
        let waitMs = waitS * 1000;
        if (deadline != null) {
          const remaining = deadline - performance.now();
          if (remaining <= 0) return false;
          waitMs = Math.min(waitMs, remaining);
        }
        await new Promise<void>((res) => setTimeout(res, waitMs));
      }
    } finally { release(); }
  }
}
let DEFAULT_MAX_WORKERS = 10;
export function configureConcurrency(maxWorkers: number): void {
  if (maxWorkers <= 0) throw new Error("maxWorkers must be positive");
  DEFAULT_MAX_WORKERS = maxWorkers;
}
export function getDefaultMaxWorkers(): number { return DEFAULT_MAX_WORKERS; }
export async function parallelMap<T, R>(fn: (item: T) => Promise<R>, items: Iterable<T>, options: { maxWorkers?: number } = {}): Promise<R[]> {
  const materialised = Array.isArray(items) ? items : [...items];
  const n = materialised.length;
  if (n === 0) return [];
  const workers = options.maxWorkers ?? DEFAULT_MAX_WORKERS;
  if (n === 1 || workers === 1) {
    const out: R[] = Array.from({ length: n });
    for (let i = 0; i < n; i++) out[i] = await fn(materialised[i] as T);
    return out;
  }
  const results: R[] = Array.from({ length: n });
  let firstError: unknown = null;
  let nextIndex = 0;
  const runner = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= n) return;
      try { results[idx] = await fn(materialised[idx] as T); }
      catch (err) { if (firstError == null) firstError = err; }
    }
  };
  const workerPromises: Promise<void>[] = [];
  const cap = Math.min(workers, n);
  for (let i = 0; i < cap; i++) workerPromises.push(runner());
  await Promise.all(workerPromises);
  if (firstError != null) throw firstError;
  return results;
}
