// Pulls customer reviews from Apple's public App Store feed into
// src/_data/reviews.json. Never publishes anything by itself: the reviews page
// stays hidden until `published` is set to true with Amit's approval, and the
// page's `noindex` front matter is removed and it is added to the nav.
//   node scripts/fetch-reviews.mjs
// Prints how many new reviews arrived; exit code 0 either way.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../src/_data/reviews.json", import.meta.url);
const site = JSON.parse(readFileSync(new URL("../src/_data/site.json", import.meta.url)));
const data = JSON.parse(readFileSync(FILE));
const known = new Set(data.items.map((r) => r.id));
let added = 0;

for (const country of ["il", "us"]) {
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${site.appStoreId}/sortby=mostrecent/json`;
  let feed;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log(country, "HTTP", res.status); continue; }
    feed = (await res.json()).feed;
  } catch (e) { console.log(country, "fetch failed:", e.message); continue; }
  const entries = [].concat(feed?.entry || []).filter((e) => e["im:rating"]);
  for (const e of entries) {
    const id = e.id?.label;
    if (!id || known.has(id)) continue;
    data.items.push({
      id,
      country,
      rating: Number(e["im:rating"].label),
      title: e.title?.label || "",
      body: e.content?.label || "",
      author: e.author?.name?.label || "",
      date: e.updated?.label || null,
    });
    known.add(id);
    added++;
  }
  console.log(country, entries.length, "reviews in feed");
}

data.items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
data.fetchedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`new: ${added}, total: ${data.items.length}, published: ${data.published}`);
