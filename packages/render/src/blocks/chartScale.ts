/**
 * Scale helpers shared by the `chart` kinds (`chart.ts` and `chartKinds.ts`):
 * value formatting, nice tick steps, numeric axis domains, and the SVG opener.
 * Pure arithmetic — no data types, no drawing.
 */

/**
 * Clamps negatives to 0. Only for the part-of-whole kinds (donut, pie,
 * gauge, funnel), where a negative part has no meaning. Every axis chart
 * uses a signed domain ({@link zeroScale}).
 */
export const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

// ─── number formatting ──────────────────────────────────────────────────────
// One vocabulary for every numeric block: thousands grouped (12,480), large
// values compact (1.25M, 340k), a true minus sign (−340k), and the author's
// unit kept. A byte unit (`B`) scales by 1000 (3.2 GB).

/** The minus sign for a negative number: U+2212, not the hyphen. */
export const MINUS = '−';

/** Approximate advance of one `.t-sub` (10px mono) character, in px. */
export const SUB_CH = 6.2;
/** Approximate advance of one `.t-arrow` (9.5px mono, tracked) character, in px. */
export const ARROW_CH = 6.1;

/** Groups thousands and trims float noise: `1234567.891` → `1,234,567.89` (no sign). */
function groupAbs(a: number, maxDecimals: number): string {
  const p = Math.pow(10, maxDecimals);
  const n = Math.round(a * p) / p;
  const [int = '0', frac] = n.toFixed(maxDecimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const tail = frac !== undefined ? frac.replace(/0+$/, '') : '';
  return tail.length > 0 ? `${grouped}.${tail}` : grouped;
}

/** `−` for a negative value that does not round to zero, else `''`. */
function signOf(v: number, text: string): string {
  return v < 0 && /[1-9]/.test(text) ? MINUS : '';
}

/** A grouped number: `12480331` → `12,480,331`; `-0.25` → `−0.25`. */
export function groupNum(v: number, maxDecimals = 2): string {
  if (!Number.isFinite(v)) return String(v);
  const text = groupAbs(Math.abs(v), maxDecimals);
  return signOf(v, text) + text;
}

const SI: ReadonlyArray<readonly [number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];
const BYTE_SI: ReadonlyArray<readonly [number, string]> = [
  [1e15, 'PB'],
  [1e12, 'TB'],
  [1e9, 'GB'],
  [1e6, 'MB'],
  [1e3, 'KB'],
];

/** Rounds to `sig` significant digits and prints without float noise. */
function sigDigits(a: number, sig: number): string {
  if (a === 0) return '0';
  const dp = Math.max(0, sig - (Math.floor(Math.log10(a)) + 1));
  return groupAbs(a, Math.min(dp, 6));
}

/** True when `unit` names bytes, which scale by 1000 into KB / MB / GB. */
export function isByteUnit(unit: string | undefined): boolean {
  if (unit === undefined) return false;
  const u = unit.trim().toLowerCase();
  return u === 'b' || u === 'byte' || u === 'bytes';
}

/** Joins a number and the author's unit; a suffix letter and a word unit get a space (`12.5k ms`). */
function withUnit(num: string, unit: string | undefined): string {
  if (unit === undefined || unit === '') return num;
  if (/[kMBT]$/.test(num) && /^[A-Za-z]/.test(unit)) return `${num} ${unit}`;
  return `${num}${unit}`;
}

/**
 * A value label: grouped below `from` (default 10,000: `1,234`, `0.25`),
 * compact from it (3 significant digits: `12.5k`, `1.25M`, `−340k`), the unit
 * kept. A byte unit scales: `3200000000` with `B` → `3.2 GB`.
 */
export function compactNum(v: number, unit?: string, from = 1e4): string {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (isByteUnit(unit)) {
    // Smallest-first, so a value that rounds up to 1000 of one step (999,600 B)
    // prints in the next step (1 MB) instead of "1,000 KB".
    const steps: ReadonlyArray<readonly [number, string]> = [[1, 'B'], ...[...BYTE_SI].reverse()];
    for (let i = steps.length - 1; i >= 0; i--) {
      const [d, s] = steps[i] ?? [1, 'B'];
      if (a < d && i > 0) continue;
      const text = sigDigits(a / d, 3);
      const up = steps[i + 1];
      if (Number(text.replace(/,/g, '')) >= 1000 && up !== undefined) {
        const t2 = sigDigits(a / up[0], 3);
        return `${signOf(v, t2)}${t2} ${up[1]}`;
      }
      return `${signOf(v, text)}${text} ${s}`;
    }
  }
  if (a < Math.max(from, 1e3)) return withUnit(groupNum(v), unit);
  for (let i = 0; i < SI.length; i++) {
    const [d, s] = SI[i] ?? [1, ''];
    if (a < d) continue;
    let text = sigDigits(a / d, 3);
    let suffix = s;
    // 999,600 rounds to "1000k": step up to the next suffix instead.
    if (Number(text.replace(/,/g, '')) >= 1000 && i > 0) {
      const [d2, s2] = SI[i - 1] ?? [d, s];
      text = sigDigits(a / d2, 3);
      suffix = s2;
    }
    return withUnit(`${signOf(v, text)}${text}${suffix}`, unit);
  }
  return withUnit(groupNum(v), unit);
}

/**
 * The value-label formatter for a chart whose axis reads `ticks`: when the
 * axis prints a suffix (`25k · 50k`), every value from 1,000 up takes one too
 * (`9k`, not `9,000`), so labels and axis speak the same units.
 */
export function valueFormat(ticks: readonly number[], unit?: string): (v: number) => string {
  const top = Math.max(0, ...ticks.map((t) => Math.abs(t)));
  const from = top >= 1e4 ? 1e3 : 1e4;
  return (v) => compactNum(v, unit, from);
}

/** An exact value: every digit, thousands grouped (`2,055,000 USD`). A byte unit still scales. */
export function exactNum(v: number, unit?: string): string {
  if (isByteUnit(unit)) return compactNum(v, unit);
  return withUnit(groupNum(v), unit);
}

/**
 * The tick formatter for one axis: every tick takes the same suffix, chosen
 * from the largest tick (`0 · 2.5M · 5M · 7.5M`), so an axis never mixes
 * `9,000` with `10k`. Below 10,000 the ticks print grouped and whole.
 */
export function axisFormat(ticks: readonly number[], unit?: string): (v: number) => string {
  const top = Math.max(0, ...ticks.map((t) => Math.abs(t)));
  const table = isByteUnit(unit) ? BYTE_SI : SI;
  const pick = isByteUnit(unit) || top >= 1e4 ? table.find(([d]) => top >= d) : undefined;
  if (pick === undefined) {
    if (isByteUnit(unit)) return (v) => `${groupNum(v, 6)} B`;
    return (v) => withUnit(groupNum(v, 6), unit);
  }
  const [d, s] = pick;
  if (isByteUnit(unit)) return (v) => `${groupNum(v / d, 6)} ${s}`;
  return (v) => withUnit(`${groupNum(v / d, 6)}${v === 0 ? '' : s}`, unit);
}

/** Approximate rendered width of `text` at `ch` px per character. */
export function textW(text: string, ch = SUB_CH): number {
  return [...text].length * ch;
}

export interface LinScale {
  /** The axis floor: ≤ 0, a nice tick. */
  readonly lo: number;
  /** The axis ceiling: ≥ 0, a nice tick. */
  readonly hi: number;
  /** Nice ticks from `lo` to `hi`; 0 is always one of them. */
  readonly ticks: readonly number[];
}

/**
 * A zero-anchored nice scale over the data extent: the domain always holds
 * 0, so a bar grows from the baseline in the direction of its sign. `hi`
 * (when > 0) is an author ceiling that wins over the data maximum.
 */
export function zeroScale(dataMin: number, dataMax: number, ceiling?: number): LinScale {
  const top = ceiling !== undefined && ceiling > 0 ? ceiling : Math.max(0, dataMax);
  const bottom = Math.min(0, dataMin);
  if (!(top > bottom)) return { lo: 0, hi: 1, ticks: niceTicks(1) };
  const step = niceStep(top - bottom);
  const lo = bottom < 0 ? Math.floor(bottom / step - 1e-9) * step : 0;
  const hi = top > 0 ? Math.ceil(top / step - 1e-9) * step : 0;
  const ticks: number[] = [];
  const n = Math.round((hi - lo) / step);
  for (let i = 0; i <= n; i++) ticks.push(Math.round((lo + i * step) * 1e6) / 1e6 || 0);
  return { lo: ticks[0] ?? lo, hi: ticks[ticks.length - 1] ?? hi, ticks };
}

/** Formats a value with the optional unit suffix, trimming float noise. */
export function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n}${unit ?? ''}`;
}

/**
 * A nice tick step (1 / 2 / 2.5 / 5 × 10^n) for a span, choosing the step
 * whose tick count over `span` lands in 4–6 (closest to 5).
 */
export function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(span / 5)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestScore = Infinity;
  for (const c of candidates) {
    const n = Math.ceil(span / c - 1e-9);
    const score = n >= 4 && n <= 6 ? Math.abs(n - 5) : 10 + Math.abs(n - 5);
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The nice number (1 / 2 / 2.5 / 5 × 10^n) closest to `raw` in log space —
 * a bin width or a step that should read as a round figure.
 */
export function niceNear(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(Math.log10(c) - Math.log10(raw));
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** Nice ticks from 0 to the first step multiple at or above `max`. */
export function niceTicks(max: number): number[] {
  const step = niceStep(max);
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_v, i) => Math.round(i * step * 1e6) / 1e6);
}

export interface NumScale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** Pads a data extent, snaps it to nice tick multiples, and lists the ticks. */
export function numScale(values: readonly number[]): NumScale {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    // A flat extent can't scale — open a symmetric window around the value.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.2;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Guard float drift so the last tick always lands on `max`.
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { min, max, ticks };
}

/** Rounds to one decimal — the precision SVG coordinates are emitted at. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

export function svgOpenSize(w: number, h: number): string {
  return `<svg viewBox="0 0 ${w} ${h}" role="img"><title>Chart</title>`;
}
