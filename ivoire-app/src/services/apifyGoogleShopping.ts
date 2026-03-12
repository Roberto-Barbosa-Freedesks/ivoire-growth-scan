/**
 * Google Shopping product presence via Apify actor: epctex/google-shopping-scraper
 *
 * Checks if a brand/company has products listed on Google Shopping,
 * and retrieves pricing, merchant, and rating data.
 *
 * Used in: presenca_marketplaces (alongside Mercado Livre + Amazon)
 * Provides Google Shopping visibility — critical for e-commerce brands
 * competing for visibility in Google product searches.
 *
 * Cost: ~$0.004 per result
 * Free tier ($5/mo): ~1,250 product lookups/month
 *
 * Input: { search: companyName, maxItems: 10 }
 *   OR   { startUrls: [{ url: googleShoppingSearchUrl }] }
 * Output fields probed per item:
 *   title / name / productTitle
 *   price / currentPrice / priceValue / amount
 *   currency / currencyCode
 *   merchant / merchantName / store / seller
 *   rating / stars / reviewScore
 *   reviewCount / reviewsCount / ratingsCount
 *   url / productUrl / link
 *   brand / brandName
 *   availability / inStock
 *   description / snippet
 */

import { runApifyActor } from './apifyClient';

export interface GoogleShoppingProduct {
  title: string;
  price: number | null;
  currency: string;
  merchant: string | null;
  rating: number | null;
  reviewCount: number | null;
  url: string;
  brand: string | null;
  availability: string | null;
}

export interface GoogleShoppingResult {
  found: boolean;
  totalProducts: number;
  products: GoogleShoppingProduct[];
  topMerchant: string | null;
  avgPrice: number | null;
  priceRange: { min: number; max: number } | null;
  avgRating: number | null;
  score: number;                 // 1–4
  findings: string[];
  dataSources: string[];
}

function numVal(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/[R$€£\s]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function calcScore(r: GoogleShoppingResult): number {
  if (!r.found || r.totalProducts === 0) return 1;
  let pts = 0;
  if (r.totalProducts >= 10) pts += 2;
  else if (r.totalProducts >= 3) pts += 1;
  if (r.avgRating !== null && r.avgRating >= 4.0) pts += 2;
  else if (r.avgRating !== null && r.avgRating >= 3.5) pts += 1;
  pts += 1; // presence itself is a signal

  if (pts >= 4) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchGoogleShopping(
  companyName: string,
  apifyToken: string,
  maxItems = 10
): Promise<GoogleShoppingResult> {
  const empty: GoogleShoppingResult = {
    found: false, totalProducts: 0, products: [],
    topMerchant: null, avgPrice: null, priceRange: null, avgRating: null,
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  // Primary: keyword search
  try {
    items = await runApifyActor(
      'epctex/google-shopping-scraper',
      {
        search: companyName,
        maxItems,
        includeComparisonPrices: false,
      },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  // Fallback: startUrls format with Google Shopping search URL
  if (!items.length) {
    try {
      const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(companyName)}`;
      items = await runApifyActor(
        'epctex/google-shopping-scraper',
        { startUrls: [{ url: searchUrl }], maxItems },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ "${companyName}" não encontrado no Google Shopping via Apify`],
      dataSources: ['Google Shopping via Apify (epctex/google-shopping-scraper)'],
    };
  }

  const products: GoogleShoppingProduct[] = (items as Array<Record<string, unknown>>).map((d) => ({
    title: String(d.title ?? d.name ?? d.productTitle ?? d.itemTitle ?? ''),
    price: numVal(d.price ?? d.currentPrice ?? d.priceValue ?? d.amount ?? d.salePrice),
    currency: String(d.currency ?? d.currencyCode ?? 'BRL'),
    merchant: d.merchant
      ? String(d.merchant)
      : d.merchantName
      ? String(d.merchantName)
      : d.store
      ? String(d.store)
      : d.seller
      ? String(d.seller)
      : null,
    rating: numVal(d.rating ?? d.stars ?? d.reviewScore ?? d.averageRating),
    reviewCount: numVal(d.reviewCount ?? d.reviewsCount ?? d.ratingsCount),
    url: String(d.url ?? d.productUrl ?? d.link ?? ''),
    brand: d.brand ? String(d.brand) : d.brandName ? String(d.brandName) : null,
    availability: d.availability ? String(d.availability) : d.inStock ? 'In Stock' : null,
  })).filter((p) => p.title.length > 0);

  if (!products.length) {
    return {
      ...empty,
      findings: [`⚠️ "${companyName}" não encontrado no Google Shopping`],
      dataSources: ['Google Shopping via Apify (epctex/google-shopping-scraper)'],
    };
  }

  const prices = products.map((p) => p.price).filter((p): p is number => p !== null);
  const ratings = products.map((p) => p.rating).filter((r): r is number => r !== null);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const priceRange = prices.length > 0
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : null;

  // Top merchant: store with most listings
  const merchantCounts: Record<string, number> = {};
  for (const p of products) {
    const m = p.merchant ?? 'Desconhecido';
    merchantCounts[m] = (merchantCounts[m] ?? 0) + 1;
  }
  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const result: GoogleShoppingResult = {
    found: true,
    totalProducts: products.length,
    products,
    topMerchant,
    avgPrice,
    priceRange,
    avgRating,
    score: 1,
    findings: [],
    dataSources: ['Google Shopping via Apify (epctex/google-shopping-scraper)'],
  };

  result.findings.push(`✓ Google Shopping: ${products.length} produto(s) encontrado(s) para "${companyName}"`);
  if (priceRange !== null)
    result.findings.push(`Faixa de preço: R$ ${priceRange.min.toFixed(2)} – R$ ${priceRange.max.toFixed(2)}`);
  if (avgRating !== null)
    result.findings.push(`Avaliação média: ${avgRating.toFixed(1)}/5`);
  if (topMerchant)
    result.findings.push(`Principal lojista: ${topMerchant}`);

  result.score = calcScore(result);
  return result;
}
