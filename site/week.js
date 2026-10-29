// NewsTrail — the weekly report (#/week), share cards, and "how the headline changed" on story pages.
// Loaded after app.js; uses its helpers (get, O, esc, dur, ob, ci, wbar, thin, COL, makeMap, trail, land, reduce).

// ── share cards: a 1080×1350 PNG drawn from live data, ready for Instagram / LinkedIn ──────────────────────
const CARD = { w: 1080, h: 1350 };
function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
/**
 * kicker: small caps label · big: the headline number/phrase · sub: one-sentence explanation · range: "95% range …"
 * bars: optional [{label, value, ci, color}] (values in %) · story: optional headline (serif) · foot: date line
 */
async function makeCard({ kicker = "", big = "", sub = "", range = "", bars = null, story = "", foot = "" }) {
  await document.fonts.ready;
  const c = document.createElement("canvas"); c.width = CARD.w; c.height = CARD.h;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(780, 260, 40, 780, 260, 900); g.addColorStop(0, "#2A1420"); g.addColorStop(1, "#0A0C11");
  x.fillStyle = g; x.fillRect(0, 0, CARD.w, CARD.h);
  // faint grid
  x.strokeStyle = "rgba(255,255,255,.035)"; x.lineWidth = 1; for (let i = 0; i < CARD.w; i += 54) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, CARD.h); x.stroke(); }
  // brand
  x.fillStyle = "#FF5A4E"; x.beginPath(); x.arc(88, 96, 11, 0, 7); x.fill();
  x.fillStyle = "#EEF0F6"; x.font = "700 30px Inter"; x.fillText("News", 112, 107); const nw = x.measureText("News").width;
  x.fillStyle = "#FFB547"; x.fillText("Trail", 112 + nw, 107);
  x.fillStyle = "#8C93A8"; x.font = "600 24px 'JetBrains Mono'"; x.textAlign = "right"; x.fillText("WATCH THE NEWS TRAVEL", CARD.w - 76, 106); x.textAlign = "left";
  let y = 250;
  x.fillStyle = "#FFB547"; x.font = "600 28px 'JetBrains Mono'"; x.fillText(kicker.toUpperCase(), 76, y); y += 40;
  // big statement: shrink to fit in at most 3 lines
  let size = 170, lines;
  do { x.font = `500 ${size}px Newsreader`; lines = wrapText(x, big, CARD.w - 152); size -= 8; } while ((lines.length > 3 || lines.some(l => x.measureText(l).width > CARD.w - 152)) && size > 60);
  x.fillStyle = "#EEF0F6";
  for (const l of lines) { y += size * .95; x.fillText(l, 76, y); }
  y += Math.round(size * .32) + 34;
  if (sub) { x.font = "400 38px Inter"; x.fillStyle = "#C9CDDA"; for (const l of wrapText(x, sub, CARD.w - 152).slice(0, 4)) { x.fillText(l, 76, y); y += 52; } }
  if (range) { y += 6; x.font = "600 26px 'JetBrains Mono'"; x.fillStyle = "#8C93A8"; x.fillText(range, 76, y); y += 40; }
  if (story) { y += 20; x.font = "italic 500 40px Newsreader"; x.fillStyle = "#EEF0F6"; for (const l of wrapText(x, `“${story}”`, CARD.w - 152).slice(0, 3)) { x.fillText(l, 76, y); y += 50; } }
  if (bars && bars.length) {
    y += 30; const max = Math.max(1, ...bars.map(b => (b.ci || [0, b.value])[1], 0)), bw = CARD.w - 152 - 260 - 110;
    for (const b of bars.slice(0, 6)) {
      x.font = "500 28px Inter"; x.fillStyle = "#C9CDDA"; x.fillText(b.label, 76, y + 22);
      x.fillStyle = "#1A1F2C"; x.fillRect(336, y, bw, 26);
      x.fillStyle = b.color || "#FF5A4E"; x.fillRect(336, y, bw * Math.min(1, b.value / max), 26);
      if (b.ci) { const a = 336 + bw * b.ci[0] / max, z = 336 + bw * Math.min(1, b.ci[1] / max); x.strokeStyle = "#EEF0F6"; x.lineWidth = 3; x.beginPath(); x.moveTo(a, y + 13); x.lineTo(z, y + 13); x.moveTo(a, y + 4); x.lineTo(a, y + 22); x.moveTo(z, y + 4); x.lineTo(z, y + 22); x.stroke(); }
      x.font = "600 28px 'JetBrains Mono'"; x.fillStyle = "#EEF0F6"; x.textAlign = "right"; x.fillText(`${b.value}%`, CARD.w - 76, y + 24); x.textAlign = "left";
      y += 62;
    }
  }
  // footer
  x.strokeStyle = "#232838"; x.lineWidth = 2; x.beginPath(); x.moveTo(76, CARD.h - 150); x.lineTo(CARD.w - 76, CARD.h - 150); x.stroke();
  x.font = "500 24px 'JetBrains Mono'"; x.fillStyle = "#8C93A8";
  for (const [i, l] of wrapText(x, foot || `${Object.keys(O).length} newsrooms in ${new Set(Object.values(O).map(o => o.country)).size} countries · public RSS feeds`, CARD.w - 152).slice(0, 2).entries()) x.fillText(l, 76, CARD.h - 104 + i * 34);
  x.fillStyle = "#FFB547"; x.font = "600 26px 'JetBrains Mono'"; x.fillText("mangipudiyash.github.io/newstrail", 76, CARD.h - 40);
  return c;
}
async function shareCard(spec, name) {
  const c = await makeCard(spec);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const file = new File([blob], `newstrail-${name}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer:coarse)").matches) {
    try { await navigator.share({ files: [file], title: "NewsTrail" }); return; } catch {}
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const shareBtn = (id) => `<button class="sharebtn" data-share="${id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>Share card</button>`;
function wireShare(specs) { document.querySelectorAll("[data-share]").forEach(b => b.onclick = async () => { b.classList.add("busy"); try { await shareCard(specs[b.dataset.share], b.dataset.share); } finally { b.classList.remove("busy"); } }); }

// ── scroll reveal + count-up ────────────────────────────────────────────────────────────────────────────
function reveal(root) {
  const count = el => { const to = +el.dataset.count, dec = +(el.dataset.dec || 0), suf = el.dataset.suf || "", t0 = performance.now(), D = reduce ? 1 : 1400;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add("in"); e.target.querySelectorAll("[data-count]").forEach(count); e.target.dispatchEvent(new Event("reveal")); io.unobserve(e.target); }), { threshold: .25 });
  root.querySelectorAll(".rv").forEach(s => io.observe(s));
}

// ── the weekly report ───────────────────────────────────────────────────────────────────────────────────
async function week(id) {
  const weeks = await get("weeks/index.json").catch(() => []);
  let P, C, label, partial = false;
  if (id && id !== "now") { const w = await get(`weeks/${id}.json`); P = w.patterns; C = w.compare; label = `Week ${id.slice(6)} · ${id.slice(0, 4)}`; partial = w.partial; }
  else { [P, C] = await Promise.all([get("patterns.json"), get("compare.json")]); label = "The last 7 days"; }
  const day = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
  const span = `${day(C.from)} – ${day(C.to)}`;
  const us = (C.mirror || []).find(m => m.country === "United States");
  const regs = C.regions || [];
  const trav = C.traveller;
  const breakers = (P.outlets || []).filter(o => o.solid).slice(0, 5);
  const nCountries = new Set(Object.values(O).map(o => o.country)).size;
  const hrs = trav ? Math.round(trav.span / 3.6e6) : 0;
  const pct0 = v => Math.round(v);

  app.innerHTML = `<div class="wk">
    <section class="wk-hero rv"><div class="wrap">
      <div class="wk-pick">${["now", ...weeks.slice().reverse()].map(w => `<a class="chip ${(id || "now") === w ? "on" : ""}" href="#/week/${w}">${w === "now" ? "Last 7 days" : w}</a>`).join("")}</div>
      <p class="wk-k">${esc(label)} · ${span}${partial ? " · partial week (tracking began mid-week)" : ""}</p>
      <h1>Where the news <em>went</em> this week.</h1>
      <div class="wk-nums">
        <div><b data-count="${C.items}">0</b><span>headlines read</span></div>
        <div><b data-count="${Object.keys(O).length}">0</b><span>newsrooms</span></div>
        <div><b data-count="${nCountries}">0</b><span>countries</span></div>
        <div><b data-count="${P.stories}">0</b><span>stories traced</span></div>
      </div>
      <p class="wk-scroll">Scroll ↓</p>
    </div></section>

    <section class="wk-s rv" id="s-zones"><div class="wrap wk-two">
      <div class="wk-vis"><svg id="wglobe" viewBox="0 0 600 600"></svg></div>
      <div class="wk-txt">
        <p class="wk-k">Hot zones</p>
        <h2>${regs[0] ? `${esc(regs[0].region)} and ${esc(regs[1]?.region || "")} held the world's attention.` : "Hot zones"}</h2>
        <p>Where ${regs[0]?.newsrooms || ""} newsrooms pointed their coverage, each newsroom counted equally so long feeds can't dominate.</p>
        <div class="bars lb">${regs.map((r, k) => `<div class="r" style="--k:${k}"><span>${esc(r.region)}</span>${wbar(r.share, r.ci, Math.max(...regs.map(x => (x.ci || [0, x.share])[1])), "#FF5A4E")}<span>${r.share}%</span></div>`).join("")}</div>
        ${shareBtn("zones")}
      </div>
    </div></section>

    ${us ? `<section class="wk-s rv" id="s-mirror"><div class="wrap wk-two">
      <div class="wk-vis wk-mirror">
        <div class="mcol"><div class="mbar" style="--h:${Math.min(100, us.indiaAboutThem.value * 1.8)}%;--c:#FF5A4E"></div><b data-count="${us.indiaAboutThem.value}" data-dec="1" data-suf="%">0%</b><span>Indian newsrooms<br>about the US</span><small>${ci(us.indiaAboutThem.ci)}</small></div>
        <div class="mcol"><div class="mbar" style="--h:${Math.max(1.5, us.themAboutIndia.value * 1.8)}%;--c:#2DD4BF"></div><b data-count="${us.themAboutIndia.value}" data-dec="1" data-suf="%">0%</b><span>US newsrooms<br>about India</span><small>${ci(us.themAboutIndia.ci)}</small></div>
      </div>
      <div class="wk-txt">
        <p class="wk-k">The mirror</p>
        <h2>India watches America. America barely looks back.</h2>
        <p>Share of each side's <i>foreign</i> coverage. The gap is about <b>${us.ratio}×</b>${us.ratioCI ? ` — somewhere between ${us.ratioCI[0]}× and ${us.ratioCI[1]}× with 95% confidence` : ""}.${us.solid ? "" : " Thin sample — read as indicative."}</p>
        ${shareBtn("mirror")}
      </div>
    </div></section>` : ""}

    ${trav ? `<section class="wk-s rv" id="s-trav"><div class="wrap">
      <div class="wk-txt wk-center">
        <p class="wk-k">The farthest-travelled story</p>
        <h2>${trav.trail.filter(c => c.lag >= 0).length} newsrooms. ${trav.countries.length} countries. ${hrs} hours.</h2>
        <p class="wk-quote">“${esc(trav.headline)}”</p>
      </div>
      <div class="mapbox wk-map" id="wmap"><div class="now"><div class="pill" id="wnp"></div></div><div class="hud"><span class="clock wk-clock" id="wck">+0m</span></div></div>
      <div class="wk-center"><a class="chip" href="#/s/${trav.id}">Open the full trail →</a> ${shareBtn("trav")}</div>
    </div></section>` : ""}

    <section class="wk-s rv" id="s-speed"><div class="wrap">
      <div class="wk-txt wk-center">
        <p class="wk-k">Speed</p>
        <h2>A story that crosses a border does it in about <span class="hl">${dur(P.crossBorder.medianMinutes)}</span>.</h2>
        <p>${pct0(P.crossBorder.share)}% of well-grouped stories reached a newsroom in another country (${ci(P.crossBorder.ci)}). Median time to cross: ${dur(P.crossBorder.medianMinutes)}${P.crossBorder.medianCI ? ` (range ${dur(P.crossBorder.medianCI[0])}–${dur(P.crossBorder.medianCI[1])})` : ""}. Median time to go national — three newsrooms in the home country: ${dur(P.national.medianMinutes)}.</p>
        ${shareBtn("speed")}
      </div>
    </div></section>

    <section class="wk-s rv" id="s-first"><div class="wrap wk-two">
      <div class="wk-txt">
        <p class="wk-k">Who breaks the news</p>
        <h2>${breakers.length ? `${esc(O[breakers[0].id].name)} reported first most often.` : "The fair ranking is still building."}</h2>
        <p>${breakers.length ? `Share of the stories each newsroom covered that it reported first — only stories that broke after every outlet was tracked (${P.fairStories} stories). Bars show the estimate, lines the 95% range.` : `This ranking only counts stories that broke after every newsroom was being tracked, so each one is judged on the same stories. ${P.fairStories} so far — it fills in over the coming days.`}</p>
        ${breakers.length ? shareBtn("first") : ""}
      </div>
      <div class="wk-vis">${breakers.length ? `<div class="bars lb">${breakers.map((o, k) => `<div class="r" style="--k:${k}"><span>${esc(O[o.id].name)}</span>${wbar(o.breakRate, o.breakCI, 100, O[o.id].color)}<span>${o.broke}/${o.covered}</span></div>`).join("")}</div>` : `<div class="wk-empty">⏳</div>`}</div>
    </div></section>

    ${C.aboutIndia ? `<section class="wk-s rv" id="s-india"><div class="wrap wk-two">
      <div class="wk-vis"><div class="dots">${Array.from({ length: Math.min(60, C.aboutIndia.stories) }, (_, i) => `<i class="${i < C.aboutIndia.carriedAbroad ? "hot" : ""}" style="--k:${i}"></i>`).join("")}</div></div>
      <div class="wk-txt">
        <p class="wk-k">India's stories</p>
        <h2><span data-count="${C.aboutIndia.carriedAbroad}">0</span> of ${C.aboutIndia.stories} stories about India left the country.</h2>
        <p>Well-grouped stories about India that at least one newsroom outside India picked up (${ci(C.aboutIndia.ci)}). For comparison, Indian newsrooms carried ${C.aboutElsewhereInIndia.carriedInIndia} of ${C.aboutElsewhereInIndia.stories} stories about other countries.</p>
        ${shareBtn("india")}
      </div>
    </div></section>` : ""}

    <section class="wk-s wk-end rv"><div class="wrap wk-center">
      <h2>Every number here has a range, a sample size and an audit.</h2>
      <p><a href="#/about">How NewsTrail measures — and how accurate it is →</a></p>
    </div></section>
  </div>`;
  reveal(app);

  const foot = `${label} · ${span} · ${Object.keys(O).length} newsrooms, ${nCountries} countries`;
  wireShare({
    zones: { kicker: "This week's hot zones", big: regs[0] ? `${regs[0].region} ${regs[0].share}%` : "Hot zones", sub: "Where the world's newsrooms pointed their coverage — each newsroom counted equally.", bars: regs.map(r => ({ label: r.region, value: r.share, ci: r.ci, color: "#FF5A4E" })), foot },
    mirror: us && { kicker: "The mirror", big: `India watches the US. The US barely looks back.`, sub: `Share of each side's foreign coverage that is about the other. Gap ≈ ${us.ratio}×${us.ratioCI ? ` (95% range ${us.ratioCI[0]}–${us.ratioCI[1]}×)` : ""}.`,
      bars: [{ label: "India → US", value: us.indiaAboutThem.value, ci: us.indiaAboutThem.ci, color: "#FF5A4E" }, { label: "US → India", value: us.themAboutIndia.value, ci: us.themAboutIndia.ci, color: "#2DD4BF" }], foot },
    trav: trav && { kicker: "The farthest-travelled story", big: `${trav.countries.length} countries in ${hrs} hours`, story: trav.headline, sub: `${trav.trail.filter(c => c.lag >= 0).length} newsrooms carried it.`, foot },
    speed: { kicker: "How fast news crosses borders", big: dur(P.crossBorder.medianMinutes), sub: `Median time for a story to reach a newsroom in another country. ${pct0(P.crossBorder.share)}% of stories crossed a border.`, range: P.crossBorder.medianCI ? `95% range ${dur(P.crossBorder.medianCI[0])}–${dur(P.crossBorder.medianCI[1])} · n=${P.crossBorder.n}` : "", foot },
    first: breakers.length && { kicker: "Who breaks the news", big: O[breakers[0].id].name, sub: "Share of the stories each newsroom covered that it reported first.", bars: breakers.map(o => ({ label: O[o.id].name, value: o.breakRate, ci: o.breakCI, color: O[o.id].color })), foot },
    india: C.aboutIndia && { kicker: "India's stories", big: `${C.aboutIndia.carriedAbroad} of ${C.aboutIndia.stories}`, sub: "Stories about India that a newsroom outside India picked up.", range: `95% range ${ci(C.aboutIndia.ci)}`, foot },
  });

  // rotating hot-zone globe
  const gEl = document.getElementById("wglobe");
  if (gEl) {
    const geo = await land(), CEN = { "South Asia": [79, 22], Americas: [-80, 15], Europe: [14, 50], "Middle East": [44, 29], "East Asia": [114, 32], Oceania: [140, -28], Africa: [20, 4] };
    const svg = d3.select(gEl), proj = d3.geoOrthographic().scale(270).translate([300, 300]).clipAngle(90), path = d3.geoPath(proj);
    const defs = svg.append("defs"), rg = defs.append("radialGradient").attr("id", "whot");
    [[0, "#FF3B30", .95], [.45, "#FF7A1A", .5], [1, "#FFB020", 0]].forEach(([o, c, a]) => rg.append("stop").attr("offset", o).attr("stop-color", c).attr("stop-opacity", a));
    svg.append("circle").attr("cx", 300).attr("cy", 300).attr("r", 270).attr("fill", "#0E1220").attr("stroke", "#2A3352").attr("stroke-width", 1.5);
    const gr = svg.append("path").attr("fill", "none").attr("stroke", "#18203A"), ld = svg.append("path").attr("fill", "#222A40").attr("stroke", "#33405F").attr("stroke-width", .7);
    const blobs = svg.append("g").selectAll("circle").data(regs.filter(r => CEN[r.region])).join("circle").attr("fill", "url(#whot)");
    const labels = svg.append("g").selectAll("text").data(regs.filter(r => CEN[r.region])).join("text").attr("text-anchor", "middle").attr("fill", "#fff").attr("font-size", 14).attr("font-weight", 700).attr("font-family", "JetBrains Mono");
    const grat = d3.geoGraticule10(); let t0 = performance.now(), grow = 0;
    gEl.closest("section").addEventListener("reveal", () => { const s = performance.now(); const g = n => { grow = Math.min(1, (n - s) / 1200); if (grow < 1) requestAnimationFrame(g); }; requestAnimationFrame(g); });
    const spin = now => {
      if (!gEl.isConnected) return;
      const rot = [-((now - t0) / 1000) * 8 - 60, -15]; proj.rotate(rot);
      gr.attr("d", path(grat)); ld.attr("d", path(geo));
      const vis = d => d3.geoDistance(CEN[d.region], [-rot[0], -rot[1]]) < 1.45;
      blobs.attr("transform", d => `translate(${proj(CEN[d.region])})`).attr("r", d => (Math.sqrt(d.share) * 22 + 10) * grow * (1 + .06 * Math.sin(now / 400 + d.share))).attr("opacity", d => vis(d) ? 1 : 0);
      labels.attr("transform", d => `translate(${proj(CEN[d.region])})`).attr("dy", 5).text(d => `${d.share}%`).attr("opacity", d => vis(d) && grow > .9 ? 1 : 0);
      if (!reduce) requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);
  }

  // the traveller's trail, replayed when it scrolls into view
  if (trav) {
    const st = { headline: trav.headline, origin: { outlet: trav.trail.find(c => c.lag >= 0)?.outlet || trav.trail[0].outlet }, epicentre: trav.epicentre, coverage: trav.trail.filter(c => c.lag >= 0) };
    const pts = [...st.coverage.map(c => [O[c.outlet].lon, O[c.outlet].lat]), ...(st.epicentre ? [[st.epicentre.lon, st.epicentre.lat]] : [])];
    const m = await makeMap(document.getElementById("wmap"), { width: 1000, height: 560, focus: { type: "MultiPoint", coordinates: pts } });
    m.svg.classed("big", true);
    const np = document.getElementById("wnp"), ck = document.getElementById("wck"), P2 = pace(st), us2 = st.coverage.map(P2), total = Math.max(1, ...st.coverage.map(c => c.lag));
    const render = trail(m, st, { onHit: d => { if (!d) return np.classList.remove("show"); np.innerHTML = `<small>${esc(O[d.c.outlet].name)} · ${d.c.lag ? "+" + dur(d.c.lag) : "first report"}</small><b>${esc(d.c.title)}</b>`; np.classList.add("show"); } });
    const set = v => { render(v); let k = us2.findIndex(x => x > v); if (k < 0) k = us2.length; const a = k ? us2[k - 1] : 0, b = k < us2.length ? us2[k] : 1, la = k ? st.coverage[k - 1].lag : 0, lb = k < us2.length ? st.coverage[k].lag : total; ck.textContent = "+" + dur(Math.round(la + (lb - la) * (b > a ? (v - a) / (b - a) : 1))); };
    set(0);
    document.getElementById("s-trav").addEventListener("reveal", () => { if (reduce) return set(1); const s = performance.now(); const go = n => { const v = Math.min(1, (n - s) / 9000); set(v); if (v < 1 && document.getElementById("wmap")) requestAnimationFrame(go); }; requestAnimationFrame(go); });
  }
}

// ── story page: how the headline changed, and its share card ─────────────────────────────────────────────
function headlineEvolution(s) {
  const el = document.getElementById("evo"); if (!el) return;
  const cov = s.coverage.filter(c => !c.before); if (cov.length < 3) { el.remove(); return; }
  const norm = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const STOPW = new Set("a an the and or of to in on at by for with from as is are was were be after over says said its it this that his her their into amid".split(" "));
  const firstWords = new Set(cov[0].title.split(/\s+/).map(norm));
  const marked = c => c.title.split(/(\s+)/).map(w => { const n = norm(w); return n && !STOPW.has(n) && !firstWords.has(n) && n.length > 2 ? `<mark>${esc(w)}</mark>` : esc(w); }).join("");
  // tone trajectory
  const W = 900, Hh = 160, maxLag = Math.max(1, ...cov.map(c => c.lag)), X = c => 30 + Math.log1p(c.lag) / Math.log1p(maxLag) * (W - 60), Y = v => Hh / 2 - v * (Hh / 2 - 18);
  const third = Math.ceil(cov.length / 3), avg = a => a.reduce((x, c) => x + c.tone, 0) / a.length, t1 = avg(cov.slice(0, third)), t3 = avg(cov.slice(-third));
  const tw = v => v > .15 ? "positive" : v < -.15 ? "negative" : "neutral";
  const fr = a => { const m = {}; for (const c of a) for (const f of c.frames) m[f] = (m[f] || 0) + 1; return Object.entries(m).sort((x, y) => y[1] - x[1])[0]?.[0]; };
  const f1 = fr(cov.slice(0, third)), f3 = fr(cov.slice(-third));
  el.innerHTML = `<div class="sh"><h2>How the headline changed</h2><p>From the first report to the last. The line is the smoothed tone; dots are single headlines. <mark class="evo-m">Highlighted</mark> words weren't in the first report.</p></div>
    <div class="panel evo">
      <div class="evo-sum"><span>Tone: <b>${tw(t1)}</b> → <b>${tw(t3)}</b></span>${f1 && f3 ? `<span>Framing: <b>${f1}</b> → <b>${f3}</b></span>` : ""}<span>${cov.length} newsrooms over ${dur(maxLag)}</span></div>
      <svg viewBox="0 0 ${W} ${Hh}" class="evo-chart" preserveAspectRatio="none">
        <line x1="20" x2="${W - 20}" y1="${Hh / 2}" y2="${Hh / 2}" stroke="#232838"/><text x="22" y="16" fill="#3DDC97" font-size="11" font-family="JetBrains Mono">positive</text><text x="22" y="${Hh - 6}" fill="#FF6B6B" font-size="11" font-family="JetBrains Mono">negative</text>
        <path d="${cov.map((c, i) => { const w = cov.slice(Math.max(0, i - 2), i + 3), m = w.reduce((a, d) => a + d.tone, 0) / w.length; return `${i ? "L" : "M"}${X(c).toFixed(1)},${Y(m).toFixed(1)}`; }).join("")}" fill="none" stroke="#FFB547" stroke-width="3" stroke-linejoin="round" class="evo-line"/>
        ${cov.map(c => `<circle cx="${X(c).toFixed(1)}" cy="${Y(c.tone).toFixed(1)}" r="5" fill="${O[c.outlet].color}" stroke="#141821" stroke-width="2"><title>${esc(O[c.outlet].name)} · ${c.lag ? "+" + dur(c.lag) : "first"} · tone ${c.tone}</title></circle>`).join("")}
      </svg>
      <div class="evo-list">${cov.map(c => `<div class="evo-row"><span class="lag ${c.lag ? "" : "o"}">${c.lag ? "+" + dur(c.lag) : "FIRST"}</span>${ob(c.outlet)}<span class="h">${c.lag ? marked(c) : esc(c.title)}</span></div>`).join("")}</div>
    </div>`;
}
function storyShare(s) {
  const cov = s.coverage.filter(c => !c.before), hrs = Math.max(1, Math.round(s.span / 3.6e6));
  wireShare({ story: { kicker: "How this story travelled", big: `${s.countries.length} countries in ${hrs} hours`, story: s.headline,
    sub: `First reported by ${O[s.origin.outlet].name}. ${cov.length} newsrooms carried it.`, foot: `NewsTrail · ${new Date(s.first).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` } });
}
