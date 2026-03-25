import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

export default function GlobeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const rafRef = useRef<number>(0);
  const phiRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = 2;

    const initGlobe = (size: number) => {
      cancelAnimationFrame(rafRef.current);
      if (globeRef.current) { globeRef.current.destroy(); globeRef.current = null; }

      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      globeRef.current = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: size * dpr,
        height: size * dpr,
        phi: 0,
        theta: 0.2,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.9, 0.9, 0.9],
        markerColor: [0.2, 0.4, 1],
        glowColor: [1, 1, 1],
        markers: [          
          { location: [40.71, -74.01], size: 0.01, id: 'nyc' },
        ],        
        arcColor: [ 0, 0, 0],
        arcWidth: 0,
        arcHeight: 0,
      });

      function animate() {
        phiRef.current += 0.005;
        globeRef.current?.update({ phi: phiRef.current });
        rafRef.current = requestAnimationFrame(animate);
      }
      animate();
    };

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width, height));
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (size > 0) initGlobe(size);
      }, 5);
    });
    ro.observe(container);

    const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
    if (size > 0) initGlobe(size);

    return () => {
      clearTimeout(resizeTimeout);
      cancelAnimationFrame(rafRef.current);
      globeRef.current?.destroy();
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
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
          position: 'absolute' ,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',}}
      />
    </div>
  );
}
