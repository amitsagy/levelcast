# LevelCast site

Live at **https://levelcast.pages.dev** (Cloudflare Pages, project `levelcast`).
Hebrew at the root, English under `/en/`. Static output, built with Eleventy.

The old address, https://amitsagy.github.io/levelcast/, is served from `docs/` by
GitHub Pages and only redirects here. The app's privacy, terms and support links
still point at the old address, so `docs/` must keep a stub for each of them.

## Build, check, deploy

```sh
npm install
npm run build                      # assets (esbuild + lightningcss) then Eleventy -> _site/
npx serve _site -l 4173            # local preview
python3 scripts/lint-copy.py       # Rotem's compliance linter over every built page
node scripts/verify.mjs http://localhost:4173   # pages, links, video, parallax, reduced motion, A/B player
npx wrangler pages deploy _site --project-name levelcast --branch main
node scripts/verify.mjs https://levelcast.pages.dev
```

Do not pass `--force` to wrangler again: the Pages project already exists.

## Where things live

| What | Where |
|---|---|
| Page shell, header, footer, SEO tags | `src/_includes/layouts/base.njk` |
| JSON-LD | `src/_includes/partials/jsonld.njk` |
| Home page (one template, two languages) | `src/_includes/home.njk` + copy in `src/_data/home.json` |
| UI strings | `src/_data/t.json` |
| Pages | `src/he/*.njk`, `src/en/*.njk` (same `key` = translations of each other) |
| Blog posts | `src/he/blog/*.md`, `src/en/blog/*.md` |
| Styles | `src/assets/css/main.css` |
| Motion (parallax, scroll story, A/B player) | `src/assets/js/main.js` |
| Logo mark | `src/_includes/partials/mark.njk` (redrawn from the app icon) |
| Share images | `scripts/og.mjs` -> `src/assets/img/og-{he,en}.jpg` |
| Hero video | `src/assets/video/hero-{1080,720}.mp4`, poster `src/assets/img/hero-poster*` |

## Adding a blog post (Guy)

1. Write `src/he/blog/<slug>.md` with front matter:
   ```yaml
   key: post-<short-id>        # same key in the English twin
   order: 4                    # tie-breaker when dates are equal
   date: 2026-10-08
   permalink: /blog/<slug>/
   title: "<heading> — הבלוג של LevelCast"
   heading: "<heading>"
   description: "<one or two sentences, 120-170 characters>"
   ```
2. Add the English twin at `src/en/blog/<slug>.md` with `permalink: /en/blog/<slug>/`.
   Without a twin the post still works, but it has no language switch target.
3. Numbers with units go inside `<span dir="ltr">…</span>` so minus signs and dB
   don't flip. Internal links use `{{ collections.byKey.<key>[lang] }}`.
4. `npm run build && python3 scripts/lint-copy.py`, then deploy. Maya submits;
   nothing goes live without Amit's approval.

While the app is not on the store, posts end with "בקרוב באפ סטור" (the post
template adds it) and carry no store link. Once there is a store URL, add it to
`src/_data/site.json` and the template with the `?r=blog-<slug>` token.

## Reviews page (hidden)

`/reviews/` and `/en/reviews/` exist but are `noindex`, out of the nav and out of
the sitemap. `node scripts/fetch-reviews.mjs` pulls Apple's public review feed
(Israel and US) into `src/_data/reviews.json` and prints how many are new. It
returns nothing until the app is live. To reveal the page, with Amit's approval:
set `published: true`, remove `noindex: true` from both pages, and add
`{ "key": "reviews", ... }` to the nav in `src/_data/t.json`.

## Motion rules

Transform and opacity only. Scroll scrubs timelines, it never plays them. Every
animated path checks `prefers-reduced-motion` and the in-page switch
(`html.reduce-motion`, stored in `localStorage` as `lc-motion`). The SVG meter
ships in its final state (the app icon), so without JS or with motion off the
page shows the finished mark.

## Social videos on the blog

`src/_data/social.json` lists Instagram/TikTok posts shown in a "From our socials"
section at the bottom of `/blog/` and `/en/blog/`. Add a post only after Amit
approved it for publishing: copy its 720x1280 `display.mp4` and `poster.jpg` from
`~/levelcast-marketing/marketing/queue/<item>/` into `src/assets/social/` under the
item id, then add `{ id, date, video, poster, he: {title, caption}, en: {title,
caption}, links: {instagram, tiktok} }`. The section is hidden while the list is empty.

## The demo minute

`scripts/demo/make-dialogue.mjs` builds the "before" minute from the fictional
show "שני מיקרופונים" (episode 38, a remote guest about 10 LU under the host).
`scripts/demo/render-levelling.swift` plays it through the app's audio chain
(Strong) and prints the four numbers; they live in `src/_data/site.json` →
`demo`, and must match `.agents/compliance.md` in the marketing repo.
