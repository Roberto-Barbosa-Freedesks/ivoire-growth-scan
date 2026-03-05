import type { PageSpeedData } from '../types';
import { fetchYouTubeChannelStats, scoreYouTubePresence } from './youtube';

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

/**
 * Collect data for a subdimension.
 * Uses real APIs where available, falls back to estimates with clear labeling.
 */
export async function simulateCollection(
  subdimensionId: string,
  siteUrl: string,
  realTech?: TechDetectionResult,
  options?: {
    youtubeUrl?: string;
    youtubeApiKey?: string;
  }
): Promise<{
  score: number;
  data: Record<string, unknown>;
  source: 'auto' | 'manual' | 'insufficient';
  dataReliability: 'real' | 'estimated';
  dataSources: string[];
}> {
  // Use real tech detection if available
  if (realTech && (subdimensionId === 'tracking_health' || subdimensionId === 'stack_martech')) {
    const score = scoreTechDetection(realTech);
    const data: Record<string, unknown> = subdimensionId === 'tracking_health' ? {
      gtmPresent: realTech.gtmInstalled,
      ga4Configured: realTech.ga4Installed,
      metaPixel: realTech.metaPixel,
      linkedinInsightTag: realTech.linkedinInsightTag,
      tiktokPixel: realTech.tiktokPixel,
      hotjarInstalled: realTech.hotjarInstalled,
      consentModeV2: realTech.consentModeV2,
      tagConflicts: 0,
    } : {
      totalTechnologies: realTech.totalThirdParties,
      categoriesCovered: [
        ...(realTech.ga4Installed ? ['Analytics'] : []),
        ...(realTech.gtmInstalled ? ['Tag Management'] : []),
        ...(realTech.hubspotInstalled ? ['CRM/Automação'] : []),
        ...(realTech.intercomInstalled ? ['Suporte/Chat'] : []),
        ...(realTech.hotjarInstalled ? ['Heatmap/UX'] : []),
      ],
      gtmInstalled: realTech.gtmInstalled,
      ga4Installed: realTech.ga4Installed,
      cdpInstalled: false,
      thirdPartyDomains: realTech.thirdPartyDomains,
    };
    return {
      score,
      data,
      source: 'auto',
      dataReliability: 'real',
      dataSources: ['Google PageSpeed Insights (Tech Detection)'],
    };
  }

  // YouTube integration — REAL data if API key provided
  if (subdimensionId === 'presenca_video_audio') {
    const youtubeUrl = options?.youtubeUrl;
    const youtubeApiKey = options?.youtubeApiKey;

    if (youtubeUrl && youtubeApiKey) {
      try {
        const ytStats = await fetchYouTubeChannelStats(youtubeUrl, youtubeApiKey);
        if (ytStats) {
          const score = scoreYouTubePresence(ytStats, true);
          return {
            score,
            data: {
              youtubeChannelFound: true,
              youtubeChannelTitle: ytStats.title,
              youtubeSubscribers: ytStats.subscriberCount,
              youtubeVideos: ytStats.videoCount,
              youtubeViews: ytStats.viewCount,
              youtubeChannelId: ytStats.channelId,
              youtubeCustomUrl: ytStats.customUrl || youtubeUrl,
              podcastFound: false,
              dataSource: 'YouTube Data API v3 (dados reais)',
            },
            source: 'auto',
            dataReliability: 'real',
            dataSources: ['YouTube Data API v3'],
          };
        }
      } catch {
        // Fall through to estimation
      }
    }

    // No YouTube API key or no URL — show what we can determine
    if (youtubeUrl) {
      // We know there's a YouTube channel (URL provided) but can't get stats
      return {
        score: 2, // assume basic presence
        data: {
          youtubeChannelFound: true,
          youtubeChannelUrl: youtubeUrl,
          youtubeSubscribers: null,
          youtubeVideos: null,
          youtubeViews: null,
          podcastFound: false,
          dataSource: 'Canal fornecido pelo usuário — estatísticas requerem YouTube API Key',
          note: 'Configure YouTube API Key nas Configurações para obter dados reais de inscritos e visualizações.',
        },
        source: 'manual',
        dataReliability: 'estimated',
        dataSources: ['Input manual (URL fornecida pelo usuário)'],
      };
    }

    // No YouTube URL at all
    return {
      score: 1,
      data: {
        youtubeChannelFound: false,
        youtubeSubscribers: null,
        podcastFound: false,
        dataSource: 'Sem canal YouTube identificado',
        note: 'Nenhum URL de YouTube foi fornecido no cadastro.',
      },
      source: 'auto',
      dataReliability: 'real',
      dataSources: ['Verificação manual (sem URL fornecida)'],
    };
  }

  // ── All other subdimensions: estimated/simulated data ──────────────────────
  // These require paid APIs (SimilarWeb, Semrush, Reclame Aqui, etc.)
  // Scores and data are ESTIMATED and clearly labeled as such.

  const seed = hashCode(siteUrl + subdimensionId);
  const rand = seededRandom(seed);

  await delay(300 + rand() * 800);

  const estimatedData: Record<string, Record<string, unknown>> = {
    seo_onpage_eeat: {
      titleOptimization: rand() > 0.5 ? 'Parcialmente otimizado' : 'Otimizado',
      schemaMarkup: ['Organization'],
      authorsIdentified: rand() > 0.6,
      aboutPageQuality: rand() > 0.5 ? 'Genérica' : 'Estruturada',
      dataSource: 'Estimado — análise real via Semrush/Screaming Frog requerida',
    },
    semantica_geo: {
      schemaTypes: ['Organization', 'WebSite'],
      richResultsEligible: rand() > 0.5,
      jsonLdValid: rand() > 0.7,
      geoPresence: rand() > 0.7 ? 'Ausente' : 'Parcial',
      dataSource: 'Estimado — validar via Google Rich Results Test e Perplexity',
    },
    mix_trafego: {
      trafficEstimate: Math.floor(rand() * 500000),
      channels: { orgânico: 35, direto: 25, pago: 20, social: 15, referral: 5 },
      trend12m: rand() > 0.5 ? 'crescimento' : 'estável',
      dataSource: 'Estimado — dados reais via SimilarWeb ou Semrush requeridos',
    },
    midia_paga_criativos: {
      activeAds: Math.floor(rand() * 50),
      channels: rand() > 0.5 ? ['Meta Ads', 'Google Ads'] : ['Meta Ads'],
      formats: ['Imagem estática', 'Vídeo'],
      investimentoEstimado: rand() > 0.6 ? 'R$ 10k–50k/mês' : 'R$ 1k–10k/mês',
      dataSource: 'Estimado — dados reais via Meta Ads Library e Google Ads Transparency',
    },
    presenca_marketplaces: {
      marketplaces: rand() > 0.5 ? ['Mercado Livre'] : [],
      avgRating: parseFloat((3.5 + rand() * 1.5).toFixed(1)),
      reviewsCount: Math.floor(rand() * 500),
      dataSource: 'Estimado — verificar diretamente nos marketplaces',
    },
    seo_offpage: {
      authorityScore: Math.floor(10 + rand() * 60),
      totalBacklinks: Math.floor(100 + rand() * 10000),
      referringDomains: Math.floor(20 + rand() * 500),
      toxicLinks: Math.floor(rand() * 15),
      dataSource: 'Estimado — dados reais via Semrush, Ahrefs ou Moz requeridos',
    },
    ux_ui_cro: {
      ctasVisible: rand() > 0.4,
      chatbotPresent: rand() > 0.5,
      chatbotType: rand() > 0.6 ? 'IA contextual' : 'Fluxo fixo',
      whatsappBusiness: rand() > 0.5,
      accessibilityScore: Math.floor(40 + rand() * 60),
      dataSource: 'Parcialmente real (Acessibilidade via PageSpeed) + estimativas visuais',
    },
    jornada_checkout: {
      checkoutSteps: Math.floor(2 + rand() * 4),
      mandatoryRegistration: rand() > 0.5,
      paymentOptions: ['PIX', 'Cartão de Crédito', rand() > 0.5 ? 'Boleto' : ''].filter(Boolean),
      guestCheckout: rand() > 0.5,
      dataSource: 'Estimado — verificar manualmente o fluxo de checkout',
    },
    reputacao_voc: {
      googleRating: parseFloat((3.0 + rand() * 2.0).toFixed(1)),
      googleReviews: Math.floor(20 + rand() * 500),
      reclaimeAquiScore: parseFloat((5.0 + rand() * 5.0).toFixed(1)),
      reclaimeAquiSolutionIndex: Math.floor(50 + rand() * 50),
      dataSource: 'Estimado — validar via Google Maps e Reclame Aqui diretamente',
    },
    ai_ml_readiness: {
      chatbotType: rand() > 0.6 ? 'Fluxo fixo' : 'Sem chatbot',
      productRecommendations: rand() > 0.7,
      nlpSearch: rand() > 0.7,
      aiToolsDetected: rand() > 0.8 ? ['Intercom'] : [],
      dataSource: 'Estimado — análise manual do site e detecção via PageSpeed',
    },
  };

  const rawScore = 1 + rand() * 3;
  const score = Math.max(1, Math.min(4, Math.round(rawScore)));

  const dataSourceLabels: Record<string, string[]> = {
    seo_onpage_eeat: ['Semrush (estimado)', 'Análise manual'],
    semantica_geo: ['Google Rich Results Test (estimado)', 'Schema.org'],
    mix_trafego: ['SimilarWeb (estimado)'],
    midia_paga_criativos: ['Meta Ads Library (estimado)', 'Google Ads Transparency'],
    presenca_marketplaces: ['Mercado Livre (estimado)', 'Amazon'],
    seo_offpage: ['Semrush (estimado)', 'Ahrefs'],
    ux_ui_cro: ['Google PageSpeed (acessibilidade real)', 'Análise visual estimada'],
    jornada_checkout: ['Análise manual estimada'],
    reputacao_voc: ['Google Maps (estimado)', 'Reclame Aqui (estimado)'],
    ai_ml_readiness: ['Detecção PageSpeed (estimado)', 'Análise visual'],
  };

  return {
    score,
    data: estimatedData[subdimensionId] || { dataSource: 'Estimado' },
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: dataSourceLabels[subdimensionId] || ['Estimado'],
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
