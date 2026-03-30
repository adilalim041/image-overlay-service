import { useEffect, useRef } from 'react';
import { Line } from 'fabric';

const SNAP_THRESHOLD = 8;

function clearGuides(canvas, guidesRef) {
  guidesRef.current.forEach((x) => canvas.remove(x));
  guidesRef.current = [];
}

function addGuide(canvas, guidesRef, points) {
  const line = new Line(points, {
    stroke: '#E63946',
    strokeWidth: 1,
    strokeDashArray: [4, 4],
    selectable: false,
    evented: false,
    excludeFromExport: true,
    name: '__snapGuide'
  });
  guidesRef.current.push(line);
  canvas.add(line);
  if (typeof line.bringToFront === 'function') line.bringToFront();
  else if (typeof canvas.bringObjectToFront === 'function') canvas.bringObjectToFront(line);
}

export function useSnap(canvasRef, guidesRef, { templateWidth, templateHeight }) {
  const snapTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTargets = (excludeId) => {
      const tX = [0, templateWidth / 2, templateWidth];
      const tY = [0, templateHeight / 2, templateHeight];
      canvas.getObjects().forEach((x) => {
        if (!x.data?.layerId || x.data.layerId === excludeId || x.excludeFromExport) return;
        const ox = x.left || 0;
        const oy = x.top || 0;
        const ow = x.getScaledWidth();
        const oh = x.getScaledHeight();
        tX.push(ox - ow / 2, ox, ox + ow / 2);
        tY.push(oy - oh / 2, oy, oy + oh / 2);
      });
      return { tX, tY };
    };

    const onMoving = (opt) => {
      const obj = opt.target;
      if (!obj?.data?.layerId || canvas.__isPanning) return;

      const now = Date.now();
      if (now - snapTimeRef.current < 16) return;
      snapTimeRef.current = now;

      clearGuides(canvas, guidesRef);

      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      const objLeft = (obj.left || 0) - w / 2;
      const objRight = (obj.left || 0) + w / 2;
      const objTop = (obj.top || 0) - h / 2;
      const objBottom = (obj.top || 0) + h / 2;
      const { tX, tY } = getTargets(obj.data.layerId);

      const pointsX = [
        { p: 'left', v: objLeft },
        { p: 'center', v: obj.left || 0 },
        { p: 'right', v: objRight }
      ];
      const pointsY = [
        { p: 'top', v: objTop },
        { p: 'center', v: obj.top || 0 },
        { p: 'bottom', v: objBottom }
      ];

      const hitX = pointsX
        .flatMap((s) => tX.map((t) => ({ s, t, d: Math.abs(s.v - t) })))
        .sort((a, b) => a.d - b.d)[0];
      const hitY = pointsY
        .flatMap((s) => tY.map((t) => ({ s, t, d: Math.abs(s.v - t) })))
        .sort((a, b) => a.d - b.d)[0];

      if (hitX?.d <= SNAP_THRESHOLD) {
        const shift = hitX.s.p === 'left' ? w / 2 : hitX.s.p === 'right' ? -w / 2 : 0;
        obj.set({ left: hitX.t + shift });
        addGuide(canvas, guidesRef, [hitX.t, 0, hitX.t, templateHeight]);
      }
      if (hitY?.d <= SNAP_THRESHOLD) {
        const shift = hitY.s.p === 'top' ? h / 2 : hitY.s.p === 'bottom' ? -h / 2 : 0;
        obj.set({ top: hitY.t + shift });
        addGuide(canvas, guidesRef, [0, hitY.t, templateWidth, hitY.t]);
      }
      canvas.requestRenderAll();
    };

    const onScaling = (opt) => {
      const obj = opt.target;
      if (!obj?.data?.layerId) return;

      clearGuides(canvas, guidesRef);

      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      const left = (obj.left || 0) - w / 2;
      const right = (obj.left || 0) + w / 2;
      const top = (obj.top || 0) - h / 2;
      const bottom = (obj.top || 0) + h / 2;
      const corner = obj.__corner;
      const baseW = obj.width || 1;
      const baseH = obj.height || 1;
      const { tX, tY } = getTargets(obj.data.layerId);

      // Sort targets by proximity to the edge being snapped
      if (['br', 'mr', 'tr'].includes(corner)) {
        const sorted = [...tX].sort((a, b) => Math.abs(right - a) - Math.abs(right - b));
        for (const tx of sorted) {
          if (Math.abs(right - tx) <= SNAP_THRESHOLD) {
            const newW = tx - left;
            if (newW > 1) {
              obj.set({ scaleX: newW / baseW, left: left + newW / 2 });
              addGuide(canvas, guidesRef, [tx, 0, tx, templateHeight]);
            }
            break;
          }
        }
      }
      if (['bl', 'ml', 'tl'].includes(corner)) {
        const sorted = [...tX].sort((a, b) => Math.abs(left - a) - Math.abs(left - b));
        for (const tx of sorted) {
          if (Math.abs(left - tx) <= SNAP_THRESHOLD) {
            const newW = right - tx;
            if (newW > 1) {
              obj.set({ scaleX: newW / baseW, left: tx + newW / 2 });
              addGuide(canvas, guidesRef, [tx, 0, tx, templateHeight]);
            }
            break;
          }
        }
      }
      if (['br', 'mb', 'bl'].includes(corner)) {
        const sorted = [...tY].sort((a, b) => Math.abs(bottom - a) - Math.abs(bottom - b));
        for (const ty of sorted) {
          if (Math.abs(bottom - ty) <= SNAP_THRESHOLD) {
            const newH = ty - top;
            if (newH > 1) {
              obj.set({ scaleY: newH / baseH, top: top + newH / 2 });
              addGuide(canvas, guidesRef, [0, ty, templateWidth, ty]);
            }
            break;
          }
        }
      }
      if (['tl', 'mt', 'tr'].includes(corner)) {
        const sorted = [...tY].sort((a, b) => Math.abs(top - a) - Math.abs(top - b));
        for (const ty of sorted) {
          if (Math.abs(top - ty) <= SNAP_THRESHOLD) {
            const newH = bottom - ty;
            if (newH > 1) {
              obj.set({ scaleY: newH / baseH, top: ty + newH / 2 });
              addGuide(canvas, guidesRef, [0, ty, templateWidth, ty]);
            }
            break;
          }
        }
      }
      canvas.requestRenderAll();
    };

    const onRotating = (opt) => {
      const obj = opt.target;
      if (!obj) return;
      const snaps = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      let a = (obj.angle || 0) % 360;
      if (a < 0) a += 360;
      for (const s of snaps) {
        if (Math.abs(a - s) <= 5) {
          obj.set({ angle: s === 360 ? 0 : s });
          break;
        }
      }
    };

    const onModified = () => clearGuides(canvas, guidesRef);

    canvas.on('object:moving', onMoving);
    canvas.on('object:scaling', onScaling);
    canvas.on('object:rotating', onRotating);
    canvas.on('object:modified', onModified);

    return () => {
      canvas.off('object:moving', onMoving);
      canvas.off('object:scaling', onScaling);
      canvas.off('object:rotating', onRotating);
      canvas.off('object:modified', onModified);
      clearGuides(canvas, guidesRef);
    };
  }, [canvasRef, guidesRef, templateWidth, templateHeight]);
}
