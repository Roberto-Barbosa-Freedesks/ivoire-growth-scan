/**
 * TikTok profile data via Apify: clockworks/tiktok-profile-scraper
 * Returns: followers, following, likes, videos, bio, verified status
 *
 * Cost: ~$0.002 per profile
 * Free tier ($5/mo): ~2,500 lookups/month
 *
 * Input: TikTok URL or @username from DiagnosticInput.tiktok
 */

import { runApifyActor } from './apifyClient';

export interface TiktokResult {
  found: boolean;
  username: string | null;
  displayName: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videoCount: number | null;
  bio: string | null;
  verified: boolean;
  profileUrl: string | null;
  score: number;
  findings: string[];
  dataSources: string[];
}

function extractTiktokUsername(input: string): string {
  // Handle: https://www.tiktok.com/@username, @username, username
  const match = input.match(/tiktok\.com\/@?([^/?&\s]+)/i) ?? input.match(/@?([^/?&\s]+)/);
  return match ? match[1].replace(/^@/, '') : input.replace(/^@/, '');
}

function calcScore(r: TiktokResult): number {
  if (!r.found) return 1;
  let pts = 0;
  if (r.followers !== null) {
    if (r.followers >= 100_000) pts += 3;
    else if (r.followers >= 10_000) pts += 2;
    else if (r.followers >= 1_000) pts += 1;
  }
  if (r.videoCount !== null && r.videoCount >= 20) pts += 1;
  if (r.verified) pts += 1;

  if (pts >= 4) return 4;
  if (pts >= 2) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchTiktokProfile(
  tiktokUrl: string | undefined,
  apifyToken: string
): Promise<TiktokResult> {
  const empty: TiktokResult = {
    found: false, username: null, displayName: null, followers: null,
    following: null, likes: null, videoCount: null, bio: null,
    verified: false, profileUrl: null, score: 1, findings: [], dataSources: [],
  };

  if (!tiktokUrl || !apifyToken) return empty;

  const username = extractTiktokUsername(tiktokUrl);
  const profileUrl = `https://www.tiktok.com/@${username}`;

  const items = await runApifyActor(
    'clockworks/tiktok-profile-scraper',
    { profiles: [profileUrl], resultsPerPage: 1 },
    apifyToken,
    { timeoutSecs: 60 }
  );

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Perfil TikTok @${username} não encontrado`],
      dataSources: ['TikTok via Apify (clockworks/tiktok-profile-scraper)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  const result: TiktokResult = {
    found: true,
    username: String(d.uniqueId ?? d.username ?? username),
    displayName: d.nickname ? String(d.nickname) : d.displayName ? String(d.displayName) : null,
    followers: d.fans ? Number(d.fans) : d.followerCount ? Number(d.followerCount) : null,
    following: d.following ? Number(d.following) : null,
    likes: d.heart ? Number(d.heart) : d.heartCount ? Number(d.heartCount) : null,
    videoCount: d.video ? Number(d.video) : d.videoCount ? Number(d.videoCount) : null,
    bio: d.signature ? String(d.signature) : null,
    verified: !!(d.verified ?? d.isVerified),
    profileUrl,
    score: 1,
    findings: [],
    dataSources: ['TikTok via Apify (clockworks/tiktok-profile-scraper)'],
  };

  if (result.followers !== null)
    result.findings.push(`✓ TikTok @${result.username}: ${result.followers.toLocaleString('pt-BR')} seguidores`);
  if (result.videoCount !== null)
    result.findings.push(`${result.videoCount} vídeos publicados`);
  if (result.likes !== null)
    result.findings.push(`${result.likes.toLocaleString('pt-BR')} curtidas acumuladas`);
  if (result.verified)
    result.findings.push('✓ Conta verificada no TikTok');

  result.score = calcScore(result);
  return result;
}
