import { useState } from 'react';
import { DIMENSION_CONFIG } from '../../data/scorecard';
import type { Diagnostic, Recommendation, DimensionKey } from '../../types';

interface Props {
  diagnostic: Diagnostic;
}

type Effort = Recommendation['effort'];
type Timeframe = Recommendation['timeframe'];

const EFFORT_CONFIG: Record<Effort, { label: string; color: string; bg: string }> = {
  baixo: { label: 'Baixo', color: '#00cc66', bg: 'rgba(0,204,102,0.1)' },
  medio: { label: 'Médio', color: '#FFFF02', bg: 'rgba(255,255,2,0.1)' },
  alto: { label: 'Alto', color: '#ff4d4d', bg: 'rgba(255,77,77,0.1)' },
};

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; color: string; bg: string; icon: string }> = {
  imediato: { label: 'Imediato', color: '#ff4d4d', bg: 'rgba(255,77,77,0.1)', icon: '⚡' },
  curto_prazo: { label: 'Curto Prazo', color: '#ff9900', bg: 'rgba(255,153,0,0.1)', icon: '→' },
  medio_prazo: { label: 'Médio Prazo', color: '#00cc66', bg: 'rgba(0,204,102,0.1)', icon: '◷' },
};

type DimensionFilter = DimensionKey | 'all';
type EffortFilter = Effort | 'all';
type TimeframeFilter = Timeframe | 'all';

function EffortBadge({ effort }: { effort: Effort }) {
  const cfg = EFFORT_CONFIG[effort];
  return (
    <span
      className="font-montserrat"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 3,
        padding: '3px 8px',
        display: 'inline-block',
      }}
    >
      Esforço: {cfg.label}
    </span>
  );
}

function TimeframeBadge({ timeframe }: { timeframe: Timeframe }) {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  return (
    <span
      className="font-montserrat"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 3,
        padding: '3px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function DimBadge({ dimension }: { dimension: DimensionKey }) {
  const cfg = DIMENSION_CONFIG[dimension];
  return (
    <span
      className="font-montserrat"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: cfg.color,
        border: `1px solid rgba(255,255,2,0.2)`,
        borderRadius: 2,
        padding: '2px 7px',
        opacity: 0.75,
      }}
    >
      {cfg.label}
    </span>
  );
}

function RecommendationCard({ rec, isExpanded, onToggle }: {
  rec: Recommendation;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const effortCfg = EFFORT_CONFIG[rec.effort];
  const timeframeCfg = TIMEFRAME_CONFIG[rec.timeframe];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '18px 22px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 18,
        }}
      >
        {/* Priority number */}
        <div
          style={{
            minWidth: 36,
            height: 36,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            className="font-bebas"
            style={{ fontSize: 20, color: '#FFFF02', lineHeight: 1 }}
          >
            {rec.priority}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <DimBadge dimension={rec.dimension} />
            <EffortBadge effort={rec.effort} />
            <TimeframeBadge timeframe={rec.timeframe} />
          </div>

          {/* Title */}
          <h3
            className="font-montserrat"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {rec.title}
          </h3>
        </div>

        {/* Expand chevron */}
        <span
          style={{
            color: '#555',
            fontSize: 16,
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: '0 22px 22px 22px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
              marginTop: 18,
            }}
          >
            {/* What */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="font-montserrat"
                style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}
              >
                O Que Fazer
              </div>
              <p style={{ fontSize: 12, color: '#bbb', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                {rec.what}
              </p>
            </div>

            {/* Why */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="font-montserrat"
                style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}
              >
                Por Que
              </div>
              <p style={{ fontSize: 12, color: '#bbb', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                {rec.why}
              </p>
            </div>

            {/* Impact */}
            <div
              style={{
                padding: '14px 16px',
                background: `${effortCfg.bg}`,
                borderRadius: 6,
                border: `1px solid ${effortCfg.color}30`,
              }}
            >
              <div
                className="font-montserrat"
                style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}
              >
                Impacto Esperado
              </div>
              <p style={{ fontSize: 12, color: '#ccc', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                {rec.expectedImpact}
              </p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    background: timeframeCfg.bg,
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: timeframeCfg.color }}>{timeframeCfg.icon}</span>
                  <span style={{ fontSize: 11, color: timeframeCfg.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                    {timeframeCfg.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="font-montserrat"
      style={{
        background: active ? (color ?? '#FFFF02') : 'rgba(255,255,255,0.05)',
        color: active ? '#282828' : '#888',
        border: `1px solid ${active ? (color ?? '#FFFF02') : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 4,
        padding: '6px 14px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

const DIMENSION_KEYS: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

export default function RecommendationsPage({ diagnostic }: Props) {
  const recommendations = diagnostic.recommendations ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filterDim, setFilterDim] = useState<DimensionFilter>('all');
  const [filterEffort, setFilterEffort] = useState<EffortFilter>('all');
  const [filterTimeframe, setFilterTimeframe] = useState<TimeframeFilter>('all');

  // Apply filters
  const filtered = [...recommendations]
    .sort((a, b) => a.priority - b.priority)
    .filter((r) => {
      if (filterDim !== 'all' && r.dimension !== filterDim) return false;
      if (filterEffort !== 'all' && r.effort !== filterEffort) return false;
      if (filterTimeframe !== 'all' && r.timeframe !== filterTimeframe) return false;
      return true;
    });

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const immediateCount = recommendations.filter((r) => r.timeframe === 'imediato').length;
  const lowEffortCount = recommendations.filter((r) => r.effort === 'baixo').length;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Summary bar */}
      <div
        className="ivoire-card"
        style={{
          padding: '20px 28px',
          marginBottom: 28,
          display: 'flex',
          gap: 40,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <span className="font-bebas" style={{ fontSize: 36, color: '#FFFF02' }}>
            {recommendations.length}
          </span>
          <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Recomendações
          </p>
        </div>
        <div>
          <span className="font-bebas" style={{ fontSize: 36, color: '#ff4d4d' }}>
            {immediateCount}
          </span>
          <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Imediatas
          </p>
        </div>
        <div>
          <span className="font-bebas" style={{ fontSize: 36, color: '#00cc66' }}>
            {lowEffortCount}
          </span>
          <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Baixo Esforço
          </p>
        </div>
        <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>
          <p style={{ fontSize: 11, color: '#555', fontFamily: 'Arvo, serif', margin: 0, maxWidth: 260, lineHeight: 1.5 }}>
            Ordenadas por prioridade de impacto no score de maturidade digital.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24 }}>
        {/* Dimension filter */}
        <div style={{ marginBottom: 12 }}>
          <div
            className="font-montserrat"
            style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}
          >
            Dimensão
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FilterButton active={filterDim === 'all'} onClick={() => setFilterDim('all')}>
              Todas
            </FilterButton>
            {DIMENSION_KEYS.map((dk) => (
              <FilterButton
                key={dk}
                active={filterDim === dk}
                onClick={() => setFilterDim(dk)}
                color="#FFFF02"
              >
                {DIMENSION_CONFIG[dk].name}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Effort + Timeframe */}
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div
              className="font-montserrat"
              style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}
            >
              Esforço
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <FilterButton active={filterEffort === 'all'} onClick={() => setFilterEffort('all')}>Todos</FilterButton>
              <FilterButton active={filterEffort === 'baixo'} onClick={() => setFilterEffort('baixo')} color="#00cc66">Baixo</FilterButton>
              <FilterButton active={filterEffort === 'medio'} onClick={() => setFilterEffort('medio')} color="#FFFF02">Médio</FilterButton>
              <FilterButton active={filterEffort === 'alto'} onClick={() => setFilterEffort('alto')} color="#ff4d4d">Alto</FilterButton>
            </div>
          </div>

          <div>
            <div
              className="font-montserrat"
              style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}
            >
              Prazo
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <FilterButton active={filterTimeframe === 'all'} onClick={() => setFilterTimeframe('all')}>Todos</FilterButton>
              <FilterButton active={filterTimeframe === 'imediato'} onClick={() => setFilterTimeframe('imediato')} color="#ff4d4d">Imediato</FilterButton>
              <FilterButton active={filterTimeframe === 'curto_prazo'} onClick={() => setFilterTimeframe('curto_prazo')} color="#ff9900">Curto Prazo</FilterButton>
              <FilterButton active={filterTimeframe === 'medio_prazo'} onClick={() => setFilterTimeframe('medio_prazo')} color="#00cc66">Médio Prazo</FilterButton>
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      {(filterDim !== 'all' || filterEffort !== 'all' || filterTimeframe !== 'all') && (
        <p style={{ fontSize: 12, color: '#555', fontFamily: 'Montserrat, sans-serif', marginBottom: 16 }}>
          {filtered.length} de {recommendations.length} recomendações
          {' '}
          <button
            onClick={() => { setFilterDim('all'); setFilterEffort('all'); setFilterTimeframe('all'); }}
            style={{ background: 'none', border: 'none', color: '#FFFF02', cursor: 'pointer', fontSize: 11, fontFamily: 'Montserrat, sans-serif', textDecoration: 'underline', padding: 0 }}
          >
            Limpar filtros
          </button>
        </p>
      )}

      {/* Recommendations list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: '#555', fontFamily: 'Arvo, serif', fontSize: 14 }}>
            Nenhuma recomendação encontrada com os filtros selecionados.
          </p>
          <button
            className="btn-secondary"
            style={{ marginTop: 16, fontSize: 12 }}
            onClick={() => { setFilterDim('all'); setFilterEffort('all'); setFilterTimeframe('all'); }}
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              isExpanded={expandedId === rec.id}
              onToggle={() => toggleExpand(rec.id)}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 36, padding: '16px 20px', borderLeft: '2px solid rgba(255,255,2,0.2)', background: 'rgba(255,255,2,0.03)', borderRadius: '0 4px 4px 0' }}>
        <p style={{ fontSize: 12, color: '#666', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.6 }}>
          As recomendações são ordenadas por impacto potencial no score de maturidade. Recomendações de Baixo Esforço + Impacto Alto devem ser priorizadas para resultados rápidos. O prazo estimado é baseado no esforço de implementação típico para equipes de marketing de médio porte.
        </p>
      </div>
    </div>
  );
}
