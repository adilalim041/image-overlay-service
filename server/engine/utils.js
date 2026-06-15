import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

function isIpv4InRange(parts, first, secondStart = 0, secondEnd = 255) {
  return parts[0] === first && parts[1] >= secondStart && parts[1] <= secondEnd;
}

export function isPrivateAddress(address) {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    return (
      isIpv4InRange(parts, 0) ||
      isIpv4InRange(parts, 10) ||
      isIpv4InRange(parts, 100, 64, 127) ||
      isIpv4InRange(parts, 127) ||
      isIpv4InRange(parts, 169, 254, 254) ||
      isIpv4InRange(parts, 172, 16, 31) ||
      isIpv4InRange(parts, 192, 0, 0) ||
      isIpv4InRange(parts, 192, 168, 168) ||
      isIpv4InRange(parts, 198, 18, 19) ||
      parts[0] >= 224
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("2001:db8:")
    ) {
      return true;
    }

    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedIpv4) return isPrivateAddress(mappedIpv4[1]);
  }

  return false;
}

function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

export async function resolvePublicAddresses(hostname, resolver = dns.lookup) {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked private image host");
  }

  const directIpVersion = net.isIP(hostname);
  if (directIpVersion) {
    if (isPrivateAddress(hostname)) throw new Error("Blocked private image host");
    return [{ address: hostname, family: directIpVersion }];
  }

  const addresses = await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Image host did not resolve");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Blocked private image host");
  }
  return addresses;
}

export async function assertSafeImageUrl(rawUrl, options = {}) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported image URL protocol");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Image URL credentials are not allowed");
  }

  const addresses = await resolvePublicAddresses(parsed.hostname, options.resolver);
  return { parsed, addresses };
}

function buildPinnedLookup(addresses) {
  return (hostname, lookupOptions, callback) => {
    const family = typeof lookupOptions === "object" ? lookupOptions.family : 0;
    const selected = addresses.find((entry) => !family || entry.family === family) || addresses[0];
    callback(null, selected.address, selected.family);
  };
}

export async function downloadImage(url, options = {}) {
  return downloadImageInternal(url, 0, options);
}

async function downloadImageInternal(url, redirectCount, options) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
  }

  const { parsed, addresses } = await assertSafeImageUrl(url, options);
  const client = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client
      .get(parsed, {
        headers: { "User-Agent": "AdilFlow/1.0" },
        lookup: buildPinnedLookup(addresses),
        timeout: DOWNLOAD_TIMEOUT_MS
      }, (res) => {
        if (REDIRECT_STATUS_CODES.has(res.statusCode)) {
          if (!res.headers.location) return reject(new Error("Redirect without location"));
          const nextUrl = new URL(res.headers.location, parsed).toString();
          res.resume();
          return downloadImageInternal(nextUrl, redirectCount + 1, options).then(resolve).catch(reject);
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
