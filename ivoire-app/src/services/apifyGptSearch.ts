/**
 * ChatGPT brand mention check via Apify
 *
 * Actor: tri_angle/gpt-search
 *   Input:  { query: string }
 *   Fields: answer (string), sources (array of URLs cited by GPT)
 *
 * Purpose: GEO/LLMO scoring — detect whether a brand is cited by ChatGPT when
 *          a category-level question is asked. Indicates AI-era search visibility.
 *
 * Cost: ~$0.03–0.05 per query | Free tier ($5/mo): ~100–166 queries/month
 * Note: Requires OpenAI usage on Apify's end; results may vary by GPT version.
 */

import { runApifyActor } from './apifyClient';

export interface GptSearchResult {
  found: boolean;
  query: string;
  answer: string;
  brandMentioned: boolean;   // is companyName mentioned in answer?
  mentionContext?: string;   // sentence where brand was mentioned
  sources: string[];         // URLs cited by GPT
  findings: string[];
  dataSources: string[];
}

function buildQuery(_companyName: string, segment: string): string {
  // Use a category-level discovery query first; mention company for trust check
  return `quais as melhores empresas de ${segment} no Brasil?`;
}

function findMentionContext(answer: string, companyName: string): string | undefined {
  // Split by sentence and find the one containing the brand name (case-insensitive)
  const lowerAnswer = answer.toLowerCase();
  const lowerBrand = companyName.toLowerCase();

  if (!lowerAnswer.includes(lowerBrand)) return undefined;

  const sentences = answer.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(lowerBrand)) {
      return sentence.trim().slice(0, 200);
    }
  }

  // Fallback: return 150 chars around the first occurrence
  const idx = lowerAnswer.indexOf(lowerBrand);
  const start = Math.max(0, idx - 60);
  const end = Math.min(answer.length, idx + companyName.length + 90);
  return `...${answer.slice(start, end)}...`;
}

export async function fetchGptSearch(
  companyName: string,
  segment: string,
  apifyToken: string
): Promise<GptSearchResult> {
  const query = buildQuery(companyName, segment);

  const empty: GptSearchResult = {
    found: false,
    query,
    answer: '',
    brandMentioned: false,
    mentionContext: undefined,
    sources: [],
    findings: [],
    dataSources: [],
  };

  if (!apifyToken) return empty;

  let items: unknown[] = [];

  try {
    items = await runApifyActor(
      'tri_angle/gpt-search',
      { query },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch { /* fall through */ }

  if (!items.length) {
    return {
      ...empty,
      findings: [`Sem resposta do ChatGPT para a query sobre ${segment}`],
      dataSources: ['ChatGPT Search via Apify (sem dados)'],
    };
  }

  const d = items[0] as Record<string, unknown>;

  // Extract answer text — actor may use different field names
  const answer = typeof d.answer === 'string'
    ? d.answer.trim()
    : typeof d.text === 'string'
      ? d.text.trim()
      : typeof d.response === 'string'
        ? d.response.trim()
        : typeof d.content === 'string'
          ? d.content.trim()
          : '';

  // Extract sources/citations
  const rawSources = (d.sources ?? d.citations ?? d.references ?? d.urls ?? []) as unknown[];
  const sources: string[] = rawSources
    .map((s) => {
      if (typeof s === 'string') return s.trim();
      const obj = s as Record<string, unknown>;
      return typeof obj.url === 'string' ? obj.url.trim() : '';
    })
    .filter(Boolean);

  if (!answer) {
    return {
      found: true,
      query,
      answer: '',
      brandMentioned: false,
      sources,
      findings: [`ChatGPT respondeu mas sem conteúdo legível para "${query}"`],
      dataSources: ['ChatGPT Search via Apify (tri_angle/gpt-search)'],
    };
  }

  // Check if brand is mentioned (case-insensitive)
  const brandMentioned = answer.toLowerCase().includes(companyName.toLowerCase());
  const mentionContext = findMentionContext(answer, companyName);

  // Build findings
  const findings: string[] = [];

  findings.push(`ChatGPT consultado: "${query}"`);

  if (brandMentioned) {
    findings.push(`${companyName} é mencionado pelo ChatGPT como referência em ${segment}`);
    if (mentionContext) {
      findings.push(`Contexto: "${mentionContext}"`);
    }
  } else {
    findings.push(`${companyName} NÃO foi mencionado pelo ChatGPT para queries de ${segment}`);
  }

  if (sources.length) {
    findings.push(`${sources.length} fonte(s) citada(s) pelo ChatGPT: ${sources.slice(0, 3).join(', ')}`);
  }

  return {
    found: true,
    query,
    answer,
    brandMentioned,
    mentionContext,
    sources,
    findings,
    dataSources: ['ChatGPT Search via Apify (tri_angle/gpt-search)'],
  };
}
