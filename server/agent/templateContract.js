export const TEMPLATE_CONTRACT_VERSION = "2026-06-15";

export const TEMPLATE_LAYER_TYPES = ["text", "image", "logo", "rect", "line"];

export const TEMPLATE_AGENT_CONTRACT = {
  version: TEMPLATE_CONTRACT_VERSION,
  canvas: {
    minWidth: 200,
    maxWidth: 4096,
    minHeight: 200,
    maxHeight: 4096,
    recommendedSizes: [
      { name: "instagram_feed_portrait", width: 1080, height: 1350 },
      { name: "instagram_square", width: 1080, height: 1080 },
      { name: "story_reel_vertical", width: 1080, height: 1920 }
    ]
  },
  layerTypes: TEMPLATE_LAYER_TYPES,
  variables: {
    syntax: "{{variableName}}",
    pattern: "^[A-Za-z][A-Za-z0-9_]{0,63}$",
    common: ["headline", "headline2", "caption", "imageUrl", "source", "date"]
  },
  endpoints: {
    schema: "GET /api/templates/agent/schema",
    validate: "POST /api/templates/agent/validate",
    save: "POST /api/templates",
    update: "PUT /api/templates/:id",
    renderInline: "POST /api/render",
    renderSaved: "POST /api/render/:templateId",
    fitCheck: "POST /api/templates/:id/fit-check"
  }
};

const TEMPLATE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const VARIABLE_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{3,8}$/;

function addIssue(issues, severity, path, code, message) {
  issues.push({ severity, path, code, message });
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

function validateOptionalNumber(value, issues, path) {
  if (value === undefined) return;
  if (!isFiniteNumber(value)) {
    addIssue(issues, "error", path, "INVALID_NUMBER", "Expected a finite number.");
  }
}

function validatePositiveNumber(value, issues, path) {
  if (!isPositiveNumber(value)) {
    addIssue(issues, "error", path, "INVALID_SIZE", "Expected a positive number.");
  }
}

function validateOptionalColor(value, issues, path) {
  if (value === undefined || value === null || value === "" || value === "gradient") return;
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
    addIssue(issues, "warning", path, "UNUSUAL_COLOR", "Expected a hex color such as #ffffff or #000000cc.");
  }
}

export function collectTemplateVariables(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTemplateVariables(item, found));
    return found;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => collectTemplateVariables(item, found));
    return found;
  }
  if (typeof value !== "string") return found;
  for (const match of value.matchAll(/\{\{([^}]+)\}\}/g)) {
    found.add(match[1].trim());
  }
  return found;
}

function validateVariableNames(template, issues) {
  for (const variable of collectTemplateVariables(template)) {
    if (!VARIABLE_NAME_RE.test(variable)) {
      addIssue(
        issues,
        "error",
        "variables",
        "INVALID_VARIABLE_NAME",
        `Variable '${variable}' must match ${TEMPLATE_AGENT_CONTRACT.variables.pattern}.`
      );
    }
  }
}

function validateLayerBounds(layer, template, issues, index) {
  if (!isFiniteNumber(layer.x) || !isFiniteNumber(layer.y)) return;
  if (!isFiniteNumber(layer.width) || !isFiniteNumber(layer.height)) return;

  const outside =
    layer.x + layer.width < 0 ||
    layer.y + layer.height < 0 ||
    layer.x > template.width ||
    layer.y > template.height;

  if (outside) {
    addIssue(issues, "warning", `layers[${index}]`, "LAYER_OUTSIDE_CANVAS", "Layer is completely outside the canvas.");
  }
}

function validateBaseLayer(layer, issues, index) {
  const path = `layers[${index}]`;
  if (!isPlainObject(layer)) {
    addIssue(issues, "error", path, "INVALID_LAYER", "Layer must be an object.");
    return false;
  }
  if (!layer.id || typeof layer.id !== "string") {
    addIssue(issues, "error", `${path}.id`, "MISSING_LAYER_ID", "Layer id is required.");
  }
  if (!TEMPLATE_LAYER_TYPES.includes(layer.type)) {
    addIssue(issues, "error", `${path}.type`, "UNKNOWN_LAYER_TYPE", `Layer type must be one of: ${TEMPLATE_LAYER_TYPES.join(", ")}.`);
    return false;
  }

  validateOptionalNumber(layer.x, issues, `${path}.x`);
  validateOptionalNumber(layer.y, issues, `${path}.y`);
  validateOptionalNumber(layer.rotation, issues, `${path}.rotation`);
  validateOptionalNumber(layer.opacity, issues, `${path}.opacity`);
  return true;
}

function validateTextLayer(layer, issues, index) {
  const path = `layers[${index}]`;
  validatePositiveNumber(layer.width, issues, `${path}.width`);
  validatePositiveNumber(layer.height, issues, `${path}.height`);
  if (typeof layer.text !== "string") {
    addIssue(issues, "error", `${path}.text`, "MISSING_TEXT", "Text layer requires a text string.");
  }
  validatePositiveNumber(layer.fontSize, issues, `${path}.fontSize`);
  validateOptionalColor(layer.fill || layer.color, issues, `${path}.fill`);
  if (layer.align && !["left", "center", "right"].includes(layer.align)) {
    addIssue(issues, "warning", `${path}.align`, "UNUSUAL_TEXT_ALIGN", "Expected left, center, or right.");
  }
}

function validateImageLayer(layer, issues, index) {
  const path = `layers[${index}]`;
  validatePositiveNumber(layer.width, issues, `${path}.width`);
  validatePositiveNumber(layer.height, issues, `${path}.height`);
  if (!layer.src && !layer.defaultImage) {
    addIssue(issues, "error", `${path}.src`, "MISSING_IMAGE_SOURCE", "Image/logo layer requires src or defaultImage.");
  }
  if (layer.fit && !["cover", "contain", "fill", "inside", "outside"].includes(layer.fit)) {
    addIssue(issues, "warning", `${path}.fit`, "UNUSUAL_IMAGE_FIT", "Expected cover, contain, fill, inside, or outside.");
  }
}

function validateRectLayer(layer, issues, index) {
  const path = `layers[${index}]`;
  validatePositiveNumber(layer.width, issues, `${path}.width`);
  validatePositiveNumber(layer.height, issues, `${path}.height`);
  validateOptionalColor(layer.fill, issues, `${path}.fill`);
  validateOptionalColor(layer.gradientFrom, issues, `${path}.gradientFrom`);
  validateOptionalColor(layer.gradientTo, issues, `${path}.gradientTo`);
}

function validateLineLayer(layer, issues, index) {
  const path = `layers[${index}]`;
  ["x1", "y1", "x2", "y2"].forEach((key) => validateOptionalNumber(layer[key], issues, `${path}.${key}`));
  validatePositiveNumber(layer.strokeWidth ?? 1, issues, `${path}.strokeWidth`);
  validateOptionalColor(layer.stroke || layer.fill, issues, `${path}.stroke`);
  validateOptionalColor(layer.gradientFrom, issues, `${path}.gradientFrom`);
  validateOptionalColor(layer.gradientTo, issues, `${path}.gradientTo`);
}

function validateLayer(layer, template, issues, seenIds, index) {
  if (!validateBaseLayer(layer, issues, index)) return;

  if (seenIds.has(layer.id)) {
    addIssue(issues, "error", `layers[${index}].id`, "DUPLICATE_LAYER_ID", `Layer id '${layer.id}' is duplicated.`);
  }
  seenIds.add(layer.id);

  if (layer.type === "text") validateTextLayer(layer, issues, index);
  if (layer.type === "image" || layer.type === "logo") validateImageLayer(layer, issues, index);
  if (layer.type === "rect") validateRectLayer(layer, issues, index);
  if (layer.type === "line") validateLineLayer(layer, issues, index);
  validateLayerBounds(layer, template, issues, index);
}

function buildMeta(template) {
  const variables = Array.from(collectTemplateVariables(template)).sort();
  return {
    id: template.id || null,
    name: template.name || null,
    width: template.width || null,
    height: template.height || null,
    layerCount: Array.isArray(template.layers) ? template.layers.length : 0,
    variables
  };
}

export function validateTemplate(template) {
  const issues = [];

  if (!isPlainObject(template)) {
    return {
      valid: false,
      issues: [{ severity: "error", path: "$", code: "INVALID_TEMPLATE", message: "Template must be an object." }],
      meta: {}
    };
  }

  if (template.id !== undefined && (typeof template.id !== "string" || !TEMPLATE_ID_RE.test(template.id))) {
    addIssue(issues, "error", "id", "INVALID_TEMPLATE_ID", "Template id must be 1-80 chars: letters, numbers, underscore, dash.");
  }
  if (template.name !== undefined && typeof template.name !== "string") {
    addIssue(issues, "error", "name", "INVALID_TEMPLATE_NAME", "Template name must be a string.");
  }

  validatePositiveNumber(template.width, issues, "width");
  validatePositiveNumber(template.height, issues, "height");
  if (isFiniteNumber(template.width) && (template.width < 200 || template.width > 4096)) {
    addIssue(issues, "error", "width", "CANVAS_WIDTH_OUT_OF_RANGE", "Canvas width must be between 200 and 4096.");
  }
  if (isFiniteNumber(template.height) && (template.height < 200 || template.height > 4096)) {
    addIssue(issues, "error", "height", "CANVAS_HEIGHT_OUT_OF_RANGE", "Canvas height must be between 200 and 4096.");
  }

  if (!Array.isArray(template.layers)) {
    addIssue(issues, "error", "layers", "MISSING_LAYERS", "Template requires a layers array.");
  } else {
    if (template.layers.length === 0) {
      addIssue(issues, "warning", "layers", "EMPTY_TEMPLATE", "Template has no layers.");
    }
    if (template.layers.length > 100) {
      addIssue(issues, "error", "layers", "TOO_MANY_LAYERS", "Template supports up to 100 layers.");
    }

    const seenIds = new Set();
    template.layers.forEach((layer, index) => validateLayer(layer, template, issues, seenIds, index));
  }

  validateVariableNames(template, issues);

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    meta: buildMeta(template)
  };
}
