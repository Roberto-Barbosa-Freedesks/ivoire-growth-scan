/**
 * Instagram profile data via Apify
 * Primary:  apify/instagram-scraper
 * Fallback: apify/instagram-profile-scraper
 * Returns: followers, posts, bio, website link, verification, business category
 *
 * Cost: ~$0.003 per profile
 * Free tier ($5/mo): ~1,650 lookups/month
 *
 * Input: Instagram URL or @username from DiagnosticInput.instagram
 */

import { runApifyActor } from './apifyClient';

export interface InstagramResult {
  found: boolean;
  username: string | null;
  fullName: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  bio: string | null;
  websiteInBio: string | null;
  isVerified: boolean;
  isBusinessAccount: boolean;
  businessCategory: string | null;
  profileUrl: string | null;
  score: number;
  findings: string[];
  dataSources: string[];
}

function extractInstagramUsername(input: string): string {
  const match =
    input.match(/instagram\.com\/([^/?&\s]+)/i) ??
    input.match(/@?([^/?&\s]+)/);
  return match ? match[1].replace(/^@/, '').replace(/\/$/, '') : input.replace(/^@/, '');
}

function calcScore(r: InstagramResult): number {
  if (!r.found) return 1;
  let pts = 0;
  if (r.followers !== null) {
    if (r.followers >= 100_000) pts += 3;
    else if (r.followers >= 10_000) pts += 2;
    else if (r.followers >= 1_000) pts += 1;
  }
  if (r.posts !== null && r.posts >= 20) pts += 1;
  if (r.isVerified) pts += 1;
  if (r.websiteInBio) pts += 1;

  if (pts >= 5) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

function normalizeFollowers(d: Record<string, unknown>): number | null {
  // Normalize across actor field name variants
  const raw = d.followersCount ?? d.followers ?? d.followedBy ?? null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

export async function fetchInstagramProfile(
  instagramUrl: string | undefined,
  apifyToken: string
): Promise<InstagramResult> {
  const empty: InstagramResult = {
    found: false, username: null, fullName: null, followers: null,
    following: null, posts: null, bio: null, websiteInBio: null,
    isVerified: false, isBusinessAccount: false, businessCategory: null,
    profileUrl: null, score: 1, findings: [], dataSources: [],
  };

  if (!instagramUrl || !apifyToken) return empty;

  const username = extractInstagramUsername(instagramUrl);
  const profileUrl = `https://www.instagram.com/${username}/`;

  let items: Record<string, unknown>[] = [];
  let actorUsed = '';

  // Primary: apify/instagram-scraper
  try {
    items = await runApifyActor(
      'apify/instagram-scraper',
      { usernames: [username] },
      apifyToken,
      { timeoutSecs: 60 }
    ) as Record<string, unknown>[];
    if (items.length) actorUsed = 'apify/instagram-scraper';
  } catch { /* fall through */ }

  // Fallback: apify/instagram-profile-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'apify/instagram-profile-scraper',
        { usernames: [username], resultsLimit: 1 },
        apifyToken,
        { timeoutSecs: 60 }
      ) as Record<string, unknown>[];
      if (items.length) actorUsed = 'apify/instagram-profile-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Perfil Instagram @${username} não encontrado`],
      dataSources: [`Instagram via Apify (${actorUsed || 'apify/instagram-scraper'})`],
    };
  }

  const d = items[0];

  const result: InstagramResult = {
    found: true,
    username: String(d.username ?? username),
    fullName: d.fullName ? String(d.fullName) : d.name ? String(d.name) : null,
    followers: normalizeFollowers(d),
    following: d.followsCount ? Number(d.followsCount) : d.following ? Number(d.following) : null,
    posts: d.postsCount ? Number(d.postsCount) : d.mediaCount ? Number(d.mediaCount) : null,
    bio: d.biography ? String(d.biography) : null,
    websiteInBio: d.externalUrl ? String(d.externalUrl) : d.website ? String(d.website) : null,
    isVerified: !!(d.verified ?? d.isVerified),
    isBusinessAccount: !!(d.isBusinessAccount ?? d.isBusiness),
    businessCategory: d.businessCategoryName ? String(d.businessCategoryName) : null,
    profileUrl,
    score: 1,
    findings: [],
    dataSources: [`Instagram via Apify (${actorUsed})`],
  };

  if (result.followers !== null)
    result.findings.push(`✓ Instagram @${result.username}: ${result.followers.toLocaleString('pt-BR')} seguidores`);
  if (result.posts !== null)
    result.findings.push(`${result.posts} publicações`);
  if (result.isVerified)
    result.findings.push('✓ Conta Instagram verificada');
  if (result.websiteInBio)
    result.findings.push(`✓ Link na bio: ${result.websiteInBio}`);
  if (result.businessCategory)
    result.findings.push(`Categoria: ${result.businessCategory}`);

  result.score = calcScore(result);
  return result;
}
