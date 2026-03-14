/**
 * SpyFu competitor keyword intelligence via Apify
 *
 * Primary:  canadesk/spyfu
 *   Input:  { domain: "example.com" }
 *   Fields: organicKeywords, paidKeywords, adSpend, clicks, organicCompetitors,
 *           paidCompetitors, topKeywords[]
 *
 * Fallback: pyfu-multiple-domains-seo-ppc-and-keyword-insights (multi-domain version)
 *   Input:  { domains: ["example.com"] }  or  { domain: "example.com" }
 *
 * Purpose: Competitor SEO/PPC intelligence — keywords, ad spend estimates,
 *          organic competitors, and paid competitors.
 *
 * Used in: midia_paga_criativos, mix_trafego, seo_offpage, competitor benchmarking page
 *
 * Cost: ~$0.01–0.03 per domain | Free tier ($5/mo): ~166–500 runs/month
 */

import { runApifyActor } from './apifyClient';

export interface SpyFuResult {
  found: boolean;
  domain: string;
  organicKeywords: number | null;
  paidKeywords: number | null;
  estimatedAdSpend: number | null;    // USD/month estimate
  estimatedClicks: number | null;
  organicCompetitors: string[];
  paidCompetitors: string[];
  topKeywords: Array<{
    keyword: string;
    position: number | null;
    volume: number | null;
    cpc: number | null;
    isPaid: boolean;
  }>;
  score: number;   // 1–4
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

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  const shorthand = s.match(/^([0-9.,]+)\s*([KMBkmb])$/);
  if (shorthand) {
    const base = parseFloat(shorthand[1].replace(',', '.'));
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[shorthand[2].toLowerCase()] ?? 1;
    return isNaN(base) ? null : Math.round(base * mult);
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function calcScore(r: SpyFuResult): number {
  let pts = 0;
  if (r.organicKeywords !== null) {
    if (r.organicKeywords >= 1000) pts += 2;
    else if (r.organicKeywords >= 100) pts += 1;
  }
  if (r.paidKeywords !== null && r.paidKeywords > 0) pts += 1;
  if (r.estimatedAdSpend !== null && r.estimatedAdSpend > 100) pts += 1;
  if (pts >= 3) return 3;
  if (pts >= 2) return 2;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchSpyFu(
  siteUrl: string,
  apifyToken: string
): Promise<SpyFuResult> {
  const domain = extractDomain(siteUrl);

  const empty: SpyFuResult = {
    found: false, domain,
    organicKeywords: null, paidKeywords: null,
    estimatedAdSpend: null, estimatedClicks: null,
    organicCompetitors: [], paidCompetitors: [], topKeywords: [],
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: canadesk/spyfu
  try {
    items = await runApifyActor(
      'canadesk/spyfu',
      { domain },
      apifyToken,
      { timeoutSecs: 120 }
    );
    if (items.length) actorUsed = 'canadesk/spyfu';
  } catch { /* fall through */ }

  // Fallback: pyfu-multiple-domains-seo-ppc-and-keyword-insights
  if (!items.length) {
    try {
      items = await runApifyActor(
        'pyfu-multiple-domains-seo-ppc-and-keyword-insights',
        { domains: [domain] },
        apifyToken,
        { timeoutSecs: 120 }
      );
      if (!items.length) {
        items = await runApifyActor(
          'pyfu-multiple-domains-seo-ppc-and-keyword-insights',
          { domain },
          apifyToken,
          { timeoutSecs: 120 }
        );
      }
      if (items.length) actorUsed = 'pyfu-multiple-domains-seo-ppc-and-keyword-insights';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ SpyFu não retornou dados para ${domain}`],
      dataSources: ['SpyFu via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  // Extract competitor lists
  const rawOrganicComp = (
    d.organicCompetitors ?? d.organic_competitors ?? d.seoCompetitors ?? d.competitors ?? []
  ) as unknown[];
  const organicCompetitors: string[] = rawOrganicComp
    .slice(0, 5)
    .map((c) => {
      if (typeof c === 'string') return c;
      const cc = c as Record<string, unknown>;
      return str(cc.domain ?? cc.url ?? cc.name ?? '');
    })
    .filter(Boolean);

  const rawPaidComp = (d.paidCompetitors ?? d.paid_competitors ?? d.adCompetitors ?? []) as unknown[];
  const paidCompetitors: string[] = rawPaidComp
    .slice(0, 5)
    .map((c) => {
      if (typeof c === 'string') return c;
      const cc = c as Record<string, unknown>;
      return str(cc.domain ?? cc.url ?? cc.name ?? '');
    })
    .filter(Boolean);

  // Extract top keywords
  const rawKeywords = (
    d.topKeywords ?? d.top_keywords ?? d.keywords ?? d.organicKeywordsList ?? []
  ) as unknown[];
  const topKeywords: SpyFuResult['topKeywords'] = (rawKeywords as unknown[])
    .slice(0, 10)
    .map((kw) => {
      const k = kw as Record<string, unknown>;
      return {
        keyword: str(k.keyword ?? k.query ?? k.term ?? ''),
        position: num(k.position ?? k.rank ?? k.ranking),
        volume: num(k.volume ?? k.searchVolume ?? k.monthly_searches),
        cpc: num(k.cpc ?? k.cost_per_click ?? k.costPerClick),
        isPaid: !!(k.isPaid ?? k.is_paid ?? k.paid ?? k.adPosition),
      };
    })
    .filter((k) => k.keyword.length > 0);

  const result: SpyFuResult = {
    found: true,
    domain,
    organicKeywords: num(
      d.organicKeywords ?? d.organic_keywords ?? d.seoKeywords ?? d.keywordsCount
    ),
    paidKeywords: num(d.paidKeywords ?? d.paid_keywords ?? d.ppcKeywords),
    estimatedAdSpend: num(
      d.estimatedAdSpend ?? d.estimated_ad_spend ?? d.monthlyAdSpend ?? d.adBudget
    ),
    estimatedClicks: num(
      d.estimatedClicks ?? d.estimated_clicks ?? d.monthlyClicks ?? d.clicks
    ),
    organicCompetitors,
    paidCompetitors,
    topKeywords,
    score: 1,
    findings: [],
    dataSources: [`SpyFu via Apify (${actorUsed})`],
  };

  if (result.organicKeywords !== null)
    result.findings.push(`✓ Palavras-chave orgânicas (SpyFu): ${result.organicKeywords.toLocaleString('pt-BR')}`);
  if (result.paidKeywords !== null && result.paidKeywords > 0)
    result.findings.push(`✓ Palavras-chave pagas (PPC): ${result.paidKeywords.toLocaleString('pt-BR')}`);
  if (result.estimatedAdSpend !== null && result.estimatedAdSpend > 0)
    result.findings.push(`Investimento estimado em Ads: $${result.estimatedAdSpend.toLocaleString('en-US')}/mês`);
  if (organicCompetitors.length > 0)
    result.findings.push(`Concorrentes orgânicos: ${organicCompetitors.slice(0, 3).join(', ')}`);
  if (paidCompetitors.length > 0)
    result.findings.push(`Concorrentes em Ads: ${paidCompetitors.slice(0, 3).join(', ')}`);

  result.score = calcScore(result);
  return result;
}
