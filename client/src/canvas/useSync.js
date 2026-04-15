import { useEffect } from 'react';
import { FabricImage, Gradient, Line, Pattern, Rect, Textbox } from 'fabric';

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
  if (layer.type === 'line') {
    const x1 = Number(layer.x1) || 0;
    const y1 = Number(layer.y1) || 0;
    const x2 = Number(layer.x2) || 100;
    const y2 = Number(layer.y2) || 0;
    return {
      width: Math.max(2, Math.abs(x2 - x1)),
      height: Math.max(2, Math.abs(y2 - y1))
    };
  }
  return {
    width: layer.type === 'text' ? layer.width || 240 : layer.width || 120,
    height: layer.height || 80
  };
}

function loadStaticImage(canvas, layer, props, clipPath, w, h) {
  if (typeof window === 'undefined') return;
  const html = new window.Image();
  html.crossOrigin = 'anonymous';
  html.onload = () => {
    const nw = html.naturalWidth || html.width || w;
    const nh = html.naturalHeight || html.height || h;
    const cleanProps = { ...props };
    delete cleanProps.width;
    delete cleanProps.height;
    delete cleanProps.rx;
    delete cleanProps.ry;
    const fImg = new FabricImage(html, cleanProps);
    fImg.scaleX = w / nw;
    fImg.scaleY = h / nh;
    fImg.clipPath = clipPath;
    if (fImg.controls?.mtr) fImg.controls.mtr.offsetY = -30;
    fImg.set('data', { layerId: layer.id, imgSrc: layer.src });
    canvas.add(fImg);
    canvas.requestRenderAll();
  };
  html.onerror = () => {
    const placeholder = new Rect({
      ...props,
      width: w,
      height: h,
      fill: makeImagePattern(),
      clipPath
    });
    placeholder.set('data', { layerId: layer.id });
    canvas.add(placeholder);
    canvas.requestRenderAll();
  };
  html.src = layer.src;
}

function parseHexRgba(color) {
  if (typeof color !== 'string') return { r: 255, g: 255, b: 255, a: 1 };
  if (!color.startsWith('#')) return { r: 255, g: 255, b: 255, a: 1 };
  const hex = color.length === 9 ? color : color + 'ff';
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: parseInt(hex.slice(7, 9), 16) / 255
  };
}

function lineGradientPreviewColor(layer) {
  // Fabric Gradient on Line stroke is unreliable (bbox degenerate for
  // horizontal/vertical lines). For editor preview we show the gradient's
  // midpoint color as a solid stroke so the line is always visible; the
  // server renderer produces the real gradient in the exported PNG.
  if (layer.fillType !== 'gradient' || !layer.gradientFrom || !layer.gradientTo) return null;
  const a = parseHexRgba(layer.gradientFrom);
  const b = parseHexRgba(layer.gradientTo);
  const r = Math.round((a.r + b.r) / 2);
  const g = Math.round((a.g + b.g) / 2);
  const bl = Math.round((a.b + b.b) / 2);
  const al = ((a.a + b.a) / 2).toFixed(3);
  return `rgba(${r}, ${g}, ${bl}, ${al})`;
}

function applyTextTransform(text, transform) {
  if (!transform || transform === 'none') return text;
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  return text;
}

function lineDashArray(layer) {
  const sw = Number(layer.strokeWidth) || 2;
  if (layer.strokeStyle === 'dashed') return [sw * 4, sw * 2];
  if (layer.strokeStyle === 'dotted') return [sw, sw * 2];
  return null;
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

    // Clip each layer object to template bounds (selection handles stay visible)
    const templateClip = new Rect({
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

      if (layer.type === 'line') {
        const x1 = Number(layer.x1) || 0;
        const y1 = Number(layer.y1) || 0;
        const x2 = Number(layer.x2) || 100;
        const y2 = Number(layer.y2) || 0;
        const stroke = lineGradientPreviewColor(layer) || (layer.stroke || '#FFFFFF');
        const lineProps = {
          stroke,
          strokeWidth: Number(layer.strokeWidth) || 2,
          strokeLineCap: layer.lineCap || 'butt',
          strokeDashArray: lineDashArray(layer),
          opacity: (layer.opacity ?? 100) / 100,
          selectable: !layer.locked,
          evented: !layer.locked,
          hasControls: false,
          hasBorders: true,
          borderColor: '#E63946',
          borderDashArray: [6, 3],
          padding: 6,
          lockScalingFlip: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true
        };
        const existingObj = existing[layer.id];
        if (existingObj && existingObj.type === 'line') {
          // Update in place — no remove+recreate, avoids per-frame reflow
          existingObj.set(lineProps);
          existingObj.set({ x1, y1, x2, y2 });
          existingObj.set('data', { layerId: layer.id, origLine: { x1, y1, x2, y2 } });
          existingObj.setCoords();
        } else {
          if (existingObj) canvas.remove(existingObj);
          const lineObj = new Line([x1, y1, x2, y2], lineProps);
          lineObj.set('data', { layerId: layer.id, origLine: { x1, y1, x2, y2 } });
          lineObj.clipPath = templateClip;
          canvas.add(lineObj);
        }
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
      const isStaticImage = (layer.type === 'image' || layer.type === 'logo')
        && typeof layer.src === 'string'
        && layer.src.length > 0
        && !layer.src.includes('{{');

      if (layer.type === 'text') {
        const textProps = {
          ...controlProps(),
          left: layer.x || 0,
          top: layer.y || 0,
          width: w,
          originX: 'left',
          originY: 'top',
          angle: layer.rotation || 0,
          opacity: (layer.opacity ?? 100) / 100,
          selectable: !layer.locked,
          evented: !layer.locked,
          hasControls: !layer.locked
        };
        const displayText = applyTextTransform(layer.text || '', layer.textTransform);
        if (existingObj) {
          existingObj.set({
            ...textProps,
            clipPath: templateClip,
            text: displayText,
            fill: layer.fill || '#ffffff',
            fontSize: layer.fontSize || 32,
            textAlign: layer.align || 'left',
            lineHeight: layer.lineHeight || 1.1,
            charSpacing: (layer.letterSpacing || 0) * 10,
            fontFamily: layer.fontFamily || 'sans-serif',
            editable: false,
            scaleX: 1,
            scaleY: 1
          });
        } else {
          const tb = new Textbox(displayText, {
            ...textProps,
            fill: layer.fill || '#ffffff',
            fontSize: layer.fontSize || 32,
            textAlign: layer.align || 'left',
            lineHeight: layer.lineHeight || 1.1,
            charSpacing: (layer.letterSpacing || 0) * 10,
            fontFamily: layer.fontFamily || 'sans-serif',
            editable: false
          });
          if (tb.controls?.mtr) tb.controls.mtr.offsetY = -30;
          tb.set('data', { layerId: layer.id });
          tb.clipPath = templateClip;
          canvas.add(tb);
        }
        return;
      }

      if (existingObj) {
        if (isStaticImage && existingObj.data?.imgSrc === layer.src) {
          // Same image already loaded — only sync position/opacity/rotation.
          // Do NOT touch width/height/scaleX/scaleY (would override natural dims).
          const nw = (existingObj.getElement?.()?.naturalWidth) || existingObj.width || w;
          const nh = (existingObj.getElement?.()?.naturalHeight) || existingObj.height || h;
          existingObj.set({
            left: (layer.x || 0) + w / 2,
            top: (layer.y || 0) + h / 2,
            originX: 'center',
            originY: 'center',
            angle: layer.rotation || 0,
            opacity: (layer.opacity ?? 100) / 100,
            selectable: !layer.locked,
            evented: !layer.locked,
            hasControls: !layer.locked,
            scaleX: w / nw,
            scaleY: h / nh,
            clipPath: templateClip
          });
        } else if (isStaticImage) {
          canvas.remove(existingObj);
          delete existing[layer.id];
          loadStaticImage(canvas, layer, props, templateClip, w, h);
        } else if (layer.type === 'rect') {
          existingObj.set({ ...props, clipPath: templateClip, fill: rectFill(layer), width: w, height: h, scaleX: 1, scaleY: 1 });
        } else {
          existingObj.set({ ...props, clipPath: templateClip, fill: makeImagePattern(), width: w, height: h, scaleX: 1, scaleY: 1 });
        }
      } else {
        if (isStaticImage) {
          loadStaticImage(canvas, layer, props, templateClip, w, h);
          return;
        }
        let obj;
        if (layer.type === 'image' || layer.type === 'logo') {
          obj = new Rect({ ...props, width: w, height: h, fill: makeImagePattern() });
        } else {
          obj = new Rect({ ...props, width: w, height: h, fill: rectFill(layer) });
        }
        if (obj.controls?.mtr) obj.controls.mtr.offsetY = -30;
        obj.set('data', { layerId: layer.id });
        obj.clipPath = templateClip;
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
