import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, "../fonts");

const fontCache = new Map();

const FONT_MAP = {
  bold: "bold.ttf",
  regular: "regular.ttf",
  Montserrat: "Montserrat-Regular.ttf",
  "Montserrat-Bold": "Montserrat-Bold.ttf",
  "Montserrat-SemiBold": "Montserrat-SemiBold.ttf",
  "Montserrat-Medium": "Montserrat-Medium.ttf",
  "Montserrat-Light": "Montserrat-Light.ttf",
  "Space Grotesk": "SpaceGrotesk-Regular.ttf",
  "Space Grotesk-Bold": "SpaceGrotesk-Bold.ttf",
  "Open Sans": "OpenSans-Regular.ttf",
  "Open Sans-Bold": "OpenSans-Bold.ttf",
  "Bebas Neue": "BebasNeue-Regular.ttf",
  "Bebas Neue Cyrillic": "bebasneuecyrillic.ttf",
  Oswald: "Oswald-Variable.ttf",
  Roboto: "Roboto-Variable.ttf",
  "Plus Jakarta Sans": "PlusJakartaSans-Regular.ttf",
  "Plus Jakarta Sans-SemiBold": "PlusJakartaSans-SemiBold.ttf",
  "Plus Jakarta Sans-Bold": "PlusJakartaSans-Bold.ttf",
  "sans-serif": "regular.ttf",
  serif: "regular.ttf",
  monospace: "regular.ttf"
};

function loadFromPath(key, fullPath) {
  if (!existsSync(fullPath)) return null;
  try {
    const font = opentype.loadSync(fullPath);
    fontCache.set(key, font);
    return font;
  } catch (e) {
    console.error(`Failed to load font ${key}: ${e.message}`);
    return null;
  }
}

export function getFont(fontFamily) {
  const key = fontFamily || "regular";
  if (fontCache.has(key)) return fontCache.get(key);

  const fileName = FONT_MAP[key];
  if (fileName) {
    const font = loadFromPath(key, path.join(fontsDir, fileName));
    if (font) return font;
  }

  const directFont = loadFromPath(key, path.join(fontsDir, `${key}.ttf`));
  if (directFont) return directFont;

  if (!fontCache.has("bold")) loadFromPath("bold", path.join(fontsDir, "bold.ttf"));
  if (!fontCache.has("regular")) loadFromPath("regular", path.join(fontsDir, "regular.ttf"));

  return fontCache.get("bold") || fontCache.get("regular") || null;
}

export function listFonts() {
  return Object.keys(FONT_MAP).filter((k) => existsSync(path.join(fontsDir, FONT_MAP[k])));
}
