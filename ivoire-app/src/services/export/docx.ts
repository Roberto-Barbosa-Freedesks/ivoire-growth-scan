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
} from 'docx';
import type { Diagnostic, DimensionKey } from '../../types';
import { DIMENSION_CONFIG } from '../../data/scorecard';

function levelColor(level: string): string {
  const map: Record<string, string> = {
    Intuitivo: 'FF4D4D',
    Reativo: 'FF9900',
    Ativo: '00CC66',
    Exponencial: 'FFFF02',
  };
  return map[level] || '999999';
}

function h1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 52, color: 'FFFF02', font: 'Arial' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 36, color: 'FFFFFF', font: 'Arial' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function h3(text: string, color = 'FFFFFF'): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color, font: 'Arial' })],
    spacing: { before: 200, after: 80 },
  });
}

function body(text: string, color = 'CCCCCC'): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color, font: 'Arial' })],
    spacing: { after: 100 },
  });
}

function kv(label: string, value: string, valueColor = 'FFFFFF'): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: 'FFFF02', font: 'Arial' }),
      new TextRun({ text: value, size: 20, color: valueColor, font: 'Arial' }),
    ],
    spacing: { after: 80 },
  });
}

function hr(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '444444' } },
    spacing: { before: 200, after: 200 },
    children: [],
  });
}

function scoreTable(dimensionScores: NonNullable<Diagnostic['dimensionScores']>): Table {
  const headerCells = ['DIMENSÃO', 'SCORE', 'NÍVEL', 'SUBDIMENSÕES'].map(
    (label) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 18, color: '282828', font: 'Arial' })],
          }),
        ],
        shading: { type: ShadingType.SOLID, color: 'FFFF02' },
      })
  );

  const dataRows = dimensionScores.map(
    (dim) =>
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: dim.name, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })],
            shading: { type: ShadingType.SOLID, color: '1E1E1E' },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `${dim.score.toFixed(1)}`, bold: true, size: 28, color: levelColor(dim.level), font: 'Arial' })] })],
            shading: { type: ShadingType.SOLID, color: '1E1E1E' },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: dim.level, bold: true, size: 20, color: levelColor(dim.level), font: 'Arial' })] })],
            shading: { type: ShadingType.SOLID, color: '1E1E1E' },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${dim.subdimensions.filter((s) => s.source !== 'skipped').length} avaliadas`,
                    size: 20,
                    color: '999999',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
            shading: { type: ShadingType.SOLID, color: '1E1E1E' },
          }),
        ],
      })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export async function exportToDOCX(diagnostic: Diagnostic): Promise<void> {
  const { input, overallScore, overallLevel, executiveNarrative, dimensionScores, insights, recommendations } = diagnostic;

  const children: (Paragraph | Table)[] = [];

  // CAPA
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'IVOIRE GROWTH SCAN', bold: true, size: 72, color: '282828', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: 'FFFF02' },
      spacing: { before: 600, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'DIAGNÓSTICO DE MATURIDADE DIGITAL', size: 28, color: 'FFFF02', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
    }),
    new Paragraph({
      children: [new TextRun({ text: input.companyName.toUpperCase(), bold: true, size: 56, color: 'FFFFFF', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [new TextRun({ text: input.segment, size: 26, color: '999999', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: input.siteUrl, size: 22, color: '595959', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
          size: 20,
          color: '595959',
          font: 'Arial',
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // RESULTADO GERAL
  children.push(
    h1('1. RESULTADO GERAL'),
    hr(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Score de Maturidade: ', bold: true, size: 28, color: 'FFFFFF', font: 'Arial' }),
        new TextRun({ text: `${overallScore?.toFixed(1)} / 4,0`, bold: true, size: 52, color: levelColor(overallLevel || ''), font: 'Arial' }),
      ],
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Nível: ', bold: true, size: 26, color: 'FFFFFF', font: 'Arial' }),
        new TextRun({ text: overallLevel || '', bold: true, size: 36, color: levelColor(overallLevel || ''), font: 'Arial' }),
      ],
      spacing: { after: 300 },
    }),
    h3('Narrativa Executiva', 'FFFF02'),
    body(executiveNarrative || ''),
    hr()
  );

  // SCORECARD
  children.push(h1('2. SCORECARD POR DIMENSÃO'), hr());
  if (dimensionScores) {
    children.push(scoreTable(dimensionScores));
    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // ANÁLISE DETALHADA
  children.push(h1('3. ANÁLISE DETALHADA POR DIMENSÃO'), hr());
  if (dimensionScores) {
    for (const dim of dimensionScores) {
      const cfg = DIMENSION_CONFIG[dim.key as DimensionKey];
      children.push(h2(`${cfg?.label || dim.name} — Score ${dim.score.toFixed(1)} | ${dim.level}`));
      for (const sd of dim.subdimensions.filter((s) => s.source !== 'skipped')) {
        children.push(
          h3(sd.name, levelColor(sd.level)),
          kv('Score', `${sd.score} / 4 — ${sd.level}`, levelColor(sd.level)),
          kv('Fonte de Dados', sd.source === 'auto' ? 'Coleta automatizada' : sd.source === 'manual' ? 'Input manual' : 'Dados insuficientes'),
          body('')
        );
      }
      children.push(hr());
    }
  }

  // INSIGHTS
  children.push(h1('4. INSIGHTS ESTRATÉGICOS'), hr());
  const typeLabels: Record<string, string> = {
    gap_critico: 'GAP CRÍTICO',
    alavanca: 'ALAVANCA',
    erosao_funil: 'EROSÃO DE FUNIL',
    oportunidade: 'OPORTUNIDADE',
  };
  for (const ins of insights || []) {
    children.push(
      h3(`${typeLabels[ins.type] || ins.type} — ${ins.title}`, levelColor(ins.priority === 'alta' ? 'Intuitivo' : ins.priority === 'media' ? 'Reativo' : 'Ativo')),
      body(ins.description),
      kv('Impacto Estimado', ins.impactEstimate),
      kv('Prioridade', ins.priority.toUpperCase()),
      new Paragraph({ spacing: { after: 150 } })
    );
  }
  children.push(hr());

  // RECOMENDAÇÕES
  children.push(h1('5. RECOMENDAÇÕES PRIORIZADAS'), hr());
  for (const rec of recommendations || []) {
    const effortColor: Record<string, string> = { baixo: '00CC66', medio: 'FFFF02', alto: 'FF4D4D' };
    const timeframeLabel: Record<string, string> = {
      imediato: 'Imediato (0–30 dias)',
      curto_prazo: 'Curto prazo (1–3 meses)',
      medio_prazo: 'Médio prazo (3–6 meses)',
    };
    children.push(
      h3(`#${rec.priority} — ${rec.title}`),
      kv('Dimensão', DIMENSION_CONFIG[rec.dimension as DimensionKey]?.name || rec.dimension),
      kv('Esforço', rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1), effortColor[rec.effort] || 'FFFFFF'),
      kv('Prazo', timeframeLabel[rec.timeframe] || rec.timeframe),
      h3('O Que Fazer:', 'B7B7B7'),
      body(rec.what),
      h3('Por Que:', 'B7B7B7'),
      body(rec.why),
      h3('Impacto Esperado:', 'FFFF02'),
      body(rec.expectedImpact),
      new Paragraph({ spacing: { after: 250 } })
    );
  }

  // RODAPÉ
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [new TextRun({ text: 'IVOIRE — A primeira Marketing Growth Company do Brasil', bold: true, size: 22, color: 'FFFF02', font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Framework 4Cs Ivoire | Baseado no Estudo BCG-Google de Maturidade Digital', size: 18, color: '999999', font: 'Arial', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Documento confidencial. Propriedade exclusiva da Ivoire Consultoria.', size: 16, color: '595959', font: 'Arial', italics: true })],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    creator: 'Ivoire Growth Scan',
    title: `Diagnóstico de Maturidade Digital — ${input.companyName}`,
    description: 'Gerado pela plataforma Ivoire Growth Scan',
    sections: [{ children }],
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
