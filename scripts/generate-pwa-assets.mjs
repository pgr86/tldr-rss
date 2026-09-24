// Renders the PWA icons and iOS startup images from the same splash markup the app uses,
// so the native launch screen hands over seamlessly to the in-app splash.
//
// Requires Playwright with Chromium (not a project dependency):
//   NODE_PATH=$(npm root -g) node scripts/generate-pwa-assets.mjs
import { mkdir } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

import {
  BACKGROUND_COLOR,
  SPLASH_CSS,
  SPLASH_MARKUP,
  STARTUP_IMAGES,
  startupImagePath,
} from "../src/pwa.ts";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const splashPage = `<!DOCTYPE html><html><head><style>
  html, body { margin: 0; height: 100%; background: ${BACKGROUND_COLOR}; }
  ${SPLASH_CSS}
  #app-splash { display: flex; }
</style></head><body>${SPLASH_MARKUP}</body></html>`;

// size: canvas size, orbScale: orb size relative to the 96px splash orb, rounded: corner radius share
const iconPage = (size, orbScale, rounded) => `<!DOCTYPE html><html><head><style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; }
  ${SPLASH_CSS}
  #app-splash {
    display: flex;
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    border-radius: ${Math.round(size * rounded)}px;
    background: radial-gradient(circle at 50% 45%, #13233d 0%, ${BACKGROUND_COLOR} 70%);
    overflow: hidden;
  }
  .splash-orb { transform: scale(${orbScale}); }
</style></head><body>${SPLASH_MARKUP}</body></html>`;

const ICONS = [
  { file: "icons/icon-192.png", size: 192, orbScale: 1.15, rounded: 0.22 },
  { file: "icons/icon-512.png", size: 512, orbScale: 3.05, rounded: 0.22 },
  // Maskable icons are cropped by the launcher: full bleed, orb inside the safe zone
  { file: "icons/maskable-512.png", size: 512, orbScale: 2.5, rounded: 0 },
  // iOS applies its own rounded mask
  { file: "icons/apple-touch-icon.png", size: 180, orbScale: 1.1, rounded: 0 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

await mkdir(path.join(publicDir, "icons"), { recursive: true });
await mkdir(path.join(publicDir, "splash"), { recursive: true });

for (const icon of ICONS) {
  const page = await browser.newPage({
    viewport: { width: icon.size, height: icon.size },
  });
  await page.setContent(iconPage(icon.size, icon.orbScale, icon.rounded));
  await page.screenshot({
    path: path.join(publicDir, icon.file),
    omitBackground: icon.rounded > 0,
  });
  await page.close();
  console.log(`Rendered ${icon.file}`);
}

for (const image of STARTUP_IMAGES) {
  const page = await browser.newPage({
    viewport: { width: image.width, height: image.height },
    deviceScaleFactor: image.ratio,
  });
  await page.setContent(splashPage);
  const file = startupImagePath(image).replace(/^\//, "");
  await page.screenshot({ path: path.join(publicDir, file) });
  await page.close();
  console.log(`Rendered ${file}`);
}

await browser.close();
