import { useState } from 'react';

export interface DebugSection {
  title: string;
  data: Record<string, string | number | boolean | null | undefined>;
}

interface DebugPanelProps {
  sections: DebugSection[];
  defaultOpen?: boolean;
}

const RAISED: React.CSSProperties = {
  borderTop: '2px solid var(--bevel-highlight)',
  borderLeft: '2px solid var(--bevel-highlight)',
  borderBottom: '2px solid var(--bevel-dark)',
  borderRight: '2px solid var(--bevel-dark)',
};

const SUNKEN: React.CSSProperties = {
  borderTop: '2px solid var(--bevel-shadow)',
  borderLeft: '2px solid var(--bevel-shadow)',
  borderBottom: '2px solid var(--bevel-highlight)',
  borderRight: '2px solid var(--bevel-highlight)',
};

function valueColor(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return 'var(--text-muted)';
  if (typeof v === 'boolean') return v ? '#2a6e2a' : '#8b1a1a';
  if (typeof v === 'number') return '#1a3f8b';
  return 'var(--text-primary)';
}

export function DebugPanel({ sections, defaultOpen = false }: DebugPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 200,
        fontFamily: "'PixeAn', 'MS Sans Serif', monospace",
        fontSize: 10,
        lineHeight: '14px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'block',
          marginLeft: 'auto',
          padding: '1px 6px',
          background: open ? 'var(--panel-bg)' : 'var(--window-bg)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 10,
          color: 'var(--text-primary)',
          ...(open ? SUNKEN : RAISED),
        }}
      >
        DBG
      </button>

      {open && (
        <div
          style={{
            marginTop: 2,
            background: 'var(--window-bg)',
            minWidth: 180,
            maxWidth: 260,
            ...RAISED,
          }}
        >
          {sections.map((section, si) => (
            <div key={si}>
              {/* Section title bar */}
              <div
                style={{
                  background: 'var(--window-titlebar-bg)',
                  color: 'var(--text-secondary)',
                  padding: '1px 5px',
                  fontSize: 9,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--bevel-shadow)',
                }}
              >
                {section.title}
              </div>

              {/* Key-value rows */}
              <div style={{ padding: '3px 5px', ...SUNKEN, margin: 3, background: 'var(--inset-bg)' }}>
                {Object.entries(section.data).map(([key, value]) => (
                  <div
                    key={key}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{key}</span>
                    <span style={{ color: valueColor(value), fontWeight: 'bold', textAlign: 'right' }}>
                      {value === null || value === undefined ? '—' : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
