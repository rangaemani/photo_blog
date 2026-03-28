import { useEffect, useRef } from 'react';

/**
 * Win98-style indeterminate progress ticker.
 * Renders a small inset bar with a marching highlight block.
 * Use inline for button-adjacent feedback or as a full-width bar via `block` prop.
 */
interface Props {
  /** Render as a full-width block bar (e.g. below a toolbar) instead of inline */
  block?: boolean;
}

export default function Throbber({ block }: Props) {
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = blockRef.current;
    if (!el) return;
    const totalWidth = el.offsetWidth;
    const highlightWidth = Math.max(40, Math.floor(totalWidth * 0.25));
    let pos = -highlightWidth;
    let raf: number;

    function step() {
      pos += 2;
      if (pos > totalWidth) pos = -highlightWidth;
      if (el) el.style.backgroundPosition = `${pos}px 0`;
      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (block) {
    return (
      <div style={styles.blockTrack}>
        <div ref={blockRef} style={styles.blockBar} />
      </div>
    );
  }

  return (
    <span style={styles.inlineTrack}>
      <span ref={blockRef as React.RefObject<HTMLSpanElement>} style={styles.inlineBar} />
    </span>
  );
}

const HIGHLIGHT =
  'linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--bright-snow) 60%, var(--accent) 80%, transparent 100%)';

const styles: Record<string, React.CSSProperties> = {
  blockTrack: {
    height: 6,
    background: 'var(--inset-bg)',
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  blockBar: {
    height: '100%',
    width: '100%',
    backgroundImage: HIGHLIGHT,
    backgroundSize: '200px 100%',
    backgroundRepeat: 'no-repeat',
  },
  inlineTrack: {
    display: 'inline-block',
    width: 40,
    height: 10,
    verticalAlign: 'middle',
    background: 'var(--inset-bg)',
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
    overflow: 'hidden',
    position: 'relative',
  },
  inlineBar: {
    display: 'block',
    height: '100%',
    width: '100%',
    backgroundImage: HIGHLIGHT,
    backgroundSize: '60px 100%',
    backgroundRepeat: 'no-repeat',
    position: 'absolute',
    inset: 0,
  },
};
