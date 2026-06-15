import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTemplateAuthConfigured, authMiddleware } from "../middleware/auth.js";

const ENV_KEYS = [
  "TEMPLATE_API_KEY",
  "TEMPLATE_ADMIN_USERNAME",
  "TEMPLATE_ADMIN_PASSWORD",
  "ALLOW_UNAUTHENTICATED_TEMPLATE_API"
];

const originalEnv = {};

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

function setAuthEnv(env = {}) {
  Object.assign(process.env, env);
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

describe("TemplateV1 auth", () => {
  it("fails closed when auth is not configured", async () => {
    expect(() => assertTemplateAuthConfigured()).toThrow("TemplateV1 auth is not configured");
  });

  it("allows explicit unauthenticated local development", async () => {
    setAuthEnv({
      ALLOW_UNAUTHENTICATED_TEMPLATE_API: "true"
    });
    const next = vi.fn();
    assertTemplateAuthConfigured();
    authMiddleware({ method: "POST", headers: {} }, createRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts a matching bearer token", async () => {
    setAuthEnv({ TEMPLATE_API_KEY: "test-token" });
    const next = vi.fn();
    authMiddleware({ method: "POST", headers: { authorization: "Bearer test-token" } }, createRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts matching basic credentials", async () => {
    setAuthEnv({
      TEMPLATE_ADMIN_USERNAME: "admin",
      TEMPLATE_ADMIN_PASSWORD: "secret"
    });
    const token = Buffer.from("admin:secret").toString("base64");
    const next = vi.fn();
    authMiddleware({ method: "GET", headers: { authorization: `Basic ${token}` } }, createRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects invalid credentials", async () => {
    setAuthEnv({ TEMPLATE_API_KEY: "test-token" });
    const res = createRes();
    const next = vi.fn();
    authMiddleware({ method: "POST", headers: { authorization: "Bearer wrong" } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
  });
});
