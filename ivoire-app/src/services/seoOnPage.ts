/**
 * SEO On-Page & E-E-A-T Analysis
 * Real data extracted from scraped HTML + Google PageSpeed SEO audit.
 * No estimates — all findings are based on actual site content.
 */

import type { ScrapedPageData } from './htmlScraper';
import type { PageSpeedData } from '../types';

export interface SeoOnPageResult {
  score: number; // 1–4
  title: string;
  titleLength: number;
  titleOptimized: boolean;
  metaDescription: string;
  metaDescLength: number;
  metaDescOptimized: boolean;
  h1Count: number;
  h1Optimized: boolean;
  h1Text: string;
  schemaTypes: string[];
  schemaCount: number;
  hasOrganizationSchema: boolean;
  hasAuthorInfo: boolean;
  canonicalPresent: boolean;
  langSet: boolean;
  pagespeedSeoScore: number;
  imagesWithAltPct: number;
  hasAboutPage: boolean;
  hasContactPage: boolean;
  internalLinksCount: number;
  findings: string[];
}

export function analyzeSeoOnPage(
  scraped: ScrapedPageData,
  pageSpeedDesktop?: PageSpeedData
): SeoOnPageResult {
  const findings: string[] = [];
  let points = 0;

  // ── Title ──────────────────────────────────────────────────────────────
  const titleLength = scraped.title.length;
  const titleOptimized = titleLength >= 30 && titleLength <= 65;

  if (!scraped.title) {
    findings.push('❌ Título da página ausente');
  } else if (titleLength < 30) {
    findings.push(`⚠️ Título muito curto (${titleLength} chars — ideal: 30–65)`);
    points += 0.5;
  } else if (titleLength > 65) {
    findings.push(`⚠️ Título muito longo (${titleLength} chars — ideal: 30–65)`);
    points += 0.5;
  } else {
    findings.push(`✓ Título otimizado (${titleLength} chars)`);
    points += 2;
  }

  // ── Meta Description ───────────────────────────────────────────────────
  const metaDescLength = scraped.metaDescription.length;
  const metaDescOptimized = metaDescLength >= 100 && metaDescLength <= 160;

  if (!scraped.metaDescription) {
    findings.push('❌ Meta description ausente');
  } else if (!metaDescOptimized) {
    findings.push(`⚠️ Meta description fora do tamanho ideal (${metaDescLength} chars — ideal: 100–160)`);
    points += 0.5;
  } else {
    findings.push(`✓ Meta description otimizada (${metaDescLength} chars)`);
    points += 2;
  }

  // ── H1 ─────────────────────────────────────────────────────────────────
  const h1Count = scraped.h1Tags.length;
  const h1Optimized = h1Count === 1;
  const h1Text = scraped.h1Tags[0] ?? '';

  if (h1Count === 0) {
    findings.push('❌ H1 ausente — afeta leitura dos motores de busca');
  } else if (h1Count > 1) {
    findings.push(`⚠️ ${h1Count} H1 encontrados — recomendado apenas 1 por página`);
    points += 0.5;
  } else {
    findings.push(`✓ H1 único presente: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '…' : ''}"`);
    points += 2;
  }

  // ── Schema Markup ──────────────────────────────────────────────────────
  const schemaTypes = scraped.schemaTypes;
  const schemaCount = schemaTypes.length;
  const hasOrganizationSchema = schemaTypes.some((t) =>
    ['Organization', 'LocalBusiness', 'Corporation', 'NGO', 'EducationalOrganization'].includes(t)
  );

  if (schemaCount === 0) {
    findings.push('❌ Sem schema markup (JSON-LD) — oportunidade para Rich Results');
  } else {
    findings.push(`✓ Schema markup: ${schemaTypes.slice(0, 5).join(', ')}${schemaCount > 5 ? ` +${schemaCount - 5}` : ''}`);
    points += schemaCount >= 3 ? 3 : schemaCount >= 1 ? 1.5 : 0;
  }
  if (hasOrganizationSchema) {
    findings.push('✓ Schema Organization/LocalBusiness presente');
    points += 1;
  }

  // ── Author / E-E-A-T ───────────────────────────────────────────────────
  const hasAuthorInfo = scraped.hasAuthorMeta || scraped.authorBylines.length > 0;
  if (hasAuthorInfo) {
    findings.push('✓ Sinais de autoria (E-E-A-T) identificados');
    points += 1;
  } else {
    findings.push('⚠️ Sinais de autoria (E-E-A-T) não identificados');
  }

  // About/Contact pages (E-E-A-T signal)
  if (scraped.hasAboutPage) {
    findings.push('✓ Página "Sobre" detectada (sinal E-E-A-T)');
    points += 0.5;
  }
  if (scraped.hasContactPage) {
    findings.push('✓ Página de Contato detectada');
    points += 0.5;
  }

  // ── Canonical ──────────────────────────────────────────────────────────
  if (scraped.canonicalUrl) {
    findings.push('✓ Tag canonical presente');
    points += 0.5;
  } else {
    findings.push('⚠️ Tag canonical ausente');
  }

  // ── Language ───────────────────────────────────────────────────────────
  if (scraped.langAttr) {
    findings.push(`✓ Atributo lang="${scraped.langAttr}"`);
    points += 0.5;
  } else {
    findings.push('⚠️ Atributo lang não definido no <html>');
  }

  // ── Image Alt Texts ────────────────────────────────────────────────────
  const imagesWithAltPct =
    scraped.imageCount > 0
      ? Math.round((scraped.imagesWithAlt / scraped.imageCount) * 100)
      : 100;
  if (scraped.imageCount > 0) {
    if (imagesWithAltPct >= 80) {
      findings.push(`✓ Alt text em ${imagesWithAltPct}% das imagens`);
      points += 1;
    } else {
      findings.push(`⚠️ Alt text em apenas ${imagesWithAltPct}% das imagens (${scraped.imagesWithAlt}/${scraped.imageCount})`);
    }
  }

  // ── PageSpeed SEO Score ────────────────────────────────────────────────
  const pagespeedSeoScore = pageSpeedDesktop?.seoScore ?? 0;
  if (pagespeedSeoScore > 0) {
    if (pagespeedSeoScore >= 90) {
      findings.push(`✓ Lighthouse SEO score: ${pagespeedSeoScore}/100`);
      points += 2;
    } else if (pagespeedSeoScore >= 70) {
      findings.push(`⚠️ Lighthouse SEO score: ${pagespeedSeoScore}/100 (melhorável)`);
      points += 1;
    } else {
      findings.push(`❌ Lighthouse SEO score: ${pagespeedSeoScore}/100 (crítico)`);
    }
  }

  // ── Internal Links ─────────────────────────────────────────────────────
  if (scraped.internalLinks >= 20) {
    findings.push(`✓ ${scraped.internalLinks} links internos detectados`);
    points += 0.5;
  } else if (scraped.internalLinks > 0) {
    findings.push(`⚠️ Apenas ${scraped.internalLinks} links internos — estrutura interna pode ser melhorada`);
  }

  // ── Score mapping (0–18 points → 1–4) ─────────────────────────────────
  let score = 1;
  if (points >= 14) score = 4;
  else if (points >= 9) score = 3;
  else if (points >= 5) score = 2;

  return {
    score,
    title: scraped.title,
    titleLength,
    titleOptimized,
    metaDescription: scraped.metaDescription,
    metaDescLength,
    metaDescOptimized,
    h1Count,
    h1Optimized,
    h1Text,
    schemaTypes,
    schemaCount,
    hasOrganizationSchema,
    hasAuthorInfo,
    canonicalPresent: !!scraped.canonicalUrl,
    langSet: !!scraped.langAttr,
    pagespeedSeoScore,
    imagesWithAltPct,
    hasAboutPage: scraped.hasAboutPage,
    hasContactPage: scraped.hasContactPage,
    internalLinksCount: scraped.internalLinks,
    findings,
  };
}
