// Step 2 — build: group headlines from different outlets into stories, then work out for each story
// where it started, how it spread (origin → national → international), how each outlet framed it, and what they agreed on.
// Writes site/data/stories.json (index), site/data/s/<id>.json (one per story), site/data/patterns.json.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { OUTLETS, byId } from "./outlets.mjs";
import { placesFor } from "./places.mjs";

const DATA = new URL("../site/data/", import.meta.url);
const { items, updated } = JSON.parse(await readFile(new URL("items.json", DATA), "utf8"));
const H = 3600e3;

// ── text → weighted terms ───────────────────────────────────────────────────────────────
const STOP = new Set(`a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those
he she they them his her their we our you your i me my not no yes do does did done has have had will would can could should may might must
after before over under into about amid against between during than then there here what which who whom whose why how when where all any
both each few more most other some such only own same so too very just also new says said say amid live news updates update latest today
watch video photos explained report reports amid why how what first big top day week year years one two three per cent percent vs via
make makes made get gets take takes set sets back now still out up down off around across amid least near amid while within without`.split(/\s+/));
const stem = w => w.length > 5 ? w.replace(/(ings|ing|ed|es|s)$/, "") : w.length > 3 ? w.replace(/s$/, "") : w;
const terms = s => (s.toLowerCase().replace(/[’']s\b/g, "").match(/[\p{L}\p{N}][\p{L}\p{N}\-.]*[\p{L}\p{N}]|\p{L}/gu) || [])
  .map(w => w.replace(/\./g, "")).filter(w => w.length > 2 && !STOP.has(w) && !/^\d{1,2}$/.test(w)).map(stem);

const docs = items.map(it => {
  const tf = new Map();
  for (const w of terms(it.title)) tf.set(w, (tf.get(w) || 0) + 2);           // headline words count double
  for (const w of terms(it.summary || "")) tf.set(w, (tf.get(w) || 0) + 1);
  return { it, tf, title: new Set(terms(it.title)) };
});
const df = new Map();
for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
const N = docs.length, idf = w => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
for (const d of docs) {
  d.v = new Map([...d.tf].map(([w, c]) => [w, (1 + Math.log(c)) * idf(w)]));
  const n = Math.hypot(...d.v.values()) || 1; for (const [w, x] of d.v) d.v.set(w, x / n);
}
const cos = (a, b) => { let s = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const [w, v] of x) { const u = y.get(w); if (u) s += v * u; } return s; };

// ── clustering: walk the timeline; an item joins the story it matches best, if it's close enough ────────────
const SIM = .30, WINDOW = 72 * H;
const clusters = [];
for (const d of docs) {                                                         // items arrive in time order
  let best = null, bs = 0;
  for (const c of clusters) {
    if (d.it.t - c.last > WINDOW) continue;
    const s = Math.max(cos(d.v, c.centroid) , ...c.docs.slice(-6).map(e => cos(d.v, e.v)) .map(x => x * .95));
    const shared = [...d.title].filter(w => c.titleTerms.get(w) && idf(w) > 2.2).length;   // at least two rare headline words in common
    if (s > bs && s >= SIM && shared >= 2) { best = c; bs = s; }
  }
  if (!best) { best = { docs: [], centroid: new Map(), titleTerms: new Map(), last: 0 }; clusters.push(best); }
  best.docs.push(d); best.last = d.it.t;
  for (const w of d.title) best.titleTerms.set(w, (best.titleTerms.get(w) || 0) + 1);
  const k = best.docs.length;                                                   // running mean centroid
  for (const [w, x] of best.centroid) best.centroid.set(w, x * (k - 1) / k);
  for (const [w, x] of d.v) best.centroid.set(w, (best.centroid.get(w) || 0) + x / k);
}

// ── tone & framing lexicons (small, transparent, easy to audit) ──────────────────────────────────────────
const NEG = new Set(`kill killed killing dead death deaths dies died die attack attacks attacked war crisis crash crashes collapse slams slam row clash clashes
fear fears threat threats warn warns warning blast explosion fire fires flood floods storm protest protests violence violent riot arrest arrested
accused accuse scam fraud shock shocking deadly disaster tragedy toll injured hurt wounded loss losses plunge plunges fall falls slump crisis
condemn condemns condemned outrage furious chaos panic fail fails failed failure ban banned sanction sanctions strike strikes terror terrorist
hostage missing victims victim abuse rape murder murdered stabbing shooting gunman suspect probe charged guilty jail sentenced`.split(/\s+/));
const POS = new Set(`win wins won victory record rise rises rising surge surges boost boosts growth gain gains rally rallies hope hopes peace deal deals
agree agreement agreed breakthrough rescue rescued saved celebrate celebrates success successful launch launches approve approved welcome welcomes
help helps support supports improve improves recovery recover safe relief award awarded honour honored historic best strong stronger ease eases`.split(/\s+/));
const FRAMES = {
  Conflict: /\b(war|attack|clash|strike|slams?|row|military|troops|missile|fight|battle|vs|hits? back|retaliat|condemn|tension)/i,
  Politics: /\b(minister|government|govt|party|election|poll|parliament|president|pm |modi|congress|bjp|opposition|cabinet|senate|vote|policy)/i,
  Economy: /\b(market|price|stocks?|sensex|nifty|economy|gdp|inflation|rupee|dollar|trade|tariff|bank|rate|crore|billion|investment|jobs?)/i,
  Human: /\b(family|families|children|child|mother|father|women|students?|victims?|survivors?|lives|people|community|grief|mourn)/i,
  Safety: /\b(alert|warning|storm|rain|flood|cyclone|quake|earthquake|heat|fire|accident|crash|rescue|evacuat|health|virus|outbreak)/i,
  Justice: /\b(court|judge|police|arrest|probe|case|charged|verdict|bail|cbi|ed |fir|investigation|accused|trial)/i,
};
const toneOf = s => { const w = s.toLowerCase().match(/[a-z]+/g) || []; let p = 0, n = 0; for (const x of w) { if (POS.has(x)) p++; if (NEG.has(x)) n++; } return p + n ? +((p - n) / (p + n)).toFixed(2) : 0; };
const framesOf = s => Object.entries(FRAMES).filter(([, re]) => re.test(" " + s + " ")).map(([k]) => k);

// ── turn clusters into stories ──────────────────────────────────────────────────────────────────────────
const id8 = s => createHash("sha1").update(s).digest("hex").slice(0, 10);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const stories = [];
for (const c of clusters) {
  // one entry per outlet: its first headline on the story
  const firstBy = new Map();
  for (const d of c.docs) if (!firstBy.has(d.it.outlet)) firstBy.set(d.it.outlet, d);
  if (firstBy.size < 3) continue;                                               // a "story" = at least three outlets
  const cover = [...firstBy.values()].sort((a, b) => a.it.t - b.it.t);
  const origin = cover[0], t0 = origin.it.t, o0 = byId[origin.it.outlet];

  // consensus: words most outlets used; the most central headline stands for the story
  const tc = new Map(); for (const d of cover) for (const w of d.title) tc.set(w, (tc.get(w) || 0) + 1);
  const consensus = [...tc].filter(([w, n]) => n >= Math.max(2, Math.ceil(cover.length * .4))).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => ({ w, share: +(n / cover.length).toFixed(2) }));
  const central = cover.map(d => ({ d, s: cover.reduce((a, e) => a + (e === d ? 0 : cos(d.v, e.v)), 0) })).sort((a, b) => b.s - a.s)[0].d;
  const surface = new Map(); for (const d of cover) for (const raw of d.it.title.split(/[^\p{L}\p{N}\-]+/u)) { const k = stem(raw.toLowerCase()); if (!surface.has(k) && raw.length > 2) surface.set(k, raw); }

  // spread stages
  const home = o0.country;
  const nat = cover.filter(d => byId[d.it.outlet].country === home);
  const intl = cover.find(d => byId[d.it.outlet].country !== home);
  const stages = [
    { key: "origin", label: "First report", t: t0, outlet: o0.id },
    nat.length >= 3 ? { key: "national", label: `National in ${home === "United States" ? "the US" : home === "United Kingdom" ? "the UK" : home}`, t: nat[2].it.t, outlet: nat[2].it.outlet, n: nat.length } : null,
    intl ? { key: "international", label: "Crossed borders", t: intl.it.t, outlet: intl.it.outlet } : null,
  ].filter(Boolean).sort((a, b) => a.t - b.t);

  const coverage = cover.map(d => {
    const o = byId[d.it.outlet];
    const angle = [...d.title].filter(w => (tc.get(w) || 0) === 1 && idf(w) > 2).slice(0, 4).map(w => surface.get(w) || w);   // words only this outlet used
    return { outlet: o.id, title: d.it.title, summary: d.it.summary, link: d.it.link, t: d.it.t, lag: Math.round((d.it.t - t0) / 60e3),
             tone: toneOf(d.it.title + " " + (d.it.summary || "")), frames: framesOf(d.it.title + " " + (d.it.summary || "")), angle };
  });
  const allText = cover.map(d => d.it.title).join(" · ");
  const places = placesFor(central.it.title, allText);
  const countries = [...new Set(cover.map(d => byId[d.it.outlet].country))];
  const span = cover.at(-1).it.t - t0;
  const frameCount = {}; for (const x of coverage) for (const f of x.frames) frameCount[f] = (frameCount[f] || 0) + 1;
  const tones = coverage.map(x => x.tone);
  stories.push({
    id: id8(origin.it.id), headline: central.it.title, origin: { outlet: o0.id, t: t0, title: origin.it.title, link: origin.it.link },
    epicentre: places[0] || null, places, outlets: cover.length, countries, mentions: c.docs.length,
    first: t0, last: c.last, span, stages, consensus: consensus.map(x => ({ ...x, w: surface.get(x.w) || x.w })),
    frames: Object.entries(frameCount).sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ f, n })),
    tone: { avg: +(tones.reduce((a, b) => a + b, 0) / tones.length).toFixed(2), min: Math.min(...tones), max: Math.max(...tones) },
    coverage,
  });
}

// score: how far and how fast it travelled, fading with age
const latest = Math.max(...items.map(i => i.t));
for (const s of stories) s.score = +((s.outlets * 1.0 + s.countries.length * 2.5 + Math.log1p(s.mentions)) * Math.exp(-(latest - s.last) / (36 * H))).toFixed(2);
stories.sort((a, b) => b.score - a.score);

// ── patterns across all stories ─────────────────────────────────────────────────────────────────────────
const P = Object.fromEntries(OUTLETS.map(o => [o.id, { broke: 0, covered: 0, lags: [] }]));
for (const s of stories) for (const c of s.coverage) { const p = P[c.outlet]; p.covered++; if (c.lag === 0 && c.outlet === s.origin.outlet) p.broke++; else p.lags.push(c.lag); }
const crossed = stories.filter(s => s.stages.some(x => x.key === "international"));
const patterns = {
  updated, stories: stories.length, items: items.length,
  outlets: OUTLETS.map(o => ({ id: o.id, broke: P[o.id].broke, covered: P[o.id].covered, medianLag: median(P[o.id].lags) })).sort((a, b) => b.broke - a.broke || b.covered - a.covered),
  crossBorder: { share: stories.length ? +(crossed.length / stories.length).toFixed(2) : 0,
    medianMinutes: median(crossed.map(s => Math.round((s.stages.find(x => x.key === "international").t - s.first) / 60e3))),
    indiaToWorld: crossed.filter(s => byId[s.origin.outlet].scope === "IN").length, worldToIndia: crossed.filter(s => byId[s.origin.outlet].scope === "INTL" && s.countries.includes("India")).length },
  nationalMedianMinutes: median(stories.filter(s => s.stages.some(x => x.key === "national")).map(s => Math.round((s.stages.find(x => x.key === "national").t - s.first) / 60e3))),
  frames: Object.entries(stories.flatMap(s => s.coverage.flatMap(c => c.frames)).reduce((m, f) => (m[f] = (m[f] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]),
};

// ── write ──────────────────────────────────────────────────────────────────────────────────────────────
await rm(new URL("s/", DATA), { recursive: true, force: true });
await mkdir(new URL("s/", DATA), { recursive: true });
const TOP = stories.slice(0, 120);
for (const s of TOP) await writeFile(new URL(`s/${s.id}.json`, DATA), JSON.stringify(s));
await writeFile(new URL("stories.json", DATA), JSON.stringify({ updated, stories: TOP.map(({ coverage, ...s }) => ({ ...s, trail: coverage.map(c => [c.outlet, c.lag]) })) }));
await writeFile(new URL("patterns.json", DATA), JSON.stringify(patterns));
await writeFile(new URL("outlets.json", DATA), JSON.stringify(OUTLETS.map(({ feeds, ...o }) => o)));
console.log(`${clusters.length} clusters → ${stories.length} stories (≥3 outlets); wrote top ${TOP.length}`);
for (const s of stories.slice(0, 15)) console.log(`${String(s.score).padStart(6)}  ${s.outlets}o ${s.countries.length}c  first:${s.origin.outlet.padEnd(10)} ${s.headline.slice(0, 90)}`);
