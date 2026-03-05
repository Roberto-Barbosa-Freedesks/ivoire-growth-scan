import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  PageBreak,
  NumberFormat,
  convertInchesToTwip,
  Header,
  Footer,
  TabStopPosition,
  TabStopType,
} from 'docx';
import type { Diagnostic, DimensionKey, SubdimensionScore } from '../../types';
import { DIMENSION_CONFIG, SUBDIMENSIONS } from '../../data/scorecard';

// ── TYPOGRAPHY HELPERS ───────────────────────────────────────────────────────

function coverTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 72, font: 'Calibri' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  });
}

function coverSubtitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 28, font: 'Calibri', color: '595959' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 40, font: 'Calibri', color: '1F3864' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F3864' } },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, font: 'Calibri', color: '2E5496' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri', color: '404040' })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '404040' })],
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function bodyBold(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ': ', bold: true, size: 22, font: 'Calibri', color: '1F3864' }),
      new TextRun({ text: value, size: 22, font: 'Calibri', color: '404040' }),
    ],
    spacing: { after: 100 },
  });
}

function bulletPoint(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '404040' })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function note(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, font: 'Calibri', color: '808080', italics: true })],
    spacing: { after: 100 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function spacer(size = 160): Paragraph {
  return new Paragraph({ children: [], spacing: { after: size } });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function hr(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
    children: [],
    spacing: { before: 200, after: 200 },
  });
}

// ── SCORE/LEVEL HELPERS ──────────────────────────────────────────────────────

function levelLabel(level: string): string {
  const map: Record<string, string> = {
    Intuitivo: 'Intuitivo (Score 1.0–1.74)',
    Reativo: 'Reativo (Score 1.75–2.49)',
    Ativo: 'Ativo (Score 2.50–3.24)',
    Exponencial: 'Exponencial (Score 3.25–4.0)',
  };
  return map[level] ?? level;
}

function scoreBars(score: number): string {
  const filled = Math.round(score);
  return '■'.repeat(filled) + '□'.repeat(4 - filled) + ` (${score.toFixed(1)}/4.0)`;
}

function formatRaw(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) { const f = (value as unknown[]).filter(Boolean); return f.length > 0 ? f.join(', ') : 'N/A'; }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// ── TABLES ───────────────────────────────────────────────────────────────────

function scorecardTable(dimensionScores: NonNullable<Diagnostic['dimensionScores']>): Table {
  const headerCells = ['DIMENSÃO', 'SCORE', 'NÍVEL', 'STATUS'].map(
    (label) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })] })],
        shading: { type: ShadingType.SOLID, color: '1F3864' },
        margins: { top: convertInchesToTwip(0.05), bottom: convertInchesToTwip(0.05), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
      })
  );

  const dataRows = dimensionScores.map((dim) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: dim.name, bold: true, size: 22, font: 'Calibri', color: '1F3864' })] })],
          margins: { top: convertInchesToTwip(0.05), bottom: convertInchesToTwip(0.05), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: dim.score.toFixed(2) + ' / 4.0', bold: true, size: 22, font: 'Calibri' })] })],
          margins: { top: convertInchesToTwip(0.05), bottom: convertInchesToTwip(0.05), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: dim.level, size: 22, font: 'Calibri', bold: true })] })],
          margins: { top: convertInchesToTwip(0.05), bottom: convertInchesToTwip(0.05), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: scoreBars(dim.score), size: 20, font: 'Courier New' })] })],
          margins: { top: convertInchesToTwip(0.05), bottom: convertInchesToTwip(0.05), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
        }),
      ],
    })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function subdimTable(scores: SubdimensionScore[]): Table {
  const headerCells = ['SUBDIMENSÃO', 'SCORE', 'NÍVEL', 'FONTE'].map(
    (label) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: 'Calibri', color: 'FFFFFF' })] })],
        shading: { type: ShadingType.SOLID, color: '2E5496' },
        margins: { top: convertInchesToTwip(0.04), bottom: convertInchesToTwip(0.04), left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
      })
  );

  const sourceLabel: Record<string, string> = {
    auto: 'Automático', manual: 'Manual', insufficient: 'Insuficiente', skipped: 'N/A',
  };

  const dataRows = scores.map((s) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: s.name, size: 20, font: 'Calibri' })] })],
          margins: { top: convertInchesToTwip(0.04), bottom: convertInchesToTwip(0.04), left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: s.score.toFixed(1) + ' / 4.0', bold: true, size: 20, font: 'Calibri' })] })],
          margins: { top: convertInchesToTwip(0.04), bottom: convertInchesToTwip(0.04), left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: s.level, size: 20, font: 'Calibri' })] })],
          margins: { top: convertInchesToTwip(0.04), bottom: convertInchesToTwip(0.04), left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: sourceLabel[s.source] ?? s.source, size: 18, font: 'Calibri', color: '808080' })] })],
          margins: { top: convertInchesToTwip(0.04), bottom: convertInchesToTwip(0.04), left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
        }),
      ],
    })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

export async function exportToDOCX(diagnostic: Diagnostic): Promise<void> {
  const { input, overallScore, overallLevel, executiveNarrative, dimensionScores, insights, recommendations, subdimensionScores } = diagnostic;

  const children: (Paragraph | Table)[] = [];

  // ── CAPA ──────────────────────────────────────────────────────────────────
  children.push(
    spacer(600),
    coverTitle('IVOIRE GROWTH SCAN'),
    coverSubtitle('Diagnóstico de Maturidade Digital — Framework 4Cs Ivoire'),
    spacer(200),
    coverTitle(input.companyName),
    spacer(100),
    new Paragraph({
      children: [new TextRun({ text: input.siteUrl, size: 22, font: 'Calibri', color: '808080' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: input.segment + (input.isEcommerce ? ' · E-commerce' : ''), size: 22, font: 'Calibri', color: '808080' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        size: 20, font: 'Calibri', color: 'A0A0A0', italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    hr(),
    new Paragraph({
      children: [new TextRun({ text: 'Documento confidencial. Uso restrito ao cliente e à equipe Ivoire.', size: 18, font: 'Calibri', color: 'A0A0A0', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
    pageBreak(),
  );

  // ── SUMÁRIO EXECUTIVO ──────────────────────────────────────────────────────
  children.push(
    h1('1. SUMÁRIO EXECUTIVO'),
    bodyBold('Empresa Analisada', input.companyName),
    bodyBold('Site Principal', input.siteUrl),
    bodyBold('Segmento', input.segment),
    bodyBold('Tipo de Negócio', input.isEcommerce ? 'E-commerce' : 'Não E-commerce'),
    bodyBold('Concorrentes Analisados', (input.competitors ?? []).length > 0 ? input.competitors!.join(', ') : 'Nenhum informado'),
    bodyBold('Data do Diagnóstico', new Date().toLocaleDateString('pt-BR')),
    spacer(),
    h2('Score Geral de Maturidade'),
    new Paragraph({
      children: [
        new TextRun({ text: `${overallScore?.toFixed(2) ?? '–'} / 4.0`, bold: true, size: 56, font: 'Calibri', color: '1F3864' }),
        new TextRun({ text: `  —  ${overallLevel ?? '–'}`, bold: true, size: 36, font: 'Calibri', color: '2E5496' }),
      ],
      spacing: { before: 160, after: 200 },
    }),
    body(levelLabel(overallLevel ?? '')),
    spacer(),
    h2('Narrativa Executiva'),
    body(executiveNarrative ?? 'Narrativa não disponível.'),
    spacer(),
    h2('Visão Geral por Dimensão'),
  );

  if (dimensionScores) {
    children.push(scorecardTable(dimensionScores), spacer(200));
  }

  children.push(pageBreak());

  // ── METODOLOGIA ────────────────────────────────────────────────────────────
  children.push(
    h1('2. METODOLOGIA'),
    h2('Framework 4Cs Ivoire'),
    body('O Diagnóstico de Maturidade Digital Ivoire é baseado no Framework 4Cs — Conteúdo, Canais, Conversão e Controle — desenvolvido com referência no estudo BCG-Google de Maturidade Digital (2023). O framework avalia 14 subdimensões, cada uma pontuada de 1 a 4 segundo critérios técnicos e estratégicos verificáveis.'),
    spacer(),
    h2('Escala de Maturidade'),
    bulletPoint('Intuitivo (1.0–1.74): Operação reativa, sem processos digitais estruturados. Ausência de mensuração consistente.'),
    bulletPoint('Reativo (1.75–2.49): Primeiros passos no marketing digital. Dados sendo coletados, mas sem integração estratégica.'),
    bulletPoint('Ativo (2.50–3.24): Estratégia digital planejada e orientada por dados. Canais integrados com mensuração consistente.'),
    bulletPoint('Exponencial (3.25–4.0): Máquina de crescimento digital integrada. Automação, IA e dados preditivos em múltiplos touchpoints.'),
    spacer(),
    h2('Fontes de Dados'),
    bulletPoint('Performance Web & Mobile: Google PageSpeed Insights API (dados reais, coletados em tempo real).'),
    bulletPoint('Tracking & MarTech: Análise de scripts de terceiros detectados via PageSpeed/Lighthouse (rede de requisições e sumário de terceiros).'),
    bulletPoint('Demais subdimensões: Análise simulada com base em sinais públicos e padrões do segmento. Dados estimados para efeito de benchmark.'),
    note('Nota: Para produção em escala, a Ivoire recomenda integração com SimilarWeb Pro, Semrush Business, Ahrefs e BuiltWith API para coleta de dados em tempo real de todas as subdimensões.'),
    pageBreak(),
  );

  // ── SCORECARD POR DIMENSÃO ─────────────────────────────────────────────────
  children.push(h1('3. SCORECARD POR DIMENSÃO'));

  const dimensionOrder: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

  for (const dimKey of dimensionOrder) {
    const dimScore = dimensionScores?.find((d) => d.key === dimKey);
    const cfg = DIMENSION_CONFIG[dimKey];
    const relevantSubdims = (subdimensionScores ?? []).filter((s) => s.dimension === dimKey && s.source !== 'skipped');

    children.push(
      h2(`${cfg.name} — ${dimScore?.score?.toFixed(2) ?? '–'}/4.0 (${dimScore?.level ?? '–'})`),
      body(scoreBars(dimScore?.score ?? 1)),
    );

    if (relevantSubdims.length > 0) {
      children.push(subdimTable(relevantSubdims), spacer(200));
    }
  }

  children.push(pageBreak());

  // ── ANÁLISE DETALHADA POR SUBDIMENSÃO ─────────────────────────────────────
  children.push(h1('4. ANÁLISE DETALHADA POR SUBDIMENSÃO'));

  for (const dimKey of dimensionOrder) {
    const cfg = DIMENSION_CONFIG[dimKey];
    const dimScore = dimensionScores?.find((d) => d.key === dimKey);
    const relevantSubdims = (subdimensionScores ?? []).filter((s) => s.dimension === dimKey && s.source !== 'skipped');

    if (relevantSubdims.length === 0) continue;

    children.push(
      h2(`${cfg.name}  |  Score: ${dimScore?.score?.toFixed(2) ?? '–'}  |  ${dimScore?.level ?? '–'}`),
    );

    for (const s of relevantSubdims) {
      const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);

      children.push(
        h3(`${s.name}`),
        bodyBold('Score', `${s.score.toFixed(1)} / 4.0  ${scoreBars(s.score)}`),
        bodyBold('Nível Atual', levelLabel(s.level)),
        bodyBold('Fonte de Dados', s.source === 'auto' ? 'Coleta automatizada' : s.source === 'manual' ? 'Input manual' : 'Dados insuficientes'),
      );

      if (subdimDef?.description) {
        children.push(bodyBold('Descrição', subdimDef.description));
      }

      if (subdimDef?.kpis) {
        children.push(bodyBold('KPIs Avaliados', subdimDef.kpis));
      }

      // Current level definition
      if (subdimDef?.levels[s.score as 1 | 2 | 3 | 4]) {
        children.push(
          spacer(80),
          new Paragraph({
            children: [new TextRun({ text: `Critério do Nível ${s.level}:`, bold: true, size: 20, font: 'Calibri', color: '2E5496' })],
            spacing: { after: 80 },
          }),
          body(subdimDef.levels[s.score as 1 | 2 | 3 | 4]),
        );
      }

      // Next level
      const nextScore = Math.min(4, Math.round(s.score) + 1) as 1 | 2 | 3 | 4;
      if (nextScore > Math.round(s.score) && subdimDef?.levels[nextScore]) {
        const nextLevelName = { 1: 'Intuitivo', 2: 'Reativo', 3: 'Ativo', 4: 'Exponencial' }[nextScore];
        children.push(
          spacer(80),
          new Paragraph({
            children: [new TextRun({ text: `Para chegar ao nível ${nextLevelName}:`, bold: true, size: 20, font: 'Calibri', color: '404040', italics: true })],
            spacing: { after: 80 },
          }),
          body(subdimDef.levels[nextScore]),
        );
      }

      // Raw data
      const rawEntries = Object.entries(s.rawData ?? {}).filter(([k, v]) => v !== undefined && !['mobile', 'desktop', 'tech'].includes(k));
      const mobileData = s.rawData?.mobile as Record<string, unknown> | undefined;
      const techData = s.rawData?.tech as Record<string, unknown> | undefined;

      if (rawEntries.length > 0 || mobileData || techData) {
        children.push(
          spacer(80),
          new Paragraph({
            children: [new TextRun({ text: 'Dados Coletados:', bold: true, size: 20, font: 'Calibri', color: '2E5496' })],
            spacing: { after: 80 },
          }),
        );

        if (mobileData) {
          for (const [k, v] of Object.entries(mobileData).slice(0, 8)) {
            children.push(bodyBold(`  Mobile — ${formatKey(k)}`, formatRaw(v)));
          }
        }
        if (techData) {
          for (const [k, v] of Object.entries(techData).slice(0, 10)) {
            if (k !== 'thirdPartyDomains') {
              children.push(bodyBold(`  Tech — ${formatKey(k)}`, formatRaw(v)));
            }
          }
        }
        for (const [k, v] of rawEntries.slice(0, 10)) {
          children.push(bodyBold(`  ${formatKey(k)}`, formatRaw(v)));
        }
      }

      children.push(hr());
    }
  }

  children.push(pageBreak());

  // ── INSIGHTS ESTRATÉGICOS ──────────────────────────────────────────────────
  children.push(h1('5. INSIGHTS ESTRATÉGICOS'));

  const typeLabels: Record<string, string> = {
    gap_critico: 'GAP CRÍTICO', alavanca: 'ALAVANCA DE CRESCIMENTO',
    erosao_funil: 'EROSÃO DE FUNIL', oportunidade: 'OPORTUNIDADE',
  };

  const sortedInsights = (insights ?? []).sort((a, b) => {
    const p = { alta: 0, media: 1, baixa: 2 };
    return p[a.priority] - p[b.priority];
  });

  for (const ins of sortedInsights) {
    const dimCfg = DIMENSION_CONFIG[ins.dimension];
    children.push(
      h2(`${typeLabels[ins.type] ?? ins.type}  |  ${ins.title}`),
      bodyBold('Dimensão', dimCfg?.name ?? ins.dimension),
      bodyBold('Prioridade', ins.priority.toUpperCase()),
      body(ins.description),
      bodyBold('Impacto Estimado', ins.impactEstimate),
      spacer(120),
    );
  }

  children.push(pageBreak());

  // ── RECOMENDAÇÕES PRIORIZADAS ──────────────────────────────────────────────
  children.push(h1('6. RECOMENDAÇÕES PRIORIZADAS'));

  const timeframeLabel: Record<string, string> = {
    imediato: 'Imediato (0–30 dias)',
    curto_prazo: 'Curto Prazo (1–3 meses)',
    medio_prazo: 'Médio Prazo (3–6 meses)',
  };
  const effortLabel: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

  for (const rec of recommendations ?? []) {
    const dimCfg = DIMENSION_CONFIG[rec.dimension as DimensionKey];

    children.push(
      h2(`#${rec.priority}  ${rec.title}`),
      bodyBold('Dimensão', dimCfg?.name ?? rec.dimension),
      bodyBold('Esforço de Implementação', effortLabel[rec.effort] ?? rec.effort),
      bodyBold('Prazo Recomendado', timeframeLabel[rec.timeframe] ?? rec.timeframe),
      spacer(80),
      h3('O Que Fazer'),
      body(rec.what),
      h3('Por Quê Esta Ação'),
      body(rec.why),
      h3('Impacto Esperado'),
      body(rec.expectedImpact),
      hr(),
    );
  }

  children.push(pageBreak());

  // ── GLOSSÁRIO ─────────────────────────────────────────────────────────────
  children.push(
    h1('7. GLOSSÁRIO E REFERÊNCIAS'),
    h2('Termos Técnicos'),
    bodyBold('LCP (Largest Contentful Paint)', 'Tempo até o maior elemento visível ser carregado. Meta: < 2.5s.'),
    bodyBold('CLS (Cumulative Layout Shift)', 'Estabilidade visual durante o carregamento. Meta: < 0.1.'),
    bodyBold('INP (Interaction to Next Paint)', 'Responsividade a interações do usuário. Meta: < 200ms.'),
    bodyBold('GTM (Google Tag Manager)', 'Plataforma de gestão de tags que centraliza scripts de rastreamento sem necessidade de deploy de código.'),
    bodyBold('GA4 (Google Analytics 4)', 'Plataforma de analytics do Google baseada em eventos. Substituto do Universal Analytics.'),
    bodyBold('E-E-A-T', 'Experience, Expertise, Authoritativeness, Trustworthiness — critérios de qualidade do Google para ranqueamento de conteúdo.'),
    bodyBold('GEO (Generative Engine Optimization)', 'Otimização para visibilidade em motores de busca baseados em IA (ChatGPT, Perplexity, Gemini).'),
    bodyBold('CRO (Conversion Rate Optimization)', 'Conjunto de práticas para aumentar a taxa de conversão de visitantes em leads/clientes.'),
    bodyBold('CDP (Customer Data Platform)', 'Plataforma que centraliza dados de clientes de múltiplas fontes para ativação em tempo real.'),
    bodyBold('Schema Markup', 'Dados estruturados em JSON-LD que comunicam à máquina de busca o significado semântico do conteúdo.'),
    spacer(300),
    h2('Referências Metodológicas'),
    bulletPoint('BCG-Google: The Data-Driven CMO — Marketing Maturity Study (2023)'),
    bulletPoint('Google Lighthouse: Core Web Vitals Specification'),
    bulletPoint('OWASP Web Security Testing Guide'),
    bulletPoint('Framework 4Cs Ivoire — Ivoire Growth Company (2024)'),
    spacer(400),
    hr(),
    new Paragraph({
      children: [new TextRun({ text: 'IVOIRE — A primeira Marketing Growth Company do Brasil', bold: true, size: 22, font: 'Calibri', color: '1F3864' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Framework 4Cs Ivoire | Baseado no Estudo BCG-Google de Maturidade Digital', size: 18, font: 'Calibri', color: '808080', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Documento confidencial. Propriedade exclusiva da Ivoire Consultoria.', size: 16, font: 'Calibri', color: 'AAAAAA', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
    }),
  );

  // ── BUILD DOCUMENT ─────────────────────────────────────────────────────────
  const doc = new Document({
    creator: 'Ivoire Growth Scan',
    title: `Diagnóstico de Maturidade Digital — ${input.companyName}`,
    description: 'Gerado pela plataforma Ivoire Growth Scan. Framework 4Cs Ivoire.',
    numbering: {
      config: [{
        reference: 'default-bullet',
        levels: [{
          level: 0,
          format: NumberFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } } },
        }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: '404040' } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1.0),
            right: convertInchesToTwip(1.0),
            bottom: convertInchesToTwip(1.0),
            left: convertInchesToTwip(1.25),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `Ivoire Growth Scan  |  ${input.companyName}`, size: 16, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ text: '\t', size: 16 }),
                new TextRun({ text: 'Confidencial', size: 16, font: 'Calibri', color: 'AAAAAA', italics: true }),
              ],
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'www.ivoire.ag  |  Uso restrito  |  Documento confidencial', size: 16, font: 'Calibri', color: 'AAAAAA' }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' } },
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IvoireGrowthScan_${input.companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
