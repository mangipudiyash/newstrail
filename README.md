# NewsTrail — watch the news travel

**Live:** https://mangipudiyash.github.io/newstrail/

NewsTrail follows every story across 42 newsrooms in 22 countries and answers four questions no single news site can:

1. **Where did it start?** Which outlet reported it first, and where the event happened.
2. **How did it spread?** From the first report, to national coverage, to crossing borders, replayed on an animated world map.
3. **How was it framed?** Each outlet's headline side by side, with the words only that outlet used, its tone, and its frame (conflict, politics, economy, human, safety, justice).
4. **What did everyone agree on?** The words and facts most outlets converged on.

Across all stories, the **Patterns** page shows who breaks news first, how far behind each outlet runs, how often stories cross borders, and how long that takes.

## Statistical rigour

- **Accuracy is audited by hand.** We check stories headline by headline, with separate tuning and validation sets. Results are published on the site's Method page and in [`audit/`](audit/README.md).
- **Every share has a 95% interval.** Headlines about one story aren't independent, so intervals resample whole stories (a cluster bootstrap). Numbers with too little data are marked *thin data*.
- **The first report is the start of the burst** (three newsrooms within six hours), so previews and background pieces aren't credited as breaking the news.
- **Rankings are fair.** "First to report" only counts stories that broke after every outlet was being tracked, and only well-grouped stories (coherence ≥ 0.4) feed the statistics.
- **Hot zones** give every newsroom one equal vote, so outlets with long feeds can't dominate.
- **Open data.** Weekly CSVs are published (links, times and measurements only), and every completed week is archived in [`archive/`](archive/).

## How it works

```
every hour (GitHub Actions)
  collect.mjs  → reads the home + world RSS feeds of 42 newsrooms → site/data/items.json   (28-day history, kept in the Actions cache)
  build.mjs    → engine.mjs groups headlines into stories; stats.mjs adds intervals → stories, patterns, compare, weeks/, csv/
  deploy       → GitHub Pages serves site/ as static files
```

- **Grouping:** headlines are compared with TF-IDF similarity, with headline words weighted double. Items that share at least two rare headline words within 72 hours become one story, and a story needs at least three outlets.
- **Spread:** the earliest item is the *first report*. A story goes *national* when three outlets in the origin country carry it, and *international* when an outlet in another country does.
- **Framing and tone:** small, open word lists in `scripts/build.mjs`, so anyone can audit them. Treat them as signals, not verdicts.
- **Place:** a gazetteer of about 180 places (`scripts/places.mjs`) puts the event on the map, and each outlet sits at its newsroom.

No servers, no database, no paid APIs. Visitors' browsers only load NewsTrail's own static files and never contact the newsrooms.

## Sources

**India:** NDTV · Times of India · Hindustan Times · The Hindu · India Today · Scroll.in · News18 · Economic Times · Zee News · Mint · Telangana Today · Mid-day · Free Press Journal · Greater Kashmir · Sentinel Assam  
**United States:** New York Times · NPR · Fox News · PBS NewsHour  
**United Kingdom:** BBC · The Guardian · Sky News  
**France:** France 24 · Euronews  
**Argentina:** Buenos Aires Times  
**Australia:** ABC Australia  
**Congo:** Africanews  
**Egypt:** Egypt Independent  
**Germany:** DW  
**Hong Kong:** South China Morning Post  
**Ireland:** Irish Times  
**Israel:** Haaretz  
**Japan:** Japan Times  
**Kenya:** The Standard  
**New Zealand:** RNZ  
**Nigeria:** Vanguard  
**Qatar:** Al Jazeera  
**Singapore:** Straits Times  
**South Korea:** Korea Herald  
**UAE:** The National  
**Uganda:** Daily Monitor  
**Uruguay:** MercoPress

To add an outlet, add one line to `scripts/outlets.mjs`.

## Fair use

NewsTrail only uses the public RSS feeds outlets publish for syndication. It shows the headline and the outlet's own short summary, always linked to the original article, and never copies articles. The collector reads each feed once an hour and identifies itself with a clear User-Agent.

## Run it locally

Requires Node 20+.

```bash
npm run update   # collect + build
npm run serve    # http://localhost:8877
```

## Limits, stated honestly

- "First" means first in the feeds NewsTrail reads, not necessarily first anywhere. Some feeds list 200 headlines and others only 10, so the first-to-report ranking becomes fair after a few days of hourly history.
- "Consensus" is what the media converged on, not a measure of public opinion.

MIT licensed.
