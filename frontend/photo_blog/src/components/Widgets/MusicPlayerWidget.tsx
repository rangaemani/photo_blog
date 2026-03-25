import { useState, useEffect, useRef } from 'react';

interface Track {
  title: string;
  src: string;
}

// Add MP3 files to /public/music/ and list them here
const TRACKS: Track[] = [
  // { title: 'Track Name', src: '/music/track.mp3' },
];

const STORAGE_KEY = 'widget_music_data';

function loadState(): { index: number; volume: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { index: 0, volume: 0.7 };
}

export default function MusicPlayerWidget() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const saved = loadState();
  const [trackIdx, setTrackIdx] = useState(saved.index);
  const [volume, setVolume] = useState(saved.volume);

  const track = TRACKS[trackIdx] ?? null;
  const hasTracks = TRACKS.length > 0;

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: trackIdx, volume }));
  }, [trackIdx, volume]);

  // Update audio src on track change
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    a.src = track.src;
    a.volume = volume;
    if (playing) a.play().catch(() => setPlaying(false));
  }, [trackIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume change
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const prev = () => setTrackIdx(i => (i - 1 + TRACKS.length) % TRACKS.length);
  const next = () => setTrackIdx(i => (i + 1) % TRACKS.length);

  return (
    <div style={{
      width: '100%', height: '100%', padding: 4,
      background: 'var(--platinum)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <audio
        ref={audioRef}
        onTimeUpdate={e => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onEnded={next}
      />

      {/* Track name */}
      <div style={{
        borderTop: '1px solid var(--bevel-shadow)',
        borderLeft: '1px solid var(--bevel-shadow)',
        borderBottom: '1px solid var(--bevel-highlight)',
        borderRight: '1px solid var(--bevel-highlight)',
        background: 'var(--inset-bg)',
        padding: '2px 4px',
        fontSize: 10,
        color: 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {hasTracks ? (track?.title ?? 'Unknown') : 'No tracks — add MP3s to /public/music/'}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        borderTop: '1px solid var(--bevel-shadow)',
        borderLeft: '1px solid var(--bevel-shadow)',
        borderBottom: '1px solid var(--bevel-highlight)',
        borderRight: '1px solid var(--bevel-highlight)',
        background: 'var(--inset-bg)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${progress * 100}%`,
          background: 'var(--accent)',
        }} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <button className="win-btn" onClick={prev} disabled={!hasTracks} style={{ fontSize: 9, padding: '0 6px' }}>&#9664;&#9664;</button>
        <button className="win-btn" onClick={togglePlay} disabled={!hasTracks} style={{ fontSize: 9, padding: '0 8px', fontWeight: 700 }}>
          {playing ? '&#9646;&#9646;' : '&#9654;'}
        </button>
        <button className="win-btn" onClick={next} disabled={!hasTracks} style={{ fontSize: 9, padding: '0 6px' }}>&#9654;&#9654;</button>
        <input
          type="range" min={0} max={1} step={0.05}
          value={volume}
          onChange={e => setVolume(Number(e.target.value))}
          style={{ flex: 1, height: 12, cursor: 'pointer' }}
          title="Volume"
        />
      </div>
    </div>
  );
}
