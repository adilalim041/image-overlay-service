import 'dotenv/config';
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.2
    });
}
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import templatesRouter from "./routes/templates.js";
import renderRouter from "./routes/render.js";
import { listFonts } from "./engine/fonts.js";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = process.env.CLIENT_DIST_PATH || path.resolve(__dirname, "../client/dist");

// CORS — restrict to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors(allowedOrigins.length > 0 ? {
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  }
} : undefined));

app.use(express.json({ limit: "10mb" }));
app.use("/api/render", rateLimit({ windowMs: 60_000, max: 60, message: { error: "Too many requests" } }));
app.use("/api/templates", rateLimit({ windowMs: 60_000, max: 120, message: { error: "Too many requests" } }));

app.use("/fonts", express.static(path.join(__dirname, "fonts")));

app.get("/api/fonts", (req, res) => {
  res.json({ success: true, data: listFonts() });
});

app.use("/api/templates", templatesRouter);
app.use("/api/render", renderRouter);
app.post("/api/render-batch", (req, res, next) => {
  req.url = "/batch";
  return renderRouter(req, res, next);
});
app.post("/api/render-batch/zip", (req, res, next) => {
  req.url = "/batch/zip";
  return renderRouter(req, res, next);
});
app.post("/api/render-batch-zip", (req, res, next) => {
  req.url = "/batch/zip";
  return renderRouter(req, res, next);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "AdilFlow", version: "2.0.0" });
});

app.use(express.static(clientDistPath));
app.get("*", (req, res) => {
  const indexPath = path.join(clientDistPath, "index.html");
  res.sendFile(indexPath);
});

if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

app.listen(PORT, () => {
  console.log(`✅ AdilFlow server running on http://localhost:${PORT}`);
  console.log(`   Templates API: http://localhost:${PORT}/api/templates`);
  console.log(`   Render API:    http://localhost:${PORT}/api/render/:templateId`);
  console.log(`   Fonts:         http://localhost:${PORT}/api/fonts`);
});
