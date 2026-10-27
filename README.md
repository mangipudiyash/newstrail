# NewsTrail — watch the news travel

**Live:** https://mangipudiyash.github.io/newstrail/

NewsTrail follows every story across 21 Indian and international newsrooms and answers four questions no single news site can:

1. **Where did it start?** Which outlet reported it first, and where the event happened.
2. **How did it spread?** From the first report, to national coverage, to crossing borders, replayed on an animated world map.
3. **How was it framed?** Each outlet's headline side by side, with the words only that outlet used, its tone, and its frame (conflict, politics, economy, human, safety, justice).
4. **What did everyone agree on?** The words and facts most outlets converged on.

Across all stories, the **Patterns** page shows who breaks news first, how far behind each outlet runs, how often stories cross borders, and how long that takes.

## How it works

```
every hour (GitHub Actions)
  collect.mjs  → reads the home + world RSS feeds of 21 newsrooms → site/data/items.json   (rolling 7-day history, kept in the Actions cache)
  build.mjs    → groups headlines into stories → site/data/stories.json, s/<id>.json, patterns.json
  deploy       → GitHub Pages serves site/ as static files
```

- **Grouping:** headlines are compared with TF-IDF similarity, with headline words weighted double. Items that share at least two rare headline words within 72 hours become one story, and a story needs at least three outlets.
- **Spread:** the earliest item is the *first report*. A story goes *national* when three outlets in the origin country carry it, and *international* when an outlet in another country does.
- **Framing and tone:** small, open word lists in `scripts/build.mjs`, so anyone can audit them. Treat them as signals, not verdicts.
- **Place:** a gazetteer of about 180 places (`scripts/places.mjs`) puts the event on the map, and each outlet sits at its newsroom.

No servers, no database, no paid APIs. Visitors' browsers only load NewsTrail's own static files and never contact the newsrooms.

## Sources

NDTV · Times of India · Hindustan Times · The Hindu · India Today · Indian Express · News18 · Economic Times · Zee News · Mint · BBC · The Guardian · Sky News · Al Jazeera · New York Times · CNN · NPR · Fox News · DW · France 24 · ABC Australia · South China Morning Post

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
