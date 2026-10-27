// Step 2 — build: group headlines from different outlets into stories, then work out for each story
// where it started, how it spread (origin → national → international), how each outlet framed it, and what they agreed on.
// Writes site/data/stories.json (index), site/data/s/<id>.json (one per story), site/data/patterns.json.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { OUTLETS, byId } from "./outlets.mjs";
import { placesFor } from "./places.mjs";
import { countriesIn } from "./countries.mjs";

const DATA = new URL("../site/data/", import.meta.url);
const raw = JSON.parse(await readFile(new URL("items.json", DATA), "utf8")), updated = raw.updated;
const items = raw.items.filter(i => byId[i.outlet]);
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

// ── merge pass: one event often starts as several clusters (a tracker, live updates, an explainer…).
// Two clusters become one story when they are close in time, broadly similar, and share at least two rare headline words.
{
  const RARE = 3.0, GAP = 48 * H, first = c => c.docs[0].it.t;
  const parent = clusters.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const index = new Map();                                                      // rare headline word → clusters using it
  clusters.forEach((c, i) => { for (const w of c.titleTerms.keys()) if (idf(w) > RARE) (index.get(w) || index.set(w, []).get(w)).push(i); });
  const seen = new Set();
  for (const ids of index.values()) {
    if (ids.length > 40) continue;                                              // too common to tell events apart
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const a = ids[x], b = ids[y], key = a * 1e5 + b; if (seen.has(key)) continue; seen.add(key);
      const A = clusters[a], B = clusters[b];
      if (Math.max(first(A), first(B)) - Math.min(A.last, B.last) > GAP) continue;
      const shared = [...A.titleTerms.keys()].filter(w => idf(w) > RARE && B.titleTerms.has(w)).length;
      if (shared >= 2 && cos(A.centroid, B.centroid) >= .2) parent[find(b)] = find(a);
    }
  }
  const groups = new Map();
  clusters.forEach((c, i) => (groups.get(find(i)) || groups.set(find(i), []).get(find(i))).push(c));
  const merged = [...groups.values()].map(cs => {
    if (cs.length === 1) return cs[0];
    const docs = cs.flatMap(c => c.docs).sort((a, b) => a.it.t - b.it.t), centroid = new Map(), titleTerms = new Map();
    for (const d of docs) { for (const [w, x] of d.v) centroid.set(w, (centroid.get(w) || 0) + x / docs.length); for (const w of d.title) titleTerms.set(w, (titleTerms.get(w) || 0) + 1); }
    return { docs, centroid, titleTerms, last: docs.at(-1).it.t };
  });
  // prune: a headline that is far from the rest of its story (a related but different event) goes back to stand alone
  const out = [];
  for (const c of merged) {
    if (c.docs.length < 3) { out.push(c); continue; }
    const loo = d => { const m = new Map(); for (const e of c.docs) if (e !== d) for (const [w, x] of e.v) m.set(w, (m.get(w) || 0) + x); return cos(d.v, m) / (Math.hypot(...m.values()) || 1); };   // vs. the rest of the story
    const keep = c.docs.filter(d => loo(d) >= .2), drop = c.docs.filter(d => !keep.includes(d));
    if (!drop.length || keep.length < 2) { out.push(c); continue; }
    const centroid = new Map(), titleTerms = new Map();
    for (const d of keep) { for (const [w, x] of d.v) centroid.set(w, (centroid.get(w) || 0) + x / keep.length); for (const w of d.title) titleTerms.set(w, (titleTerms.get(w) || 0) + 1); }
    out.push({ docs: keep, centroid, titleTerms, last: keep.at(-1).it.t });
    for (const d of drop) out.push({ docs: [d], centroid: d.v, titleTerms: new Map([...d.title].map(w => [w, 1])), last: d.it.t });
  }
  console.log(`merge pass: ${clusters.length} → ${merged.length} clusters, ${out.length - merged.length} outlier headlines split off`);
  clusters.splice(0, clusters.length, ...out);
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
  // what the story is about: a country counts if outlets *outside* it name it too (so an "Indian-origin" or "India staff"
  // angle added by Indian newsrooms doesn't make a UK court case or a Microsoft story "about India")
  const named = cover.map(d => ({ home: byId[d.it.outlet].country, cs: countriesIn(d.it.title).length ? countriesIn(d.it.title) : countriesIn(d.it.summary || "") }));
  const subject = [...new Set(named.flatMap(x => x.cs))].map(k => {
    const others = named.filter(x => x.home !== k), pool = others.length ? others : named;
    return [k, pool.filter(x => x.cs.includes(k)).length, pool.length];
  }).filter(([, n, of]) => n >= 1 && n >= of * .4 && (of > 1 || named.length < 3 ? true : n >= 1)).sort((a, b) => b[1] / b[2] - a[1] / a[2]).map(([k]) => k);
  // the India angle: Indian outlets naming India in a story that isn't about India
  const indAngle = subject.length && !subject.includes("India") ? { indian: named.filter(x => x.home === "India").length, withIndia: named.filter(x => x.home === "India" && x.cs.includes("India")).length,
    foreignWithIndia: named.filter(x => x.home !== "India" && x.cs.includes("India")).length } : null;
  const span = cover.at(-1).it.t - t0;
  const frameCount = {}; for (const x of coverage) for (const f of x.frames) frameCount[f] = (frameCount[f] || 0) + 1;
  const tones = coverage.map(x => x.tone);
  stories.push({
    id: id8(origin.it.id), headline: central.it.title, origin: { outlet: o0.id, t: t0, title: origin.it.title, link: origin.it.link },
    epicentre: places[0] || null, places, outlets: cover.length, countries, subject, indAngle, mentions: c.docs.length,
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


// ── home vs world: what each newsroom covers about its own country, and about everyone else ────────────
// Every headline (not only clustered ones) is tagged with the countries it is about. Headlines that name no country are
// "unplaced" and left out of the shares, so every percentage below is "of headlines that name a country".
const about = it => { const t = countriesIn(it.title); return t.length ? t : countriesIn(it.summary || ""); };
const blank = () => ({ n: 0, placed: 0, home: 0, abroad: 0, india: 0, sec: { home: 0, world: 0 }, by: {} });
const perOutlet = Object.fromEntries(OUTLETS.map(o => [o.id, blank()]));
const perCountry = {};                                                          // grouped by the outlets' home country
for (const it of items) {
  const o = byId[it.outlet]; if (!o) continue;
  const cs = about(it), rows = [perOutlet[o.id], perCountry[o.country] ??= blank()];
  for (const r of rows) {
    r.n++; r.sec[it.sec || "world"]++;
    if (!cs.length) continue;
    r.placed++;
    if (cs.includes(o.country)) r.home++;
    if (cs.some(c => c !== o.country)) r.abroad++;
    if (cs.includes("India")) r.india++;
    for (const c of cs) if (c !== o.country) r.by[c] = (r.by[c] || 0) + 1;
  }
}
const pct = (a, b) => b ? +(a / b * 100).toFixed(1) : 0;
const summarise = r => ({ n: r.n, placed: r.placed, abroad: r.abroad, sec: r.sec, homeShare: pct(r.home, r.placed), abroadShare: pct(r.abroad, r.placed), indiaShare: pct(r.india, r.placed),
  top: Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, k]) => ({ c, share: pct(k, r.abroad) })) });   // top = share of its foreign coverage
// who covers whom: rows = where the newsroom is, columns = the country the headline is about
const COLS = ["India", "United States", "United Kingdom", "China", "Pakistan", "Israel", "Palestine", "Russia", "Ukraine", "Iran"];
const matrix = Object.entries(perCountry).filter(([, r]) => r.abroad >= 15).sort((a, b) => b[1].abroad - a[1].abroad)
  .map(([country, r]) => ({ country, abroad: r.abroad, cells: COLS.map(c => c === country ? null : pct(r.by[c] || 0, r.abroad)) }));   // % of foreign coverage
// mirror: how much India's newsrooms write about a country vs how much that country's newsrooms write about India
const IN = perCountry.India || blank();
// shares are "of each side's foreign coverage" so they don't depend on how many home vs world headlines a feed carries
const mirror = Object.entries(perCountry).filter(([c, r]) => c !== "India" && r.placed >= 20)
  .map(([c, r]) => ({ country: c, indiaAboutThem: pct(IN.by[c] || 0, IN.abroad), themAboutIndia: pct(r.india, r.abroad), n: r.abroad }));
// shared agenda: share of traced stories each pair of newsroom-countries both carried
const carried = stories.map(s => new Set(s.coverage.map(c => byId[c.outlet].country)));
const homes = Object.keys(perCountry).filter(c => perCountry[c].placed >= 20);
const agenda = homes.flatMap((a, i) => homes.slice(i + 1).map(b => ({ a, b, shared: carried.filter(x => x.has(a) && x.has(b)).length })))
  .filter(x => x.shared).sort((x, y) => y.shared - x.shared);
// examples for the report (and proof): India stories that went abroad, foreign stories India picked up
const ex = (f, n = 6) => stories.filter(f).slice(0, n).map(s => ({ id: s.id, headline: s.headline, origin: s.origin.outlet, outlets: s.outlets, countries: s.countries }));
const compare = {
  updated, items: items.length, from: Math.min(...items.map(i => i.t)), to: Math.max(...items.map(i => i.t)),
  outlets: OUTLETS.map(o => ({ id: o.id, country: o.country, page: o.page, ...summarise(perOutlet[o.id]) })).filter(o => o.n),
  countries: Object.entries(perCountry).map(([c, r]) => ({ country: c, ...summarise(r) })).sort((a, b) => b.n - a.n),
  matrix: { cols: COLS, rows: matrix }, mirror, agenda,
  indiaAngle: (() => { const xs = stories.filter(s => s.indAngle && s.indAngle.indian); const ind = xs.reduce((a, s) => a + s.indAngle.indian, 0), wi = xs.reduce((a, s) => a + s.indAngle.withIndia, 0);
    return { stories: xs.length, indianHeadlines: ind, withIndia: wi, share: pct(wi, ind), localised: xs.filter(s => s.indAngle.withIndia && !s.indAngle.foreignWithIndia).slice(0, 8).map(s => ({ id: s.id, headline: s.headline, outlets: s.outlets })) }; })(),
  // home angle for every country: in stories about somewhere else, how often a country's newsrooms name their own country
  homeAngle: Object.keys(perCountry).map(k => {
    let n = 0, w = 0;
    for (const s of stories) { if (!s.subject.length || s.subject.includes(k)) continue;
      for (const c of s.coverage) if (byId[c.outlet].country === k) { n++; const cs = countriesIn(c.title); if ((cs.length ? cs : countriesIn(c.summary || "")).includes(k)) w++; } }
    return { country: k, headlines: n, withHome: w, share: pct(w, n) };
  }).filter(x => x.headlines >= 8).sort((a, b) => b.share - a.share),
  aboutIndia: { stories: stories.filter(s => s.subject.includes("India")).length, carriedAbroad: stories.filter(s => s.subject.includes("India") && s.countries.some(c => c !== "India")).length },
  aboutElsewhereInIndia: { stories: stories.filter(s => s.subject.length && !s.subject.includes("India")).length, carriedInIndia: stories.filter(s => s.subject.length && !s.subject.includes("India") && s.countries.includes("India")).length },
  examples: {
    indiaToWorld: ex(s => s.subject.includes("India") && s.countries.some(c => c !== "India")),        // about India, carried abroad
    worldToIndia: ex(s => s.subject.length && !s.subject.includes("India") && s.countries.includes("India")),   // about elsewhere, carried in India
    indiaOnly: ex(s => s.subject.includes("India") && s.countries.length === 1),
  },
};

// ── write ──────────────────────────────────────────────────────────────────────────────────────────────
await rm(new URL("s/", DATA), { recursive: true, force: true });
await mkdir(new URL("s/", DATA), { recursive: true });
const TOP = stories.slice(0, 120);
for (const s of TOP) await writeFile(new URL(`s/${s.id}.json`, DATA), JSON.stringify(s));
await writeFile(new URL("stories.json", DATA), JSON.stringify({ updated, stories: TOP.map(({ coverage, ...s }) => ({ ...s, trail: coverage.map(c => [c.outlet, c.lag]) })) }));
await writeFile(new URL("patterns.json", DATA), JSON.stringify(patterns));
await writeFile(new URL("compare.json", DATA), JSON.stringify(compare));
await writeFile(new URL("outlets.json", DATA), JSON.stringify(OUTLETS.map(({ feeds, ...o }) => o)));
console.log(`${clusters.length} clusters → ${stories.length} stories (≥3 outlets); wrote top ${TOP.length}`);
for (const s of stories.slice(0, 15)) console.log(`${String(s.score).padStart(6)}  ${s.outlets}o ${s.countries.length}c  first:${s.origin.outlet.padEnd(10)} ${s.headline.slice(0, 90)}`);
