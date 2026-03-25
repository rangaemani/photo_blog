import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { getPhotos, fetchNextPage } from '../../api/client';
import type { PhotoListItem } from '../../types';
import { DebugPanel } from '../Debug/DebugPanel';

type GlobeMarker = { location: [number, number]; size: number; id: string };

interface BuildResult {
  markers: GlobeMarker[];
  clusters: ClusterEntry[];
}

function buildMarkers(photos: PhotoListItem[]): BuildResult {
  const counts = new Map<string, ClusterEntry>();
  for (const p of photos) {
    if (p.lat === null || p.lng === null) continue;
    // Cluster to ~11km grid (1 decimal degree)
    const lat = Math.round(p.lat * 10) / 10;
    const lng = Math.round(p.lng * 10) / 10;
    const key = `${lat},${lng}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { lat, lng, count: 1 });
  }
  const clusters = Array.from(counts.values());
  const maxCount = Math.max(...clusters.map(c => c.count), 1);
  const markers = clusters.map(({ lat, lng, count }, i) => ({
    location: [lat, lng] as [number, number],
    size: 0.01 + (count / maxCount) * 0.04,
    id: `cluster-${i}`,
  }));
  return { markers, clusters };
}

interface ClusterEntry {
  lat: number;
  lng: number;
  count: number;
}

interface FetchDebug {
  status: 'loading' | 'done' | 'error';
  photos: number;
  geotagged: number;
  clusters: number;
  clusterList: ClusterEntry[];
  error: string | null;
}

export default function GlobeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const rafRef = useRef<number>(0);
  const phiRef = useRef(0);
  const markersRef = useRef<GlobeMarker[]>([]);
  const currentSizeRef = useRef(0);
  const initGlobeRef = useRef<((size: number) => void) | null>(null);

  const [fetchDebug, setFetchDebug] = useState<FetchDebug>({
    status: 'loading', photos: 0, geotagged: 0, clusters: 0, clusterList: [], error: null,
  });
  const [liveDebug, setLiveDebug] = useState({ phi: 0, size: 0 });

  // Fetch all photos and derive markers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all: PhotoListItem[] = [];
        let page = await getPhotos();
        all.push(...page.results);
        let next = page.next;
        while (next) {
          const more = await fetchNextPage(next);
          all.push(...more.results);
          next = more.next;
        }
        if (cancelled) return;
        const { markers, clusters } = buildMarkers(all);
        markersRef.current = markers;
        const geotagged = all.filter(p => p.lat !== null && p.lng !== null).length;
        setFetchDebug({ status: 'done', photos: all.length, geotagged, clusters: clusters.length, clusterList: clusters, error: null });
        if (currentSizeRef.current > 0) initGlobeRef.current?.(currentSizeRef.current);
      } catch (e) {
        if (!cancelled) setFetchDebug(prev => ({ ...prev, status: 'error', error: String(e) }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Poll refs for live debug values
  useEffect(() => {
    const id = setInterval(() => {
      setLiveDebug({
        phi: Math.round(phiRef.current * 1000) / 1000,
        size: currentSizeRef.current,
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = 2;
    const el = canvas;

    function initGlobe(size: number) {
      cancelAnimationFrame(rafRef.current);
      if (globeRef.current) { globeRef.current.destroy(); globeRef.current = null; }
      currentSizeRef.current = size;

      el.width = size * dpr;
      el.height = size * dpr;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      globeRef.current = createGlobe(el, {
        devicePixelRatio: dpr,
        width: size * dpr,
        height: size * dpr,
        phi: phiRef.current,
        theta: 0.01,
        dark: 0,
        diffuse: 1.4,
        mapSamples: 8192,
        mapBrightness: 6,
        baseColor: [0.9, 0.9, 0.9],
        markerColor: [0.2, 0.4, 1],
        glowColor: [1, 1, 1],
        markers: markersRef.current,
        arcColor: [0, 0, 0],
        arcWidth: 0,
        arcHeight: 0,
      });

      function animate() {
        phiRef.current += 0.0025;
        globeRef.current?.update({ phi: phiRef.current });
        rafRef.current = requestAnimationFrame(animate);
      }
      animate();
    }

    initGlobeRef.current = initGlobe;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width, height));
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (size > 0) initGlobe(size);
      }, 150);
    });
    ro.observe(container);

    const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
    if (size > 0) initGlobe(size);

    return () => {
      clearTimeout(resizeTimeout);
      cancelAnimationFrame(rafRef.current);
      globeRef.current?.destroy();
      ro.disconnect();
      initGlobeRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--inset-bg)',
        borderTop: '2px solid var(--bevel-shadow)',
        borderLeft: '2px solid var(--bevel-shadow)',
        borderBottom: '2px solid var(--bevel-highlight)',
        borderRight: '2px solid var(--bevel-highlight)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: 'pixelated',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <DebugPanel
        sections={[
          {
            title: 'Fetch',
            data: {
              status: fetchDebug.status,
              photos: fetchDebug.photos,
              geotagged: fetchDebug.geotagged,
              clusters: fetchDebug.clusters,
              ...(fetchDebug.error ? { error: fetchDebug.error } : {}),
            },
          },
          {
            title: 'Globe',
            data: {
              size: liveDebug.size,
              dpr: 2,
              phi: liveDebug.phi,
            },
          },
          ...(fetchDebug.clusterList.length > 0 ? [{
            title: 'Locations',
            data: Object.fromEntries(
              fetchDebug.clusterList.map(c => [
                `${c.lat.toFixed(1)}, ${c.lng.toFixed(1)}`,
                `×${c.count}`,
              ])
            ),
          }] : []),
        ]}
      />
    </div>
  );
}
