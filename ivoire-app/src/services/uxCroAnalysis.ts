/**
 * UX/UI & CRO Analysis
 * Real data from: Google PageSpeed Insights (accessibility, mobile score) + HTML scraping.
 * No estimates — all findings based on actual measurements.
 */

import type { ScrapedPageData } from './htmlScraper';
import type { TechDetectionResult } from './pagespeed';

// PageSpeedData-compatible interface (subset needed here)
export interface PerfData {
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  mobileScore: number;
  desktopScore: number;
}

export interface UxCroResult {
  score: number; // 1–4
  accessibilityScore: number;
  mobileScore: number;
  bestPracticesScore: number;
  hasWhatsApp: boolean;
  hasWhatsAppBusiness: boolean;
  hasChatbot: boolean;
  chatbotPlatforms: string[];
  ctaCount: number;
  formFieldCount: number;
  formComplexity: 'baixa' | 'média' | 'alta' | 'não detectada';
  hasNlpSearch: boolean;
  nlpSearchPlatforms: string[];
  hasLiveChat: boolean;
  isMobileResponsive: boolean;
  findings: string[];
}

export function analyzeUxCro(
  scraped: ScrapedPageData | null,
  mobile: PerfData,
  desktop: PerfData,
  tech?: TechDetectionResult
): UxCroResult {
  const findings: string[] = [];

  // ── Accessibility (PageSpeed — always real) ────────────────────────────
  const accessibilityScore = Math.max(mobile.accessibilityScore, desktop.accessibilityScore);
  const mobileScore = mobile.mobileScore;
  const bestPracticesScore = Math.max(mobile.bestPracticesScore, desktop.bestPracticesScore);

  if (accessibilityScore >= 90) findings.push(`✓ Acessibilidade: ${accessibilityScore}/100 (excelente)`);
  else if (accessibilityScore >= 70) findings.push(`⚠️ Acessibilidade: ${accessibilityScore}/100 (melhorável)`);
  else findings.push(`❌ Acessibilidade: ${accessibilityScore}/100 (crítico)`);

  if (mobileScore >= 75) findings.push(`✓ Performance Mobile: ${mobileScore}/100`);
  else if (mobileScore >= 50) findings.push(`⚠️ Performance Mobile: ${mobileScore}/100 (melhorável)`);
  else findings.push(`❌ Performance Mobile: ${mobileScore}/100 (crítico)`);

  const isMobileResponsive = mobileScore >= 40; // PageSpeed doesn't test responsiveness directly, but low score = issues

  // ── Chatbot / Live Chat ─────────────────────────────────────────────────
  // From PageSpeed tech detection
  const chatbotPlatforms: string[] = [];
  if (tech?.intercomInstalled) chatbotPlatforms.push('Intercom');
  if (tech?.hubspotInstalled) chatbotPlatforms.push('HubSpot Chat');

  // From HTML scraping
  if (scraped?.aiChatPlatforms && scraped.aiChatPlatforms.length > 0) {
    for (const p of scraped.aiChatPlatforms) {
      if (!chatbotPlatforms.includes(p)) chatbotPlatforms.push(p);
    }
  }

  const hasChatbot = chatbotPlatforms.length > 0;
  const hasLiveChat = hasChatbot;

  if (hasChatbot) findings.push(`✓ Chat/Chatbot: ${chatbotPlatforms.join(', ')}`);
  else findings.push('⚠️ Sem chatbot ou live chat identificado');

  // ── WhatsApp ───────────────────────────────────────────────────────────
  const hasWhatsApp = scraped?.hasWhatsAppLink ?? false;
  const hasWhatsAppBusiness = scraped?.hasWAMeLink ?? false;
  if (hasWhatsAppBusiness) findings.push('✓ WhatsApp Business (wa.me link) detectado');
  else if (hasWhatsApp) findings.push('✓ Link WhatsApp detectado');
  else findings.push('⚠️ WhatsApp não identificado no site');

  // ── CTAs ────────────────────────────────────────────────────────────────
  const ctaCount = scraped?.ctaKeywordsFound.length ?? 0;
  if (ctaCount >= 5) findings.push(`✓ ${ctaCount} CTAs identificados (boa cobertura)`);
  else if (ctaCount >= 2) findings.push(`⚠️ ${ctaCount} CTA(s) identificado(s) — pode melhorar`);
  else findings.push('❌ CTAs não identificados claramente no conteúdo');

  // ── Forms ─────────────────────────────────────────────────────────────
  const formFieldCount = scraped?.formFieldCount ?? 0;
  let formComplexity: UxCroResult['formComplexity'] = 'não detectada';
  if (formFieldCount > 0) {
    if (formFieldCount > 8) formComplexity = 'alta';
    else if (formFieldCount > 3) formComplexity = 'média';
    else formComplexity = 'baixa';
    findings.push(`Formulários: ${formFieldCount} campo(s) detectado(s) — complexidade ${formComplexity}`);
  } else {
    findings.push('Formulários: nenhum campo detectado na homepage');
  }

  // ── NLP / Busca Avançada ─────────────────────────────────────────────
  const hasNlpSearch = scraped?.hasNlpSearchIndicators ?? false;
  const nlpSearchPlatforms = scraped?.nlpSearchPlatforms ?? [];
  if (hasNlpSearch) findings.push(`✓ Busca inteligente/NLP: ${nlpSearchPlatforms.join(', ')}`);

  // ── Score ─────────────────────────────────────────────────────────────
  let points = 0;

  // Accessibility weight: 0–2 pts
  if (accessibilityScore >= 90) points += 2;
  else if (accessibilityScore >= 75) points += 1;

  // Mobile performance weight: 0–2 pts
  if (mobileScore >= 75) points += 2;
  else if (mobileScore >= 50) points += 1;

  // WhatsApp/Chat: 0–2 pts
  if (hasWhatsAppBusiness) points += 1;
  else if (hasWhatsApp) points += 0.5;
  if (hasChatbot) points += 1;

  // CTAs: 0–1 pt
  if (ctaCount >= 3) points += 1;
  else if (ctaCount >= 1) points += 0.5;

  // Form complexity (low is good for conversion): 0–1 pt
  if (formComplexity === 'baixa' || formComplexity === 'não detectada') points += 1;
  else if (formComplexity === 'média') points += 0.5;

  // NLP search: 0–1 pt
  if (hasNlpSearch) points += 1;

  // CRO signals (D1): social proof, trust, urgency
  if (scraped?.hasSocialProof) {
    points += 1;
    findings.push('✓ Social proof detectado (avaliações, depoimentos, contadores)');
  }
  if (scraped?.hasTrustSignals) {
    points += 1;
    findings.push('✓ Trust signals detectados (garantia, segurança, frete grátis)');
  }
  if (scraped?.hasUrgencySignals) {
    points += 0.5;
    findings.push('✓ Gatilho de urgência/escassez detectado');
  }
  if (scraped?.hasStickyCtaEl) {
    findings.push('✓ CTA fixo/sticky detectado (alta visibilidade)');
  }

  let score = 1;
  if (points >= 10) score = 4;
  else if (points >= 7) score = 3;
  else if (points >= 3.5) score = 2;

  return {
    score,
    accessibilityScore,
    mobileScore,
    bestPracticesScore,
    hasWhatsApp,
    hasWhatsAppBusiness,
    hasChatbot,
    chatbotPlatforms,
    ctaCount,
    formFieldCount,
    formComplexity,
    hasNlpSearch,
    nlpSearchPlatforms,
    hasLiveChat,
    isMobileResponsive,
    findings,
  };
}
