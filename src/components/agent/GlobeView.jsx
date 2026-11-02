import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

// Converts a lat/lng into the globe rotation that faces it.
const toAngles = (lat, lng) => [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];

/**
 * A WebGL dotted globe. Spins slowly when idle and turns to face `focus`
 * when the agent finds the destination. Can be dragged.
 */
export default function GlobeView({ focus, markers = [], className = '', label = 'Globe' }) {
  const canvasRef = useRef(null);
  const state = useRef({ phi: 0, theta: 0.25, targetPhi: null, targetTheta: 0.25, drag: null, dragPhi: 0 });
  const markersRef = useRef(markers);
  markersRef.current = markers;

  useEffect(() => {
    if (focus && Number.isFinite(focus.lat)) {
      const [p, t] = toAngles(focus.lat, focus.lng);
      const s = state.current;
      // Take the short way round.
      const twoPi = Math.PI * 2;
      const cur = s.phi % twoPi;
      let delta = ((p - cur) % twoPi + twoPi) % twoPi;
      if (delta > Math.PI) delta -= twoPi;
      s.targetPhi = s.phi + delta;
      s.targetTheta = Math.max(-0.6, Math.min(0.9, t * 0.75));
    } else {
      state.current.targetPhi = null;
      state.current.targetTheta = 0.25;
    }
  }, [focus?.lat, focus?.lng]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let globe;
    let width = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      width = canvas.offsetWidth;
      if (!width) return;
      globe?.destroy();
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width: width * dpr,
          height: width * dpr,
          phi: state.current.phi,
          theta: state.current.theta,
          dark: 1,
          diffuse: 1.4,
          mapSamples: width < 160 ? 5000 : width < 300 ? 9000 : 16000,
          mapBrightness: width < 160 ? 10 : 5.5,
          mapBaseBrightness: width < 160 ? 0.12 : 0.04,
          baseColor: width < 160 ? [0.3, 0.55, 0.6] : [0.16, 0.34, 0.4],
          markerColor: [0.96, 0.69, 0.25],
          glowColor: [0.2, 0.45, 0.48],
          markers: [],
          onRender: (st) => {
            const s = state.current;
            if (s.drag == null) {
              if (s.targetPhi != null) {
                s.phi += (s.targetPhi - s.phi) * 0.06;
              } else if (!reduce) {
                s.phi += 0.0028;
              }
            }
            s.theta += (s.targetTheta - s.theta) * 0.06;
            st.phi = s.phi + s.dragPhi;
            st.theta = s.theta;
            st.markers = markersRef.current;
            st.width = width * dpr;
            st.height = width * dpr;
          },
        });
        canvas.style.opacity = '1';
      } catch {
        canvas.parentElement?.classList.add('globe-fallback');
      }
    };

    build();
    const ro = new ResizeObserver(() => {
      if (Math.abs(canvas.offsetWidth - width) > 4) build();
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      globe?.destroy();
    };
  }, []);

  // Drag to spin; springs back to its target when released.
  const onPointerDown = (e) => {
    state.current.drag = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const s = state.current;
    if (s.drag == null) return;
    s.dragPhi = (e.clientX - s.drag) / 120;
  };
  const end = () => {
    const s = state.current;
    if (s.drag == null) return;
    s.drag = null;
    if (s.targetPhi == null) s.phi += s.dragPhi;
    // Ease the drag offset back to zero.
    const settle = () => {
      s.dragPhi *= 0.85;
      if (Math.abs(s.dragPhi) > 0.001 && s.drag == null) requestAnimationFrame(settle);
      else if (s.drag == null) s.dragPhi = 0;
    };
    if (s.targetPhi != null) settle();
    else s.dragPhi = 0;
  };

  return (
    <div className={`globe ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
    </div>
  );
}
