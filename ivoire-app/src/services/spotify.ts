/**
 * Spotify Web API — Podcast / Show Search
 * Free tier available. Requires Spotify Developer credentials.
 *
 * Setup:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create an App
 * 3. Copy Client ID and Client Secret
 * 4. Configure in Settings → Integrações
 *
 * Note: Client Credentials flow — no user login required.
 * CORS is supported for browser-based token requests.
 */

export interface SpotifyShow {
  id: string;
  name: string;
  description: string;
  totalEpisodes: number;
  publisher: string;
  languages: string[];
  externalUrl: string;
  imageUrl: string | null;
}

export interface SpotifyPodcastResult {
  found: boolean;
  shows: SpotifyShow[];
  totalFound: number;
  topShow: SpotifyShow | null;
  score: number; // 1–4
  findings: string[];
  error?: string;
}

const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';
const TIMEOUT_MS = 12000;

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(SPOTIFY_ACCOUNTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    return (data.access_token as string) ?? null;
  } catch {
    return null;
  }
}

export async function searchSpotifyPodcast(
  companyName: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyPodcastResult> {
  if (!clientId || !clientSecret) {
    return {
      found: false, shows: [], totalFound: 0, topShow: null, score: 0, findings: [],
      error: 'Spotify Client ID/Secret não configurados — acesse developer.spotify.com/dashboard',
    };
  }

  const findings: string[] = [];

  const token = await getSpotifyToken(clientId, clientSecret);
  if (!token) {
    return {
      found: false, shows: [], totalFound: 0, topShow: null, score: 0, findings: [],
      error: 'Falha ao autenticar com Spotify — verifique Client ID e Client Secret',
    };
  }

  try {
    const params = new URLSearchParams({
      q: companyName,
      type: 'show',
      market: 'BR',
      limit: '10',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${SPOTIFY_API}/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);

    const data = await res.json() as Record<string, unknown>;
    const showsData = data.shows as Record<string, unknown> | undefined;
    const items = (showsData?.items as Array<Record<string, unknown>>) ?? [];
    const totalFound = (showsData?.total as number) ?? 0;

    if (items.length === 0) {
      findings.push(`Nenhum podcast encontrado para "${companyName}" no Spotify Brasil`);
      return { found: false, shows: [], totalFound: 0, topShow: null, score: 1, findings };
    }

    const shows: SpotifyShow[] = items
      .filter((item) => item !== null)
      .map((item) => {
        const images = item.images as Array<{ url: string }> | undefined;
        const externalUrls = item.external_urls as Record<string, string> | undefined;
        return {
          id: String(item.id),
          name: String(item.name ?? ''),
          description: String(item.description ?? '').substring(0, 300),
          totalEpisodes: Number(item.total_episodes) || 0,
          publisher: String(item.publisher ?? ''),
          languages: (item.languages as string[]) ?? [],
          externalUrl: externalUrls?.spotify ?? '',
          imageUrl: images?.[0]?.url ?? null,
        };
      });

    const topShow = shows[0];
    findings.push(`${totalFound} podcast(s) encontrado(s) para "${companyName}" no Spotify`);
    if (topShow) {
      findings.push(`Podcast principal: "${topShow.name}" — ${topShow.totalEpisodes} episódios`);
      if (topShow.publisher) findings.push(`Publicado por: ${topShow.publisher}`);
    }

    // Score based on episode count and show quality
    let score = 1;
    if (topShow) {
      if (topShow.totalEpisodes >= 100) score = 4;
      else if (topShow.totalEpisodes >= 30) score = 3;
      else if (topShow.totalEpisodes >= 5) score = 2;
      else score = 1;
    }

    return { found: true, shows, totalFound, topShow, score, findings };
  } catch (err) {
    return {
      found: false, shows: [], totalFound: 0, topShow: null, score: 0, findings: [],
      error: `Erro Spotify: ${err instanceof Error ? err.message : 'desconhecido'}`,
    };
  }
}
