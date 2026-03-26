import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Router } from "express";
import archiver from "archiver";
import { RenderValidationError, renderTemplate } from "../engine/renderer.js";
import { getSupabase } from "../storage/supabase.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "../templates");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dbRowToTemplate(row) {
  return {
    id: row.id, slug: row.slug, name: row.name,
    width: row.width, height: row.height,
    layers: row.layers || [],
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

async function readTemplateByIdOrSlug(key) {
  // Try Supabase first
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('templates').select('*').eq('id', key).single();
    if (data) return dbRowToTemplate(data);
    const { data: slugData } = await sb.from('templates').select('*').eq('slug', slugify(key)).single();
    if (slugData) return dbRowToTemplate(slugData);
  }

  // Filesystem fallback
  const idPath = path.join(templatesDir, `${key}.json`);
  if (existsSync(idPath)) return JSON.parse(readFileSync(idPath, "utf-8"));

  const normalized = slugify(key);
  const files = readdirSync(templatesDir).filter((f) => f.endsWith(".json"));
  for (const fileName of files) {
    try {
      const d = JSON.parse(readFileSync(path.join(templatesDir, fileName), "utf-8"));
      const dataSlug = slugify(d.slug || d.name || d.id || fileName.replace(".json", ""));
      if (dataSlug === normalized || d.id === key) return d;
    } catch { /* ignore */ }
  }
  return null;
}

function handleRenderError(res, error) {
  if (error instanceof RenderValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: "VALIDATION_ERROR",
      details: error.details
    });
  }
  console.error("Render error:", error);
  return res.status(500).json({ success: false, error: error.message });
}

function getBatchRequestConfig(body) {
  const strict = body.strict !== false;
  const items = Array.isArray(body.items) ? body.items : [];
  return { strict, items };
}

async function resolveBatchTemplate(body) {
  if (body.template && Array.isArray(body.template.layers)) return body.template;
  const key = body.templateId || body.slug;
  if (!key) return null;
  return await readTemplateByIdOrSlug(key);
}

async function validateBatchRequest(body) {
  const { items } = getBatchRequestConfig(body);
  if (!items.length) {
    return {
      ok: false,
      status: 400,
      payload: { success: false, error: "items array is required", code: "BAD_REQUEST" }
    };
  }
  if (items.length > 50) {
    return {
      ok: false,
      status: 400,
      payload: { success: false, error: "items limit exceeded (max 50)", code: "BAD_REQUEST" }
    };
  }
  const hasTemplate = !!(body.template && Array.isArray(body.template.layers));
  const hasTemplateRef = !!(body.templateId || body.slug);
  if (!hasTemplate && !hasTemplateRef) {
    return {
      ok: false,
      status: 400,
      payload: {
        success: false,
        error: "template or templateId/slug is required",
        code: "BAD_REQUEST"
      }
    };
  }
  const template = await resolveBatchTemplate(body);
  if (!template) {
    const key = body.templateId || body.slug;
    return {
      ok: false,
      status: 404,
      payload: {
        success: false,
        error: `Template '${key}' not found`,
        code: "NOT_FOUND"
      }
    };
  }
  return { ok: true, template };
}

function sanitizeFilePart(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (normalized || fallback).slice(0, 80);
}

async function renderBatchItems(template, items, strict, mode = "base64") {
  const results = [];
  let successCount = 0;
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    const rowData =
      row && typeof row === "object" && !Array.isArray(row) && "data" in row ? row.data || {} : row || {};
    const itemId =
      row && typeof row === "object" && !Array.isArray(row) && "id" in row ? row.id : `item-${i + 1}`;
    try {
      const png = await renderTemplate(template, rowData, { strict });
      const base = {
        id: itemId,
        index: i,
        success: true,
        mimeType: "image/png"
      };
      if (mode === "buffer") {
        base.imageBuffer = png;
      } else {
        base.imageBase64 = png.toString("base64");
      }
      results.push(base);
      successCount += 1;
    } catch (error) {
      if (error instanceof RenderValidationError) {
        results.push({
          id: itemId,
          index: i,
          success: false,
          code: "VALIDATION_ERROR",
          error: error.message,
          details: error.details
        });
      } else {
        results.push({
          id: itemId,
          index: i,
          success: false,
          code: "RENDER_ERROR",
          error: error.message
        });
      }
    }
  }
  return { results, successCount, failureCount: items.length - successCount };
}

router.post("/batch", async (req, res) => {
  try {
    const body = req.body || {};
    const validation = await validateBatchRequest(body);
    if (!validation.ok) return res.status(validation.status).json(validation.payload);
    const { strict, items } = getBatchRequestConfig(body);
    const batch = await renderBatchItems(validation.template, items, strict, "base64");
    return res.json({
      success: true,
      data: {
        total: items.length,
        successCount: batch.successCount,
        failureCount: batch.failureCount,
        results: batch.results
      }
    });
  } catch (error) {
    return handleRenderError(res, error);
  }
});

router.post("/batch/zip", async (req, res) => {
  try {
    const body = req.body || {};
    const validation = await validateBatchRequest(body);
    if (!validation.ok) return res.status(validation.status).json(validation.payload);
    const { strict, items } = getBatchRequestConfig(body);
    const batch = await renderBatchItems(validation.template, items, strict, "buffer");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
      } else {
        res.destroy(error);
      }
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=\"render-batch-${timestamp}.zip\"`);
    archive.pipe(res);

    const manifestResults = batch.results.map((item) => {
      if (!item.success) return item;
      const fileName = `${String(item.index + 1).padStart(3, "0")}-${sanitizeFilePart(item.id, `item-${item.index + 1}`)}.png`;
      archive.append(item.imageBuffer, { name: `images/${fileName}` });
      return {
        id: item.id,
        index: item.index,
        success: true,
        mimeType: item.mimeType,
        file: `images/${fileName}`
      };
    });

    const manifest = {
      success: true,
      data: {
        total: items.length,
        successCount: batch.successCount,
        failureCount: batch.failureCount,
        results: manifestResults
      }
    };
    archive.append(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), { name: "manifest.json" });
    await archive.finalize();
    return undefined;
  } catch (error) {
    return handleRenderError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const { template, data = {}, strict = false } = req.body || {};
    if (!template || !Array.isArray(template.layers)) {
      return res.status(400).json({ success: false, error: "template with layers is required" });
    }
    const png = await renderTemplate(template, data, { strict: strict === true });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", png.length);
    return res.send(png);
  } catch (error) {
    return handleRenderError(res, error);
  }
});

router.post("/:templateId", async (req, res) => {
  try {
    const template = await readTemplateByIdOrSlug(req.params.templateId);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: `Template '${req.params.templateId}' not found` });
    }
    const body = req.body || {};
    const strict = body._strict !== false;
    const data = { ...body };
    delete data._strict;
    const png = await renderTemplate(template, data, { strict });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", png.length);
    return res.send(png);
  } catch (error) {
    return handleRenderError(res, error);
  }
});

router.get("/:templateId/preview", async (req, res) => {
  try {
    const template = await readTemplateByIdOrSlug(req.params.templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    const placeholderData = {};
    const vars = new Set();
    (template.layers || []).forEach((layer) => {
      Object.values(layer || {}).forEach((value) => {
        if (typeof value !== "string") return;
        const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
        for (const m of matches) vars.add(m[1].trim());
      });
    });

    for (const v of vars) {
      if (
        v.toLowerCase().includes("image") ||
        v.toLowerCase().includes("url") ||
        v.toLowerCase().includes("photo")
      ) {
        placeholderData[v] = "";
      } else {
        placeholderData[v] = v.toUpperCase();
      }
    }

    const png = await renderTemplate(template, placeholderData, { strict: false });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.send(png);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
