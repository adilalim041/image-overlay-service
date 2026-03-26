import { useEffect } from 'react';

export function fitCanvas(canvas, tw, th) {
  if (!canvas) return 1;
  const z = Math.max(0.1, Math.min(3, Math.min((canvas.getWidth() - 80) / tw, (canvas.getHeight() - 80) / th)));
  const tx = (canvas.getWidth() - tw * z) / 2;
  const ty = (canvas.getHeight() - th * z) / 2;
  canvas.setViewportTransform([z, 0, 0, z, tx, ty]);
  return z;
}

export function useZoom(canvasRef, { zoom, templateWidth, templateHeight, onZoomChange, fitTrigger }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (opt) => {
      if (opt.e.shiftKey) {
        const next = Math.max(0.1, Math.min(3, canvas.getZoom() * (1 - opt.e.deltaY / 500)));
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, next);
        onZoomChange?.(next);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      } else if (!canvas.__isPanning) {
        const vt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        vt[4] -= opt.e.deltaX;
        vt[5] -= opt.e.deltaY;
        canvas.setViewportTransform(vt);
      }
    };

    canvas.on('mouse:wheel', onWheel);
    return () => canvas.off('mouse:wheel', onWheel);
  }, [canvasRef, onZoomChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (Math.abs(canvas.getZoom() - zoom) < 0.005) return;
    const cx = canvas.getWidth() / 2;
    const cy = canvas.getHeight() / 2;
    canvas.zoomToPoint({ x: cx, y: cy }, zoom);
    canvas.requestRenderAll();
  }, [zoom, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const z = fitCanvas(canvas, templateWidth, templateHeight);
    onZoomChange?.(z);
  }, [fitTrigger, canvasRef, templateWidth, templateHeight, onZoomChange]);
}
