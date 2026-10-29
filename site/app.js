// NewsTrail front end: a tiny hash router over static JSON built hourly by scripts/build.mjs.
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const app = $("#app");
const cache = {};
const get = p => cache[p] ??= fetch("data/" + p, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
let O = {};                                                     // outlets by id
const COL = { origin: "#FF5A4E", national: "#2DD4BF", international: "#9B8CFF" };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── formatting ────────────────────────────────────────────────────────────────────────────────
const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const dur = m => m == null ? "—" : m < 1 ? "same minute" : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + "m" : ""}`.trim() : `${Math.floor(m / 1440)}d ${Math.round((m % 1440) / 60)}h`;
const clock = t => new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ob = id => `<span class="ob" style="--c:${O[id]?.color || "#888"}"><i></i>${esc(O[id]?.name || id)}</span>`;
const scopeOf = (id, originId) => id === originId ? "origin" : O[id].country === O[originId].country ? "national" : "international";
const ci = r => r ? `${r[0]}–${r[1]}%` : "";
const thin = ok => ok ? "" : `<span class="thin" title="Too few independent stories for a firm number — read as indicative">thin data</span>`;
// a bar with a 95% interval whisker; v and r in the same units, scaled by max
const wbar = (v, r, max, c) => `<div class="t wb"><i style="--w:${Math.min(100, v / max * 100)}%;--c:${c}"></i>${r ? `<u style="left:${Math.min(100, r[0] / max * 100)}%;width:${Math.max(.5, Math.min(100, r[1] / max * 100) - Math.min(100, r[0] / max * 100))}%"></u>` : ""}</div>`;
const toneBar = v => `<span class="tone" title="Headline tone ${v}"><span class="bar" style="--v:${v}"><i></i></span>${v > .15 ? "positive" : v < -.15 ? "negative" : "neutral"}</span>`;

// ── map ───────────────────────────────────────────────────────────────────────────────────────
let landP;
const land = () => landP ??= fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json").then(r => r.json()).then(w => topojson.feature(w, w.objects.land));

async function makeMap(el, { width = 1000, height = 620, focus } = {}) {
  const geo = await land();
  const proj = d3.geoNaturalEarth1();
  proj.fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
  if (focus) { const k0 = proj.scale(); proj.fitExtent([[70, 80], [width - 210, height - 120]], focus); if (proj.scale() > k0 * 3.2) {   // all in one region: cap the zoom and centre on it
    proj.scale(k0 * 3.2).translate([width / 2, height / 2]); const [x, y] = proj(d3.geoCentroid(focus)); proj.translate([width - x, height - 20 - y]); } }
  const path = d3.geoPath(proj);
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid slice");
  svg.append("path").attr("class", "grat").attr("d", path(d3.geoGraticule10()));
  svg.append("path").attr("class", "land").attr("d", path(geo));
  // outlets that share a city fan out in a small ring so every dot stays visible
  const pos = {}; const groups = [];
  for (const o of Object.values(O)) {
    const p = proj([o.lon, o.lat]); let g = groups.find(g => Math.hypot(g.x - p[0], g.y - p[1]) < 16);
    if (!g) groups.push(g = { x: p[0], y: p[1], ids: [] }); g.ids.push(o.id);
  }
  for (const g of groups) g.ids.forEach((id, i) => { const n = g.ids.length, r = n > 1 ? 8 + n * 2.2 : 0, a = i / n * 2 * Math.PI - Math.PI / 2; pos[id] = [g.x + r * Math.cos(a), g.y + r * Math.sin(a)]; });
  return { svg, proj, pos, width, height, layers: { arcs: svg.append("g"), rings: svg.append("g"), nodes: svg.append("g"), top: svg.append("g") } };
}
const arcD = ([x0, y0], [x1, y1]) => { const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy); if (d < 3) return `M${x0},${y0}m0,0a14,14 0 1,1 0.1,0`; const h = Math.min(160, d * .28); return `M${x0},${y0}Q${(x0 + x1) / 2 - dy / d * h},${(y0 + y1) / 2 + dx / d * h} ${x1},${y1}`; };

// replay position of each outlet: half by arrival order, half by log time — minutes and days both stay readable
const pace = s => { const max = Math.max(1, ...s.coverage.map(c => c.lag)), n = Math.max(1, s.coverage.length - 1); return c => { const i = s.coverage.indexOf(c); return (.5 * i / n + .5 * Math.log1p(c.lag) / Math.log1p(max)) * .9; }; };
// one story's trail on a map; returns render(u) for u ∈ [0,1]
function trail(m, s, { labels = true, onHit } = {}) {
  s = { ...s, coverage: s.coverage.filter(c => !c.before) };                    // replay starts when the news broke
  const u = pace(s);
  const o0 = s.origin.outlet, p0 = m.pos[o0];
  const items = s.coverage.map((c, i) => ({ c, i, u: c.outlet === o0 ? 0 : u(c), kind: scopeOf(c.outlet, o0), p: m.pos[c.outlet] }));
  const arcs = m.layers.arcs.selectAll(null).data(items.filter(d => d.kind !== "origin")).join("path").attr("class", "arc")
    .attr("d", d => arcD(p0, d.p)).attr("stroke", d => COL[d.kind]).each(function () { this._len = this.getTotalLength(); }).attr("stroke-dasharray", function () { return this._len; });
  const rings = m.layers.rings.selectAll(null).data(items).join("circle").attr("class", "ring").attr("cx", d => d.p[0]).attr("cy", d => d.p[1]).attr("stroke", d => COL[d.kind]);
  const nodes = m.layers.nodes.selectAll(null).data(items).join("g").attr("class", "node").attr("transform", d => `translate(${d.p})`);
  nodes.append("circle").attr("class", "dot").attr("fill", d => O[d.c.outlet].color);
  if (labels) nodes.append("text").attr("x", 9).attr("y", 3.5).text(d => O[d.c.outlet].name);
  if (s.epicentre) {                                             // where it happened → who reported it first
    const e = m.proj([s.epicentre.lon, s.epicentre.lat]);
    const g = m.layers.top.append("g").attr("class", "epi");
    g.append("path").attr("d", arcD(e, p0)).attr("fill", "none").attr("stroke", "#FFB547").attr("stroke-dasharray", "3 4").attr("opacity", .7);
    g.append("circle").attr("cx", e[0]).attr("cy", e[1]).attr("r", 6).attr("fill", "#FFB547");
    g.append("circle").attr("cx", e[0]).attr("cy", e[1]).attr("r", 12).attr("fill", "none").attr("stroke", "#FFB547").attr("opacity", .5);
    g.append("text").attr("x", e[0]).attr("y", e[1] - 16).attr("text-anchor", "middle").text(s.epicentre.name.toUpperCase());
  }
  let hit = -1;
  return v => {
    const k = d => Math.max(0, Math.min(1, (v - d.u) / .07));
    arcs.attr("stroke-dashoffset", function (d) { return this._len * (1 - k(d)); }).attr("opacity", d => k(d) ? .9 : 0);
    nodes.select("circle").attr("r", d => v >= d.u ? (d.kind === "origin" ? 7 : 5) + 3 * (1 - Math.min(1, (v - d.u) / .1)) : 3).attr("opacity", d => v >= d.u ? 1 : .25);
    nodes.select("text").attr("opacity", d => v >= d.u + .02 ? 1 : 0);
    rings.attr("r", d => { const t = (v - d.u) / .12; return t > 0 && t < 1 ? 6 + 26 * t : 0; }).attr("opacity", d => 1 - Math.min(1, Math.max(0, (v - d.u) / .12)));
    const last = items.filter(d => v >= d.u).at(-1)?.i ?? -1;
    if (last !== hit) { hit = last; onHit?.(items[last]); }
  };
}

// ── home ──────────────────────────────────────────────────────────────────────────────────────
let heroStop = () => {};
async function home(filter = "all") {
  const [{ stories, updated }, pat] = await Promise.all([get("stories.json"), get("patterns.json")]);
  const F = { all: () => true, india: s => O[s.origin.outlet].scope === "IN", world: s => O[s.origin.outlet].scope === "INTL", crossed: s => s.stages.some(x => x.key === "international") };
  const list = stories.filter(F[filter]);
  app.innerHTML = `
  <div class="hero"><div class="map" id="hm"></div><div class="wrap">
    <h1>Watch the news <em>travel.</em></h1>
    <p>NewsTrail follows every story across ${Object.keys(O).length} Indian and international newsrooms — who reported it first, how it spread from local to worldwide, and how each outlet framed it.</p>
    <div class="stats">
      <div class="stat"><b>${pat.stories}</b><span>stories traced</span></div>
      <div class="stat"><b>${Math.round(pat.crossBorder.share)}%</b><span>crossed borders · ${ci(pat.crossBorder.ci)}</span></div>
      <div class="stat"><b>${dur(pat.crossBorder.medianMinutes)}</b><span>median to go global</span></div>
      <div class="stat"><b>${pat.items.toLocaleString()}</b><span>headlines read</span></div>
    </div>
    <div class="legend"><span><i style="background:${COL.origin}"></i>first report</span><span><i style="background:${COL.national}"></i>same country</span><span><i style="background:${COL.international}"></i>crossed a border</span><span><i style="background:#FFB547"></i>where it happened</span></div>
  </div></div>
  <section><div class="wrap">
    <div class="sh"><h2>Spreading now</h2><p>Ranked by how far and how fast each story travelled.</p>
      <div class="filters">${[["all", "All"], ["india", "Born in India"], ["world", "Born abroad"], ["crossed", "Crossed borders"]].map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div></div>
    <div class="grid">${list.map(card).join("") || `<div class="empty">No stories in this view yet.</div>`}</div>
  </div></section>`;
  app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => home(b.dataset.f));
  heroMap(stories.slice(0, 14));
}
function card(s, i) {
  const after = s.trail.filter(t => t[1] >= 0), max = Math.max(1, ...after.map(t => t[1]));
  const x = lag => lag < 0 ? 4 : 10 + Math.log1p(lag) / Math.log1p(max) * 80;
  return `<a class="card" style="--i:${i}" href="#/s/${s.id}">
    <div class="meta"><span class="first">● First</span>${ob(s.origin.outlet)}<span>· ${ago(s.first)}</span>${s.confident ? "" : `<span class="loose" title="Headlines in this story are loosely related; it is not used in the statistics">loosely grouped</span>`}</div>
    <h3>${esc(s.headline)}</h3>
    <div class="strip"><div class="ax"></div>${s.trail.map(([o, lag], k) => `<i class="${o === s.origin.outlet && lag === 0 ? "o" : lag < 0 ? "pre" : ""}" title="${esc(O[o].name)} · ${lag < 0 ? "before the news broke" : "+" + dur(lag)}" style="left:${x(lag)}%;--c:${lag < 0 ? "#5B6178" : COL[scopeOf(o, s.origin.outlet)]};--k:${k}"></i>`).join("")}</div>
    <div class="stages">${s.stages.map(st => `<span class="stg ${st.key}">${st.key === "origin" ? "Origin" : esc(st.label)} <b>${st.key === "origin" ? esc(O[st.outlet].name) : "+" + dur(Math.round((st.t - s.first) / 60e3))}</b></span>`).join("")}</div>
    <div class="foot"><span>${s.outlets} outlets · ${s.countries.length} ${s.countries.length > 1 ? "countries" : "country"}${s.epicentre ? " · " + esc(s.epicentre.name) : ""}</span>${toneBar(s.tone.avg)}</div>
  </a>`;
}
async function heroMap(top) {
  const el = $("#hm"); if (!el) return;
  const m = await makeMap(el, { width: 1400, height: 700 });
  const full = await Promise.all(top.map(s => get(`s/${s.id}.json`)));
  let alive = true, k = 0; heroStop = () => alive = false;
  m.svg.style("opacity", .55);
  const cycle = () => {
    if (!alive || !el.isConnected) return;
    for (const L of Object.values(m.layers)) L.selectAll("*").attr("opacity", .18).transition().duration(1200).attr("opacity", 0).remove();
    const render = trail(m, full[k++ % full.length], { labels: false });
    const t0 = performance.now();
    const step = now => { if (!alive || !el.isConnected) return; const v = Math.min(1, (now - t0) / 2600); render(v); if (v < 1) requestAnimationFrame(step); else setTimeout(cycle, 900); };
    reduce ? (render(1), setTimeout(cycle, 4000)) : requestAnimationFrame(step);
  };
  cycle();
}

// ── story ─────────────────────────────────────────────────────────────────────────────────────
async function story(id) {
  const s = await get(`s/${id}.json`);
  const pre = s.coverage.filter(c => c.before); s.coverage = s.coverage.filter(c => !c.before);   // the map replays from the moment the news broke
  const o0 = s.origin.outlet, total = Math.max(1, ...s.coverage.map(c => c.lag)), P = pace(s);
  const fsize = sh => `${14 + sh * 22}px`;
  const hl = c => { let h = esc(c.title); for (const w of c.angle) h = h.replace(new RegExp(`\\b(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i"), "<mark>$1</mark>"); return h; };
  document.title = s.headline + " — NewsTrail";
  app.innerHTML = `<div class="wrap sp">
    <a class="back" href="#/">← All stories</a>
    <h1>${esc(s.headline)}</h1>
    <div class="meta"><span class="first">● First reported by</span>${ob(o0)}<span>· ${clock(s.first)}</span><span>· ${s.outlets} outlets in ${s.countries.length} ${s.countries.length > 1 ? "countries" : "country"} over ${dur(Math.round(s.span / 60e3))}</span>${s.confident ? "" : `<span class="loose">loosely grouped — not used in the statistics</span>`}</div>
    <div class="stage">
      <div class="mapbox" id="sm"><div class="now"><div class="pill" id="np"></div></div>
        <div class="hud"><button class="play" id="pl" aria-label="Replay the spread"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg></button>
        <div class="scrub" id="sc"><div class="fill" id="sf"></div>${s.coverage.map(c => `<i style="left:${P(c) * 100}%;--c:${COL[scopeOf(c.outlet, o0)]}"></i>`).join("")}<span class="clock" id="ck">+0m</span></div></div>
      </div>
      <div class="panel">
        <h4>How it travelled</h4>
        <div class="steps">${s.stages.map(st => `<div class="step" style="--c:${COL[st.key]}"><div class="b"></div><div><b>${esc(st.label)}</b><span>${esc(O[st.outlet].name)} · ${st.key === "origin" ? clock(st.t) : "+" + dur(Math.round((st.t - s.first) / 60e3)) + " after the first report"}</span></div></div>`).join("")}
          ${s.epicentre ? `<div class="step" style="--c:#FFB547"><div class="b"></div><div><b>Where it happened</b><span>${esc(s.epicentre.name)}</span></div></div>` : ""}</div>
        <h4>What everyone agreed on</h4>
        <div class="cons">${s.consensus.map(c => `<span style="--fs:${fsize(c.share)}" title="in ${Math.round(c.share * 100)}% of headlines">${esc(c.w)}</span>`).join("")}</div>
        <div class="quote">${esc(s.headline)}</div>
        <h4>How it was framed</h4>
        <div class="bars">${s.frames.slice(0, 5).map((f, k) => `<div class="r" style="--k:${k}"><span>${f.f}</span><div class="t"><i style="--w:${f.n / s.outlets * 100}%"></i></div><span>${f.n}</span></div>`).join("") || `<span class="note">No strong framing signals.</span>`}</div>
      </div>
    </div>
    ${pre.length ? `<section><div class="sh"><h2>Before the news broke</h2><p>Earlier pieces on the same subject — previews and background. The first report is the start of the burst: the first of three newsrooms within six hours.</p></div>
      <div class="trail">${pre.map(c => `<a class="tr" href="${esc(c.link)}" target="_blank" rel="noopener"><span class="lag">−${dur(-c.lag)}</span>${ob(c.outlet)}<span class="h"><b>${esc(c.title)}</b></span></a>`).join("")}</div></section>` : ""}
    <section><div class="sh"><h2>The trail</h2><p>Every outlet's first headline, in the order it appeared.</p></div>
      <div class="trail">${s.coverage.map((c, i) => `<a class="tr" id="tr${i}" href="${esc(c.link)}" target="_blank" rel="noopener"><span class="lag ${i ? "" : "o"}">${i ? "+" + dur(c.lag) : "FIRST"}</span>${ob(c.outlet)}<span class="h"><b>${esc(c.title)}</b>${c.summary ? `<small>${esc(c.summary)}</small>` : ""}</span></a>`).join("")}</div>
    </section>
    <section><div class="sh"><h2>Same story, different angles</h2><p>Highlighted words appear in only that outlet's headline.</p></div>
      <div class="frames">${s.coverage.map(c => `<div class="fc" style="--c:${O[c.outlet].color}"><div class="meta">${ob(c.outlet)}<span>· ${c.lag ? "+" + dur(c.lag) : "first"}</span></div><div class="h">${hl(c)}</div><div class="tags">${c.frames.map(f => `<span>${f}</span>`).join("")}</div><div class="row">${toneBar(c.tone)}<a href="${esc(c.link)}" target="_blank" rel="noopener">Read at ${esc(O[c.outlet].name)} ↗</a></div></div>`).join("")}</div>
    </section>
  </div>`;

  const pts = [...s.coverage.map(c => [O[c.outlet].lon, O[c.outlet].lat]), ...(s.epicentre ? [[s.epicentre.lon, s.epicentre.lat]] : [])];
  const m = await makeMap($("#sm"), { width: 1000, height: 625, focus: { type: "MultiPoint", coordinates: pts } });
  m.svg.classed("big", true);
  const np = $("#np"), ck = $("#ck"), sf = $("#sf");
  const render = trail(m, s, { onHit: d => { if (!d) return np.classList.remove("show"); np.innerHTML = `<small>${esc(O[d.c.outlet].name)} · ${d.c.lag ? "+" + dur(d.c.lag) : "first report"}</small><b>${esc(d.c.title)}</b>`; np.classList.add("show"); document.querySelectorAll(".tr").forEach(r => r.style.background = ""); const r = $("#tr" + d.i); if (r) r.style.background = "var(--bg2)"; } });
  let v = 0, playing = false, t0 = 0, v0 = 0;
  const set = x => { v = Math.max(0, Math.min(1, x)); render(v); sf.style.width = v * 100 + "%"; const us = s.coverage.map(P); let k = us.findIndex(x => x > v); if (k < 0) k = us.length; const a = k ? us[k - 1] : 0, b = k < us.length ? us[k] : 1, la = k ? s.coverage[k - 1].lag : 0, lb = k < us.length ? s.coverage[k].lag : total;
    ck.textContent = "+" + dur(Math.round(la + (lb - la) * (b > a ? (v - a) / (b - a) : 1))); };
  const loop = now => { if (!playing || !$("#sm")) return; set(v0 + (now - t0) / 9000); if (v < 1) requestAnimationFrame(loop); else playing = false; };
  const play = () => { if (v >= 1) v = 0; playing = true; t0 = performance.now(); v0 = v; requestAnimationFrame(loop); };
  $("#pl").onclick = () => playing ? (playing = false) : play();
  const sc = $("#sc"); const seek = e => { playing = false; const r = sc.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
  sc.onpointerdown = e => { seek(e); sc.onpointermove = seek; sc.setPointerCapture(e.pointerId); }; sc.onpointerup = () => sc.onpointermove = null;
  set(0); reduce ? set(1) : setTimeout(play, 500);
}

// ── patterns ──────────────────────────────────────────────────────────────────────────────────
async function patterns() {
  const p = await get("patterns.json");
  const day = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
  const ranked = p.outlets.filter(o => o.covered >= 5);
  const lag = p.outlets.filter(o => o.medianLag != null && o.covered >= 5).sort((a, b) => a.medianLag - b.medianLag), ml = Math.max(1, ...lag.map(o => (o.lagCI || [0, o.medianLag])[1]));
  const fr = p.frames, mf = Math.max(1, ...fr.map(f => f[1]));
  const row = (label, bar, txt, k, flag = "") => `<div class="r" style="--k:${k}"><span>${label}</span>${bar}<span>${txt}${flag}</span></div>`;
  app.innerHTML = `<section><div class="wrap">
    <div class="sh"><h2>Patterns in how news spreads</h2><p>${p.stories} stories · ${p.confidentStories} well-grouped stories feed these numbers · ${p.items.toLocaleString()} headlines, ${day(p.from)}–${day(p.to)}. Ranges are 95% intervals.</p></div>
    <div class="kpis">
      <div class="kpi"><b>${Math.round(p.crossBorder.share)}%</b><span>of stories crossed a border <small>${ci(p.crossBorder.ci)} · n=${p.crossBorder.n}</small></span></div>
      <div class="kpi"><b>${dur(p.crossBorder.medianMinutes)}</b><span>median time to reach another country <small>${p.crossBorder.medianCI ? dur(Math.round(p.crossBorder.medianCI[0])) + "–" + dur(Math.round(p.crossBorder.medianCI[1])) : ""}</small></span></div>
      <div class="kpi"><b>${dur(p.national.medianMinutes)}</b><span>median time until three outlets in the origin country carry it <small>${p.national.medianCI ? dur(Math.round(p.national.medianCI[0])) + "–" + dur(Math.round(p.national.medianCI[1])) : ""} · n=${p.national.n}</small></span></div>
      <div class="kpi"><b>${p.fairStories}</b><span>stories with a fair "first report" — they broke after every outlet was being tracked (${day(p.trackStart)})</span></div>
    </div>
    <div class="two">
      <div class="panel"><h4>Who breaks the news — share of the stories it covered that it reported first</h4>
        ${ranked.length ? `<div class="bars lb">${ranked.map((o, k) => row(O[o.id].name, wbar(o.breakRate, o.breakCI, 100, O[o.id].color), `${o.broke}/${o.covered}`, k, thin(o.solid))).join("")}</div>` : `<p class="note">Building up: this ranking only counts stories that broke after every outlet was being tracked. It fills in over the coming days.</p>`}</div>
      <div class="panel"><h4>Median delay behind the first report</h4>
        ${lag.length ? `<div class="bars lb">${lag.map((o, k) => row(O[o.id].name, wbar(o.medianLag, o.lagCI, ml, "#9B8CFF"), dur(Math.round(o.medianLag)), k, thin(o.solid))).join("")}</div>` : `<p class="note">Building up — see left.</p>`}</div>
    </div>
    <div class="two">
      <div class="panel"><h4>How stories are framed</h4><div class="bars lb">${fr.map(([f, n], k) => row(f, `<div class="t"><i style="--w:${n / mf * 100}%;--c:#FFB547"></i></div>`, n, k)).join("")}</div></div>
      <div class="panel"><h4>Read this fairly</h4><p class="note">"First" means first among the ${Object.keys(O).length} newsrooms NewsTrail reads, by each outlet's own publish time. A story's first report is the start of its burst (three newsrooms within six hours); earlier previews don't count. Only well-grouped stories (coherence ≥ 0.4) are used — about 94% of their first reports were correct in our hand audit. Bars show the estimate; the thin line is the 95% range. "Thin data" means too few stories for a firm claim.</p></div>
    </div>
  </div></section>`;
}

// ── home vs world ────────────────────────────────────────────────────────────────────────────────
async function compare() {
  const c = await get("compare.json");
  const span = `${new Date(c.from).toLocaleDateString([], { day: "numeric", month: "short" })} – ${new Date(c.to).toLocaleDateString([], { day: "numeric", month: "short" })}`;
  const IN = c.countries.find(x => x.country === "India") || { top: [], abroad: 0 };
  const us = c.mirror.find(m => m.country === "United States");
  const mx = Math.max(1, ...c.mirror.flatMap(m => [m.indiaAboutThem.value, m.themAboutIndia.value]));
  const heat = v => v == null ? "" : `background:rgba(255,181,71,${Math.min(.9, v / 50)})`;
  const ex = (list, empty) => list.length ? list.map(e => `<a class="tr" href="#/s/${e.id}"><span class="lag">${e.outlets} outlets</span><span class="ob">${e.countries.length} ${e.countries.length > 1 ? "countries" : "country"}</span><span class="h"><b>${esc(e.headline)}</b></span></a>`).join("") : `<p class="note">${empty}</p>`;
  app.innerHTML = `<section><div class="wrap">
    <div class="sh"><h2>Home vs world</h2><p>When each country's newsrooms look abroad, where do they look? ${span} · ${c.items.toLocaleString()} headlines.</p></div>
    <div class="kpis">
      ${us ? `<div class="kpi"><b>${us.indiaAboutThem.value}%</b><span>of Indian newsrooms' foreign coverage is about the United States <small>${ci(us.indiaAboutThem.ci)}</small></span></div>
      <div class="kpi"><b>${us.themAboutIndia.value}%</b><span>of US newsrooms' foreign coverage is about India <small>${ci(us.themAboutIndia.ci)}</small></span></div>` : ""}
      <div class="kpi"><b>${c.aboutIndia.carriedAbroad} of ${c.aboutIndia.stories}</b><span>well-grouped stories about India were picked up outside India <small>${ci(c.aboutIndia.ci)}</small></span></div>
      <div class="kpi"><b>${c.aboutElsewhereInIndia.carriedInIndia} of ${c.aboutElsewhereInIndia.stories}</b><span>stories about other countries were carried by Indian newsrooms <small>${ci(c.aboutElsewhereInIndia.ci)}</small></span></div>
    </div>
    <div class="two">
      <div class="panel"><h4>The mirror: India about them vs them about India</h4>
        <div class="mirror">${c.mirror.sort((a, b) => b.indiaAboutThem.value + b.themAboutIndia.value - a.indiaAboutThem.value - a.themAboutIndia.value).map((m, k) => `<div class="mr" style="--k:${k}" title="India→${esc(m.country)} ${ci(m.indiaAboutThem.ci)} · ${esc(m.country)}→India ${ci(m.themAboutIndia.ci)}${m.ratio ? ` · ratio ${m.ratio}× (${m.ratioCI ? m.ratioCI[0] + "–" + m.ratioCI[1] + "×" : "range n/a"})` : ""}">
          <span class="l"><i style="--w:${m.indiaAboutThem.value / mx * 100}%"></i><em>${m.indiaAboutThem.value}%</em></span><b>${esc(m.country)}${m.solid ? "" : " ·"}</b><span class="r"><i style="--w:${m.themAboutIndia.value / mx * 100}%"></i><em>${m.themAboutIndia.value}%</em></span></div>`).join("")}</div>
        <div class="mlegend"><span>← India's newsrooms about them</span><span>their newsrooms about India →</span></div>
        <p class="note">Share of each side's <i>foreign</i> coverage, so it doesn't depend on how many home vs world headlines a feed carries. Hover a row for its 95% range; "·" marks a thin sample.${us && us.ratio ? ` India → US vs US → India: <b>${us.ratio}×</b> (95% range ${us.ratioCI ? us.ratioCI[0] + "–" + us.ratioCI[1] + "×" : "n/a"}).` : ""}</p>
      </div>
      <div class="panel"><h4>Where Indian newsrooms look abroad — % of their foreign coverage</h4><div class="bars lb">${IN.top.map((t, k) => `<div class="r" style="--k:${k}"><span>${esc(t.c)}</span>${wbar(t.value, t.ci, Math.max(1, (IN.top[0]?.ci || [0, 1])[1]), "#9B8CFF")}<span>${t.value}%</span></div>`).join("")}</div></div>
    </div>
    ${c.regions ? `<div class="panel" style="margin-top:20px"><h4>This week's hot zones — where ${c.regions[0].newsrooms} newsrooms pointed (each newsroom weighted equally)</h4>
      <div class="bars lb">${c.regions.map((r, k) => `<div class="r" style="--k:${k}"><span>${esc(r.region)}</span>${wbar(r.share, r.ci, Math.max(...c.regions.map(x => (x.ci || [0, x.share])[1])), "#FF5A4E")}<span>${r.share}%</span></div>`).join("")}</div>
      <p class="note">Hottest: ${c.regions.slice(0, 3).map(r => `${esc(r.region)} (${r.countries.slice(0, 2).map(x => esc(x.c)).join(", ")})`).join(" · ")}.</p></div>` : ""}
    <div class="panel" style="margin-top:20px"><h4>Who covers whom — % of each country's foreign coverage</h4>
      <div class="heatwrap"><table class="heat"><thead><tr><th>Newsrooms in ↓ · about →</th>${c.matrix.cols.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead>
      <tbody>${c.matrix.rows.map(r => `<tr><th>${esc(r.country)} <small>${r.abroad}</small></th>${r.cells.map(v => `<td style="${heat(v)}">${v == null ? "—" : v || ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    </div>
    <div class="panel" style="margin-top:20px"><h4>Each newsroom at a glance</h4>
      <div class="heatwrap"><table class="heat out"><thead><tr><th>Outlet</th><th>Headlines</th><th>Name a country</th><th>About abroad</th><th>Top foreign focus</th></tr></thead>
      <tbody>${c.outlets.sort((a, b) => a.country.localeCompare(b.country) || b.n - a.n).map(o => `<tr><th>${ob(o.id)} <small>${esc(o.country)}</small></th><td>${o.n}</td><td>${o.placed}</td><td>${o.abroadShare}%</td><td class="tl">${o.top.slice(0, 3).map(t => `${esc(t.c)} ${t.share}%`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <section><div class="sh"><h2>Stories about India that travelled</h2></div><div class="trail">${ex(c.examples.indiaToWorld, "None this week.")}</div></section>
    <section><div class="sh"><h2>Stories about India that stayed in India</h2></div><div class="trail">${ex(c.examples.indiaOnly, "None this week.")}</div></section>
    <p class="note">How countries are detected: headlines are matched against an open list of country names, demonyms, capitals and major places (scripts/countries.mjs). Headlines that name no country are left out of the shares. Samples from some international outlets are small in a single week — read their numbers as indicative.</p>
  </div></section>`;
}

// ── method ────────────────────────────────────────────────────────────────────────────────────
async function about() {
  const [A, Hh] = await Promise.all([fetch("audit.json").then(r => r.ok ? r.json() : null).catch(() => null), get("health.json").catch(() => null)]);
  const day = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const risk = Hh ? Hh.feeds.filter(f => f.atRisk || !f.ok) : [];
  app.innerHTML = `<section><div class="wrap prose">
    <h2>How NewsTrail works</h2>
    <ul>
      <li><b>Collect.</b> A GitHub Action reads the public RSS feeds of ${Object.keys(O).length} newsrooms in ${new Set(Object.values(O).map(o => o.country)).size} countries — their national section and their world section where they publish one — and keeps each headline, its short summary, link and publish time for 28 days.</li>
      <li><b>Group.</b> Headlines are compared word by word (TF-IDF similarity, headline words weighted double). Items that share rare headline words within 72 hours become one story; a headline that doesn't match the rest of its story is split off. A story needs at least three newsrooms.</li>
      <li><b>First report.</b> A story "breaks" at its first burst — three newsrooms within six hours. The first headline of that burst is the first report; earlier previews stay on the timeline as "before the news broke".</li>
      <li><b>Confidence.</b> Every story gets a coherence score (how closely each headline matches the rest). Only stories scoring ≥ 0.4 feed the statistics; the rest are shown but labelled "loosely grouped".</li>
      <li><b>Countries &amp; regions.</b> An open list of country names, demonyms, capitals and places tags what each headline is about. Hot zones give every newsroom one equal vote, so outlets with long feeds can't dominate.</li>
      <li><b>Uncertainty.</b> Every share carries a 95% interval. Headlines about the same story aren't independent, so intervals come from resampling whole stories (a cluster bootstrap) — wider and more honest than treating headlines as coin flips. Numbers with too little data are marked "thin data".</li>
    </ul>
    <h2>How accurate is it?</h2>
    ${A ? `<p>We checked stories headline by headline — ${A.criterion.charAt(0).toLowerCase() + A.criterion.slice(1)}</p>
      <div class="heatwrap"><table class="heat out"><thead><tr><th>Sample</th><th>Stories</th><th>Headlines grouped correctly</th><th>First report correct</th></tr></thead><tbody>
      ${A.sets.flatMap(x => [["all", "all stories"], ["confident", "well-grouped (used in statistics)"]].map(([k, l]) => `<tr><th>${esc(x.name)} <small>${l}</small></th><td>${x[k].stories}</td><td>${x[k].headlineAccuracy}% <small>${ci(x[k].headlineCI)}</small></td><td>${x[k].firstReportAccuracy}% <small>${ci(x[k].firstReportCI)}</small></td></tr>`)).join("")}
      </tbody></table></div>
      <p class="note">Reviewed ${esc(A.reviewed)}. The tuning set was used to set the thresholds; the validation set was drawn afterwards from stories not seen during tuning. ${esc(A.note)} Known weaknesses: the same event is sometimes split into two stories, and very busy topics (an election, a war) can pull loosely related headlines together.</p>` : `<p class="note">Audit results load here.</p>`}
    <h2>Timestamp reliability</h2>
    <p>"First" depends on each outlet's own publish time. We checked every feed: all carry explicit time zones, and when a headline first appears in a feed its timestamp is almost never earlier than our previous visit (back-dating is rare and small). Feeds whose clocks looked wrong — future-dated items or missing dates — were not added.</p>
    <h2>Data health</h2>
    ${Hh ? `<p>Last collection ${ago(Hh.updated)}. GitHub runs the collector on a schedule but can delay it; 90% of gaps between runs are under <b>${Hh.gapP90Hours ?? "—"} hours</b>. A feed that only reaches back less than that can lose headlines between runs.</p>
      ${risk.length ? `<p class="note">At risk right now: ${risk.map(f => `${esc(O[f.outlet]?.name || f.outlet)} (${f.sec}${f.ok ? `, ${f.depthHours}h deep` : ", unreachable"})`).join(", ")}.</p>` : `<p class="note">No feed currently at risk.</p>`}` : ""}
    <h2>Open data</h2>
    <p>Download this week's measurements (links, times, countries and scores — no article text): <a href="data/csv/stories.csv">stories.csv</a> · <a href="data/csv/coverage.csv">coverage.csv</a> · <a href="data/csv/headline-countries.csv">headline-countries.csv</a> · weekly archive: <a href="data/weeks/index.json">weeks/</a>. Code and method: <a href="https://github.com/mangipudiyash/newstrail">github.com/mangipudiyash/newstrail</a>.</p>
    <h2>Corrections</h2>
    <ul>
      <li><b>29 Oct 2026</b> — An audit found that ~18% of first reports were previews or unrelated pieces. We added the burst rule, an origin check and the coherence threshold; statistics now use well-grouped stories only.</li>
      <li><b>29 Oct 2026</b> — Added 17 newsrooms (Africa, Asia-Pacific, Middle East, Europe, Latin America and Indian regional papers). The "first to report" ranking restarted so every outlet is judged on the same stories.</li>
      <li><b>27 Oct 2026</b> — CNN's RSS feed was found to carry ads and old local stories and was removed; Indian Express blocks automated readers and was replaced.</li>
    </ul>
    <h2>Sources</h2><div class="outl">${Object.values(O).sort((a, b) => a.country.localeCompare(b.country)).map(o => `<span class="chip">${ob(o.id)} · ${esc(o.country)}</span>`).join("")}</div>
    <h2>Fair use</h2><p>NewsTrail shows headlines and the short summaries outlets publish in their own feeds, always linked back to the original. No articles are copied. Visitors' browsers only load NewsTrail's own files — they never contact the newsrooms.</p>
  </div></section>`;
}

// ── router ────────────────────────────────────────────────────────────────────────────────────
async function route() {
  heroStop(); scrollTo(0, 0); document.title = "NewsTrail — watch the news travel";
  const h = location.hash.slice(1) || "/";
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.dataset.r === (h.startsWith("/patterns") ? "patterns" : h.startsWith("/compare") ? "compare" : h.startsWith("/about") ? "about" : "home")));
  try {
    if (h.startsWith("/s/")) await story(h.slice(3));
    else if (h.startsWith("/patterns")) await patterns();
    else if (h.startsWith("/compare")) await compare();
    else if (h.startsWith("/about")) await about();
    else await home();
  } catch (e) { console.error(e); app.innerHTML = `<div class="wrap empty">That story has moved on — it's no longer in the 7-day window. <a href="#/">See what's spreading now →</a></div>`; }
}
(async () => {
  O = Object.fromEntries((await get("outlets.json")).map(o => [o.id, o]));
  const { updated } = await get("stories.json");
  $("#upd").innerHTML = `<i></i>Updated ${ago(updated)}`;
  addEventListener("hashchange", route); route();
})();
