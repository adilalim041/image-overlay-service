import sharp from "sharp";
import { downloadImage, escapeXml, substituteVars } from "./utils.js";
import { getFont } from "./fonts.js";

export class RenderValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "RenderValidationError";
    this.details = details;
  }
}

function wrapText(text, font, fontSize, maxWidth) {
  if (!text || !font) return [text || ""];
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.getAdvanceWidth(test, fontSize) <= maxWidth) current = test;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function applyTextTransform(text, transform) {
  if (!transform || transform === "none") return text;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}

function renderTextLayer(layer) {
  const font = getFont(layer.fontFamily);
  if (!font) return "";

  const rawText = applyTextTransform(layer.text || "", layer.textTransform);
  const fontSize = Number(layer.fontSize) || 32;
  const maxWidth = Number(layer.width) || 960;
  const x = Number(layer.x) || 0;
  const y = Number(layer.y) || 0;
  const color = layer.fill || "#ffffff";
  const accentColor = layer.accentColor || "#00E676";
  const align = layer.align || "left";
  const lineHeightMultiplier = Number(layer.lineHeight) || 1.2;
  const lineHeight = fontSize * lineHeightMultiplier;
  const opacity = (layer.opacity ?? 100) / 100;
  const rotation = Number(layer.rotation) || 0;

  // Parse **highlighted** segments
  function parseSegments(text) {
    const segments = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      segments.push({ text: match[1], highlight: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), highlight: false });
    }
    return segments.length ? segments : [{ text, highlight: false }];
  }

  // Strip ** for line wrapping calculation
  const plainText = rawText.replace(/\*\*([^*]+)\*\*/g, '$1');
  const lines = wrapText(plainText, font, fontSize, maxWidth);

  // Now map segments back to lines
  const allSegments = parseSegments(rawText);

  // Build plain text from segments to track position
  let segmentQueue = [...allSegments];

  const paths = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = font.getAdvanceWidth(line, fontSize);
    const lineStartX = align === "center" ? x + (maxWidth - lineWidth) / 2
                     : align === "right" ? x + maxWidth - lineWidth
                     : x;
    const baselineY = y + fontSize + i * lineHeight;

    // For each line, find which segments contribute
    let remaining = line;
    let curX = lineStartX;

    while (remaining.length > 0 && segmentQueue.length > 0) {
      const seg = segmentQueue[0];
      const segPlain = seg.text;

      if (segPlain.length === 0) {
        segmentQueue.shift();
        continue;
      }

      // How much of this segment fits in remaining line text
      let take = "";
      let matchLen = 0;
      for (let c = 0; c < segPlain.length && matchLen < remaining.length; c++) {
        if (segPlain[c] === remaining[matchLen]) {
          take += segPlain[c];
          matchLen++;
        }
      }

      if (take.length === 0) {
        // Skip whitespace alignment
        if (remaining[0] === ' ') {
          curX += font.getAdvanceWidth(' ', fontSize);
          remaining = remaining.slice(1);
          continue;
        }
        segmentQueue.shift();
        continue;
      }

      const segColor = seg.highlight ? accentColor : color;
      const pathData = font.getPath(take, curX, baselineY, fontSize).toPathData(2);
      paths.push(`<path fill="${escapeXml(segColor)}" d="${pathData}" />`);

      curX += font.getAdvanceWidth(take, fontSize);
      remaining = remaining.slice(matchLen);

      // Update or remove segment from queue
      if (take.length >= segPlain.length) {
        segmentQueue.shift();
      } else {
        segmentQueue[0] = { ...seg, text: segPlain.slice(take.length) };
      }
    }
  }

  if (!paths.length) return "";
  const cx = x + maxWidth / 2;
  const cy = y + (lines.length * lineHeight) / 2;
  let groupAttrs = "";
  if (rotation !== 0) groupAttrs += ` transform="rotate(${rotation}, ${cx}, ${cy})"`;
  if (opacity < 1) groupAttrs += ` opacity="${opacity}"`;
  return groupAttrs ? `<g${groupAttrs}>${paths.join("")}</g>` : paths.join("");
}

function renderRectLayer(layer) {
  const x = Number(layer.x) || 0;
  const y = Number(layer.y) || 0;
  const w = Number(layer.width) || 100;
  const h = Number(layer.height) || 100;
  const opacity = (layer.opacity ?? 100) / 100;
  const rotation = Number(layer.rotation) || 0;
  const radius = Number(layer.radius) || 0;
  const id = `rect-${layer.id || Math.random().toString(36).slice(2)}`;

  let fill = escapeXml(layer.fill || "#394154");
  let defs = "";

  if (layer.fillType === "gradient" && layer.gradientFrom && layer.gradientTo) {
    const dir = layer.gradientDirection || "vertical";
    const gradId = `grad-${id}`;
    const coords =
      dir === "horizontal"
        ? 'x1="0" y1="0" x2="1" y2="0"'
        : dir === "diagonal"
          ? 'x1="0" y1="0" x2="1" y2="1"'
          : 'x1="0" y1="0" x2="0" y2="1"';
    defs = `<defs><linearGradient id="${gradId}" ${coords}>
      <stop offset="0%" stop-color="${escapeXml(layer.gradientFrom)}" />
      <stop offset="100%" stop-color="${escapeXml(layer.gradientTo)}" />
    </linearGradient></defs>`;
    fill = `url(#${gradId})`;
  }

  const stroke =
    layer.borderEnabled && layer.strokeWidth
      ? ` stroke="${escapeXml(layer.strokeColor || "#fff")}" stroke-width="${layer.strokeWidth}"`
      : "";
  const cx = x + w / 2;
  const cy = y + h / 2;
  const transform = rotation !== 0 ? ` transform="rotate(${rotation}, ${cx}, ${cy})"` : "";
  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}" opacity="${opacity}"${stroke}${transform} />`;
  return defs + rect;
}

function fitMode(layerFit) {
  if (layerFit === "contain" || layerFit === "fill" || layerFit === "cover") return layerFit;
  return "cover";
}

function collectVars(text) {
  if (typeof text !== "string") return [];
  const found = new Set();
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) found.add(m[1].trim());
  return Array.from(found);
}

function resolveFieldValue(fieldValue, data) {
  if (typeof fieldValue !== "string") return fieldValue;
  const singleVarMatch = fieldValue.match(/^\s*\{\{([^}]+)\}\}\s*$/);
  if (singleVarMatch) {
    const key = singleVarMatch[1].trim();
    return data?.[key];
  }
  if (!fieldValue.includes("{{")) return fieldValue;
  return substituteVars(fieldValue, data);
}

function collectImageCandidates(value) {
  const out = [];
  const walk = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      // Typical payload variants from parsers/storage.
      const keys = ["url", "src", "secure_url", "image", "imageUrl", "publicUrl", "original"];
      keys.forEach((k) => {
        if (k in v) walk(v[k]);
      });
      return;
    }
    if (typeof v !== "string") {
      out.push(String(v));
      return;
    }
    const trimmed = v.trim();
    if (!trimmed) return;
    // Supabase/text array payloads may come as JSON strings.
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        walk(parsed);
        return;
      } catch {
        // keep raw if parsing fails
      }
    }
    out.push(trimmed);
  };
  walk(value);
  return out;
}

function looksLikeBase64(input) {
  if (typeof input !== "string") return false;
  const str = input.replace(/\s+/g, "");
  if (str.length < 100 || str.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str);
}

async function imageSourceToBuffer(source) {
  if (!source || typeof source !== "string") return null;
  const value = source.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return downloadImage(value);

  const dataUrlMatch = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (dataUrlMatch) return Buffer.from(dataUrlMatch[1], "base64");

  if (/^base64,/i.test(value)) return Buffer.from(value.slice(7), "base64");

  if (looksLikeBase64(value)) return Buffer.from(value, "base64");

  return null;
}

function createIssueCollector() {
  const issues = [];
  const keys = new Set();
  return {
    add(issue) {
      const key = `${issue.code}|${issue.layerId || ""}|${issue.field || ""}|${issue.variable || ""}|${issue.value || ""}`;
      if (keys.has(key)) return;
      keys.add(key);
      issues.push(issue);
    },
    all() {
      return issues;
    }
  };
}

async function resolveImageBuffer(layer, data, issueCollector, strict) {
  const srcResolved = resolveFieldValue(layer.src, data);
  const fallbackResolved = resolveFieldValue(layer.defaultImage, data);
  const unresolvedSrcVars = collectVars(typeof srcResolved === "string" ? srcResolved : "");
  const unresolvedFallbackVars = collectVars(typeof fallbackResolved === "string" ? fallbackResolved : "");

  if (strict) {
    unresolvedSrcVars.forEach((v) =>
      issueCollector.add({
        code: "MISSING_VARIABLE",
        message: `Missing variable '${v}' for image source`,
        layerId: layer.id,
        layerName: layer.name || null,
        field: "src",
        variable: v
      })
    );
    unresolvedFallbackVars.forEach((v) =>
      issueCollector.add({
        code: "MISSING_VARIABLE",
        message: `Missing variable '${v}' for default image source`,
        layerId: layer.id,
        layerName: layer.name || null,
        field: "defaultImage",
        variable: v
      })
    );
  }

  const candidates = [
    ...collectImageCandidates(srcResolved),
    ...collectImageCandidates(fallbackResolved)
  ];
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    try {
      const buffer = await imageSourceToBuffer(candidate);
      if (buffer && buffer.length > 0) return buffer;
      if (strict) {
        issueCollector.add({
          code: "INVALID_IMAGE_SOURCE",
          message: "Unsupported image source format",
          layerId: layer.id,
          layerName: layer.name || null,
          field: "src",
          value: candidate.slice(0, 120)
        });
      }
    } catch (e) {
      if (strict) {
        issueCollector.add({
          code: "IMAGE_LOAD_FAILED",
          message: e.message || "Failed to load image",
          layerId: layer.id,
          layerName: layer.name || null,
          field: "src",
          value: candidate.slice(0, 120)
        });
      }
    }
  }
  return null;
}

export async function renderTemplate(templateInput, data = {}, options = {}) {
  const template =
    Array.isArray(templateInput) ? { width: 1080, height: 1350, layers: templateInput } : templateInput || {};
  const tw = Number(template.width) || 1080;
  const th = Number(template.height) || 1350;
  const layers = Array.isArray(template.layers) ? template.layers.map((x) => ({ ...x })) : [];
  const strict = options?.strict === true;
  const issues = createIssueCollector();

  let baseImage = null;
  let baseLayerId = null;

  // Phase 1: pick base image from a full-size image layer.
  for (const layer of layers) {
    if (layer.visible === false) continue;
    if (layer.type !== "image" && layer.type !== "logo") continue;

    const coversFullWidth = (layer.width || 0) >= tw * 0.8;
    const coversFullHeight = (layer.height || 0) >= th * 0.8;
    const isAtOrigin = (layer.x || 0) <= 10 && (layer.y || 0) <= 10;
    if (!coversFullWidth || !coversFullHeight || !isAtOrigin) continue;

    const baseBuffer = await resolveImageBuffer(layer, data, issues, strict);
    if (!baseBuffer) continue;

    baseImage = sharp(baseBuffer).resize(tw, th, { fit: "cover" });
    baseLayerId = layer.id;
    break;
  }

  if (!baseImage) {
    const bgRect = layers.find(
      (l) =>
        l.type === "rect" &&
        l.visible !== false &&
        (l.width || 0) >= tw * 0.8 &&
        (l.height || 0) >= th * 0.8
    );

    if (bgRect && bgRect.fillType !== "gradient") {
      baseImage = sharp({
        create: { width: tw, height: th, channels: 4, background: bgRect.fill || "#ffffff" }
      });
      baseLayerId = bgRect.id;
    } else {
      baseImage = sharp({ create: { width: tw, height: th, channels: 4, background: "#101010" } });
    }
  }

  const composites = [];

  for (const layer of layers) {
    if (layer.visible === false) continue;
    if (layer.id === baseLayerId) continue;

    const resolved = { ...layer };
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === "string" && value.includes("{{")) {
        resolved[key] = substituteVars(value, data);
      }
    }

    if (layer.type === "text") {
      if (strict) {
        const unresolved = collectVars(resolved.text);
        unresolved.forEach((v) =>
          issues.add({
            code: "MISSING_VARIABLE",
            message: `Missing variable '${v}' for text`,
            layerId: layer.id,
            layerName: layer.name || null,
            field: "text",
            variable: v
          })
        );
      }

      const svgContent = renderTextLayer(resolved);
      if (svgContent) {
        const svgBuffer = Buffer.from(
          `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`
        );
        composites.push({ input: svgBuffer, left: 0, top: 0 });
      }
      continue;
    }

    if (layer.type === "rect") {
      const svgContent = renderRectLayer(resolved);
      if (svgContent) {
        const svgBuffer = Buffer.from(
          `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`
        );
        composites.push({ input: svgBuffer, left: 0, top: 0 });
      }
      continue;
    }

    if (layer.type === "image" || layer.type === "logo") {
      const imgBuffer = await resolveImageBuffer(layer, data, issues, strict);
      if (!imgBuffer) continue;

      try {
        const lw = Math.max(1, Number(layer.width) || 200);
        const lh = Math.max(1, Number(layer.height) || 200);
        const fit = fitMode(layer.fit || "cover");
        let imgSharp = sharp(imgBuffer).resize(lw, lh, { fit });

        if ((layer.opacity ?? 100) < 100) {
          const alpha = Math.round(((layer.opacity ?? 100) / 100) * 255);
          imgSharp = imgSharp.ensureAlpha().composite([
            {
              input: Buffer.from([0, 0, 0, alpha]),
              raw: { width: 1, height: 1, channels: 4 },
              tile: true,
              blend: "dest-in"
            }
          ]);
        }

        if (layer.radius && layer.radius > 0) {
          const mask = Buffer.from(
            `<svg width="${lw}" height="${lh}"><rect width="${lw}" height="${lh}" rx="${layer.radius}" ry="${layer.radius}" fill="white"/></svg>`
          );
          imgSharp = imgSharp.composite([{ input: mask, blend: "dest-in" }]);
        }

        // Circle shape
        if (layer.shape === 'circle') {
          const cx = lw / 2;
          const cy = lh / 2;
          const r = Math.min(lw, lh) / 2;
          const mask = Buffer.from(
            `<svg width="${lw}" height="${lh}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/></svg>`
          );
          imgSharp = imgSharp.composite([{ input: mask, blend: "dest-in" }]);
        }

        // Border for images
        if (layer.borderWidth && layer.borderWidth > 0) {
          const bw = Number(layer.borderWidth);
          const bc = escapeXml(layer.borderColor || '#ffffff');
          let borderSvg;
          if (layer.shape === 'circle') {
            const cx = lw / 2;
            const cy = lh / 2;
            const r = Math.min(lw, lh) / 2 - bw / 2;
            borderSvg = `<svg width="${lw}" height="${lh}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${bc}" stroke-width="${bw}"/></svg>`;
          } else {
            const rx = layer.radius || 0;
            borderSvg = `<svg width="${lw}" height="${lh}"><rect x="${bw/2}" y="${bw/2}" width="${lw-bw}" height="${lh-bw}" rx="${rx}" ry="${rx}" fill="none" stroke="${bc}" stroke-width="${bw}"/></svg>`;
          }
          imgSharp = imgSharp.composite([{ input: Buffer.from(borderSvg), blend: "over" }]);
        }

        const processedBuffer = await imgSharp.png().toBuffer();
        composites.push({
          input: processedBuffer,
          left: Math.round(layer.x || 0),
          top: Math.round(layer.y || 0)
        });
      } catch (e) {
        if (strict) {
          issues.add({
            code: "IMAGE_PROCESS_FAILED",
            message: e.message || "Failed to process image",
            layerId: layer.id,
            layerName: layer.name || null,
            field: "src"
          });
        }
      }
    }
  }

  if (strict && issues.all().length > 0) {
    throw new RenderValidationError("Render validation failed", issues.all());
  }

  return baseImage.composite(composites).png().toBuffer();
}
