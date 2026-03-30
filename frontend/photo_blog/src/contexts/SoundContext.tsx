import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type SoundName =
  | 'windowOpen'
  | 'windowClose'
  | 'windowMinimize'
  | 'windowMaximize'
  | 'click'
  | 'dragStart'
  | 'drop'
  | 'dropTrash'
  | 'emptyTrash'
  | 'uploadComplete'
  | 'error'
  | 'menuOpen'
  | 'shutter'
  | 'react'
  | 'comment';

interface SoundContextValue {
  play: (name: SoundName) => void;
  muted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

const MUTE_KEY = 'sound_muted';

/**
 * Access the sound system. Must be called within a `SoundProvider`.
 *
 * @returns `play(name)` to trigger a sound effect, `muted` state, and `toggleMute`.
 */
export function useSoundContext(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSoundContext must be used inside SoundProvider');
  return ctx;
}

/**
 * Synthesizes short retro system sounds using the Web Audio API.
 * No external audio files needed — all sounds are generated procedurally.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      synthesizers[name]?.(ctx);
    } catch { /* audio not available */ }
  }, [getCtx]);

  return (
    <SoundContext.Provider value={{ play, muted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
}

// --- Synthesizers ---
// Each function creates a short procedural sound effect using Web Audio API oscillators and gain nodes.

type Synth = (ctx: AudioContext) => void;

function beep(ctx: AudioContext, freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function noise(ctx: AudioContext, duration: number, volume = 0.06) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

const synthesizers: Record<SoundName, Synth> = {
  // Window open: rising two-tone chime (Mac-like)
  windowOpen(ctx) {
    beep(ctx, 660, 0.08, 'sine', 0.10);
    setTimeout(() => beep(ctx, 880, 0.12, 'sine', 0.10), 60);
  },

  // Window close: descending pop
  windowClose(ctx) {
    beep(ctx, 520, 0.06, 'sine', 0.10);
    setTimeout(() => beep(ctx, 380, 0.08, 'sine', 0.08), 40);
  },

  // Minimize: quick descending sweep
  windowMinimize(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.10, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },

  // Maximize: quick ascending sweep
  windowMaximize(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.10, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },

  // Click: short tick
  click(ctx) {
    beep(ctx, 800, 0.03, 'square', 0.06);
  },

  // Drag start: light pickup thunk
  dragStart(ctx) {
    beep(ctx, 300, 0.05, 'triangle', 0.08);
    beep(ctx, 450, 0.04, 'sine', 0.06);
  },

  // Drop: soft thud
  drop(ctx) {
    beep(ctx, 180, 0.08, 'sine', 0.12);
    noise(ctx, 0.04, 0.03);
  },

  // Trash drop: crumple
  dropTrash(ctx) {
    noise(ctx, 0.15, 0.10);
    beep(ctx, 200, 0.10, 'sawtooth', 0.04);
  },

  // Empty trash: longer crumple cascade
  emptyTrash(ctx) {
    noise(ctx, 0.3, 0.12);
    setTimeout(() => noise(ctx, 0.2, 0.08), 100);
    setTimeout(() => beep(ctx, 150, 0.15, 'sawtooth', 0.03), 50);
  },

  // Upload complete: success chime (three ascending notes)
  uploadComplete(ctx) {
    beep(ctx, 523, 0.10, 'sine', 0.10); // C5
    setTimeout(() => beep(ctx, 659, 0.10, 'sine', 0.10), 80); // E5
    setTimeout(() => beep(ctx, 784, 0.15, 'sine', 0.12), 160); // G5
  },

  // Error: low buzz
  error(ctx) {
    beep(ctx, 180, 0.15, 'sawtooth', 0.08);
    setTimeout(() => beep(ctx, 160, 0.15, 'sawtooth', 0.06), 120);
  },

  // Menu open: light click
  menuOpen(ctx) {
    beep(ctx, 1000, 0.02, 'square', 0.04);
  },

  // Photo detail open: camera shutter
  shutter(ctx) {
    // First click (shutter open)
    noise(ctx, 0.03, 0.15);
    beep(ctx, 2000, 0.02, 'square', 0.05);
    // Second click (shutter close) after brief gap
    setTimeout(() => {
      noise(ctx, 0.04, 0.12);
      beep(ctx, 1800, 0.02, 'square', 0.04);
    }, 60);
  },

  // Reaction: sparkle pop
  react(ctx) {
    beep(ctx, 1200, 0.04, 'sine', 0.10);
    beep(ctx, 1800, 0.03, 'sine', 0.06);
    setTimeout(() => beep(ctx, 2400, 0.05, 'sine', 0.08), 30);
  },

  // Comment posted: soft notification
  comment(ctx) {
    beep(ctx, 700, 0.06, 'sine', 0.08);
    setTimeout(() => beep(ctx, 900, 0.08, 'sine', 0.08), 50);
  },
};
