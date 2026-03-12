/**
 * SimilarWeb data via Apify
 *
 * Primary:  epctex/similarweb-scraper (more stable, richer output)
 *   Input:  { url: domain }
 *   Fields: visits, globalRank, bounceRate, avgVisitDuration, pagesPerVisit,
 *           trafficSources{}, topCountries[]
 *
 * Fallback: curious_coder/similarweb-scraper (legacy)
 *   Input:  { domain }
 *
 * Cost: ~$0.02 per domain | Free tier ($5/mo): ~250 lookups/month
 * Note: SimilarWeb only indexes sites with >50k monthly visits.
 */

import { runApifyActor } from './apifyClient';

export interface SimilarwebResult {
  found: boolean;
  monthlyVisits: number | null;
  globalRank: number | null;
  bounceRate: number | null;       // 0-1
  avgVisitDuration: number | null; // seconds
  pagesPerVisit: number | null;
  trafficSources: {
    direct: number | null;    // 0-1
    search: number | null;
    social: number | null;
    referral: number | null;
    paid: number | null;
    email: number | null;
  };
  topCountries: Array<{ country: string; share: number }>;
  score: number;
  findings: string[];
  dataSources: string[];
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function pct(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? null : n > 1 ? n / 100 : n;
}

function num(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function calcScore(r: SimilarwebResult): number {
  const { monthlyVisits, trafficSources } = r;
  if (!monthlyVisits) return 1;

  let pts = 0;
  // Traffic volume
  if (monthlyVisits >= 500_000) pts += 3;
  else if (monthlyVisits >= 100_000) pts += 2;
  else if (monthlyVisits >= 10_000) pts += 1;

  // Channel diversity (how many active channels)
  const src = trafficSources;
  const activeChannels = [src.direct, src.search, src.social, src.referral, src.paid]
    .filter((v) => v !== null && v > 0.05).length;
  if (activeChannels >= 4) pts += 2;
  else if (activeChannels >= 2) pts += 1;

  if (pts >= 5) return 4;
  if (pts >= 3) return 3;
  if (pts >= 2) return 2;
  return 1;
}

export async function fetchSimilarweb(
  siteUrl: string,
  apifyToken: string
): Promise<SimilarwebResult> {
  const domain = extractDomain(siteUrl);
  const empty: SimilarwebResult = {
    found: false, monthlyVisits: null, globalRank: null,
    bounceRate: null, avgVisitDuration: null, pagesPerVisit: null,
    trafficSources: { direct: null, search: null, social: null, referral: null, paid: null, email: null },
    topCountries: [], score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: epctex/similarweb-scraper
  try {
    items = await runApifyActor(
      'epctex/similarweb-scraper',
      { startUrls: [{ url: `https://www.similarweb.com/website/${domain}/` }] },
      apifyToken,
      { timeoutSecs: 90 }
    );
    if (items.length) actorUsed = 'epctex/similarweb-scraper';
  } catch { /* fall through */ }

  // Fallback: curious_coder/similarweb-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'curious_coder/similarweb-scraper',
        { domain },
        apifyToken,
        { timeoutSecs: 90 }
      );
      if (items.length) actorUsed = 'curious_coder/similarweb-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ ${domain} não encontrado no SimilarWeb (tráfego insuficiente para indexação — <50k visitas/mês)`],
      dataSources: ['SimilarWeb via Apify (domínio abaixo do limiar de dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const sources = (d.trafficSources ?? d.traffic_sources ?? {}) as Record<string, unknown>;
  const trafficSources = {
    direct: pct(sources.direct ?? sources.Direct),
    search: pct(sources.search ?? sources.Search ?? sources.organicSearch),
    social: pct(sources.social ?? sources.Social),
    referral: pct(sources.referral ?? sources.Referral),
    paid: pct(sources.paid ?? sources.Paid ?? sources.paidSearch),
    email: pct(sources.email ?? sources.Email ?? sources.mail),
  };

  const topCountries: Array<{ country: string; share: number }> = [];
  const countries = (d.topCountries ?? d.top_countries ?? d.countries) as unknown[];
  if (Array.isArray(countries)) {
    for (const c of countries.slice(0, 5)) {
      const cc = c as Record<string, unknown>;
      if (cc.country || cc.countryName || cc.name) {
        topCountries.push({
          country: String(cc.country ?? cc.countryName ?? cc.name),
          share: Number(cc.share ?? cc.value ?? 0),
        });
      }
    }
  }

  const monthlyVisits = num(d.monthlyVisits ?? d.monthly_visits ?? d.visits) ?? null;
  const globalRank = num(d.globalRank ?? d.global_rank ?? d.rank) ?? null;
  const bounceRate = pct(d.bounceRate ?? d.bounce_rate) ?? null;
  const avgVisitDuration = num(d.avgVisitDuration ?? d.avg_visit_duration ?? d.averageVisitDuration) ?? null;
  const pagesPerVisit = num(d.pagesPerVisit ?? d.pages_per_visit) ?? null;

  const result: SimilarwebResult = {
    found: true, monthlyVisits, globalRank, bounceRate, avgVisitDuration, pagesPerVisit,
    trafficSources, topCountries, score: 1, findings: [], dataSources: [`SimilarWeb via Apify (${actorUsed})`],
  };

  // Build findings
  if (monthlyVisits) {
    result.findings.push(`✓ ${monthlyVisits.toLocaleString('pt-BR')} visitas/mês`);
  }
  if (globalRank) {
    result.findings.push(`✓ Ranking global: #${globalRank.toLocaleString('pt-BR')}`);
  }
  if (bounceRate !== null) {
    result.findings.push(`Taxa de rejeição: ${(bounceRate * 100).toFixed(1)}%`);
  }
  const srcFmt = (label: string, val: number | null) =>
    val !== null ? `${label}: ${(val * 100).toFixed(1)}%` : null;
  const srcLines = [
    srcFmt('Direto', trafficSources.direct),
    srcFmt('Orgânico', trafficSources.search),
    srcFmt('Social', trafficSources.social),
    srcFmt('Referência', trafficSources.referral),
    srcFmt('Pago', trafficSources.paid),
  ].filter(Boolean);
  if (srcLines.length) result.findings.push(`Mix de canais — ${srcLines.join(' | ')}`);
  if (topCountries.length) {
    result.findings.push(`Principais países: ${topCountries.map((c) => c.country).join(', ')}`);
  }

  result.score = calcScore(result);
  return result;
}
