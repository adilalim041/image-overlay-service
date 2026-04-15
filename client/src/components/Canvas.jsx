import React, { useEffect, useRef, useState } from 'react';
import { useCanvasSetup } from '../canvas/useCanvasSetup';
import { useInteraction } from '../canvas/useInteraction';
import { usePan } from '../canvas/usePan';
import { useSnap } from '../canvas/useSnap';
import { useSync } from '../canvas/useSync';
import { useZoom } from '../canvas/useZoom';

const SNAP_PX = 12;

export default function Canvas({
  layers,
  selectedLayerId,
  templateWidth,
  templateHeight,
  zoom,
  fitTrigger,
  showGrid,
  onZoomChange,
  onSelectLayer,
  onLayerMove,
  onLayerResize,
  onContextMenu,
  onAltDuplicate
}) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const guidesRef = useRef([]);
  const [vt, setVt] = useState([1, 0, 0, 1, 0, 0]);
  const dragRef = useRef(null);

  const canvasRef = useCanvasSetup(containerRef, elementRef, {
    templateWidth,
    templateHeight,
    onZoomChange
  });

  usePan(canvasRef, containerRef);
  useZoom(canvasRef, { zoom, templateWidth, templateHeight, onZoomChange, fitTrigger });
  useSnap(canvasRef, guidesRef, { templateWidth, templateHeight });
  useSync(canvasRef, { layers, selectedLayerId, showGrid, templateWidth, templateHeight });
  const { sizeTooltip, rotationTooltip } = useInteraction(canvasRef, {
    onSelectLayer,
    onLayerMove,
    onLayerResize,
    onContextMenu,
    onAltDuplicate
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let raf = null;
    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const next = c.viewportTransform || [1, 0, 0, 1, 0, 0];
        setVt((prev) => {
          if (prev[0] === next[0] && prev[4] === next[4] && prev[5] === next[5]) return prev;
          return [...next];
        });
      });
    };
    sync();
    // Only listen to events that actually change the viewport transform
    c.on('mouse:wheel', sync);
    c.on('after:transform', sync);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      c.off('mouse:wheel', sync);
      c.off('after:transform', sync);
    };
  }, [canvasRef, zoom, fitTrigger, templateWidth, templateHeight]);

  const selectedLine = layers.find((l) => l.id === selectedLayerId && l.type === 'line' && !l.locked);

  const onEndpointDown = (which) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedLine) return;
    dragRef.current = { which, layerId: selectedLine.id };
    const onMove = (mv) => {
      const cur = dragRef.current;
      if (!cur) return;
      const rect = containerRef.current.getBoundingClientRect();
      const z = vt[0] || 1;
      const tx = vt[4] || 0;
      const ty = vt[5] || 0;
      const canvasX = (mv.clientX - rect.left - tx) / z;
      const canvasY = (mv.clientY - rect.top - ty) / z;
      const layer = layers.find((l) => l.id === cur.layerId);
      if (!layer) return;
      const otherX = cur.which === 'start' ? Number(layer.x2) : Number(layer.x1);
      const otherY = cur.which === 'start' ? Number(layer.y2) : Number(layer.y1);
      let nx = Math.round(canvasX);
      let ny = Math.round(canvasY);
      const snap = SNAP_PX / z;
      if (Math.abs(ny - otherY) < snap) ny = otherY;
      if (Math.abs(nx - otherX) < snap) nx = otherX;
      const patch = cur.which === 'start' ? { x1: nx, y1: ny } : { x2: nx, y2: ny };
      onLayerMove?.(cur.layerId, patch);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleScreen = (cx, cy) => ({
    left: cx * (vt[0] || 1) + (vt[4] || 0),
    top: cy * (vt[0] || 1) + (vt[5] || 0)
  });

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={elementRef} />
      {sizeTooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-md bg-[#1a1a1a] px-2 py-1 text-[11px] text-white shadow-lg"
          style={{ left: sizeTooltip.x, top: sizeTooltip.y, transform: 'translate(-50%, 0)' }}
        >
          {sizeTooltip.w} × {sizeTooltip.h}
        </div>
      )}
      {rotationTooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-full bg-[#1a1a1a] px-3 py-1 text-[11px] text-white shadow-lg"
          style={{ left: rotationTooltip.x, top: rotationTooltip.y, transform: 'translate(-50%, 0)' }}
        >
          {rotationTooltip.angle}°
        </div>
      )}
      {selectedLine && (
        <>
          {[{ k: 'start', cx: Number(selectedLine.x1) || 0, cy: Number(selectedLine.y1) || 0 }, { k: 'end', cx: Number(selectedLine.x2) || 0, cy: Number(selectedLine.y2) || 0 }].map((ep) => {
            const pos = handleScreen(ep.cx, ep.cy);
            return (
              <div
                key={ep.k}
                onMouseDown={onEndpointDown(ep.k)}
                className="absolute z-50"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  marginTop: -7,
                  background: '#ffffff',
                  border: '2px solid #E63946',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
