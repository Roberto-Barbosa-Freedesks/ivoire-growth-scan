import type {
  SubdimensionScore,
  DimensionScore,
  DimensionKey,
  MaturityLevel,
  Diagnostic,
  Insight,
  Recommendation,
} from '../types';
import { SUBDIMENSIONS, SCORE_THRESHOLDS } from '../data/scorecard';
import { RECOMMENDATIONS_LIBRARY } from '../data/recommendations';
import { applyAllSkills } from '../skills/skillsEngine';
import { fetchContacts } from './collection';

export function scoreToLevel(score: number): MaturityLevel {
  if (score <= SCORE_THRESHOLDS.Intuitivo.max) return 'Intuitivo';
  if (score <= SCORE_THRESHOLDS.Reativo.max) return 'Reativo';
  if (score <= SCORE_THRESHOLDS.Ativo.max) return 'Ativo';
  return 'Exponencial';
}

export function calculateDimensionScores(
  subdimensionScores: SubdimensionScore[],
  isEcommerce: boolean
): DimensionScore[] {
  const dimensions: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];
  const dimensionNames: Record<DimensionKey, string> = {
    CONTEUDO: 'Conteúdo',
    CANAIS: 'Canais',
    CONVERSAO: 'Conversão',
    CONTROLE: 'Controle',
  };

  return dimensions.map((dimKey) => {
    const relevantScores = subdimensionScores.filter((s) => {
      if (s.dimension !== dimKey) return false;
      // Skip conditional subdimensions for non-ecommerce
      const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);
      if (subdimDef?.isConditional && !isEcommerce) return false;
      if (s.source === 'skipped') return false;
      return true;
    });

    const validScores = relevantScores.filter((s) => s.source !== 'insufficient');
    const insufficientScores = relevantScores.filter((s) => s.source === 'insufficient');

    // Penalidade: insufficient data → score 1
    const penalizedScores = [
      ...validScores,
      ...insufficientScores.map((s) => ({ ...s, score: 1 })),
    ];

    const avg =
      penalizedScores.length > 0
        ? penalizedScores.reduce((sum, s) => sum + s.score, 0) / penalizedScores.length
        : 1;

    return {
      key: dimKey,
      name: dimensionNames[dimKey],
      score: Math.round(avg * 100) / 100,
      level: scoreToLevel(avg),
      subdimensions: subdimensionScores.filter((s) => s.dimension === dimKey),
      weight: 0.25,
    };
  });
}

export function calculateOverallScore(dimensionScores: DimensionScore[]): number {
  const total = dimensionScores.reduce((sum, d) => sum + d.score * d.weight, 0);
  return Math.round(total * 100) / 100;
}

export function generateInsights(
  subdimensionScores: SubdimensionScore[],
  dimensionScores: DimensionScore[],
  isEcommerce = false
): Insight[] {
  const insights: Insight[] = [];

  const eligibleScores = subdimensionScores.filter((s) => {
    if (s.source === 'skipped') return false;
    const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);
    if (subdimDef?.isConditional && !isEcommerce) return false;
    return true;
  });

  // Gap crítico: subdimensions scoring 1 (Intuitivo)
  eligibleScores
    .filter((s) => s.score === 1)
    .slice(0, 3)
    .forEach((s, i) => {
      const subdim = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);
      insights.push({
        id: `gap_${i}`,
        type: 'gap_critico',
        dimension: s.dimension,
        subdimensionId: s.subdimensionId,
        title: `Gap Crítico: ${s.name}`,
        description: `A empresa está no nível Intuitivo em ${s.name}. ${subdim?.levels[1] || ''} Esta lacuna representa uma oportunidade imediata de melhoria com alto impacto.`,
        priority: 'alta',
        impactEstimate: 'Alto impacto no score geral. Correção pode elevar maturidade em até 0,5 pontos nesta dimensão.',
      });
    });

  // Alavancas: subdimensions scoring 3 (Ativo → Exponencial)
  eligibleScores
    .filter((s) => s.score === 3)
    .slice(0, 2)
    .forEach((s, i) => {
      insights.push({
        id: `alavanca_${i}`,
        type: 'alavanca',
        dimension: s.dimension,
        subdimensionId: s.subdimensionId,
        title: `Alavanca de Crescimento: ${s.name}`,
        description: `Com score Ativo em ${s.name}, a empresa está próxima do nível Exponencial. Um esforço focado pode elevar esta subdimensão ao máximo e impactar o score geral.`,
        priority: 'media',
        impactEstimate: 'Potencial de elevar score geral em 0,2–0,3 pontos com investimento focalizado.',
      });
    });

  // Oportunidades: dimensões com score < média geral
  const overallScore = calculateOverallScore(dimensionScores);
  dimensionScores
    .filter((d) => d.score < overallScore - 0.5)
    .slice(0, 2)
    .forEach((d, i) => {
      insights.push({
        id: `oportunidade_${i}`,
        type: 'oportunidade',
        dimension: d.key,
        subdimensionId: '',
        title: `Oportunidade de Equalização: Dimensão ${d.name}`,
        description: `A dimensão ${d.name} (score ${d.score.toFixed(1)}) está abaixo da média geral (${overallScore.toFixed(1)}). Equalizar esta dimensão é o caminho mais eficiente para elevar o nível de maturidade geral.`,
        priority: 'alta',
        impactEstimate: `Elevar ${d.name} ao nível médio pode aumentar o score geral em ${((overallScore - d.score) * 0.25).toFixed(1)} pontos.`,
      });
    });

  return insights;
}

export function generateRecommendations(
  subdimensionScores: SubdimensionScore[],
  isEcommerce = false
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let priority = 1;

  // Prioritize by score ascending (worst first), exclude conditional for non-ecommerce
  const sorted = [...subdimensionScores]
    .filter((s) => {
      if (s.source === 'skipped') return false;
      const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);
      if (subdimDef?.isConditional && !isEcommerce) return false;
      return true;
    })
    .sort((a, b) => a.score - b.score);

  for (const score of sorted) {
    const recs = RECOMMENDATIONS_LIBRARY[score.subdimensionId];
    if (recs && Array.isArray(recs)) {
      for (const rec of recs) {
        recommendations.push({
          ...rec,
          id: `rec_${score.subdimensionId}_${priority}`,
          priority: priority++,
        });
      }
    }
    if (recommendations.length >= 10) break;
  }

  return recommendations;
}

export function generateExecutiveNarrative(
  companyName: string,
  overallScore: number,
  overallLevel: MaturityLevel,
  dimensionScores: DimensionScore[]
): string {
  const strongDims = dimensionScores.filter((d) => d.score >= 3).map((d) => d.name);
  const weakDims = dimensionScores.filter((d) => d.score < 2).map((d) => d.name);

  const levelDescriptions: Record<MaturityLevel, string> = {
    Intuitivo: 'opera predominantemente com base em intuição, com presença digital fragmentada e ausência de mensuração estruturada',
    Reativo: 'já deu os primeiros passos no marketing digital estruturado, mas ainda reage às demandas sem um plano integrado orientado por dados',
    Ativo: 'possui uma operação de marketing digital planejada, com dados orientando as principais decisões e canais integrados',
    Exponencial: 'opera uma máquina de crescimento digital altamente integrada, com automação, dados preditivos e IA em múltiplos touchpoints',
  };

  let narrative = `O diagnóstico de maturidade digital de ${companyName} revela um score geral de ${overallScore.toFixed(1)}/4,0, posicionando a empresa no nível ${overallLevel} do Framework 4Cs Ivoire. Isso significa que a empresa ${levelDescriptions[overallLevel]}.`;

  if (strongDims.length > 0) {
    narrative += ` Os pilares mais desenvolvidos são ${strongDims.join(' e ')}, onde a empresa demonstra práticas acima da média do mercado.`;
  }

  if (weakDims.length > 0) {
    narrative += ` As maiores oportunidades de crescimento estão concentradas em ${weakDims.join(' e ')}, dimensões que precisam de atenção prioritária para elevar o patamar competitivo da empresa.`;
  }

  narrative += ` O roadmap de recomendações a seguir foi estruturado para maximizar o impacto no score e nos resultados de negócio, priorizando ações de alto impacto e baixo esforço de implementação.`;

  return narrative;
}

export async function finalizeDiagnostic(
  diagnostic: Diagnostic,
  claudeApiKey?: string,
  apifyToken?: string
): Promise<Diagnostic> {
  const dimensionScores = calculateDimensionScores(
    diagnostic.subdimensionScores,
    diagnostic.input.isEcommerce
  );
  const overallScore = calculateOverallScore(dimensionScores);
  const overallLevel = scoreToLevel(overallScore);
  const insights = generateInsights(diagnostic.subdimensionScores, dimensionScores, diagnostic.input.isEcommerce);
  const recommendations = generateRecommendations(diagnostic.subdimensionScores, diagnostic.input.isEcommerce);
  const executiveNarrative = generateExecutiveNarrative(
    diagnostic.input.companyName,
    overallScore,
    overallLevel,
    dimensionScores
  );

  // Skills Engine — LLM enrichment per subdimension (optional, requires claudeApiKey)
  let enrichedSubdimensionScores = diagnostic.subdimensionScores;
  if (claudeApiKey) {
    const skillInputs = diagnostic.subdimensionScores
      .filter((s) => s.source !== 'skipped' && s.source !== 'insufficient')
      .map((s) => ({
        subdimensionId: s.subdimensionId,
        rawData: s.rawData,
        score: s.score,
      }));

    const skillResults = await applyAllSkills(skillInputs, diagnostic.input, claudeApiKey);

    if (skillResults.size > 0) {
      enrichedSubdimensionScores = diagnostic.subdimensionScores.map((s) => {
        const skillResult = skillResults.get(s.subdimensionId);
        if (!skillResult) return s;
        return {
          ...s,
          rawData: {
            ...s.rawData,
            skillAnalysis: skillResult,
          },
        };
      });
    }
  }

  // Contacts — fetch commercial contacts from site + LinkedIn (requires Apify Token)
  let contacts = diagnostic.contacts;
  if (apifyToken && !contacts) {
    try {
      contacts = await fetchContacts(
        diagnostic.input.siteUrl,
        diagnostic.input.companyName,
        diagnostic.input.linkedIn,
        apifyToken
      );
    } catch {
      // non-blocking — contacts are supplementary
    }
  }

  return {
    ...diagnostic,
    status: 'completed',
    subdimensionScores: enrichedSubdimensionScores,
    dimensionScores,
    overallScore,
    overallLevel,
    insights,
    recommendations,
    executiveNarrative,
    contacts,
    updatedAt: new Date().toISOString(),
  };
}
