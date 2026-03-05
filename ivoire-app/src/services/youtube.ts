/**
 * YouTube Data API v3 — Real channel stats
 * Free tier: 10,000 units/day
 */

export interface YouTubeChannelStats {
  channelId: string;
  title: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  customUrl?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
}

/**
 * Extract channel identifier from a YouTube URL.
 * Supports:
 *   https://www.youtube.com/@handle
 *   https://www.youtube.com/channel/UCxxx
 *   https://www.youtube.com/c/channelname
 *   https://www.youtube.com/user/username
 */
export function extractYouTubeIdentifier(url: string): {
  type: 'handle' | 'channelId' | 'username' | 'custom';
  value: string;
} | null {
  if (!url) return null;

  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname;

    // @handle format
    const handleMatch = path.match(/^\/@([^/]+)/);
    if (handleMatch) return { type: 'handle', value: handleMatch[1] };

    // /channel/UCxxxxx
    const channelMatch = path.match(/^\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (channelMatch) return { type: 'channelId', value: channelMatch[1] };

    // /c/customname
    const customMatch = path.match(/^\/c\/([^/]+)/);
    if (customMatch) return { type: 'custom', value: customMatch[1] };

    // /user/username
    const userMatch = path.match(/^\/user\/([^/]+)/);
    if (userMatch) return { type: 'username', value: userMatch[1] };

    // Try host-only (youtube.com itself with no path = no channel)
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch real YouTube channel statistics.
 * Requires a YouTube Data API v3 key.
 */
export async function fetchYouTubeChannelStats(
  youtubeUrl: string,
  apiKey: string
): Promise<YouTubeChannelStats | null> {
  if (!apiKey || !youtubeUrl) return null;

  const identifier = extractYouTubeIdentifier(youtubeUrl);
  if (!identifier) return null;

  const BASE = 'https://www.googleapis.com/youtube/v3';

  try {
    let channelId: string | null = null;

    if (identifier.type === 'channelId') {
      channelId = identifier.value;
    } else if (identifier.type === 'handle') {
      // Use forHandle parameter (newer API)
      const res = await fetch(
        `${BASE}/channels?part=id&forHandle=${encodeURIComponent('@' + identifier.value)}&key=${apiKey}`
      );
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
      const data = await res.json();
      channelId = data.items?.[0]?.id || null;
    } else {
      // forUsername or custom URL — search
      const res = await fetch(
        `${BASE}/search?part=id&type=channel&q=${encodeURIComponent(identifier.value)}&key=${apiKey}&maxResults=1`
      );
      if (!res.ok) throw new Error(`YouTube search error: ${res.status}`);
      const data = await res.json();
      channelId = data.items?.[0]?.id?.channelId || null;
    }

    if (!channelId) return null;

    // Fetch channel statistics
    const statsRes = await fetch(
      `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    if (!statsRes.ok) throw new Error(`YouTube stats error: ${statsRes.status}`);
    const statsData = await statsRes.json();

    const item = statsData.items?.[0];
    if (!item) return null;

    return {
      channelId,
      title: item.snippet?.title || '',
      subscriberCount: parseInt(item.statistics?.subscriberCount || '0', 10),
      videoCount: parseInt(item.statistics?.videoCount || '0', 10),
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      customUrl: item.snippet?.customUrl,
      publishedAt: item.snippet?.publishedAt,
      thumbnailUrl: item.snippet?.thumbnails?.default?.url,
    };
  } catch (err) {
    console.warn('YouTube API error:', err);
    return null;
  }
}

/** Score YouTube presence for subdimension */
export function scoreYouTubePresence(stats: YouTubeChannelStats | null, hasChannel: boolean): number {
  if (!hasChannel || !stats) return 1;

  const subscribers = stats.subscriberCount;
  const videos = stats.videoCount;

  // Score based on subscribers + video count
  if (subscribers >= 100000 || (subscribers >= 10000 && videos >= 50)) return 4;
  if (subscribers >= 10000 || (subscribers >= 1000 && videos >= 20)) return 3;
  if (subscribers >= 1000 || videos >= 10) return 2;
  return 1;
}
