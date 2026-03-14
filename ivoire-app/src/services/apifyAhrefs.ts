/**
 * Ahrefs domain metrics via Apify actor: radeance/ahrefs-scraper
 *
 * Returns: Domain Rating (DR 0–100), backlinks, referring domains,
 *          organic traffic estimate, organic keywords ranked
 *
 * Used as secondary source in SEO Off-Page alongside SEMrush.
 * When SEMrush fails → Ahrefs as sole authority source.
 * When both succeed → max(semrushScore, ahrefsScore) is used.
 *
 * Cost: ~$0.01 per domain
 * Free tier ($5/mo): ~500 lookups/month
 *
 * Primary:  radeance/ahrefs-scraper
 *   Input:  { domain: "example.com" }  or  { url: "https://..." }
 *
 * Fallback 1: dionysus_way/skinaesthetic_millionaire/ahref-website-authority-checker
 *   Input:  { domain }  or  { url }
 *
 * Fallback 2: radeance/moz-scraper (MOZ Domain Authority)
 *   Input:  { urls: ["https://example.com"] }
 *
 * Output fields probed (actor may return either camelCase or snake_case):
 *   domainRating / domain_rating / dr / DR / domainAuthority / da
 *   backlinks / totalBacklinks / backlinksCount
 *   referringDomains / referring_domains / refDomains / domainsCount
 *   organicTraffic / organic_traffic / traffic
 *   organicKeywords / organic_keywords / keywords
 */

import { runApifyActor } from './apifyClient';

export interface AhrefsResult {
  found: boolean;
  domainRating: number | null;    // 0–100 (Ahrefs DR)
  backlinks: number | null;
  referringDomains: number | null;
  organicTraffic: number | null;  // estimated monthly visits from organic
  organicKeywords: number | null;
  score: number;                  // 1–4
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

function calcScore(r: AhrefsResult): number {
  let pts = 0;
  if (r.domainRating !== null) {
    if (r.domainRating >= 60) pts += 3;
    else if (r.domainRating >= 40) pts += 2;
    else if (r.domainRating >= 20) pts += 1;
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

export async function fetchAhrefs(
  siteUrl: string,
  apifyToken: string
): Promise<AhrefsResult> {
  const domain = extractDomain(siteUrl);

  const empty: AhrefsResult = {
    found: false,
    domainRating: null,
    backlinks: null,
    referringDomains: null,
    organicTraffic: null,
    organicKeywords: null,
    score: 1,
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  // Primary: domain input (radeance/ahrefs-scraper preferred format)
  try {
    items = await runApifyActor(
      'radeance/ahrefs-scraper',
      { domain },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  const fullUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  // Fallback 1a: radeance/ahrefs-scraper url format
  if (!items.length) {
    try {
      items = await runApifyActor(
        'radeance/ahrefs-scraper',
        { url: fullUrl },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* fall through */ }
  }

  // Fallback 1b: dionysus_way/ahref-website-authority-checker
  if (!items.length) {
    try {
      items = await runApifyActor(
        'dionysus_way/skinaesthetic_millionaire/ahref-website-authority-checker',
        { domain },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* fall through */ }
  }

  // Fallback 2: radeance/moz-scraper (MOZ DA as authority proxy)
  if (!items.length) {
    try {
      items = await runApifyActor(
        'radeance/moz-scraper',
        { urls: [fullUrl] },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Ahrefs/MOZ não retornou dados para ${domain}`],
      dataSources: ['Ahrefs via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: AhrefsResult = {
    found: true,
    domainRating: num(
      d.domainRating ?? d.domain_rating ?? d.dr ?? d.DR ??
      d.domainAuthority ?? d.domain_authority ?? d.da ?? d.DA
    ),
    backlinks: num(d.backlinks ?? d.totalBacklinks ?? d.backlinksCount ?? d.total_backlinks),
    referringDomains: num(
      d.referringDomains ?? d.referring_domains ?? d.refDomains ?? d.domainsCount
    ),
    organicTraffic: num(d.organicTraffic ?? d.organic_traffic ?? d.traffic),
    organicKeywords: num(d.organicKeywords ?? d.organic_keywords ?? d.keywords),
    score: 1,
    findings: [],
    dataSources: ['Ahrefs via Apify (radeance/ahrefs-scraper)'],
  };

  if (result.domainRating !== null)
    result.findings.push(`✓ Domain Rating (Ahrefs): ${result.domainRating}/100`);
  if (result.backlinks !== null)
    result.findings.push(`✓ Backlinks: ${result.backlinks.toLocaleString('pt-BR')}`);
  if (result.referringDomains !== null)
    result.findings.push(
      `✓ Domínios referenciadores: ${result.referringDomains.toLocaleString('pt-BR')}`
    );
  if (result.organicTraffic !== null)
    result.findings.push(
      `Tráfego orgânico estimado (Ahrefs): ${result.organicTraffic.toLocaleString('pt-BR')} visitas/mês`
    );
  if (result.organicKeywords !== null)
    result.findings.push(
      `Palavras-chave ranqueadas: ${result.organicKeywords.toLocaleString('pt-BR')}`
    );

  result.score = calcScore(result);
  return result;
}
