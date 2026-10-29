# Accuracy audit

NewsTrail's findings depend on grouping headlines into stories correctly and on picking the right first report. We check that by hand.

**Criterion.** A headline is correct if it reports the same event as its story, or a direct development of it (reactions, follow-ups, aftermath). Previews published before the event, other events involving the same person, and unrelated stories that share generic words are wrong.

| File | What it is |
|---|---|
| `sample.txt`, `judgements.json` | Tuning set: 60 stories drawn at random (seed 2026) from all stories of 22–29 Oct 2026, judged headline by headline |
| `holdout.txt`, `judgements-holdout.json` | Validation set: 40 stories (seed 777) built *after* tuning, sharing no headline with the tuning set |
| `labels.json`, `labels-holdout.json` | The same judgements keyed by article link, so they survive rebuilds |

**Re-run:**
```bash
node scripts/eval.mjs '{}' labels-holdout.json     # score any engine setting against a labelled set
node scripts/audit-report.mjs                       # publish the scores to site/audit.json
```

**History**
- 29 Oct 2026: the first audit found that about 18% of first reports were wrong, mostly previews or unrelated pieces with shared names. Fixes: tighter pruning, an origin check, the burst rule (the first report is the first of three newsrooms within six hours), and a coherence threshold. Only stories with coherence ≥ 0.4 feed the statistics.
- The coherence threshold was chosen using both sets, so the published figures are in-sample. A fresh audit on new data comes next.
