// Turn the hand judgements (story number + headline index in audit/sample.txt) into labels keyed by article link,
// so the test set survives rebuilds. Writes audit/labels.json.
import { readFile, writeFile } from "node:fs/promises";
// node scripts/make-labels.mjs [judgements.json sample.txt labels.json]
const [jf = "judgements.json", sf = "sample.txt", out = "labels.json"] = process.argv.slice(2);
const J = JSON.parse(await readFile(new URL(`../audit/${jf}`, import.meta.url), "utf8"));
const txt = await readFile(new URL(`../audit/${sf}`, import.meta.url), "utf8");
const ids = [...txt.matchAll(/^#(\d+) (\w+) —/gm)].map(m => [+m[1], m[2]]);
const stories = [];
for (const [k, id] of ids) {
  const s = JSON.parse(await readFile(new URL(`../site/data/s/${id}.json`, import.meta.url), "utf8"));
  const wrong = new Set(J.wrong[k] || []);
  stories.push({ k, id, headline: s.headline, items: s.coverage.map((c, i) => ({ link: c.link, outlet: c.outlet, title: c.title, ok: !wrong.has(i) })), originOk: !wrong.has(0) });
}
const split = (J.same_event_split || []).map(([a, b]) => [stories.find(s => s.k === a), stories.find(s => s.k === b)].map(s => s.items.filter(i => i.ok).map(i => i.link)));
await writeFile(new URL(`../audit/${out}`, import.meta.url), JSON.stringify({ criterion: J.criterion, reviewed: J.reviewed, sample: J.sample, stories, split }, null, 1));
const n = stories.reduce((a, s) => a + s.items.length, 0), w = stories.reduce((a, s) => a + s.items.filter(i => !i.ok).length, 0);
console.log(`${stories.length} stories, ${n} headlines, ${w} wrong, ${stories.filter(s => !s.originOk).length} wrong origins`);
