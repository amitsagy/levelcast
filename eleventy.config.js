// LevelCast site build.
// Hebrew lives at the root, English under /en/. Every page carries a `key`
// in its front matter; pages that share a key are translations of each other,
// which is how the language switch and the hreflang links are generated.

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/video": "assets/video" });
  eleventyConfig.addPassthroughCopy({ "src/assets/audio": "assets/audio" });
  eleventyConfig.addPassthroughCopy({ "src/assets/social": "assets/social" });
  eleventyConfig.addPassthroughCopy({ ".build": "assets/build" });
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // All pages, grouped by key, so a template can find its other-language twin.
  eleventyConfig.addCollection("byKey", (api) => {
    const map = {};
    for (const item of api.getAll()) {
      const { key, lang } = item.data;
      if (!key || !lang) continue;
      (map[key] ||= {})[lang] = item.url;
    }
    return map;
  });

  for (const lang of ["he", "en"]) {
    eleventyConfig.addCollection(`posts_${lang}`, (api) =>
      api
        .getFilteredByGlob(`src/${lang}/blog/*.md`)
        .sort((a, b) => b.date - a.date || (a.data.order || 0) - (b.data.order || 0)),
    );
  }

  // Pages that go into the sitemap: indexable ones only.
  eleventyConfig.addCollection("sitemap", (api) =>
    api
      .getAll()
      .filter((p) => p.data.lang && !p.data.noindex && p.url && !p.url.endsWith("404.html"))
      .sort((a, b) => a.url.localeCompare(b.url)),
  );

  eleventyConfig.addFilter("absolute", (path, base) => new URL(path, base).href);

  eleventyConfig.addFilter("dateHe", (d) =>
    new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d),
  );
  eleventyConfig.addFilter("dateEn", (d) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d),
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // Rough reading time. Hebrew words are shorter on average, so the same pace
  // works for both languages within a minute.
  eleventyConfig.addFilter("readMinutes", (html) => {
    const words = String(html).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });

  // Escaped so a "</script>" inside any value cannot close the tag it sits in.
  // The parsed value is unchanged.
  eleventyConfig.addFilter("json", (v) =>
    JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"));
  eleventyConfig.addFilter("head", (arr, n) => (arr || []).slice(0, n));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"],
  };
}
