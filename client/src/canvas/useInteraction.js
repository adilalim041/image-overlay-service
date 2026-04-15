import { useEffect, useState } from 'react';

export function useInteraction(canvasRef, { onSelectLayer, onLayerMove, onLayerResize, onContextMenu, onAltDuplicate }) {
  const [sizeTooltip, setSizeTooltip] = useState(null);
  const [rotationTooltip, setRotationTooltip] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (opt) => {
      if (canvas.__isPanning) return;
      const id = opt.target?.data?.layerId || null;
      if (id && opt.e.altKey && opt.e.button !== 2) {
        opt.e.preventDefault();
        onAltDuplicate?.(id);
        return;
      }
      if (id) onSelectLayer?.(id);
      if (opt.e.button === 2 && id) {
        opt.e.preventDefault();
        onContextMenu?.(id, { x: opt.e.clientX, y: opt.e.clientY });
      }
    };

    const onModified = (opt) => {
      const obj = opt.target;
      const id = obj?.data?.layerId;
      if (!id || !obj) return;

      if (obj.type === 'line') {
        const orig = obj.data?.origLine;
        if (orig) {
          const origMinX = Math.min(orig.x1, orig.x2);
          const origMinY = Math.min(orig.y1, orig.y2);
          const dx = (obj.left || 0) - origMinX;
          const dy = (obj.top || 0) - origMinY;
          const sx = obj.scaleX || 1;
          const sy = obj.scaleY || 1;
          const x1 = Math.round(origMinX + dx + (orig.x1 - origMinX) * sx);
          const y1 = Math.round(origMinY + dy + (orig.y1 - origMinY) * sy);
          const x2 = Math.round(origMinX + dx + (orig.x2 - origMinX) * sx);
          const y2 = Math.round(origMinY + dy + (orig.y2 - origMinY) * sy);
          onLayerMove?.(id, { x1, y1, x2, y2 });
        }
        setSizeTooltip(null);
        setRotationTooltip(null);
        return;
      }

      const w = Math.round((obj.width || 0) * (obj.scaleX || 1));
      const h = Math.round((obj.height || 0) * (obj.scaleY || 1));

      const offX = obj.originX === 'left' ? 0 : w / 2;
      const offY = obj.originY === 'top' ? 0 : h / 2;

      onLayerMove?.(id, {
        x: Math.round((obj.left || 0) - offX),
        y: Math.round((obj.top || 0) - offY),
        rotation: Math.round(obj.angle || 0)
      });
      onLayerResize?.(id, { width: w, height: h });

      setSizeTooltip(null);
      setRotationTooltip(null);
    };

    const onScaling = (opt) => {
      const obj = opt.target;
      if (!obj) return;
      const w = Math.round((obj.width || 0) * (obj.scaleX || 1));
      const h = Math.round((obj.height || 0) * (obj.scaleY || 1));
      const zoom = canvas.getZoom();
      const vt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      setSizeTooltip({
        x: (obj.left || 0) * zoom + vt[4],
        y: ((obj.top || 0) + obj.getScaledHeight() / 2 + 15) * zoom + vt[5],
        w,
        h
      });
    };

    const onRotating = (opt) => {
      const obj = opt.target;
      if (!obj) return;
      const zoom = canvas.getZoom();
      const vt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      setRotationTooltip({
        x: (obj.left || 0) * zoom + vt[4],
        y: ((obj.top || 0) + obj.getScaledHeight() / 2 + 20) * zoom + vt[5],
        angle: Math.round(obj.angle || 0)
      });
    };

    const onMouseUp = () => {
      setTimeout(() => {
        setSizeTooltip(null);
        setRotationTooltip(null);
      }, 500);
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('object:modified', onModified);
    canvas.on('object:scaling', onScaling);
    canvas.on('object:rotating', onRotating);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('object:modified', onModified);
      canvas.off('object:scaling', onScaling);
      canvas.off('object:rotating', onRotating);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [canvasRef, onSelectLayer, onLayerMove, onLayerResize, onContextMenu, onAltDuplicate]);

  return { sizeTooltip, rotationTooltip };
}
