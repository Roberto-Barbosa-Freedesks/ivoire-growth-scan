/**
 * HTML Scraper via CORS proxy
 * Fetches site HTML and extracts structured data for SEO, UX, AI/ML analysis.
 * Uses allorigins.win as primary proxy, corsproxy.io as fallback.
 */

export interface ScrapedPageData {
  url: string;
  title: string;
  metaDescription: string;
  metaKeywords: string;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  canonicalUrl: string | null;
  langAttr: string | null;
  jsonLdBlocks: Record<string, unknown>[];
  schemaTypes: string[];
  hasAuthorMeta: boolean;
  authorBylines: string[];
  ctaKeywordsFound: string[];
  hasWhatsAppLink: boolean;
  hasWAMeLink: boolean;
  formFieldCount: number;
  hasPaymentIndicators: boolean;
  paymentMethods: string[];
  hasRecommendationSection: boolean;
  hasAiChatIndicators: boolean;
  aiChatPlatforms: string[];
  hasNlpSearchIndicators: boolean;
  nlpSearchPlatforms: string[];
  imageCount: number;
  imagesWithAlt: number;
  internalLinks: number;
  externalLinks: number;
  socialLinks: string[]; // social platform names found (e.g. ['Instagram', 'LinkedIn'])
  hasAboutPage: boolean;
  hasContactPage: boolean;
  rawHtmlLength: number;
}

// CORS proxy builders — ordered by reliability
const PROXY_BUILDERS: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function fetchPageHTML(url: string, timeoutMs = 15000): Promise<string | null> {
  for (const buildProxy of PROXY_BUILDERS) {
    try {
      const proxyUrl = buildProxy(url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 200) return text;
      }
    } catch {
      // Try next proxy
    }
  }
  return null;
}

function extractTagContents(html: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1].replace(/<[^>]+>/g, '').trim();
    if (content) results.push(content.substring(0, 200));
  }
  return results;
}

function parseJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      if (Array.isArray(parsed)) {
        blocks.push(...(parsed as Record<string, unknown>[]));
      } else if (parsed && typeof parsed === 'object') {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Invalid JSON — skip
    }
  }
  return blocks;
}

function extractSchemaTypes(jsonLdBlocks: Record<string, unknown>[]): string[] {
  const types = new Set<string>();

  function addType(val: unknown) {
    if (typeof val === 'string') types.add(val);
    else if (Array.isArray(val)) val.forEach((v) => addType(v));
  }

  for (const block of jsonLdBlocks) {
    addType(block['@type']);
    const graph = block['@graph'];
    if (Array.isArray(graph)) {
      for (const item of graph as Record<string, unknown>[]) {
        addType(item['@type']);
      }
    }
  }

  return [...types];
}

const CTA_KEYWORDS = [
  'comprar', 'contratar', 'agendar', 'solicitar', 'fale conosco',
  'falar conosco', 'saiba mais', 'ver planos', 'assinar', 'baixar',
  'cadastrar', 'começar', 'demonstração', 'demo', 'orçamento',
  'experimental', 'free trial', 'grátis', 'começe agora', 'comece já',
  'buy now', 'get started', 'sign up', 'contact us', 'learn more',
];

const PAYMENT_MARKERS: Array<{ pattern: RegExp; method: string }> = [
  { pattern: /\bpix\b/i, method: 'PIX' },
  { pattern: /pagseguro|pagbank/i, method: 'PagSeguro/PagBank' },
  { pattern: /mercadopago|mercado[\s-]pago/i, method: 'MercadoPago' },
  { pattern: /\bstripe\b/i, method: 'Stripe' },
  { pattern: /\bpaypal\b/i, method: 'PayPal' },
  { pattern: /\bboleto\b/i, method: 'Boleto' },
  { pattern: /\bgetnet\b/i, method: 'GetNet' },
  { pattern: /\bcielo\b/i, method: 'Cielo' },
  { pattern: /\bstone\b/i, method: 'Stone' },
  { pattern: /rede\.com|redecard/i, method: 'Rede' },
  { pattern: /\badyen\b/i, method: 'Adyen' },
  { pattern: /cartão de crédito|credit card/i, method: 'Cartão de Crédito' },
];

const AI_CHAT_MARKERS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /intercom/i, platform: 'Intercom' },
  { pattern: /zendesk/i, platform: 'Zendesk' },
  { pattern: /hubspot.*chat|hs-chatwidget/i, platform: 'HubSpot Chat' },
  { pattern: /\bdrift\b/i, platform: 'Drift' },
  { pattern: /crisp\.chat|crisp-chat/i, platform: 'Crisp' },
  { pattern: /tawk\.to|tawkto/i, platform: 'Tawk.to' },
  { pattern: /tidio/i, platform: 'Tidio' },
  { pattern: /freshchat|freshdesk/i, platform: 'Freshchat' },
  { pattern: /\bblip\b|take\.net/i, platform: 'Blip/Take' },
  { pattern: /livechat(?:inc)?/i, platform: 'LiveChat' },
  { pattern: /jivochat/i, platform: 'JivoChat' },
  { pattern: /olark/i, platform: 'Olark' },
  { pattern: /landbot/i, platform: 'Landbot' },
  { pattern: /botmaker/i, platform: 'Botmaker' },
];

const NLP_SEARCH_MARKERS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /algolia/i, platform: 'Algolia' },
  { pattern: /typesense/i, platform: 'Typesense' },
  { pattern: /elasticsearch/i, platform: 'Elasticsearch' },
  { pattern: /coveo/i, platform: 'Coveo' },
  { pattern: /bloomreach/i, platform: 'Bloomreach' },
  { pattern: /searchspring/i, platform: 'SearchSpring' },
  { pattern: /doofinder/i, platform: 'Doofinder' },
  { pattern: /loop54/i, platform: 'Loop54' },
  { pattern: /swiftype/i, platform: 'Swiftype' },
];

export function scrapeHTML(url: string, html: string): ScrapedPageData {
  const htmlLower = html.toLowerCase();

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';

  // Meta description
  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{10,}?)["'][^>]+name=["']description["']/i);
  const metaDescription = metaDescMatch?.[1]?.trim() ?? '';

  // Meta keywords
  const metaKwMatch =
    html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i);
  const metaKeywords = metaKwMatch?.[1]?.trim() ?? '';

  // Headings
  const h1Tags = extractTagContents(html, 'h1');
  const h2Tags = extractTagContents(html, 'h2');
  const h3Tags = extractTagContents(html, 'h3');

  // Canonical
  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonicalUrl = canonicalMatch?.[1] ?? null;

  // Language
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const langAttr = langMatch?.[1] ?? null;

  // JSON-LD
  const jsonLdBlocks = parseJsonLd(html);
  const schemaTypes = extractSchemaTypes(jsonLdBlocks);

  // Author signals
  const hasAuthorMeta =
    /<meta[^>]+name=["']author["']/i.test(html) ||
    /<meta[^>]+property=["']article:author["']/i.test(html);
  const authorBylines: string[] = [];
  const bylineMatch = html.match(/class=["'][^"']*(?:author|byline|by-line)[^"']*["'][^>]*>([^<]{3,80})</i);
  if (bylineMatch?.[1]) authorBylines.push(bylineMatch[1].trim());

  // CTAs
  const ctaKeywordsFound = CTA_KEYWORDS.filter((kw) => htmlLower.includes(kw));

  // WhatsApp
  const hasWhatsAppLink = htmlLower.includes('whatsapp');
  const hasWAMeLink = htmlLower.includes('wa.me/') || htmlLower.includes('api.whatsapp.com/send');

  // Forms
  const inputMatches = [...html.matchAll(/<input[^>]+(?:type=["'](?:text|email|tel|number|password|search)[^"']*["'])[^>]*>/gi)];
  const textareaMatches = [...html.matchAll(/<textarea[^>]*>/gi)];
  const formFieldCount = inputMatches.length + textareaMatches.length;

  // Payment methods
  const paymentMethods: string[] = [];
  for (const { pattern, method } of PAYMENT_MARKERS) {
    if (pattern.test(html)) paymentMethods.push(method);
  }
  const hasPaymentIndicators = paymentMethods.length > 0;

  // Recommendation section
  const hasRecommendationSection =
    /recomenda(?:do|ção|mos)|para você|itens similares|você também|related products|recommendations/i.test(html);

  // AI Chat
  const aiChatPlatforms: string[] = [];
  for (const { pattern, platform } of AI_CHAT_MARKERS) {
    if (pattern.test(html)) aiChatPlatforms.push(platform);
  }
  const hasAiChatIndicators = aiChatPlatforms.length > 0;

  // NLP Search
  const nlpSearchPlatforms: string[] = [];
  for (const { pattern, platform } of NLP_SEARCH_MARKERS) {
    if (pattern.test(html)) nlpSearchPlatforms.push(platform);
  }
  const hasNlpSearchIndicators = nlpSearchPlatforms.length > 0;

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]+>/gi)];
  const imageCount = imgMatches.length;
  const imagesWithAlt = imgMatches.filter((m) => /alt=["'][^"']+["']/i.test(m[0])).length;

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  try {
    const origin = new URL(url.startsWith('http') ? url : `https://${url}`).origin;
    const hrefRegex = /href=["']([^"'#?][^"']*?)["']/gi;
    let linkMatch;
    while ((linkMatch = hrefRegex.exec(html)) !== null) {
      const href = linkMatch[1];
      if (href.startsWith('/') || href.includes(origin)) internalLinks++;
      else if (href.startsWith('http')) externalLinks++;
    }
  } catch {
    // URL parse error
  }

  // About / Contact page indicators
  const hasAboutPage = /href=["'][^"']*(?:about|sobre|quem-somos|equipe|team)[^"']*["']/i.test(html);
  const hasContactPage = /href=["'][^"']*(?:contact|contato|fale-conosco)[^"']*["']/i.test(html);

  // Social links — detect presence of major social platform links
  const SOCIAL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /instagram\.com\//i, name: 'Instagram' },
    { pattern: /facebook\.com\//i, name: 'Facebook' },
    { pattern: /linkedin\.com\//i, name: 'LinkedIn' },
    { pattern: /twitter\.com\/|x\.com\//i, name: 'Twitter/X' },
    { pattern: /youtube\.com\//i, name: 'YouTube' },
    { pattern: /tiktok\.com\//i, name: 'TikTok' },
    { pattern: /pinterest\.com\//i, name: 'Pinterest' },
    { pattern: /wa\.me\/|whatsapp\.com\//i, name: 'WhatsApp' },
  ];
  const socialLinks = SOCIAL_PATTERNS
    .filter(({ pattern }) => pattern.test(html))
    .map(({ name }) => name);

  return {
    url,
    title,
    metaDescription,
    metaKeywords,
    h1Tags,
    h2Tags,
    h3Tags,
    canonicalUrl,
    langAttr,
    jsonLdBlocks,
    schemaTypes,
    hasAuthorMeta,
    authorBylines,
    ctaKeywordsFound,
    hasWhatsAppLink,
    hasWAMeLink,
    formFieldCount,
    hasPaymentIndicators,
    paymentMethods,
    hasRecommendationSection,
    hasAiChatIndicators,
    aiChatPlatforms,
    hasNlpSearchIndicators,
    nlpSearchPlatforms,
    imageCount,
    imagesWithAlt,
    internalLinks,
    externalLinks,
    socialLinks,
    hasAboutPage,
    hasContactPage,
    rawHtmlLength: html.length,
  };
}

export async function scrapeUrl(url: string): Promise<ScrapedPageData | null> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const html = await fetchPageHTML(normalizedUrl);
    if (!html) return null;
    return scrapeHTML(normalizedUrl, html);
  } catch {
    return null;
  }
}
