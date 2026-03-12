/**
 * Google SERP results via Apify
 *
 * Actor: apify/google-search-scraper
 *   Input:  { queries: [query], maxPagesPerQuery: 1, resultsPerPage: 10,
 *             languageCode: 'pt', countryCode: 'br' }
 *   Fields: organicResults[], paidResults[], peopleAlsoAsk[], relatedSearches[],
 *           aiOverviewText, featuredSnippet
 *
 * Purpose: Google SERP analysis — organic ranking, paid ads presence, People Also Ask,
 *          AI Overview detection, and brand visibility for a target domain.
 *
 * Cost: ~$0.02–0.04 per query | Free tier ($5/mo): ~125–250 queries/month
 */

import { runApifyActor } from './apifyClient';

export interface GoogleSearchResult {
  query: string;
  organicResults: Array<{
    title: string;
    url: string;
    description: string;
    position: number;
  }>;
  paidResults: Array<{
    title: string;
    url: string;
    description: string;
  }>;
  peopleAlsoAsk: string[];
  aiOverview?: string;       // AI Overview text if present
  relatedSearches: string[];
  targetDomainInTop10: boolean; // is targetDomain in top 10 organic results?
  targetDomainPosition?: number;
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

function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

export async function fetchGoogleSearch(
  query: string,
  targetDomain: string,
  apifyToken: string
): Promise<GoogleSearchResult> {
  const normalizedTarget = extractDomain(targetDomain);

  const empty: GoogleSearchResult = {
    query,
    organicResults: [],
    paidResults: [],
    peopleAlsoAsk: [],
    aiOverview: undefined,
    relatedSearches: [],
    targetDomainInTop10: false,
    targetDomainPosition: undefined,
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  try {
    items = await runApifyActor(
      'apify/google-search-scraper',
      {
        queries: [query],
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        languageCode: 'pt',
        countryCode: 'br',
      },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  if (!items.length) {
    return {
      ...empty,
      findings: [`Sem resultados SERP para a query: "${query}"`],
      dataSources: ['Google Search via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  // --- Organic results ---
  const rawOrganic = (d.organicResults ?? d.organic_results ?? d.results ?? []) as unknown[];
  const organicResults: GoogleSearchResult['organicResults'] = [];

  for (let i = 0; i < rawOrganic.length; i++) {
    const r = rawOrganic[i] as Record<string, unknown>;
    const title = str(r.title ?? r.heading ?? '');
    const url = str(r.url ?? r.link ?? r.href ?? '');
    const description = str(r.description ?? r.snippet ?? r.text ?? '');
    const position = typeof r.position === 'number' ? r.position : i + 1;
    if (url) {
      organicResults.push({ title, url, description, position });
    }
  }

  // --- Paid results ---
  const rawPaid = (d.paidResults ?? d.paid_results ?? d.ads ?? []) as unknown[];
  const paidResults: GoogleSearchResult['paidResults'] = [];

  for (const r of rawPaid) {
    const ad = r as Record<string, unknown>;
    const title = str(ad.title ?? ad.heading ?? '');
    const url = str(ad.url ?? ad.link ?? ad.href ?? '');
    const description = str(ad.description ?? ad.snippet ?? '');
    if (url) {
      paidResults.push({ title, url, description });
    }
  }

  // --- People Also Ask ---
  const rawPAA = (d.peopleAlsoAsk ?? d.people_also_ask ?? d.relatedQuestions ?? []) as unknown[];
  const peopleAlsoAsk: string[] = rawPAA
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = item as Record<string, unknown>;
      return str(obj.question ?? obj.text ?? obj.title ?? '');
    })
    .filter(Boolean);

  // --- AI Overview ---
  const aiOverviewRaw = d.aiOverviewText ?? d.ai_overview ?? d.featuredSnippet ?? d.featured_snippet;
  const aiOverview = aiOverviewRaw ? str(aiOverviewRaw) : undefined;

  // --- Related Searches ---
  const rawRelated = (d.relatedSearches ?? d.related_searches ?? d.relatedQueries ?? []) as unknown[];
  const relatedSearches: string[] = rawRelated
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = item as Record<string, unknown>;
      return str(obj.query ?? obj.text ?? obj.title ?? '');
    })
    .filter(Boolean);

  // --- Target domain check ---
  let targetDomainInTop10 = false;
  let targetDomainPosition: number | undefined;

  for (const result of organicResults) {
    const resultDomain = extractDomain(result.url);
    if (resultDomain.includes(normalizedTarget) || normalizedTarget.includes(resultDomain)) {
      targetDomainInTop10 = true;
      targetDomainPosition = result.position;
      break;
    }
  }

  // --- Findings ---
  const findings: string[] = [];

  findings.push(`SERP para "${query}": ${organicResults.length} resultados orgânicos, ${paidResults.length} anúncios`);

  if (targetDomainInTop10 && targetDomainPosition !== undefined) {
    findings.push(`${normalizedTarget} aparece na posição #${targetDomainPosition} no top 10 orgânico`);
  } else if (organicResults.length > 0) {
    findings.push(`${normalizedTarget} não aparece no top 10 orgânico para esta query`);
  }

  if (paidResults.length > 0) {
    findings.push(`${paidResults.length} anúncio(s) pago(s) detectado(s) na SERP`);
  }

  if (aiOverview) {
    findings.push(`AI Overview presente na SERP (${aiOverview.slice(0, 80)}...)`);
  }

  if (peopleAlsoAsk.length) {
    findings.push(`People Also Ask: ${peopleAlsoAsk.slice(0, 3).join(' | ')}`);
  }

  return {
    query,
    organicResults,
    paidResults,
    peopleAlsoAsk,
    aiOverview,
    relatedSearches,
    targetDomainInTop10,
    targetDomainPosition,
    findings,
    dataSources: ['Google Search via Apify (apify/google-search-scraper)'],
  };
}
