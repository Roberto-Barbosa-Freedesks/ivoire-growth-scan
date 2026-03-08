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
 * Input actor: { urls: [siteUrl] }  OR  { domain: "example.com" }
 * Output fields probed (actor may return either camelCase or snake_case):
 *   domainRating / domain_rating / dr / DR
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
  const str = String(val).replace(/[^0-9.]/g, '');
  const n = parseFloat(str);
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

  const items = await runApifyActor(
    'radeance/ahrefs-scraper',
    { urls: [siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`], domain },
    apifyToken,
    { timeoutSecs: 90 }
  );

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Ahrefs não retornou dados para ${domain}`],
      dataSources: ['Ahrefs via Apify (radeance/ahrefs-scraper)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: AhrefsResult = {
    found: true,
    domainRating: num(d.domainRating ?? d.domain_rating ?? d.dr ?? d.DR),
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
