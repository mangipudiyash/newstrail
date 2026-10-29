// The NewsTrail engine: groups headlines into stories and measures how news moves. Used by build.mjs (the site) and
// eval.mjs (the accuracy test against hand-checked stories). Tunable thresholds live in DEFAULTS so a change can be tested
// against the audit before it ships.
import { createHash } from "node:crypto";
import { OUTLETS, byId } from "./outlets.mjs";
import { placesFor } from "./places.mjs";
import { countriesIn, regionOf, REGION } from "./countries.mjs";
import { wilson, bootstrap, median, solid } from "./stats.mjs";

const H = 3600e3;
const pct = (a, b) => b ? +(a / b * 100).toFixed(1) : 0;
// PRUNE and ORIGIN_MIN were tuned on a 60-story hand audit and confirmed on a separate 40-story sample (see audit/README.md)
export const DEFAULTS = { SIM: .30, SHARED: 2, SHARED_IDF: 2.2, MERGE_RARE: 3.0, MERGE_COS: .2, PRUNE: .3, ORIGIN_MIN: .35, ONSET_N: 3, ONSET_HOURS: 6, CONFIDENT: .4 };

// ── text → weighted terms ───────────────────────────────────────────────────────────────────────────────
const STOP = new Set(`a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those
he she they them his her their we our you your i me my not no yes do does did done has have had will would can could should may might must
after before over under into about amid against between during than then there here what which who whom whose why how when where all any
both each few more most other some such only own same so too very just also new says said say amid live news updates update latest today
watch video photos explained report reports amid why how what first big top day week year years one two three per cent percent vs via
make makes made get gets take takes set sets back now still out up down off around across amid least near amid while within without`.split(/\s+/));
const stem = w => w.length > 5 ? w.replace(/(ings|ing|ed|es|s)$/, "") : w.length > 3 ? w.replace(/s$/, "") : w;
const terms = s => (s.toLowerCase().replace(/[’']s\b/g, "").match(/[\p{L}\p{N}][\p{L}\p{N}\-.]*[\p{L}\p{N}]|\p{L}/gu) || [])
  .map(w => w.replace(/\./g, "")).filter(w => w.length > 2 && !STOP.has(w) && !/^\d{1,2}$/.test(w)).map(stem);
const cos = (a, b) => { let s = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const [w, v] of x) { const u = y.get(w); if (u) s += v * u; } return s; };

// ── tone & framing lexicons (small, transparent, easy to audit) ────────────────────────────────────────────
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
export const about = it => { const t = countriesIn(it.title); return t.length ? t : countriesIn(it.summary || ""); };
const id8 = s => createHash("sha1").update(s).digest("hex").slice(0, 10);

/**
 * Analyse the headlines published in [start, end). Headlines from the 72 hours before `start` are used as context for grouping,
 * so a story that began before the window is recognised as old and left out — its "first report" would otherwise be wrong.
 */
export function analyze(ALL, TRACK_START, start, end, { quiet = false, params = {}, updated = Date.now(), statsOff = false } = {}) {
  const P_ = { ...DEFAULTS, ...params };
  const pool = ALL.filter(i => i.t >= start - 72 * H && i.t < end);
  const inWin = i => i.t >= start && i.t < end;

  // TF-IDF over the pool
  const docs = pool.map(it => {
    const tf = new Map();
    for (const w of terms(it.title)) tf.set(w, (tf.get(w) || 0) + 2);           // headline words count double
    for (const w of terms(it.summary || "")) tf.set(w, (tf.get(w) || 0) + 1);
    return { it, tf, title: new Set(terms(it.title)) };
  });
  const df = new Map(); for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length, idf = w => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
  for (const d of docs) { d.v = new Map([...d.tf].map(([w, c]) => [w, (1 + Math.log(c)) * idf(w)])); const n = Math.hypot(...d.v.values()) || 1; for (const [w, x] of d.v) d.v.set(w, x / n); }

  // clustering: walk the timeline; an item joins the story it matches best, if it's close enough
  const SIM = P_.SIM, WINDOW = 72 * H;
  let clusters = [];
  for (const d of docs) {
    let best = null, bs = 0;
    for (const c of clusters) {
      if (d.it.t - c.last > WINDOW) continue;
      const s = Math.max(cos(d.v, c.centroid), ...c.docs.slice(-6).map(e => cos(d.v, e.v) * .95));
      const shared = [...d.title].filter(w => c.titleTerms.get(w) && idf(w) > P_.SHARED_IDF).length;   // rare headline words in common
      if (s > bs && s >= SIM && shared >= P_.SHARED) { best = c; bs = s; }
    }
    if (!best) { best = { docs: [], centroid: new Map(), titleTerms: new Map(), last: 0 }; clusters.push(best); }
    best.docs.push(d); best.last = d.it.t;
    for (const w of d.title) best.titleTerms.set(w, (best.titleTerms.get(w) || 0) + 1);
    const k = best.docs.length;
    for (const [w, x] of best.centroid) best.centroid.set(w, x * (k - 1) / k);
    for (const [w, x] of d.v) best.centroid.set(w, (best.centroid.get(w) || 0) + x / k);
  }
  // merge pass: one event often starts as several clusters (a tracker, live updates, an explainer…)
  {
    const RARE = P_.MERGE_RARE, GAP = 48 * H, first = c => c.docs[0].it.t;
    const parent = clusters.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const index = new Map();
    clusters.forEach((c, i) => { for (const w of c.titleTerms.keys()) if (idf(w) > RARE) (index.get(w) || index.set(w, []).get(w)).push(i); });
    const seen = new Set();
    for (const ids of index.values()) {
      if (ids.length > 40) continue;
      for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
        const a = ids[x], b = ids[y], key = a * 1e6 + b; if (seen.has(key)) continue; seen.add(key);
        const A = clusters[a], B = clusters[b];
        if (Math.max(first(A), first(B)) - Math.min(A.last, B.last) > GAP) continue;
        const shared = [...A.titleTerms.keys()].filter(w => idf(w) > RARE && B.titleTerms.has(w)).length;
        if (shared >= 2 && cos(A.centroid, B.centroid) >= P_.MERGE_COS) parent[find(b)] = find(a);
      }
    }
    const groups = new Map();
    clusters.forEach((c, i) => (groups.get(find(i)) || groups.set(find(i), []).get(find(i))).push(c));
    const build = docs => { const centroid = new Map(), titleTerms = new Map(); for (const d of docs) { for (const [w, x] of d.v) centroid.set(w, (centroid.get(w) || 0) + x / docs.length); for (const w of d.title) titleTerms.set(w, (titleTerms.get(w) || 0) + 1); } return { docs, centroid, titleTerms, last: docs.at(-1).it.t }; };
    const merged = [...groups.values()].map(cs => cs.length === 1 ? cs[0] : build(cs.flatMap(c => c.docs).sort((a, b) => a.it.t - b.it.t)));
    // prune: a headline far from the rest of its story (a related but different event) goes back to stand alone
    const out = [];
    for (const c of merged) {
      if (c.docs.length < 3) { out.push(c); continue; }
      const loo = d => { const m = new Map(); for (const e of c.docs) if (e !== d) for (const [w, x] of e.v) m.set(w, (m.get(w) || 0) + x); return cos(d.v, m) / (Math.hypot(...m.values()) || 1); };
      let keep = c.docs.filter(d => loo(d) >= P_.PRUNE);
      // origin guard: the earliest headline must match the story closely, or a loosely related earlier piece (a preview,
      // a different event with the same names) would be credited as the first report
      while (P_.ORIGIN_MIN && keep.length >= 3) { const m = new Map(); for (const e of keep.slice(1)) for (const [w, x] of e.v) m.set(w, (m.get(w) || 0) + x);
        if (cos(keep[0].v, m) / (Math.hypot(...m.values()) || 1) >= P_.ORIGIN_MIN) break; keep = keep.slice(1); }
      const drop = c.docs.filter(d => !keep.includes(d));
      if (!drop.length || keep.length < 2) { out.push(c); continue; }
      out.push(build(keep)); for (const d of drop) out.push(build([d]));
    }
    if (!quiet) console.log(`merge pass: ${clusters.length} → ${merged.length} clusters, ${out.length - merged.length} outlier headlines split off`);
    clusters = out;
  }

  // ── stories (≥3 outlets) that began inside the window ─────────────────────────────────────────────────
  const stories = [];
  for (const c of clusters) {
    const firstBy = new Map();
    for (const d of c.docs) if (!firstBy.has(d.it.outlet)) firstBy.set(d.it.outlet, d);
    if (firstBy.size < 3) continue;
    const all = [...firstBy.values()].sort((a, b) => a.it.t - b.it.t);
    // the news "breaks" at the first burst: ONSET_N newsrooms within ONSET_HOURS. Earlier pieces (previews, background)
    // stay on the timeline as "before the news broke" but are never credited as the first report.
    let on = 0;
    if (P_.ONSET_N) { const need = Math.min(P_.ONSET_N, all.length);
      on = all.findIndex((d, i) => all.slice(i).filter(e => e.it.t - d.it.t <= P_.ONSET_HOURS * H).length >= need); if (on < 0) on = 0; }
    const before = all.slice(0, on), cover = all.slice(on);
    if (cover.length < 2) continue;
    const origin = cover[0], t0 = origin.it.t, o0 = byId[origin.it.outlet];
    if (t0 < start) continue;                                                   // broke before the window: origin unknown
    const tc = new Map(); for (const d of cover) for (const w of d.title) tc.set(w, (tc.get(w) || 0) + 1);
    const consensus = [...tc].filter(([, n]) => n >= Math.max(2, Math.ceil(cover.length * .4))).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => ({ w, share: +(n / cover.length).toFixed(2) }));
    const central = cover.map(d => ({ d, s: cover.reduce((a, e) => a + (e === d ? 0 : cos(d.v, e.v)), 0) })).sort((a, b) => b.s - a.s)[0].d;
    const surface = new Map(); for (const d of cover) for (const w of d.it.title.split(/[^\p{L}\p{N}\-]+/u)) { const k = stem(w.toLowerCase()); if (!surface.has(k) && w.length > 2) surface.set(k, w); }
    const home = o0.country, nat = cover.filter(d => byId[d.it.outlet].country === home), intl = cover.find(d => byId[d.it.outlet].country !== home);
    const stages = [
      { key: "origin", label: "First report", t: t0, outlet: o0.id },
      nat.length >= 3 ? { key: "national", label: `National in ${home === "United States" ? "the US" : home === "United Kingdom" ? "the UK" : home}`, t: nat[2].it.t, outlet: nat[2].it.outlet, n: nat.length } : null,
      intl ? { key: "international", label: "Crossed borders", t: intl.it.t, outlet: intl.it.outlet } : null,
    ].filter(Boolean).sort((a, b) => a.t - b.t);
    const coverage = [...before, ...cover].map(d => {
      const angle = [...d.title].filter(w => (tc.get(w) || 0) === 1 && idf(w) > 2).slice(0, 4).map(w => surface.get(w) || w);
      return { outlet: d.it.outlet, title: d.it.title, summary: d.it.summary, link: d.it.link, t: d.it.t, lag: Math.round((d.it.t - t0) / 60e3),
               tone: toneOf(d.it.title + " " + (d.it.summary || "")), frames: framesOf(d.it.title + " " + (d.it.summary || "")), angle, ...(before.includes(d) ? { before: true } : {}) };
    });
    let places = placesFor(central.it.title, cover.map(d => d.it.title).join(" · "));
    const countries = [...new Set(all.map(d => byId[d.it.outlet].country))];
    // what the story is about: a country counts only if outlets *outside* it name it too
    const named = cover.map(d => ({ home: byId[d.it.outlet].country, cs: about(d.it) }));
    const subject = [...new Set(named.flatMap(x => x.cs))].map(k => {
      const others = named.filter(x => x.home !== k), pool = others.length ? others : named;
      return [k, pool.filter(x => x.cs.includes(k)).length, pool.length];
    }).filter(([, n, of]) => n >= 1 && n >= of * .4).sort((a, b) => b[1] / b[2] - a[1] / a[2]).map(([k]) => k);
    if (subject.length && (!places.length || (places[0].rank === 1 && !subject.includes(places[0].name)))) {
      const sp = placesFor(subject[0], ""); if (sp.length) places = [...sp, ...places.filter(p => p.name !== sp[0].name)].slice(0, 2);
    }
    // coherence: how closely each headline matches the rest of its story (mean leave-one-out similarity, 0–1)
    const coh = cover.length < 2 ? 1 : cover.reduce((a, d) => { const m = new Map(); for (const e of cover) if (e !== d) for (const [w, x] of e.v) m.set(w, (m.get(w) || 0) + x); return a + cos(d.v, m) / (Math.hypot(...m.values()) || 1); }, 0) / cover.length;
    const frameCount = {}; for (const x of coverage) for (const f of x.frames) frameCount[f] = (frameCount[f] || 0) + 1;
    const tones = coverage.map(x => x.tone);
    stories.push({
      id: id8(origin.it.id), headline: central.it.title, origin: { outlet: o0.id, t: t0, title: origin.it.title, link: origin.it.link },
      epicentre: places[0] || null, places, outlets: all.length, before: before.length, countries, subject, mentions: c.docs.length,
      first: t0, last: c.last, span: all.at(-1).it.t - t0, coherence: +coh.toFixed(3), confident: coh >= P_.CONFIDENT, stages, fair: t0 >= TRACK_START,
      consensus: consensus.map(x => ({ ...x, w: surface.get(x.w) || x.w })),
      frames: Object.entries(frameCount).sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ f, n })),
      tone: { avg: +(tones.reduce((a, b) => a + b, 0) / tones.length).toFixed(2), min: Math.min(...tones), max: Math.max(...tones) },
      coverage,
    });
  }
  const latest = Math.min(end, Math.max(...pool.map(i => i.t)));
  for (const s of stories) s.score = +((s.outlets + s.countries.length * 2.5 + Math.log1p(s.mentions)) * Math.exp(-(latest - s.last) / (36 * H))).toFixed(2);
  stories.sort((a, b) => b.score - a.score);

  if (statsOff) return { stories, clusters };
  // ── bootstrap units: every headline in the window belongs to one cluster; clusters are resampled whole ─────
  const items = pool.filter(inWin);
  const unitOf = new Map(); clusters.forEach((c, k) => { for (const d of c.docs) unitOf.set(d.it.id, k); });
  const F = items.map(it => { const o = byId[it.outlet], cs = about(it); return { it, o: it.outlet, home: o.country, cs, placed: cs.length > 0, abroad: cs.some(c => c !== o.country), regions: new Set(cs.map(c => regionOf[c]).filter(Boolean)) }; });
  const unitsMap = new Map(); for (const f of F) { const k = unitOf.get(f.it.id); (unitsMap.get(k) || unitsMap.set(k, []).get(k)).push(f); }
  const UNITS = [...unitsMap.values()];
  // share among rows matching `den` that also match `num`, with a cluster-bootstrap interval
  const share = (den, num, B = 1000) => {
    const rel = UNITS.filter(u => u.some(den)); let k = 0, n = 0;
    for (const u of rel) for (const f of u) if (den(f)) { n++; if (num(f)) k++; }
    const ci = bootstrap(rel, s => { let a = 0, b = 0; for (const u of s) for (const f of u) if (den(f)) { b++; if (num(f)) a++; } return b ? 100 * a / b : null; }, { B });
    return { value: pct(k, n), k, n, units: rel.length, ci, solid: solid(rel.length, ci) };
  };

  // ── patterns (story level) ──────────────────────────────────────────────────────────────────────────
  const conf = stories.filter(s => s.confident);                              // only well-grouped stories feed the statistics
  const fair = conf.filter(s => s.fair);
  const P = Object.fromEntries(OUTLETS.map(o => [o.id, { broke: 0, covered: 0, lags: [] }]));
  for (const s of fair) for (const c of s.coverage) { if (c.before) continue; const p = P[c.outlet]; p.covered++; if (c.outlet === s.origin.outlet) p.broke++; else p.lags.push(c.lag); }
  const crossed = conf.filter(s => s.stages.some(x => x.key === "international"));
  const toIntl = crossed.map(s => Math.round((s.stages.find(x => x.key === "international").t - s.first) / 60e3));
  const toNat = conf.filter(s => s.stages.some(x => x.key === "national")).map(s => Math.round((s.stages.find(x => x.key === "national").t - s.first) / 60e3));
  const medCI = a => a.length >= 5 ? bootstrap(a.map(x => [x]), s => median(s.map(r => r[0]))) : null;
  const patterns = {
    updated, from: start, to: end, trackStart: TRACK_START, stories: stories.length, confidentStories: conf.length, fairStories: fair.length, items: items.length,
    outlets: OUTLETS.map(o => { const p = P[o.id], ci = wilson(p.broke, p.covered), lagCI = medCI(p.lags);
      return { id: o.id, broke: p.broke, covered: p.covered, breakRate: pct(p.broke, p.covered), breakCI: ci, medianLag: median(p.lags), lagCI, solid: p.covered >= 10 }; })
      .sort((a, b) => (b.solid - a.solid) || b.breakRate - a.breakRate || b.covered - a.covered),
    crossBorder: { share: pct(crossed.length, conf.length), k: crossed.length, n: conf.length, ci: wilson(crossed.length, conf.length),
      medianMinutes: median(toIntl), medianCI: medCI(toIntl), solid: conf.length >= 20 },
    national: { medianMinutes: median(toNat), medianCI: medCI(toNat), n: toNat.length },
    frames: Object.entries(conf.flatMap(s => s.coverage.flatMap(c => c.frames)).reduce((m, f) => (m[f] = (m[f] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]),
  };

  // ── home vs world (headline level, cluster-bootstrapped) ─────────────────────────────────────────────
  const homes = [...new Set(OUTLETS.map(o => o.country))];
  const countries = homes.map(h => {
    const mine = F.filter(f => f.home === h), placed = mine.filter(f => f.placed), abroad = placed.filter(f => f.abroad);
    const by = {}; for (const f of abroad) for (const c of f.cs) if (c !== h) by[c] = (by[c] || 0) + 1;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => ({ c, ...share(f => f.home === h && f.abroad, f => f.cs.includes(c), 500) }));
    return { country: h, n: mine.length, placed: placed.length, abroad: abroad.length, abroadShare: pct(abroad.length, placed.length), top };
  }).filter(c => c.n).sort((a, b) => b.n - a.n);
  const outlets = OUTLETS.map(o => { const mine = F.filter(f => f.o === o.id), placed = mine.filter(f => f.placed), abroad = placed.filter(f => f.abroad);
    const by = {}; for (const f of abroad) for (const c of f.cs) if (c !== o.country) by[c] = (by[c] || 0) + 1;
    return { id: o.id, country: o.country, n: mine.length, placed: placed.length, abroad: abroad.length, abroadShare: pct(abroad.length, placed.length),
      sec: { home: mine.filter(f => f.it.sec === "home").length, world: mine.filter(f => f.it.sec !== "home").length },
      top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, k]) => ({ c, share: pct(k, abroad.length) })) }; }).filter(o => o.n);
  const COLS = ["India", "United States", "United Kingdom", "China", "Pakistan", "Israel", "Palestine", "Russia", "Ukraine", "Iran"];
  const matrix = countries.filter(r => r.abroad >= 15).map(r => { const ab = F.filter(f => f.home === r.country && f.abroad);
    return { country: r.country, abroad: r.abroad, cells: COLS.map(c => c === r.country ? null : pct(ab.filter(f => f.cs.includes(c)).length, ab.length)) }; });
  // mirror: India's newsrooms about country X vs X's newsrooms about India — both as a share of that side's foreign coverage
  const mirror = countries.filter(r => r.country !== "India" && r.abroad >= 15).map(r => {
    const a = share(f => f.home === "India" && f.abroad, f => f.cs.includes(r.country)), b = share(f => f.home === r.country && f.abroad, f => f.cs.includes("India"));
    const rel = UNITS.filter(u => u.some(f => (f.home === "India" || f.home === r.country) && f.abroad));
    const ratioCI = bootstrap(rel, s => { let a1 = 0, a2 = 0, b1 = 0, b2 = 0; for (const u of s) for (const f of u) { if (!f.abroad) continue;
      if (f.home === "India") { a2++; if (f.cs.includes(r.country)) a1++; } else if (f.home === r.country) { b2++; if (f.cs.includes("India")) b1++; } }
      return a2 && b2 && b1 ? (a1 / a2) / (b1 / b2) : null; }, { B: 1000 });
    return { country: r.country, indiaAboutThem: a, themAboutIndia: b, ratio: b.value ? +(a.value / b.value).toFixed(1) : null, ratioCI, solid: a.solid && b.solid && !!ratioCI };
  });
  // hot zones: every newsroom gets one equal vote, split across the regions its placed headlines name
  const regionShares = rows => { const per = {}; for (const u of rows) for (const f of u) { if (!f.placed) continue; const p = per[f.o] ??= { n: 0, r: {} }; p.n++; for (const g of f.regions) p.r[g] = (p.r[g] || 0) + 1; }
    const voters = Object.values(per).filter(p => p.n >= 10), W = {}; for (const p of voters) for (const [g, k] of Object.entries(p.r)) W[g] = (W[g] || 0) + k / p.n / voters.length;
    const tot = Object.values(W).reduce((a, b) => a + b, 0) || 1; return { W, tot, voters: voters.length }; };
  const R0 = regionShares(UNITS);
  const regionCI = Object.fromEntries(Object.keys(REGION).map(g => [g, bootstrap(UNITS, s => { const r = regionShares(s); return 100 * (r.W[g] || 0) / r.tot; }, { B: 400, seed: 11 })]));
  const regions = Object.keys(REGION).map(region => {
    const byC = {}; for (const f of F) for (const c of f.cs) if (regionOf[c] === region) byC[c] = (byC[c] || 0) + 1;
    const top = conf.filter(s => s.subject.some(c => regionOf[c] === region)).sort((a, b) => b.outlets - a.outlets)[0];
    const ci = regionCI[region];
    return { region, share: pct(R0.W[region] || 0, R0.tot), ci, solid: R0.voters >= 10 && !!ci, newsrooms: R0.voters, headlines: F.filter(f => f.regions.has(region)).length,
      countries: Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => ({ c, n })), top: top ? { id: top.id, headline: top.headline, outlets: top.outlets, countries: top.countries.length } : null };
  }).sort((a, b) => b.share - a.share);
  const aboutIn = conf.filter(s => s.subject.includes("India")), went = aboutIn.filter(s => s.countries.some(c => c !== "India"));
  const aboutEl = conf.filter(s => s.subject.length && !s.subject.includes("India")), cameIn = aboutEl.filter(s => s.countries.includes("India"));
  const ex = (list, n = 6) => list.slice(0, n).map(s => ({ id: s.id, headline: s.headline, origin: s.origin.outlet, outlets: s.outlets, countries: s.countries }));
  const trav = [...conf].sort((a, b) => b.countries.length - a.countries.length || b.outlets - a.outlets)[0];
  const compare = {
    updated, from: start, to: end, items: items.length, units: UNITS.length,
    countries, outlets, matrix: { cols: COLS, rows: matrix }, mirror, regions,
    aboutIndia: { stories: aboutIn.length, carriedAbroad: went.length, ci: wilson(went.length, aboutIn.length) },
    aboutElsewhereInIndia: { stories: aboutEl.length, carriedInIndia: cameIn.length, ci: wilson(cameIn.length, aboutEl.length) },
    traveller: trav && { id: trav.id, headline: trav.headline, epicentre: trav.epicentre, subject: trav.subject, countries: trav.countries, span: trav.span,
      trail: trav.coverage.map(c => ({ outlet: c.outlet, lag: c.lag, title: c.title })) },
    examples: { indiaToWorld: ex(went), worldToIndia: ex(cameIn), indiaOnly: ex(aboutIn.filter(s => s.countries.length === 1)) },
  };
  return { stories, patterns, compare };
}

