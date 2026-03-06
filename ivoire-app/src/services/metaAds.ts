/**
 * Meta Ad Library API
 * Free — requires a Facebook User Access Token (no special permissions needed).
 *
 * How to get a token:
 * 1. Go to https://developers.facebook.com/tools/explorer/
 * 2. Select your App (or create one at developers.facebook.com)
 * 3. Click "Generate Access Token"
 * 4. Copy the token (valid for ~60 days — use long-lived token for production)
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/reference/ads-archive
 */

export interface MetaAd {
  id: string;
  status: string;
  startDate: string | null;
  platforms: string[];
  creativeMediaType: string | null;
  body: string | null;
  pageId: string | null;
  pageName: string | null;
}

export interface MetaAdsResult {
  adsFound: boolean;
  totalAds: number;
  activeAds: MetaAd[];
  platforms: string[];
  formats: string[];
  hasVideoAds: boolean;
  hasImageAds: boolean;
  pagesFound: string[];
  score: number; // 1–4
  findings: string[];
  error?: string;
}

const GRAPH_API = 'https://graph.facebook.com/v18.0';
const TIMEOUT_MS = 15000;

export async function fetchMetaAds(
  companyName: string,
  _siteUrl: string,
  accessToken: string
): Promise<MetaAdsResult> {
  if (!accessToken) {
    return {
      adsFound: false, totalAds: 0, activeAds: [],
      platforms: [], formats: [], hasVideoAds: false, hasImageAds: false,
      pagesFound: [], score: 0, findings: [],
      error: 'Meta Access Token não configurado — obtenha em developers.facebook.com/tools/explorer',
    };
  }

  const findings: string[] = [];

  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      search_terms: companyName,
      ad_reached_countries: '["BR"]',
      ad_active_status: 'ACTIVE',
      limit: '50',
      fields: [
        'id',
        'ad_delivery_start_time',
        'publisher_platforms',
        'ad_creative_media_type',
        'ad_creative_bodies',
        'page_id',
        'page_name',
      ].join(','),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${GRAPH_API}/ads_archive?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as Record<string, unknown>;
      const errObj = errData.error as Record<string, unknown> | undefined;
      const errMsg = (errObj?.message as string) ?? `HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    const data = await res.json() as Record<string, unknown>;
    const ads = (data.data as Array<Record<string, unknown>>) ?? [];
    const totalAds = ads.length;

    if (totalAds === 0) {
      findings.push(`Nenhum anúncio ativo encontrado para "${companyName}" no Brasil`);
      findings.push('Possíveis causas: marca não anuncia no Meta atualmente, ou nome de busca diferente do nome da página');
    } else {
      findings.push(`${totalAds} anúncio(s) ativo(s) no Meta Ads (Brasil)`);
    }

    const platformSet = new Set<string>();
    const formatSet = new Set<string>();
    const pageSet = new Map<string, string>();

    const activeAds: MetaAd[] = [];
    for (const ad of ads.slice(0, 20)) {
      const platforms = (ad.publisher_platforms as string[]) ?? [];
      const format = (ad.ad_creative_media_type as string | null) ?? null;
      const pageName = (ad.page_name as string | null) ?? null;
      const pageId = (ad.page_id as string | null) ?? null;

      platforms.forEach((p) => platformSet.add(p));
      if (format) formatSet.add(format);
      if (pageName && pageId) pageSet.set(pageId, pageName);

      const bodies = ad.ad_creative_bodies as string[] | undefined;

      activeAds.push({
        id: String(ad.id),
        status: 'ACTIVE',
        startDate: (ad.ad_delivery_start_time as string | null) ?? null,
        platforms,
        creativeMediaType: format,
        body: bodies?.[0]?.substring(0, 150) ?? null,
        pageId,
        pageName,
      });
    }

    const platforms = [...platformSet];
    const formats = [...formatSet];
    const pagesFound = [...pageSet.values()];
    const hasVideoAds = formats.some((f) => f.toLowerCase().includes('video'));
    const hasImageAds = formats.some((f) => f.toLowerCase().includes('image'));

    if (platforms.length > 0) findings.push(`Plataformas: ${platforms.join(', ')}`);
    if (formats.length > 0) findings.push(`Formatos: ${formats.join(', ')}`);
    if (pagesFound.length > 0) findings.push(`Páginas anunciantes: ${pagesFound.join(', ')}`);

    // Score
    let score = 1;
    if (totalAds >= 20 && platforms.length >= 2 && (hasVideoAds || formats.length >= 2)) score = 4;
    else if (totalAds >= 5 && platforms.length >= 2) score = 3;
    else if (totalAds >= 1) score = 2;

    return {
      adsFound: totalAds > 0,
      totalAds,
      activeAds,
      platforms,
      formats,
      hasVideoAds,
      hasImageAds,
      pagesFound,
      score,
      findings,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
    // Common error: token expired
    const isTokenError = errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('auth') || errMsg.includes('190');
    return {
      adsFound: false, totalAds: 0, activeAds: [],
      platforms: [], formats: [], hasVideoAds: false, hasImageAds: false,
      pagesFound: [], score: 0, findings: [],
      error: isTokenError
        ? `Token expirado ou inválido — gere um novo em developers.facebook.com/tools/explorer (${errMsg})`
        : `Erro na Meta Ad Library API: ${errMsg}`,
    };
  }
}
