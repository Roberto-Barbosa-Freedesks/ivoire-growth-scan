/**
 * SE Ranking domain metrics via Apify actor: radeance/seranking-scraper
 *
 * Returns: Domain Trust (0–100), Page Trust, backlinks, referring domains,
 *          organic traffic, organic keywords, AI visibility/citations
 *
 * Unique signal: AI Citations (brand mentions in AI-generated search results)
 * → Used in seo_offpage (quaternary fallback) AND semantica_geo (AI visibility boost)
 *
 * Used in cascade: SEMrush → Ahrefs → Ubersuggest → SE Ranking (this) → RDAP base
 *
 * Cost: ~$0.015 per domain
 * Free tier ($5/mo): ~330 lookups/month
 *
 * Input: { urls: ["https://example.com"] }  (radeance actors require urls array)
 * Output fields probed:
 *   domainTrust / domain_trust / dt / DT
 *   pageTrust / page_trust / pt
 *   backlinks / totalBacklinks
 *   referringDomains / referring_domains
 *   organicTraffic / organic_traffic
 *   organicKeywords / organic_keywords
 *   aiVisibility / ai_visibility / aiCitations / ai_citations
 */

import { runApifyActor } from './apifyClient';

export interface SeRankingResult {
  found: boolean;
  domainTrust: number | null;    // 0–100 (SE Ranking DT)
  pageTrust: number | null;      // 0–100
  backlinks: number | null;
  referringDomains: number | null;
  organicTraffic: number | null;
  organicKeywords: number | null;
  aiVisibility: number | null;   // AI-generated result citations score
  aiCitations: number | null;    // number of AI citations found
  score: number;                 // 1–4
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

function calcScore(r: SeRankingResult): number {
  let pts = 0;
  if (r.domainTrust !== null) {
    if (r.domainTrust >= 60) pts += 3;
    else if (r.domainTrust >= 40) pts += 2;
    else if (r.domainTrust >= 20) pts += 1;
  }
  if (r.referringDomains !== null) {
    if (r.referringDomains >= 500) pts += 2;
    else if (r.referringDomains >= 100) pts += 1;
  }
  if (r.backlinks !== null && r.backlinks >= 1000) pts += 1;

  if (pts >= 5) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchSeRanking(
  siteUrl: string,
  apifyToken: string
): Promise<SeRankingResult> {
  const domain = extractDomain(siteUrl);

  const empty: SeRankingResult = {
    found: false,
    domainTrust: null, pageTrust: null,
    backlinks: null, referringDomains: null,
    organicTraffic: null, organicKeywords: null,
    aiVisibility: null, aiCitations: null,
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  const fullUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  let items: unknown[] = [];

  // Primary: urls array (radeance actors require this format)
  try {
    items = await runApifyActor(
      'radeance/seranking-scraper',
      { urls: [fullUrl] },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  // Fallback: domain string format
  if (!items.length) {
    try {
      items = await runApifyActor(
        'radeance/seranking-scraper',
        { domain },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ SE Ranking não retornou dados para ${domain}`],
      dataSources: ['SE Ranking via Apify (radeance/seranking-scraper)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: SeRankingResult = {
    found: true,
    domainTrust: num(
      d.domainTrust ?? d.domain_trust ?? d.dt ?? d.DT ??
      d.trustScore ?? d.trust_score ?? d.domainScore
    ),
    pageTrust: num(d.pageTrust ?? d.page_trust ?? d.pt ?? d.PT),
    backlinks: num(d.backlinks ?? d.totalBacklinks ?? d.backlinksCount ?? d.total_backlinks),
    referringDomains: num(
      d.referringDomains ?? d.referring_domains ?? d.refDomains ?? d.domainsCount
    ),
    organicTraffic: num(d.organicTraffic ?? d.organic_traffic ?? d.traffic),
    organicKeywords: num(d.organicKeywords ?? d.organic_keywords ?? d.keywords),
    aiVisibility: num(d.aiVisibility ?? d.ai_visibility ?? d.aiScore ?? d.ai_score),
    aiCitations: num(d.aiCitations ?? d.ai_citations ?? d.citations ?? d.aiMentions),
    score: 1,
    findings: [],
    dataSources: ['SE Ranking via Apify (radeance/seranking-scraper)'],
  };

  if (result.domainTrust !== null)
    result.findings.push(`✓ Domain Trust (SE Ranking): ${result.domainTrust}/100`);
  if (result.backlinks !== null)
    result.findings.push(`✓ Backlinks: ${result.backlinks.toLocaleString('pt-BR')}`);
  if (result.referringDomains !== null)
    result.findings.push(`✓ Domínios referenciadores: ${result.referringDomains.toLocaleString('pt-BR')}`);
  if (result.aiVisibility !== null)
    result.findings.push(`Visibilidade em IA (SE Ranking): ${result.aiVisibility}`);
  if (result.aiCitations !== null && result.aiCitations > 0)
    result.findings.push(`✓ Citações em resultados de IA: ${result.aiCitations}`);
  if (result.organicTraffic !== null)
    result.findings.push(`Tráfego orgânico estimado: ${result.organicTraffic.toLocaleString('pt-BR')} visitas/mês`);

  result.score = calcScore(result);
  return result;
}
