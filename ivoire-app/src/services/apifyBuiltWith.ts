/**
 * BuiltWith technology detection via Apify
 *
 * Actor: canadesk/builtwith-bulk
 *   Input:  { urls: [domain] }  — domain only, no protocol (e.g. "loja.com.br")
 *   Fields: technologies[] with name + categories[]
 *
 * Purpose: Detect tech stack (replaces/supplements PageSpeed tech detection).
 *          Identifies Analytics, CMS, E-commerce, CRM, Chat, A/B Testing, CDP, CDN, Marketing tools.
 *
 * Cost: ~$0.01–0.02 per domain | Free tier ($5/mo): ~250–500 lookups/month
 */

import { runApifyActor } from './apifyClient';

export interface BuiltWithResult {
  found: boolean;
  technologies: Array<{
    name: string;
    category: string; // Analytics, Marketing, CMS, E-commerce, CDN, Chat, CRM, 'A/B Testing', CDP, etc.
    firstDetected?: string;
    lastDetected?: string;
  }>;
  categories: {
    analytics: string[];   // e.g. ["Google Analytics 4", "Hotjar"]
    marketing: string[];   // e.g. ["HubSpot", "Klaviyo"]
    cms: string[];         // e.g. ["WordPress", "Shopify"]
    ecommerce: string[];   // e.g. ["WooCommerce", "VTEX"]
    chat: string[];        // e.g. ["Intercom", "Drift"]
    crm: string[];         // e.g. ["Salesforce", "RD Station"]
    abTesting: string[];   // e.g. ["Optimizely", "VWO"]
    cdp: string[];         // e.g. ["Segment", "mParticle"]
  };
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

/** Normalize a raw category string to one of our known bucket keys */
function normalizeCategory(raw: string): keyof BuiltWithResult['categories'] | null {
  const lower = raw.toLowerCase();
  if (lower.includes('analytic') || lower.includes('tracking') || lower.includes('tag manager')) return 'analytics';
  if (lower.includes('marketing') || lower.includes('email') || lower.includes('automation') || lower.includes('retarget')) return 'marketing';
  if (lower.includes('cms') || lower.includes('content management') || lower.includes('blog')) return 'cms';
  if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('shopping') || lower.includes('payment')) return 'ecommerce';
  if (lower.includes('chat') || lower.includes('livechat') || lower.includes('support') || lower.includes('helpdesk')) return 'chat';
  if (lower.includes('crm') || lower.includes('customer relationship')) return 'crm';
  if (lower.includes('a/b') || lower.includes('ab testing') || lower.includes('testing') || lower.includes('experiment') || lower.includes('optimiz')) return 'abTesting';
  if (lower.includes('cdp') || lower.includes('customer data platform') || lower.includes('data platform')) return 'cdp';
  return null;
}

export async function fetchBuiltWith(
  siteUrl: string,
  apifyToken: string
): Promise<BuiltWithResult> {
  const domain = extractDomain(siteUrl);

  const empty: BuiltWithResult = {
    found: false,
    technologies: [],
    categories: {
      analytics: [],
      marketing: [],
      cms: [],
      ecommerce: [],
      chat: [],
      crm: [],
      abTesting: [],
      cdp: [],
    },
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  try {
    items = await runApifyActor(
      'canadesk/builtwith-bulk',
      { urls: [domain] },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  if (!items.length) {
    return {
      ...empty,
      findings: [`Sem dados de stack tecnológico para ${domain} via BuiltWith`],
      dataSources: ['BuiltWith via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  // Actor may return technologies at top level or nested under the domain key
  const rawTechs = (
    Array.isArray(d.technologies)
      ? d.technologies
      : Array.isArray((d[domain] as Record<string, unknown>)?.technologies)
        ? (d[domain] as Record<string, unknown>).technologies
        : []
  ) as unknown[];

  const technologies: BuiltWithResult['technologies'] = [];
  const categories: BuiltWithResult['categories'] = {
    analytics: [],
    marketing: [],
    cms: [],
    ecommerce: [],
    chat: [],
    crm: [],
    abTesting: [],
    cdp: [],
  };

  for (const raw of rawTechs) {
    const t = raw as Record<string, unknown>;
    const name = String(t.name ?? t.technology ?? t.tech ?? '').trim();
    if (!name) continue;

    // categories can be an array or a single string
    const rawCats: string[] = Array.isArray(t.categories)
      ? (t.categories as unknown[]).map((c) => String(c))
      : typeof t.category === 'string'
        ? [t.category]
        : typeof t.categories === 'string'
          ? [t.categories as string]
          : [];

    const primaryCategory = rawCats[0] ?? 'Other';

    technologies.push({
      name,
      category: primaryCategory,
      firstDetected: t.firstDetected ? String(t.firstDetected) : undefined,
      lastDetected: t.lastDetected ? String(t.lastDetected) : undefined,
    });

    // Distribute into our category buckets
    for (const cat of rawCats) {
      const bucket = normalizeCategory(cat);
      if (bucket && !categories[bucket].includes(name)) {
        categories[bucket].push(name);
      }
    }
  }

  const findings: string[] = [];

  if (technologies.length === 0) {
    findings.push(`Nenhuma tecnologia detectada para ${domain}`);
    return {
      found: false,
      technologies,
      categories,
      findings,
      dataSources: ['BuiltWith via Apify (canadesk/builtwith-bulk)'],
    };
  }

  findings.push(`${technologies.length} tecnologia(s) detectada(s) em ${domain}`);

  if (categories.analytics.length) {
    findings.push(`Analytics: ${categories.analytics.join(', ')}`);
  }
  if (categories.marketing.length) {
    findings.push(`Marketing Automation: ${categories.marketing.join(', ')}`);
  }
  if (categories.cms.length) {
    findings.push(`CMS/Plataforma: ${categories.cms.join(', ')}`);
  }
  if (categories.ecommerce.length) {
    findings.push(`E-commerce: ${categories.ecommerce.join(', ')}`);
  }
  if (categories.chat.length) {
    findings.push(`Chat/Suporte: ${categories.chat.join(', ')}`);
  }
  if (categories.crm.length) {
    findings.push(`CRM: ${categories.crm.join(', ')}`);
  }
  if (categories.abTesting.length) {
    findings.push(`A/B Testing: ${categories.abTesting.join(', ')}`);
  }
  if (categories.cdp.length) {
    findings.push(`CDP: ${categories.cdp.join(', ')}`);
  }

  return {
    found: true,
    technologies,
    categories,
    findings,
    dataSources: ['BuiltWith via Apify (canadesk/builtwith-bulk)'],
  };
}
