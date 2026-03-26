import React, { useRef } from 'react';
import { useCanvasSetup } from '../canvas/useCanvasSetup';
import { useInteraction } from '../canvas/useInteraction';
import { usePan } from '../canvas/usePan';
import { useSnap } from '../canvas/useSnap';
import { useSync } from '../canvas/useSync';
import { useZoom } from '../canvas/useZoom';

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
  onContextMenu
}) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const guidesRef = useRef([]);

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
    onContextMenu
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
    </div>
  );
}
