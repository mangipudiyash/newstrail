// Step 1b — attention: what people actually looked up, from two free public sources. Coverage tells us what newsrooms chose;
// this tells us what readers went looking for. Neither is a readership count, so both are reported as signals, not audiences.
//   • Google Trends "trending now" RSS for every newsroom country: searches that suddenly took off, with Google's own rough
//     traffic band and the news articles Google linked to them. The feed only shows the newest ~10, so every run keeps what it sees.
//   • Wikipedia's most-viewed English articles per day (Wikimedia pageviews API): real view counts, worldwide.
// Merges into cache/attention-raw.json (kept between runs by the Actions cache, never published as is).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { OUTLETS } from "./outlets.mjs";
import { GEO } from "./attention-match.mjs";

const CACHE = new URL("../cache/", import.meta.url), FILE = new URL("attention-raw.json", CACHE);
const UA = "NewsTrail/1.0 (open-source news-spread tracker; https://github.com/mangipudiyash/newstrail)";
const KEEP_DAYS = 28, WIKI_TOP = 400, D = 864e5;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const text = s => (s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, n) => text((xml.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`)) || [])[1]);
// "20,000+" → 20000, "2K+" → 2000
const traffic = s => { const m = String(s).replace(/,/g, "").match(/([\d.]+)\s*([KM]?)/i); return m ? Math.round(+m[1] * ({ K: 1e3, M: 1e6 }[m[2].toUpperCase()] || 1)) : null; };
const get = async (url, type) => { const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error("HTTP " + r.status); return type === "json" ? r.json() : r.text(); };

const now = Date.now();
await mkdir(CACHE, { recursive: true });
let A = { trends: [], wiki: {} };
try { A = JSON.parse(await readFile(FILE, "utf8")); } catch {}
A.trendStart ??= now;                                    // searches are only known from here on (the feed has no history)
const health = { trends: {}, wiki: [] };

// ── Google Trends, one feed per newsroom country ─────────────────────────────────────────────────────────
const byId = new Map(A.trends.map(t => [t.id, t]));
const geos = [...new Set(OUTLETS.map(o => GEO[o.country]).filter(Boolean))];
for (let k = 0; k < geos.length; k += 4) {
  await Promise.all(geos.slice(k, k + 4).map(async geo => {
    try {
      const xml = await get(`https://trends.google.com/trending/rss?geo=${geo}`);
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      let fresh = 0;
      for (const b of items) {
        const q = tag(b, "title"), t = Date.parse(tag(b, "pubDate"));
        if (!q || !Number.isFinite(t)) continue;
        const news = (b.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/g) || []).slice(0, 3)
          .map(n => ({ u: tag(n, "ht:news_item_url"), title: tag(n, "ht:news_item_title").slice(0, 200), src: tag(n, "ht:news_item_source") })).filter(n => n.u);
        const id = createHash("sha1").update(`${geo}|${q.toLowerCase()}|${t}`).digest("hex").slice(0, 12), v = traffic(tag(b, "ht:approx_traffic"));
        const old = byId.get(id);
        if (old) { old.traffic = Math.max(old.traffic || 0, v || 0) || null; old.last = now; if (news.length) old.news = news; continue; }  // the band can grow while it trends
        byId.set(id, { id, geo, q, t, traffic: v, seen: now, last: now, news }); fresh++;
      }
      health.trends[geo] = { ok: true, items: items.length, fresh };
    } catch (e) { health.trends[geo] = { ok: false, error: e.message }; }
  }));
}
A.trends = [...byId.values()].filter(t => t.t >= now - KEEP_DAYS * D).sort((a, b) => a.t - b.t);

// ── Wikipedia: yesterday's most-read English articles, plus any missing day in the window (published a few hours after midnight UTC)
const day = t => new Date(t).toISOString().slice(0, 10);
const SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Template:|Category:|Talk:|User:|Draft:|-$)/;
for (let i = 1; i <= KEEP_DAYS; i++) {
  const d = day(now - i * D); if (A.wiki[d]) continue;
  try {
    const j = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.replace(/-/g, "/")}`, "json");
    A.wiki[d] = j.items[0].articles.filter(a => !SKIP.test(a.article)).slice(0, WIKI_TOP).map(a => [a.article, a.views]);
    health.wiki.push(d);
  } catch (e) { if (i <= 2) health.wiki.push(`${d}: ${e.message}`); }        // the newest day may simply not be out yet
}
for (const d of Object.keys(A.wiki)) if (d < day(now - KEEP_DAYS * D)) delete A.wiki[d];

await writeFile(FILE, JSON.stringify({ updated: now, ...A, health }));
const bad = Object.entries(health.trends).filter(([, h]) => !h.ok);
console.log(`trends: ${A.trends.length} kept, ${Object.values(health.trends).reduce((a, h) => a + (h.fresh || 0), 0)} new from ${geos.length - bad.length}/${geos.length} countries${bad.length ? " (failed: " + bad.map(([g, h]) => `${g} ${h.error}`).join(", ") + ")" : ""}`);
console.log(`wikipedia: ${Object.keys(A.wiki).length} days held${health.wiki.length ? ", fetched " + health.wiki.join(", ") : ""}`);
