/**
 * Keyword Demand Intelligence via AnswerThePublic + fallback
 *
 * Primary actor:  deadlyaccurate/answer-the-public
 *   Input:  { keywords: string[], country: string, language: string }
 *   Output: [{ keyword, type, modifier, text, searchVolume?, cpc? }]
 *   Types:  "questions" | "prepositions" | "comparisons" | "alphabetical" | "related"
 *   Q-modifiers: how, what, why, can, are, which, will, when, where, who
 *   P-modifiers: for, is, with, to, without, near, vs
 *   C-modifiers: vs, like, and, or
 *
 * Fallback actor: nXr538ymPqrcclpen (Keyword Suggestions Scraper)
 *   Used automatically if primary actor is in maintenance / returns empty.
 *
 * Strategy per diagnostic:
 *   1. Brand name search → demand for the brand itself
 *   2. Sector keyword search → industry demand landscape
 *
 * Scoring logic:
 *   pts += 3 if totalItems >= 500, +2 if >= 200, +1 if >= 50
 *   pts += 2 if 4+ distinct types, +1 if 3+ types
 *   pts += 1 if highIntentCount >= 20 (commercial CPC signal)
 *   pts += 1 if competitorComparisons >= 3
 *   score 4 = pts >= 6 | 3 = pts >= 4 | 2 = pts >= 2 | 1 = pts < 2
 *
 * Cost (primary):  ~$0.01–0.03 per keyword
 * Cost (fallback): ~$0.005 per keyword
 * Free tier: ~150–500 keyword lookups/month within $5 budget
 */

import { runApifyActor } from './apifyClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ATPItem {
  keyword: string;
  type: string;        // questions | prepositions | comparisons | alphabetical | related
  modifier: string;   // how, what, why, for, vs, etc.
  text: string;       // full extracted phrase / question
  searchVolume?: number;
  cpc?: number;       // cost-per-click in local currency
}

export interface DemandIntelligenceResult {
  found: boolean;
  keywordsSearched: string[];
  totalItems: number;
  byType: {
    questions: ATPItem[];     // "como fazer X", "o que é X", "por que Y"
    prepositions: ATPItem[];  // "X para Z", "X com Y", "X sem W"
    comparisons: ATPItem[];   // "X vs Y", "X ou Y", "X vs concorrente"
    alphabetical: ATPItem[];  // "X a...", "X b..." (alfabético)
    related: ATPItem[];       // related searches
  };
  topQuestions: string[];         // top 10 por volume de busca
  competitorComparisons: string[]; // "brand vs X", "brand ou X"
  avgCpc: number | null;          // intenção comercial proxy
  highIntentCount: number;        // itens com CPC > 0
  totalSearchVolume: number | null;
  questionModifiers: string[];    // tipos de pergunta encontrados (how, what, why...)
  score: number;
  findings: string[];
  dataSources: string[];
  actorUsed: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive 1–2 keywords from the diagnostic input for ATP queries.
 * Brand name (up to 3 words) + simplified segment keyword.
 */
export function extractKeywordsFromInput(
  companyName: string,
  segment: string
): string[] {
  const brand = companyName.trim().split(/\s+/).slice(0, 3).join(' ');

  // Remove sub-segments (after "/" or "&") and keep 2 words max
  const seg = segment
    .replace(/\s*\/\s*.+/, '')
    .replace(/\s*&\s*.+/, '')
    .replace(/[()]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');

  const keywords: string[] = [brand];
  if (seg && seg.toLowerCase() !== brand.toLowerCase()) keywords.push(seg);
  return keywords;
}

function categorize(items: ATPItem[]): DemandIntelligenceResult['byType'] {
  const byType: DemandIntelligenceResult['byType'] = {
    questions: [], prepositions: [], comparisons: [], alphabetical: [], related: [],
  };
  for (const item of items) {
    const t = (item.type ?? '').toLowerCase();
    if (t.includes('question')) byType.questions.push(item);
    else if (t.includes('preposition')) byType.prepositions.push(item);
    else if (t.includes('comparison')) byType.comparisons.push(item);
    else if (t.includes('alpha')) byType.alphabetical.push(item);
    else byType.related.push(item);
  }
  return byType;
}

function calcScore(r: DemandIntelligenceResult): number {
  let pts = 0;
  if (r.totalItems >= 500) pts += 3;
  else if (r.totalItems >= 200) pts += 2;
  else if (r.totalItems >= 50) pts += 1;

  const activeTypes = [
    r.byType.questions.length > 0,
    r.byType.prepositions.length > 0,
    r.byType.comparisons.length > 0,
    r.byType.related.length > 0,
  ].filter(Boolean).length;

  if (activeTypes >= 4) pts += 2;
  else if (activeTypes >= 3) pts += 1;

  if (r.highIntentCount >= 20) pts += 1;
  if (r.competitorComparisons.length >= 3) pts += 1;

  if (pts >= 6) return 4;
  if (pts >= 4) return 3;
  if (pts >= 2) return 2;
  return 1;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchDemandIntelligence(
  companyName: string,
  segment: string,
  apifyToken: string,
  country = 'br',
  language = 'pt',
  competitorBrand?: string
): Promise<DemandIntelligenceResult> {
  const keywords = extractKeywordsFromInput(companyName, segment);
  // Add "brand vs competitor" as an extra keyword when competitor is known
  if (competitorBrand && competitorBrand.length >= 2) {
    const vsKw = `${keywords[0]} vs ${competitorBrand}`;
    if (!keywords.includes(vsKw)) keywords.push(vsKw);
  }

  const empty: DemandIntelligenceResult = {
    found: false,
    keywordsSearched: keywords,
    totalItems: 0,
    byType: { questions: [], prepositions: [], comparisons: [], alphabetical: [], related: [] },
    topQuestions: [],
    competitorComparisons: [],
    avgCpc: null,
    highIntentCount: 0,
    totalSearchVolume: null,
    questionModifiers: [],
    score: 1,
    findings: [],
    dataSources: [],
    actorUsed: '',
  };

  if (!apifyToken) return empty;

  // ── 1. Try primary: deadlyaccurate/answer-the-public ─────────────────────
  // Attempt multiple input formats since the actor API may vary
  let rawItems: ATPItem[] = [];
  let actorUsed = 'deadlyaccurate/answer-the-public';

  const primaryInputs = [
    { keywords, country, language },
    { keyword: keywords[0], country, language },
    { searchTerm: keywords[0], country, language },
  ];
  for (const input of primaryInputs) {
    if (rawItems.length > 0) break;
    try {
      const raw = await runApifyActor<ATPItem>(
        'deadlyaccurate/answer-the-public',
        input,
        apifyToken,
        { timeoutSecs: 150 }
      );
      rawItems = raw.filter(i => i.text && i.text.trim().length > 0);
    } catch {
      // try next format
    }
  }

  // ── 2. Fallback: nXr538ymPqrcclpen (Keyword Suggestions Scraper) ──────────
  if (!rawItems.length) {
    actorUsed = 'nXr538ymPqrcclpen';
    const fallbackInputs = [
      { keywords, country, language },
      { keyword: keywords[0], country, language },
    ];
    for (const input of fallbackInputs) {
      if (rawItems.length > 0) break;
      try {
        const raw = await runApifyActor<Record<string, unknown>>(
          'nXr538ymPqrcclpen',
          input,
          apifyToken,
          { timeoutSecs: 150 }
        );
        // Map to unified ATPItem format
        rawItems = raw
          .filter(r => r.text || r.suggestion || r.query || r.keyword)
          .map(r => ({
            keyword: String(r.keyword ?? keywords[0]),
            type: String(r.type ?? 'related'),
            modifier: String(r.modifier ?? ''),
            text: String(r.text ?? r.suggestion ?? r.query ?? ''),
            searchVolume: typeof r.searchVolume === 'number' ? r.searchVolume : undefined,
            cpc: typeof r.cpc === 'number' ? r.cpc : undefined,
          }));
      } catch {
        // try next format
      }
    }
    if (!rawItems.length) {
      return {
        ...empty,
        findings: ['⚠️ Erro ao consultar AnswerThePublic e actor de fallback via Apify'],
        dataSources: [`AnswerThePublic via Apify (erro em ambos os actors)`],
        actorUsed,
      };
    }
  }

  if (!rawItems.length) {
    return {
      ...empty,
      findings: [`⚠️ Sem dados retornados para: ${keywords.join(', ')} — tente novamente`],
      dataSources: [`AnswerThePublic via Apify (${actorUsed})`],
      actorUsed,
    };
  }

  // ── 3. Categorize ─────────────────────────────────────────────────────────
  const byType = categorize(rawItems);

  // Top 10 by search volume
  const withVol = [...rawItems].filter(i => (i.searchVolume ?? 0) > 0);
  withVol.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
  const topQuestions = withVol.slice(0, 10).map(i => i.text);

  // Competitor comparisons ("vs" or " ou " patterns in comparisons)
  const competitorComparisons = byType.comparisons
    .filter(i => /\bvs\b|\bversus\b|\b ou \b/i.test(i.text))
    .map(i => i.text)
    .slice(0, 10);

  // Unique question modifiers found
  const questionModifiers = [
    ...new Set(byType.questions.map(i => i.modifier).filter(Boolean)),
  ].slice(0, 10);

  // CPC stats (commercial intent signal)
  const withCpc = rawItems.filter(i => (i.cpc ?? 0) > 0);
  const avgCpc = withCpc.length
    ? withCpc.reduce((sum, i) => sum + (i.cpc ?? 0), 0) / withCpc.length
    : null;
  const highIntentCount = withCpc.length;

  // Total search volume
  const volItems = rawItems.filter(i => i.searchVolume != null);
  const totalSearchVolume = volItems.length
    ? volItems.reduce((sum, i) => sum + (i.searchVolume ?? 0), 0)
    : null;

  // ── 4. Build result ───────────────────────────────────────────────────────
  const result: DemandIntelligenceResult = {
    found: true,
    keywordsSearched: keywords,
    totalItems: rawItems.length,
    byType,
    topQuestions,
    competitorComparisons,
    avgCpc,
    highIntentCount,
    totalSearchVolume,
    questionModifiers,
    score: 1,
    findings: [],
    dataSources: [`AnswerThePublic via Apify (${actorUsed})`],
    actorUsed,
  };

  // ── 5. Build findings ─────────────────────────────────────────────────────
  result.findings.push(
    `✓ ${rawItems.length} termos de demanda mapeados para: ${keywords.join(' + ')}`
  );
  if (byType.questions.length > 0) {
    result.findings.push(
      `✓ ${byType.questions.length} perguntas diretas (${questionModifiers.slice(0, 5).join(', ')}...)`
    );
  }
  if (byType.prepositions.length > 0) {
    result.findings.push(`✓ ${byType.prepositions.length} variações por preposição (para, com, sem, vs...)`);
  }
  if (byType.comparisons.length > 0) {
    result.findings.push(`✓ ${byType.comparisons.length} comparações com concorrentes e alternativas`);
  }
  if (byType.related.length > 0) {
    result.findings.push(`${byType.related.length} buscas relacionadas mapeadas`);
  }
  if (topQuestions.length > 0) {
    result.findings.push(`Top pergunta: "${topQuestions[0]}"`);
  }
  if (avgCpc !== null) {
    result.findings.push(
      `Intenção comercial: ${highIntentCount} termos com CPC médio de R$ ${avgCpc.toFixed(2)}`
    );
  }
  if (totalSearchVolume !== null && totalSearchVolume > 0) {
    result.findings.push(
      `Volume de busca total estimado: ${totalSearchVolume.toLocaleString('pt-BR')} buscas/mês`
    );
  }
  if (competitorComparisons.length > 0) {
    result.findings.push(
      `Comparações detectadas: ${competitorComparisons.slice(0, 3).join(' | ')}`
    );
  }

  result.score = calcScore(result);
  return result;
}
