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

  // Collect all URLs from network requests
  const allUrls: string[] = [];
  if (networkRequests?.details?.items) {
    for (const item of networkRequests.details.items) {
      if (item.url) allUrls.push(item.url.toLowerCase());
    }
  }

  // Also collect entity names from third-party summary
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
  const [mobileRes, desktopRes] = await Promise.all([
    fetch(`${PAGESPEED_API}?${new URLSearchParams({ url, strategy: 'mobile', ...(apiKey ? { key: apiKey } : {}) })}`),
    fetch(`${PAGESPEED_API}?${new URLSearchParams({ url, strategy: 'desktop', ...(apiKey ? { key: apiKey } : {}) })}`),
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

  // LCP scoring
  let lcpScore = 1;
  if (lcp > 0 && lcp < 1.5) lcpScore = 4;
  else if (lcp < 2.5) lcpScore = 3;
  else if (lcp < 4) lcpScore = 2;

  // CLS scoring
  let clsScore = 1;
  if (cls < 0.1) clsScore = 3;
  else if (cls < 0.25) clsScore = 2;

  // Mobile score
  let mobileScoreVal = 1;
  if (mobileScore >= 90) mobileScoreVal = 4;
  else if (mobileScore >= 75) mobileScoreVal = 3;
  else if (mobileScore >= 50) mobileScoreVal = 2;

  // Accessibility
  let accScore = 1;
  if (accessibilityScore >= 90) accScore = 4;
  else if (accessibilityScore >= 80) accScore = 3;
  else if (accessibilityScore >= 60) accScore = 2;

  // Weighted average: LCP (35%) + CLS (20%) + Mobile (30%) + Accessibility (15%)
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

// Simulate collection for APIs not available in browser
export async function simulateCollection(
  subdimensionId: string,
  siteUrl: string,
  realTech?: TechDetectionResult
): Promise<{ score: number; data: Record<string, unknown>; source: 'auto' | 'manual' | 'insufficient' }> {
  // Deterministic pseudo-random based on URL + subdimension for demo consistency
  const seed = hashCode(siteUrl + subdimensionId);
  const rand = seededRandom(seed);

  // For tracking/stack subdimensions use real tech detection if available
  let score: number;
  if (realTech && (subdimensionId === 'tracking_health' || subdimensionId === 'stack_martech')) {
    score = scoreTechDetection(realTech);
  } else {
    const rawScore = 1 + rand() * 3; // 1–4
    score = Math.max(1, Math.min(4, Math.round(rawScore)));
  }

  await delay(500 + rand() * 1000);

  const mockData: Record<string, Record<string, unknown>> = {
    seo_onpage_eeat: {
      titleOptimization: rand() > 0.5 ? 'Parcialmente otimizado' : 'Otimizado',
      schemaMarkup: ['Organization'],
      authorsIdentified: rand() > 0.6,
      aboutPageQuality: rand() > 0.5 ? 'Genérica' : 'Estruturada',
    },
    semantica_geo: {
      schemaTypes: ['Organization', 'WebSite'],
      richResultsEligible: rand() > 0.5,
      jsonLdValid: rand() > 0.7,
      geoPresence: rand() > 0.7 ? 'Ausente' : 'Parcial',
    },
    presenca_video_audio: {
      youtubeChannel: rand() > 0.4 ? 'Encontrado' : 'Não encontrado',
      youtubeSubscribers: Math.floor(rand() * 50000),
      podcastFound: rand() > 0.7,
    },
    mix_trafego: {
      trafficEstimate: Math.floor(rand() * 500000),
      channels: { organic: 35, direct: 25, paid: 20, social: 15, referral: 5 },
      trend12m: rand() > 0.5 ? 'crescimento' : 'estável',
    },
    midia_paga_criativos: {
      activeAds: Math.floor(rand() * 50),
      channels: rand() > 0.5 ? ['Meta', 'Google'] : ['Meta'],
      formats: ['Imagem', 'Vídeo'],
    },
    presenca_marketplaces: {
      marketplaces: rand() > 0.5 ? ['Mercado Livre'] : [],
      avgRating: 3.5 + rand() * 1.5,
      reviewsCount: Math.floor(rand() * 500),
    },
    seo_offpage: {
      authorityScore: Math.floor(10 + rand() * 60),
      totalBacklinks: Math.floor(100 + rand() * 10000),
      referringDomains: Math.floor(20 + rand() * 500),
      toxicLinks: Math.floor(rand() * 15),
    },
    ux_ui_cro: {
      ctasVisible: rand() > 0.4,
      chatbotPresent: rand() > 0.5,
      chatbotType: rand() > 0.6 ? 'IA contextual' : 'Fluxo fixo',
      whatsappBusiness: rand() > 0.5,
      accessibilityScore: Math.floor(40 + rand() * 60),
    },
    jornada_checkout: {
      checkoutSteps: Math.floor(2 + rand() * 4),
      mandatoryRegistration: rand() > 0.5,
      paymentOptions: ['PIX', 'Cartão', rand() > 0.5 ? 'Boleto' : ''],
      guestCheckout: rand() > 0.5,
    },
    reputacao_voc: {
      googleRating: 3.0 + rand() * 2.0,
      googleReviews: Math.floor(20 + rand() * 500),
      reclaimeAquiScore: 5.0 + rand() * 5.0,
      reclaimeAquiSolutionIndex: Math.floor(50 + rand() * 50),
    },
    stack_martech: realTech ? {
      totalTechnologies: realTech.totalThirdParties,
      categoriesCovered: [
        ...(realTech.ga4Installed ? ['Analytics'] : []),
        ...(realTech.gtmInstalled ? ['Tag Management'] : []),
        ...(realTech.hubspotInstalled ? ['CRM/Automation'] : []),
        ...(realTech.intercomInstalled ? ['Suporte/Chat'] : []),
        ...(realTech.hotjarInstalled ? ['Heatmap/UX'] : []),
      ],
      gtmInstalled: realTech.gtmInstalled,
      ga4Installed: realTech.ga4Installed,
      cdpInstalled: false,
      thirdPartyDomains: realTech.thirdPartyDomains,
    } : {
      totalTechnologies: Math.floor(5 + rand() * 30),
      categoriesCovered: ['Analytics', 'Tag Management'],
      gtmInstalled: rand() > 0.4,
      ga4Installed: rand() > 0.3,
      cdpInstalled: rand() > 0.8,
    },
    tracking_health: realTech ? {
      gtmPresent: realTech.gtmInstalled,
      ga4Configured: realTech.ga4Installed,
      metaPixel: realTech.metaPixel,
      linkedinInsightTag: realTech.linkedinInsightTag,
      tiktokPixel: realTech.tiktokPixel,
      hotjarInstalled: realTech.hotjarInstalled,
      consentModeV2: realTech.consentModeV2,
      tagConflicts: 0,
    } : {
      gtmPresent: rand() > 0.4,
      ga4Configured: rand() > 0.4,
      metaPixel: rand() > 0.5,
      linkedinInsightTag: rand() > 0.6,
      consentModeV2: rand() > 0.7,
      tagConflicts: Math.floor(rand() * 3),
    },
    ai_ml_readiness: {
      chatbotType: rand() > 0.6 ? 'Fluxo fixo' : 'Sem chatbot',
      productRecommendations: rand() > 0.7,
      nlpSearch: rand() > 0.7,
      aiToolsDetected: rand() > 0.8 ? ['Intercom'] : [],
    },
  };

  return {
    score,
    data: mockData[subdimensionId] || {},
    source: rand() > 0.1 ? 'auto' : 'manual',
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
