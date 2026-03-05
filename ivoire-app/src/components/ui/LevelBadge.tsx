import type { MaturityLevel } from '../../types';

interface LevelBadgeProps {
  level: MaturityLevel;
  size?: 'sm' | 'md' | 'lg';
}

const LEVEL_META: Record<MaturityLevel, { color: string; dot: string }> = {
  Intuitivo: { color: '#ff4d4d', dot: '#ff4d4d' },
  Reativo:   { color: '#ff9900', dot: '#ff9900' },
  Ativo:     { color: '#00cc66', dot: '#00cc66' },
  Exponencial: { color: '#FFFF02', dot: '#FFFF02' },
};

const SIZE_CONFIG = {
  sm: {
    fontSize: '10px',
    padding: '2px 8px',
    dotSize: '5px',
    gap: '5px',
    borderRadius: '3px',
    letterSpacing: '1px',
  },
  md: {
    fontSize: '11px',
    padding: '4px 10px',
    dotSize: '6px',
    gap: '6px',
    borderRadius: '4px',
    letterSpacing: '1.2px',
  },
  lg: {
    fontSize: '13px',
    padding: '6px 14px',
    dotSize: '8px',
    gap: '8px',
    borderRadius: '4px',
    letterSpacing: '1.5px',
  },
};

export default function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const meta = LEVEL_META[level];
  const sizeConf = SIZE_CONFIG[size];

  const bgClass = `level-bg-${level.toLowerCase()}`;

  return (
    <span
      className={bgClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeConf.gap,
        padding: sizeConf.padding,
        borderRadius: sizeConf.borderRadius,
        fontFamily: 'Montserrat',
        fontSize: sizeConf.fontSize,
        fontWeight: 700,
        letterSpacing: sizeConf.letterSpacing,
        textTransform: 'uppercase',
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: sizeConf.dotSize,
          height: sizeConf.dotSize,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
          boxShadow: `0 0 4px ${meta.dot}`,
        }}
      />
      {level}
    </span>
  );
}
