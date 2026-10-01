// Bundles the one stylesheet and the one script before Eleventy runs, and
// writes their content hashes to src/_data/assetHash.json so templates can
// cache-bust with ?v=<hash> while the files themselves are cached for a year.
import { build } from "esbuild";
import { bundle } from "lightningcss";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const out = ".build";
mkdirSync(out, { recursive: true });

const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

// CSS: lightningcss resolves @import, nests, minifies, and adds prefixes for
// the browsers our audience actually uses (Safari on iPhone first).
const targets = {
  safari: 15 << 16,
  ios_saf: 15 << 16,
  chrome: 110 << 16,
  firefox: 115 << 16,
};
const css = bundle({ filename: "src/assets/css/main.css", minify: true, targets });
writeFileSync(`${out}/main.css`, css.code);

await build({
  entryPoints: ["src/assets/js/main.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["safari15", "chrome110", "firefox115"],
  outfile: `${out}/main.js`,
  legalComments: "none",
});

const result = {
  css: hash(readFileSync(`${out}/main.css`)),
  js: hash(readFileSync(`${out}/main.js`)),
};
writeFileSync("src/_data/assetHash.json", JSON.stringify(result, null, 2) + "\n");
console.log("assets", result, `css ${css.code.length}B`);
