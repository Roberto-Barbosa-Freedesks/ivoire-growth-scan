/**
 * Apify REST API client
 * Uses the synchronous run endpoint: run-sync-get-dataset-items
 * No SDK needed — pure fetch, works from browser SPA.
 *
 * Free tier: $5 USD/month (~55 full diagnostics/month with all actors)
 * Token: apify.com → Settings → Integrations → API token
 */

const APIFY_BASE = 'https://api.apify.com/v2';

export interface ApifyRunOptions {
  timeoutSecs?: number;   // max wait (default 90)
  memoryMbytes?: number;  // RAM for the run (default actor default)
}

/**
 * Run an Apify actor synchronously and return the dataset items.
 * Throws on network error; returns [] on empty result or run failure.
 */
export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  options: ApifyRunOptions = {}
): Promise<T[]> {
  if (!token) return [];

  const { timeoutSecs = 90, memoryMbytes } = options;

  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSecs),
    ...(memoryMbytes ? { memory: String(memoryMbytes) } : {}),
  });

  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?${params}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (timeoutSecs + 15) * 1000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[Apify] ${actorId} failed HTTP ${res.status}: ${body.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    // Response may be array directly or { items: [] }
    if (Array.isArray(data)) return data as T[];
    if (data && Array.isArray(data.items)) return data.items as T[];
    return [];
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn(`[Apify] ${actorId} timed out after ${timeoutSecs}s`);
    } else {
      console.warn(`[Apify] ${actorId} error:`, err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
