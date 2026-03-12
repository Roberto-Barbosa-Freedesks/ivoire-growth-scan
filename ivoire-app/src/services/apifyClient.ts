/**
 * Apify REST API client
 * Uses the synchronous run endpoint: run-sync-get-dataset-items
 * No SDK needed — pure fetch, works from browser SPA.
 *
 * Features:
 * - Retry with exponential backoff for transient failures (429, 5xx)
 * - Configurable timeout with abort signal
 * - Returns [] on empty result or non-retryable failure (never throws)
 *
 * Free tier: $5 USD/month (~55 full diagnostics/month with all actors)
 * Token: apify.com → Settings → Integrations → API token
 */

const APIFY_BASE = 'https://api.apify.com/v2';

export interface ApifyRunOptions {
  timeoutSecs?: number;   // max wait per attempt (default 90)
  memoryMbytes?: number;  // RAM for the run (default actor default)
  maxRetries?: number;    // number of retries on transient error (default 2)
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single attempt to run an Apify actor synchronously.
 * Returns the HTTP response or throws on network/abort error.
 */
async function attemptApifyRun(
  url: string,
  input: Record<string, unknown>,
  timeoutSecs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (timeoutSecs + 15) * 1000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run an Apify actor synchronously and return the dataset items.
 * Retries up to maxRetries times on rate-limit (429) or server errors (5xx),
 * with exponential backoff (1s, 3s, 9s …).
 * Returns [] on empty result or permanent failure — never throws.
 */
export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  options: ApifyRunOptions = {}
): Promise<T[]> {
  if (!token) return [];

  const { timeoutSecs = 90, memoryMbytes, maxRetries = 2 } = options;

  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSecs),
    ...(memoryMbytes ? { memory: String(memoryMbytes) } : {}),
  });

  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?${params}`;

  let lastError = '';
  let attempt = 0;

  while (attempt <= maxRetries) {
    // Exponential backoff before retries (not before first attempt)
    if (attempt > 0) {
      const delayMs = Math.min(1000 * Math.pow(3, attempt - 1), 15_000); // 1s, 3s, 9s…
      console.info(`[Apify] ${actorId} retry ${attempt}/${maxRetries} after ${delayMs}ms (${lastError})`);
      await sleep(delayMs);
    }

    try {
      const res = await attemptApifyRun(url, input, timeoutSecs);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const isRetryable = res.status === 429 || res.status >= 500;

        if (isRetryable && attempt < maxRetries) {
          lastError = `HTTP ${res.status}`;
          attempt++;
          continue;
        }

        console.warn(`[Apify] ${actorId} failed HTTP ${res.status}: ${body.slice(0, 200)}`);
        return [];
      }

      const data = await res.json();
      // Response may be array directly or { items: [] }
      if (Array.isArray(data)) return data as T[];
      if (data && Array.isArray(data.items)) return data.items as T[];
      return [];

    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError';
      if (isAbort) {
        console.warn(`[Apify] ${actorId} timed out after ${timeoutSecs}s (attempt ${attempt + 1})`);
        // Don't retry on timeout — it would just double the wait
        return [];
      }

      // Network error — retryable
      lastError = (err as Error).message ?? 'network error';
      if (attempt < maxRetries) {
        attempt++;
        continue;
      }

      console.warn(`[Apify] ${actorId} error after ${maxRetries} retries:`, err);
      return [];
    }
  }

  return [];
}
