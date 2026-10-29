// Draw a reproducible random sample of stories for a hand audit: is every headline in each story about the same event?
// node scripts/audit-sample.mjs 60 > audit/sample.txt   (then record judgements in audit/labels.json)
import { readFile } from "node:fs/promises";
import { rng } from "./stats.mjs";
const n = +(process.argv[2] || 60), seed = +(process.argv[3] || 2026);
const { stories } = JSON.parse(await readFile(new URL("../site/data/stories.json", import.meta.url), "utf8"));
const rand = rng(seed), pool = [...stories], pick = [];
while (pick.length < Math.min(n, pool.length)) pick.push(pool.splice((rand() * pool.length) | 0, 1)[0]);
for (const [k, s] of pick.entries()) {
  const f = JSON.parse(await readFile(new URL(`../site/data/s/${s.id}.json`, import.meta.url), "utf8"));
  console.log(`\n#${k + 1} ${s.id} — ${f.headline}`);
  f.coverage.forEach((c, i) => console.log(`  ${i}. [${c.outlet}] ${c.title}`));
}
