import { useEffect, useRef } from 'react';
import { Canvas as FabricCanvas } from 'fabric';

export function useCanvasSetup(containerRef, elementRef, { templateWidth, templateHeight, onZoomChange }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || canvasRef.current) return;

    const canvas = new FabricCanvas(elementRef.current, {
      width: 900,
      height: 700,
      backgroundColor: '#0D0D12',
      preserveObjectStacking: true
    });
    canvas.uniformScaling = false;
    canvasRef.current = canvas;

    const fit = () => {
      const z = Math.max(0.1, Math.min(3, Math.min((canvas.getWidth() - 80) / templateWidth, (canvas.getHeight() - 80) / templateHeight)));
      const tx = (canvas.getWidth() - templateWidth * z) / 2;
      const ty = (canvas.getHeight() - templateHeight * z) / 2;
      canvas.setViewportTransform([z, 0, 0, z, tx, ty]);
      onZoomChange?.(z);
    };

    const observer = new ResizeObserver(() => {
      if (!containerRef.current) return;
      canvas.setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      fit();
    });
    if (containerRef.current) observer.observe(containerRef.current);

    fit();

    return () => {
      observer.disconnect();
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []);

  return canvasRef;
}
