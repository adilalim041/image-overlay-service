import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync
} from "node:fs";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getFont } from "../engine/fonts.js";
import { authMiddleware } from "../middleware/auth.js";
import { getSupabase, isSupabaseConfigured } from "../storage/supabase.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "../templates");

if (!existsSync(templatesDir)) mkdirSync(templatesDir, { recursive: true });

// ═══════════════════════════════════════
// STORAGE ABSTRACTION (Supabase → filesystem fallback)
// ═══════════════════════════════════════

async function storageGetAll() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('templates').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(dbRowToTemplate);
  }
  return readdirSync(templatesDir)
    .filter(f => f.endsWith(".json"))
    .map(f => readTemplateSafe(f))
    .filter(Boolean);
}

async function storageGetById(id) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('templates').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? dbRowToTemplate(data) : null;
  }
  const filePath = path.join(templatesDir, `${id}.json`);
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf-8")); } catch { return null; }
}

async function storageGetBySlug(slug) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('templates').select('*').eq('slug', slug).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? dbRowToTemplate(data) : null;
  }
  const target = slugify(slug);
  const fileName = readAllTemplateFiles().find(f => {
    const d = readTemplateSafe(f);
    if (!d) return false;
    return slugify(d.slug || d.name || d.id || f.replace(".json", "")) === target;
  });
  return fileName ? readTemplateSafe(fileName) : null;
}

async function storageSave(template) {
  const sb = getSupabase();
  if (sb) {
    const row = templateToDbRow(template);
    const { data, error } = await sb.from('templates').upsert(row, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);
    return dbRowToTemplate(data);
  }
  writeFileSync(path.join(templatesDir, `${template.id}.json`), JSON.stringify(template, null, 2));
  return template;
}

async function storageDelete(id) {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('templates').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
  const filePath = path.join(templatesDir, `${id}.json`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

async function storageSlugExists(slug, excludeId = "") {
  const sb = getSupabase();
  if (sb) {
    let query = sb.from('templates').select('id').eq('slug', slug);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    return data && data.length > 0;
  }
  return readAllTemplateFiles()
    .map(f => readTemplateSafe(f))
    .filter(Boolean)
    .filter(t => t.id !== excludeId)
    .some(t => slugify(t.slug || t.name || t.id) === slug);
}

function dbRowToTemplate(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    width: row.width,
    height: row.height,
    layers: row.layers || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function templateToDbRow(t) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    width: t.width,
    height: t.height,
    layers: t.layers || [],
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// ═══════════════════════════════════════
// HELPER FUNCTIONS (unchanged)
// ═══════════════════════════════════════

function collectTemplateVariables(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTemplateVariables(item, found));
    return found;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectTemplateVariables(item, found));
    return found;
  }
  if (typeof value !== "string") return found;
  for (const match of value.matchAll(/\{\{([^}]+)\}\}/g)) {
    found.add(match[1].trim());
  }
  return found;
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

function getSingleTemplateVariable(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^\s*\{\{([^}]+)\}\}\s*$/);
  return match ? match[1].trim() : null;
}

function buildTextBindings(template) {
  return (template?.layers || [])
    .filter((layer) => layer?.type === "text")
    .map((layer) => {
      const variable = getSingleTemplateVariable(layer.text);
      if (!variable) return null;
      return {
        layerId: layer.id || null,
        layerName: layer.name || null,
        variable,
        width: Number(layer.width) || 0,
        height: Number(layer.height) || 0,
        fontSize: Number(layer.fontSize) || 32,
        fontFamily: layer.fontFamily || "regular",
        lineHeight: Number(layer.lineHeight) || 1.2,
        align: layer.align || "left"
      };
    })
    .filter(Boolean);
}

function analyzeTextBinding(binding, value) {
  const font = getFont(binding.fontFamily);
  const text = String(value || "").trim();
  const lines = wrapText(text, font, binding.fontSize, binding.width || 960);
  const lineHeightPx = binding.fontSize * (binding.lineHeight || 1.2);
  const textHeight = lines.length ? binding.fontSize + (lines.length - 1) * lineHeightPx : binding.fontSize;
  const maxLines = Math.max(1, Math.floor(((binding.height || binding.fontSize) - binding.fontSize) / lineHeightPx) + 1);
  const overflows = !!text && textHeight > (binding.height || binding.fontSize);

  return {
    layerId: binding.layerId,
    layerName: binding.layerName,
    variable: binding.variable,
    fontFamily: binding.fontFamily,
    fontSize: binding.fontSize,
    availableWidth: binding.width,
    availableHeight: binding.height,
    lineHeight: binding.lineHeight,
    lineCount: lines.length,
    maxLines,
    textHeight: Math.round(textHeight),
    fits: !overflows,
    lines
  };
}

function buildTemplateMeta(template, fallbackId = "") {
  const id = template?.id || fallbackId;
  const slug = slugify(template?.slug || template?.name || id);
  const requiredVariables = Array.from(collectTemplateVariables(template)).sort();
  const textBindings = buildTextBindings(template);
  return {
    id,
    slug,
    name: template?.name || "Untitled",
    width: template?.width || 1080,
    height: template?.height || 1350,
    layerCount: template?.layers?.length || 0,
    requiredVariables,
    textBindings,
    previewUrl: `/api/render/${id}/preview`,
    renderUrl: `/api/render/${id}`,
    updatedAt: template?.updatedAt || null,
    createdAt: template?.createdAt || null
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readAllTemplateFiles() {
  return readdirSync(templatesDir).filter((f) => f.endsWith(".json"));
}

function readTemplateSafe(fileName) {
  try {
    return JSON.parse(readFileSync(path.join(templatesDir, fileName), "utf-8"));
  } catch {
    return null;
  }
}

async function buildUniqueSlug(base, excludeId = "") {
  const candidate = slugify(base) || "template";
  if (!(await storageSlugExists(candidate, excludeId))) return candidate;
  let n = 2;
  while (await storageSlugExists(`${candidate}-${n}`, excludeId)) n += 1;
  return `${candidate}-${n}`;
}

// ═══════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════

router.get("/", async (req, res) => {
  try {
    const templates = await storageGetAll();
    const meta = templates.map(t => buildTemplateMeta(t, t.id));
    return res.json({ success: true, data: meta });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/by-slug/:slug", async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    const template = await storageGetBySlug(slug);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/meta", async (req, res) => {
  try {
    const template = await storageGetById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    return res.json({ success: true, data: buildTemplateMeta(template, req.params.id) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/fit-check", async (req, res) => {
  try {
    const template = await storageGetById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    const meta = buildTemplateMeta(template, req.params.id);
    const values = req.body || {};
    const checks = meta.textBindings.map((binding) => analyzeTextBinding(binding, values[binding.variable]));
    const issues = checks.filter((check) => !check.fits);
    return res.json({
      success: true,
      data: {
        templateId: meta.id,
        ok: issues.length === 0,
        checks,
        issues
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const template = await storageGetById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id || randomUUID().slice(0, 8);
    const slug = await buildUniqueSlug(body.slug || body.name || id, id);
    const template = {
      id,
      slug,
      name: body.name || "Untitled Template",
      width: body.width || 1080,
      height: body.height || 1350,
      layers: body.layers || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await storageSave(template);
    return res.json({ success: true, data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const existing = await storageGetById(req.params.id) || {};
    const shouldRebuildSlug =
      typeof req.body?.slug === "string" || typeof req.body?.name === "string" || !existing.slug;
    const nextSlug = shouldRebuildSlug
      ? await buildUniqueSlug(req.body.slug || req.body.name || existing.slug || req.params.id, req.params.id)
      : existing.slug;
    const template = {
      ...existing,
      ...req.body,
      id: req.params.id,
      slug: nextSlug,
      updatedAt: new Date().toISOString()
    };
    const saved = await storageSave(template);
    return res.json({ success: true, data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await storageDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
