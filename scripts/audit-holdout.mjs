// Draw a fresh validation sample: stories that share no headline with the tuning set (audit/labels.json).
import { readFile } from "node:fs/promises";
import { rng } from "./stats.mjs";
const n = +(process.argv[2] || 40), seed = +(process.argv[3] || 777);
const L = JSON.parse(await readFile(new URL("../audit/labels.json", import.meta.url), "utf8")), used = new Set(L.stories.flatMap(s => s.items.map(i => i.link)));
const { stories } = JSON.parse(await readFile(new URL("../site/data/stories.json", import.meta.url), "utf8"));
const pool = []; for (const s of stories) { const f = JSON.parse(await readFile(new URL(`../site/data/s/${s.id}.json`, import.meta.url), "utf8")); if (!f.coverage.some(c => used.has(c.link))) pool.push(f); }
const rand = rng(seed), pick = []; while (pick.length < Math.min(n, pool.length)) pick.push(pool.splice((rand() * pool.length) | 0, 1)[0]);
console.error(`pool of unseen stories: ${pool.length + pick.length}`);
for (const [k, f] of pick.entries()) { console.log(`\n#${k + 1} ${f.id} — ${f.headline}`); f.coverage.forEach((c, i) => console.log(`  ${i}. [${c.outlet}] ${c.title}`)); }
