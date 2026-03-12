/**
 * Amazon Brazil product presence via Apify actor: junglee/amazon-crawler
 *
 * Checks if a brand/company sells on Amazon.com.br by searching for their
 * products using keyword search.
 *
 * Used in: presenca_marketplaces (alongside Mercado Livre)
 * Gives e-commerce companies visibility into Amazon presence — currently
 * the biggest gap in marketplace coverage.
 *
 * Cost: ~$0.003 per product result
 * Free tier ($5/mo): ~1,600 product lookups/month
 *
 * Input: { keywords: [companyName], country: "BR", maxItems: 10 }
 * Output fields probed per item:
 *   title / name
 *   asin / ASIN / productId
 *   price / currentPrice / priceAmount
 *   originalPrice / listPrice
 *   rating / stars / averageRating
 *   reviewCount / reviewsCount / ratingsCount
 *   url / productUrl / link
 *   brand / brandName
 *   seller / sellerName
 *   availability / inStock
 */

import { runApifyActor } from './apifyClient';

export interface AmazonProduct {
  title: string;
  asin: string | null;
  price: number | null;
  originalPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  url: string;
  brand: string | null;
  seller: string | null;
  availability: string | null;
}

export interface AmazonResult {
  found: boolean;
  totalProducts: number;
  products: AmazonProduct[];
  topSeller: string | null;      // brand/seller with most listings
  avgRating: number | null;
  avgPrice: number | null;
  score: number;                 // 1–4
  findings: string[];
  dataSources: string[];
}

function numVal(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/[R$\s,]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function calcScore(r: AmazonResult): number {
  if (!r.found || r.totalProducts === 0) return 1;
  let pts = 0;
  if (r.totalProducts >= 20) pts += 2;
  else if (r.totalProducts >= 5) pts += 1;
  if (r.avgRating !== null && r.avgRating >= 4.0) pts += 2;
  else if (r.avgRating !== null && r.avgRating >= 3.5) pts += 1;
  if (r.totalProducts >= 1) pts += 1; // any presence = baseline

  if (pts >= 4) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchAmazon(
  companyName: string,
  apifyToken: string,
  maxItems = 10
): Promise<AmazonResult> {
  const empty: AmazonResult = {
    found: false, totalProducts: 0, products: [],
    topSeller: null, avgRating: null, avgPrice: null,
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  // Primary: keyword search on Amazon.com.br
  try {
    items = await runApifyActor(
      'junglee/amazon-crawler',
      {
        keywords: [companyName],
        country: 'BR',
        maxItems,
      },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  // Fallback: broader search without country restriction
  if (!items.length) {
    try {
      items = await runApifyActor(
        'junglee/amazon-crawler',
        { keywords: [companyName], maxItems },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ "${companyName}" não encontrado na Amazon via Apify`],
      dataSources: ['Amazon via Apify (junglee/amazon-crawler)'],
    };
  }

  const products: AmazonProduct[] = (items as Array<Record<string, unknown>>).map((d) => ({
    title: String(d.title ?? d.name ?? d.productTitle ?? ''),
    asin: d.asin ? String(d.asin) : d.ASIN ? String(d.ASIN) : null,
    price: numVal(d.price ?? d.currentPrice ?? d.priceAmount ?? d.salePrice),
    originalPrice: numVal(d.originalPrice ?? d.listPrice ?? d.was_price),
    rating: numVal(d.rating ?? d.stars ?? d.averageRating ?? d.reviewRating),
    reviewCount: numVal(d.reviewCount ?? d.reviewsCount ?? d.ratingsCount ?? d.numberOfRatings),
    url: String(d.url ?? d.productUrl ?? d.link ?? ''),
    brand: d.brand ? String(d.brand) : d.brandName ? String(d.brandName) : null,
    seller: d.seller ? String(d.seller) : d.sellerName ? String(d.sellerName) : null,
    availability: d.availability ? String(d.availability) : d.inStock ? 'In Stock' : null,
  })).filter((p) => p.title.length > 0);

  if (!products.length) {
    return {
      ...empty,
      findings: [`⚠️ "${companyName}" não encontrado na Amazon (nenhum produto retornado)`],
      dataSources: ['Amazon via Apify (junglee/amazon-crawler)'],
    };
  }

  // Aggregate stats
  const ratings = products.map((p) => p.rating).filter((r): r is number => r !== null);
  const prices = products.map((p) => p.price).filter((p): p is number => p !== null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  // Top seller: brand with most listings
  const brandCounts: Record<string, number> = {};
  for (const p of products) {
    const b = p.brand ?? p.seller ?? 'Desconhecido';
    brandCounts[b] = (brandCounts[b] ?? 0) + 1;
  }
  const topSeller = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const result: AmazonResult = {
    found: true,
    totalProducts: products.length,
    products,
    topSeller,
    avgRating,
    avgPrice,
    score: 1,
    findings: [],
    dataSources: ['Amazon via Apify (junglee/amazon-crawler)'],
  };

  result.findings.push(`✓ Amazon.com.br: ${products.length} produto(s) encontrado(s) para "${companyName}"`);
  if (avgRating !== null)
    result.findings.push(`Avaliação média Amazon: ${avgRating.toFixed(1)}/5`);
  if (avgPrice !== null)
    result.findings.push(`Preço médio Amazon: R$ ${avgPrice.toFixed(2)}`);
  if (topSeller)
    result.findings.push(`Principal vendedor/marca: ${topSeller}`);

  result.score = calcScore(result);
  return result;
}
