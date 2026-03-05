import type { Diagnostic, DimensionKey } from '../../types';
import { DIMENSION_CONFIG } from '../../data/scorecard';

// Generates a CSV-based spreadsheet (renamed .xlsx for usability) with comprehensive audit data
export async function exportToXLSX(diagnostic: Diagnostic): Promise<void> {
  const { input, overallScore, overallLevel, dimensionScores, subdimensionScores, insights, recommendations } = diagnostic;

  const rows: string[][] = [];

  // ── HEADER ──────────────────────────────────────────────────────────────────
  rows.push(['IVOIRE GROWTH SCAN — AUDITORIA COMPLETA']);
  rows.push(['Empresa', input.companyName]);
  rows.push(['URL', input.siteUrl]);
  rows.push(['Segmento', input.segment]);
  rows.push(['E-commerce', input.isEcommerce ? 'Sim' : 'Não']);
  rows.push(['Data', new Date().toLocaleDateString('pt-BR')]);
  rows.push(['Score Geral', overallScore?.toFixed(2) ?? '–']);
  rows.push(['Nível Geral', overallLevel ?? '–']);
  rows.push([]);

  // ── SCORECARD POR DIMENSÃO ───────────────────────────────────────────────────
  rows.push(['=== SCORECARD POR DIMENSÃO ===']);
  rows.push(['Dimensão', 'Score', 'Nível', 'Subdimensões Avaliadas', 'Subdimensões Skipped']);

  const dimensionOrder: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

  for (const dimKey of dimensionOrder) {
    const dim = dimensionScores?.find((d) => d.key === dimKey);
    const cfg = DIMENSION_CONFIG[dimKey];
    const evaluated = dim?.subdimensions.filter((s) => s.source !== 'skipped').length ?? 0;
    const skipped = dim?.subdimensions.filter((s) => s.source === 'skipped').length ?? 0;
    rows.push([cfg.name, dim?.score?.toFixed(2) ?? '–', dim?.level ?? '–', String(evaluated), String(skipped)]);
  }

  rows.push([]);

  // ── SUBDIMENSÕES DETALHADAS ──────────────────────────────────────────────────
  rows.push(['=== SUBDIMENSÕES — ANÁLISE DETALHADA ===']);
  rows.push([
    'Dimensão', 'Subdimensão', 'Score', 'Nível', 'Fonte de Dados',
    'Status de Coleta', 'Condicional (E-comm)', 'Notas',
  ]);

  for (const s of subdimensionScores) {
    const dimCfg = DIMENSION_CONFIG[s.dimension];
    const sourceLabel: Record<string, string> = {
      auto: 'Automático', manual: 'Manual', insufficient: 'Dados Insuficientes', skipped: 'Ignorado',
    };
    rows.push([
      dimCfg.name,
      s.name,
      s.score.toFixed(2),
      s.level,
      sourceLabel[s.source] ?? s.source,
      s.collectionStatus,
      s.isConditional ? 'Sim' : 'Não',
      s.notes ?? '',
    ]);
  }

  rows.push([]);

  // ── DADOS BRUTOS POR SUBDIMENSÃO ─────────────────────────────────────────────
  rows.push(['=== DADOS COLETADOS POR SUBDIMENSÃO ===']);

  for (const s of subdimensionScores.filter((x) => x.source !== 'skipped')) {
    rows.push([`--- ${s.name} (${s.level} — ${s.score}/4) ---`]);
    if (s.rawData && Object.keys(s.rawData).length > 0) {
      for (const [key, value] of Object.entries(s.rawData)) {
        if (['mobile', 'desktop', 'tech'].includes(key)) {
          // Flatten nested objects
          if (typeof value === 'object' && value !== null) {
            for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
              const formatted = typeof subVal === 'boolean'
                ? (subVal ? 'Sim' : 'Não')
                : Array.isArray(subVal)
                ? (subVal as unknown[]).filter(Boolean).join('; ')
                : String(subVal ?? '');
              rows.push(['', `${key}.${subKey}`, formatted]);
            }
          }
        } else {
          const formatted = typeof value === 'boolean'
            ? (value ? 'Sim' : 'Não')
            : Array.isArray(value)
            ? (value as unknown[]).filter(Boolean).join('; ')
            : String(value ?? '');
          rows.push(['', key, formatted]);
        }
      }
    } else {
      rows.push(['', '(sem dados coletados)', '']);
    }
    rows.push([]);
  }

  // ── INSIGHTS ─────────────────────────────────────────────────────────────────
  rows.push(['=== INSIGHTS ESTRATÉGICOS ===']);
  rows.push(['Tipo', 'Dimensão', 'Título', 'Descrição', 'Prioridade', 'Impacto Estimado']);

  const typeLabels: Record<string, string> = {
    gap_critico: 'Gap Crítico', alavanca: 'Alavanca', erosao_funil: 'Erosão de Funil', oportunidade: 'Oportunidade',
  };

  for (const ins of insights ?? []) {
    rows.push([
      typeLabels[ins.type] ?? ins.type,
      DIMENSION_CONFIG[ins.dimension]?.name ?? ins.dimension,
      ins.title,
      ins.description,
      ins.priority.toUpperCase(),
      ins.impactEstimate,
    ]);
  }

  rows.push([]);

  // ── RECOMENDAÇÕES ────────────────────────────────────────────────────────────
  rows.push(['=== RECOMENDAÇÕES PRIORIZADAS ===']);
  rows.push(['Prioridade', 'Título', 'Dimensão', 'Esforço', 'Prazo', 'O Que Fazer', 'Por Quê', 'Impacto Esperado']);

  const timeframeLabels: Record<string, string> = {
    imediato: 'Imediato (0–30 dias)', curto_prazo: 'Curto Prazo (1–3 meses)', medio_prazo: 'Médio Prazo (3–6 meses)',
  };

  for (const rec of recommendations ?? []) {
    rows.push([
      String(rec.priority),
      rec.title,
      DIMENSION_CONFIG[rec.dimension as DimensionKey]?.name ?? rec.dimension,
      rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1),
      timeframeLabels[rec.timeframe] ?? rec.timeframe,
      rec.what,
      rec.why,
      rec.expectedImpact,
    ]);
  }

  // ── CONVERT TO CSV ────────────────────────────────────────────────────────────
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          // Escape cells that contain commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  // BOM for UTF-8 Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IvoireGrowthScan_Auditoria_${input.companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
