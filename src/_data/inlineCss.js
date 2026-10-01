// The whole stylesheet is small (about 8 KB gzipped), so it is inlined into
// every page: no render-blocking request before first paint on a slow phone.
import { readFileSync } from "node:fs";
export default () => readFileSync(new URL("../../.build/main.css", import.meta.url), "utf8");
