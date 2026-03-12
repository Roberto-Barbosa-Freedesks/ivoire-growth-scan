import type { SegmentKey } from './types';

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  varejo_ecommerce: 'Varejo & E-commerce',
  saas_b2b_tecnologia: 'SaaS / B2B / Tecnologia',
  educacao: 'Educação & EdTech',
  saude_bemestar: 'Saúde & Bem-estar',
  financeiro_fintech: 'Financeiro & Fintech',
  hospitalidade_turismo: 'Hospitalidade & Turismo',
  industria_manufatura: 'Indústria & Manufatura',
  servicos_profissionais: 'Serviços Profissionais',
  imobiliario: 'Imobiliário',
  alimentacao_restaurantes: 'Alimentação & Restaurantes',
  moda_lifestyle: 'Moda & Lifestyle',
  agronegocio: 'Agronegócio',
  outros: 'Outros',
};

// Traffic thresholds (monthly visits) per segment for mix_trafego scoring
export const TRAFFIC_THRESHOLDS: Record<SegmentKey, { nivel3: number; nivel4: number }> = {
  varejo_ecommerce:        { nivel3: 100_000, nivel4: 500_000 },
  saas_b2b_tecnologia:     { nivel3:  20_000, nivel4: 100_000 },
  educacao:                { nivel3:  50_000, nivel4: 200_000 },
  saude_bemestar:          { nivel3:  10_000, nivel4:  50_000 },
  financeiro_fintech:      { nivel3:  50_000, nivel4: 300_000 },
  hospitalidade_turismo:   { nivel3:  20_000, nivel4: 100_000 },
  industria_manufatura:    { nivel3:   5_000, nivel4:  30_000 },
  servicos_profissionais:  { nivel3:   5_000, nivel4:  20_000 },
  imobiliario:             { nivel3:  10_000, nivel4:  50_000 },
  alimentacao_restaurantes:{ nivel3:   5_000, nivel4:  20_000 },
  moda_lifestyle:          { nivel3:  50_000, nivel4: 200_000 },
  agronegocio:             { nivel3:   5_000, nivel4:  20_000 },
  outros:                  { nivel3:  10_000, nivel4:  50_000 },
};

// Authority score thresholds per segment for seo_offpage
export const AUTHORITY_THRESHOLDS: Record<SegmentKey, { nivel3: number; nivel4: number }> = {
  varejo_ecommerce:        { nivel3: 30, nivel4: 55 },
  saas_b2b_tecnologia:     { nivel3: 35, nivel4: 60 },
  educacao:                { nivel3: 30, nivel4: 55 },
  saude_bemestar:          { nivel3: 25, nivel4: 45 },
  financeiro_fintech:      { nivel3: 40, nivel4: 65 },
  hospitalidade_turismo:   { nivel3: 25, nivel4: 45 },
  industria_manufatura:    { nivel3: 20, nivel4: 40 },
  servicos_profissionais:  { nivel3: 25, nivel4: 45 },
  imobiliario:             { nivel3: 25, nivel4: 45 },
  alimentacao_restaurantes:{ nivel3: 20, nivel4: 35 },
  moda_lifestyle:          { nivel3: 30, nivel4: 55 },
  agronegocio:             { nivel3: 20, nivel4: 40 },
  outros:                  { nivel3: 25, nivel4: 45 },
};

// Dominant traffic channel per segment
export const DOMINANT_CHANNEL: Record<SegmentKey, string> = {
  varejo_ecommerce:        'Direto + Orgânico',
  saas_b2b_tecnologia:     'Orgânico + Referência',
  educacao:                'Orgânico + Pago',
  saude_bemestar:          'Orgânico + Direto',
  financeiro_fintech:      'Orgânico + Pago',
  hospitalidade_turismo:   'Orgânico + Direto',
  industria_manufatura:    'Direto + Referência',
  servicos_profissionais:  'Orgânico + Direto',
  imobiliario:             'Orgânico + Pago',
  alimentacao_restaurantes:'Direto + Social',
  moda_lifestyle:          'Social + Pago',
  agronegocio:             'Orgânico + Direto',
  outros:                  'Orgânico + Direto',
};

export function getSegmentKey(segment: string): SegmentKey {
  const normalized = segment.toLowerCase().replace(/[\s/&()\-]/g, '_');
  const knownKeys = Object.keys(SEGMENT_LABELS) as SegmentKey[];
  return (
    knownKeys.find(
      (k) =>
        normalized.includes(k.replace(/_/g, '')) ||
        k.includes(normalized.split('_')[0])
    ) ?? 'outros'
  );
}
