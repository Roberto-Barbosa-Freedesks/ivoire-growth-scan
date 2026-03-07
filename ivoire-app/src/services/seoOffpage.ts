/**
 * SEO Off-Page — Real data via free, CORS-accessible sources
 *
 * Sources:
 * - RDAP (rdap.org): domain age — confirmed CORS-enabled, no key needed
 * - who-dat (who-dat.as93.net): WHOIS fallback — confirmed no-CORS API, no key
 * - robots.txt: fetched via allorigins CORS proxy
 * - sitemap.xml: fetched via allorigins CORS proxy (counts indexed pages)
 * - Open PageRank (api.domcop.com): link authority score 0–10
 *   → free API key at openpagerank.com (10,000 calls/hour)
 *   → proxied via allorigins (key in URL param, no custom header needed)
 *
 * No backlink count APIs are freely available with CORS support in 2025-2026.
 * Open PageRank (derived from Common Crawl) is the best free alternative.
 */

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const CORS_PROXY2 = 'https://corsproxy.io/?';
const TIMEOUT_MS = 10_000;

export interface SeoOffpageResult {
  domainAge: number | null;           // years (float)
  registrationDate: string | null;
  registrar: string | null;
  hasRobotsTxt: boolean;
  robotsTxtSitemapDirective: boolean;
  robotsDisallowAll: boolean;
  hasSitemapXml: boolean;
  sitemapUrlCount: number | null;
  openPageRank: number | null;        // 0–10 (null if no key)
  openPageRankGlobal: number | null;  // global rank position
  internalLinksCount: number;
  isHttps: boolean;
  score: number;
  findings: string[];
  dataSources: string[];
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaProxy(targetUrl: string): Promise<string | null> {
  // Try allorigins first
  try {
    const res = await fetchWithTimeout(
      `${CORS_PROXY}${encodeURIComponent(targetUrl)}`,
      TIMEOUT_MS
    );
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 0) return text;
    }
  } catch { /* try next */ }

  // Fallback: corsproxy.io
  try {
    const res = await fetchWithTimeout(`${CORS_PROXY2}${encodeURIComponent(targetUrl)}`, TIMEOUT_MS);
    if (res.ok) return await res.text();
  } catch { /* give up */ }

  return null;
}

// ── Domain Age via RDAP ───────────────────────────────────────────────────────

async function fetchDomainAge(domain: string): Promise<{
  ageYears: number | null;
  registrationDate: string | null;
  registrar: string | null;
}> {
  const cleanDomain = domain.replace(/^www\./, '');

  // 1. rdap.org — confirmed CORS-enabled, no key, IANA-endorsed
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${cleanDomain}`, 8_000);
    if (res.ok) {
      const data = await res.json();
      const regEvent = data.events?.find(
        (e: { eventAction: string }) => e.eventAction === 'registration'
      );
      const registrar = data.entities?.[0]?.vcardArray?.[1]?.find(
        (v: string[]) => v[0] === 'fn'
      )?.[3] ?? data.registrarName ?? null;
      if (regEvent?.eventDate) {
        const regDate = new Date(regEvent.eventDate);
        const ageYears = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return {
          ageYears: Math.round(ageYears * 10) / 10,
          registrationDate: regDate.toISOString().split('T')[0],
          registrar,
        };
      }
    }
  } catch { /* try fallback */ }

  // 2. who-dat — MIT-licensed no-CORS proxy, confirmed CORS-enabled
  try {
    const res = await fetchWithTimeout(`https://who-dat.as93.net/${cleanDomain}`, 8_000);
    if (res.ok) {
      const data = await res.json();
      const created =
        data?.domain?.created_date ??
        data?.registrar?.created_date ??
        data?.created_date ??
        null;
      if (created) {
        const regDate = new Date(created);
        const ageYears = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return {
          ageYears: Math.round(ageYears * 10) / 10,
          registrationDate: regDate.toISOString().split('T')[0],
          registrar: data?.registrar?.name ?? null,
        };
      }
    }
  } catch { /* domain age unavailable */ }

  return { ageYears: null, registrationDate: null, registrar: null };
}

// ── robots.txt ────────────────────────────────────────────────────────────────

async function fetchRobotsTxt(siteUrl: string): Promise<{
  present: boolean;
  hasSitemapDirective: boolean;
  disallowAll: boolean;
}> {
  const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const robotsUrl = new URL('/robots.txt', base).href;

  const text = await fetchViaProxy(robotsUrl);
  if (!text || text.trim().length === 0) {
    return { present: false, hasSitemapDirective: false, disallowAll: false };
  }

  const lower = text.toLowerCase();
  const hasSitemapDirective = lower.includes('sitemap:');
  const disallowAll =
    /user-agent:\s*\*/i.test(text) && /disallow:\s*\//i.test(text) && !hasSitemapDirective;

  return { present: true, hasSitemapDirective, disallowAll };
}

// ── sitemap.xml ───────────────────────────────────────────────────────────────

async function fetchSitemap(siteUrl: string): Promise<{
  present: boolean;
  urlCount: number | null;
}> {
  const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const sitemapUrl = new URL('/sitemap.xml', base).href;

  const text = await fetchViaProxy(sitemapUrl);
  if (!text || text.trim().length === 0 || !text.includes('<')) {
    return { present: false, urlCount: null };
  }

  // Count <url> or <sitemap> entries (for sitemap index)
  const urlMatches = text.match(/<url>/gi) ?? [];
  const sitemapIndexMatches = text.match(/<sitemap>/gi) ?? [];
  const count = urlMatches.length + sitemapIndexMatches.length;

  return { present: true, urlCount: count > 0 ? count : null };
}

// ── Open PageRank ─────────────────────────────────────────────────────────────

async function fetchOpenPageRank(
  domain: string,
  apiKey: string
): Promise<{ score: number | null; rank: number | null }> {
  if (!apiKey) return { score: null, rank: null };

  const cleanDomain = domain.replace(/^www\./, '');

  // api.domcop.com accepts apikey as URL param — no custom headers needed
  // This allows allorigins to proxy it without header restrictions
  const target = `https://api.domcop.com/openpagerank?apikey=${encodeURIComponent(apiKey)}&domains[]=${encodeURIComponent(cleanDomain)}`;

  try {
    const text = await fetchViaProxy(target);
    if (!text) return { score: null, rank: null };
    const json = JSON.parse(text);
    const result = json?.response?.[0];
    if (result && result.status_code === 200) {
      return {
        score: result.page_rank_decimal ?? result.page_rank_integer ?? null,
        rank: result.rank ?? null,
      };
    }
  } catch { /* key invalid or API unreachable */ }

  return { score: null, rank: null };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function calcScore(data: {
  ageYears: number | null;
  openPageRank: number | null;
  hasRobots: boolean;
  robotsHasSitemap: boolean;
  hasSitemap: boolean;
  sitemapUrlCount: number | null;
  internalLinksCount: number;
  isHttps: boolean;
}): number {
  let pts = 0;

  // Domain age (strong signal)
  if (data.ageYears !== null) {
    if (data.ageYears >= 5) pts += 2;
    else if (data.ageYears >= 2) pts += 1;
  }

  // Open PageRank (backlink authority — best free proxy for link building)
  if (data.openPageRank !== null) {
    if (data.openPageRank >= 7) pts += 3;
    else if (data.openPageRank >= 5) pts += 2;
    else if (data.openPageRank >= 3) pts += 1;
  }

  // Technical SEO health
  if (data.hasRobots && data.robotsHasSitemap) pts += 1;
  if (data.hasSitemap && data.sitemapUrlCount && data.sitemapUrlCount > 10) pts += 1;
  if (data.internalLinksCount >= 30) pts += 1;
  if (data.isHttps) pts += 1;

  if (pts >= 7) return 4;
  if (pts >= 4) return 3;
  if (pts >= 2) return 2;
  return 1;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeSeoOffpage(
  siteUrl: string,
  openPageRankApiKey: string,
  internalLinksCount: number
): Promise<SeoOffpageResult> {
  const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const isHttps = base.startsWith('https://');
  const domain = new URL(base).hostname;

  const findings: string[] = [];
  const dataSources: string[] = [];

  // Run all fetches in parallel for speed
  const [ageData, robotsData, sitemapData, oprData] = await Promise.all([
    fetchDomainAge(domain),
    fetchRobotsTxt(siteUrl),
    fetchSitemap(siteUrl),
    fetchOpenPageRank(domain, openPageRankApiKey),
  ]);

  // ── Domain age findings ──
  if (ageData.ageYears !== null) {
    dataSources.push('RDAP (rdap.org — IANA-endorsed, gratuito)');
    findings.push(
      `✓ Domínio com ${ageData.ageYears} anos (registrado em ${ageData.registrationDate})` +
      (ageData.registrar ? ` via ${ageData.registrar}` : '')
    );
    if (ageData.ageYears < 1) findings.push('⚠️ Domínio muito recente — baixa autoridade esperada');
  } else {
    findings.push('⚠️ Data de registro do domínio não disponível (TLD pode não suportar RDAP)');
  }

  // ── robots.txt findings ──
  dataSources.push('robots.txt (via CORS proxy)');
  if (robotsData.present) {
    if (robotsData.disallowAll) {
      findings.push('⚠️ robots.txt bloqueia todos os crawlers (Disallow: /) — SEO comprometido');
    } else if (robotsData.hasSitemapDirective) {
      findings.push('✓ robots.txt presente com diretiva Sitemap');
    } else {
      findings.push('✓ robots.txt presente (sem diretiva Sitemap — recomendado adicionar)');
    }
  } else {
    findings.push('⚠️ robots.txt ausente ou inacessível');
  }

  // ── sitemap findings ──
  dataSources.push('sitemap.xml (via CORS proxy)');
  if (sitemapData.present) {
    findings.push(
      `✓ sitemap.xml encontrado` +
      (sitemapData.urlCount ? ` — ${sitemapData.urlCount} URLs/sitemaps indexados` : '')
    );
  } else {
    findings.push('⚠️ sitemap.xml não encontrado em /sitemap.xml');
  }

  // ── Open PageRank findings ──
  if (openPageRankApiKey) {
    dataSources.push('Open PageRank (domcop.com — gratuito, baseado em Common Crawl)');
    if (oprData.score !== null) {
      findings.push(
        `✓ Open PageRank: ${oprData.score.toFixed(1)}/10` +
        (oprData.rank ? ` (posição global #${oprData.rank.toLocaleString('pt-BR')})` : '')
      );
    } else {
      findings.push('⚠️ Open PageRank: domínio sem dados (poucos backlinks indexados)');
    }
  } else {
    findings.push(
      'Open PageRank não configurado — cadastre-se gratuitamente em openpagerank.com para obter autoridade de backlinks'
    );
  }

  // ── Internal links ──
  if (internalLinksCount > 0) {
    dataSources.push('HTML scraping (links internos)');
    findings.push(`✓ ${internalLinksCount} links internos detectados na homepage`);
  }

  // ── HTTPS ──
  if (isHttps) findings.push('✓ Site serve HTTPS');
  else findings.push('⚠️ Site não usa HTTPS — risco de segurança e penalização SEO');

  const score = calcScore({
    ageYears: ageData.ageYears,
    openPageRank: oprData.score,
    hasRobots: robotsData.present,
    robotsHasSitemap: robotsData.hasSitemapDirective,
    hasSitemap: sitemapData.present,
    sitemapUrlCount: sitemapData.urlCount,
    internalLinksCount,
    isHttps,
  });

  return {
    domainAge: ageData.ageYears,
    registrationDate: ageData.registrationDate,
    registrar: ageData.registrar,
    hasRobotsTxt: robotsData.present,
    robotsTxtSitemapDirective: robotsData.hasSitemapDirective,
    robotsDisallowAll: robotsData.disallowAll,
    hasSitemapXml: sitemapData.present,
    sitemapUrlCount: sitemapData.urlCount,
    openPageRank: oprData.score,
    openPageRankGlobal: oprData.rank,
    internalLinksCount,
    isHttps,
    score,
    findings,
    dataSources,
  };
}
