/**
 * YouTube channel data via Apify
 * Primary:  streamers/youtube-scraper
 * Fallback: streamers/youtube-channel-scraper
 * Scrapes a YouTube channel URL — no API key required.
 *
 * Cost: ~$0.005 per channel
 * Free tier ($5/mo): ~1,000 lookups/month
 *
 * Input: YouTube channel URL from DiagnosticInput.youtube
 */

import { runApifyActor } from './apifyClient';

export interface YoutubeScraperResult {
  found: boolean;
  channelTitle: string | null;
  channelUrl: string | null;
  subscribers: number | null;
  videoCount: number | null;
  viewCount: number | null;
  description: string | null;
  isVerified: boolean;
  score: number;
  findings: string[];
  dataSources: string[];
}

function calcScore(r: YoutubeScraperResult): number {
  if (!r.found) return 1;
  let pts = 0;
  if (r.subscribers !== null) {
    if (r.subscribers >= 100_000) pts += 3;
    else if (r.subscribers >= 10_000) pts += 2;
    else if (r.subscribers >= 1_000) pts += 1;
  }
  if (r.videoCount !== null && r.videoCount >= 20) pts += 1;
  if (r.isVerified) pts += 1;

  if (pts >= 4) return 4;
  if (pts >= 2) return 3;
  if (pts >= 1) return 2;
  return 1;
}

function parseResult(d: Record<string, unknown>, channelUrl: string, actorUsed: string): YoutubeScraperResult {
  // Normalize subscriberCount from either actor's field names
  const rawSubs =
    d.numberOfSubscribers ?? d.subscriberCount ?? d.subscribers ?? null;
  const subscribers = rawSubs != null && rawSubs !== '' ? Number(rawSubs) : null;

  const result: YoutubeScraperResult = {
    found: true,
    channelTitle: d.channelName ? String(d.channelName) : d.title ? String(d.title) : null,
    channelUrl: d.channelUrl ? String(d.channelUrl) : channelUrl,
    subscribers: !isNaN(subscribers as number) && subscribers != null ? subscribers : null,
    videoCount: d.channelTotalVideos ? Number(d.channelTotalVideos)
      : d.videoCount ? Number(d.videoCount) : null,
    viewCount: d.channelTotalViews ? Number(d.channelTotalViews)
      : d.viewCount ? Number(d.viewCount) : null,
    description: d.channelDescription ? String(d.channelDescription) : null,
    isVerified: !!(d.isVerified ?? d.verified),
    score: 1,
    findings: [],
    dataSources: [`YouTube via Apify (${actorUsed})`],
  };
  return result;
}

export async function fetchYoutubeChannel(
  youtubeUrl: string | undefined,
  apifyToken: string
): Promise<YoutubeScraperResult> {
  const empty: YoutubeScraperResult = {
    found: false, channelTitle: null, channelUrl: null, subscribers: null,
    videoCount: null, viewCount: null, description: null, isVerified: false,
    score: 1, findings: [], dataSources: [],
  };

  if (!youtubeUrl || !apifyToken) return empty;

  // Normalize URL
  const channelUrl = youtubeUrl.startsWith('http') ? youtubeUrl : `https://www.youtube.com/${youtubeUrl.replace(/^@/, '@')}`;

  let items: Record<string, unknown>[] = [];
  let actorUsed = '';

  // Primary: streamers/youtube-scraper
  try {
    items = await runApifyActor(
      'streamers/youtube-scraper',
      { startUrls: [{ url: channelUrl }], maxResults: 0 },
      apifyToken,
      { timeoutSecs: 60 }
    ) as Record<string, unknown>[];
    if (items.length) actorUsed = 'streamers/youtube-scraper';
  } catch { /* fall through */ }

  // Fallback: streamers/youtube-channel-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'streamers/youtube-channel-scraper',
        { startUrls: [{ url: channelUrl }], maxResultsShorts: 0, maxResultsStreams: 0, maxResults: 0 },
        apifyToken,
        { timeoutSecs: 90 }
      ) as Record<string, unknown>[];
      if (items.length) actorUsed = 'streamers/youtube-channel-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Canal YouTube não encontrado: ${channelUrl}`],
      dataSources: [`YouTube via Apify (${actorUsed || 'streamers/youtube-scraper'})`],
    };
  }

  try {
    const d = items[0];
    const result = parseResult(d, channelUrl, actorUsed);

    if (result.channelTitle)
      result.findings.push(`✓ Canal YouTube: ${result.channelTitle}`);
    if (result.subscribers !== null)
      result.findings.push(`${result.subscribers.toLocaleString('pt-BR')} inscritos`);
    if (result.videoCount !== null)
      result.findings.push(`${result.videoCount} vídeos publicados`);
    if (result.viewCount !== null)
      result.findings.push(`${result.viewCount.toLocaleString('pt-BR')} visualizações totais`);
    if (result.isVerified)
      result.findings.push('✓ Canal verificado');

    result.score = calcScore(result);
    return result;
  } catch {
    return {
      ...empty,
      findings: [`⚠️ Erro ao coletar dados do YouTube: ${channelUrl}`],
      dataSources: [`YouTube via Apify (${actorUsed})`],
    };
  }
}
