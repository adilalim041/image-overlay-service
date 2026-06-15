#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { TEMPLATE_AGENT_CONTRACT, validateTemplate } from "../agent/templateContract.js";
import { renderTemplate } from "../engine/renderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const templatesDir = path.join(serverRoot, "templates");

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  print({
    usage: [
      "node tools/template-agent.mjs schema",
      "node tools/template-agent.mjs validate <template.json>",
      "node tools/template-agent.mjs inspect <template.json>",
      "node tools/template-agent.mjs render <template.json> <data.json> <output.png> [--strict]",
      "node tools/template-agent.mjs save-local <template.json>"
    ]
  });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertValidTemplate(template) {
  const validation = validateTemplate(template);
  if (!validation.valid) {
    print({ success: false, error: "Template validation failed", data: validation });
    process.exit(1);
  }
  return validation;
}

function safeTemplateFileName(templateId) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(templateId || "")) {
    throw new Error("Template id must be 1-80 chars: letters, numbers, underscore, dash.");
  }
  return `${templateId}.json`;
}

const [, , command, filePath, dataPath, outputPath, ...flags] = process.argv;

if (command === "schema") {
  print({ success: true, data: TEMPLATE_AGENT_CONTRACT });
  process.exit(0);
}

if (command === "validate") {
  if (!filePath) {
    usage();
    process.exit(2);
  }

  try {
    const template = readJson(filePath);
    const validation = validateTemplate(template);
    print({ success: validation.valid, data: validation });
    process.exit(validation.valid ? 0 : 1);
  } catch (error) {
    print({ success: false, error: error.message });
    process.exit(1);
  }
}

if (command === "inspect") {
  if (!filePath) {
    usage();
    process.exit(2);
  }

  try {
    const template = readJson(filePath);
    const validation = validateTemplate(template);
    print({ success: validation.valid, data: validation.meta, issues: validation.issues });
    process.exit(validation.valid ? 0 : 1);
  } catch (error) {
    print({ success: false, error: error.message });
    process.exit(1);
  }
}

if (command === "render") {
  if (!filePath || !dataPath || !outputPath) {
    usage();
    process.exit(2);
  }

  try {
    const template = readJson(filePath);
    assertValidTemplate(template);
    const data = readJson(dataPath);
    const strict = flags.includes("--strict");
    const png = await renderTemplate(template, data, { strict });
    const absoluteOutputPath = path.resolve(outputPath);
    mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, png);
    print({ success: true, data: { outputPath: absoluteOutputPath, bytes: png.length } });
    process.exit(0);
  } catch (error) {
    print({ success: false, error: error.message, details: error.details || undefined });
    process.exit(1);
  }
}

if (command === "save-local") {
  if (!filePath) {
    usage();
    process.exit(2);
  }

  try {
    const template = readJson(filePath);
    assertValidTemplate(template);
    const now = new Date().toISOString();
    const normalized = {
      ...template,
      createdAt: template.createdAt || now,
      updatedAt: now
    };
    const fileName = safeTemplateFileName(normalized.id);
    const targetPath = path.join(templatesDir, fileName);
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(targetPath, JSON.stringify(normalized, null, 2));
    print({ success: true, data: { templateId: normalized.id, path: targetPath } });
    process.exit(0);
  } catch (error) {
    print({ success: false, error: error.message });
    process.exit(1);
  }
}

usage();
process.exit(2);
