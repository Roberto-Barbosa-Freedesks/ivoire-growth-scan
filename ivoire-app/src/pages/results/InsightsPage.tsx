import { DIMENSION_CONFIG } from '../../data/scorecard';
import type { Diagnostic, Insight, DimensionKey } from '../../types';

interface Props {
  diagnostic: Diagnostic;
}

type InsightType = Insight['type'];
type Priority = Insight['priority'];

interface InsightTypeConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  description: string;
}

const INSIGHT_TYPE_CONFIG: Record<InsightType, InsightTypeConfig> = {
  gap_critico: {
    label: 'Gap Crítico',
    color: '#ff4d4d',
    bg: 'rgba(255,77,77,0.08)',
    border: 'rgba(255,77,77,0.25)',
    icon: '⚠',
    description: 'Lacunas críticas que requerem ação imediata',
  },
  alavanca: {
    label: 'Alavanca',
    color: '#FFFF02',
    bg: 'rgba(255,255,2,0.07)',
    border: 'rgba(255,255,2,0.25)',
    icon: '↑',
    description: 'Pontos próximos ao nível superior com alto potencial',
  },
  erosao_funil: {
    label: 'Erosão de Funil',
    color: '#ff9900',
    bg: 'rgba(255,153,0,0.08)',
    border: 'rgba(255,153,0,0.25)',
    icon: '↓',
    description: 'Pontos de perda identificados no funil de conversão',
  },
  oportunidade: {
    label: 'Oportunidade',
    color: '#00cc66',
    bg: 'rgba(0,204,102,0.08)',
    border: 'rgba(0,204,102,0.25)',
    icon: '◆',
    description: 'Oportunidades de crescimento com esforço moderado',
  },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; order: number }> = {
  alta: { label: 'Prioridade Alta', color: '#ff4d4d', order: 1 },
  media: { label: 'Prioridade Média', color: '#ff9900', order: 2 },
  baixa: { label: 'Prioridade Baixa', color: '#555', order: 3 },
};

function TypeBadge({ type }: { type: InsightType }) {
  const cfg = INSIGHT_TYPE_CONFIG[type];
  return (
    <span
      className="font-montserrat"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 3,
        padding: '3px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span style={{ fontSize: 11 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="font-montserrat"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: cfg.color,
        border: `1px solid ${cfg.color}`,
        borderRadius: 2,
        padding: '2px 7px',
        opacity: 0.85,
      }}
    >
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
        opacity: 0.7,
      }}
    >
      {cfg.label}
    </span>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const typeCfg = INSIGHT_TYPE_CONFIG[insight.type];

  return (
    <div
      style={{
        background: typeCfg.bg,
        border: `1px solid ${typeCfg.border}`,
        borderRadius: 8,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Top row: badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TypeBadge type={insight.type} />
        <DimBadge dimension={insight.dimension} />
        <PriorityBadge priority={insight.priority} />
      </div>

      {/* Title */}
      <h3
        className="font-montserrat"
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {insight.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: '#aaa',
          fontFamily: 'Arvo, serif',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {insight.description}
      </p>

      {/* Impact estimate */}
      {insight.impactEstimate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 5,
            borderLeft: `3px solid ${typeCfg.color}`,
          }}
        >
          <span style={{ fontSize: 11, color: '#555', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Impacto
          </span>
          <p style={{ fontSize: 12, color: '#888', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.5 }}>
            {insight.impactEstimate}
          </p>
        </div>
      )}
    </div>
  );
}

export default function InsightsPage({ diagnostic }: Props) {
  const insights = diagnostic.insights ?? [];

  // Sort by priority (alta first) then by type
  const sorted = [...insights].sort((a, b) => {
    const pa = PRIORITY_CONFIG[a.priority].order;
    const pb = PRIORITY_CONFIG[b.priority].order;
    if (pa !== pb) return pa - pb;
    return a.type.localeCompare(b.type);
  });

  const gapCriticos = sorted.filter((i) => i.type === 'gap_critico');
  const alavancas = sorted.filter((i) => i.type === 'alavanca');
  const erosoes = sorted.filter((i) => i.type === 'erosao_funil');
  const oportunidades = sorted.filter((i) => i.type === 'oportunidade');

  const highPriorityCount = insights.filter((i) => i.priority === 'alta').length;
  const gapCount = gapCriticos.length;

  const sections: Array<{ type: InsightType; items: Insight[] }> = [
    { type: 'gap_critico', items: gapCriticos },
    { type: 'alavanca', items: alavancas },
    { type: 'erosao_funil', items: erosoes },
    { type: 'oportunidade', items: oportunidades },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Executive summary */}
      <div
        className="ivoire-card"
        style={{
          padding: '24px 28px',
          marginBottom: 36,
          borderLeft: '3px solid #FFFF02',
        }}
      >
        <div
          className="font-montserrat"
          style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}
        >
          Sumário Executivo de Insights
        </div>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <span className="font-bebas" style={{ fontSize: 40, color: '#FFFF02' }}>
              {insights.length}
            </span>
            <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
              Insights Gerados
            </p>
          </div>
          <div>
            <span className="font-bebas" style={{ fontSize: 40, color: '#ff4d4d' }}>
              {gapCount}
            </span>
            <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
              Gaps Críticos
            </p>
          </div>
          <div>
            <span className="font-bebas" style={{ fontSize: 40, color: '#ff9900' }}>
              {highPriorityCount}
            </span>
            <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
              Prioridade Alta
            </p>
          </div>
          <div>
            <span className="font-bebas" style={{ fontSize: 40, color: '#00cc66' }}>
              {oportunidades.length}
            </span>
            <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
              Oportunidades
            </p>
          </div>
        </div>
      </div>

      {insights.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: '#555', fontFamily: 'Arvo, serif' }}>
            Nenhum insight gerado. Execute a coleta de dados primeiro.
          </p>
        </div>
      ) : (
        sections.map(({ type, items }) => {
          if (items.length === 0) return null;
          const cfg = INSIGHT_TYPE_CONFIG[type];
          return (
            <div key={type} style={{ marginBottom: 36 }}>
              {/* Section header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    color: cfg.color,
                  }}
                >
                  {cfg.icon}
                </span>
                <h2
                  className="font-montserrat"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: cfg.color,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {cfg.label}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    color: '#555',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  — {cfg.description}
                </span>
                <div style={{ flex: 1, height: 1, background: `${cfg.color}20` }} />
                <span
                  style={{
                    fontSize: 11,
                    color: '#555',
                    fontFamily: 'Montserrat, sans-serif',
                    minWidth: 20,
                    textAlign: 'right',
                  }}
                >
                  {items.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {items.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
