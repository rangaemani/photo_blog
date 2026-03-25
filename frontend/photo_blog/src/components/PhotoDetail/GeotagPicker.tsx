import { useState, useRef, useEffect, useCallback } from 'react';
import { patchPhotoLocation } from '../../api/client';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

interface Props {
  photoSlug: string;
  currentLat: number | null;
  currentLng: number | null;
  onSaved: (lat: number | null, lng: number | null) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: 11,
  padding: '3px 5px',
  borderTop: '2px solid var(--bevel-shadow)',
  borderLeft: '2px solid var(--bevel-shadow)',
  borderBottom: '2px solid var(--bevel-highlight)',
  borderRight: '2px solid var(--bevel-highlight)',
  background: 'var(--inset-bg)',
  outline: 'none',
  minWidth: 0,
};

const BTN_STYLE: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderTop: '1px solid var(--bevel-highlight)',
  borderLeft: '1px solid var(--bevel-highlight)',
  borderBottom: '1px solid var(--bevel-shadow)',
  borderRight: '1px solid var(--bevel-shadow)',
  background: 'var(--pale-slate)',
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap' as const,
};

export default function GeotagPicker({ photoSlug, currentLat, currentLng, onSaved }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasLocation = currentLat !== null && currentLng !== null;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'photo-blog-geotag/1.0' } },
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setError('Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await patchPhotoLocation(photoSlug, parseFloat(selected.lat), parseFloat(selected.lon));
      onSaved(parseFloat(selected.lat), parseFloat(selected.lon));
      setOpen(false);
      setSelected(null);
      setQuery('');
      setResults([]);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await patchPhotoLocation(photoSlug, null, null);
      onSaved(null, null);
      setSelected(null);
      setQuery('');
    } catch {
      setError('Clear failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Section header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Location
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {hasLocation && !open && (
            <button style={{ ...BTN_STYLE, fontSize: 10 }} onClick={handleClear} disabled={saving}>
              Clear
            </button>
          )}
          <button
            style={{ ...BTN_STYLE, fontSize: 10, background: open ? 'var(--alabaster-grey)' : 'var(--pale-slate)' }}
            onClick={() => { setOpen(o => !o); setSelected(null); setQuery(''); setResults([]); }}
          >
            {open ? 'Cancel' : hasLocation ? 'Edit' : 'Set'}
          </button>
        </div>
      </div>

      {/* Current location display */}
      {hasLocation && !open && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>
          {currentLat!.toFixed(4)}, {currentLng!.toFixed(4)}
        </div>
      )}

      {/* Search UI */}
      {open && (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              style={INPUT_STYLE}
              placeholder="Search place name…"
              value={query}
              autoFocus
              onChange={e => { setQuery(e.target.value); search(e.target.value); setSelected(null); }}
            />
            {selected && (
              <button style={BTN_STYLE} onClick={handleSave} disabled={saving}>
                {saving ? '…' : 'Save'}
              </button>
            )}
          </div>

          {/* Selected preview */}
          {selected && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 2 }}>
              {parseFloat(selected.lat).toFixed(5)}, {parseFloat(selected.lon).toFixed(5)}
            </div>
          )}

          {/* Results dropdown */}
          {results.length > 0 && !selected && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 200,
              background: 'var(--inset-bg)',
              borderTop: '2px solid var(--bevel-shadow)',
              borderLeft: '2px solid var(--bevel-shadow)',
              borderBottom: '2px solid var(--bevel-highlight)',
              borderRight: '2px solid var(--bevel-highlight)',
              maxHeight: 180,
              overflowY: 'auto',
            }}>
              {results.map(r => (
                <button
                  key={r.place_id}
                  onClick={() => { setSelected(r); setQuery(r.display_name); setResults([]); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--groove-dark)',
                    padding: '4px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.type}</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name}</div>
                </button>
              ))}
            </div>
          )}

          {searching && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 2 }}>Searching…</div>
          )}
          {error && (
            <div style={{ fontSize: 10, color: '#c03030', marginTop: 3, paddingLeft: 2 }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
