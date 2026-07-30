const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

async function main() {
  const source = path.resolve(__dirname, "shunt-demo-pitch-3min.html");
  const outputDir = path.resolve(__dirname, "rendered-pitch");
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 6480 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(source).href, { waitUntil: "load" });

  const audit = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('[data-document-role="page"]')];
    return {
      count: pages.length,
      labels: pages.map((node) => node.getAttribute("data-label") || ""),
      notes: pages.map((node) => node.getAttribute("data-speaker-notes") || ""),
      nestedPages: pages.filter((node) => node.querySelector('[data-document-role="page"]')).length,
      dimensions: pages.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        overflowX: node.scrollWidth > node.clientWidth,
        overflowY: node.scrollHeight > node.clientHeight,
      })),
    };
  });

  if (audit.count !== 6) throw new Error(`Expected 6 pages, found ${audit.count}`);
  if (audit.labels.some((label) => !label.trim())) throw new Error("Every page must have a non-empty label");
  if (audit.notes.some((note) => !note.trim())) throw new Error("Every page must have speaker notes");
  if (audit.nestedPages !== 0) throw new Error("Page elements may not be nested");
  for (const [index, size] of audit.dimensions.entries()) {
    if (size.width !== 1920 || size.height !== 1080) {
      throw new Error(`Slide ${index + 1} is ${size.width}×${size.height}, expected 1920×1080`);
    }
    if (size.overflowX || size.overflowY) {
      throw new Error(`Slide ${index + 1} overflows its fixed canvas`);
    }
  }

  for (let index = 0; index < audit.count; index += 1) {
    await page.screenshot({
      path: path.join(outputDir, `slide-${String(index + 1).padStart(2, "0")}.png`),
      clip: { x: 0, y: index * 1080, width: 1920, height: 1080 },
    });
  }

  await browser.close();
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
