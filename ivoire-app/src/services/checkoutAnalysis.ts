/**
 * Jornada de Checkout — análise via Claude API (Anthropic)
 *
 * Usa claude-haiku-4-5-20251001 (rápido, barato ~$0.001/diagnóstico).
 * A API Anthropic suporta chamadas browser-side com CORS.
 *
 * A chave é fornecida pelo usuário via Configurações e persiste em
 * localStorage — nunca exposta no bundle.
 *
 * Fallback: se claudeApiKey não configurado, retorna análise estática.
 */

import type { ScrapedPageData } from './htmlScraper';
import type { TechDetectionResult } from './pagespeed';

export interface CheckoutAnalysisResult {
  score: number; // 1–4
  findings: string[];
  recommendations: string[];
  llmUsed: boolean;
  dataSources: string[];
}

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

function buildPrompt(
  scraped: ScrapedPageData,
  tech: TechDetectionResult | undefined,
  ecommercePlatform: string | null,
  siteUrl: string
): string {
  const lines: string[] = [
    `URL analisada: ${siteUrl}`,
    `Plataforma e-commerce detectada: ${ecommercePlatform ?? 'desconhecida'}`,
    `Métodos de pagamento encontrados no HTML: ${scraped.paymentMethods.join(', ') || 'nenhum identificado'}`,
    `Campos de formulário na homepage: ${scraped.formFieldCount}`,
    `CTAs encontrados: ${scraped.ctaKeywordsFound.join(', ') || 'nenhum'}`,
    `WhatsApp presente: ${scraped.hasWhatsAppLink || scraped.hasWAMeLink ? 'sim' : 'não'}`,
    `Chat/Chatbot detectado: ${scraped.aiChatPlatforms?.join(', ') || 'não'}`,
    `Social proof: ${scraped.hasSocialProof ? 'sim' : 'não'}`,
    `Trust signals: ${scraped.hasTrustSignals ? 'sim' : 'não'}`,
    `Urgência/escassez: ${scraped.hasUrgencySignals ? 'sim' : 'não'}`,
    `CTA sticky/fixo: ${scraped.hasStickyCtaEl ? 'sim' : 'não'}`,
    `GTM instalado: ${tech?.gtmInstalled ? 'sim' : 'não'}`,
    `GA4 instalado: ${tech?.ga4Installed ? 'sim' : 'não'}`,
    `Meta Pixel instalado: ${tech?.metaPixel ? 'sim' : 'não'}`,
    `Total de 3rd parties: ${tech?.totalThirdParties ?? 0}`,
  ];

  return lines.join('\n');
}

export async function analyzeCheckoutWithClaude(
  scraped: ScrapedPageData,
  tech: TechDetectionResult | undefined,
  ecommercePlatform: string | null,
  siteUrl: string,
  claudeApiKey: string
): Promise<CheckoutAnalysisResult> {
  const staticFallback = analyzeCheckoutStatic(scraped, tech, ecommercePlatform);

  if (!claudeApiKey) return staticFallback;

  const contextBlock = buildPrompt(scraped, tech, ecommercePlatform, siteUrl);

  const systemPrompt = `Você é um especialista sênior em UX, CRO e e-commerce brasileiro.
Analise os dados técnicos coletados automaticamente de um site e-commerce e forneça:
1. Uma nota de maturidade de 1 a 4 para a Jornada de Checkout (1=Intuitivo, 2=Reativo, 3=Ativo, 4=Exponencial)
2. Até 6 findings objetivos sobre o estado atual do checkout (português, conciso)
3. Até 4 recomendações práticas e priorizadas (português)

Responda SOMENTE em JSON válido com este formato exato:
{"score": 2, "findings": ["...", "..."], "recommendations": ["...", "..."]}

Não inclua markdown, não inclua explicações fora do JSON.`;

  const userMessage = `Dados coletados do site:\n${contextBlock}`;

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[checkoutAnalysis] Claude API error:', res.status, errText);
      return staticFallback;
    }

    const json = await res.json() as {
      content?: Array<{ type: string; text: string }>;
    };

    const text = json.content?.find(c => c.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text) as {
      score?: number;
      findings?: string[];
      recommendations?: string[];
    };

    const score = Math.min(4, Math.max(1, Math.round(parsed.score ?? staticFallback.score)));
    const findings = Array.isArray(parsed.findings) ? parsed.findings : staticFallback.findings;
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : staticFallback.recommendations;

    return {
      score,
      findings,
      recommendations,
      llmUsed: true,
      dataSources: [`Claude Haiku (${MODEL}) — análise de checkout`],
    };
  } catch (err) {
    console.warn('[checkoutAnalysis] Fallback to static analysis:', err);
    return staticFallback;
  }
}

function analyzeCheckoutStatic(
  scraped: ScrapedPageData,
  tech: TechDetectionResult | undefined,
  ecommercePlatform: string | null
): CheckoutAnalysisResult {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let pts = 0;

  if (ecommercePlatform) {
    findings.push(`✓ Plataforma e-commerce: ${ecommercePlatform}`);
    pts += 1;
  } else {
    findings.push('Plataforma e-commerce não identificada automaticamente');
  }

  const methods = scraped.paymentMethods ?? [];
  if (methods.length > 0) {
    findings.push(`✓ Métodos de pagamento: ${methods.join(', ')}`);
    pts += methods.length >= 3 ? 2 : 1;
  } else {
    findings.push('⚠️ Métodos de pagamento não detectados na homepage');
    recommendations.push('Exiba os métodos de pagamento aceitos na homepage (PIX, cartão, parcelamento)');
  }

  if (scraped.hasSocialProof) {
    findings.push('✓ Social proof presente (avaliações/depoimentos)');
    pts += 1;
  } else {
    recommendations.push('Adicione avaliações de clientes e prova social ao checkout');
  }

  if (scraped.hasTrustSignals) {
    findings.push('✓ Trust signals detectados (garantia/segurança)');
    pts += 1;
  } else {
    recommendations.push('Adicione selos de segurança e garantia de satisfação próximos ao botão de compra');
  }

  if (scraped.hasUrgencySignals) {
    findings.push('✓ Gatilho de urgência/escassez detectado');
    pts += 0.5;
  }

  if (tech?.ga4Installed) {
    findings.push('✓ GA4 instalado — rastreamento de conversão disponível');
    pts += 1;
  } else {
    recommendations.push('Instale o GA4 com eventos de checkout para rastrear funil de conversão');
  }

  const score = pts >= 5 ? 4 : pts >= 3 ? 3 : pts >= 1.5 ? 2 : 1;

  return {
    score,
    findings,
    recommendations,
    llmUsed: false,
    dataSources: ['Análise estática HTML + PageSpeed (sem chave Claude)'],
  };
}
