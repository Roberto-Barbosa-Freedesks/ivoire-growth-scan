import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { DIMENSION_CONFIG, LEVEL_CONFIG } from '../../data/scorecard';
import { scoreToLevel } from '../../services/scoring';
import type { Diagnostic, DimensionKey, MaturityLevel } from '../../types';

interface Props {
  diagnostic: Diagnostic;
}

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];
const ALL_LEVELS: MaturityLevel[] = ['Intuitivo', 'Reativo', 'Ativo', 'Exponencial'];

function LevelBadge({ level }: { level: MaturityLevel }) {
  return (
    <span
      className={`font-montserrat level-bg-${level.toLowerCase()}`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        display: 'inline-block',
      }}
    >
      <span className={`level-${level.toLowerCase()}`}>{level}</span>
    </span>
  );
}

function ScoreBar({ score, max = 4 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const level = scoreToLevel(score);
  const levelColors: Record<MaturityLevel, string> = {
    Intuitivo: '#ff4d4d',
    Reativo: '#ff9900',
    Ativo: '#00cc66',
    Exponencial: '#FFFF02',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: levelColors[level],
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span
        className="font-bebas"
        style={{ fontSize: 18, color: levelColors[level], minWidth: 30, textAlign: 'right' }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// Custom tooltip for RadarChart
function CustomRadarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { subject: string; score: number } }> }) {
  if (!active || !payload || !payload.length) return null;
  const { subject, score } = payload[0].payload;
  const level = scoreToLevel(score);
  const levelCfg = LEVEL_CONFIG[level];
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: `1px solid ${levelCfg.color}`,
        borderRadius: 6,
        padding: '10px 14px',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <p style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px', fontSize: 13 }}>{subject}</p>
      <p style={{ color: levelCfg.color, margin: 0, fontSize: 12, fontWeight: 600 }}>
        {score.toFixed(2)} — {level}
      </p>
    </div>
  );
}

export default function OverviewPage({ diagnostic }: Props) {
  // diagnostic is used in key metrics row below
  const overallScore = diagnostic.overallScore ?? 0;
  const overallLevel = diagnostic.overallLevel ?? 'Intuitivo';
  const dimensionScores = diagnostic.dimensionScores ?? [];
  const executiveNarrative = diagnostic.executiveNarrative ?? '';

  const levelCfg = LEVEL_CONFIG[overallLevel];

  // Radar chart data
  const radarData = DIMENSION_ORDER.map((dimKey) => {
    const dimScore = dimensionScores.find((d) => d.key === dimKey);
    return {
      subject: DIMENSION_CONFIG[dimKey].name,
      score: dimScore?.score ?? 1,
      fullMark: 4,
    };
  });

  const levelColors: Record<MaturityLevel, string> = {
    Intuitivo: '#ff4d4d',
    Reativo: '#ff9900',
    Ativo: '#00cc66',
    Exponencial: '#FFFF02',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Score hero + radar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 32,
          marginBottom: 40,
          alignItems: 'start',
        }}
      >
        {/* Score hero card */}
        <div
          className="ivoire-card"
          style={{
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div>
            <div
              className="font-montserrat"
              style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}
            >
              Score Global de Maturidade Digital
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                className="font-bebas"
                style={{ fontSize: 96, color: '#FFFF02', lineHeight: 1 }}
              >
                {overallScore.toFixed(1)}
              </span>
              <span
                className="font-bebas"
                style={{ fontSize: 36, color: '#444' }}
              >
                /4.0
              </span>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <LevelBadge level={overallLevel} />
              <span style={{ color: '#666', fontSize: 12, fontFamily: 'Arvo, serif' }}>
                Framework 4Cs Ivoire
              </span>
            </div>
          </div>

          {/* Score bar visual */}
          <div>
            <div
              style={{
                height: 8,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Level markers */}
              {[1.74, 2.49, 3.24].map((mark) => (
                <div
                  key={mark}
                  style={{
                    position: 'absolute',
                    left: `${((mark - 1) / 3) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(255,255,255,0.15)',
                    zIndex: 2,
                  }}
                />
              ))}
              <div
                style={{
                  width: `${((overallScore - 1) / 3) * 100}%`,
                  height: '100%',
                  background: levelCfg?.color ?? '#FFFF02',
                  borderRadius: 4,
                  transition: 'width 0.8s ease',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              {ALL_LEVELS.map((l) => (
                <span
                  key={l}
                  className={`font-montserrat level-${l.toLowerCase()}`}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    opacity: l === overallLevel ? 1 : 0.35,
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Executive narrative */}
          {executiveNarrative && (
            <p
              style={{
                fontSize: 13,
                color: '#aaa',
                lineHeight: 1.7,
                fontFamily: 'Arvo, serif',
                margin: 0,
                borderLeft: '2px solid rgba(255,255,2,0.3)',
                paddingLeft: 14,
              }}
            >
              {executiveNarrative}
            </p>
          )}
        </div>

        {/* Radar chart card */}
        <div
          className="ivoire-card"
          style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column' }}
        >
          <div
            className="font-montserrat"
            style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}
          >
            Radar de Maturidade — 4Cs
          </div>
          <div style={{ flex: 1, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: '#888',
                    fontSize: 11,
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 600,
                  }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#FFFF02"
                  fill="#FFFF02"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={{ fill: '#FFFF02', r: 4, strokeWidth: 0 }}
                />
                <Tooltip content={<CustomRadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Dimension cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 40,
        }}
      >
        {DIMENSION_ORDER.map((dimKey) => {
          const dimScore = dimensionScores.find((d) => d.key === dimKey);
          const dimConfig = DIMENSION_CONFIG[dimKey];
          const score = dimScore?.score ?? 1;
          const level = dimScore?.level ?? 'Intuitivo';
          const subdimCount = dimScore?.subdimensions.length ?? 0;

          return (
            <div
              key={dimKey}
              className="ivoire-card"
              style={{ padding: '20px 18px' }}
            >
              <div
                className="font-montserrat"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: dimConfig.color,
                  marginBottom: 12,
                }}
              >
                {dimConfig.label}
              </div>

              <div style={{ marginBottom: 10 }}>
                <span
                  className="font-bebas"
                  style={{ fontSize: 42, color: levelColors[level], lineHeight: 1 }}
                >
                  {score.toFixed(1)}
                </span>
              </div>

              <LevelBadge level={level} />

              <div style={{ marginTop: 14 }}>
                <ScoreBar score={score} />
              </div>

              <p style={{ fontSize: 11, color: '#555', margin: '10px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
                {subdimCount} subdimensões
              </p>
            </div>
          );
        })}
      </div>

      {/* Dimension bar chart */}
      <div className="ivoire-card" style={{ padding: '24px 28px', marginBottom: 28 }}>
        <div className="font-montserrat" style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
          Score por Dimensão — Comparativo Visual
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={DIMENSION_ORDER.map((k) => {
            const d = dimensionScores.find((x) => x.key === k);
            const sc = d?.score ?? 1;
            return { name: DIMENSION_CONFIG[k].label, score: sc, fill: levelColors[d?.level ?? 'Intuitivo'] };
          })} barSize={48} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fill: '#555', fontSize: 10, fontFamily: 'Montserrat, sans-serif' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12, fontFamily: 'Arvo, serif', color: '#ccc' }}
              formatter={(v: number | undefined) => v != null ? [`${v.toFixed(2)} / 4.0 — ${scoreToLevel(v)}`, 'Score'] : ['', 'Score']}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {DIMENSION_ORDER.map((k, i) => {
                const d = dimensionScores.find((x) => x.key === k);
                return <Cell key={i} fill={levelColors[d?.level ?? 'Intuitivo']} fillOpacity={0.85} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Benchmark reference lines annotation */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[{ label: 'Intuitivo', range: '1.0–1.74', color: '#ff4d4d' }, { label: 'Reativo', range: '1.75–2.49', color: '#ff9900' }, { label: 'Ativo', range: '2.50–3.24', color: '#00cc66' }, { label: 'Exponencial', range: '3.25–4.0', color: '#FFFF02' }].map(({ label, range, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif' }}>{label} ({range})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          {
            label: 'Subdimensões Avaliadas',
            value: String(diagnostic.subdimensionScores.filter((s) => s.source !== 'skipped').length),
            sub: `de ${diagnostic.subdimensionScores.length} totais`,
            color: '#FFFF02',
          },
          {
            label: 'Gaps Críticos (Score 1)',
            value: String(diagnostic.subdimensionScores.filter((s) => s.score === 1 && s.source !== 'skipped').length),
            sub: 'subdimensões em nível Intuitivo',
            color: '#ff4d4d',
          },
          {
            label: 'Forças (Score ≥ 3)',
            value: String(diagnostic.subdimensionScores.filter((s) => s.score >= 3 && s.source !== 'skipped').length),
            sub: 'subdimensões em nível Ativo ou Exponencial',
            color: '#00cc66',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="ivoire-card" style={{ padding: '20px 22px', textAlign: 'center' }}>
            <div className="font-bebas" style={{ fontSize: 48, color, lineHeight: 1 }}>{value}</div>
            <div className="font-montserrat" style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginTop: 4, letterSpacing: 0.5 }}>{label}</div>
            <div style={{ fontSize: 11, color: '#555', fontFamily: 'Arvo, serif', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="ivoire-divider" />

      {/* Maturity levels description */}
      <div style={{ marginBottom: 40 }}>
        <h2
          className="font-montserrat"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}
        >
          Escala de Maturidade Digital
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ALL_LEVELS.map((level, idx) => {
            const cfg = LEVEL_CONFIG[level];
            const isCurrent = level === overallLevel;

            return (
              <div
                key={level}
                className={`ivoire-card level-bg-${level.toLowerCase()}`}
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 18,
                  opacity: isCurrent ? 1 : 0.55,
                  transform: isCurrent ? 'none' : undefined,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Level number */}
                <div
                  className="font-bebas"
                  style={{
                    fontSize: 32,
                    color: cfg.color,
                    lineHeight: 1,
                    minWidth: 24,
                    opacity: 0.7,
                  }}
                >
                  {idx + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span
                      className="font-montserrat"
                      style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}
                    >
                      {level}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                          background: cfg.color,
                          color: '#282828',
                          padding: '2px 7px',
                          borderRadius: 2,
                        }}
                      >
                        Nível Atual
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#aaa', margin: 0, fontFamily: 'Arvo, serif', lineHeight: 1.6 }}>
                    {cfg.description}
                  </p>
                </div>

                {/* Score range */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span
                    className="font-bebas"
                    style={{ fontSize: 14, color: cfg.color, opacity: 0.7, letterSpacing: 0.5 }}
                  >
                    {idx === 0 ? '1.0 – 1.74' : idx === 1 ? '1.75 – 2.49' : idx === 2 ? '2.5 – 3.24' : '3.25 – 4.0'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
