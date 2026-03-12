/**
 * Facebook Page data via Apify
 * Primary:  apify/facebook-posts-scraper  (derives page info from posts)
 * Fallback: apify/facebook-pages-scraper
 * Returns: followers, likes, rating, contact info, categories, ad status
 *
 * Cost: ~$0.01 per page
 * Free tier ($5/mo): ~500 lookups/month
 *
 * Input: Facebook page URL from HTML scraping (socialProfileUrls.Facebook)
 * or constructed from company name as fallback.
 */

import { runApifyActor } from './apifyClient';

export interface FacebookResult {
  found: boolean;
  pageName: string | null;
  followers: number | null;
  likes: number | null;
  rating: number | null;
  reviewCount: number | null;
  isVerified: boolean;
  categories: string[];
  website: string | null;
  phone: string | null;
  email: string | null;
  hasMessenger: boolean;
  pageUrl: string | null;
  score: number;
  findings: string[];
  dataSources: string[];
}

function calcScore(r: FacebookResult): number {
  if (!r.found) return 1;
  let pts = 0;
  if (r.followers !== null) {
    if (r.followers >= 50_000) pts += 3;
    else if (r.followers >= 10_000) pts += 2;
    else if (r.followers >= 1_000) pts += 1;
  }
  if (r.rating !== null && r.rating >= 4.0) pts += 1;
  if (r.isVerified) pts += 1;

  if (pts >= 4) return 4;
  if (pts >= 2) return 3;
  if (pts >= 1) return 2;
  return 1;
}

function parsePageData(
  d: Record<string, unknown>,
  startUrl: string,
  actorUsed: string
): FacebookResult {
  const cats = (d.categories ?? d.category ?? []) as unknown;
  const categories = Array.isArray(cats) ? cats.map(String) : cats ? [String(cats)] : [];

  return {
    found: true,
    pageName: d.pageName ? String(d.pageName) : d.title ? String(d.title) : d.name ? String(d.name) : null,
    followers: d.pageFollowers ? Number(d.pageFollowers)
      : d.followers ? Number(d.followers)
      : d.followersCount ? Number(d.followersCount) : null,
    likes: d.pageLikes ? Number(d.pageLikes)
      : d.likes ? Number(d.likes)
      : d.likesCount ? Number(d.likesCount) : null,
    rating: d.rating ? Number(d.rating) : d.overallStarRating ? Number(d.overallStarRating) : null,
    reviewCount: d.reviewCount ? Number(d.reviewCount) : d.ratingCount ? Number(d.ratingCount) : null,
    isVerified: !!(d.isVerified ?? d.verified),
    categories,
    website: d.website ? String(d.website) : null,
    phone: d.phone ? String(d.phone) : null,
    email: d.email ? String(d.email) : null,
    hasMessenger: !!(d.messenger ?? d.hasMessenger),
    pageUrl: startUrl,
    score: 1,
    findings: [],
    dataSources: [`Facebook via Apify (${actorUsed})`],
  };
}

export async function fetchFacebookPage(
  facebookUrl: string | undefined,
  companyName: string,
  apifyToken: string
): Promise<FacebookResult> {
  const empty: FacebookResult = {
    found: false, pageName: null, followers: null, likes: null,
    rating: null, reviewCount: null, isVerified: false, categories: [],
    website: null, phone: null, email: null, hasMessenger: false,
    pageUrl: null, score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  // Determine start URL: use provided URL or search by company name slug
  let startUrl = facebookUrl ?? '';
  if (!startUrl && companyName) {
    // Try to construct from company name (best effort)
    const slug = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    startUrl = `https://www.facebook.com/${slug}`;
  }
  if (!startUrl) return empty;

  let items: Record<string, unknown>[] = [];
  let actorUsed = '';

  // Primary: apify/facebook-posts-scraper — extract page info from posts array
  try {
    items = await runApifyActor(
      'apify/facebook-posts-scraper',
      { startUrls: [{ url: startUrl }], maxPosts: 5, maxPostComments: 0 },
      apifyToken,
      { timeoutSecs: 60 }
    ) as Record<string, unknown>[];
    if (items.length) actorUsed = 'apify/facebook-posts-scraper';
  } catch { /* fall through */ }

  // Fallback: apify/facebook-pages-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'apify/facebook-pages-scraper',
        { startUrls: [{ url: startUrl }], maxPagesPerStartUrl: 1 },
        apifyToken,
        { timeoutSecs: 60 }
      ) as Record<string, unknown>[];
      if (items.length) actorUsed = 'apify/facebook-pages-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Página Facebook não encontrada para "${companyName}"`],
      dataSources: [`Facebook via Apify (${actorUsed || 'apify/facebook-posts-scraper'})`],
    };
  }

  // For facebook-posts-scraper, each item is a post — derive page-level info from first post
  const firstItem = items[0];
  let pageSource: Record<string, unknown>;

  if (actorUsed === 'apify/facebook-posts-scraper') {
    // Merge page-level fields scattered across posts with the first post's data
    const merged: Record<string, unknown> = { ...firstItem };
    // pageName / pageFollowers / pageLikes may appear on each post item
    for (const post of items) {
      const p = post as Record<string, unknown>;
      if (!merged.pageName && p.pageName) merged.pageName = p.pageName;
      if (!merged.pageFollowers && p.pageFollowers) merged.pageFollowers = p.pageFollowers;
      if (!merged.pageLikes && p.pageLikes) merged.pageLikes = p.pageLikes;
      if (!merged.isVerified && p.isVerified) merged.isVerified = p.isVerified;
    }
    // Derive engagement metric: average likes across collected posts
    const postLikes = items
      .map((p) => Number((p as Record<string, unknown>).likes ?? 0))
      .filter((n) => !isNaN(n));
    if (postLikes.length) {
      merged._avgPostLikes = Math.round(postLikes.reduce((a, b) => a + b, 0) / postLikes.length);
    }
    pageSource = merged;
  } else {
    pageSource = firstItem;
  }

  const result = parsePageData(pageSource, startUrl, actorUsed);

  if (result.followers !== null)
    result.findings.push(`✓ Facebook: ${result.followers.toLocaleString('pt-BR')} seguidores`);
  if (result.rating !== null && result.reviewCount !== null)
    result.findings.push(`Avaliação Facebook: ${result.rating.toFixed(1)}/5 (${result.reviewCount} avaliações)`);
  if (result.isVerified)
    result.findings.push('✓ Página Facebook verificada');
  if (result.hasMessenger)
    result.findings.push('✓ Messenger Business ativo');

  // Surface average engagement if derived from posts
  const avgLikes = (pageSource as Record<string, unknown>)._avgPostLikes;
  if (actorUsed === 'apify/facebook-posts-scraper' && avgLikes) {
    result.findings.push(`Média de curtidas por post: ${Number(avgLikes).toLocaleString('pt-BR')}`);
  }

  result.score = calcScore(result);
  return result;
}
