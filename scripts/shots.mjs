// Visual QA: screenshots of a page at several scroll positions, desktop and
// phone, into qa/. Not part of the build.
//   node scripts/shots.mjs [baseUrl] [path] [prefix]
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://localhost:4173";
const path = process.argv[3] || "/";
const prefix = process.argv[4] || "home";
mkdirSync("qa", { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const runs = [
  { name: "desk", opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: "phone", opts: { ...devices["iPhone 14 Pro"], defaultBrowserType: undefined } },
];
for (const r of runs) {
  const ctx = await browser.newContext(r.opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = r.opts.viewport.height;
  const stops = process.argv[5] ? process.argv[5].split(",").map(Number) : [0, 0.5, 1, 1.5, 2, 2.6, 3.3, 4];
  for (const s of stops) {
    const y = Math.min(h - vh, Math.round(s * vh));
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `qa/${prefix}-${r.name}-${String(s).replace(".", "_")}.jpg`, type: "jpeg", quality: 70 });
  }
  console.log(r.name, "height", h, "errors", errors);
  await ctx.close();
}
await browser.close();
