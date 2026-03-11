import type { PageSpeedData } from '../types';

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface TechDetectionResult {
  gtmInstalled: boolean;
  ga4Installed: boolean;
  metaPixel: boolean;
  linkedinInsightTag: boolean;
  tiktokPixel: boolean;
  hotjarInstalled: boolean;
  hubspotInstalled: boolean;
  intercomInstalled: boolean;
  consentModeV2: boolean;
  thirdPartyDomains: string[];
  totalThirdParties: number;
}

const TECH_PATTERNS: Array<{ key: keyof TechDetectionResult; patterns: string[] }> = [
  { key: 'gtmInstalled', patterns: ['googletagmanager.com'] },
  { key: 'ga4Installed', patterns: ['google-analytics.com', 'analytics.google.com', 'gtag/js'] },
  { key: 'metaPixel', patterns: ['connect.facebook.net', 'facebook.com/tr'] },
  { key: 'linkedinInsightTag', patterns: ['snap.licdn.com', 'linkedin.com/px'] },
  { key: 'tiktokPixel', patterns: ['analytics.tiktok.com', 'tiktok.com'] },
  { key: 'hotjarInstalled', patterns: ['hotjar.com', 'static.hotjar.com'] },
  { key: 'hubspotInstalled', patterns: ['js.hs-scripts.com', 'hubspot.com', 'hs-analytics.net'] },
  { key: 'intercomInstalled', patterns: ['intercomcdn.com', 'intercom.io'] },
  { key: 'consentModeV2', patterns: ['consent.js', 'consentmode', 'cookieyes.com', 'cookiebot.com', 'onetrust.com'] },
];

export function extractTechDetection(lighthouseResult: Record<string, unknown>): TechDetectionResult {
  const audits = (lighthouseResult?.audits || {}) as Record<string, unknown>;
  const thirdPartySummary = audits['third-party-summary'] as { details?: { items?: Array<{ entity: string }> } } | undefined;
  const networkRequests = audits['network-requests'] as { details?: { items?: Array<{ url: string }> } } | undefined;

  const allUrls: string[] = [];
  if (networkRequests?.details?.items) {
    for (const item of networkRequests.details.items) {
      if (item.url) allUrls.push(item.url.toLowerCase());
    }
  }

  const entityNames: string[] = [];
  if (thirdPartySummary?.details?.items) {
    for (const item of thirdPartySummary.details.items) {
      if (item.entity) entityNames.push(item.entity.toLowerCase());
    }
  }

  const allSignals = [...allUrls, ...entityNames].join(' ');

  const result: TechDetectionResult = {
    gtmInstalled: false,
    ga4Installed: false,
    metaPixel: false,
    linkedinInsightTag: false,
    tiktokPixel: false,
    hotjarInstalled: false,
    hubspotInstalled: false,
    intercomInstalled: false,
    consentModeV2: false,
    thirdPartyDomains: entityNames.slice(0, 10),
    totalThirdParties: thirdPartySummary?.details?.items?.length || 0,
  };

  for (const { key, patterns } of TECH_PATTERNS) {
    if (patterns.some((p) => allSignals.includes(p))) {
      (result as unknown as Record<string, unknown>)[key] = true;
    }
  }

  return result;
}

export async function fetchPageSpeed(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey?: string
): Promise<PageSpeedData> {
  const params = new URLSearchParams({
    url,
    strategy,
    ...(apiKey ? { key: apiKey } : {}),
  });

  const res = await fetch(`${PAGESPEED_API}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`PageSpeed API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  return {
    url,
    strategy,
    mobileScore: strategy === 'mobile' ? Math.round((cats.performance?.score || 0) * 100) : 0,
    desktopScore: strategy === 'desktop' ? Math.round((cats.performance?.score || 0) * 100) : 0,
    accessibilityScore: Math.round((cats.accessibility?.score || 0) * 100),
    bestPracticesScore: Math.round((cats['best-practices']?.score || 0) * 100),
    seoScore: Math.round((cats.seo?.score || 0) * 100),
    lcp: audits['largest-contentful-paint']?.numericValue
      ? audits['largest-contentful-paint'].numericValue / 1000
      : 0,
    inp: audits['interaction-to-next-paint']?.numericValue || undefined,
    cls: audits['cumulative-layout-shift']?.numericValue || 0,
    fcp: audits['first-contentful-paint']?.numericValue
      ? audits['first-contentful-paint'].numericValue / 1000
      : 0,
    ttfb: audits['server-response-time']?.numericValue || 0,
  };
}

export async function fetchPageSpeedWithTech(
  url: string,
  apiKey?: string
): Promise<{ mobile: PageSpeedData; desktop: PageSpeedData; tech: TechDetectionResult }> {
  const buildPsiUrl = (strategy: 'mobile' | 'desktop') => {
    const p = new URLSearchParams({ url, strategy, ...(apiKey ? { key: apiKey } : {}) });
    p.append('category', 'performance');
    p.append('category', 'accessibility');
    p.append('category', 'seo');
    p.append('category', 'best-practices');
    return `${PAGESPEED_API}?${p}`;
  };

  const [mobileRes, desktopRes] = await Promise.all([
    fetch(buildPsiUrl('mobile')),
    fetch(buildPsiUrl('desktop')),
  ]);

  if (!mobileRes.ok) throw new Error(`PageSpeed mobile error: ${mobileRes.status}`);
  if (!desktopRes.ok) throw new Error(`PageSpeed desktop error: ${desktopRes.status}`);

  const [mobileData, desktopData] = await Promise.all([mobileRes.json(), desktopRes.json()]);

  const parsePSD = (data: Record<string, unknown>, strategy: 'mobile' | 'desktop'): PageSpeedData => {
    const cats = (data.lighthouseResult as Record<string, unknown>)?.categories as Record<string, { score: number }> || {};
    const audits = (data.lighthouseResult as Record<string, unknown>)?.audits as Record<string, { numericValue?: number }> || {};
    return {
      url,
      strategy,
      mobileScore: strategy === 'mobile' ? Math.round((cats.performance?.score || 0) * 100) : 0,
      desktopScore: strategy === 'desktop' ? Math.round((cats.performance?.score || 0) * 100) : 0,
      accessibilityScore: Math.round((cats.accessibility?.score || 0) * 100),
      bestPracticesScore: Math.round((cats['best-practices']?.score || 0) * 100),
      seoScore: Math.round((cats.seo?.score || 0) * 100),
      lcp: (audits['largest-contentful-paint']?.numericValue || 0) / 1000,
      inp: audits['interaction-to-next-paint']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue || 0,
      fcp: (audits['first-contentful-paint']?.numericValue || 0) / 1000,
      ttfb: audits['server-response-time']?.numericValue || 0,
    };
  };

  const tech = extractTechDetection(mobileData.lighthouseResult || {});

  return {
    mobile: parsePSD(mobileData, 'mobile'),
    desktop: parsePSD(desktopData, 'desktop'),
    tech,
  };
}

export function scorePerformanceWeb(mobile: PageSpeedData, desktop: PageSpeedData): number {
  const lcp = mobile.lcp;
  const cls = mobile.cls;
  const mobileScore = mobile.mobileScore;
  const accessibilityScore = Math.max(mobile.accessibilityScore, desktop.accessibilityScore);

  let lcpScore = 1;
  if (lcp > 0 && lcp < 1.5) lcpScore = 4;
  else if (lcp < 2.5) lcpScore = 3;
  else if (lcp < 4) lcpScore = 2;

  let clsScore = 1;
  if (cls < 0.1) clsScore = 3;
  else if (cls < 0.25) clsScore = 2;

  let mobileScoreVal = 1;
  if (mobileScore >= 90) mobileScoreVal = 4;
  else if (mobileScore >= 75) mobileScoreVal = 3;
  else if (mobileScore >= 50) mobileScoreVal = 2;

  let accScore = 1;
  if (accessibilityScore >= 90) accScore = 4;
  else if (accessibilityScore >= 80) accScore = 3;
  else if (accessibilityScore >= 60) accScore = 2;

  const weighted = lcpScore * 0.35 + clsScore * 0.2 + mobileScoreVal * 0.3 + accScore * 0.15;
  return Math.max(1, Math.min(4, Math.round(weighted * 10) / 10));
}

export function scoreTechDetection(tech: TechDetectionResult): number {
  let score = 1;
  const checks = [
    tech.gtmInstalled,
    tech.ga4Installed,
    tech.metaPixel,
    tech.linkedinInsightTag || tech.tiktokPixel,
    tech.consentModeV2,
    tech.hotjarInstalled || tech.hubspotInstalled || tech.intercomInstalled,
  ];
  const passed = checks.filter(Boolean).length;
  if (passed >= 5) score = 4;
  else if (passed >= 3) score = 3;
  else if (passed >= 2) score = 2;
  return score;
}

// simulateCollection removed — all data is now collected via real APIs.
// See services/collection.ts for the real data dispatcher.
