/**
 * Semântica & GEO (IA Search) Analysis
 * Extracts and evaluates structured data (JSON-LD) from site HTML.
 * Real data — no estimates.
 */

import type { ScrapedPageData } from './htmlScraper';

export interface SemanticaGeoResult {
  score: number; // 1–4
  schemaTypes: string[];
  schemaCount: number;
  hasOrganization: boolean;
  hasWebSite: boolean;
  hasBreadcrumb: boolean;
  richResultTypes: string[];
  richResultsCount: number;
  jsonLdCount: number;
  hasValidJsonLd: boolean;
  geoVisibility: 'ausente' | 'parcial' | 'presente';
  hasSiteLinksSearch: boolean;
  hasFAQ: boolean;
  hasProduct: boolean;
  hasArticle: boolean;
  hasLocalBusiness: boolean;
  findings: string[];
}

const RICH_RESULT_TYPES = new Set([
  'FAQPage', 'HowTo', 'Article', 'NewsArticle', 'BlogPosting', 'TechArticle',
  'Product', 'Review', 'AggregateRating', 'Recipe', 'Event', 'VideoObject',
  'BreadcrumbList', 'SiteLinksSearchBox', 'JobPosting', 'Course', 'Book',
  'Service', 'LocalBusiness', 'MedicalCondition', 'Dataset', 'Speakable',
  'ItemList', 'CollectionPage', 'SearchResultsPage',
]);

export function analyzeSemanticaGeo(scraped: ScrapedPageData): SemanticaGeoResult {
  const findings: string[] = [];
  const schemaTypes = scraped.schemaTypes;
  const jsonLdCount = scraped.jsonLdBlocks.length;

  const hasOrganization = schemaTypes.some((t) =>
    ['Organization', 'Corporation', 'NGO', 'EducationalOrganization'].includes(t)
  );
  const hasLocalBusiness = schemaTypes.some((t) =>
    ['LocalBusiness', 'Restaurant', 'Store', 'MedicalBusiness', 'HealthAndBeautyBusiness'].includes(t)
  );
  const hasWebSite = schemaTypes.includes('WebSite');
  const hasBreadcrumb = schemaTypes.includes('BreadcrumbList');
  const hasSiteLinksSearch = schemaTypes.includes('SiteLinksSearchBox');
  const hasFAQ = schemaTypes.some((t) => ['FAQPage', 'HowTo'].includes(t));
  const hasProduct = schemaTypes.some((t) => ['Product', 'ProductGroup', 'Offer'].includes(t));
  const hasArticle = schemaTypes.some((t) =>
    ['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'WebPage'].includes(t)
  );

  const richResultTypes = schemaTypes.filter((t) => RICH_RESULT_TYPES.has(t));

  // ── Findings ──────────────────────────────────────────────────────────
  if (jsonLdCount === 0) {
    findings.push('❌ Nenhum dado estruturado JSON-LD encontrado');
    findings.push('⚠️ Sem estrutura semântica — invisível para motores de IA (Perplexity, ChatGPT)');
  } else {
    findings.push(`✓ ${jsonLdCount} bloco(s) JSON-LD encontrado(s)`);
    findings.push(`Tipos detectados: ${schemaTypes.join(', ')}`);
  }

  if (hasOrganization || hasLocalBusiness) {
    findings.push(`✓ Schema ${hasLocalBusiness ? 'LocalBusiness' : 'Organization'} presente — favorece citação em IA`);
  } else {
    findings.push('❌ Schema Organization/LocalBusiness ausente — essencial para visibilidade em IA');
  }

  if (hasWebSite) findings.push('✓ Schema WebSite presente');
  else findings.push('⚠️ Schema WebSite ausente');

  if (hasBreadcrumb) findings.push('✓ BreadcrumbList — melhora navegação nos SERPs');
  if (hasSiteLinksSearch) findings.push('✓ SiteLinksSearchBox — caixa de busca nos SERPs');

  if (hasFAQ) findings.push('✓ FAQPage/HowTo — elegível para Rich Results de FAQ');
  else findings.push('⚠️ Sem FAQ estruturado — oportunidade de Rich Result perdida');

  if (hasProduct) findings.push('✓ Schema Product — dados de produto para SERPs de e-commerce');
  if (hasArticle) findings.push('✓ Schema Article — elegível para TopStories no Google');

  if (richResultTypes.length > 0) {
    findings.push(`✓ ${richResultTypes.length} tipo(s) elegíveis para Rich Results: ${richResultTypes.join(', ')}`);
  } else {
    findings.push('⚠️ Nenhum tipo elegível para Rich Results');
  }

  // ── GEO Visibility (AI Search readiness) ─────────────────────────────
  let geoVisibility: 'ausente' | 'parcial' | 'presente' = 'ausente';
  if ((hasOrganization || hasLocalBusiness) && hasWebSite && richResultTypes.length >= 2) {
    geoVisibility = 'presente';
  } else if ((hasOrganization || hasLocalBusiness) || richResultTypes.length >= 1) {
    geoVisibility = 'parcial';
  }

  // ── Score ─────────────────────────────────────────────────────────────
  let points = 0;
  if (jsonLdCount > 0) points += 2;
  if (hasOrganization || hasLocalBusiness) points += 2;
  if (hasWebSite) points += 1;
  if (hasBreadcrumb) points += 1;
  if (hasFAQ) points += 1.5;
  if (hasProduct) points += 1;
  if (hasArticle) points += 1;
  if (hasSiteLinksSearch) points += 0.5;
  if (richResultTypes.length >= 3) points += 1.5;
  else if (richResultTypes.length >= 2) points += 1;
  if (schemaTypes.length >= 5) points += 1;

  let score = 1;
  if (points >= 10) score = 4;
  else if (points >= 6) score = 3;
  else if (points >= 2) score = 2;

  return {
    score,
    schemaTypes,
    schemaCount: schemaTypes.length,
    hasOrganization: hasOrganization || hasLocalBusiness,
    hasWebSite,
    hasBreadcrumb,
    richResultTypes,
    richResultsCount: richResultTypes.length,
    jsonLdCount,
    hasValidJsonLd: jsonLdCount > 0,
    geoVisibility,
    hasSiteLinksSearch,
    hasFAQ,
    hasProduct,
    hasArticle,
    hasLocalBusiness,
    findings,
  };
}
