import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'widget_notes_data';

export default function NotesWidget() {
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, val);
    }, 300);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div style={{ width: '100%', height: '100%', padding: 4, background: 'var(--platinum)' }}>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="notes..."
        style={{
          width: '100%',
          height: '100%',
          resize: 'none',
          fontFamily: "'PixeAn', monospace",
          fontSize: 11,
          color: 'var(--carbon-black)',
          background: 'var(--inset-bg)',
          borderTop: '2px solid var(--bevel-shadow)',
          borderLeft: '2px solid var(--bevel-shadow)',
          borderBottom: '2px solid var(--bevel-highlight)',
          borderRight: '2px solid var(--bevel-highlight)',
          padding: 4,
          outline: 'none',
          userSelect: 'text',
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}
