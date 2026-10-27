// Step 1 — collect: read every outlet's public RSS feed once, keep headline + short summary + link + time.
// Merges into site/data/items.json (rolling 7-day window) so a story's origin survives across hourly runs.
// No full articles are copied; every item links back to the outlet.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { OUTLETS } from "./outlets.mjs";

const DATA = new URL("../site/data/", import.meta.url);
const KEEP_DAYS = 7, SUMMARY = 220;
const UA = "NewsTrail/1.0 (open-source news-spread tracker; reads public RSS feeds hourly)";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);
const text = s => decode(decode(s || "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…";
const tag = (xml, ...names) => { for (const n of names) { const m = xml.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i")); if (m && m[1].trim()) return m[1]; } return ""; };
const linkOf = xml => {
  const t = text(tag(xml, "link")); if (/^https?:/.test(t)) return t;                      // RSS: <link>url</link>
  const a = xml.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || xml.match(/<link[^>]*href="([^"]+)"/i);   // Atom
  return a ? decode(a[1]) : text(tag(xml, "guid"));
};

export function parse(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => ({
    title: text(tag(b, "title")),
    link: linkOf(b).trim(),
    summary: clip(text(tag(b, "description", "summary", "content:encoded", "content")), SUMMARY),
    date: text(tag(b, "pubDate", "dc:date", "published", "updated")),
  })).filter(i => i.title && /^https?:\/\//.test(i.link));
}

async function grab(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}

const now = Date.now();
await mkdir(DATA, { recursive: true });
let old = [];
try { old = JSON.parse(await readFile(new URL("items.json", DATA), "utf8")).items; } catch {}
const items = new Map(old.map(i => [i.id, i]));
const report = [];

// a few feeds at a time — polite, and fast enough
const jobs = OUTLETS.flatMap(o => Object.entries(o.feeds).flatMap(([sec, urls]) => urls.map(url => ({ o, sec, url }))));
for (let k = 0; k < jobs.length; k += 6) {
  await Promise.all(jobs.slice(k, k + 6).map(async ({ o, sec, url }) => {
    try {
      // keep only headlines that link to the outlet's own site (some old feeds fill up with ads and syndicated junk)
      const brand = new URL(o.page).hostname.split(".").filter(p => !["www", "news", "edition"].includes(p))[0];
      const got = parse(await grab(url)).filter(g => { try { return new URL(g.link).hostname.split(".").includes(brand); } catch { return false; } });
      let fresh = 0;
      for (const g of got) {
        const id = createHash("sha1").update(g.link.replace(/[?#].*$/, "")).digest("hex").slice(0, 12);
        const pub = Date.parse(g.date);
        const t = Number.isFinite(pub) && pub <= now + 5 * 60e3 ? pub : now;      // trust the feed's time unless missing or in the future
        if (items.has(id)) { const it = items.get(id); it.title = g.title; it.summary = g.summary || it.summary; it.sec ??= sec; continue; }
        items.set(id, { id, outlet: o.id, sec, title: g.title, summary: g.summary, link: g.link, t, seen: now });
        fresh++;
      }
      report.push(`${(o.name + " · " + sec).padEnd(32)} ${String(got.length).padStart(4)} items, ${fresh} new`);
    } catch (e) { report.push(`${(o.name + " · " + sec).padEnd(32)} skipped (${e.message})`); }
  }));
}

const cutoff = now - KEEP_DAYS * 864e5;
const known = new Set(OUTLETS.map(o => o.id));
const out = [...items.values()].filter(i => i.t >= cutoff && known.has(i.outlet)).sort((a, b) => a.t - b.t);
await writeFile(new URL("items.json", DATA), JSON.stringify({ updated: now, items: out }));
console.log(report.sort().join("\n"));
console.log(`\n${out.length} items in the ${KEEP_DAYS}-day window`);
