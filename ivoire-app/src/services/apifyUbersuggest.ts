/**
 * Ubersuggest domain metrics via Apify actor: radeance/ubersuggest-scraper
 *
 * Returns: MOZ Domain Authority (0–100), backlinks, referring domains,
 *          organic traffic estimate, organic keywords, spam score
 *
 * Used as tertiary authority source in SEO Off-Page:
 *   SEMrush → Ahrefs → Ubersuggest (this) → SE Ranking → RDAP base
 *
 * Cost: ~$0.01 per domain
 * Free tier ($5/mo): ~500 lookups/month
 *
 * Input actor: { urls: ["https://example.com"] }  (radeance actors require urls array)
 * Output fields probed:
 *   domainAuthority / domain_authority / da / DA / mozScore / moz_score
 *   backlinks / totalBacklinks / backlinksCount
 *   referringDomains / referring_domains / refDomains
 *   organicTraffic / organic_traffic / traffic
 *   organicKeywords / organic_keywords / keywords
 *   spamScore / spam_score / spamFlag
 */

import { runApifyActor } from './apifyClient';

export interface UbersuggestResult {
  found: boolean;
  domainAuthority: number | null;  // 0–100 (MOZ DA)
  backlinks: number | null;
  referringDomains: number | null;
  organicTraffic: number | null;
  organicKeywords: number | null;
  spamScore: number | null;        // 0–100 (lower = better)
  score: number;                   // 1–4
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

function calcScore(r: UbersuggestResult): number {
  let pts = 0;
  if (r.domainAuthority !== null) {
    if (r.domainAuthority >= 60) pts += 3;
    else if (r.domainAuthority >= 40) pts += 2;
    else if (r.domainAuthority >= 20) pts += 1;
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

export async function fetchUbersuggest(
  siteUrl: string,
  apifyToken: string
): Promise<UbersuggestResult> {
  const domain = extractDomain(siteUrl);

  const empty: UbersuggestResult = {
    found: false,
    domainAuthority: null,
    backlinks: null,
    referringDomains: null,
    organicTraffic: null,
    organicKeywords: null,
    spamScore: null,
    score: 1,
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  const fullUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  let items: unknown[] = [];

  // Primary: urls array (radeance actors require this format)
  try {
    items = await runApifyActor(
      'radeance/ubersuggest-scraper',
      { urls: [fullUrl] },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  // Fallback: domain string format
  if (!items.length) {
    try {
      items = await runApifyActor(
        'radeance/ubersuggest-scraper',
        { domain },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Ubersuggest não retornou dados para ${domain}`],
      dataSources: ['Ubersuggest via Apify (radeance/ubersuggest-scraper)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: UbersuggestResult = {
    found: true,
    domainAuthority: num(
      d.domainAuthority ?? d.domain_authority ?? d.da ?? d.DA ??
      d.mozDomainAuthority ?? d.mozScore ?? d.moz_score ?? d.authority
    ),
    backlinks: num(d.backlinks ?? d.totalBacklinks ?? d.backlinksCount ?? d.total_backlinks),
    referringDomains: num(
      d.referringDomains ?? d.referring_domains ?? d.refDomains ?? d.domainsCount
    ),
    organicTraffic: num(d.organicTraffic ?? d.organic_traffic ?? d.traffic),
    organicKeywords: num(d.organicKeywords ?? d.organic_keywords ?? d.keywords),
    spamScore: num(d.spamScore ?? d.spam_score ?? d.spamFlag),
    score: 1,
    findings: [],
    dataSources: ['Ubersuggest via Apify (radeance/ubersuggest-scraper)'],
  };

  if (result.domainAuthority !== null)
    result.findings.push(`✓ MOZ Domain Authority: ${result.domainAuthority}/100`);
  if (result.backlinks !== null)
    result.findings.push(`✓ Backlinks: ${result.backlinks.toLocaleString('pt-BR')}`);
  if (result.referringDomains !== null)
    result.findings.push(`✓ Domínios referenciadores: ${result.referringDomains.toLocaleString('pt-BR')}`);
  if (result.organicTraffic !== null)
    result.findings.push(`Tráfego orgânico estimado (Ubersuggest): ${result.organicTraffic.toLocaleString('pt-BR')} visitas/mês`);
  if (result.spamScore !== null && result.spamScore > 50)
    result.findings.push(`⚠️ Spam Score alto (MOZ): ${result.spamScore}% — verificar qualidade de backlinks`);

  result.score = calcScore(result);
  return result;
}
