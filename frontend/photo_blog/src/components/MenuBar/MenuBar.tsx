import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Category } from '../../types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useSoundContext } from '../../contexts/SoundContext';
import MenuDropdown from './MenuDropdown';

interface Props {
  categories: Category[];
  onOpenAllPhotos: () => void;
  onOpenCategory: (slug: string, name: string) => void;
  onOpenStatic: (key: 'about' | 'contact' | 'share') => void;
  onToggleGridSize: () => void;
  onOpenLogin: () => void;
  onOpenUpload: () => void;
  onResetDesktop?: () => void;
}

export default function MenuBar({ categories, onOpenAllPhotos, onOpenCategory, onOpenStatic, onToggleGridSize, onOpenLogin, onOpenUpload, onResetDesktop }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenu(prev => {
      const next = prev === name ? null : name;
      if (next) sound.play('menuOpen');
      return next;
    });
  };

  const closeMenu = () => setOpenMenu(null);

  const { isAuthenticated, logout } = useAuthContext();
  const sound = useSoundContext();

  const ctrlKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+';

  const menus: Record<string, { label: string; action?: () => void; divider?: boolean; disabled?: boolean; external?: boolean; shortcut?: string }[]> = {
    File: [
      { label: 'New Window', action: onOpenAllPhotos, shortcut: `${ctrlKey}N` },
      { label: 'Close Window', shortcut: `${ctrlKey}W`, disabled: true },
      { label: '', divider: true },
      ...(isAuthenticated
        ? [
            { label: 'Upload Photos...', action: onOpenUpload },
            { label: '', divider: true },
            { label: 'Log Out', action: () => { logout(); closeMenu(); } },
          ]
        : [
            { label: 'Log In...', action: onOpenLogin },
          ]),
      { label: '', divider: true },
      { label: 'Reset Desktop', action: onResetDesktop },
      { label: '', divider: true },
      { label: 'Switch to Website Mode', disabled: true },
    ],
    View: [
      { label: 'Show All Photos', action: onOpenAllPhotos },
      { label: '', divider: true },
      { label: 'Toggle Grid Size', action: onToggleGridSize },
      { label: 'Cycle Windows', shortcut: `${ctrlKey}\``, disabled: true },
    ],
    Go: [
      { label: 'Home', action: onOpenAllPhotos },
      { label: 'All Photos', action: onOpenAllPhotos },
      ...categories.map(c => ({ label: c.name, action: () => onOpenCategory(c.slug, c.name) })),
      { label: '', divider: true },
      { label: 'About', action: () => onOpenStatic('about') },
      { label: 'Contact', action: () => onOpenStatic('contact') },
    ],
    Help: [
      { label: 'Share', action: () => onOpenStatic('share') },
      { label: 'GitHub', action: () => window.open('https://github.com/rangaemani', '_blank'), external: true },
    ],
  };

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={styles.logo}>📟</span>
        {Object.keys(menus).map(name => (
          <div key={name} style={{ position: 'relative' }}>
            <button
              style={{
                ...styles.menuBtn,
                background: openMenu === name ? 'rgba(0,0,0,0.06)' : 'transparent',
              }}
              onClick={() => toggleMenu(name)}
              onMouseEnter={() => { if (openMenu && openMenu !== name) setOpenMenu(name); }}
            >
              {name}
            </button>
            <AnimatePresence>
              {openMenu === name && (
                <MenuDropdown key={name} items={menus[name]} onClose={closeMenu} />
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div style={styles.right}>
        <button
          style={styles.muteBtn}
          onClick={sound.toggleMute}
          title={sound.muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {sound.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
        </button>
        <span style={styles.clock}>{clock}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    background: 'var(--menubar-bg)',
    borderBottom: '1px solid var(--menubar-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    zIndex: 9999,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    fontSize: 14,
    marginRight: 8,
  },
  menuBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: '#333',
    padding: '2px 10px',
    borderRadius: 4,
  },
  muteBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    padding: '0 6px',
    lineHeight: 1,
  },
  clock: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'ui-monospace, monospace',
  },
};
