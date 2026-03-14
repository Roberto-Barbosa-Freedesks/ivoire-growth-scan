/**
 * Facebook Ad Library scraping via Apify
 *
 * Primary:  igolaizola/facebook-ad-library-scraper
 *   Input:  { searchQuery: companyName, country: 'BR', adType: 'ALL', maxAds: 20 }
 *   Fields: ads[] with title, body, createdTime, impressions, reach, spend, media
 *
 * Fallback: curious_coder/facebook-ads-library-scraper
 *   Input:  { searchQuery: companyName, country: 'BR' }
 *
 * Purpose: Detect if a company is running paid ads on Facebook/Instagram,
 *          estimate ad spend activity, creative format mix, and campaign frequency.
 *
 * Used in: midia_paga_criativos (Dimensões CANAIS e CONTEÚDO)
 *
 * Cost: ~$0.01–0.02 per run | Free tier ($5/mo): ~250–500 runs/month
 */

import { runApifyActor } from './apifyClient';

export interface FbAdLibraryResult {
  found: boolean;
  totalAds: number;
  activeAds: number;
  adFormats: {
    image: number;
    video: number;
    carousel: number;
    text: number;
  };
  estimatedSpendLabel: string | null;   // "< R$100", "R$100–R$999", etc.
  topAds: Array<{
    title: string;
    body: string;
    createdTime: string | null;
    type: string;
    impressionsMin: number | null;
    impressionsMax: number | null;
  }>;
  score: number;   // 1–4
  findings: string[];
  dataSources: string[];
}

function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

function calcScore(r: FbAdLibraryResult): number {
  if (!r.found || r.totalAds === 0) return 1;
  let pts = 0;
  if (r.totalAds >= 20) pts += 2;
  else if (r.totalAds >= 5) pts += 1;
  if (r.activeAds >= 5) pts += 2;
  else if (r.activeAds >= 1) pts += 1;
  const formatCount = Object.values(r.adFormats).filter((v) => v > 0).length;
  if (formatCount >= 3) pts += 1;

  if (pts >= 4) return 4;
  if (pts >= 3) return 3;
  if (pts >= 1) return 2;
  return 1;
}

export async function fetchFbAdsLibrary(
  companyName: string,
  apifyToken: string,
  maxAds = 20
): Promise<FbAdLibraryResult> {
  const empty: FbAdLibraryResult = {
    found: false, totalAds: 0, activeAds: 0,
    adFormats: { image: 0, video: 0, carousel: 0, text: 0 },
    estimatedSpendLabel: null, topAds: [],
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: igolaizola/facebook-ad-library-scraper
  try {
    items = await runApifyActor(
      'igolaizola/facebook-ad-library-scraper',
      {
        searchQuery: companyName,
        country: 'BR',
        adType: 'ALL',
        maxAds,
      },
      apifyToken,
      { timeoutSecs: 120 }
    );
    if (items.length) actorUsed = 'igolaizola/facebook-ad-library-scraper';
  } catch { /* fall through */ }

  // Fallback: curious_coder/facebook-ads-library-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'curious_coder/facebook-ads-library-scraper',
        { searchQuery: companyName, country: 'BR', maxAds },
        apifyToken,
        { timeoutSecs: 120 }
      );
      if (items.length) actorUsed = 'curious_coder/facebook-ads-library-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Biblioteca de Anúncios do Facebook não retornou resultados para "${companyName}"`],
      dataSources: ['Facebook Ad Library via Apify (sem dados)'],
    };
  }

  const adFormats = { image: 0, video: 0, carousel: 0, text: 0 };
  let activeAds = 0;
  const topAds: FbAdLibraryResult['topAds'] = [];

  for (const item of items) {
    const d = item as Record<string, unknown>;

    // Active status
    const isActive = d.isActive ?? d.active ?? d.status;
    if (isActive === true || isActive === 'active' || isActive === 'ACTIVE') activeAds++;

    // Format detection
    const mediaType = str(d.mediaType ?? d.type ?? d.adType ?? d.format ?? '').toLowerCase();
    if (mediaType.includes('video')) adFormats.video++;
    else if (mediaType.includes('carousel') || mediaType.includes('slideshow')) adFormats.carousel++;
    else if (mediaType.includes('image') || mediaType.includes('photo')) adFormats.image++;
    else adFormats.text++;

    // Top ads
    if (topAds.length < 5) {
      const title = str(d.title ?? d.adTitle ?? d.headline ?? d.name ?? '');
      const body = str(d.body ?? d.adText ?? d.message ?? d.text ?? d.description ?? '');
      const createdTime = d.createdTime ?? d.created_time ?? d.startDate ?? d.start_date;
      const impMin = num(d.impressionsMin ?? d.impressions_lower_bound ?? d.reach_min);
      const impMax = num(d.impressionsMax ?? d.impressions_upper_bound ?? d.reach_max);

      topAds.push({
        title: title.slice(0, 100),
        body: body.slice(0, 200),
        createdTime: createdTime ? str(createdTime) : null,
        type: mediaType || 'unknown',
        impressionsMin: impMin,
        impressionsMax: impMax,
      });
    }
  }

  // Estimate spend label
  let estimatedSpendLabel: string | null = null;
  if (items.length > 0) {
    const firstItem = items[0] as Record<string, unknown>;
    const spendLabel = str(firstItem.spendLabel ?? firstItem.spend_label ?? firstItem.estimatedBudget ?? '');
    if (spendLabel) {
      estimatedSpendLabel = spendLabel;
    } else if (activeAds >= 10) {
      estimatedSpendLabel = 'Alta atividade (10+ anúncios ativos)';
    } else if (activeAds >= 3) {
      estimatedSpendLabel = 'Atividade moderada (3–9 anúncios ativos)';
    } else if (activeAds >= 1) {
      estimatedSpendLabel = 'Baixa atividade (1–2 anúncios ativos)';
    }
  }

  const result: FbAdLibraryResult = {
    found: true,
    totalAds: items.length,
    activeAds,
    adFormats,
    estimatedSpendLabel,
    topAds,
    score: 1,
    findings: [],
    dataSources: [`Facebook Ad Library via Apify (${actorUsed})`],
  };

  result.findings.push(
    `✓ Biblioteca de Anúncios: ${result.totalAds} anúncio(s) encontrado(s) para "${companyName}"`
  );
  if (activeAds > 0)
    result.findings.push(`${activeAds} anúncio(s) ativo(s) no momento`);
  if (estimatedSpendLabel)
    result.findings.push(`Nível de investimento: ${estimatedSpendLabel}`);

  const formatParts: string[] = [];
  if (adFormats.video > 0) formatParts.push(`Vídeo: ${adFormats.video}`);
  if (adFormats.carousel > 0) formatParts.push(`Carrossel: ${adFormats.carousel}`);
  if (adFormats.image > 0) formatParts.push(`Imagem: ${adFormats.image}`);
  if (adFormats.text > 0) formatParts.push(`Texto: ${adFormats.text}`);
  if (formatParts.length) result.findings.push(`Formatos: ${formatParts.join(' | ')}`);

  result.score = calcScore(result);
  return result;
}
