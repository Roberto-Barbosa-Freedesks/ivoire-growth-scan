/**
 * SEO site audit via Apify — comprehensive on-page/technical SEO analysis
 *
 * Primary:  smart-digital/complete-seo-audit-tool
 *   Input:  { url: "https://example.com" }
 *   Fields: seoScore, metaTags, h1, h2, brokenLinks, loadTime, mobileScore,
 *           canonicals, sitemapUrl, robotsTxt, schemaMarkup
 *
 * Fallback 1: louisdeconinck/seo-checker
 *   Input:  { url: "https://example.com" }
 *   Fields: title, description, h1, h2, images, links, performance, seoScore
 *
 * Fallback 2: canadesk/seo-site-checkup
 *   Input:  { url: "https://example.com" }  or  { domain: "example.com" }
 *   Fields: seoScore, checks[], issues[], recommendations[]
 *
 * Purpose: Comprehensive SEO audit covering meta tags, headings, canonicals,
 *          sitemap, schema markup, load time, mobile optimization.
 *          Supplements HTML scraping with deeper technical analysis.
 *
 * Used in: seo_onpage_eeat, tracking_health (Dimensões CANAIS e CONTEÚDO)
 *
 * Cost: ~$0.02–0.05 per run
 */

import { runApifyActor } from './apifyClient';

export interface SeoAuditResult {
  found: boolean;
  seoScore: number | null;           // 0–100 overall SEO score
  hasTitle: boolean;
  titleLength: number | null;
  hasMetaDescription: boolean;
  metaDescriptionLength: number | null;
  hasH1: boolean;
  h1Count: number | null;
  hasCanonical: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  hasSchemaMarkup: boolean;
  loadTimeMs: number | null;
  mobileScore: number | null;
  brokenLinks: number | null;
  imagesWithoutAlt: number | null;
  issues: string[];
  score: number;   // 1–4
  findings: string[];
  dataSources: string[];
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function bool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') return ['true', 'yes', '1', 'found'].includes(val.toLowerCase());
  return false;
}

function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function calcScore(r: SeoAuditResult): number {
  if (r.seoScore !== null) {
    if (r.seoScore >= 80) return 4;
    if (r.seoScore >= 60) return 3;
    if (r.seoScore >= 40) return 2;
    return 1;
  }
  // Fallback scoring from individual checks
  let pts = 0;
  if (r.hasTitle) pts += 1;
  if (r.hasMetaDescription) pts += 1;
  if (r.hasH1) pts += 1;
  if (r.hasSchemaMarkup) pts += 1;
  if (r.hasSitemap) pts += 1;
  if (pts >= 4) return 3;
  if (pts >= 2) return 2;
  return 1;
}

export async function fetchSeoAudit(
  siteUrl: string,
  apifyToken: string
): Promise<SeoAuditResult> {
  const fullUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const empty: SeoAuditResult = {
    found: false,
    seoScore: null, hasTitle: false, titleLength: null,
    hasMetaDescription: false, metaDescriptionLength: null,
    hasH1: false, h1Count: null, hasCanonical: false,
    hasSitemap: false, hasRobotsTxt: false, hasSchemaMarkup: false,
    loadTimeMs: null, mobileScore: null, brokenLinks: null, imagesWithoutAlt: null,
    issues: [],
    score: 1, findings: [], dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: smart-digital/complete-seo-audit-tool
  try {
    items = await runApifyActor(
      'smart-digital/complete-seo-audit-tool',
      { url: fullUrl },
      apifyToken,
      { timeoutSecs: 120 }
    );
    if (items.length) actorUsed = 'smart-digital/complete-seo-audit-tool';
  } catch { /* fall through */ }

  // Fallback 1: louisdeconinck/seo-checker
  if (!items.length) {
    try {
      items = await runApifyActor(
        'louisdeconinck/seo-checker',
        { url: fullUrl },
        apifyToken,
        { timeoutSecs: 120 }
      );
      if (items.length) actorUsed = 'louisdeconinck/seo-checker';
    } catch { /* fall through */ }
  }

  // Fallback 2: canadesk/seo-site-checkup
  if (!items.length) {
    try {
      const domain = fullUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      items = await runApifyActor(
        'canadesk/seo-site-checkup',
        { url: fullUrl, domain },
        apifyToken,
        { timeoutSecs: 120 }
      );
      if (items.length) actorUsed = 'canadesk/seo-site-checkup';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Auditoria SEO não disponível para ${fullUrl}`],
      dataSources: ['SEO Audit via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  // Extract issues array
  const rawIssues = (d.issues ?? d.errors ?? d.warnings ?? d.checks ?? []) as unknown[];
  const issues: string[] = rawIssues
    .slice(0, 10)
    .map((i) => {
      if (typeof i === 'string') return i.trim();
      const obj = i as Record<string, unknown>;
      return str(obj.message ?? obj.description ?? obj.title ?? obj.check ?? '');
    })
    .filter(Boolean);

  const result: SeoAuditResult = {
    found: true,
    seoScore: num(d.seoScore ?? d.seo_score ?? d.score ?? d.overallScore),
    hasTitle: bool(d.hasTitle ?? d.title ?? (d.titleLength && (d.titleLength as number) > 0)),
    titleLength: num(d.titleLength ?? d.title_length),
    hasMetaDescription: bool(
      d.hasMetaDescription ?? d.metaDescription ?? d.meta_description ??
      (d.metaDescriptionLength && (d.metaDescriptionLength as number) > 0)
    ),
    metaDescriptionLength: num(d.metaDescriptionLength ?? d.meta_description_length),
    hasH1: bool(d.hasH1 ?? d.h1 ?? d.h1Count),
    h1Count: num(d.h1Count ?? d.h1_count ?? d.h1),
    hasCanonical: bool(d.hasCanonical ?? d.canonical ?? d.canonicalUrl),
    hasSitemap: bool(d.hasSitemap ?? d.sitemap ?? d.sitemapUrl),
    hasRobotsTxt: bool(d.hasRobotsTxt ?? d.robotsTxt ?? d.robots),
    hasSchemaMarkup: bool(d.hasSchemaMarkup ?? d.schemaMarkup ?? d.schema ?? d.structuredData),
    loadTimeMs: num(d.loadTimeMs ?? d.load_time ?? d.loadTime ?? d.responseTime),
    mobileScore: num(d.mobileScore ?? d.mobile_score ?? d.mobileFriendly),
    brokenLinks: num(d.brokenLinks ?? d.broken_links ?? d.errorLinks),
    imagesWithoutAlt: num(d.imagesWithoutAlt ?? d.images_without_alt ?? d.missingAlt),
    issues,
    score: 1,
    findings: [],
    dataSources: [`SEO Audit via Apify (${actorUsed})`],
  };

  if (result.seoScore !== null)
    result.findings.push(`✓ Score SEO geral: ${result.seoScore}/100`);
  if (result.hasTitle && result.titleLength)
    result.findings.push(`✓ Title tag: ${result.titleLength} caracteres`);
  else if (!result.hasTitle)
    result.findings.push('⚠️ Title tag ausente');
  if (!result.hasMetaDescription)
    result.findings.push('⚠️ Meta description ausente');
  if (result.hasSchemaMarkup)
    result.findings.push('✓ Schema Markup (dados estruturados) detectado');
  if (result.hasSitemap)
    result.findings.push('✓ Sitemap XML detectado');
  if (result.brokenLinks !== null && result.brokenLinks > 0)
    result.findings.push(`⚠️ ${result.brokenLinks} link(s) quebrado(s) detectado(s)`);
  if (result.mobileScore !== null)
    result.findings.push(`Score mobile: ${result.mobileScore}/100`);
  if (issues.length > 0)
    result.findings.push(`Principais issues: ${issues.slice(0, 2).join(' | ')}`);

  result.score = calcScore(result);
  return result;
}
