/**
 * Google Maps / Places enrichment via Apify: compass/crawler-google-places
 * Returns: full business data + up to 50 reviews with text, rating, date, owner reply
 *
 * Cost: ~$0.002 per place + ~$0.0003/review (50 reviews ≈ $0.017 total)
 * Free tier ($5/mo): ~290 full lookups with 50 reviews each
 *
 * Surpasses Google Places API (which returns max 5 reviews).
 */

import { runApifyActor } from './apifyClient';

export interface GoogleMapsReview {
  rating: number;
  text: string;
  publishedAt: string;
  ownerReply: string | null;
  authorName: string;
}

export interface GoogleMapsResult {
  found: boolean;
  name: string | null;
  rating: number | null;
  reviewsCount: number | null;
  reviews: GoogleMapsReview[];
  avgResponseRate: number | null;   // % of reviews with owner reply
  sentimentScore: number | null;    // avg rating of last 50 reviews
  address: string | null;
  phone: string | null;
  website: string | null;
  categories: string[];
  score: number;
  findings: string[];
  dataSources: string[];
}

function calcScore(r: GoogleMapsResult): number {
  if (!r.found) return 1;
  let pts = 0;
  if (r.rating !== null) {
    if (r.rating >= 4.5) pts += 3;
    else if (r.rating >= 4.0) pts += 2;
    else if (r.rating >= 3.5) pts += 1;
  }
  if (r.reviewsCount !== null) {
    if (r.reviewsCount >= 200) pts += 2;
    else if (r.reviewsCount >= 50) pts += 1;
  }
  if (r.avgResponseRate !== null && r.avgResponseRate >= 0.5) pts += 1;

  if (pts >= 5) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

export async function fetchGoogleMapsEnriched(
  companyName: string,
  siteUrl: string,
  apifyToken: string,
  maxReviews = 50
): Promise<GoogleMapsResult> {
  const empty: GoogleMapsResult = {
    found: false, name: null, rating: null, reviewsCount: null,
    reviews: [], avgResponseRate: null, sentimentScore: null,
    address: null, phone: null, website: null, categories: [],
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  const domain = siteUrl ? extractDomain(siteUrl) : '';
  // Try 2 search variations: name only → name + domain
  const searchVariants = [companyName];
  if (domain && domain.length > 3) searchVariants.push(`${companyName} ${domain}`);

  let items: unknown[] = [];
  for (const query of searchVariants) {
    try {
      items = await runApifyActor(
        'compass/crawler-google-places',
        {
          searchStringsArray: [query],
          language: 'pt',
          maxReviews,
          reviewsSort: 'newest',
          includeWebResults: false,
          maxCrawledPlacesPerSearch: 3,
        },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch {
      // try next variant
    }
    if (items.length > 0) break;
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ "${companyName}" não encontrado no Google Maps via Apify`],
      dataSources: ['Google Maps via Apify (compass/crawler-google-places)'],
    };
  }

  // Pick the best match: prefer result whose website contains the domain
  let best = items[0] as Record<string, unknown>;
  if (domain && items.length > 1) {
    const domMatch = (items as Array<Record<string, unknown>>).find((item) => {
      const w = String(item.website ?? '').toLowerCase();
      return w.includes(domain);
    });
    if (domMatch) best = domMatch;
  }
  const d = best;

  const rawReviews = (d.reviews ?? []) as Array<Record<string, unknown>>;
  const reviews: GoogleMapsReview[] = rawReviews.map((r) => ({
    rating: Number(r.stars ?? r.rating ?? 0),
    text: String(r.text ?? r.reviewText ?? ''),
    publishedAt: String(r.publishedAtDate ?? r.publishedAt ?? r.date ?? ''),
    ownerReply: r.responseFromOwnerText ? String(r.responseFromOwnerText) : null,
    authorName: String(r.name ?? r.authorName ?? 'Anônimo'),
  }));

  const repliedCount = reviews.filter((r) => r.ownerReply !== null).length;
  const avgResponseRate = reviews.length > 0 ? repliedCount / reviews.length : null;
  const sentimentScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  const categoriesRaw = (d.categories ?? d.categoryName ?? []) as unknown;
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw.map(String)
    : categoriesRaw
    ? [String(categoriesRaw)]
    : [];

  const result: GoogleMapsResult = {
    found: true,
    name: String(d.title ?? d.name ?? companyName),
    rating: d.totalScore != null ? Number(d.totalScore) : d.rating != null ? Number(d.rating) : null,
    reviewsCount: d.reviewsCount != null ? Number(d.reviewsCount) : d.reviews_count != null ? Number(d.reviews_count) : d.ratingCount != null ? Number(d.ratingCount) : null,
    reviews,
    avgResponseRate,
    sentimentScore,
    address: String(d.address ?? d.location ?? ''),
    phone: d.phone ? String(d.phone) : null,
    website: d.website ? String(d.website) : null,
    categories,
    score: 1,
    findings: [],
    dataSources: ['Google Maps via Apify (compass/crawler-google-places — até 50 avaliações reais)'],
  };

  if (result.rating !== null)
    result.findings.push(`✓ Avaliação Google Maps: ${result.rating.toFixed(1)}/5`);
  if (result.reviewsCount !== null)
    result.findings.push(`✓ Total de avaliações: ${result.reviewsCount.toLocaleString('pt-BR')}`);
  if (avgResponseRate !== null)
    result.findings.push(
      `Taxa de resposta do proprietário: ${(avgResponseRate * 100).toFixed(0)}%` +
      (avgResponseRate >= 0.5 ? ' ✓ Boa gestão de reputação' : ' ⚠️ Baixa interação com avaliações')
    );
  if (sentimentScore !== null && reviews.length >= 5)
    result.findings.push(`Nota média das últimas ${reviews.length} avaliações: ${sentimentScore.toFixed(2)}/5`);

  result.score = calcScore(result);
  return result;
}
