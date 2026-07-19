// Copies the rendered hero MP4 into the Vite app's public folder so the web
// build can serve it at /videos/shunt-hero.mp4. Cross-platform (Node fs).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "out", "shunt-hero.mp4");
const destDir = resolve(here, "..", "..", "web", "public", "videos");
const dest = resolve(destDir, "shunt-hero.mp4");

if (!existsSync(src)) {
  console.error(`✗ Rendered video not found at ${src}\n  Run "npm run render:hero" first.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`✓ Copied hero video → ${dest}`);
