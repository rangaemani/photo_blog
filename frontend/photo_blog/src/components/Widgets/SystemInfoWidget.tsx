import { useState, useEffect } from 'react';

interface SysInfo {
  platform: string;
  language: string;
  screen: string;
  connection: string;
  battery: string;
  cores: string;
  memory: string;
  userAgent: string;
}

function parseUA(ua: string): string {
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|Brave)\/[\d.]+/);
  return match ? match[0] : ua.slice(0, 40);
}

export default function SystemInfoWidget() {
  const [info, setInfo] = useState<SysInfo | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
      deviceMemory?: number;
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };

    const data: SysInfo = {
      platform: nav.platform || 'N/A',
      language: nav.language || 'N/A',
      screen: `${screen.width}x${screen.height}`,
      connection: nav.connection?.effectiveType
        ?? (nav.onLine ? (nav.connection?.downlink ? `${nav.connection.downlink} Mbps` : 'Online') : 'Offline'),
      cores: nav.hardwareConcurrency ? `${nav.hardwareConcurrency}` : 'N/A',
      memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'N/A',
      battery: 'N/A',
      userAgent: parseUA(nav.userAgent),
    };

    if (nav.getBattery) {
      nav.getBattery().then(b => {
        setInfo({ ...data, battery: `${Math.round(b.level * 100)}%${b.charging ? ' +' : ''}` });
      }).catch(() => setInfo(data));
    } else {
      setInfo(data);
    }
  }, []);

  if (!info) return null;

  const rows: [string, string][] = [
    ['Platform', info.platform],
    ['Browser', info.userAgent],
    ['Screen', info.screen],
    ['Language', info.language],
    ['Connection', info.connection],
    ['CPU Cores', info.cores],
    ['Memory', info.memory],
    ['Battery', info.battery],
  ];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: 4,
      background: 'var(--platinum)',
      overflow: 'auto',
    }}>
      <div style={{
        borderTop: '1px solid var(--bevel-shadow)',
        borderLeft: '1px solid var(--bevel-shadow)',
        borderBottom: '1px solid var(--bevel-highlight)',
        borderRight: '1px solid var(--bevel-highlight)',
        background: 'var(--inset-bg)',
        padding: 4,
      }}>
        {rows.map(([key, val]) => (
          <div key={key} style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            padding: '1px 2px',
            borderBottom: '1px solid var(--alabaster-grey)',
          }}>
            <span style={{ color: 'var(--slate-grey)' }}>{key}</span>
            <span style={{ color: 'var(--carbon-black)', textAlign: 'right', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
