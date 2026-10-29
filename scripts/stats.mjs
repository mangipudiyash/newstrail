// Small, dependency-free statistics used by build.mjs. Every interval is a 95% interval.
// Headlines are not independent (one story produces many headlines), so headline-level shares are bootstrapped by
// resampling whole stories ("cluster bootstrap"), which gives honest — wider — intervals than treating headlines as coin flips.

/** Wilson score interval for k successes out of n, in percent. Good for small n and for 0% / 100%. */
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [r1(100 * Math.max(0, c - h)), r1(100 * Math.min(1, c + h))];
}
const r1 = x => Math.round(x * 10) / 10;

/** Seeded random numbers, so every build gives the same intervals for the same data. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Cluster bootstrap. `units` is an array of rows (one per story or per stand-alone headline); `stat(sample)` turns a resample
 * of rows into a number. Returns the 2.5th and 97.5th percentiles over B resamples (null values are skipped).
 */
export function bootstrap(units, stat, { B = 1000, seed = 7 } = {}) {
  if (!units.length) return null;
  const rand = rng(seed), vals = [];
  for (let b = 0; b < B; b++) {
    const s = new Array(units.length);
    for (let i = 0; i < units.length; i++) s[i] = units[(rand() * units.length) | 0];
    const v = stat(s); if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length < B * .5) return null;
  vals.sort((a, b) => a - b);
  return [r1(vals[Math.floor(vals.length * .025)]), r1(vals[Math.min(vals.length - 1, Math.floor(vals.length * .975))])];
}

export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** A number is "solid" only with enough independent units and a reasonably tight interval. */
export const solid = (units, ci, maxWidth = 25) => units >= 20 && (!ci || ci[1] - ci[0] <= maxWidth);
