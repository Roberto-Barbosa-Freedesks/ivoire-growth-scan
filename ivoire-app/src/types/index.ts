export type MaturityLevel = 'Intuitivo' | 'Reativo' | 'Ativo' | 'Exponencial';

export type DimensionKey = 'CONTEUDO' | 'CANAIS' | 'CONVERSAO' | 'CONTROLE';

export type CollectionStatus = 'pending' | 'collecting' | 'completed' | 'error' | 'manual';

export interface SubdimensionData {
  id: string;
  name: string;
  dimension: DimensionKey;
  description: string;
  kpis: string;
  levels: Record<1 | 2 | 3 | 4, string>;
  collectionType: 'automatizado' | 'semi-automatizado' | 'manual';
  isConditional: boolean;
  conditionalFor?: string;
  /** Data source label shown in UI for audit reference */
  dataSources?: string[];
}

export interface SubdimensionScore {
  subdimensionId: string;
  name: string;
  dimension: DimensionKey;
  score: number; // 1–4
  level: MaturityLevel;
  source: 'auto' | 'manual' | 'insufficient' | 'skipped';
  rawData: Record<string, unknown>;
  collectionStatus: CollectionStatus;
  notes?: string;
  isConditional: boolean;
  /** Whether this data came from a real API, was insufficient, or manual */
  dataReliability?: 'real' | 'estimated' | 'manual' | 'insufficient';
  /** Which tools/APIs were used */
  dataSources?: string[];
}

export interface DimensionScore {
  key: DimensionKey;
  name: string;
  score: number; // 1–4 weighted avg
  level: MaturityLevel;
  subdimensions: SubdimensionScore[];
  weight: number; // 0.25 each by default
}

export interface Insight {
  id: string;
  type: 'gap_critico' | 'alavanca' | 'erosao_funil' | 'oportunidade';
  dimension: DimensionKey;
  subdimensionId: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  impactEstimate: string;
}

export interface Recommendation {
  id: string;
  dimension: DimensionKey;
  subdimensionId: string;
  title: string;
  what: string;
  why: string;
  expectedImpact: string;
  effort: 'baixo' | 'medio' | 'alto';
  priority: number; // 1 = highest
  timeframe: 'imediato' | 'curto_prazo' | 'medio_prazo';
}

export interface DiagnosticInput {
  companyName: string;
  segment: string;
  geography: 'nacional' | 'regional';
  geographyDetail?: string;
  siteUrl: string;
  linkedIn?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  competitors?: string[];
  additionalSites?: string[];
  contextNotes?: string;
  isEcommerce: boolean;
  /** Extracted client logo URL */
  clientLogoUrl?: string;
}

export interface Diagnostic {
  id: string;
  input: DiagnosticInput;
  status: 'draft' | 'collecting' | 'manual_input' | 'processing' | 'completed';
  createdAt: string;
  updatedAt: string;
  collectionProgress: Record<string, CollectionStatus>;
  subdimensionScores: SubdimensionScore[];
  dimensionScores?: DimensionScore[];
  overallScore?: number;
  overallLevel?: MaturityLevel;
  executiveNarrative?: string;
  insights?: Insight[];
  recommendations?: Recommendation[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'consultor' | 'admin';
  avatar?: string;
  /** Whether this user completed email verification */
  emailVerified?: boolean;
}

/** Stored user with hashed password */
export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  role: 'consultor' | 'admin';
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface PageSpeedData {
  lcp: number; // seconds
  inp?: number; // ms
  cls: number;
  mobileScore: number; // 0–100
  desktopScore: number; // 0–100
  accessibilityScore: number; // 0–100
  bestPracticesScore: number; // 0–100
  seoScore: number; // 0–100
  fcp: number; // seconds
  ttfb: number; // ms
  url: string;
  strategy: 'mobile' | 'desktop';
}

export interface AppSettings {
  // ── Performance & Tracking ──────────────────────────────────────────────
  pageSpeedApiKey: string;           // Google PageSpeed — gratuito 25k/dia

  // ── Email (futuro) ──────────────────────────────────────────────────────
  emailJSServiceId: string;
  emailJSTemplateId: string;
  emailJSPublicKey: string;

  // ── Reputação Digital — Google Places API ───────────────────────────────
  // fallback quando Apify não encontra a empresa no Maps
  googlePlacesApiKey: string;

  // ── Mídia Paga — Meta Ad Library API ───────────────────────────────────
  // Token gratuito em developers.facebook.com/tools/explorer (válido ~60 dias)
  metaAccessToken: string;

  // ── SEO Off-Page — Open PageRank (free, no credit card) ─────────────────
  // openpagerank.com — 10.000 calls/hora, sem cartão
  openPageRankApiKey: string;

  // ── Apify — plataforma de scraping (substitui SimilarWeb, SEMrush, Apollo) ─
  // Gratuito: $5 USD/mês (~55 diagnósticos completos). Token em apify.com
  // Cobre: SimilarWeb · SEMrush · Ahrefs · Google Maps · TikTok ·
  //        Facebook · Instagram · YouTube · AnswerThePublic · LinkedIn
  apifyToken: string;

  // ── Claude / Anthropic API — análise LLM de Jornada de Checkout ──────────
  // console.anthropic.com → API Keys. Usa claude-haiku (rápido, ~$0.001/diag)
  // Opcional: se não configurado, usa análise estática como fallback
  claudeApiKey?: string;
}
