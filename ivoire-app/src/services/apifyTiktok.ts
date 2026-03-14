/**
 * TikTok profile data via Apify
 * Primary:    clockworks/tiktok-scraper
 * Fallback 1: clockworks/tiktok-profile-scraper
 * Fallback 2: apidojo/tiktok-comments-scraper
 *   Input: { username } — fetches comments from latest video; extracts author stats
 *   as a last-resort source of follower/engagement signals
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

  let items: Record<string, unknown>[] = [];
  let actorUsed = '';

  // Primary: clockworks/tiktok-scraper
  try {
    items = await runApifyActor(
      'clockworks/tiktok-scraper',
      { profiles: [profileUrl], resultsPerPage: 1 },
      apifyToken,
      { timeoutSecs: 60 }
    ) as Record<string, unknown>[];
    if (items.length) actorUsed = 'clockworks/tiktok-scraper';
  } catch { /* fall through */ }

  // Fallback 1: clockworks/tiktok-profile-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'clockworks/tiktok-profile-scraper',
        { profiles: [profileUrl], resultsPerPage: 1 },
        apifyToken,
        { timeoutSecs: 60 }
      ) as Record<string, unknown>[];
      if (items.length) actorUsed = 'clockworks/tiktok-profile-scraper';
    } catch { /* fall through */ }
  }

  // Fallback 2: apidojo/tiktok-comments-scraper
  // Fetches comments from latest video; author stats embedded in each comment item
  if (!items.length) {
    try {
      const commentItems = await runApifyActor(
        'apidojo/tiktok-comments-scraper',
        { username, maxItems: 5 },
        apifyToken,
        { timeoutSecs: 60 }
      ) as Record<string, unknown>[];
      if (commentItems.length) {
        // Extract author/video data from the first comment item
        const c = commentItems[0];
        const author = (c.author ?? c.user ?? c.video?.author ?? {}) as Record<string, unknown>;
        const videoStats = (c.video?.stats ?? c.videoStats ?? {}) as Record<string, unknown>;
        // Build a synthetic profile item from comment metadata
        const synthetic: Record<string, unknown> = {
          uniqueId: author.uniqueId ?? author.username ?? username,
          nickname: author.nickname ?? author.displayName ?? '',
          verified: author.verified ?? false,
          fans: author.fans ?? author.followerCount ?? null,
          followerCount: author.followerCount ?? author.fans ?? null,
          heart: author.heart ?? author.heartCount ?? null,
          videoCount: author.videoCount ?? null,
          signature: author.signature ?? null,
          // Engagement signal from comment volume
          _commentCount: commentItems.length,
          _videoCommentCount: videoStats.commentCount ?? c.commentCount ?? null,
          _videoPlayCount: videoStats.playCount ?? c.playCount ?? null,
        };
        items = [synthetic];
        actorUsed = 'apidojo/tiktok-comments-scraper';
      }
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Perfil TikTok @${username} não encontrado`],
      dataSources: [`TikTok via Apify (${actorUsed || 'clockworks/tiktok-scraper'})`],
    };
  }

  const d = items[0];

  const nn = (val: unknown): number | null => {
    const n = Number(val);
    return val != null && val !== '' && !isNaN(n) ? n : null;
  };
  const user = (d.user ?? d) as Record<string, unknown>;
  const stats = (user.stats ?? d.stats ?? d.authorStats ?? {}) as Record<string, unknown>;
  const result: TiktokResult = {
    found: true,
    username: String(user.uniqueId ?? d.uniqueId ?? user.username ?? d.username ?? d.author ?? username),
    displayName: String(user.nickname ?? d.nickname ?? user.displayName ?? d.displayName ?? d.name ?? ''),
    followers: nn(user.fans ?? user.followerCount ?? stats.followerCount ?? stats.fans ?? d.fans ?? d.followerCount ?? d.followers),
    following: nn(user.following ?? user.followingCount ?? stats.followingCount ?? d.following ?? d.followingCount),
    likes: nn(user.heart ?? user.heartCount ?? stats.heartCount ?? d.heart ?? d.heartCount ?? d.diggCount ?? d.likeCount ?? stats.diggCount),
    videoCount: nn(user.video ?? user.videoCount ?? stats.videoCount ?? d.video ?? d.videoCount ?? d.awemeCount),
    bio: user.signature ? String(user.signature) : d.signature ? String(d.signature) : d.bio ? String(d.bio) : null,
    verified: !!(user.verified ?? user.isVerified ?? d.verified ?? d.isVerified ?? false),
    profileUrl,
    score: 1,
    findings: [],
    dataSources: [`TikTok via Apify (${actorUsed})`],
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
