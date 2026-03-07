/**
 * Mix de Tráfego — Real data via Tranco rank + traffic mix inference
 *
 * Sources (all free, no enterprise key required):
 * - Tranco list rank: redirect2me/siterank (no key, confirmed public API)
 *   Fallback: tranco-list.eu API (academic project)
 *   Fallback: allorigins CORS proxy
 * - Traffic channel mix: inferred from tech stack (MarTech signals) + HTML
 *
 * NOTE: SimilarWeb undocumented endpoint (data.similarweb.com/api/v1/data)
 * is DEAD since late 2024 — CloudFront 403. Do NOT use.
 * NOTE: Cloudflare Radar requires Authorization header — allorigins cannot
 * forward custom headers, so this API is not usable from browser SPA.
 */

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const TIMEOUT_MS = 10_000;

export interface TrafficChannelSignals {
  hasGa4: boolean;
  hasGtm: boolean;
  hasMetaPixel: boolean;
  hasLinkedinTag: boolean;
  hasTiktokPixel: boolean;
  hasGoogleAdsScript: boolean;
  socialLinksFound: string[];
  internalLinksCount: number;
  hasSeoSignals: boolean; // robots.txt / sitemap hint
}

export interface MixTrafegoResult {
  found: boolean;
  trancoRank: number | null;
  trafficBucket: 'top_1k' | 'top_10k' | 'top_100k' | 'top_500k' | 'top_1m' | 'unranked';
  activeChannels: string[];
  channelMix: {
    organic: 'forte' | 'moderado' | 'fraco' | 'desconhecido';
    paid: 'ativo' | 'inativo' | 'desconhecido';
    social: 'ativo' | 'inativo' | 'desconhecido';
    direct: 'estimado_alto' | 'estimado_medio' | 'estimado_baixo';
  };
  score: number;
  findings: string[];
  dataSources: string[];
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function rankToBucket(rank: number): MixTrafegoResult['trafficBucket'] {
  if (rank <= 1_000) return 'top_1k';
  if (rank <= 10_000) return 'top_10k';
  if (rank <= 100_000) return 'top_100k';
  if (rank <= 500_000) return 'top_500k';
  return 'top_1m';
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTrancoRank(domain: string): Promise<{ rank: number; source: string } | null> {
  // 1. redirect2me/siterank — no key, public JSON API (no CORS restrictions reported)
  try {
    const res = await fetchWithTimeout(
      `https://siterank.redirect2.me/api/rank.json?domain=${encodeURIComponent(domain)}`,
      7_000
    );
    if (res.ok) {
      const json = await res.json();
      if (json.rank && json.rank > 0) {
        return { rank: json.rank, source: 'Tranco via siterank.redirect2.me' };
      }
    }
  } catch { /* try next */ }

  // 2. Tranco direct API (academic project — may support CORS)
  try {
    const res = await fetchWithTimeout(
      `https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`,
      7_000
    );
    if (res.ok) {
      const json = await res.json();
      if (json.ranks && json.ranks.length > 0) {
        return { rank: json.ranks[0].rank, source: 'Tranco List EU (tranco-list.eu)' };
      }
    }
  } catch { /* try proxy */ }

  // 3. Tranco via allorigins proxy
  try {
    const target = `https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`;
    const res = await fetchWithTimeout(`${CORS_PROXY}${encodeURIComponent(target)}`, 10_000);
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text);
      if (json.ranks && json.ranks.length > 0) {
        return { rank: json.ranks[0].rank, source: 'Tranco List EU (via CORS proxy)' };
      }
    }
  } catch { /* domain not in top 1M */ }

  return null;
}

function inferChannelMix(signals: TrafficChannelSignals, trancoRank: number | null): {
  channels: string[];
  organic: MixTrafegoResult['channelMix']['organic'];
  paid: MixTrafegoResult['channelMix']['paid'];
  social: MixTrafegoResult['channelMix']['social'];
  direct: MixTrafegoResult['channelMix']['direct'];
} {
  const channels: string[] = [];

  // Organic — SEO signals (GA4 configured + SEO signals in HTML)
  let organic: MixTrafegoResult['channelMix']['organic'] = 'desconhecido';
  if (signals.hasGa4 && signals.hasSeoSignals) {
    organic = 'forte';
    channels.push('Orgânico (SEO)');
  } else if (signals.hasGa4 || signals.hasSeoSignals) {
    organic = 'moderado';
    channels.push('Orgânico (SEO)');
  } else if (signals.internalLinksCount > 5) {
    organic = 'fraco';
  }

  // Paid — Google Ads or Meta Pixel indicates active paid campaigns
  let paid: MixTrafegoResult['channelMix']['paid'] = 'desconhecido';
  if (signals.hasGoogleAdsScript || signals.hasMetaPixel || signals.hasTiktokPixel) {
    paid = 'ativo';
    const paidChannels: string[] = [];
    if (signals.hasGoogleAdsScript) paidChannels.push('Google Ads');
    if (signals.hasMetaPixel) paidChannels.push('Meta Ads');
    if (signals.hasTiktokPixel) paidChannels.push('TikTok Ads');
    channels.push(`Pago (${paidChannels.join(', ')})`);
  } else {
    paid = 'inativo';
  }

  // Social — social links in HTML or LinkedIn tag
  let social: MixTrafegoResult['channelMix']['social'] = 'desconhecido';
  if (signals.socialLinksFound.length >= 2 || signals.hasLinkedinTag) {
    social = 'ativo';
    channels.push(`Social (${signals.socialLinksFound.join(', ') || 'LinkedIn'})`);
  } else if (signals.socialLinksFound.length === 1) {
    social = 'ativo';
    channels.push(`Social (${signals.socialLinksFound[0]})`);
  } else {
    social = 'inativo';
  }

  // Direct — estimated from Tranco rank (strong brand = high direct traffic)
  let direct: MixTrafegoResult['channelMix']['direct'] = 'estimado_baixo';
  if (trancoRank && trancoRank <= 10_000) direct = 'estimado_alto';
  else if (trancoRank && trancoRank <= 100_000) direct = 'estimado_medio';

  if (direct === 'estimado_alto' || direct === 'estimado_medio') {
    channels.push('Direto (brand forte)');
  }

  return { channels, organic, paid, social, direct };
}

function calcScore(
  bucket: MixTrafegoResult['trafficBucket'],
  activeChannelCount: number
): number {
  // Score based on traffic volume (Tranco rank) and channel diversification
  if (bucket === 'top_1k' || (bucket === 'top_10k' && activeChannelCount >= 3)) return 4;
  if (bucket === 'top_10k' || (bucket === 'top_100k' && activeChannelCount >= 3)) return 3;
  if (bucket === 'top_100k' || (bucket === 'top_500k' && activeChannelCount >= 2)) return 3;
  if (bucket === 'top_500k' || (bucket === 'top_1m' && activeChannelCount >= 2)) return 2;
  if (activeChannelCount >= 2) return 2;
  return 1;
}

export async function analyzeMixTrafego(
  siteUrl: string,
  signals: TrafficChannelSignals
): Promise<MixTrafegoResult> {
  const domain = extractDomain(siteUrl);
  const findings: string[] = [];
  const dataSources: string[] = [];

  // ── Fetch Tranco rank ──────────────────────────────────────────────────
  const trancoResult = await fetchTrancoRank(domain);
  let trancoRank: number | null = null;
  let bucket: MixTrafegoResult['trafficBucket'] = 'unranked';

  if (trancoResult) {
    trancoRank = trancoResult.rank;
    bucket = rankToBucket(trancoRank);
    dataSources.push(trancoResult.source);
    findings.push(`✓ Ranking global Tranco: #${trancoRank.toLocaleString('pt-BR')} (${bucket.replace('_', ' ').replace('top', 'Top')})`);
  } else {
    findings.push('⚠️ Domínio não encontrado no Tranco Top 1M — tráfego global muito baixo ou nicho muito específico');
    dataSources.push('Tranco List EU (domínio ausente no top 1M)');
  }

  // ── Infer traffic channel mix ──────────────────────────────────────────
  const { channels, organic, paid, social, direct } = inferChannelMix(signals, trancoRank);
  dataSources.push('PageSpeed tech detection (sinais de canais)');
  if (signals.internalLinksCount > 0) dataSources.push('HTML scraping (social links)');

  // Build findings
  if (organic !== 'desconhecido') findings.push(`Canal orgânico: ${organic}`);
  if (paid === 'ativo') findings.push('Canal pago: ativo (pixel de remarketing detectado)');
  else if (paid === 'inativo') findings.push('Canal pago: sem pixels de mídia paga detectados');
  if (social === 'ativo') findings.push(`Canal social: ativo (${signals.socialLinksFound.join(', ')})`);
  else findings.push('Canal social: fraco (poucos links sociais encontrados)');
  if (direct === 'estimado_alto') findings.push('Canal direto: alto (marca com forte presença global)');

  if (channels.length === 0) {
    findings.push('⚠️ Canais de tráfego não detectados — configure Google Analytics e pixels de rastreamento');
  }

  const score = calcScore(bucket, channels.length);

  return {
    found: trancoRank !== null,
    trancoRank,
    trafficBucket: bucket,
    activeChannels: channels,
    channelMix: { organic, paid, social, direct },
    score,
    findings,
    dataSources,
  };
}
