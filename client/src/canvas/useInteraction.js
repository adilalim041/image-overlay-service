import { useEffect, useState } from 'react';

export function useInteraction(canvasRef, { onSelectLayer, onLayerMove, onLayerResize, onContextMenu }) {
  const [sizeTooltip, setSizeTooltip] = useState(null);
  const [rotationTooltip, setRotationTooltip] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (opt) => {
      if (canvas.__isPanning) return;
      const id = opt.target?.data?.layerId || null;
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
          const minX = Math.min(orig.x1, orig.x2);
          const minY = Math.min(orig.y1, orig.y2);
          const dx = Math.round((obj.left || 0) - minX);
          const dy = Math.round((obj.top || 0) - minY);
          onLayerMove?.(id, {
            x1: orig.x1 + dx,
            y1: orig.y1 + dy,
            x2: orig.x2 + dx,
            y2: orig.y2 + dy
          });
        }
        setSizeTooltip(null);
        setRotationTooltip(null);
        return;
      }

      const w = Math.round((obj.width || 0) * (obj.scaleX || 1));
      const h = Math.round((obj.height || 0) * (obj.scaleY || 1));

      onLayerMove?.(id, {
        x: Math.round((obj.left || 0) - w / 2),
        y: Math.round((obj.top || 0) - h / 2),
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
  }, [canvasRef, onSelectLayer, onLayerMove, onLayerResize, onContextMenu]);

  return { sizeTooltip, rotationTooltip };
}
