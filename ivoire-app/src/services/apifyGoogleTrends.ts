/**
 * Google Trends search interest via Apify
 *
 * Primary:  apify/google-trends-scraper
 *   Input:  { searchTerms: string[], geo: 'BR', timeRange: 'today 12-m' }
 *
 * Fallback 1: data_xplorer/google-trending-now
 *   Input:  { country: 'BR', category: 'all' }  (returns top trending topics)
 *
 * Fallback 2: easyapi/google-realtime-trends-data-scraper
 *   Input:  { geo: 'BR', hl: 'pt-BR' }
 *
 * Purpose: Track brand search interest trend over 12 months and compare against
 *          up to 2 competitors. Identifies rising, stable or declining brand awareness.
 *
 * Cost: ~$0.02–0.03 per run | Free tier ($5/mo): ~166–250 runs/month
 * Note: Google Trends normalizes values 0–100 relative to the peak term in the set.
 */

import { runApifyActor } from './apifyClient';

export interface GoogleTrendsResult {
  found: boolean;
  terms: Array<{
    term: string;
    averageInterest: number;          // 0-100
    trend: 'rising' | 'stable' | 'declining';
    peakMonth?: string;
    data: Array<{ date: string; value: number }>;
  }>;
  companyTerm?: {                     // specific data for the company being analyzed
    name: string;
    averageInterest: number;
    trend: 'rising' | 'stable' | 'declining';
  };
  findings: string[];
  dataSources: string[];
}

function num(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function computeAverage(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Determine trend direction by comparing the average of the last 3 data points
 * against the average of the first 3 data points.
 * Rising: >20% increase | Declining: >20% decrease | Stable: otherwise
 */
function computeTrend(data: Array<{ date: string; value: number }>): 'rising' | 'stable' | 'declining' {
  if (data.length < 4) return 'stable';

  const first3 = data.slice(0, 3).map((d) => d.value);
  const last3 = data.slice(-3).map((d) => d.value);

  const avgFirst = computeAverage(first3);
  const avgLast = computeAverage(last3);

  if (avgFirst === 0) return avgLast > 5 ? 'rising' : 'stable';

  const changePct = (avgLast - avgFirst) / avgFirst;

  if (changePct > 0.2) return 'rising';
  if (changePct < -0.2) return 'declining';
  return 'stable';
}

function findPeakMonth(data: Array<{ date: string; value: number }>): string | undefined {
  if (!data.length) return undefined;
  let peak = data[0];
  for (const point of data) {
    if (point.value > peak.value) peak = point;
  }
  return peak.date;
}

export async function fetchGoogleTrends(
  companyName: string,
  competitorNames: string[],
  apifyToken: string
): Promise<GoogleTrendsResult> {
  // Use up to 2 competitors to stay within Google Trends 5-term limit
  const searchTerms = [companyName, ...competitorNames.slice(0, 2)];

  const empty: GoogleTrendsResult = {
    found: false,
    terms: [],
    companyTerm: undefined,
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: apify/google-trends-scraper (12-month history)
  try {
    items = await runApifyActor(
      'apify/google-trends-scraper',
      { searchTerms, geo: 'BR', timeRange: 'today 12-m' },
      apifyToken,
      { timeoutSecs: 90 }
    );
    if (items.length) actorUsed = 'apify/google-trends-scraper';
  } catch { /* fall through */ }

  // Fallback 1: data_xplorer/google-trending-now (realtime trending — no 12-month history but gives trending signal)
  if (!items.length) {
    try {
      items = await runApifyActor(
        'data_xplorer/google-trending-now',
        { country: 'BR', category: 'all' },
        apifyToken,
        { timeoutSecs: 60 }
      );
      if (items.length) actorUsed = 'data_xplorer/google-trending-now';
    } catch { /* fall through */ }
  }

  // Fallback 2: easyapi/google-realtime-trends-data-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'easyapi/google-realtime-trends-data-scraper',
        { geo: 'BR', hl: 'pt-BR' },
        apifyToken,
        { timeoutSecs: 60 }
      );
      if (items.length) actorUsed = 'easyapi/google-realtime-trends-data-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`Sem dados do Google Trends para ${companyName}`],
      dataSources: ['Google Trends via Apify (sem dados)'],
    };
  }

  const terms: GoogleTrendsResult['terms'] = [];

  for (const item of items) {
    const d = item as Record<string, unknown>;

    // The actor may return one item per search term, or all terms in one item
    // Handle both: single-term item with `term` + `interest[]`, or multi-term with timeline

    const termName = typeof d.term === 'string'
      ? d.term.trim()
      : typeof d.keyword === 'string'
        ? d.keyword.trim()
        : typeof d.searchTerm === 'string'
          ? d.searchTerm.trim()
          : '';

    // Try to extract timeline data
    const rawInterest = (
      Array.isArray(d.interest)
        ? d.interest
        : Array.isArray(d.timeline)
          ? d.timeline
          : Array.isArray(d.data)
            ? d.data
            : Array.isArray(d.values)
              ? d.values
              : []
    ) as unknown[];

    if (!termName || !rawInterest.length) continue;

    const data: Array<{ date: string; value: number }> = rawInterest.map((point) => {
      const p = point as Record<string, unknown>;
      return {
        date: String(p.date ?? p.time ?? p.formattedTime ?? p.month ?? ''),
        value: num(p.value ?? p.interest ?? p.extractedValue ?? 0),
      };
    });

    const values = data.map((d) => d.value);
    const averageInterest = computeAverage(values);
    const trend = computeTrend(data);
    const peakMonth = findPeakMonth(data);

    terms.push({ term: termName, averageInterest, trend, peakMonth, data });
  }

  // If actor returned a single item with all terms (multi-term format)
  // Some versions return: { trends: { "Company A": [...], "Company B": [...] } }
  if (!terms.length && items.length === 1) {
    const d = items[0] as Record<string, unknown>;
    const trendsObj = (d.trends ?? d.interestOverTime ?? {}) as Record<string, unknown>;

    for (const [termName, rawData] of Object.entries(trendsObj)) {
      if (!Array.isArray(rawData)) continue;

      const data: Array<{ date: string; value: number }> = (rawData as unknown[]).map((point) => {
        const p = point as Record<string, unknown>;
        return {
          date: String(p.date ?? p.time ?? p.formattedTime ?? ''),
          value: num(p.value ?? p.interest ?? 0),
        };
      });

      const values = data.map((d) => d.value);
      const averageInterest = computeAverage(values);
      const trend = computeTrend(data);
      const peakMonth = findPeakMonth(data);

      terms.push({ term: termName, averageInterest, trend, peakMonth, data });
    }
  }

  if (!terms.length) {
    return {
      ...empty,
      findings: [`Google Trends retornou dados mas sem timeline legível para ${companyName}`],
      dataSources: [`Google Trends via Apify (${actorUsed})`],
    };
  }

  // Identify the company's own term
  const companyEntry = terms.find(
    (t) => t.term.toLowerCase() === companyName.toLowerCase()
  ) ?? terms[0];

  const companyTerm: GoogleTrendsResult['companyTerm'] = {
    name: companyEntry.term,
    averageInterest: companyEntry.averageInterest,
    trend: companyEntry.trend,
  };

  // Build findings
  const findings: string[] = [];
  const trendLabel: Record<string, string> = {
    rising: 'em alta',
    stable: 'estável',
    declining: 'em queda',
  };

  findings.push(
    `Interesse de busca (12 meses, Brasil): ${companyEntry.term} — ${companyEntry.averageInterest}/100 (${trendLabel[companyEntry.trend]})`
  );

  if (companyEntry.peakMonth) {
    findings.push(`Pico de interesse: ${companyEntry.peakMonth}`);
  }

  // Competitor comparison
  const competitors = terms.filter((t) => t.term.toLowerCase() !== companyName.toLowerCase());
  for (const comp of competitors) {
    const comparison =
      companyEntry.averageInterest > comp.averageInterest
        ? `acima de ${comp.term} (${comp.averageInterest}/100)`
        : companyEntry.averageInterest < comp.averageInterest
          ? `abaixo de ${comp.term} (${comp.averageInterest}/100)`
          : `empatado com ${comp.term} (${comp.averageInterest}/100)`;
    findings.push(`${companyEntry.term} ${comparison} no interesse de busca`);
  }

  if (companyEntry.trend === 'rising') {
    findings.push(`Tendência positiva: crescimento de interesse nos últimos 3 meses`);
  } else if (companyEntry.trend === 'declining') {
    findings.push(`Atenção: queda de interesse de busca nos últimos 3 meses`);
  }

  return {
    found: true,
    terms,
    companyTerm,
    findings,
    dataSources: [`Google Trends via Apify (${actorUsed})`],
  };
}
