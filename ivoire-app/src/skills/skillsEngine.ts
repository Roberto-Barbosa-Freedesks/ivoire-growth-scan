/**
 * Skills Engine — applies LLM-based skill analysis per subdimension × segment
 * Uses Claude Haiku for fast, cheap analysis (~$0.001/skill call)
 * Falls back to null (no Skills enrichment) if claudeApiKey not configured
 */

import type { DiagnosticInput } from '../types';
import type { SkillResult } from './types';
import { SKILLS_REGISTRY } from './skillsRegistry';
import { getSegmentKey, SEGMENT_LABELS } from './segmentConfig';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export async function applySkill(
  subdimensionId: string,
  rawData: Record<string, unknown>,
  score: number,
  input: DiagnosticInput,
  claudeApiKey: string
): Promise<SkillResult | null> {
  if (!claudeApiKey) return null;

  const skillDef = SKILLS_REGISTRY.find((s) => s.subdimensionId === subdimensionId);
  if (!skillDef) return null;

  const segKey = getSegmentKey(input.segment);
  const segLabel = SEGMENT_LABELS[segKey];

  const contextBlock = skillDef.contextBuilder(rawData, input, score);

  const systemPrompt = skillDef.systemPromptTemplate
    .replace('{{PERSONA}}', skillDef.expertPersona)
    .replace(/\{\{SEGMENT\}\}/g, segLabel)
    .replace(/\{\{COMPANY\}\}/g, input.companyName)
    .replace(/\{\{SCORE\}\}/g, String(score));

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Dados coletados:\n${contextBlock}` }],
      }),
    });

    if (!res.ok) {
      console.warn(`[skillsEngine] Claude API error for ${subdimensionId}:`, res.status);
      return null;
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
    };

    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';

    // Strip markdown code fences if present (some models add them despite instructions)
    const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(cleanText) as {
      findings?: string[];
      insights?: string[];
      recommendations?: Array<{
        title?: string;
        what?: string;
        why?: string;
        effort?: string;
        timeframe?: string;
      }>;
      segmentBenchmark?: { label?: string; percentile?: number };
    };

    return {
      subdimensionId,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r) => ({
            title: r.title ?? '',
            what: r.what ?? '',
            why: r.why ?? '',
            effort: (
              ['baixo', 'medio', 'alto'].includes(r.effort ?? '')
                ? r.effort
                : 'medio'
            ) as 'baixo' | 'medio' | 'alto',
            timeframe: (
              ['imediato', 'curto_prazo', 'medio_prazo'].includes(r.timeframe ?? '')
                ? r.timeframe
                : 'curto_prazo'
            ) as 'imediato' | 'curto_prazo' | 'medio_prazo',
          }))
        : [],
      segmentBenchmark: parsed.segmentBenchmark
        ? {
            label: parsed.segmentBenchmark.label ?? '',
            percentile: parsed.segmentBenchmark.percentile,
          }
        : undefined,
      model: MODEL,
      llmUsed: true,
    };
  } catch (err) {
    console.warn(`[skillsEngine] Failed to apply skill for ${subdimensionId}:`, err);
    return null;
  }
}

export async function applyAllSkills(
  subdimensionScores: Array<{
    subdimensionId: string;
    rawData: Record<string, unknown>;
    score: number;
  }>,
  input: DiagnosticInput,
  claudeApiKey: string
): Promise<Map<string, SkillResult>> {
  const results = new Map<string, SkillResult>();
  if (!claudeApiKey) return results;

  // Apply skills in parallel batches (max 5 concurrent to avoid rate limits)
  const CONCURRENCY = 5;
  for (let i = 0; i < subdimensionScores.length; i += CONCURRENCY) {
    const batch = subdimensionScores.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((s) => applySkill(s.subdimensionId, s.rawData, s.score, input, claudeApiKey))
    );
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[idx].subdimensionId, result.value);
      }
    });
  }

  return results;
}
