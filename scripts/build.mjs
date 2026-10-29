// Step 2 — build: group headlines from different outlets into stories, then measure how news moves between newsrooms.
// One function, analyze(), runs on any time window: the current 7 days for the site, and every completed week for the archive.
// Every share comes with a 95% interval and its sample size; numbers with too little data are flagged, not hidden.
// Writes site/data/stories.json, s/<id>.json, patterns.json, compare.json, weeks/<week>.json, csv/*.csv
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { OUTLETS, byId } from "./outlets.mjs";
import { analyze as run, about } from "./engine.mjs";

const DATA = new URL("../site/data/", import.meta.url);
const raw = JSON.parse(await readFile(new URL("items.json", DATA), "utf8")), updated = raw.updated;
const ALL = raw.items.filter(i => byId[i.outlet]).sort((a, b) => a.t - b.t);
const TRACK_START = raw.trackStart ?? Math.min(...ALL.map(i => i.seen));      // when hourly collection began
const H = 3600e3, D = 24 * H;
const analyze = (start, end, opts = {}) => run(ALL, TRACK_START, start, end, { updated, ...opts });

// ── current window: the last 7 days ─────────────────────────────────────────────────────────────────────
const latest = Math.max(...ALL.map(i => i.t));
const cur = analyze(latest - 7 * D, latest + 1);
await rm(new URL("s/", DATA), { recursive: true, force: true });
await mkdir(new URL("s/", DATA), { recursive: true });
const TOP = cur.stories.slice(0, 400);                  // every story gets a page (the audit samples from all of them)
for (const s of TOP) await writeFile(new URL(`s/${s.id}.json`, DATA), JSON.stringify(s));
await writeFile(new URL("stories.json", DATA), JSON.stringify({ updated, stories: TOP.map(({ coverage, ...s }) => ({ ...s, trail: coverage.map(c => [c.outlet, c.lag]) })) }));
await writeFile(new URL("patterns.json", DATA), JSON.stringify(cur.patterns));
await writeFile(new URL("compare.json", DATA), JSON.stringify(cur.compare));
await writeFile(new URL("outlets.json", DATA), JSON.stringify(OUTLETS.map(({ feeds, ...o }) => o)));

// ── open data (no headline text — links, times and measurements only) ─────────────────────────────────────
const csv = rows => rows.map(r => r.map(v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\n") + "\n";
const iso = t => new Date(t).toISOString();
await mkdir(new URL("csv/", DATA), { recursive: true });
await writeFile(new URL("csv/stories.csv", DATA), csv([["story_id", "first_report_utc", "first_outlet", "outlets", "newsroom_countries", "about_countries", "span_minutes", "crossed_border", "fair_first"],
  ...cur.stories.map(s => [s.id, iso(s.first), s.origin.outlet, s.outlets, s.countries.join("|"), s.subject.join("|"), Math.round(s.span / 60e3), s.stages.some(x => x.key === "international") ? 1 : 0, s.fair ? 1 : 0])]));
await writeFile(new URL("csv/coverage.csv", DATA), csv([["story_id", "outlet", "outlet_country", "published_utc", "minutes_after_first", "tone", "frames", "link"],
  ...cur.stories.flatMap(s => s.coverage.map(c => [s.id, c.outlet, byId[c.outlet].country, iso(c.t), c.lag, c.tone, c.frames.join("|"), c.link]))]));
await writeFile(new URL("csv/headline-countries.csv", DATA), csv([["outlet", "outlet_country", "section", "published_utc", "countries_named", "link"],
  ...ALL.filter(i => i.t >= latest - 7 * D).map(i => [i.outlet, byId[i.outlet].country, i.sec || "", iso(i.t), about(i).join("|"), i.link])]));

// ── weekly archive: every completed ISO week (Mon–Sun, UTC) we hold data for ─────────────────────────────
const monday = t => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };
const weekId = t => { const d = new Date(t + 3 * D), y = d.getUTCFullYear(), j1 = Date.UTC(y, 0, 4), w = 1 + Math.round(((t - monday(j1)) / D) / 7); return `${y}-W${String(w).padStart(2, "0")}`; };
await mkdir(new URL("weeks/", DATA), { recursive: true });
const have = new Set((await readdir(new URL("weeks/", DATA)).catch(() => [])).filter(f => /^\d{4}-W\d{2}\.json$/.test(f)).map(f => f.slice(0, 8)));
const earliest = Math.min(...ALL.map(i => i.t));
for (let w = monday(earliest + 3 * D) + 7 * D; w + 7 * D <= latest; w += 7 * D) {
  const id = weekId(w); if (have.has(id)) continue;                              // archived weeks are never recomputed
  const r = analyze(w, w + 7 * D, { quiet: true });
  await writeFile(new URL(`weeks/${id}.json`, DATA), JSON.stringify({ week: id, from: w, to: w + 7 * D, partial: w < TRACK_START,
    patterns: { ...r.patterns, outlets: r.patterns.outlets }, compare: { ...r.compare, outlets: undefined, countries: undefined },
    top: r.stories.slice(0, 10).map(s => ({ id: s.id, headline: s.headline, outlets: s.outlets, countries: s.countries, first: s.first, origin: s.origin.outlet })) }));
  have.add(id); console.log("archived", id, w < TRACK_START ? "(partial: began before tracking)" : "");
}
await writeFile(new URL("weeks/index.json", DATA), JSON.stringify([...have].sort()));

console.log(`${cur.stories.length} stories (≥3 outlets, began in window), ${cur.patterns.fairStories} with a fair first report; ${cur.compare.units} independent units`);
for (const s of cur.stories.slice(0, 10)) console.log(`${String(s.score).padStart(6)}  ${s.outlets}o ${s.countries.length}c  first:${s.origin.outlet.padEnd(10)} ${s.headline.slice(0, 90)}`);
