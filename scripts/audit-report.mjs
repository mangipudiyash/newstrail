// Publishes the accuracy audit: scores the current engine on both hand-checked sets and writes site/audit.json.
// Run locally after an audit (the labels refer to headlines of a specific week, so this is not rerun hourly).
import { readFile, writeFile } from "node:fs/promises";
import { byId } from "./outlets.mjs";
import { analyze, DEFAULTS } from "./engine.mjs";
import { wilson } from "./stats.mjs";
const raw = JSON.parse(await readFile(new URL("../site/data/items.json", import.meta.url), "utf8"));
const ALL = raw.items.filter(i => byId[i.outlet]).sort((a, b) => a.t - b.t), latest = Math.max(...ALL.map(i => i.t));
const { stories } = analyze(ALL, raw.trackStart, latest - 7 * 864e5, latest + 1, { quiet: true, statsOff: true });
const where = new Map(); stories.forEach((s, k) => s.coverage.forEach(c => where.set(c.link, k)));
const sets = [];
for (const [name, f] of [["Tuning set", "labels.json"], ["Validation set", "labels-holdout.json"]]) {
  const L = JSON.parse(await readFile(new URL(`../audit/${f}`, import.meta.url), "utf8"));
  const acc = { all: { s: 0, h: 0, bad: 0, ob: 0 }, confident: { s: 0, h: 0, bad: 0, ob: 0 } };
  for (const st of L.stories) {
    const OK = st.items.filter(i => i.ok).map(i => i.link), BAD = new Set(st.items.filter(i => !i.ok).map(i => i.link));
    const v = new Map(); for (const l of OK) if (where.has(l)) v.set(where.get(l), (v.get(where.get(l)) || 0) + 1);
    const [T, n] = [...v].sort((a, b) => b[1] - a[1])[0] || [null, 0]; if (T == null || n < 2) continue;
    const S = stories[T], labelled = S.coverage.filter(c => OK.includes(c.link) || BAD.has(c.link));
    for (const k of S.confident ? ["all", "confident"] : ["all"]) { const a = acc[k]; a.s++; a.h += labelled.length; a.bad += labelled.filter(c => BAD.has(c.link)).length; a.ob += BAD.has(S.origin.link) ? 1 : 0; }
  }
  const fmt = a => ({ stories: a.s, headlines: a.h, headlineAccuracy: +(100 * (a.h - a.bad) / a.h).toFixed(1), headlineCI: wilson(a.h - a.bad, a.h),
    firstReportAccuracy: +(100 * (a.s - a.ob) / a.s).toFixed(1), firstReportCI: wilson(a.s - a.ob, a.s) });
  sets.push({ name, file: f, sample: L.sample, all: fmt(acc.all), confident: fmt(acc.confident) });
}
const out = { reviewed: "2026-10-29", criterion: JSON.parse(await readFile(new URL("../audit/labels.json", import.meta.url), "utf8")).criterion,
  settings: DEFAULTS, sets, note: "The confidence threshold (coherence ≥ 0.4) was chosen using both sets, so these figures are in-sample; a fresh audit on new data is scheduled to confirm them." };
await writeFile(new URL("../site/audit.json", import.meta.url), JSON.stringify(out, null, 1));
for (const s of sets) console.log(s.name, JSON.stringify(s.all), "\n   confident:", JSON.stringify(s.confident));
