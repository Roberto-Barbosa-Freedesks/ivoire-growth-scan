import type { DiagnosticInput } from '../types';

export type SegmentKey =
  | 'varejo_ecommerce'
  | 'saas_b2b_tecnologia'
  | 'educacao'
  | 'saude_bemestar'
  | 'financeiro_fintech'
  | 'hospitalidade_turismo'
  | 'industria_manufatura'
  | 'servicos_profissionais'
  | 'imobiliario'
  | 'alimentacao_restaurantes'
  | 'moda_lifestyle'
  | 'agronegocio'
  | 'outros';

export interface SkillDefinition {
  subdimensionId: string;
  subdimensionName: string;
  expertPersona: string;
  systemPromptTemplate: string;
  contextBuilder: (rawData: Record<string, unknown>, input: DiagnosticInput, score: number) => string;
  segmentRelevance: Partial<Record<SegmentKey, 'alto' | 'medio' | 'baixo'>>;
}

export interface SkillRecommendation {
  title: string;
  what: string;
  why: string;
  effort: 'baixo' | 'medio' | 'alto';
  timeframe: 'imediato' | 'curto_prazo' | 'medio_prazo';
}

export interface SkillResult {
  subdimensionId: string;
  findings: string[];
  insights: string[];
  recommendations: SkillRecommendation[];
  segmentBenchmark?: {
    label: string;
    percentile?: number;
  };
  model: string;
  llmUsed: boolean;
}
