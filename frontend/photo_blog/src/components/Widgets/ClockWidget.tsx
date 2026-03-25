import { useState, useEffect } from 'react';

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const cx = 50, cy = 50;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--platinum)',
      padding: 4,
    }}>
      <svg viewBox="0 0 100 100" style={{
        width: 110,
        height: 110,
        background: 'var(--inset-bg)',
        borderTop: '2px solid var(--bevel-shadow)',
        borderLeft: '2px solid var(--bevel-shadow)',
        borderBottom: '2px solid var(--bevel-highlight)',
        borderRight: '2px solid var(--bevel-highlight)',
      }}>
        {/* Hour markers */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = i * 30 * Math.PI / 180;
          const r1 = 42, r2 = 46;
          return (
            <line
              key={i}
              x1={cx + r1 * Math.sin(angle)}
              y1={cy - r1 * Math.cos(angle)}
              x2={cx + r2 * Math.sin(angle)}
              y2={cy - r2 * Math.cos(angle)}
              stroke="var(--iron-grey)"
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
          );
        })}

        {/* Hour hand */}
        <line
          x1={cx} y1={cy}
          x2={cx + 24 * Math.sin(hourAngle * Math.PI / 180)}
          y2={cy - 24 * Math.cos(hourAngle * Math.PI / 180)}
          stroke="var(--carbon-black)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Minute hand */}
        <line
          x1={cx} y1={cy}
          x2={cx + 34 * Math.sin(minuteAngle * Math.PI / 180)}
          y2={cy - 34 * Math.cos(minuteAngle * Math.PI / 180)}
          stroke="var(--carbon-black)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Second hand */}
        <line
          x1={cx} y1={cy}
          x2={cx + 38 * Math.sin(secondAngle * Math.PI / 180)}
          y2={cy - 38 * Math.cos(secondAngle * Math.PI / 180)}
          stroke="var(--close-hover)"
          strokeWidth={1}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2.5} fill="var(--carbon-black)" />
      </svg>

      <span style={{
        marginTop: 4,
        fontSize: 11,
        fontFamily: "'PixeAn', monospace",
        color: 'var(--text-secondary)',
      }}>
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}
