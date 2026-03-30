import { useEffect } from 'react';
import { Gradient, Line, Pattern, Rect, Textbox } from 'fabric';

const GRID_STEP = 20;

function rectFill(layer) {
  if (layer.fillType === 'gradient' && layer.gradientFrom && layer.gradientTo) {
    const d = layer.gradientDirection || 'vertical';
    if (d === 'radial') {
      return new Gradient({
        type: 'radial',
        gradientUnits: 'pixels',
        coords: {
          x1: (layer.width || 1) / 2,
          y1: (layer.height || 1) / 2,
          r1: 0,
          x2: (layer.width || 1) / 2,
          y2: (layer.height || 1) / 2,
          r2: Math.max(layer.width || 1, layer.height || 1) / 2
        },
        colorStops: [
          { offset: 0, color: layer.gradientFrom },
          { offset: 1, color: layer.gradientTo }
        ]
      });
    }
    return new Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords:
        d === 'horizontal'
          ? { x1: 0, y1: 0, x2: layer.width || 1, y2: 0 }
          : d === 'diagonal'
            ? { x1: 0, y1: 0, x2: layer.width || 1, y2: layer.height || 1 }
            : { x1: 0, y1: 0, x2: 0, y2: layer.height || 1 },
      colorStops: [
        { offset: 0, color: layer.gradientFrom },
        { offset: 1, color: layer.gradientTo }
      ]
    });
  }
  return layer.fill && layer.fill !== 'gradient' ? layer.fill : '#394154';
}

function makeImagePattern() {
  if (typeof document === 'undefined') return '#1e1e2e';
  const sz = 16;
  const c = document.createElement('canvas');
  c.width = sz * 2;
  c.height = sz * 2;
  const ctx = c.getContext('2d');
  if (!ctx) return '#1e1e2e';
  ctx.fillStyle = '#1a1a24';
  ctx.fillRect(0, 0, sz * 2, sz * 2);
  ctx.fillStyle = '#252530';
  ctx.fillRect(0, 0, sz, sz);
  ctx.fillRect(sz, sz, sz, sz);
  try {
    return new Pattern({ source: c, repeat: 'repeat' });
  } catch {
    return '#1e1e2e';
  }
}

function layerSize(layer) {
  return {
    width: layer.type === 'text' ? layer.width || 240 : layer.width || 120,
    height: layer.height || 80
  };
}

function setBack(canvas, obj) {
  if (typeof canvas.sendObjectToBack === 'function') canvas.sendObjectToBack(obj);
  else canvas.sendToBack(obj);
}

function moveTo(canvas, obj, index) {
  if (typeof canvas.moveObjectTo === 'function') canvas.moveObjectTo(obj, index);
  else if (typeof canvas.insertAt === 'function') {
    canvas.remove(obj);
    canvas.insertAt(obj, index, false);
  } else {
    canvas.remove(obj);
    canvas.add(obj);
  }
}

function controlProps() {
  return {
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: '#1a1a1a',
    cornerSize: 10,
    cornerStyle: 'circle',
    borderColor: '#E63946',
    borderDashArray: [6, 3],
    borderScaleFactor: 1.5,
    padding: 4
  };
}

export function useSync(canvasRef, { layers, selectedLayerId, showGrid, templateWidth, templateHeight }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const existing = {};
    canvas.getObjects().forEach((obj) => {
      if (obj.data?.layerId) existing[obj.data.layerId] = obj;
    });

    canvas
      .getObjects()
      .filter((o) => o.excludeFromExport && !o.data?.layerId)
      .forEach((o) => canvas.remove(o));

    const border = new Rect({
      left: 0,
      top: 0,
      width: templateWidth,
      height: templateHeight,
      fill: '#ffffff',
      stroke: '#2A1A1A',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      name: '__templateBorder',
      originX: 'left',
      originY: 'top'
    });
    canvas.add(border);
    setBack(canvas, border);

    // Clip objects to template boundaries so nothing renders outside
    canvas.clipPath = new Rect({
      left: 0,
      top: 0,
      width: templateWidth,
      height: templateHeight,
      originX: 'left',
      originY: 'top',
      absolutePositioned: true
    });

    if (showGrid) {
      for (let x = GRID_STEP; x < templateWidth; x += GRID_STEP) {
        const l = new Line([x, 0, x, templateHeight], {
          stroke: '#2A2A3A',
          opacity: 0.3,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          name: '__grid'
        });
        canvas.add(l);
        setBack(canvas, l);
      }
      for (let y = GRID_STEP; y < templateHeight; y += GRID_STEP) {
        const l = new Line([0, y, templateWidth, y], {
          stroke: '#2A2A3A',
          opacity: 0.3,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          name: '__grid'
        });
        canvas.add(l);
        setBack(canvas, l);
      }
      setBack(canvas, border);
    }

    const layerIds = new Set(layers.filter((l) => l.visible !== false).map((l) => l.id));
    Object.entries(existing).forEach(([id, obj]) => {
      if (!layerIds.has(id)) canvas.remove(obj);
    });

    layers.forEach((layer) => {
      if (layer.visible === false) {
        if (existing[layer.id]) canvas.remove(existing[layer.id]);
        return;
      }

      const { width: w, height: h } = layerSize(layer);
      const props = {
        ...controlProps(),
        left: (layer.x || 0) + w / 2,
        top: (layer.y || 0) + h / 2,
        width: w,
        height: h,
        originX: 'center',
        originY: 'center',
        angle: layer.rotation || 0,
        opacity: (layer.opacity ?? 100) / 100,
        selectable: !layer.locked,
        evented: !layer.locked,
        hasControls: !layer.locked,
        lockUniScaling: !!layer.lockAspect,
        uniformScaling: false,
        stroke: layer.borderEnabled ? layer.strokeColor || '#fff' : null,
        strokeWidth: layer.borderEnabled ? layer.strokeWidth || 1 : 0,
        rx: layer.radius || 0,
        ry: layer.radius || 0
      };

      const existingObj = existing[layer.id];
      if (existingObj) {
        existingObj.set(props);
        if (layer.type === 'text') {
          existingObj.set({
            text: layer.text || '',
            fill: layer.fill || '#ffffff',
            fontSize: layer.fontSize || 32,
            textAlign: layer.align || 'left',
            lineHeight: layer.lineHeight || 1.1,
            charSpacing: (layer.letterSpacing || 0) * 10,
            fontFamily: layer.fontFamily || 'sans-serif',
            editable: false,
            width: w,
            height: h,
            scaleX: 1,
            scaleY: 1
          });
        } else if (layer.type === 'rect') {
          existingObj.set({ fill: rectFill(layer), width: w, height: h, scaleX: 1, scaleY: 1 });
        } else {
          existingObj.set({ fill: makeImagePattern(), width: w, height: h, scaleX: 1, scaleY: 1 });
        }
      } else {
        let obj;
        if (layer.type === 'text') {
          obj = new Textbox(layer.text || '', {
            ...props,
            width: w,
            height: h,
            fill: layer.fill || '#ffffff',
            fontSize: layer.fontSize || 32,
            textAlign: layer.align || 'left',
            lineHeight: layer.lineHeight || 1.1,
            charSpacing: (layer.letterSpacing || 0) * 10,
            fontFamily: layer.fontFamily || 'sans-serif',
            editable: false
          });
        } else if (layer.type === 'image' || layer.type === 'logo') {
          obj = new Rect({ ...props, width: w, height: h, fill: makeImagePattern() });
        } else {
          obj = new Rect({ ...props, width: w, height: h, fill: rectFill(layer) });
        }
        if (obj.controls?.mtr) obj.controls.mtr.offsetY = -30;
        obj.set('data', { layerId: layer.id });
        canvas.add(obj);
      }
    });

    const nonLayerCount = canvas.getObjects().filter((o) => !o.data?.layerId).length;
    layers.forEach((layer, i) => {
      if (layer.visible === false) return;
      const obj = canvas.getObjects().find((o) => o.data?.layerId === layer.id);
      if (obj) moveTo(canvas, obj, nonLayerCount + i);
    });

    const active = canvas.getActiveObject();
    if (active?.data?.layerId && !layerIds.has(active.data.layerId)) {
      canvas.discardActiveObject();
    }

    if (selectedLayerId && layerIds.has(selectedLayerId)) {
      const selectedObj = canvas.getObjects().find((o) => o.data?.layerId === selectedLayerId);
      if (selectedObj && canvas.getActiveObject() !== selectedObj) canvas.setActiveObject(selectedObj);
    } else if (!selectedLayerId && canvas.getActiveObject()) {
      canvas.discardActiveObject();
    }

    // Принудительный перерендер после sync.
    canvas.requestRenderAll();
  }, [canvasRef, layers, selectedLayerId, showGrid, templateWidth, templateHeight]);
}
