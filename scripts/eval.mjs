// Accuracy test: rebuild the stories with given settings and score them against the hand-checked labels (audit/labels.json).
// node scripts/eval.mjs '{"SIM":0.33}'   — prints precision, how many correct headlines stayed together, and first-report accuracy.
import { readFile } from "node:fs/promises";
import { byId } from "./outlets.mjs";
import { analyze } from "./engine.mjs";

const raw = JSON.parse(await readFile(new URL("../site/data/items.json", import.meta.url), "utf8"));
const ALL = raw.items.filter(i => byId[i.outlet]).sort((a, b) => a.t - b.t);
const TRACK = raw.trackStart ?? Math.min(...ALL.map(i => i.seen));
const L = JSON.parse(await readFile(new URL(`../audit/${process.argv[3] || "labels.json"}`, import.meta.url), "utf8"));
const latest = Math.max(...ALL.map(i => i.t));

export function score(params, { verbose = false } = {}) {
  const { stories } = analyze(ALL, TRACK, latest - 7 * 864e5, latest + 1, { quiet: true, params, statsOff: true });
  const where = new Map(); stories.forEach((s, k) => s.coverage.forEach(c => where.set(c.link, k)));
  let okIn = 0, okAll = 0, badIn = 0, badAll = 0, oOk = 0, oBad = 0, oUnk = 0, lost = 0;
  for (const st of L.stories) {
    const OK = st.items.filter(i => i.ok).map(i => i.link), BAD = new Set(st.items.filter(i => !i.ok).map(i => i.link));
    const votes = new Map(); for (const l of OK) if (where.has(l)) votes.set(where.get(l), (votes.get(where.get(l)) || 0) + 1);
    const [T, v] = [...votes].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    okAll += OK.length; badAll += BAD.size;
    if (T == null || v < 2) { lost++; if (verbose) console.log("  lost:", st.headline.slice(0, 70)); continue; }
    okIn += v; const inT = stories[T].coverage.map(c => c.link); badIn += inT.filter(l => BAD.has(l)).length;
    const o = stories[T].origin.link; if (OK.includes(o)) oOk++; else if (BAD.has(o)) { oBad++; if (verbose) console.log("  bad origin:", st.headline.slice(0, 60)); } else oUnk++;
  }
  const joined = L.split.filter(([a, b]) => { const ka = a.map(l => where.get(l)).filter(x => x != null), kb = b.map(l => where.get(l)).filter(x => x != null); return ka.length && kb.length && ka.some(x => kb.includes(x)); }).length;
  return { stories: stories.length, precision: +(100 * okIn / (okIn + badIn)).toFixed(1), okKept: +(100 * okIn / okAll).toFixed(1), wrongLeft: `${badIn}/${badAll}`,
    originOk: oOk, originBad: oBad, originUnknown: oUnk, lost, splitsJoined: `${joined}/${L.split.length}` };
}
if (process.argv[1].endsWith("eval.mjs")) console.log(JSON.stringify(score(JSON.parse(process.argv[2] || "{}"), { verbose: !!process.env.V })));
