// Coverage vs attention: links each story to the searches and Wikipedia reading it caused, then compares the two.
// Matching is deliberately strict — a missed match only makes a story look less searched, a wrong match invents a finding:
//   • a trending search matches a story when Google linked it to one of the story's own articles, or when it has two or more
//     words, isn't a fixture ("barcelona vs aston villa"), every word appears in the story's headlines, one of those words is rare (found in at most 3 stories that week) and the news
//     Google linked to the search shares at least two rare words with the story;
//   • a Wikipedia article matches when every word of its title appears in the story's headlines, one is rare, a one-word title
//     is a single word (not "Ali G: Who Iz I?" reduced to "ali") found in at least two headlines and not a country, a film or TV
//     title only matches if the story mentions film/series, and the article spiked that day (at least 3× its usual daily views
//     over the last four weeks), so always-popular pages (Google Search, Donald Trump) don't soak up credit;
//   • an event article ("2026 Israeli legislative election") matches when its country is named in the story and its event words
//     ("election") appear in its headlines; when the event was split into several stories, the closest one gets the views.
// Each search or article-day goes to at most one story — the best match — so nothing is counted twice.
import { terms as T0 } from "./engine.mjs";
import { countriesIn } from "./countries.mjs";
import { byId } from "./outlets.mjs";
import { wilson, bootstrap } from "./stats.mjs";

const H = 3600e3, D = 24 * H;
// Google Trends region code for every newsroom country
export const GEO = { India: "IN", "United Kingdom": "GB", Qatar: "QA", "United States": "US", Germany: "DE", France: "FR", Australia: "AU",
  "Hong Kong": "HK", Singapore: "SG", Japan: "JP", "South Korea": "KR", Ireland: "IE", "New Zealand": "NZ", Argentina: "AR", Uruguay: "UY",
  Congo: "CD", Nigeria: "NG", Uganda: "UG", Kenya: "KE", Egypt: "EG", UAE: "AE", Israel: "IL" };
const COUNTRY = Object.fromEntries(Object.entries(GEO).map(([c, g]) => [g, c]));
const fold = s => String(s).normalize("NFD").replace(/\p{M}/gu, "");             // Mbappé = Mbappe
const terms = s => T0(fold(s));
const norm = u => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase(); } catch { return ""; } };
const day = t => new Date(t).toISOString().slice(0, 10);
const title = a => { try { return decodeURIComponent(a).replace(/_/g, " "); } catch { return a.replace(/_/g, " "); } };
const FIXTURE = /\s(vs?\.?|x|-|–|—)\s/i;                                   // "team a vs team b" is a match, not a story
const MEDIA = /\b(film|series|album|song|novel|band|game|musical|book|soundtrack)\b/i;
const QUAL = new Set(["general", "legislative", "parliamentary", "presidential", "national", "federal", "state", "local", "municipal", "regional"]);
const pre = w => w.slice(0, 5);
/** How a Wikipedia title can match: { kind: "plain", words } or { kind: "event", countries, words }, or null if it can't. */
function wikiKey(a) {
  const t = title(a), paren = (t.match(/\(([^)]*)\)/) || [])[1] || "", base = t.replace(/\([^)]*\)/g, " ").trim();
  const y = base.match(/^(20\d\d)\s+(.+)$/);
  if (y) {                                                                     // "2026 Spain train collision"
    const cs = countriesIn(y[2]); if (!cs.length) return null;
    const words = terms(y[2]).filter(w => !countriesIn(w).length && !QUAL.has(w));
    return words.length ? { kind: "event", year: +y[1], countries: cs, words: words.map(pre) } : null;
  }
  const words = terms(base); if (!words.length) return null;
  if (words.length === 1 && (fold(base).split(/[^\p{L}\p{N}]+/u).filter(Boolean).length > 1 || countriesIn(base).length)) return null;
  const media = paren.match(MEDIA);
  return { kind: "plain", words, need: media ? terms(media[1]) : [] };
}

/** Spearman rank correlation (average ranks for ties). */
function spearman(xs, ys) {
  const rank = v => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const a = rank(xs), b = rank(ys), n = a.length, ma = (n - 1) / 2;
  let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - ma); sa += (a[i] - ma) ** 2; sb += (b[i] - ma) ** 2; }
  return sa && sb ? s / Math.sqrt(sa * sb) : null;
}

/**
 * stories: from engine.analyze (with coverage). raw: cache/attention-raw.json. Returns per-story attention (keyed by id) and the
 * findings for [start, end). Trend findings only count searches seen while collection was running (raw.trendStart onwards).
 */
export function attentionFor(stories, raw, start, end) {
  const S = stories.map(s => {
    const cov = s.coverage.filter(c => !c.before), heads = cov.map(c => new Set(terms(c.title)));
    const all = new Set(heads.flatMap(h => [...h]));
    return { s, all, heads, links: new Set(cov.map(c => norm(c.link))), homes: new Set(cov.map(c => byId[c.outlet].country)), pres: new Set([...all].map(pre)), named: new Set([...s.subject, ...cov.flatMap(c => countriesIn(c.title))]),
      from: s.first - 12 * H, to: Math.max(s.last, s.first) + 48 * H };
  });
  const df = new Map(); for (const x of S) for (const w of x.all) df.set(w, (df.get(w) || 0) + 1);
  const rare = w => (df.get(w) || 0) <= 3;
  const per = new Map(S.map(x => [x.s.id, { trends: [], wiki: [] }]));

  // ── searches ──
  const T = (raw?.trends || []).filter(t => t.t >= start && t.t < end);
  for (const t of T) {
    const q = terms(t.q), urls = new Set(t.news.map(n => norm(n.u))), nt = new Set(t.news.flatMap(n => terms(n.title)));
    let best = null, bs = 0;
    for (const x of S) {
      if (t.t < x.from || t.t > x.to) continue;
      let score = 0;
      if ([...urls].some(u => x.links.has(u))) score = 100;
      else if (q.length >= 2 && !FIXTURE.test(t.q) && q.every(w => x.all.has(w)) && q.some(rare)) {
        const shared = [...nt].filter(w => x.all.has(w) && rare(w)).length;
        if (shared >= 2) score = shared;
      }
      if (score > bs) { bs = score; best = x; }
    }
    if (best) { t.story = best.s.id; per.get(best.s.id).trends.push({ geo: t.geo, q: t.q, traffic: t.traffic, t: t.t, home: best.homes.has(COUNTRY[t.geo]) }); }
  }

  // ── Wikipedia ──
  // usual level: median daily views over every day held; on a day an article missed the top list it had at most that list's last entry
  const days = Object.keys(raw?.wiki || {}).sort(), floor = {}, hist = new Map();
  for (const d of days) { floor[d] = raw.wiki[d].at(-1)?.[1] || 0; for (const [a, v] of raw.wiki[d]) { if (!hist.has(a)) hist.set(a, {}); hist.get(a)[d] = v; } }
  const usual = new Map(), median = a => { if (!usual.has(a)) { const v = hist.get(a), s = days.map(d => v[d] ?? floor[d]).sort((x, y) => x - y); usual.set(a, s[s.length >> 1]); } return usual.get(a); };
  const spike = (a, v) => days.length >= 7 && v >= 3 * median(a);
  const keys = new Map();
  for (const d of days) {
    const t0 = Date.parse(d + "T00:00:00Z"); if (t0 < start - D || t0 >= end) continue;
    for (const [a, views] of raw.wiki[d]) {
      if (!spike(a, views)) continue;
      if (!keys.has(a)) keys.set(a, wikiKey(a));
      const k = keys.get(a); if (!k) continue;
      let best = null, bs = 0;
      for (const x of S) {
        if (t0 + D < x.from || t0 > x.to) continue;
        let hits = 0;
        if (k.kind === "plain") {
          if (!k.words.some(rare) || !k.words.every(v => x.all.has(v)) || !k.need.every(v => x.all.has(v))) continue;
          hits = x.heads.filter(h => k.words.every(v => h.has(v))).length;
          if (k.words.length === 1 && hits < 2) continue;
        } else {
          if (new Date(x.s.first).getUTCFullYear() !== k.year || !k.countries.every(c => x.named.has(c))) continue;
          if (!k.words.every(w => x.pres.has(w))) continue;
          hits = x.heads.filter(h => k.words.every(w => [...h].some(v => pre(v) === w))).length;
        }
        if (hits > bs) { bs = hits; best = x; }
      }
      if (best) per.get(best.s.id).wiki.push({ a, d, views });
    }
  }

  // ── per story ──
  const out = {};
  for (const x of S) {
    const p = per.get(x.s.id), geos = [...new Set(p.trends.map(t => t.geo))];
    const views = p.wiki.reduce((a, w) => a + w.views, 0);
    if (!geos.length && !views) continue;
    const articles = Object.entries(p.wiki.reduce((m, w) => (m[w.a] = (m[w.a] || 0) + w.views, m), {})).sort((a, b) => b[1] - a[1]);
    out[x.s.id] = { searchedIn: geos.map(g => COUNTRY[g]), searches: p.trends.sort((a, b) => (b.traffic || 0) - (a.traffic || 0)).slice(0, 8),
      wikiViews: views, articles: articles.slice(0, 4).map(([a, v]) => ({ a, title: title(a), views: v })),
      ignoredAtHome: [...new Set(p.trends.filter(t => !t.home).map(t => COUNTRY[t.geo]))] };
  }

  // ── findings (well-grouped stories only, like every other NewsTrail statistic) ──
  const conf = S.filter(x => x.s.confident);
  const sig = x => !!out[x.s.id];
  const k = conf.filter(sig).length;
  const big = [...conf].sort((a, b) => b.s.outlets - a.s.outlets).slice(0, Math.max(10, Math.round(conf.length * .1)));
  const kb = big.filter(sig).length;
  const v = x => out[x.s.id]?.wikiViews || 0;
  const rho = conf.length >= 20 ? spearman(conf.map(x => x.s.outlets), conf.map(v)) : null;
  const rhoCI = rho == null ? null : bootstrap(conf, smp => { const r = spearman(smp.map(x => x.s.outlets), smp.map(v)); return r == null ? null : r * 100; });
  const trendFrom = Math.max(start, raw?.trendStart ?? start);
  const countries = Object.entries(GEO).map(([c, g]) => {
    const mine = T.filter(t => t.geo === g), m = mine.filter(t => t.story);
    const home = m.filter(t => per.get(t.story).trends.find(x => x.geo === g && x.q === t.q)?.home).length;
    return { country: c, searches: mine.length, matched: m.length, share: mine.length ? +(m.length / mine.length * 100).toFixed(1) : null, ci: wilson(m.length, mine.length),
      homeCovered: m.length ? +(home / m.length * 100).toFixed(1) : null, homeCI: wilson(home, m.length) };
  }).filter(c => c.searches).sort((a, b) => b.searches - a.searches);
  const brief = x => ({ id: x.s.id, headline: x.s.headline, outlets: x.s.outlets, countries: x.s.countries.length, ...out[x.s.id] && { searchedIn: out[x.s.id].searchedIn, wikiViews: out[x.s.id].wikiViews, top: out[x.s.id].articles[0]?.title } });
  return {
    stories: out,
    findings: {
      from: start, to: end, trendFrom, searches: T.length, wikiDays: days.filter(d => { const t = Date.parse(d); return t >= start - D && t < end; }).length,
      withSignal: { k, n: conf.length, share: conf.length ? +(k / conf.length * 100).toFixed(1) : null, ci: wilson(k, conf.length) },
      mostCovered: { k: kb, n: big.length, share: big.length ? +(kb / big.length * 100).toFixed(1) : null, ci: wilson(kb, big.length) },
      rho: rho == null ? null : +rho.toFixed(2), rhoCI: rhoCI && rhoCI.map(r => +(r / 100).toFixed(2)),
      countries,
      mostRead: conf.filter(x => v(x)).sort((a, b) => v(b) - v(a)).slice(0, 10).map(brief),
      mostSearched: conf.filter(x => out[x.s.id]?.searchedIn.length).sort((a, b) => out[b.s.id].searchedIn.length - out[a.s.id].searchedIn.length || v(b) - v(a)).slice(0, 10).map(brief),
      coveredNotSought: big.filter(x => !sig(x)).slice(0, 8).map(brief),
      soughtNotCovered: conf.filter(x => out[x.s.id]?.ignoredAtHome.length).sort((a, b) => out[b.s.id].ignoredAtHome.length - out[a.s.id].ignoredAtHome.length).slice(0, 8)
        .map(x => ({ ...brief(x), ignoredAtHome: out[x.s.id].ignoredAtHome })),
    },
  };
}
