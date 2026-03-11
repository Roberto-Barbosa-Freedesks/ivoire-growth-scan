/**
 * SEMrush domain overview via Apify actor: devnaz/semrush-scraper
 * Returns: authority score, backlinks, referring domains,
 *          organic traffic estimate, organic keywords count
 *
 * Cost: ~$0.01 per domain
 * Free tier ($5/mo): ~500 lookups/month
 *
 * No SEMrush account required — scrapes the public domain overview page.
 */

import { runApifyActor } from './apifyClient';

export interface SemrushResult {
  found: boolean;
  authorityScore: number | null;   // 0-100 (like Domain Authority)
  backlinks: number | null;
  referringDomains: number | null;
  organicTraffic: number | null;   // estimated monthly
  organicKeywords: number | null;
  paidTraffic: number | null;
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

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  // Handle shorthand: "10K" → 10000, "1.2M" → 1200000, "5B" → 5000000000
  const shorthand = s.match(/^([0-9.,]+)\s*([KMBkmb])$/);
  if (shorthand) {
    const base = parseFloat(shorthand[1].replace(',', '.'));
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[shorthand[2].toLowerCase()] ?? 1;
    return isNaN(base) ? null : Math.round(base * mult);
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function calcScore(r: SemrushResult): number {
  let pts = 0;
  if (r.authorityScore !== null) {
    if (r.authorityScore >= 60) pts += 3;
    else if (r.authorityScore >= 40) pts += 2;
    else if (r.authorityScore >= 20) pts += 1;
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

export async function fetchSemrush(
  siteUrl: string,
  apifyToken: string
): Promise<SemrushResult> {
  const domain = extractDomain(siteUrl);
  const empty: SemrushResult = {
    found: false, authorityScore: null, backlinks: null,
    referringDomains: null, organicTraffic: null, organicKeywords: null,
    paidTraffic: null, score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  const items = await runApifyActor(
    'devnaz/semrush-scraper',
    { domain },
    apifyToken,
    { timeoutSecs: 90 }
  );

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ SEMrush não retornou dados para ${domain}`],
      dataSources: ['SEMrush via Apify (devnaz/semrush-scraper)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: SemrushResult = {
    found: true,
    authorityScore: num(d.authorityScore ?? d.authority_score ?? d.domainScore ?? d.as),
    backlinks: num(d.backlinks ?? d.totalBacklinks ?? d.total_backlinks),
    referringDomains: num(d.referringDomains ?? d.referring_domains ?? d.refDomains),
    organicTraffic: num(d.organicTraffic ?? d.organic_traffic ?? d.traffic),
    organicKeywords: num(d.organicKeywords ?? d.organic_keywords ?? d.keywords),
    paidTraffic: num(d.paidTraffic ?? d.paid_traffic),
    score: 1,
    findings: [],
    dataSources: ['SEMrush via Apify (devnaz/semrush-scraper)'],
  };

  if (result.authorityScore !== null)
    result.findings.push(`✓ Authority Score SEMrush: ${result.authorityScore}/100`);
  if (result.backlinks !== null)
    result.findings.push(`✓ Backlinks: ${result.backlinks.toLocaleString('pt-BR')}`);
  if (result.referringDomains !== null)
    result.findings.push(`✓ Domínios referenciadores: ${result.referringDomains.toLocaleString('pt-BR')}`);
  if (result.organicTraffic !== null)
    result.findings.push(`Tráfego orgânico estimado: ${result.organicTraffic.toLocaleString('pt-BR')} visitas/mês`);
  if (result.organicKeywords !== null)
    result.findings.push(`Palavras-chave orgânicas: ${result.organicKeywords.toLocaleString('pt-BR')}`);

  result.score = calcScore(result);
  return result;
}
