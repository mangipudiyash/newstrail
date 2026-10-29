// NewsTrail — outlet vs outlet (#/vs/<a>/<b>). Everything is computed in the browser from data/h2h.json.
// Uses app.js helpers (get, O, esc, dur, ob, ci, wbar, thin, reduce) and week.js (shareBtn, wireShare, reveal).

// ── small statistics (same methods as scripts/stats.mjs) ───────────────────────────────────────────────
const vsWilson = (k, n, z = 1.96) => { if (!n) return null; const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.round(1000 * Math.max(0, c - h)) / 10, Math.round(1000 * Math.min(1, c + h)) / 10]; };
const vsMedian = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const vsMean = a => a.reduce((x, y) => x + y, 0) / a.length;
function vsBoot(arr, stat, B = 1000) {
  if (arr.length < 5) return null;
  let seed = 9; const r = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const v = []; for (let b = 0; b < B; b++) { const s = arr.map(() => arr[(r() * arr.length) | 0]); v.push(stat(s)); }
  v.sort((x, y) => x - y); return [v[Math.floor(B * .025)], v[Math.floor(B * .975)]];
}
const VS_STOP = new Set(`the a an and or but of to in on at by for with from as is are was were be been it its this that these those he she they his her their after over under into about amid against between says said say says new will would can could may not no more most than then there what which who why how when where all also just over up out off amid live news update updates latest today watch video report reports first big top day week year two three one vs via per`.split(/\s+/));
const vsWords = t => (t.toLowerCase().replace(/[’']s\b/g, "").match(/\p{L}[\p{L}\-]{2,}/gu) || []).filter(w => !VS_STOP.has(w));

/** Everything the page shows for outlets a and b. */
function headToHead(H, a, b) {
  const st = H.outletStart, since = Math.max(st[a] ?? Infinity, st[b] ?? Infinity);
  const conf = H.stories.filter(s => s.c);
  const covers = (s, o) => s.cov.find(c => c[0] === o);
  const A = conf.filter(s => covers(s, a)), B = conf.filter(s => covers(s, b));
  const shared = A.filter(s => covers(s, b)).map(s => ({ s, A: covers(s, a), B: covers(s, b) }));
  // the race: only stories that broke after both outlets were tracked, so neither is judged on stories it couldn't have seen
  const fair = shared.filter(x => x.s.t0 >= since), decided = fair.filter(x => Math.abs(x.A[1] - x.B[1]) >= 1);
  const aWins = decided.filter(x => x.A[1] < x.B[1]).length;
  const leads = fair.map(x => x.B[1] - x.A[1]);                                  // > 0: a was earlier
  // tone: paired difference on the same stories
  const dTone = shared.map(x => x.A[2] - x.B[2]);
  // frames: share of each outlet's shared headlines carrying each frame
  const FR = ["Conflict", "Politics", "Economy", "Human", "Safety", "Justice"];
  const frames = FR.map(f => ({ f, a: shared.length ? 100 * shared.filter(x => x.A[3].split("|").includes(f)).length / shared.length : 0, b: shared.length ? 100 * shared.filter(x => x.B[3].split("|").includes(f)).length / shared.length : 0 }));
  // signature words: weighted log-odds with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008), on the same stories
  const ca = new Map(), cb = new Map(), cp = new Map();
  for (const x of shared) { for (const w of vsWords(x.A[4])) ca.set(w, (ca.get(w) || 0) + 1); for (const w of vsWords(x.B[4])) cb.set(w, (cb.get(w) || 0) + 1); }
  for (const s of H.stories) for (const c of s.cov) for (const w of vsWords(c[4])) cp.set(w, (cp.get(w) || 0) + 1);
  const na = [...ca.values()].reduce((x, y) => x + y, 0), nb = [...cb.values()].reduce((x, y) => x + y, 0), np = [...cp.values()].reduce((x, y) => x + y, 0), a0 = 500;
  const z = [...new Set([...ca.keys(), ...cb.keys()])].map(w => {
    const ya = ca.get(w) || 0, yb = cb.get(w) || 0, al = a0 * (cp.get(w) || 0) / np || .01;
    const d = Math.log((ya + al) / (na + a0 - ya - al)) - Math.log((yb + al) / (nb + a0 - yb - al));
    return { w, ya, yb, z: d / Math.sqrt(1 / (ya + al) + 1 / (yb + al)) };
  });
  const sigA = z.filter(x => x.z > 1.96 && x.ya >= 2).sort((p, q) => q.z - p.z).slice(0, 10);
  const sigB = z.filter(x => x.z < -1.96 && x.yb >= 2).sort((p, q) => p.z - q.z).slice(0, 10);
  return {
    a, b, since, nA: A.length, nB: B.length, shared, fair, decided,
    aWins, bWins: decided.length - aWins, winA: decided.length ? Math.round(1000 * aWins / decided.length) / 10 : null, winCI: vsWilson(aWins, decided.length),
    medLead: vsMedian(leads), leadCI: vsBoot(leads, vsMedian),
    tone: shared.length ? { a: vsMean(shared.map(x => x.A[2])), b: vsMean(shared.map(x => x.B[2])), d: vsMean(dTone), ci: vsBoot(dTone, vsMean) } : null,
    frames, sigA, sigB, solid: decided.length >= 10,
  };
}

// ── the page ────────────────────────────────────────────────────────────────────────────────────────────
async function versus(a, b) {
  const H = await get("h2h.json");
  const ids = Object.keys(O);
  if (!O[a] || !O[b] || a === b) {                                              // default: the pair with the most fair shared stories
    const best = new Map();
    for (const s of H.stories) { if (!s.c) continue; const outs = [...new Set(s.cov.map(c => c[0]))].sort();
      for (let i = 0; i < outs.length; i++) for (let j = i + 1; j < outs.length; j++) { const k = outs[i] + "/" + outs[j]; if (s.t0 >= Math.max(H.outletStart[outs[i]] ?? Infinity, H.outletStart[outs[j]] ?? Infinity)) best.set(k, (best.get(k) || 0) + 1); } }
    [a, b] = ([...best].sort((x, y) => y[1] - x[1])[0]?.[0] || "ht/bbc").split("/");
    history.replaceState(null, "", `#/vs/${a}/${b}`);
  }
  const R = headToHead(H, a, b), A = { ...O[a] }, B = { ...O[b] };
  // if the two brand colours are hard to tell apart, show the second outlet in teal
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), dist = (p, q) => Math.hypot(...p.map((v, i) => v - q[i]));
  if (dist(rgb(A.color), rgb(B.color)) < 130) B.color = dist(rgb(A.color), rgb("#2DD4BF")) < 130 ? "#FFB547" : "#2DD4BF";
  const opt = sel => Object.entries(ids.reduce((g, id) => ((g[O[id].country] ??= []).push(id), g), {})).sort().map(([c, list]) => `<optgroup label="${esc(c)}">${list.map(id => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(O[id].name)}</option>`).join("")}</optgroup>`).join("");
  const lead = m => m == null ? "—" : m === 0 ? "level" : `${dur(Math.abs(m))} ${m > 0 ? `${A.name} ahead` : `${B.name} ahead`}`;
  const day = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
  // Venn sizes: circle areas proportional to stories covered
  const rA = 70 * Math.sqrt(R.nA / Math.max(R.nA, R.nB, 1)), rB = 70 * Math.sqrt(R.nB / Math.max(R.nA, R.nB, 1));
  const ov = R.shared.length / Math.max(1, Math.min(R.nA, R.nB)), gap = (rA + rB) * (1 - ov * .85);
  const tw = v => v > .1 ? "more positive" : v < -.1 ? "more negative" : "about the same";

  app.innerHTML = `<section class="vs"><div class="wrap">
    <div class="sh"><h2>Outlet vs outlet</h2><p>Pick any two newsrooms. Same stories, head to head.</p></div>
    <div class="vs-pick">
      <select id="va" aria-label="First outlet">${opt(a)}</select>
      <button class="vs-swap" id="vswap" title="Swap" aria-label="Swap outlets">⇄</button>
      <select id="vb" aria-label="Second outlet">${opt(b)}</select>
    </div>

    <div class="vs-hero rv">
      <div class="vs-side" style="--c:${A.color}"><b>${esc(A.name)}</b><span>${esc(A.country)} · ${R.nA} stories</span></div>
      <svg class="vs-venn" viewBox="0 0 360 170"><circle cx="${180 - gap / 2}" cy="85" r="${rA}" fill="${A.color}" fill-opacity=".38" stroke="${A.color}" stroke-width="2"/><circle cx="${180 + gap / 2}" cy="85" r="${rB}" fill="${B.color}" fill-opacity=".38" stroke="${B.color}" stroke-width="2"/>
        <text x="180" y="82" text-anchor="middle" fill="#fff" font-size="28" font-family="Newsreader" font-weight="500">${R.shared.length}</text><text x="180" y="102" text-anchor="middle" fill="#C9CDDA" font-size="10" font-family="JetBrains Mono">SHARED</text></svg>
      <div class="vs-side r" style="--c:${B.color}"><b>${esc(B.name)}</b><span>${esc(B.country)} · ${R.nB} stories</span></div>
    </div>

    <div class="kpis rv">
      <div class="kpi"><b>${R.decided.length ? `${R.aWins}–${R.bWins}` : "—"}</b><span>stories reported first (${esc(A.name)}–${esc(B.name)}) <small>${R.decided.length ? `${esc(A.name)} first ${R.winA}% · ${ci(R.winCI)} · n=${R.decided.length}` : "no fair shared stories yet"}</small>${thin(R.solid)}</span></div>
      <div class="kpi"><b>${R.medLead == null ? "—" : dur(Math.abs(R.medLead))}</b><span>median lead — ${R.medLead == null ? "" : R.medLead === 0 ? "level" : esc(R.medLead > 0 ? A.name : B.name) + " ahead"} <small>${R.leadCI ? `95% range: ${lead(R.leadCI[0])} to ${lead(R.leadCI[1])}` : ""} · n=${R.fair.length}</small>${thin(R.fair.length >= 10)}</span></div>
      <div class="kpi"><b>${R.tone ? (R.tone.d >= 0 ? "+" : "") + R.tone.d.toFixed(2) : "—"}</b><span>tone difference on the same stories — ${esc(A.name)} is ${R.tone ? tw(R.tone.d) : "—"} <small>${R.tone?.ci ? `95% range ${R.tone.ci[0].toFixed(2)} to ${R.tone.ci[1].toFixed(2)}${R.tone.ci[0] <= 0 && R.tone.ci[1] >= 0 ? " · not a clear difference" : ""}` : ""}</small></span></div>
      <div class="kpi"><b>${Math.round(100 * R.shared.length / Math.max(1, Math.min(R.nA, R.nB)))}%</b><span>of the smaller outlet's stories were shared <small>${R.shared.length} of ${Math.min(R.nA, R.nB)}</small></span></div>
    </div>

    <div class="panel rv" style="margin-top:20px"><h4>The race — every shared story, by who got there first</h4>
      <div class="race" id="race"></div>
      <div class="mlegend"><span>← ${esc(B.name)} first</span><span>${esc(A.name)} first →</span></div>
      <p class="note">Only stories that broke after both outlets were tracked (since ${day(R.since)}) and that both covered. Hover a dot for the story. Lead time on a log scale.</p>
    </div>

    <div class="two">
      <div class="panel rv"><h4>How they frame the same stories</h4>
        <div class="mirror">${R.frames.map((f, k) => `<div class="mr" style="--k:${k}"><span class="l"><i style="--w:${f.a}%;background:${A.color}"></i><em>${Math.round(f.a)}%</em></span><b>${f.f}</b><span class="r"><i style="--w:${f.b}%;background:${B.color}"></i><em>${Math.round(f.b)}%</em></span></div>`).join("")}</div>
        <div class="mlegend"><span>← ${esc(A.name)}</span><span>${esc(B.name)} →</span></div></div>
      <div class="panel rv"><h4>Signature words on shared stories</h4>
        <div class="vs-words">
          <div><small style="color:${A.color}">${esc(A.name)} says more</small>${R.sigA.map(x => `<span>${esc(x.w)}<em>${x.ya}:${x.yb}</em></span>`).join("") || `<p class="note">No clearly distinctive words.</p>`}</div>
          <div><small style="color:${B.color}">${esc(B.name)} says more</small>${R.sigB.map(x => `<span>${esc(x.w)}<em>${x.yb}:${x.ya}</em></span>`).join("") || `<p class="note">No clearly distinctive words.</p>`}</div>
        </div>
        <p class="note">Weighted log-odds (z &gt; 1.96) on the headlines both wrote about the same stories — words one uses significantly more than the other, not just more often overall.</p></div>
    </div>

    <section><div class="sh"><h2>Side by side</h2><p>${R.shared.length} shared stories. Earlier headline marked.</p>${R.decided.length ? shareBtn("vs") : ""}</div>
      <div class="vs-list">${R.shared.sort((x, y) => y.s.t0 - x.s.t0).map(x => { const d = x.B[1] - x.A[1]; return `<a class="vs-row" href="#/s/${x.s.id}">
        <div class="${d > 0 ? "win" : ""}" style="--c:${A.color}"><small>${d > 0 ? `FIRST · ${dur(d)} ahead` : d < 0 ? `+${dur(-d)}` : "same time"}</small>${esc(x.A[4])}</div>
        <div class="${d < 0 ? "win" : ""}" style="--c:${B.color}"><small>${d < 0 ? `FIRST · ${dur(-d)} ahead` : d > 0 ? `+${dur(d)}` : "same time"}</small>${esc(x.B[4])}</div></a>`; }).join("") || `<p class="note">These two outlets haven't covered the same story this week.</p>`}</div>
    </section>
  </div></section>`;
  reveal(app);
  const go = () => { const x = $("#va").value, y = $("#vb").value; location.hash = `#/vs/${x}/${y === x ? (ids.find(i => i !== x)) : y}`; };
  $("#va").onchange = go; $("#vb").onchange = go; $("#vswap").onclick = () => location.hash = `#/vs/${b}/${a}`;
  wireShare({ vs: R.decided.length && { kicker: "Outlet vs outlet", big: `${A.name} ${R.aWins} – ${R.bWins} ${B.name}`, sub: `Who reported first on the ${R.decided.length} stories both covered${R.medLead ? ` · median lead ${dur(Math.abs(R.medLead))} for ${R.medLead > 0 ? A.name : B.name}` : ""}.`,
    bars: [{ label: A.name, value: R.winA, ci: R.winCI, color: A.color }, { label: B.name, value: Math.round(1000 - R.winA * 10) / 10, ci: R.winCI && [Math.round(1000 - R.winCI[1] * 10) / 10, Math.round(1000 - R.winCI[0] * 10) / 10], color: B.color }],
    foot: `Stories that broke after both were tracked · ${day(R.since)} – ${day(H.updated)}` } });

  // the race: one dot per fair shared story, x = signed log lead time
  const el = $("#race"), W = el.clientWidth || 900, Hh = 150, max = Math.max(60, ...R.fair.map(x => Math.abs(x.B[1] - x.A[1])));
  const X = d => W / 2 + Math.sign(d) * Math.log1p(Math.abs(d)) / Math.log1p(max) * (W / 2 - 16);
  const placed = []; const dots = R.fair.map(x => { const d = x.B[1] - x.A[1], cx = X(d); let cy = Hh / 2, k = 0; while (placed.some(p => Math.hypot(p[0] - cx, p[1] - cy) < 13) && k < 40) { k++; cy = Hh / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12; } placed.push([cx, cy]); return { x, d, cx, cy }; });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" height="${Hh}"><line x1="${W / 2}" x2="${W / 2}" y1="6" y2="${Hh - 6}" stroke="#39405A" stroke-dasharray="3 4"/>
    ${[60, 360, 1440].filter(m => m < max).flatMap(m => [m, -m]).map(m => `<text x="${X(m)}" y="${Hh - 4}" text-anchor="middle" fill="#5B6178" font-size="10" font-family="JetBrains Mono">${dur(Math.abs(m))}</text>`).join("")}
    ${dots.map((p, i) => `<circle cx="${p.cx}" cy="${p.cy}" r="5.5" fill="${p.d > 0 ? A.color : p.d < 0 ? B.color : "#8C93A8"}" stroke="#141821" stroke-width="1.5" class="rd" style="--k:${i}"><title>${esc(p.x.s.h)} — ${p.d === 0 ? "same time" : `${p.d > 0 ? A.name : B.name} first by ${dur(Math.abs(p.d))}`}</title></circle>`).join("")}
    ${dots.length ? "" : `<text x="${W / 2}" y="${Hh / 2}" text-anchor="middle" fill="#8C93A8" font-size="13" font-family="Inter">No fair shared stories yet — check back in a day or two.</text>`}</svg>`;
}
