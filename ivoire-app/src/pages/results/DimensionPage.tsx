import { useState } from 'react';
import { SUBDIMENSIONS, DIMENSION_CONFIG, LEVEL_CONFIG } from '../../data/scorecard';
import { scoreToLevel } from '../../services/scoring';
import type { Diagnostic, DimensionKey, MaturityLevel, SubdimensionScore } from '../../types';

interface Props {
  diagnostic: Diagnostic;
  dimensionKey: DimensionKey;
}

const SCORE_COLORS: Record<number, string> = {
  1: '#ff4d4d',
  2: '#ff9900',
  3: '#00cc66',
  4: '#FFFF02',
};

function LevelBadge({ level }: { level: MaturityLevel }) {
  return (
    <span
      className={`font-montserrat level-bg-${level.toLowerCase()}`}
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      <span className={`level-${level.toLowerCase()}`}>{level}</span>
    </span>
  );
}

function SourceBadge({ source }: { source: SubdimensionScore['source'] }) {
  const map: Record<string, { label: string; color: string }> = {
    auto: { label: 'Auto', color: '#00cc66' },
    manual: { label: 'Manual', color: '#ff9900' },
    insufficient: { label: 'Insuficiente', color: '#666' },
    skipped: { label: 'Ignorado', color: '#444' },
  };
  const cfg = map[source] ?? map['auto'];
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: cfg.color,
        border: `1px solid ${cfg.color}`,
        borderRadius: 2,
        padding: '2px 6px',
        display: 'inline-block',
        opacity: 0.8,
      }}
    >
      {cfg.label}
    </span>
  );
}

function ScoreBlocks({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            background:
              n <= Math.round(score)
                ? SCORE_COLORS[Math.round(score)] ?? '#FFFF02'
                : 'rgba(255,255,255,0.07)',
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) {
    const filtered = value.filter(Boolean);
    return filtered.length > 0 ? filtered.join(', ') : 'N/A';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function SubdimRow({ score, subdimDef, isExpanded, onToggle }: {
  score: SubdimensionScore;
  subdimDef: (typeof SUBDIMENSIONS)[0] | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const level = score.level ?? scoreToLevel(score.score);
  const levelCfg = LEVEL_CONFIG[level];
  const rawEntries = Object.entries(score.rawData ?? {}).filter(([, v]) => v !== undefined);

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          alignItems: 'center',
          gap: 16,
          textAlign: 'left',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
      >
        {/* Name */}
        <div>
          <span
            className="font-montserrat"
            style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}
          >
            {score.name}
          </span>
          {score.isConditional && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                color: '#FFFF02',
                border: '1px solid rgba(255,255,2,0.3)',
                borderRadius: 2,
                padding: '1px 5px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              E-COMM
            </span>
          )}
        </div>

        {/* Score blocks */}
        <ScoreBlocks score={score.score} />

        {/* Score number */}
        <span
          className="font-bebas"
          style={{ fontSize: 22, color: SCORE_COLORS[Math.round(score.score)] ?? '#fff', minWidth: 28, textAlign: 'center' }}
        >
          {score.score.toFixed(1)}
        </span>

        {/* Level badge */}
        <LevelBadge level={level} />

        {/* Source + expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SourceBadge source={score.source} />
          <span
            style={{
              color: '#555',
              fontSize: 14,
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: '0 20px 20px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              marginTop: 16,
            }}
          >
            {/* Description & level definition */}
            <div>
              {subdimDef?.description && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    className="font-montserrat"
                    style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}
                  >
                    Sobre Esta Subdimensão
                  </div>
                  <p style={{ fontSize: 12, color: '#888', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                    {subdimDef.description}
                  </p>
                </div>
              )}

              {/* Current level definition */}
              <div>
                <div
                  className="font-montserrat"
                  style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}
                >
                  Critério do Nível {level}
                </div>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: levelCfg?.bg ?? 'rgba(255,255,255,0.03)',
                    border: `1px solid ${levelCfg?.color ?? '#555'}`,
                    borderOpacity: 0.3,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: '#ccc',
                      fontFamily: 'Arvo, serif',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {subdimDef?.levels[score.score as 1 | 2 | 3 | 4] ?? 'Definição não disponível.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Raw data */}
            <div>
              <div
                className="font-montserrat"
                style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}
              >
                Dados Coletados
              </div>
              {rawEntries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rawEntries.map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#777', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
                        {formatKey(k)}
                      </span>
                      <span style={{ fontSize: 11, color: '#ccc', fontFamily: 'Arvo, serif', textAlign: 'right', maxWidth: 160, wordBreak: 'break-word' }}>
                        {formatRawValue(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#555', fontFamily: 'Arvo, serif' }}>
                  Nenhum dado disponível.
                </p>
              )}

              {/* KPIs */}
              {subdimDef?.kpis && (
                <div style={{ marginTop: 14 }}>
                  <div
                    className="font-montserrat"
                    style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}
                  >
                    KPIs Avaliados
                  </div>
                  <p style={{ fontSize: 11, color: '#666', fontFamily: 'Arvo, serif', lineHeight: 1.5, margin: 0 }}>
                    {subdimDef.kpis}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DimensionPage({ diagnostic, dimensionKey }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dimConfig = DIMENSION_CONFIG[dimensionKey];
  const dimScore = diagnostic.dimensionScores?.find((d) => d.key === dimensionKey);

  const dimensionSubdims = diagnostic.subdimensionScores.filter(
    (s) => s.dimension === dimensionKey
  );

  const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  dimensionSubdims.forEach((s) => {
    const rounded = Math.round(s.score) as 1 | 2 | 3 | 4;
    scoreCounts[rounded] = (scoreCounts[rounded] ?? 0) + 1;
  });

  const maxCount = Math.max(...Object.values(scoreCounts), 1);

  const level = dimScore?.level ?? 'Intuitivo';
  const score = dimScore?.score ?? 1;

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Dimension header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 32,
          marginBottom: 36,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            className="font-montserrat"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: dimConfig.color,
              marginBottom: 6,
            }}
          >
            Dimensão
          </div>
          <h1
            className="font-bebas"
            style={{ fontSize: 52, color: '#fff', margin: 0, letterSpacing: 2, lineHeight: 1 }}
          >
            {dimConfig.name}
          </h1>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              className="font-bebas"
              style={{ fontSize: 32, color: SCORE_COLORS[Math.round(score)] ?? '#FFFF02' }}
            >
              {score.toFixed(2)}
            </span>
            <span className="font-bebas" style={{ fontSize: 18, color: '#444' }}>/4.0</span>
            <LevelBadge level={level} />
          </div>
        </div>

        {/* Score distribution */}
        <div className="ivoire-card" style={{ padding: '20px 24px', marginLeft: 'auto' }}>
          <div
            className="font-montserrat"
            style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}
          >
            Distribuição de Scores
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 60 }}>
            {[1, 2, 3, 4].map((n) => {
              const count = scoreCounts[n] ?? 0;
              const height = maxCount > 0 ? Math.round((count / maxCount) * 52) : 0;
              const levelForScore = scoreToLevel(n);
              return (
                <div
                  key={n}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif' }}>{count}</span>
                  <div
                    style={{
                      width: 28,
                      height: Math.max(height, 4),
                      background: SCORE_COLORS[n] ?? '#666',
                      borderRadius: '3px 3px 0 0',
                      opacity: 0.8,
                      transition: 'height 0.4s ease',
                    }}
                  />
                  <span
                    className={`font-bebas level-${levelForScore.toLowerCase()}`}
                    style={{ fontSize: 14 }}
                  >
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ivoire-divider" style={{ margin: '0 0 28px' }} />

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          gap: 16,
          padding: '10px 20px',
          alignItems: 'center',
        }}
      >
        <span className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Subdimensão</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Score</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Valor</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Nível</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Fonte</span>
      </div>

      {/* Subdimension rows */}
      <div
        className="ivoire-card"
        style={{ overflow: 'hidden' }}
      >
        {dimensionSubdims.length === 0 ? (
          <p style={{ padding: 24, color: '#666', fontFamily: 'Arvo, serif', textAlign: 'center' }}>
            Nenhuma subdimensão disponível para esta dimensão.
          </p>
        ) : (
          dimensionSubdims.map((score) => {
            const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === score.subdimensionId);
            return (
              <SubdimRow
                key={score.subdimensionId}
                score={score}
                subdimDef={subdimDef}
                isExpanded={expandedId === score.subdimensionId}
                onToggle={() => toggleExpand(score.subdimensionId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
