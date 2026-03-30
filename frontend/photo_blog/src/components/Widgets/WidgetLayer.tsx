import { AnimatePresence } from 'framer-motion';
import type { WidgetState, WidgetType } from '../../types';
import { isMobile } from '../../utils/position';
import WidgetShell from './WidgetShell';
import ClockWidget from './ClockWidget';
import NotesWidget from './NotesWidget';
import WeatherWidget from './WeatherWidget';
import SystemInfoWidget from './SystemInfoWidget';
import MusicPlayerWidget from './MusicPlayerWidget';

const WIDGET_TITLES: Record<WidgetType, string> = {
  clock:       'Clock',
  notes:       'Sticky Notes',
  weather:     'Weather',
  systemInfo:  'System Info',
  musicPlayer: 'Music Player',
};

const WIDGET_SIZES: Record<WidgetType, { width: number; height: number }> = {
  clock:       { width: 140, height: 160 },
  notes:       { width: 200, height: 220 },
  weather:     { width: 180, height: 140 },
  systemInfo:  { width: 220, height: 180 },
  musicPlayer: { width: 240, height: 120 },
};

function WidgetContent({ type }: { type: WidgetType }) {
  switch (type) {
    case 'clock':       return <ClockWidget />;
    case 'notes':       return <NotesWidget />;
    case 'weather':     return <WeatherWidget />;
    case 'systemInfo':  return <SystemInfoWidget />;
    case 'musicPlayer': return <MusicPlayerWidget />;
  }
}

interface Props {
  widgets: WidgetState[];
  onMove: (id: string, x: number, y: number) => void;
  onClose: (id: string) => void;
}

export default function WidgetLayer({ widgets, onMove, onClose }: Props) {
  // Widgets are floating overlays; on mobile all windows are fullscreen (z-index 100+)
  // and would cover widgets (z-index 50). Suppress the layer entirely on mobile.
  if (isMobile()) return null;

  return (
    <AnimatePresence>
      {widgets.filter(w => w.isOpen).map(w => {
        const { width, height } = WIDGET_SIZES[w.type];
        return (
          <WidgetShell
            key={w.id}
            title={WIDGET_TITLES[w.type]}
            width={width}
            height={height}
            x={w.position.x}
            y={w.position.y}
            onMove={(x, y) => onMove(w.id, x, y)}
            onClose={() => onClose(w.id)}
          >
            <WidgetContent type={w.type} />
          </WidgetShell>
        );
      })}
    </AnimatePresence>
  );
}
