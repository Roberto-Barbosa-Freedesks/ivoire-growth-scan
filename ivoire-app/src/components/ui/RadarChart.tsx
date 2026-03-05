import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { DimensionScore } from '../../types';

interface DiagnosticRadarProps {
  dimensionScores: DimensionScore[];
}

const DIMENSION_DISPLAY: Record<string, string> = {
  CONTEUDO: 'Conteúdo',
  CANAIS: 'Canais',
  CONVERSAO: 'Conversão',
  CONTROLE: 'Controle',
};

const LEVEL_COLOR: Record<string, string> = {
  Intuitivo: '#ff4d4d',
  Reativo: '#ff9900',
  Ativo: '#00cc66',
  Exponencial: '#FFFF02',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { dimension: string; score: number; level: string } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const color = LEVEL_COLOR[data.level] || '#FFFF02';

  return (
    <div
      style={{
        background: 'rgba(20,20,20,0.95)',
        border: `1px solid ${color}40`,
        borderRadius: '6px',
        padding: '10px 14px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          fontFamily: 'Montserrat',
          fontSize: '11px',
          fontWeight: 700,
          color: '#999',
          letterSpacing: '1px',
          marginBottom: '4px',
        }}
      >
        {data.dimension}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span
          style={{
            fontFamily: 'Bebas Neue, cursive',
            fontSize: '26px',
            color,
            lineHeight: 1,
          }}
        >
          {data.score.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: 'Montserrat',
            fontSize: '10px',
            color: '#595959',
          }}
        >
          / 4.0
        </span>
      </div>
      <div
        style={{
          fontFamily: 'Montserrat',
          fontSize: '10px',
          fontWeight: 700,
          color,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginTop: '4px',
        }}
      >
        {data.level}
      </div>
    </div>
  );
}

interface CustomAngleLabelProps {
  x?: number | string;
  y?: number | string;
  cx?: number | string;
  cy?: number | string;
  payload?: { value: string };
  [key: string]: unknown;
}

function CustomAngleAxisTick({ x = 0, y = 0, cx = 0, cy = 0, payload }: CustomAngleLabelProps) {
  if (!payload) return null;

  const px = Number(x);
  const py = Number(y);
  const pcx = Number(cx);
  const pcy = Number(cy);

  const dx = px - pcx;
  const dy = py - pcy;

  // Determine text-anchor based on position relative to center
  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  if (Math.abs(dx) > 20) {
    textAnchor = dx > 0 ? 'start' : 'end';
  }

  // Offset tick label slightly outward
  const offset = 12;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const lx = px + ux * offset;
  const ly = py + uy * offset;

  return (
    <g>
      <text
        x={lx}
        y={ly}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          fill: '#ffffff',
          letterSpacing: '0.5px',
        }}
      >
        {payload.value}
      </text>
    </g>
  );
}

export default function DiagnosticRadar({ dimensionScores }: DiagnosticRadarProps) {
  // Build ordered data — always 4 dims
  const orderedKeys = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

  const data = orderedKeys.map((key) => {
    const found = dimensionScores.find((d) => d.key === key);
    return {
      dimension: DIMENSION_DISPLAY[key] || key,
      score: found ? parseFloat(found.score.toFixed(2)) : 1.0,
      level: found ? found.level : 'Intuitivo',
      fullMark: 4,
    };
  });

  // Calculate average level color for fill
  const avgScore = data.reduce((sum, d) => sum + d.score, 0) / data.length;
  let fillColor = '#ff4d4d';
  if (avgScore >= 3.25) fillColor = '#FFFF02';
  else if (avgScore >= 2.5) fillColor = '#00cc66';
  else if (avgScore >= 1.75) fillColor = '#ff9900';

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '280px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid
            stroke="rgba(255,255,255,0.08)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={(props) => <CustomAngleAxisTick {...props} />}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 4]}
            tickCount={5}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke={fillColor}
            strokeWidth={2}
            fill={fillColor}
            fillOpacity={0.12}
            dot={{ r: 4, fill: fillColor, strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
