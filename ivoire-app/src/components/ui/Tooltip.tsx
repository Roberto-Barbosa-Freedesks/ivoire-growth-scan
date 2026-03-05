import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', maxWidth = 280, delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const gap = 8;
        let top = 0, left = 0;

        if (position === 'top') {
          top = rect.top + window.scrollY - gap;
          left = rect.left + window.scrollX + rect.width / 2;
        } else if (position === 'bottom') {
          top = rect.bottom + window.scrollY + gap;
          left = rect.left + window.scrollX + rect.width / 2;
        } else if (position === 'left') {
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.left + window.scrollX - gap;
        } else {
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.right + window.scrollX + gap;
        }
        setCoords({ top, left });
        setVisible(true);
      }
    }, delay);
  }, [position, delay]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const transformOrigin = position === 'top' ? 'center bottom'
    : position === 'bottom' ? 'center top'
    : position === 'left' ? 'right center'
    : 'left center';

  const translateStyle = position === 'top' ? 'translateX(-50%) translateY(-100%)'
    : position === 'bottom' ? 'translateX(-50%) translateY(0)'
    : position === 'left' ? 'translateX(-100%) translateY(-50%)'
    : 'translateX(0) translateY(-50%)';

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        style={{ display: 'inline-block', cursor: 'help' }}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            transform: translateStyle,
            zIndex: 9999,
            maxWidth,
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            fontSize: 12,
            fontFamily: 'Arvo, serif',
            color: '#ccc',
            lineHeight: 1.6,
            transformOrigin,
          }}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

/** Simple inline info icon with tooltip */
export function InfoTooltip({ content, maxWidth }: { content: ReactNode; maxWidth?: number }) {
  return (
    <Tooltip content={content} position="top" maxWidth={maxWidth ?? 260}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        color: '#888', fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
        cursor: 'help', flexShrink: 0, lineHeight: 1,
        transition: 'border-color 0.2s, color 0.2s',
        userSelect: 'none',
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLSpanElement).style.borderColor = 'rgba(255,255,2,0.5)';
          (e.currentTarget as HTMLSpanElement).style.color = '#FFFF02';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLSpanElement).style.borderColor = 'rgba(255,255,255,0.15)';
          (e.currentTarget as HTMLSpanElement).style.color = '#888';
        }}
      >
        ?
      </span>
    </Tooltip>
  );
}
