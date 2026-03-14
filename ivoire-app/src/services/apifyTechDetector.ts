/**
 * Website technology/pixel/tag detection via Apify
 *
 * Primary:  smart-digital/website-tags-pixels-detector
 *   Input:  { url: "https://example.com" }
 *   Fields: tags[], pixels[], technologies[], analyticsTools[], marketingTools[]
 *
 * Fallback 1: scraping_samurai/techstack-wappalyzer-scraper (Wappalyzer-based)
 *   Input:  { urls: ["https://example.com"] }  or  { url: "https://example.com" }
 *   Fields: technologies[] with name, categories[], version, confidence
 *
 * (canadesk/builtwith-bulk is the main tech detection in apifyBuiltWith.ts —
 *  this file provides additional pixel/tag detection focused on marketing stack)
 *
 * Purpose: Detect marketing pixels, tracking tags, analytics tools, CRM integrations.
 *          More granular than BuiltWith for ad pixels and analytics.
 *
 * Used in: stack_martech, tracking_health (Dimensão CONTROLE)
 *
 * Cost: ~$0.01–0.02 per run
 */

import { runApifyActor } from './apifyClient';

export interface TechDetectorResult {
  found: boolean;
  url: string;
  analyticsTools: string[];    // e.g. Google Analytics, Hotjar, Mixpanel
  marketingPixels: string[];   // e.g. Facebook Pixel, Google Ads, TikTok Pixel
  crmTools: string[];          // e.g. Salesforce, HubSpot, RD Station
  chatTools: string[];         // e.g. Intercom, Drift, Zendesk Chat
  abTestingTools: string[];    // e.g. Optimizely, VWO, Google Optimize
  cdpTools: string[];          // e.g. Segment, mParticle
  ecommerceTools: string[];    // e.g. Shopify, WooCommerce, VTEX
  allTechnologies: string[];   // all detected technologies flat list
  totalTools: number;
  score: number;   // 1–4
  findings: string[];
  dataSources: string[];
}

const ANALYTICS_TOOLS = [
  'google analytics', 'ga4', 'gtag', 'gtm', 'google tag manager',
  'hotjar', 'mixpanel', 'amplitude', 'segment', 'heap', 'fullstory',
  'mouseflow', 'clarity', 'microsoft clarity', 'piwik', 'matomo',
];
const MARKETING_PIXELS = [
  'facebook pixel', 'meta pixel', 'fbq', 'google ads', 'adwords',
  'tiktok pixel', 'twitter pixel', 'linkedin insight', 'pinterest tag',
  'snapchat pixel', 'criteo', 'taboola', 'outbrain', 'rdstation',
];
const CRM_TOOLS = [
  'salesforce', 'hubspot', 'rd station', 'rdstation', 'pipedrive',
  'zoho', 'active campaign', 'activecampaign', 'brevo', 'sendinblue',
  'mailchimp', 'klaviyo', 'intercom',
];
const CHAT_TOOLS = [
  'intercom', 'drift', 'zendesk', 'freshchat', 'crisp', 'tawk.to',
  'livechat', 'chatwoot', 'tidio', 'jivo', 'jivochat',
];
const AB_TESTING = [
  'optimizely', 'vwo', 'google optimize', 'ab tasty', 'kameleoon',
  'convert', 'splitbee',
];
const CDP_TOOLS = ['segment', 'mparticle', 'rudderstack', 'tealium', 'lytics'];
const ECOMMERCE_TOOLS = [
  'shopify', 'woocommerce', 'magento', 'vtex', 'nuvemshop', 'loja integrada',
  'lojaintegrada', 'bagy', 'tray', 'wake', 'opencart',
];

function classify(name: string): {
  analytics: boolean; pixel: boolean; crm: boolean; chat: boolean;
  abTest: boolean; cdp: boolean; ecommerce: boolean;
} {
  const lower = name.toLowerCase();
  return {
    analytics: ANALYTICS_TOOLS.some((t) => lower.includes(t)),
    pixel: MARKETING_PIXELS.some((t) => lower.includes(t)),
    crm: CRM_TOOLS.some((t) => lower.includes(t)),
    chat: CHAT_TOOLS.some((t) => lower.includes(t)),
    abTest: AB_TESTING.some((t) => lower.includes(t)),
    cdp: CDP_TOOLS.some((t) => lower.includes(t)),
    ecommerce: ECOMMERCE_TOOLS.some((t) => lower.includes(t)),
  };
}

function calcScore(r: TechDetectorResult): number {
  let pts = 0;
  if (r.analyticsTools.length >= 2) pts += 2;
  else if (r.analyticsTools.length >= 1) pts += 1;
  if (r.marketingPixels.length >= 3) pts += 2;
  else if (r.marketingPixels.length >= 1) pts += 1;
  if (r.crmTools.length >= 1) pts += 1;
  if (r.abTestingTools.length >= 1) pts += 1;

  if (pts >= 5) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchTechDetector(
  siteUrl: string,
  apifyToken: string
): Promise<TechDetectorResult> {
  const fullUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const empty: TechDetectorResult = {
    found: false, url: fullUrl,
    analyticsTools: [], marketingPixels: [], crmTools: [],
    chatTools: [], abTestingTools: [], cdpTools: [], ecommerceTools: [],
    allTechnologies: [], totalTools: 0,
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: smart-digital/website-tags-pixels-detector
  try {
    items = await runApifyActor(
      'smart-digital/website-tags-pixels-detector',
      { url: fullUrl },
      apifyToken,
      { timeoutSecs: 90 }
    );
    if (items.length) actorUsed = 'smart-digital/website-tags-pixels-detector';
  } catch { /* fall through */ }

  // Fallback: scraping_samurai/techstack-wappalyzer-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'scraping_samurai/techstack-wappalyzer-scraper',
        { urls: [fullUrl] },
        apifyToken,
        { timeoutSecs: 90 }
      );
      if (!items.length) {
        items = await runApifyActor(
          'scraping_samurai/techstack-wappalyzer-scraper',
          { url: fullUrl },
          apifyToken,
          { timeoutSecs: 90 }
        );
      }
      if (items.length) actorUsed = 'scraping_samurai/techstack-wappalyzer-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Detecção de tecnologias não disponível para ${fullUrl}`],
      dataSources: ['Tech Detector via Apify (sem dados)'],
    };
  }

  // Parse technologies from response
  const allNames = new Set<string>();

  for (const item of items) {
    const d = item as Record<string, unknown>;

    // Handle different output formats
    const techArrays = [
      d.technologies, d.tags, d.pixels,
      d.analyticsTools, d.marketingTools,
      d.tech, d.detected,
    ];

    for (const arr of techArrays) {
      if (!Array.isArray(arr)) continue;
      for (const tech of arr) {
        if (typeof tech === 'string') {
          allNames.add(tech.trim());
        } else if (tech && typeof tech === 'object') {
          const t = tech as Record<string, unknown>;
          const name = String(t.name ?? t.technology ?? t.tag ?? t.pixel ?? '').trim();
          if (name) allNames.add(name);
        }
      }
    }

    // Handle flat string fields (e.g. comma-separated)
    for (const key of ['analyticsTools', 'marketingPixels', 'tags', 'tools']) {
      const val = d[key];
      if (typeof val === 'string') {
        val.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => allNames.add(s));
      }
    }
  }

  const analyticsTools: string[] = [];
  const marketingPixels: string[] = [];
  const crmTools: string[] = [];
  const chatTools: string[] = [];
  const abTestingTools: string[] = [];
  const cdpTools: string[] = [];
  const ecommerceTools: string[] = [];

  for (const name of allNames) {
    const c = classify(name);
    if (c.analytics) analyticsTools.push(name);
    if (c.pixel) marketingPixels.push(name);
    if (c.crm) crmTools.push(name);
    if (c.chat) chatTools.push(name);
    if (c.abTest) abTestingTools.push(name);
    if (c.cdp) cdpTools.push(name);
    if (c.ecommerce) ecommerceTools.push(name);
  }

  const allTechnologies = [...allNames];
  const totalTools = allTechnologies.length;

  const result: TechDetectorResult = {
    found: true, url: fullUrl,
    analyticsTools, marketingPixels, crmTools,
    chatTools, abTestingTools, cdpTools, ecommerceTools,
    allTechnologies, totalTools,
    score: 1, findings: [],
    dataSources: [`Tech Detector via Apify (${actorUsed})`],
  };

  if (analyticsTools.length > 0)
    result.findings.push(`✓ Analytics: ${analyticsTools.slice(0, 3).join(', ')}`);
  if (marketingPixels.length > 0)
    result.findings.push(`✓ Pixels de marketing: ${marketingPixels.slice(0, 3).join(', ')}`);
  if (crmTools.length > 0)
    result.findings.push(`✓ CRM/Email Marketing: ${crmTools.slice(0, 2).join(', ')}`);
  if (abTestingTools.length > 0)
    result.findings.push(`✓ A/B Testing: ${abTestingTools.join(', ')}`);
  if (totalTools > 0)
    result.findings.push(`Total de tecnologias detectadas: ${totalTools}`);

  result.score = calcScore(result);
  return result;
}
