import PptxGenJS from 'pptxgenjs';
import type { Diagnostic, DimensionScore, DimensionKey } from '../../types';
import { DIMENSION_CONFIG } from '../../data/scorecard';

// Ivoire Design Tokens
const T = {
  bg: '282828',
  white: 'FFFFFF',
  yellow: 'FFFF02',
  gray: '999999',
  darkGray: '595959',
  black: '000000',
  intuitivo: 'FF4D4D',
  reativo: 'FF9900',
  ativo: '00CC66',
  exponencial: 'FFFF02',
};

const FONTS = {
  title: 'Montserrat',
  body: 'Arial',
  number: 'Arial',
};

// Margins (inches) — 16:9 slide is 10" x 5.625"
const M = { left: 0.34, right: 0.35, top: 0.49, body: 1.26 };

function levelColor(level: string): string {
  const map: Record<string, string> = {
    Intuitivo: T.intuitivo,
    Reativo: T.reativo,
    Ativo: T.ativo,
    Exponencial: T.exponencial,
  };
  return map[level] || T.gray;
}

function addFooter(slide: PptxGenJS.Slide): void {
  slide.addText('IVOIRE GROWTH SCAN  |  Framework 4Cs Ivoire  |  A primeira Marketing Growth Company do Brasil', {
    x: M.left, y: 5.2, w: 9.32, h: 0.25,
    fontSize: 6, color: T.gray, fontFace: FONTS.body,
    align: 'left',
  });
}

function addSlideTitle(slide: PptxGenJS.Slide, title: string, subtitle?: string): void {
  slide.addText(title, {
    x: M.left, y: M.top, w: 9.32, h: 0.55,
    fontSize: 24, bold: true, color: T.white, fontFace: FONTS.title,
    align: 'left',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: M.left, y: 1.1, w: 9.32, h: 0.3,
      fontSize: 12, color: T.yellow, fontFace: FONTS.title,
      align: 'left',
    });
  }
  // Yellow accent line under title
  slide.addShape('rect' as PptxGenJS.ShapeNameProps, {
    x: M.left, y: 1.08, w: 9.32, h: 0.04,
    fill: { color: T.yellow },
    line: { color: T.yellow },
  });
}

export async function exportToPPTX(diagnostic: Diagnostic): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9

  // Global theme
  pptx.theme = { headFontFace: FONTS.title, bodyFontFace: FONTS.body };

  const { input, overallScore, overallLevel, executiveNarrative, dimensionScores, insights, recommendations } = diagnostic;

  // ─── SLIDE 1: CAPA ───────────────────────────────────────────────────────────
  const slide1 = pptx.addSlide();
  slide1.background = { color: T.bg };

  // Yellow accent bar at top
  slide1.addShape('rect' as PptxGenJS.ShapeNameProps, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: T.yellow } });

  // IVOIRE label (yellow)
  slide1.addText('IVOIRE', {
    x: M.left, y: 0.7, w: 9.32, h: 0.8,
    fontSize: 72, bold: true, color: T.yellow, fontFace: FONTS.title,
    align: 'left',
  });
  slide1.addText('GROWTH SCAN', {
    x: M.left, y: 1.5, w: 9.32, h: 0.5,
    fontSize: 28, bold: true, color: T.white, fontFace: FONTS.title,
    align: 'left',
  });
  slide1.addText('DIAGNÓSTICO DE MATURIDADE DIGITAL', {
    x: M.left, y: 2.0, w: 9.32, h: 0.3,
    fontSize: 12, color: T.yellow, fontFace: FONTS.title,
    align: 'left',
  });

  // Company name
  slide1.addText(input.companyName.toUpperCase(), {
    x: M.left, y: 3.0, w: 9.32, h: 0.7,
    fontSize: 42, bold: true, color: T.white, fontFace: FONTS.title,
    align: 'left',
  });
  slide1.addText(`${input.segment}  |  ${input.siteUrl}`, {
    x: M.left, y: 3.75, w: 9.32, h: 0.3,
    fontSize: 13, color: T.gray, fontFace: FONTS.body,
    align: 'left',
  });
  slide1.addText(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), {
    x: M.left, y: 4.15, w: 9.32, h: 0.25,
    fontSize: 11, color: T.darkGray, fontFace: FONTS.body,
    align: 'left', italic: true,
  });

  addFooter(slide1);

  // ─── SLIDE 2: RESULTADO GERAL ────────────────────────────────────────────────
  const slide2 = pptx.addSlide();
  slide2.background = { color: T.bg };
  addSlideTitle(slide2, 'RESULTADO GERAL', 'Score de Maturidade Digital — Framework 4Cs Ivoire');

  const scoreColor = levelColor(overallLevel || '');

  // Big score number
  slide2.addText(`${overallScore?.toFixed(1)}`, {
    x: M.left, y: 1.5, w: 3.5, h: 1.8,
    fontSize: 140, bold: true, color: scoreColor, fontFace: FONTS.number,
    align: 'center',
  });
  slide2.addText('/ 4,0', {
    x: M.left, y: 3.2, w: 3.5, h: 0.4,
    fontSize: 20, color: T.gray, fontFace: FONTS.body,
    align: 'center',
  });

  // Level badge
  slide2.addShape('rect' as PptxGenJS.ShapeNameProps, { x: 4.1, y: 1.5, w: 2.5, h: 0.6, fill: { color: scoreColor + '25' }, line: { color: scoreColor, size: 1.5 } });
  slide2.addText((overallLevel || '').toUpperCase(), {
    x: 4.1, y: 1.5, w: 2.5, h: 0.6,
    fontSize: 22, bold: true, color: scoreColor, fontFace: FONTS.title,
    align: 'center', valign: 'middle',
  });

  // Narrative
  slide2.addText('NARRATIVA EXECUTIVA', {
    x: 4.1, y: 2.3, w: 5.55, h: 0.3,
    fontSize: 10, bold: true, color: T.yellow, fontFace: FONTS.title,
    align: 'left',
  });
  slide2.addText(executiveNarrative || '', {
    x: 4.1, y: 2.65, w: 5.55, h: 2.3,
    fontSize: 11, color: 'CCCCCC', fontFace: FONTS.body,
    align: 'left', valign: 'top',
    wrap: true,
  });

  addFooter(slide2);

  // ─── SLIDE 3: SCORECARD POR DIMENSÃO ─────────────────────────────────────────
  const slide3 = pptx.addSlide();
  slide3.background = { color: T.bg };
  addSlideTitle(slide3, 'SCORECARD POR DIMENSÃO', 'Resultado das 4 dimensões do Framework 4Cs Ivoire');

  if (dimensionScores) {
    const cols = [
      { label: 'DIMENSÃO', x: M.left, w: 2.8 },
      { label: 'SCORE', x: M.left + 2.9, w: 1.2 },
      { label: 'NÍVEL', x: M.left + 4.2, w: 1.8 },
      { label: 'SUBDIMENSÕES', x: M.left + 6.1, w: 3.0 },
    ];

    // Header row
    for (const col of cols) {
      slide3.addShape('rect' as PptxGenJS.ShapeNameProps, { x: col.x, y: 1.5, w: col.w - 0.05, h: 0.45, fill: { color: T.yellow } });
      slide3.addText(col.label, { x: col.x, y: 1.5, w: col.w - 0.05, h: 0.45, fontSize: 10, bold: true, color: T.bg, fontFace: FONTS.title, align: 'center', valign: 'middle' });
    }

    dimensionScores.forEach((dim, i) => {
      const y = 2.0 + i * 0.6;
      const rowBg = i % 2 === 0 ? '1E1E1E' : '222222';
      const cfg = DIMENSION_CONFIG[dim.key as DimensionKey];
      const lc = levelColor(dim.level);
      const row = [
        { x: cols[0].x, w: cols[0].w, text: cfg?.name || dim.name, color: T.white, bold: true },
        { x: cols[1].x, w: cols[1].w, text: dim.score.toFixed(1), color: lc, bold: true },
        { x: cols[2].x, w: cols[2].w, text: dim.level, color: lc, bold: true },
        { x: cols[3].x, w: cols[3].w, text: `${dim.subdimensions.filter(s => s.source !== 'skipped').length} avaliadas`, color: T.gray, bold: false },
      ];
      for (const cell of row) {
        slide3.addShape('rect' as PptxGenJS.ShapeNameProps, { x: cell.x, y, w: (cols[row.indexOf(cell)].w) - 0.05, h: 0.55, fill: { color: rowBg } });
        slide3.addText(cell.text, { x: cell.x + 0.05, y, w: (cols[row.indexOf(cell)].w) - 0.1, h: 0.55, fontSize: 13, bold: cell.bold, color: cell.color, fontFace: FONTS.body, align: 'center', valign: 'middle' });
      }
    });
  }

  addFooter(slide3);

  // ─── SLIDES 4–7: UMA SLIDE POR DIMENSÃO ─────────────────────────────────────
  const dimOrder: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

  for (const dimKey of dimOrder) {
    const dim = dimensionScores?.find((d) => d.key === dimKey);
    if (!dim) continue;
    const cfg = DIMENSION_CONFIG[dimKey];
    const lc = levelColor(dim.level);

    const slideD = pptx.addSlide();
    slideD.background = { color: T.bg };
    addSlideTitle(slideD, `${cfg.label}`, `Score ${dim.score.toFixed(1)} / 4,0 — Nível ${dim.level}`);

    // Level highlight
    slideD.addShape('rect' as PptxGenJS.ShapeNameProps, { x: M.left, y: 1.35, w: 2.0, h: 0.5, fill: { color: lc + '20' }, line: { color: lc, size: 1 } });
    slideD.addText(dim.level.toUpperCase(), { x: M.left, y: 1.35, w: 2.0, h: 0.5, fontSize: 14, bold: true, color: lc, fontFace: FONTS.title, align: 'center', valign: 'middle' });

    // Subdimensions list
    const relevantSubs = dim.subdimensions.filter((s) => s.source !== 'skipped');
    relevantSubs.slice(0, 6).forEach((sd, i) => {
      const y = 2.0 + i * 0.52;
      const x1 = M.left;
      const x2 = 1.5;
      const scoreColor = levelColor(sd.level);

      // Score box
      slideD.addShape('rect' as PptxGenJS.ShapeNameProps, { x: x1, y, w: 0.7, h: 0.44, fill: { color: scoreColor + '25' }, line: { color: scoreColor, size: 1 } });
      slideD.addText(`${sd.score}`, { x: x1, y, w: 0.7, h: 0.44, fontSize: 18, bold: true, color: scoreColor, fontFace: FONTS.number, align: 'center', valign: 'middle' });

      // Name
      slideD.addText(sd.name, { x: x1 + 0.8, y, w: 4.0, h: 0.44, fontSize: 12, bold: true, color: T.white, fontFace: FONTS.title, align: 'left', valign: 'middle' });

      // Level label
      slideD.addText(sd.level, { x: x1 + 4.9, y, w: 1.6, h: 0.44, fontSize: 10, color: scoreColor, fontFace: FONTS.body, align: 'center', valign: 'middle' });

      // Source badge
      const srcLabel = sd.source === 'auto' ? 'Auto' : sd.source === 'manual' ? 'Manual' : '—';
      slideD.addText(srcLabel, { x: x1 + 6.6, y, w: 1.0, h: 0.44, fontSize: 9, color: T.gray, fontFace: FONTS.body, align: 'center', valign: 'middle' });
    });

    addFooter(slideD);
  }

  // ─── SLIDE: INSIGHTS ─────────────────────────────────────────────────────────
  const slideIns = pptx.addSlide();
  slideIns.background = { color: T.bg };
  addSlideTitle(slideIns, 'INSIGHTS ESTRATÉGICOS', 'Principais achados do diagnóstico organizados por impacto e urgência');

  const insightColors: Record<string, string> = {
    gap_critico: T.intuitivo,
    alavanca: T.yellow,
    erosao_funil: T.reativo,
    oportunidade: T.ativo,
  };
  const insightLabels: Record<string, string> = {
    gap_critico: 'GAP CRÍTICO',
    alavanca: 'ALAVANCA',
    erosao_funil: 'EROSÃO',
    oportunidade: 'OPORTUNIDADE',
  };

  const topInsights = (insights || []).slice(0, 4);
  topInsights.forEach((ins, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M.left + col * 4.8;
    const y = 1.5 + row * 1.8;
    const ic = insightColors[ins.type] || T.gray;

    slideIns.addShape('rect' as PptxGenJS.ShapeNameProps, { x, y, w: 4.6, h: 1.65, fill: { color: '1E1E1E' }, line: { color: ic + '60', size: 1 } });
    slideIns.addShape('rect' as PptxGenJS.ShapeNameProps, { x, y, w: 4.6, h: 0.28, fill: { color: ic + '30' } });
    slideIns.addText(insightLabels[ins.type] || ins.type, { x: x + 0.1, y, w: 4.4, h: 0.28, fontSize: 8, bold: true, color: ic, fontFace: FONTS.title, align: 'left', valign: 'middle' });
    slideIns.addText(ins.title, { x: x + 0.1, y: y + 0.32, w: 4.4, h: 0.35, fontSize: 11, bold: true, color: T.white, fontFace: FONTS.title, align: 'left', wrap: true });
    slideIns.addText(ins.description.slice(0, 160) + (ins.description.length > 160 ? '...' : ''), { x: x + 0.1, y: y + 0.7, w: 4.4, h: 0.65, fontSize: 9, color: 'BBBBBB', fontFace: FONTS.body, align: 'left', wrap: true });
    slideIns.addText(`Prioridade: ${ins.priority.toUpperCase()}`, { x: x + 0.1, y: y + 1.38, w: 4.4, h: 0.2, fontSize: 8, bold: true, color: ic, fontFace: FONTS.body, align: 'left' });
  });

  addFooter(slideIns);

  // ─── SLIDE: RECOMENDAÇÕES ─────────────────────────────────────────────────────
  const slideRec = pptx.addSlide();
  slideRec.background = { color: T.bg };
  addSlideTitle(slideRec, 'RECOMENDAÇÕES PRIORIZADAS', 'Top 5 ações de maior impacto identificadas no diagnóstico');

  const topRecs = (recommendations || []).slice(0, 5);
  topRecs.forEach((rec, i) => {
    const y = 1.5 + i * 0.75;
    const effortColors: Record<string, string> = { baixo: T.ativo, medio: T.yellow, alto: T.intuitivo };
    const ec = effortColors[rec.effort] || T.gray;

    slideRec.addShape('rect' as PptxGenJS.ShapeNameProps, { x: M.left, y, w: 9.32, h: 0.68, fill: { color: '1E1E1E' }, line: { color: '333333', size: 1 } });

    // Priority number
    slideRec.addShape('rect' as PptxGenJS.ShapeNameProps, { x: M.left, y, w: 0.55, h: 0.68, fill: { color: T.yellow + '20' }, line: { color: T.yellow, size: 1 } });
    slideRec.addText(`${rec.priority}`, { x: M.left, y, w: 0.55, h: 0.68, fontSize: 18, bold: true, color: T.yellow, fontFace: FONTS.number, align: 'center', valign: 'middle' });

    // Title
    slideRec.addText(rec.title, { x: M.left + 0.65, y: y + 0.08, w: 6.0, h: 0.32, fontSize: 12, bold: true, color: T.white, fontFace: FONTS.title, align: 'left' });
    slideRec.addText(rec.expectedImpact.slice(0, 80) + (rec.expectedImpact.length > 80 ? '...' : ''), { x: M.left + 0.65, y: y + 0.38, w: 6.0, h: 0.22, fontSize: 9, color: T.gray, fontFace: FONTS.body, align: 'left' });

    // Effort badge
    slideRec.addShape('rect' as PptxGenJS.ShapeNameProps, { x: 7.0, y: y + 0.12, w: 0.9, h: 0.3, fill: { color: ec + '20' }, line: { color: ec, size: 1 } });
    slideRec.addText(rec.effort.toUpperCase(), { x: 7.0, y: y + 0.12, w: 0.9, h: 0.3, fontSize: 8, bold: true, color: ec, fontFace: FONTS.body, align: 'center', valign: 'middle' });

    // Timeframe
    const tfLabel: Record<string, string> = { imediato: 'IMEDIATO', curto_prazo: 'CURTO PRAZO', medio_prazo: 'MÉDIO PRAZO' };
    slideRec.addText(tfLabel[rec.timeframe] || rec.timeframe, { x: 8.0, y: y + 0.12, w: 1.2, h: 0.3, fontSize: 7, color: T.gray, fontFace: FONTS.body, align: 'center', valign: 'middle' });
  });

  addFooter(slideRec);

  // ─── SLIDE: PRÓXIMOS PASSOS ──────────────────────────────────────────────────
  const slideFinal = pptx.addSlide();
  slideFinal.background = { color: T.bg };

  slideFinal.addShape('rect' as PptxGenJS.ShapeNameProps, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: T.bg } });

  slideFinal.addText('PRÓXIMOS PASSOS', {
    x: M.left, y: 0.8, w: 9.32, h: 0.6,
    fontSize: 36, bold: true, color: T.yellow, fontFace: FONTS.title,
    align: 'left',
  });
  slideFinal.addText('Evolua para a versão Full do Ivoire Growth Scan', {
    x: M.left, y: 1.5, w: 9.32, h: 0.4,
    fontSize: 16, color: T.white, fontFace: FONTS.title,
    align: 'left',
  });

  const steps = [
    { n: '01', title: 'Apresentação do Diagnóstico', desc: 'Reunião de 60 min para apresentar os resultados e alinhar as prioridades estratégicas.' },
    { n: '02', title: 'Proposta da Versão Full', desc: 'Diagnóstico completo com 40+ subdimensões, dados internos e acesso a todas as plataformas.' },
    { n: '03', title: 'Kickoff do Projeto', desc: 'Início da jornada de transformação de marketing digital com acompanhamento Ivoire.' },
  ];

  steps.forEach((s, i) => {
    const x = M.left + i * 3.1;
    slideFinal.addShape('rect' as PptxGenJS.ShapeNameProps, { x, y: 2.2, w: 2.9, h: 2.5, fill: { color: '1E1E1E' }, line: { color: T.yellow + '40', size: 1 } });
    slideFinal.addText(s.n, { x, y: 2.25, w: 2.9, h: 0.6, fontSize: 42, bold: true, color: T.yellow, fontFace: FONTS.number, align: 'center' });
    slideFinal.addText(s.title, { x: x + 0.1, y: 2.9, w: 2.7, h: 0.5, fontSize: 11, bold: true, color: T.white, fontFace: FONTS.title, align: 'center', wrap: true });
    slideFinal.addText(s.desc, { x: x + 0.1, y: 3.45, w: 2.7, h: 1.1, fontSize: 9, color: T.gray, fontFace: FONTS.body, align: 'center', valign: 'top', wrap: true });
  });

  slideFinal.addText('IVOIRE — A primeira Marketing Growth Company do Brasil', {
    x: M.left, y: 5.15, w: 9.32, h: 0.25,
    fontSize: 8, color: T.yellow, fontFace: FONTS.title,
    align: 'center',
  });

  // Export
  await pptx.writeFile({
    fileName: `IvoireGrowthScan_${input.companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pptx`,
  });
}
