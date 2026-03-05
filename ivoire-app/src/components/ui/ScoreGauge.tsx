import type { MaturityLevel } from '../../types';

interface ScoreGaugeProps {
  score: number;
  level: MaturityLevel;
  size?: 'sm' | 'lg';
}

const LEVEL_COLOR: Record<MaturityLevel, string> = {
  Intuitivo: '#ff4d4d',
  Reativo: '#ff9900',
  Ativo: '#00cc66',
  Exponencial: '#FFFF02',
};

const SIZE_CONFIG = {
  sm: {
    svgSize: 96,
    strokeWidth: 7,
    r: 36,
    scoreFontSize: '22px',
    labelFontSize: '8px',
    levelFontSize: '9px',
  },
  lg: {
    svgSize: 160,
    strokeWidth: 10,
    r: 62,
    scoreFontSize: '38px',
    labelFontSize: '10px',
    levelFontSize: '11px',
  },
};

export default function ScoreGauge({ score, level, size = 'lg' }: ScoreGaugeProps) {
  const conf = SIZE_CONFIG[size];
  const color = LEVEL_COLOR[level];

  const cx = conf.svgSize / 2;
  const cy = conf.svgSize / 2;
  const r = conf.r;

  // Arc covers 240 degrees (from 150deg to 390deg, i.e. 150deg to 30deg going clockwise)
  // score range: 1.0 to 4.0  =>  normalise to 0..1
  const MIN_SCORE = 1.0;
  const MAX_SCORE = 4.0;
  const normalised = Math.max(0, Math.min(1, (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)));

  const ARC_DEGREES = 240;
  const START_ANGLE_DEG = 150; // bottom-left
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const startAngle = toRad(START_ANGLE_DEG);
  const endAngle = toRad(START_ANGLE_DEG + ARC_DEGREES);
  const fillAngle = toRad(START_ANGLE_DEG + ARC_DEGREES * normalised);

  const polarToCartesian = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const describeArc = (from: number, to: number) => {
    const start = polarToCartesian(from);
    const end = polarToCartesian(to);
    const largeArcFlag = to - from > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  const trackPath = describeArc(startAngle, endAngle);
  const fillPath = normalised > 0 ? describeArc(startAngle, fillAngle) : '';

  const displayScore = score.toFixed(1);

  // Tick marks at each integer score (1, 2, 3, 4)
  const ticks = [1, 2, 3, 4].map((val) => {
    const t = (val - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
    const angle = toRad(START_ANGLE_DEG + ARC_DEGREES * t);
    const inner = {
      x: cx + (r - conf.strokeWidth - 4) * Math.cos(angle),
      y: cy + (r - conf.strokeWidth - 4) * Math.sin(angle),
    };
    const outer = {
      x: cx + (r + 4) * Math.cos(angle),
      y: cy + (r + 4) * Math.sin(angle),
    };
    return { inner, outer, val };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <div style={{ position: 'relative', width: conf.svgSize, height: conf.svgSize }}>
        <svg
          width={conf.svgSize}
          height={conf.svgSize}
          style={{ overflow: 'visible' }}
        >
          {/* Track (background arc) */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={conf.strokeWidth}
            strokeLinecap="round"
          />

          {/* Filled arc */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={color}
              strokeWidth={conf.strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${color}60)`,
              }}
            />
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <line
              key={i}
              x1={tick.inner.x}
              y1={tick.inner.y}
              x2={tick.outer.x}
              y2={tick.outer.y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
            />
          ))}

          {/* Center score text */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: 'Bebas Neue, cursive',
              fontSize: conf.scoreFontSize,
              fill: color,
              filter: `drop-shadow(0 0 8px ${color}80)`,
            }}
          >
            {displayScore}
          </text>

          {/* /4.0 label */}
          <text
            x={cx}
            y={cy + parseInt(conf.scoreFontSize) * 0.5 + 2}
            textAnchor="middle"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: conf.labelFontSize,
              fill: 'rgba(255,255,255,0.35)',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            / 4.0
          </text>
        </svg>
      </div>

      {/* Level label below gauge */}
      <div
        style={{
          fontFamily: 'Montserrat',
          fontSize: conf.levelFontSize,
          fontWeight: 700,
          color,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginTop: '-8px',
        }}
      >
        {level}
      </div>
    </div>
  );
}
