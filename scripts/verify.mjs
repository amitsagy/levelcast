// End-to-end checks against a running site (local or live).
//   node scripts/verify.mjs [baseUrl]
// Exits non-zero on any failure.
import { chromium, devices } from "playwright";

const base = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const browser = await chromium.launch({ channel: "chrome" });

/* 1. Every page: status, metadata, direction, console errors; collect links. */
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
ok(pages.length >= 20, `sitemap lists ${pages.length} pages`);
ok(!pages.some((p) => p.includes("reviews")), "reviews page is not in the sitemap");

const links = new Set();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  for (const path of [...pages, "/reviews/", "/en/reviews/"]) {
    const errors = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(base + path, { waitUntil: "load" });
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.content || "",
      canonical: document.querySelector('link[rel="canonical"]')?.href || "",
      og: document.querySelector('meta[property="og:image"]')?.content || "",
      robots: document.querySelector('meta[name="robots"]')?.content || "",
      alts: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].length,
      h1: document.querySelectorAll("h1").length,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      imgsNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
    }));
    meta.links.forEach((l) => links.add(new URL(l, base + path).href));
    const isRev = path.includes("reviews");
    const good = res.status() === 200 && meta.title && meta.desc.length > 50 && meta.og && meta.h1 === 1 && meta.imgsNoAlt === 0
      && (isRev ? meta.robots.includes("noindex") : meta.canonical && meta.alts === 3)
      && ((path.startsWith("/en/") ? "en" : "he") === meta.lang)
      && (meta.lang === "he" ? meta.dir === "rtl" : meta.dir === "ltr")
      && errors.length === 0;
    ok(good, `${path} ${res.status()} ${meta.lang}/${meta.dir} h1=${meta.h1} alts=${meta.alts}${isRev ? " noindex" : ""}${errors.length ? " errors:" + errors.join("|") : ""}`);
  }
  await ctx.close();
}

/* 1b. Phone width: no page may be wider than the screen (a wide decoration
   makes mobile browsers zoom out and push the menu off screen). */
{
  const ctx = await browser.newContext(devices["iPhone 14 Pro"]);
  const page = await ctx.newPage();
  const wide = [];
  for (const path of [...pages, "/reviews/", "/en/reviews/", "/404.html"]) {
    await page.goto(base + path, { waitUntil: "load" });
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (w[0] > 393 || w[1] > 393) wide.push(`${path} ${w[0]}/${w[1]}`);
  }
  ok(wide.length === 0, `phone width: no page overflows 393px${wide.length ? ": " + wide.join(", ") : ""}`);
  await ctx.close();
}

/* 2. Links: every internal link and asset resolves. */
{
  const internal = [...links].filter((l) => l.startsWith(base) && !l.includes("#"));
  const bad = [];
  await Promise.all(internal.map(async (l) => {
    const r = await fetch(l, { redirect: "follow" });
    if (r.status !== 200) bad.push(`${r.status} ${l}`);
  }));
  ok(bad.length === 0, `${internal.length} internal links resolve${bad.length ? ": " + bad.join(", ") : ""}`);
  const external = [...links].filter((l) => l.startsWith("http") && !l.startsWith(base));
  console.log("     external links:", external.join(" "));
}

/* 3. Hero video, parallax and the scroll story, desktop and phone. */
for (const [name, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", devices["iPhone 14 Pro"]]]) {
  for (const path of ["/", "/en/"]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const v = await page.evaluate(() => {
      const el = document.querySelector("[data-hero-video]");
      return { paused: el.paused, t: el.currentTime, w: el.videoWidth, h: el.videoHeight, src: el.currentSrc.split("/").pop(), loop: el.loop, muted: el.muted, poster: !!el.poster, playing: el.classList.contains("is-playing") };
    });
    await page.waitForTimeout(800);
    const t2 = await page.evaluate(() => document.querySelector("[data-hero-video]").currentTime);
    ok(!v.paused && t2 > v.t && v.loop && v.muted && v.poster && v.playing, `${name} ${path} video plays muted+loop (${v.src} ${v.w}x${v.h}, t ${v.t.toFixed(2)} -> ${t2.toFixed(2)})`);

    const read = () => page.evaluate(() => {
      const m = (s) => getComputedStyle(document.querySelector(s)).transform;
      return { media: m(".hero__media"), strip: m(".hero__strip"), content: m(".hero__content"), bar: document.querySelector(".meter .bar[data-i='1']").getAttribute("transform") || getComputedStyle(document.querySelector(".meter .bar[data-i='1']")).transform };
    });
    const a = await read();
    await page.evaluate(() => window.scrollTo(0, innerHeight * 0.5));
    await page.waitForTimeout(500);
    const b = await read();
    const layers = ["media", "strip", "content"].filter((k) => a[k] !== b[k]).length;
    ok(layers === 3, `${name} ${path} parallax: ${layers}/3 layers moved (${a.media} -> ${b.media})`);

    const storyTop = await page.evaluate(() => document.querySelector("[data-story]").offsetTop);
    await page.evaluate((y) => window.scrollTo(0, y), storyTop);
    await page.waitForTimeout(400);
    const s0 = await read();
    await page.evaluate((y) => window.scrollTo(0, y + innerHeight * 2.5), storyTop);
    await page.waitForTimeout(400);
    const s1 = await read();
    ok(s0.bar !== s1.bar, `${name} ${path} story bars change with scroll`);
    await ctx.close();
  }
}

/* 4. Reduced motion: video paused, nothing moves, content visible. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(1000);
  const r0 = await page.evaluate(() => ({ paused: document.querySelector("[data-hero-video]").paused, m: getComputedStyle(document.querySelector(".hero__media")).transform }));
  await page.evaluate(() => window.scrollTo(0, innerHeight * 0.6));
  await page.waitForTimeout(400);
  const r1 = await page.evaluate(() => ({ m: getComputedStyle(document.querySelector(".hero__media")).transform, op: getComputedStyle(document.querySelector(".story__step h2")).opacity }));
  ok(r0.paused && r0.m === r1.m && r1.op === "1", `reduced motion: video paused, layers still (${r1.m}), story text visible`);
  await ctx.close();
}

/* 5. In-page "reduce motion" switch. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.click("[data-motion-toggle]");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  const st = await page.evaluate(() => ({ cls: document.documentElement.classList.contains("reduce-motion"), paused: document.querySelector("[data-hero-video]").paused, stored: localStorage.getItem("lc-motion") }));
  await page.reload({ waitUntil: "load" });
  const after = await page.evaluate(() => document.documentElement.classList.contains("reduce-motion"));
  ok(st.cls && st.paused && st.stored === "reduce" && after, "motion switch: turns motion off, pauses video, persists across reload");
  await ctx.close();
}

/* 6. A/B player switches at the same timestamp. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + "/listen/", { waitUntil: "load" });
  await page.click("[data-ab-play]");
  await page.waitForTimeout(1500);
  await page.click('[data-ab-pick="after"]');
  await page.waitForTimeout(300);
  const ab = await page.evaluate(() => {
    const [b, a] = [document.querySelector('[data-ab-src="before"]'), document.querySelector('[data-ab-src="after"]')];
    return { bm: b.muted, am: a.muted, drift: Math.abs(a.currentTime - b.currentTime), t: a.currentTime, playing: !a.paused };
  });
  ok(ab.playing && ab.bm && !ab.am && ab.drift < 0.15 && ab.t > 1, `A/B player: switched to "after" at ${ab.t.toFixed(2)}s, drift ${ab.drift.toFixed(3)}s`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : "\nall checks passed");
process.exit(fails.length ? 1 : 0);
