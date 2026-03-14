/**
 * AI Brand Visibility — checks if a brand is mentioned in LLM-generated search results
 *
 * Primary:  adityalingwal/AI-brand-Visibility
 *   Input:  {
 *     myBrand: companyName,
 *     category: industry (e.g. "e-commerce", "software", "saúde"),
 *     searchQuery: "melhor empresa de [categoria] no Brasil",
 *     platforms: ["chatgpt", "perplexity", "gemini"],  // lowercase!
 *     prompts: ["Qual a melhor [categoria] no Brasil?", "..."]
 *   }
 *   Fields: brandMentioned, platforms[], mentions[], overallScore
 *
 * Fallback: lexis-solutions/google-ai-scraper
 *   Input:  { query: "melhor [categoria] no Brasil", country: "BR" }
 *   Fields: aiOverview, aiAnswer, organicResults
 *
 * Purpose: Measures "GEO" (Generative Engine Optimization) — whether a brand appears
 *          in AI-generated answers on ChatGPT, Perplexity, Gemini. Key metric for
 *          "Semântica & GEO" and "Inteligência de Demanda" subdimensions.
 *
 * Used in: semantica_geo, inteligencia_demanda
 *
 * Cost: ~$0.05–0.20 per run (multiple LLM queries) | Use selectively
 */

import { runApifyActor } from './apifyClient';

export interface AIBrandVisibilityResult {
  found: boolean;
  brandMentioned: boolean;
  platforms: Array<{
    name: string;        // "chatgpt", "perplexity", "gemini"
    mentioned: boolean;
    context: string;     // excerpt where brand appears
    position: number | null;  // position in response (1 = first mention)
  }>;
  totalMentions: number;
  aiOverviewText: string | null;   // from Google AI Overview (lexis fallback)
  aiOverviewMentionsBrand: boolean;
  score: number;         // 1–4
  findings: string[];
  dataSources: string[];
}

function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function buildPrompts(_companyName: string, category: string): string[] {
  return [
    `Qual a melhor empresa de ${category} no Brasil?`,
    `Quais são as principais empresas de ${category} no Brasil?`,
    `Me indique uma empresa de ${category} confiável no Brasil`,
  ];
}

function buildCategory(segment: string): string {
  const map: Record<string, string> = {
    varejo_ecommerce: 'e-commerce',
    saas_b2b_tecnologia: 'software B2B',
    educacao: 'educação online',
    saude_bemestar: 'saúde e bem-estar',
    financeiro_fintech: 'fintech',
    hospitalidade_turismo: 'turismo',
    industria_manufatura: 'manufatura',
    servicos_profissionais: 'serviços profissionais',
    imobiliario: 'imobiliário',
    alimentacao_restaurantes: 'alimentação',
    moda_lifestyle: 'moda',
    agronegocio: 'agronegócio',
    outros: 'negócios',
  };
  for (const [key, val] of Object.entries(map)) {
    if (segment.toLowerCase().includes(key.replace(/_/g, '_'))) return val;
  }
  return segment.replace(/_/g, ' ');
}

export async function fetchAIBrandVisibility(
  companyName: string,
  segment: string,
  apifyToken: string
): Promise<AIBrandVisibilityResult> {
  const empty: AIBrandVisibilityResult = {
    found: false,
    brandMentioned: false,
    platforms: [],
    totalMentions: 0,
    aiOverviewText: null,
    aiOverviewMentionsBrand: false,
    score: 1,
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  const category = buildCategory(segment);
  const prompts = buildPrompts(companyName, category);
  const searchQuery = `melhor empresa de ${category} no Brasil`;

  let items: unknown[] = [];
  let actorUsed = '';

  // Primary: adityalingwal/AI-brand-Visibility
  try {
    items = await runApifyActor(
      'adityalingwal/AI-brand-Visibility',
      {
        myBrand: companyName,
        category,
        searchQuery,
        platforms: ['chatgpt', 'perplexity', 'gemini'],
        prompts,
      },
      apifyToken,
      { timeoutSecs: 180 }
    );
    if (items.length) actorUsed = 'adityalingwal/AI-brand-Visibility';
  } catch { /* fall through */ }

  // Fallback: lexis-solutions/google-ai-scraper
  if (!items.length) {
    try {
      items = await runApifyActor(
        'lexis-solutions/google-ai-scraper',
        {
          query: searchQuery,
          country: 'BR',
          language: 'pt',
        },
        apifyToken,
        { timeoutSecs: 90 }
      );
      if (items.length) actorUsed = 'lexis-solutions/google-ai-scraper';
    } catch { /* give up */ }
  }

  if (!items.length) {
    return {
      ...empty,
      findings: [`⚠️ Visibilidade em IA não disponível para "${companyName}" — configure apifyToken`],
      dataSources: ['AI Brand Visibility via Apify (sem dados)'],
    };
  }

  const brandLower = companyName.toLowerCase();
  const platforms: AIBrandVisibilityResult['platforms'] = [];
  let totalMentions = 0;
  let aiOverviewText: string | null = null;
  let aiOverviewMentionsBrand = false;

  if (actorUsed === 'adityalingwal/AI-brand-Visibility') {
    for (const item of items) {
      const d = item as Record<string, unknown>;
      const platformName = str(d.platform ?? d.name ?? d.source ?? 'unknown').toLowerCase();
      const response = str(d.response ?? d.answer ?? d.text ?? d.content ?? '');
      const mentioned = response.toLowerCase().includes(brandLower);
      if (mentioned) totalMentions++;

      // Find position of first mention
      let position: number | null = null;
      if (mentioned) {
        const paragraphs = response.split('\n').filter(Boolean);
        for (let i = 0; i < paragraphs.length; i++) {
          if (paragraphs[i].toLowerCase().includes(brandLower)) {
            position = i + 1;
            break;
          }
        }
      }

      const contextStart = response.toLowerCase().indexOf(brandLower);
      const context = contextStart >= 0
        ? response.slice(Math.max(0, contextStart - 40), contextStart + 120)
        : '';

      platforms.push({ name: platformName, mentioned, context, position });
    }
  } else if (actorUsed === 'lexis-solutions/google-ai-scraper') {
    // This actor returns Google AI Overview data
    const d = items[0] as Record<string, unknown>;
    aiOverviewText = str(d.aiOverview ?? d.ai_overview ?? d.aiAnswer ?? d.answer ?? '');
    if (aiOverviewText) {
      aiOverviewMentionsBrand = aiOverviewText.toLowerCase().includes(brandLower);
      if (aiOverviewMentionsBrand) totalMentions++;
      platforms.push({
        name: 'google-ai-overview',
        mentioned: aiOverviewMentionsBrand,
        context: aiOverviewMentionsBrand
          ? aiOverviewText.slice(0, 200)
          : '',
        position: null,
      });
    }
  }

  const brandMentioned = totalMentions > 0;

  const result: AIBrandVisibilityResult = {
    found: true,
    brandMentioned,
    platforms,
    totalMentions,
    aiOverviewText,
    aiOverviewMentionsBrand,
    score: 1,
    findings: [],
    dataSources: [`AI Brand Visibility via Apify (${actorUsed})`],
  };

  if (brandMentioned) {
    result.findings.push(
      `✓ "${companyName}" mencionado em ${totalMentions} resultado(s) de IA`
    );
    const mentionedPlatforms = platforms
      .filter((p) => p.mentioned)
      .map((p) => p.name)
      .join(', ');
    if (mentionedPlatforms) result.findings.push(`Plataformas com menção: ${mentionedPlatforms}`);
  } else {
    result.findings.push(
      `⚠️ "${companyName}" não encontrado em resultados de IA para "${category}"`
    );
    result.findings.push('Oportunidade: fortalecer presença GEO via conteúdo estruturado e FAQ markup.');
  }

  if (aiOverviewText && !aiOverviewMentionsBrand) {
    result.findings.push('Google AI Overview presente mas sem menção à marca.');
  }

  // Score: 4 = mentioned in 3+ platforms, 3 = 2 platforms, 2 = 1 platform, 1 = not mentioned
  result.score = totalMentions >= 3 ? 4 : totalMentions >= 2 ? 3 : totalMentions >= 1 ? 2 : 1;

  return result;
}
