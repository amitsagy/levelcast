// Renders the two social share images (1200x630) from HTML with the site's
// own fonts, the hero poster frame and the mark, using the local Chrome.
//   node scripts/og.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const f = (p) => `file://${resolve(root, p)}`;
const mark = readFileSync(resolve(root, "src/_includes/partials/mark.njk"), "utf8")
  .replace("{{ cls or 'mark' }}", "mark");

const variants = {
  he: { dir: "rtl", lines: ["עוצמה אחידה,", "בלי לגעת בווליום"], sub: "אפליקציית פודקאסטים לאייפון · בקרוב באפ סטור" },
  en: { dir: "ltr", lines: ["An even volume,", "hands off the knob"], sub: "A podcast app for iPhone.<br>Coming soon to the App Store." },
};

const page = (v) => `<!doctype html><html dir="${v.dir}"><head><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:900;src:url(${f("src/assets/fonts/frank-ruhl-libre-hebrew-900-normal.woff2")});unicode-range:U+0590-05FF}
@font-face{font-family:F;font-weight:900;src:url(${f("src/assets/fonts/frank-ruhl-libre-latin-900-normal.woff2")});unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:H;font-weight:100 900;src:url(${f("src/assets/fonts/heebo-hebrew-wght-normal.woff2")});unicode-range:U+0590-05FF}
@font-face{font-family:H;font-weight:100 900;src:url(${f("src/assets/fonts/heebo-latin-wght-normal.woff2")});unicode-range:U+0000-00FF,U+2000-206F}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0b0d12;color:#f4f4f6;font-family:H,sans-serif;position:relative}
.bg{position:absolute;inset:0;background:url(${f("src/assets/img/hero-poster.jpg")}) 35% 50%/cover}
.veil{position:absolute;inset:0;background:linear-gradient(to left,rgba(11,13,18,.94) 0%,rgba(11,13,18,.78) 45%,rgba(11,13,18,.08) 82%),linear-gradient(to top,rgba(11,13,18,.7),transparent 40%)}
.box{position:absolute;right:70px;top:0;bottom:0;width:${v.dir === "rtl" ? 640 : 560}px;display:flex;flex-direction:column;justify-content:center;text-align:${v.dir === "rtl" ? "right" : "left"}}
.brand{display:flex;align-items:center;gap:16px;margin-bottom:34px;${v.dir === "rtl" ? "" : ""}}
.brand svg{width:64px;height:64px;color:#fff}
.brand b{font:700 34px/1 H}
h1{font:900 ${v.dir === "rtl" ? 76 : 58}px/1.04 F;letter-spacing:-.01em}
h1 span{display:block;white-space:nowrap}
h1 span+span{background:linear-gradient(${v.dir === "rtl" ? "270deg" : "90deg"},#fff,#f3c9a0 60%,#eb9429);-webkit-background-clip:text;color:transparent}
p{margin-top:28px;font:500 26px/1.3 H;color:#c9cad2}
.bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#33519e,#d9333d 55%,#eb9429)}
</style></head><body><div class="bg"></div><div class="veil"></div>
<div class="box"><div class="brand">${mark}<b>LevelCast</b></div>
<h1><span>${v.lines[0]}</span><span>${v.lines[1]}</span></h1><p>${v.sub}</p></div><div class="bar"></div></body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const [lang, v] of Object.entries(variants)) {
  // A file:// page (not setContent) so the fonts and poster can load.
  const tmp = resolve(root, `.og-${lang}.html`);
  writeFileSync(tmp, page(v));
  await p.goto(`file://${tmp}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: resolve(root, `src/assets/img/og-${lang}.jpg`), type: "jpeg", quality: 86 });
  rmSync(tmp);
  console.log("og", lang);
}
await browser.close();
