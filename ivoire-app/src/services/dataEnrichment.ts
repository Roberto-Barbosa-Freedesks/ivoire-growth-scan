/**
 * Data Enrichment Engine — Diagnostic Engine V2.0
 *
 * When primary data sources fail, this engine fills gaps with intelligent
 * estimates based on:
 *   1. Cross-dimensional correlation (SEMrush keywords → traffic estimate)
 *   2. Segment benchmarks (TRAFFIC_THRESHOLDS, AUTHORITY_THRESHOLDS)
 *   3. Domain age / company size signals from adjacent subdimensions
 *   4. Industry baseline models (CTR, bounce rate, page speed by segment)
 *
 * Enriched scores use `dataReliability: 'estimated'` — shown in the UI as
 * an amber "Estimado" badge with tooltip: "Dado estimado com base nos
 * benchmarks do segmento".
 *
 * IMPORTANT: Never overrides scores with `dataReliability === 'real'` or
 * `source === 'skipped'`. Only fills `source === 'insufficient'` gaps.
 */

import type { SubdimensionScore, DiagnosticInput } from '../types';
import {
  getSegmentKey,
  TRAFFIC_THRESHOLDS,
  AUTHORITY_THRESHOLDS,
  DOMINANT_CHANNEL,
} from '../skills/segmentConfig';
import type { SegmentKey } from '../skills/types';

// ─── Segment baseline models ─────────────────────────────────────────────────

/** Estimated median monthly visits (between nivel3 and nil midpoint) */
function estimatedTraffic(segment: SegmentKey): number {
  const t = TRAFFIC_THRESHOLDS[segment];
  // Use 35% of nivel3 as realistic median for companies at Reativo/Ativo border
  return Math.round(t.nivel3 * 0.35);
}

/** Estimated domain authority / trust score for a typical company in segment */
function estimatedAuthority(segment: SegmentKey): number {
  const a = AUTHORITY_THRESHOLDS[segment];
  return Math.round(a.nivel3 * 0.6); // below nivel3 = Reativo range
}

/** Typical mobile performance score by segment */
const SEGMENT_MOBILE_SCORE: Record<SegmentKey, number> = {
  varejo_ecommerce:         52,
  saas_b2b_tecnologia:      65,
  educacao:                 58,
  saude_bemestar:           55,
  financeiro_fintech:       60,
  hospitalidade_turismo:    55,
  industria_manufatura:     50,
  servicos_profissionais:   58,
  imobiliario:              52,
  alimentacao_restaurantes: 48,
  moda_lifestyle:           54,
  agronegocio:              48,
  outros:                   55,
};

/** Typical accessibility score by segment */
const SEGMENT_ACCESSIBILITY: Record<SegmentKey, number> = {
  varejo_ecommerce:         68,
  saas_b2b_tecnologia:      75,
  educacao:                 72,
  saude_bemestar:           70,
  financeiro_fintech:       72,
  hospitalidade_turismo:    68,
  industria_manufatura:     65,
  servicos_profissionais:   70,
  imobiliario:              67,
  alimentacao_restaurantes: 65,
  moda_lifestyle:           69,
  agronegocio:              62,
  outros:                   68,
};

/** Average LCP (seconds) by segment — used in performance estimation */
const SEGMENT_LCP: Record<SegmentKey, number> = {
  varejo_ecommerce:         3.8,
  saas_b2b_tecnologia:      2.5,
  educacao:                 3.2,
  saude_bemestar:           3.0,
  financeiro_fintech:       2.8,
  hospitalidade_turismo:    3.5,
  industria_manufatura:     3.5,
  servicos_profissionais:   2.9,
  imobiliario:              3.3,
  alimentacao_restaurantes: 3.8,
  moda_lifestyle:           3.6,
  agronegocio:              3.5,
  outros:                   3.2,
};

// ─── Score estimation from median performance data ───────────────────────────

function estimatePerformanceScore(mobile: number, lcp: number): number {
  let pts = 0;
  if (mobile >= 75) pts += 3;
  else if (mobile >= 55) pts += 2;
  else if (mobile >= 35) pts += 1;
  if (lcp <= 2.5) pts += 2;
  else if (lcp <= 4.0) pts += 1;
  if (pts >= 4) return 3;
  if (pts >= 2) return 2;
  return 1;
}

function estimateAuthorityScore(da: number, segment: SegmentKey): number {
  const t = AUTHORITY_THRESHOLDS[segment];
  if (da >= t.nivel4) return 4;
  if (da >= t.nivel3) return 3;
  if (da >= t.nivel3 * 0.5) return 2;
  return 1;
}

function estimateTrafficScore(visits: number, segment: SegmentKey): number {
  const t = TRAFFIC_THRESHOLDS[segment];
  if (visits >= t.nivel4) return 4;
  if (visits >= t.nivel3) return 3;
  if (visits >= t.nivel3 * 0.3) return 2;
  return 1;
}

// ─── Cross-dimensional data extraction ───────────────────────────────────────

function getRawNum(rawData: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = rawData[k];
    if (typeof v === 'number' && !isNaN(v) && v > 0) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function getDomainAgeYears(rawData: Record<string, unknown>): number | null {
  const reg = rawData.registrationDate;
  if (typeof reg !== 'string') return null;
  const d = new Date(reg);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// ─── Individual subdimension estimators ──────────────────────────────────────

function enrichPerformanceWeb(
  score: SubdimensionScore,
  segment: SegmentKey,
  seoScore: SubdimensionScore | undefined
): SubdimensionScore {
  // Adjust estimate if domain age available from seo_offpage
  const domainAgeYears = seoScore ? getDomainAgeYears(seoScore.rawData ?? {}) : null;
  const mobileScore = SEGMENT_MOBILE_SCORE[segment];
  const lcp = SEGMENT_LCP[segment];

  // Slightly better estimate for mature domains (>3 years invested in site)
  const ageFactor = domainAgeYears !== null && domainAgeYears > 3 ? 1.1 : 1.0;
  const adjustedMobile = Math.min(90, Math.round(mobileScore * ageFactor));
  const adjustedLcp = lcp / ageFactor;

  const estimatedScore = estimatePerformanceScore(adjustedMobile, adjustedLcp);
  const accessibility = SEGMENT_ACCESSIBILITY[segment];

  return {
    ...score,
    score: estimatedScore,
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: [`Estimativa baseada em benchmarks do segmento: ${segment}`],
    rawData: {
      ...score.rawData,
      estimated: true,
      estimatedMobileScore: adjustedMobile,
      estimatedLcp: adjustedLcp.toFixed(1),
      estimatedAccessibilityScore: accessibility,
      segmentBenchmark: segment,
      findings: [
        '⚠️ PageSpeed API indisponível — dados estimados a partir de benchmarks do segmento.',
        `Score mobile estimado: ${adjustedMobile}/100 (mediana do segmento)`,
        `LCP estimado: ${adjustedLcp.toFixed(1)}s`,
        `Acessibilidade estimada: ${accessibility}/100`,
        'Configure VITE_PAGESPEED_API_KEY para dados reais de performance.',
      ],
    },
  };
}

function enrichMixTrafego(
  score: SubdimensionScore,
  segment: SegmentKey,
  seoScore: SubdimensionScore | undefined
): SubdimensionScore {
  let estimatedVisits: number;
  let method: string;

  // Method 1: estimate from organic keywords (SEMrush/Ubersuggest) × median CTR 3%
  if (seoScore) {
    const organicKeywords = getRawNum(
      seoScore.rawData ?? {},
      'semrushOrganicKeywords', 'ahrefsOrganicKeywords',
      'ubersuggestOrganicKeywords', 'seRankingOrganicKeywords'
    );
    if (organicKeywords !== null && organicKeywords > 0) {
      // Estimate: keywords × avg 10 searches/keyword × 3% CTR
      estimatedVisits = Math.round(organicKeywords * 10 * 0.03);
      method = `Estimado: ${organicKeywords.toLocaleString('pt-BR')} palavras-chave orgânicas × CTR médio 3%`;
    } else {
      estimatedVisits = estimatedTraffic(segment);
      method = `Mediana do segmento ${segment}`;
    }
  } else {
    estimatedVisits = estimatedTraffic(segment);
    method = `Mediana do segmento ${segment}`;
  }

  const estimatedScore = estimateTrafficScore(estimatedVisits, segment);
  const dominantChannel = DOMINANT_CHANNEL[segment];

  return {
    ...score,
    score: estimatedScore,
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: ['Estimativa por correlação SEO + benchmark de segmento'],
    rawData: {
      ...score.rawData,
      estimated: true,
      estimatedMonthlyVisits: estimatedVisits,
      estimatedTrafficMethod: method,
      estimatedDominantChannel: dominantChannel,
      segmentBenchmark: segment,
      findings: [
        '⚠️ SimilarWeb e Tranco indisponíveis — tráfego estimado por modelo de correlação.',
        `Visitas mensais estimadas: ${estimatedVisits.toLocaleString('pt-BR')}`,
        `Método: ${method}`,
        `Canal dominante esperado: ${dominantChannel}`,
        'Configure apifyToken para dados reais via SimilarWeb.',
      ],
    },
  };
}

function enrichSeoOffpage(
  score: SubdimensionScore,
  segment: SegmentKey
): SubdimensionScore {
  const da = estimatedAuthority(segment);
  const estimatedScore = estimateAuthorityScore(da, segment);

  return {
    ...score,
    score: estimatedScore,
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: [`Estimativa baseada em benchmarks do segmento: ${segment}`],
    rawData: {
      ...score.rawData,
      estimated: true,
      authorityScore: da,
      totalBacklinks: 0,
      referringDomains: 0,
      segmentBenchmark: segment,
      findings: [
        '⚠️ SEMrush, Ahrefs, Ubersuggest e SE Ranking indisponíveis — autoridade estimada por benchmark de segmento.',
        `Domain Authority estimado: ${da}/100 (benchmark ${segment})`,
        'Configure apifyToken para análise real de autoridade e backlinks.',
      ],
    },
  };
}

function enrichReputacaoVoc(
  score: SubdimensionScore,
  input: DiagnosticInput,
  seoScore: SubdimensionScore | undefined
): SubdimensionScore {
  // Estimate from domain age and segment
  const domainAgeYears = seoScore ? getDomainAgeYears(seoScore.rawData ?? {}) : null;
  let estimatedRating: number;
  let findings: string[];

  if (domainAgeYears !== null && domainAgeYears > 5) {
    estimatedRating = 4.0;
    findings = [
      '⚠️ Google Maps/Places indisponível — reputação estimada por maturidade do domínio.',
      `Domínio com ${domainAgeYears.toFixed(0)} anos → reputação estabelecida estimada (≥4.0)`,
    ];
  } else if (domainAgeYears !== null && domainAgeYears > 2) {
    estimatedRating = 3.5;
    findings = [
      '⚠️ Google Maps/Places indisponível — reputação estimada por maturidade do domínio.',
      `Domínio com ${domainAgeYears.toFixed(0)} anos → reputação em desenvolvimento estimada (~3.5)`,
    ];
  } else {
    estimatedRating = 0;
    findings = [
      '⚠️ Reputação digital não verificável — configure apifyToken ou googlePlacesApiKey.',
      `Busque manualmente: ${input.companyName} no Google Maps e Reclame Aqui.`,
    ];
  }

  const estimatedScore = estimatedRating >= 4.5 ? 4 : estimatedRating >= 4.0 ? 3 : estimatedRating >= 3.5 ? 2 : 1;

  return {
    ...score,
    score: estimatedScore,
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: ['Estimativa por maturidade de domínio + benchmark de segmento'],
    rawData: {
      ...score.rawData,
      estimated: true,
      estimatedRating: estimatedRating > 0 ? estimatedRating : null,
      googleRating: estimatedRating > 0 ? estimatedRating : null,
      googleReviews: null,
      findings,
      reclameAquiNote: 'Reclame Aqui: verificar manualmente em reclameaqui.com.br.',
    },
  };
}

/** Generic baseline estimate for any remaining insufficient subdimension */
function enrichDefault(
  score: SubdimensionScore,
  segment: SegmentKey
): SubdimensionScore {
  return {
    ...score,
    score: 1,
    source: 'auto',
    dataReliability: 'estimated',
    dataSources: [`Estimativa baseline — segmento ${segment}`],
    rawData: {
      ...score.rawData,
      estimated: true,
      segmentBenchmark: segment,
      findings: [
        '⚠️ Dados primários indisponíveis — score baseline aplicado.',
        'Configure as integrações indicadas em Configurações para análise real.',
      ],
    },
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Enriches subdimension scores that have `source === 'insufficient'` or
 * `dataReliability === 'insufficient'` with intelligent segment-based estimates.
 *
 * Called in `finalizeDiagnostic()` before Skills Engine runs, so skills
 * can also see the estimated data.
 *
 * @param scores  - Array of subdimension scores from collection
 * @param input   - Original diagnostic input (segment, isEcommerce, etc.)
 * @returns enriched scores array (original scores untouched if not insufficient)
 */
export function enrichSubdimensions(
  scores: SubdimensionScore[],
  input: DiagnosticInput
): SubdimensionScore[] {
  const segment = getSegmentKey(input.segment);

  // Pre-fetch cross-dimensional references
  const seoOffpage = scores.find((s) => s.subdimensionId === 'seo_offpage');

  return scores.map((score) => {
    // Never touch real, estimated, manual, or skipped data
    if (
      score.source === 'skipped' ||
      (score.source !== 'insufficient' && score.dataReliability !== 'insufficient')
    ) {
      return score;
    }

    switch (score.subdimensionId) {
      case 'performance_web':
        return enrichPerformanceWeb(score, segment, seoOffpage);

      case 'mix_trafego':
        return enrichMixTrafego(score, segment, seoOffpage);

      case 'seo_offpage':
        return enrichSeoOffpage(score, segment);

      case 'reputacao_voc':
        return enrichReputacaoVoc(score, input, seoOffpage);

      // These subdimensions already have HTML fallbacks that prevent reaching
      // 'insufficient' in normal flow. The default below handles edge cases.
      case 'tracking_health':
      case 'stack_martech':
      case 'ux_ui_cro':
      case 'ai_ml_readiness':
      case 'seo_onpage_eeat':
      case 'semantica_geo':
      case 'inteligencia_demanda':
      case 'presenca_video_audio':
      case 'midia_paga_criativos':
      case 'presenca_marketplaces':
      case 'jornada_checkout':
        return enrichDefault(score, segment);

      default:
        return enrichDefault(score, segment);
    }
  });
}

/**
 * Count how many subdimensions were enriched (for logging/debugging)
 */
export function countEnriched(before: SubdimensionScore[], after: SubdimensionScore[]): number {
  return after.filter((a, i) => a.dataReliability === 'estimated' && before[i]?.dataReliability === 'insufficient').length;
}
