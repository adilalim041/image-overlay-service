import crypto from "node:crypto";

function getAuthConfig() {
  return {
    templateApiKey: process.env.TEMPLATE_API_KEY || "",
    adminUsername: process.env.TEMPLATE_ADMIN_USERNAME || "",
    adminPassword: process.env.TEMPLATE_ADMIN_PASSWORD || "",
    allowUnauthenticated: process.env.ALLOW_UNAUTHENTICATED_TEMPLATE_API === "true"
  };
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hasBearerAccess(header, templateApiKey) {
  const token = String(header || "").replace(/^Bearer\s+/i, "").trim();
  return safeEqual(token, templateApiKey);
}

function hasBasicAccess(header, adminUsername, adminPassword) {
  const match = String(header || "").match(/^Basic\s+(.+)$/i);
  if (!match || !adminUsername || !adminPassword) return false;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return safeEqual(username, adminUsername) && safeEqual(password, adminPassword);
  } catch {
    return false;
  }
}

export function isTemplateAuthConfigured() {
  const { templateApiKey, adminUsername, adminPassword, allowUnauthenticated } = getAuthConfig();
  return allowUnauthenticated || Boolean(templateApiKey || (adminUsername && adminPassword));
}

export function assertTemplateAuthConfigured() {
  if (!isTemplateAuthConfigured()) {
    throw new Error(
      "TemplateV1 auth is not configured. Set TEMPLATE_API_KEY or TEMPLATE_ADMIN_USERNAME/TEMPLATE_ADMIN_PASSWORD, or set ALLOW_UNAUTHENTICATED_TEMPLATE_API=true for local development only."
    );
  }
}

export function authMiddleware(req, res, next) {
  const { templateApiKey, adminUsername, adminPassword, allowUnauthenticated } = getAuthConfig();
  if (allowUnauthenticated || req.method === "OPTIONS") return next();

  const header = req.headers.authorization || "";
  if (hasBearerAccess(header, templateApiKey) || hasBasicAccess(header, adminUsername, adminPassword)) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="TemplateV1"');
  return res.status(401).json({ error: "Unauthorized" });
}
