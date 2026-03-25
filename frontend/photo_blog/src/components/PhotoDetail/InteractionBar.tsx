import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleReaction } from '../../api/client';
import { useSoundContext } from '../../contexts/SoundContext';

// Lazy-load both the emoji data (~300KB) and picker component (~200KB)
const emojiDataPromise = import('@emoji-mart/data').then(m => m.default);
const pickerPromise = import('@emoji-mart/react');
const Picker = lazy(() => pickerPromise);

// Prefetch: call on hover/focus of "+" button to start loading before click
function prefetchPicker() {
  // Accessing the promises is enough — they're already initiated above
  // but this ensures the browser prioritizes them
  void emojiDataPromise;
  void pickerPromise;
}

const PRESET_EMOJIS = ['✊', '😪', '🥶', '😷', '👎'];

interface Props {
  photoSlug: string;
  reactionSummary: Record<string, number>;
  userReactions: string[];
  isAuthenticated: boolean;
  onLoginPrompt: () => void;
  onReactionChange: (summary: Record<string, number>, userReactions: string[]) => void;
}

export default function InteractionBar({
  photoSlug,
  reactionSummary,
  userReactions,
  isAuthenticated,
  onLoginPrompt,
  onReactionChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [bursts, setBursts] = useState<Array<{ emoji: string; key: number; x: number; y: number }>>([]);
  const [emojiData, setEmojiData] = useState<object | null>(null);
  // Prerender the picker on hover so layout cost is paid before click
  const [pickerPreloaded, setPickerPreloaded] = useState(false);
  const burstKey = useRef(0);
  const sound = useSoundContext();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Resolve emoji data on hover (before click)
  useEffect(() => {
    if (pickerPreloaded && !emojiData) {
      emojiDataPromise.then(setEmojiData);
    }
  }, [pickerPreloaded, emojiData]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('em-emoji-picker') && target !== addBtnRef.current) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const handleReact = useCallback(async (emoji: string, x: number, y: number) => {
    if (!isAuthenticated) {
      onLoginPrompt();
      return;
    }

    // Optimistic update
    const wasActive = userReactions.includes(emoji);
    const newUserReactions = wasActive
      ? userReactions.filter(e => e !== emoji)
      : [...userReactions, emoji];
    const newSummary = { ...reactionSummary };
    if (wasActive) {
      newSummary[emoji] = (newSummary[emoji] ?? 1) - 1;
      if (newSummary[emoji] <= 0) delete newSummary[emoji];
    } else {
      newSummary[emoji] = (newSummary[emoji] ?? 0) + 1;
    }
    onReactionChange(newSummary, newUserReactions);

    if (!wasActive) {
      sound.play('react');
      setBursts(prev => [...prev, { emoji, key: ++burstKey.current, x, y }]);
    }

    try {
      const res = await toggleReaction(photoSlug, emoji);
      onReactionChange(res.reaction_summary, res.active
        ? [...userReactions.filter(e => e !== emoji), emoji]
        : userReactions.filter(e => e !== emoji));
    } catch {
      // Revert on error
      onReactionChange(reactionSummary, userReactions);
    }
  }, [isAuthenticated, onLoginPrompt, userReactions, reactionSummary, onReactionChange, photoSlug, sound]);

  const handlePickerSelect = useCallback((emojiData: { native: string }) => {
    setPickerOpen(false);
    const rect = addBtnRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    handleReact(emojiData.native, x, y);
  }, [handleReact]);

  // Merge preset emojis with any others that have counts
  const allEmojis = [...new Set([
    ...PRESET_EMOJIS,
    ...Object.keys(reactionSummary),
  ])];

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        {allEmojis.map(emoji => {
          const count = reactionSummary[emoji] ?? 0;
          const isActive = userReactions.includes(emoji);
          const isPreset = PRESET_EMOJIS.includes(emoji);
          // Only show non-preset emojis if they have a count
          if (!isPreset && count === 0) return null;
          return (
            <ReactionButton
              key={emoji}
              emoji={emoji}
              count={count}
              isActive={isActive}
              onClick={(x, y) => handleReact(emoji, x, y)}
            />
          );
        })}
        <motion.button
          ref={addBtnRef}
          style={styles.addBtn}
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            if (!isAuthenticated) { onLoginPrompt(); return; }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPickerPos({ x: rect.left, y: rect.top });
            setPickerOpen(prev => !prev);
          }}
          title="Add reaction"
          onPointerEnter={() => { prefetchPicker(); setPickerPreloaded(true); }}
        >
          +
        </motion.button>
      </div>

      {/* Emoji picker — rendered via portal. Prerendered on hover so the web
          component shadow DOM is laid out before the user clicks. Toggled via
          visibility + opacity (compositor-only) to avoid triggering layout. */}
      {pickerPreloaded && emojiData && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 352,
            height: 435,
            overflow: 'hidden',
            borderRadius: 10,
            transform: pickerPos
              ? `translate(${pickerPos.x}px, ${pickerPos.y - 435 - 8}px)`
              : 'translate(-9999px, -9999px)',
            opacity: pickerOpen ? 1 : 0,
            visibility: pickerOpen ? 'visible' as const : 'hidden' as const,
            pointerEvents: pickerOpen ? 'auto' as const : 'none' as const,
            zIndex: 9999,
            transition: 'opacity 0.15s ease-out',
          }}
        >
          <Suspense fallback={<div style={styles.pickerLoading}>Loading…</div>}>
            <Picker
              data={emojiData}
              onEmojiSelect={handlePickerSelect}
              theme="light"
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={1}
            />
          </Suspense>
        </div>,
        document.body,
      )}

      {/* Particle bursts — rendered via portal at fixed screen coordinates */}
      {bursts.length > 0 && createPortal(
        <AnimatePresence>
          {bursts.map(burst => (
            <ParticleBurst
              key={burst.key}
              emoji={burst.emoji}
              x={burst.x}
              y={burst.y}
              onDone={() => setBursts(prev => prev.filter(b => b.key !== burst.key))}
            />
          ))}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function ReactionButton({ emoji, count, isActive, onClick }: {
  emoji: string;
  count: number;
  isActive: boolean;
  onClick: (x: number, y: number) => void;
}) {
  return (
    <motion.button
      style={{
        ...styles.reactionBtn,
        background: isActive ? 'var(--accent-light)' : 'var(--platinum)',
        borderTop: isActive ? '1px solid var(--bevel-shadow)' : '1px solid var(--bevel-highlight)',
        borderLeft: isActive ? '1px solid var(--bevel-shadow)' : '1px solid var(--bevel-highlight)',
        borderBottom: isActive ? '1px solid var(--bevel-highlight)' : '1px solid var(--bevel-shadow)',
        borderRight: isActive ? '1px solid var(--bevel-highlight)' : '1px solid var(--bevel-shadow)',
      }}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }}
    >
      <span style={{ fontSize: 16 }}>{emoji}</span>
      {count > 0 && <span style={styles.count}>{count}</span>}
    </motion.button>
  );
}

/** Particle burst: small colored dots radiate outward and fade. */
function ParticleBurst({ emoji, x, y, onDone }: { emoji: string; x: number; y: number; onDone: () => void }) {
  const PARTICLE_COUNT = 10;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 20;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 0.05,
      };
    }),
  ).current;

  useEffect(() => {
    const timer = setTimeout(onDone, 500);
    return () => clearTimeout(timer);
  }, [onDone]);

  void emoji;

  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.4, delay: p.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `hsl(${(i / PARTICLE_COUNT) * 360}, 70%, 60%)`,
          }}
        />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  reactionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: 13,
  },
  count: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    borderRadius: 0,
    background: 'var(--platinum)',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--text-secondary)',
  },
  pickerLoading: {
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--text-muted)',
    background: 'var(--platinum)',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    borderRadius: 0,
  },
};
