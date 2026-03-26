import http from "node:http";
import https from "node:https";

const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function downloadImage(url, _redirectCount = 0) {
  if (_redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error(`Too many redirects (>${MAX_REDIRECTS})`));
  }
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client
      .get(url, { headers: { "User-Agent": "AdilFlow/1.0" }, timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (!res.headers.location) return reject(new Error("Redirect without location"));
          return downloadImage(res.headers.location, _redirectCount + 1).then(resolve).catch(reject);
        }
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(new Error(`Image download failed: ${res.statusCode}`));
        }
        const chunks = [];
        let totalSize = 0;
        res.on("data", (c) => {
          totalSize += c.length;
          if (totalSize > MAX_SIZE_BYTES) {
            res.destroy();
            return reject(new Error(`Image too large (>${MAX_SIZE_BYTES / 1024 / 1024}MB)`));
          }
          chunks.push(c);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error(`Download timed out after ${DOWNLOAD_TIMEOUT_MS}ms`)); });
  });
}

export function escapeXml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function substituteVars(text, data) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const val = data[key.trim()];
    return val !== undefined ? String(val) : match;
  });
}
