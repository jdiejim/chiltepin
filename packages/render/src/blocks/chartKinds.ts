/**
 * The statistical `chart` kinds — `histogram`, `bell`, `boxplot`, `pareto`,
 * `bullet`, `dumbbell` — split out of `chart.ts` so the file stays readable. Same skin:
 * `rule` hairlines on a `rule-solid` baseline, `.t-sub` tick labels in `soft`,
 * `.t-arrow` value labels on the paper halo, `ink` for the one series, and
 * the accent spent on one answer per drawing (the mean, the median, the vital
 * few, the measure). Every mark carries a `<title>` with its full values.
 * Geometry comes from the data; nothing here reads pixels from the YAML.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { DECORATIVE } from '../svg/decorative.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { FONT, cutTitle, fitText, textWidth } from '../svg/wrapText.js';
import type { Drawn } from './chart.js';
import { MINUS, axisFormat, compactNum, fmt, isByteUnit, niceNear, niceStep, niceTicks, numScale, pos, r1, svgOpenSize } from './chartScale.js';

type ChartData = BlockDataMap['chart'];
type Box = NonNullable<ChartData['boxes']>[number];
type Bullet = NonNullable<ChartData['bullets']>[number];
type Marker = NonNullable<ChartData['markers']>[number];
type Series = NonNullable<ChartData['series']>[number];

/** Rough width of one `.t-sub` / `.t-arrow` mono glyph, for fitting labels. */
const MONO_W = 6;

/** Truncates to `max` characters with an ellipsis; the caller keeps the full text in a `<title>`. */
function cut(text: string, max: number): string {
  const n = Math.max(3, Math.floor(max));
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

/** The finite entries of `values` (a NaN or an Infinity is skipped, not clamped). */
function finite(values: readonly number[] | undefined): number[] {
  return (values ?? []).filter((v) => Number.isFinite(v));
}

/** Rounds away float drift on a bin edge or a tick (`0.30000000000000004` → `0.3`). */
const tidy = (n: number): number => Math.round(n * 1e9) / 1e9;

// ─── binning (histogram, and the bars behind a bell) ────────────────────────

export interface Bin {
  readonly lo: number;
  readonly hi: number;
  readonly count: number;
}

export interface Binned {
  readonly bins: readonly Bin[];
  readonly width: number;
  readonly n: number;
}

/**
 * Bins `values` into `k` equal bins — `k` from `bins` when given, else
 * Sturges (⌈log₂ n⌉ + 1). The bin width is the nice number nearest
 * `span / k`, and the edges sit on multiples of it, so a histogram reads
 * `0, 10, 20, …` rather than `0, 9.9, 19.8, …`; the count of bins follows
 * from the nice width and the data span. The last bin is closed at the top,
 * so the maximum value lands inside it.
 */
export function binValues(values: readonly number[], bins: number | undefined): Binned {
  const xs = finite(values);
  const n = xs.length;
  if (n === 0) return { bins: [], width: 1, n: 0 };
  const k = bins !== undefined && bins > 0 ? Math.max(1, Math.round(bins)) : Math.ceil(Math.log2(n)) + 1;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = max - min;
  const width = span > 0 ? niceNear(span / k) : niceNear(Math.abs(min) / 10 || 1);
  const start = tidy(Math.floor(min / width + 1e-9) * width);
  const count = Math.max(1, Math.ceil((max - start) / width - 1e-9));
  const counts = new Array<number>(count).fill(0);
  for (const v of xs) {
    const i = Math.min(count - 1, Math.max(0, Math.floor((v - start) / width + 1e-9)));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const out: Bin[] = counts.map((c, i) => ({
    lo: tidy(start + i * width),
    hi: tidy(start + (i + 1) * width),
    count: c,
  }));
  return { bins: out, width, n };
}

/** Sample mean, or 0 for an empty list. */
function meanOf(xs: readonly number[]): number {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Sample standard deviation (n − 1), or 0 with fewer than two values. */
function sdOf(xs: readonly number[], mean: number): number {
  if (xs.length < 2) return 0;
  const ss = xs.reduce((a, v) => a + (v - mean) * (v - mean), 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/** A cartesian frame with a nice 0-based y axis, sized to `cats` columns. */
interface Frame {
  readonly width: number;
  readonly height: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly yMax: number;
  readonly ticks: readonly number[];
}

function frameFor(cats: number, ceiling: number, perCat: number, top = 18, rightPad = 18): Frame {
  const width = Math.max(420, Math.min(760, 110 + cats * perCat));
  const height = 250;
  const ticks = niceTicks(ceiling > 0 ? ceiling : 1);
  return { width, height, x0: 52, x1: width - rightPad, y0: top, y1: height - 32, yMax: ticks[ticks.length - 1] ?? 1, ticks };
}

/** Horizontal gridlines with tick labels on the left (`unit` suffixed). */
function yAxis(f: Frame, unit: string | undefined): string {
  let s = '';
  f.ticks.forEach((t, ti) => {
    const y = Math.round(f.y1 - ((f.y1 - f.y0) * t) / f.yMax);
    s += `<line x1="${f.x0}" y1="${y}" x2="${f.x1}" y2="${y}" stroke="${ti === 0 ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${f.x0 - 8}" y="${y + 3}" class="t-sub c-soft" text-anchor="end">${escapeHtml(fmt(t, unit))}</text>`;
  });
  return s;
}

/** The colour a marked item takes: `negative`, `accent`, or the default. */
function markColor(mark: Mark, fallback: string): string {
  if (mark === 'negative') return 'var(--negative)';
  if (mark === 'focal') return 'var(--accent)';
  return fallback;
}

// ─── kind: histogram ─────────────────────────────────────────────────────────
// Raw `values` are binned (see `binValues`); bars touch, x ticks sit on the
// bin edges, y is the count, and the mean is a dashed accent rule. `labels` +
// one `series` instead of `values` means the author pre-binned: labels name
// the bins and the series carries the counts (no mean, it is unknowable).

export function renderHistogram(data: ChartData): Drawn {
  const raw = finite(data.values);
  const preBinned = raw.length === 0 && (data.labels?.length ?? 0) > 0 && (data.series?.length ?? 0) > 0;
  const series0 = data.series?.[0];
  const labels = preBinned ? (data.labels ?? []) : [];
  const binned = preBinned ? undefined : binValues(raw, data.bins);
  const counts = preBinned ? labels.map((_l, i) => pos(series0?.values[i] ?? 0)) : (binned?.bins ?? []).map((b) => b.count);
  const k = counts.length;
  const maxCount = Math.max(0, ...counts);
  const ceiling = data.max !== undefined && data.max > 0 ? data.max : maxCount;
  const f = frameFor(k, ceiling, 50);
  const plotW = f.x1 - f.x0;
  const binW = k > 0 ? plotW / k : plotW;
  const Y = (v: number): number => Math.round(f.y1 - ((f.y1 - f.y0) * Math.min(v, f.yMax)) / f.yMax);

  let s = svgOpenSize(f.width, f.height) + yAxis(f, undefined);

  // Bars: touching, with a ground-coloured seam so neighbours stay separable.
  const showCount = binW >= 22;
  s += `<g${preBinned ? bl('series') : bp('values')}>`;
  counts.forEach((c, i) => {
    const x = r1(f.x0 + binW * i);
    const y = Y(c);
    const h = Math.max(f.y1 - y, c > 0 ? 1 : 0);
    const bin = binned?.bins[i];
    const tip =
      bin !== undefined
        ? `${fmt(bin.lo, data.unit)} – ${fmt(bin.hi, data.unit)}: ${c}`
        : `${labels[i] ?? ''}: ${c}`;
    const path = preBinned ? bp(`series.0.values.${i}`) : '';
    s += `<g${path}>`;
    s += `<rect x="${x}" y="${y}" width="${r1(binW)}" height="${h}" fill="var(--ink)" stroke="var(--paper-2)" stroke-width="1"${c === 0 ? ' opacity="0.35"' : ''}><title>${escapeHtml(tip)}</title></rect>`;
    if (showCount && c > 0) {
      s += `<text x="${r1(x + binW / 2)}" y="${y - 4}" class="t-arrow" text-anchor="middle">${escapeHtml(String(c))}</text>`;
    }
    s += `</g>`;
  });
  s += `</g>`;

  // x labels: bin edges (raw values) or the bin names (pre-binned). When
  // edges would collide, every `every`-th edge is labelled.
  if (preBinned) {
    s += `<g${bl('labels')}>`;
    labels.forEach((label, i) => {
      const text = cut(label, binW / MONO_W);
      const full = text !== label ? `<title>${escapeHtml(label)}</title>` : '';
      s += `<text x="${r1(f.x0 + binW * (i + 0.5))}" y="${f.y1 + 18}" class="t-sub" text-anchor="middle"${bp(`labels.${i}`)}>${escapeHtml(text)}${full}</text>`;
    });
    s += `</g>`;
  } else if (binned !== undefined && binned.bins.length > 0) {
    const edges = [...binned.bins.map((b) => b.lo), binned.bins[binned.bins.length - 1]?.hi ?? 0];
    const widest = Math.max(...edges.map((e) => fmt(e, undefined).length)) * MONO_W + 8;
    const every = Math.max(1, Math.ceil(widest / binW));
    edges.forEach((e, i) => {
      const x = r1(f.x0 + binW * i);
      s += `<line x1="${x}" y1="${f.y1}" x2="${x}" y2="${f.y1 + 4}" stroke="var(--rule-solid)" stroke-width="1"${DECORATIVE}/>`;
      const last = i === edges.length - 1;
      if (i % every !== 0 && !last) return;
      // The last edge carries the unit, once, for the whole axis.
      s += `<text x="${x}" y="${f.y1 + 18}" class="t-sub" text-anchor="${last ? 'end' : i === 0 ? 'start' : 'middle'}">${escapeHtml(fmt(e, last ? data.unit : undefined))}</text>`;
    });
  }

  // Mean: a dashed accent rule with its value at the top.
  const legend: LegendItem[] = [{ swatch: 'fill', fill: 'var(--ink)', label: 'count per bin' }];
  if (binned !== undefined && binned.bins.length > 0 && raw.length > 0) {
    const mean = meanOf(raw);
    const first = binned.bins[0]?.lo ?? 0;
    const lastHi = binned.bins[binned.bins.length - 1]?.hi ?? 1;
    const mx = r1(f.x0 + (plotW * (mean - first)) / (lastHi - first));
    const label = `mean ${fmt(mean, data.unit)}`;
    const flip = mx + label.length * MONO_W + 8 > f.x1;
    s += `<g><title>${escapeHtml(`mean ${fmt(mean, data.unit)} · n = ${raw.length}`)}</title>`;
    s += `<line x1="${mx}" y1="${f.y0 - 4}" x2="${mx}" y2="${f.y1}" stroke="var(--accent)" stroke-width="1.25" stroke-dasharray="5 4"/>`;
    s += `<text x="${flip ? mx - 5 : mx + 5}" y="${f.y0 + 4}" class="t-arrow c-accent"${flip ? ' text-anchor="end"' : ''}>${escapeHtml(label)}</text>`;
    s += `</g>`;
    legend.push({ swatch: 'line-dashed', stroke: 'var(--accent)', label: 'mean' });
  }
  s += `</svg>`;
  return { svg: s, legend: renderLegend(legend) };
}

// ─── kind: bell (a normal curve) ─────────────────────────────────────────────
// μ and σ come from `mean` + `sd`, else are fitted from `values` (sample sd).
// The curve runs over μ ± 3.5 σ; the ±1 σ band takes the accent at low
// opacity and ±2 σ lighter. `markers` are dashed rules labelled at the top
// with their z-score beneath. With enough `values` (or an explicit `bins`),
// the sample histogram sits behind the curve on the same density scale.

interface BellParams {
  readonly mean: number;
  readonly sd: number;
  readonly fitted: boolean;
}

function bellParams(data: ChartData, values: readonly number[]): BellParams {
  if (data.mean !== undefined && data.sd !== undefined && data.sd > 0) {
    return { mean: data.mean, sd: data.sd, fitted: false };
  }
  const mean = data.mean ?? meanOf(values);
  const sd = data.sd !== undefined && data.sd > 0 ? data.sd : sdOf(values, meanOf(values));
  return { mean, sd: sd > 0 && Number.isFinite(sd) ? sd : 1, fitted: true };
}

/** The z-score of `x`, to one decimal. */
export const zScore = (x: number, mean: number, sd: number): number => Math.round(((x - mean) / sd) * 10) / 10;

export function renderBell(data: ChartData): Drawn {
  const values = finite(data.values);
  const { mean, sd, fitted } = bellParams(data, values);
  const markers: readonly Marker[] = (data.markers ?? []).filter((m) => Number.isFinite(m.at));
  const pdf = (x: number): number => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

  // Domain: μ ± 3.5 σ, widened to any marker outside it.
  let lo = mean - 3.5 * sd;
  let hi = mean + 3.5 * sd;
  for (const m of markers) {
    lo = Math.min(lo, m.at - 0.25 * sd);
    hi = Math.max(hi, m.at + 0.25 * sd);
  }
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(tidy(t));

  // The sample histogram behind the curve, when there is enough of a sample.
  const withBars = values.length > 0 && (data.bins !== undefined || values.length >= 20);
  const binned = withBars ? binValues(values, data.bins) : undefined;
  const density = (b: Bin): number => (binned !== undefined && binned.n > 0 ? b.count / (binned.n * binned.width) : 0);
  const barMax = binned !== undefined ? Math.max(0, ...binned.bins.map(density)) : 0;
  if (binned !== undefined) {
    lo = Math.min(lo, binned.bins[0]?.lo ?? lo);
    hi = Math.max(hi, binned.bins[binned.bins.length - 1]?.hi ?? hi);
  }

  // Marker labels take two lines at the top; close neighbours stagger.
  const width = 560;
  const rows = markers.length > 0 ? 1 : 0;
  const x0 = 24;
  const x1 = width - 24;
  const X = (v: number): number => r1(x0 + ((x1 - x0) * (v - lo)) / (hi - lo));
  const sorted = markers
    .map((m, i) => ({ m, i, x: X(m.at) }))
    .sort((a, b) => a.x - b.x);
  const rowOf = new Map<number, number>();
  let prevX = -Infinity;
  let prevRow = 0;
  for (const p of sorted) {
    const row = p.x - prevX < 72 ? (prevRow + 1) % 2 : 0;
    rowOf.set(p.i, row);
    prevX = p.x;
    prevRow = row;
  }
  const staggered = [...rowOf.values()].some((r) => r === 1);
  const top = rows === 0 ? 34 : staggered ? 82 : 56;
  const height = top + 170 + 32;
  const y0 = top;
  const y1 = height - 32;
  const yMax = Math.max(pdf(mean), barMax) * 1.05;
  const Y = (d: number): number => r1(y1 - ((y1 - y0) * d) / yMax);

  let s = svgOpenSize(width, height);
  s += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="var(--rule-solid)" stroke-width="1"${DECORATIVE}/>`;
  for (const t of ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x}" y="${y1 + 18}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(fmt(t, data.unit))}</text>`;
  }

  // Sample histogram, scaled to density so it sits under the same curve.
  if (binned !== undefined) {
    s += `<g${bp('values')}>`;
    for (const b of binned.bins) {
      const d = density(b);
      const bx = X(b.lo);
      const bw = r1(X(b.hi) - bx);
      const by = Y(d);
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="${r1(Math.max(y1 - by, 0))}" fill="var(--ink)" fill-opacity="0.08" stroke="var(--rule-solid)" stroke-width="1"><title>${escapeHtml(`${fmt(b.lo, data.unit)} – ${fmt(b.hi, data.unit)}: ${b.count} of ${binned.n}`)}</title></rect>`;
    }
    s += `</g>`;
  }

  // Curve samples, always including μ so the peak lands exactly on the mean.
  const N = 140;
  const dx = (hi - lo) / N;
  const K = Math.ceil(Math.max(mean - lo, hi - mean) / dx);
  const xs: number[] = [lo];
  for (let k = -K; k <= K; k++) {
    const x = mean + k * dx;
    if (x > lo && x < hi) xs.push(x);
  }
  xs.push(hi);
  const pt = (x: number): string => `${X(x)},${Y(pdf(x))}`;
  const bandPath = (from: number, to: number): string => {
    const inside = xs.filter((x) => x > from && x < to);
    const pts = [from, ...inside, to].map(pt);
    return `M ${X(from)},${y1} L ${pts.join(' L ')} L ${X(to)},${y1} Z`;
  };
  s += `<path d="${bandPath(mean - 2 * sd, mean + 2 * sd)}" fill="var(--accent)" fill-opacity="0.1" stroke="none"><title>${escapeHtml(`μ ± 2σ: ${fmt(mean - 2 * sd, data.unit)} – ${fmt(mean + 2 * sd, data.unit)} (95.4%)`)}</title></path>`;
  s += `<path d="${bandPath(mean - sd, mean + sd)}" fill="var(--accent)" fill-opacity="0.22" stroke="none"><title>${escapeHtml(`μ ± 1σ: ${fmt(mean - sd, data.unit)} – ${fmt(mean + sd, data.unit)} (68.3%)`)}</title></path>`;
  s += `<path class="chart-bell" d="M ${xs.map(pt).join(' L ')}" fill="none" stroke="var(--ink)" stroke-width="1.75" stroke-linejoin="round"><title>${escapeHtml(`normal curve, μ = ${fmt(mean, data.unit)}, σ = ${fmt(sd, data.unit)}`)}</title></path>`;
  // The mean: a hairline from the baseline up to the peak.
  s += `<line class="chart-bell-mean" x1="${X(mean)}" y1="${Y(pdf(mean))}" x2="${X(mean)}" y2="${y1}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="2 3"><title>${escapeHtml(`μ = ${fmt(mean, data.unit)}`)}</title></line>`;

  // Markers: dashed rules, label on top, z-score beneath.
  const marks = marksOf(markers.map((m) => m.accent));
  if (markers.length > 0) s += `<g${bl('markers')}>`;
  markers.forEach((m, i) => {
    const x = X(m.at);
    const row = rowOf.get(i) ?? 0;
    const color = markColor(marks[i], 'var(--ink)');
    const z = zScore(m.at, mean, sd);
    const labelY = 12 + row * 26;
    const anchor = x < x0 + 40 ? 'start' : x > x1 - 40 ? 'end' : 'middle';
    s += `<g${bp(`markers.${i}`)}><title>${escapeHtml(`${m.label} at ${fmt(m.at, data.unit)} · z = ${z.toFixed(1)}`)}</title>`;
    s += `<line x1="${x}" y1="${labelY + 16}" x2="${x}" y2="${y1}" stroke="${color}" stroke-width="1.25" stroke-dasharray="5 4"/>`;
    s += `<text x="${x}" y="${labelY}" class="t-sub c-ink" text-anchor="${anchor}"${bp(`markers.${i}.label`)}>${escapeHtml(m.label)}</text>`;
    s += `<text x="${x}" y="${labelY + 12}" class="t-arrow" text-anchor="${anchor}">${escapeHtml(`z = ${z.toFixed(1)}`)}</text>`;
    s += `</g>`;
  });
  if (markers.length > 0) s += `</g>`;

  // μ / σ in the top corner — the left one unless a marker label sits there.
  const cornerRight = sorted.some((p) => p.x < x0 + 110 && (rowOf.get(p.i) ?? 0) === 0);
  const cx = cornerRight ? x1 - 2 : x0 + 2;
  const anchor = cornerRight ? 'end' : 'start';
  const statY = 12;
  s += `<text x="${cx}" y="${statY}" class="t-sub c-ink" text-anchor="${anchor}">${escapeHtml(`μ = ${fmt(mean, data.unit)}`)}</text>`;
  s += `<text x="${cx}" y="${statY + 13}" class="t-sub c-ink" text-anchor="${anchor}">${escapeHtml(`σ = ${fmt(sd, data.unit)}${fitted ? ` · n = ${values.length}` : ''}`)}</text>`;
  s += `</svg>`;

  const legend: LegendItem[] = [
    { swatch: 'fill', fill: 'var(--accent)', label: '±1 σ · 68%' },
    { swatch: 'fill', fill: 'var(--accent-tint)', label: '±2 σ · 95%' },
  ];
  if (markers.length > 0) legend.push({ swatch: 'line-dashed', stroke: 'var(--ink)', label: 'marker (z-score)' });
  if (binned !== undefined) legend.push({ swatch: 'node-fill2', label: 'sample histogram (density)' });
  return { svg: s, legend: renderLegend(legend) };
}

// ─── kind: boxplot ───────────────────────────────────────────────────────────
// One vertical box per five-number summary: whiskers min→q1 and q3→max with
// end caps, the q1–q3 box in `paper-2` with an ink outline, the median as a
// bold accent line, outliers as small hollow circles.

export function renderBoxplot(data: ChartData): Drawn {
  const boxes: readonly Box[] = data.boxes ?? [];
  const n = boxes.length;
  const all = boxes.flatMap((b) => [b.min, b.q1, b.median, b.q3, b.max, ...(b.outliers ?? [])]).filter(Number.isFinite);
  const sy = numScale(all.length > 0 ? all : [0, 1]);
  const width = Math.max(420, Math.min(760, 110 + n * 96));
  const height = 260;
  const x0 = 52;
  const x1 = width - 18;
  const y0 = 18;
  const y1 = height - 32;
  const Y = (v: number): number => r1(y1 - ((y1 - y0) * (v - sy.min)) / (sy.max - sy.min));
  const slot = n > 0 ? (x1 - x0) / n : x1 - x0;
  const boxW = Math.min(56, Math.round(slot * 0.5));

  let s = svgOpenSize(width, height);
  for (const t of sy.ticks) {
    const y = Y(t);
    s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t === sy.min ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x0 - 8}" y="${y + 3}" class="t-sub c-soft" text-anchor="end">${escapeHtml(fmt(t, data.unit))}</text>`;
  }

  const marks = marksOf(boxes.map((b) => b.accent));
  let outliers = 0;
  s += `<g${bl('boxes')}>`;
  boxes.forEach((b, i) => {
    const cx = r1(x0 + slot * (i + 0.5));
    const mark = marks[i];
    const stroke = markColor(mark, 'var(--ink)');
    const fill = mark === 'focal' ? 'var(--accent-tint)' : mark === 'negative' ? 'var(--negative-tint)' : 'var(--paper-2)';
    const median = markColor(mark, 'var(--accent)');
    const lo = Math.min(b.min, b.q1);
    const hi = Math.max(b.max, b.q3);
    const q1 = Math.min(b.q1, b.q3);
    const q3 = Math.max(b.q1, b.q3);
    const tip = `${b.label} — min ${fmt(b.min, data.unit)} · q1 ${fmt(b.q1, data.unit)} · median ${fmt(b.median, data.unit)} · q3 ${fmt(b.q3, data.unit)} · max ${fmt(b.max, data.unit)}`;
    const cap = Math.round(boxW / 2);
    s += `<g${bp(`boxes.${i}`)}><title>${escapeHtml(tip)}</title>`;
    // Whiskers with end caps.
    s += `<line x1="${cx}" y1="${Y(lo)}" x2="${cx}" y2="${Y(q1)}" stroke="${stroke}" stroke-width="1.25"/>`;
    s += `<line x1="${cx}" y1="${Y(q3)}" x2="${cx}" y2="${Y(hi)}" stroke="${stroke}" stroke-width="1.25"/>`;
    s += `<line x1="${cx - cap / 2}" y1="${Y(lo)}" x2="${cx + cap / 2}" y2="${Y(lo)}" stroke="${stroke}" stroke-width="1.25"/>`;
    s += `<line x1="${cx - cap / 2}" y1="${Y(hi)}" x2="${cx + cap / 2}" y2="${Y(hi)}" stroke="${stroke}" stroke-width="1.25"/>`;
    // The box (q1 → q3).
    const by = Y(q3);
    const bh = Math.max(r1(Y(q1) - by), 1);
    s += `<rect x="${cx - boxW / 2}" y="${by}" width="${boxW}" height="${bh}" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>`;
    // The median, bold.
    s += `<line class="chart-median" x1="${cx - boxW / 2}" y1="${Y(b.median)}" x2="${cx + boxW / 2}" y2="${Y(b.median)}" stroke="${median}" stroke-width="2.5"${bp(`boxes.${i}.median`)}><title>${escapeHtml(`${b.label} median ${fmt(b.median, data.unit)}`)}</title></line>`;
    // Outliers.
    (b.outliers ?? []).filter(Number.isFinite).forEach((o, oi) => {
      outliers++;
      s += `<circle class="chart-outlier" cx="${cx}" cy="${Y(o)}" r="3" fill="var(--paper)" stroke="${stroke}" stroke-width="1.25"${bp(`boxes.${i}.outliers.${oi}`)}><title>${escapeHtml(`${b.label} outlier ${fmt(o, data.unit)}`)}</title></circle>`;
    });
    // Category label.
    const text = cut(b.label, slot / MONO_W);
    const full = text !== b.label ? `<title>${escapeHtml(b.label)}</title>` : '';
    s += `<text x="${cx}" y="${y1 + 18}" class="t-sub" text-anchor="middle"${bp(`boxes.${i}.label`)}>${escapeHtml(text)}${full}</text>`;
    s += `</g>`;
  });
  s += `</g></svg>`;

  const legend: LegendItem[] = [
    { swatch: 'node-fill2', label: 'box = q1 – q3' },
    { swatch: 'line', stroke: 'var(--accent)', label: 'median' },
    { swatch: 'line', stroke: 'var(--ink)', label: 'whiskers = min – max' },
  ];
  if (outliers > 0) legend.push({ swatch: 'node-dot', label: 'outlier' });
  if (marks.includes('focal')) legend.push({ swatch: 'node-accent', label: 'focal' });
  if (marks.includes('negative')) legend.push({ swatch: 'node-negative', label: 'negative' });
  return { svg: s, legend: renderLegend(legend) };
}

// ─── kind: pareto ────────────────────────────────────────────────────────────
// `items` sorted by value, descending: bars on the left axis, the cumulative
// share as a line with dots on the right axis (0–100%), a dashed 80% rule.
// The bars up to and including the one that crosses 80% are the vital few
// and take the accent; the rest are muted.

export function renderPareto(data: ChartData): Drawn {
  const source = data.items ?? [];
  const items = source
    .map((it, i) => ({ it, i, v: pos(it.value) }))
    .sort((a, b) => b.v - a.v || a.i - b.i);
  const n = items.length;
  const total = items.reduce((a, p) => a + p.v, 0);
  const dataMax = Math.max(0, ...items.map((p) => p.v));
  const ceiling = data.max !== undefined && data.max > 0 ? data.max : dataMax;
  const f = frameFor(n, ceiling, 64, 18, 52);
  const slot = n > 0 ? (f.x1 - f.x0) / n : f.x1 - f.x0;
  const barW = r1(Math.min(56, slot * 0.6));
  const Y = (v: number): number => Math.round(f.y1 - ((f.y1 - f.y0) * Math.min(v, f.yMax)) / f.yMax);
  const Yr = (pct: number): number => r1(f.y1 - ((f.y1 - f.y0) * pct) / 100);

  let s = svgOpenSize(f.width, f.height) + yAxis(f, data.unit);
  // Right axis: cumulative percent, 0–100 by 20.
  for (let p = 0; p <= 100; p += 20) {
    s += `<text x="${f.x1 + 8}" y="${Yr(p) + 3}" class="t-sub c-soft">${p}%</text>`;
  }
  // The 80% rule.
  s += `<line x1="${f.x0}" y1="${Yr(80)}" x2="${f.x1}" y2="${Yr(80)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 4"><title>80% of the total</title></line>`;

  let running = 0;
  let vital = true;
  const pts: string[] = [];
  const dots: string[] = [];
  s += `<g${bl('items')}>`;
  items.forEach((p, pi) => {
    running += p.v;
    const cum = total > 0 ? (running / total) * 100 : 0;
    const share = total > 0 ? (p.v / total) * 100 : 0;
    const x = r1(f.x0 + slot * pi + (slot - barW) / 2);
    const y = Y(p.v);
    const h = Math.max(f.y1 - y, p.v > 0 ? 1 : 0);
    const cx = r1(x + barW / 2);
    const fill = vital ? 'var(--accent)' : 'var(--muted)';
    const tip = `${p.it.label} — ${fmt(p.v, data.unit)} (${Math.round(share * 10) / 10}%) · cumulative ${Math.round(cum * 10) / 10}%`;
    s += `<g class="${vital ? 'chart-vital' : 'chart-rest'}"${bp(`items.${p.i}`)}>`;
    s += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}"${h <= 1 ? ' opacity="0.35"' : ''}><title>${escapeHtml(tip)}</title></rect>`;
    s += `<text x="${cx}" y="${y - 4}" class="t-arrow" text-anchor="middle">${escapeHtml(fmt(p.v, data.unit))}</text>`;
    const text = cut(p.it.label, slot / MONO_W);
    const full = text !== p.it.label ? `<title>${escapeHtml(p.it.label)}</title>` : '';
    s += `<text x="${cx}" y="${f.y1 + 18}" class="t-sub" text-anchor="middle"${bp(`items.${p.i}.label`)}>${escapeHtml(text)}${full}</text>`;
    s += `</g>`;
    const cy = Yr(cum);
    pts.push(`${cx},${cy}`);
    dots.push(`<circle class="chart-cum" cx="${cx}" cy="${cy}" r="3" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"><title>${escapeHtml(`cumulative ${Math.round(cum * 10) / 10}% after ${p.it.label}`)}</title></circle>`);
    if (cum >= 80 - 1e-9) vital = false;
  });
  s += `</g>`;
  if (pts.length > 1) {
    s += `<polyline class="chart-cum-line" points="${pts.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.75" stroke-linejoin="round"/>`;
  }
  s += dots.join('');
  s += `</svg>`;

  const legend: LegendItem[] = [
    { swatch: 'fill', fill: 'var(--accent)', label: 'bars = value · the vital few, to 80%' },
    { swatch: 'fill', fill: 'var(--muted)', label: 'bars = value · the rest' },
    { swatch: 'line-dot', label: 'line = cumulative %' },
    { swatch: 'line-dashed', label: '80% rule' },
  ];
  return { svg: s, legend: renderLegend(legend, 'items') };
}

// ─── kind: bullet ────────────────────────────────────────────────────────────
// One 28px row per entry: the label, qualitative `ranges` as stacked bands
// (poor → good, the poorest darkest), the measure as a thin accent bar from
// 0, the target as a short ink tick, the value at the bar's end. All rows
// share one x scale — the nice ceiling above every range, value and target.

const BU_ROW = 28;
const BU_WIDTH = 600;

/** Band opacities, poorest first, for 1–3 ranges (a 4th+ reuses the lightest). */
const BU_BAND: Readonly<Record<number, readonly number[]>> = {
  1: [0.16],
  2: [0.28, 0.12],
  3: [0.32, 0.2, 0.09],
};

export function renderBullet(data: ChartData): Drawn {
  const rows: readonly Bullet[] = data.bullets ?? [];
  const n = rows.length;
  const extent = rows.flatMap((b) => [pos(b.value), ...(b.target !== undefined ? [pos(b.target)] : []), ...(b.ranges ?? []).map(pos)]);
  const ceiling = data.max !== undefined && data.max > 0 ? data.max : Math.max(0, ...extent);
  const ticks = niceTicks(ceiling > 0 ? ceiling : 1);
  const xMax = ticks[ticks.length - 1] ?? 1;
  const longest = Math.max(0, ...rows.map((b) => b.label.length));
  const labelW = Math.min(180, Math.max(64, longest * 7 + 14));
  const labelChars = Math.floor((labelW - 14) / 7);
  const x0 = labelW;
  const x1 = BU_WIDTH - 66;
  const top = 6;
  const height = top + n * BU_ROW + 24;
  const X = (v: number): number => r1(x0 + ((x1 - x0) * Math.min(v, xMax)) / xMax);

  let s = svgOpenSize(BU_WIDTH, height);
  // Vertical hairlines at the ticks, labels under the last row.
  const axisY = top + n * BU_ROW + 2;
  for (const t of ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${axisY}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x}" y="${axisY + 14}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(fmt(t, data.unit))}</text>`;
  }
  s += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--rule-solid)" stroke-width="1"${DECORATIVE}/>`;

  const marks = marksOf(rows.map((b) => b.accent));
  let bands = 0;
  let targets = 0;
  s += `<g${bl('bullets')}>`;
  rows.forEach((b, i) => {
    const y = top + i * BU_ROW;
    const mid = y + 14;
    // The bar is clamped to the scale; every printed number is the true value.
    const value = pos(b.value);
    const tip = `${b.label} — ${fmt(b.value, data.unit)}${b.target !== undefined ? ` of target ${fmt(b.target, data.unit)}` : ''}`;
    s += `<g${bp(`bullets.${i}`)}><title>${escapeHtml(tip)}</title>`;
    // Label.
    const text = cut(b.label, labelChars);
    const full = text !== b.label ? `<title>${escapeHtml(b.label)}</title>` : '';
    s += `<text x="0" y="${mid + 4}" class="t-name"${bp(`bullets.${i}.label`)}>${escapeHtml(text)}${full}</text>`;
    // Bands: widest (best) first, so each narrower, darker band paints over it.
    const ranges = [...(b.ranges ?? []).map(pos)].sort((p, q) => p - q);
    const ops = BU_BAND[Math.min(ranges.length, 3)] ?? [];
    if (ranges.length > 0) s += `<g${bl(`bullets.${i}.ranges`)}>`;
    for (let j = ranges.length - 1; j >= 0; j--) {
      const r = ranges[j] ?? 0;
      const op = ops[Math.min(j, ops.length - 1)] ?? 0.1;
      bands++;
      s += `<rect class="chart-band" x="${x0}" y="${y + 4}" width="${r1(X(r) - x0)}" height="20" fill="var(--muted)" fill-opacity="${op}"${bp(`bullets.${i}.ranges.${j}`)}><title>${escapeHtml(`${b.label} range ${j + 1}: up to ${fmt(r, data.unit)}`)}</title></rect>`;
    }
    if (ranges.length > 0) s += `</g>`;
    // The measure.
    const vx = X(value);
    const barColor = marks[i] === 'negative' ? 'var(--negative)' : 'var(--accent)';
    s += `<rect class="chart-measure" x="${x0}" y="${mid - 4}" width="${r1(Math.max(vx - x0, value > 0 ? 1 : 0))}" height="8" fill="${barColor}"${bp(`bullets.${i}.value`)}><title>${escapeHtml(`${b.label} ${fmt(b.value, data.unit)}`)}</title></rect>`;
    // The target tick.
    let textX = vx + 6;
    if (b.target !== undefined && Number.isFinite(b.target)) {
      targets++;
      const tx = X(pos(b.target));
      s += `<rect class="chart-target" x="${r1(tx - 1)}" y="${y + 5}" width="2" height="18" fill="var(--ink)"${bp(`bullets.${i}.target`)}><title>${escapeHtml(`${b.label} target ${fmt(b.target, data.unit)}`)}</title></rect>`;
      // The value text steps past a target tick that sits just after the bar.
      if (tx >= vx - 2 && tx < textX + 4) textX = tx + 6;
    }
    s += `<text x="${r1(textX)}" y="${mid + 3.5}" class="t-arrow c-ink">${escapeHtml(fmt(b.value, data.unit))}</text>`;
    s += `</g>`;
  });
  s += `</g></svg>`;

  const legend: LegendItem[] = [{ swatch: 'fill', fill: 'var(--accent)', label: 'measure' }];
  if (targets > 0) legend.push({ swatch: 'line', stroke: 'var(--ink)', label: 'target' });
  if (bands > 0) legend.push({ swatch: 'node-fill2', label: 'qualitative ranges (darkest = poorest)' });
  if (marks.includes('negative')) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  return { svg: s, legend: renderLegend(legend, 'bullets') };
}

// ─── kind: dumbbell ──────────────────────────────────────────────────────────
// One row per label, one dot per series on a shared value axis, and a
// connector from the lowest dot of the row to the highest. The first series
// is the baseline in a neutral grey, the last is the answer in the accent, and
// a series between them takes a category hue. The value column reads
// "first → last" in mono, the last value bold in its series colour, then a
// signed change (`+1.5`, `−0.4`): the sign, not a colour, says which way the
// row moved, so a fall reads as clearly as a rise. The axis runs `min` → `max`
// when the author gives them, else over a nice domain from the data that takes
// in 0 only when the data sits near it. A value past an authored end sits on
// that end with an outward chevron and still prints its true value. Dots that
// would cover each other split above and below the track, each at its true x.

/** A one-line row, px. */
const DB_ROW = 28;
/** Baseline-to-baseline distance of a wrapped row label (13px name). */
const DB_LINE_H = 15;
/** Dot radius. */
const DB_R = 5;
/** The widest label column; a longer label wraps. */
const DB_LABEL_MAX = 168;
/** The most lines a row label takes before it is cut (and reported). */
const DB_LABEL_LINES = 4;
/** Gap between the label column, the track and the value column: room for an end dot and its chevron. */
const DB_GAP = 18;
/** Left and right margin of the drawing (keeps the text halo inside the viewBox). */
const DB_PAD = 4;
/**
 * The drawing width the track stretches or shrinks toward. At 540 the whole
 * figure fits a 400 px phone at the stage's 0.62 floor, with no sideways
 * scroll, and the 13px row labels stay above 8 px.
 */
const DB_TARGET_W = 540;
const DB_TRACK_MIN = 220;
const DB_TRACK_MAX = 340;
/** Dots closer than this, centre to centre (px), split above and below the track. */
const DB_CLASH = 2 * DB_R - 2;
/**
 * The hues a series between the first and the last takes, in order. Amber
 * comes last: next to the orange accent it is the pair `DESIGN.md` warns of.
 */
const DB_HUES = ['blue', 'violet', 'teal', 'green', 'rose', 'amber'] as const;

/** The value axis of a dumbbell: its two ends and the tick values on it. */
export interface DumbbellScale {
  readonly lo: number;
  readonly hi: number;
  readonly ticks: readonly number[];
}

/** Nice ticks inside [lo, hi], plus either end that sits half a step or more from its nearest tick. */
function ticksIn(lo: number, hi: number): number[] {
  const step = niceStep(hi - lo);
  const start = Math.ceil(lo / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let i = 0; start + i * step <= hi + step * 1e-6; i++) ticks.push(tidy(start + i * step) + 0);
  const first = ticks[0];
  if (first === undefined || first - lo >= step / 2) ticks.unshift(tidy(lo));
  const last = ticks[ticks.length - 1] ?? lo;
  if (hi - last >= step / 2) ticks.push(tidy(hi));
  return ticks;
}

/**
 * The shared value axis. `min` and `max` are the author's ends; a missing end
 * comes from the data, snapped to a nice step. A data-driven floor drops to 0
 * only when the data sits nearer 0 than a third of its own span — otherwise
 * 0 would squeeze every difference into a corner.
 */
export function dumbbellScale(values: readonly number[], min?: number, max?: number): DumbbellScale {
  const xs = finite(values);
  let floor = min !== undefined && Number.isFinite(min) ? min : undefined;
  let ceil = max !== undefined && Number.isFinite(max) ? max : undefined;
  if (floor !== undefined && ceil !== undefined) {
    if (ceil > floor) return { lo: floor, hi: ceil, ticks: ticksIn(floor, ceil) };
    floor = undefined;
    ceil = undefined;
  }
  let a = floor ?? (xs.length > 0 ? Math.min(...xs) : 0);
  let b = ceil ?? (xs.length > 0 ? Math.max(...xs) : 1);
  if (floor === undefined && a > 0 && a < (b - a) / 3) a = 0;
  if (ceil === undefined && b < 0 && -b < (b - a) / 3) b = 0;
  if (!(b > a)) {
    // One value (or an author end past all the data): open a window around it.
    const pad = a !== 0 ? Math.abs(a) * 0.1 : 1;
    if (floor === undefined && ceil === undefined) {
      a -= pad;
      b += pad;
    } else if (floor === undefined) {
      a = b - 2 * pad;
    } else {
      b = a + 2 * pad;
    }
  }
  const step = niceStep(b - a);
  // `+ 0` turns a -0 (a ceiling rounded up to zero) into 0.
  const lo = floor ?? tidy(Math.floor(a / step + 1e-9) * step) + 0;
  const hi = ceil ?? tidy(Math.ceil(b / step - 1e-9) * step) + 0;
  return { lo, hi, ticks: ticksIn(lo, hi) };
}

/** Decimal places of `v` as written, at most 2. */
function decimalsOf(v: number): number {
  const s = String(Math.round(Math.abs(v) * 100) / 100);
  const dot = s.indexOf('.');
  return s.includes('e') || dot < 0 ? 0 : s.length - dot - 1;
}

/** `v` to exactly `dp` decimals, thousands grouped, with a true minus (`−1,204.50`). */
function fixedNum(v: number, dp: number): string {
  const [int = '0', frac] = Math.abs(v).toFixed(dp).split('.');
  const text = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac !== undefined ? `.${frac}` : '');
  return (v < 0 && /[1-9]/.test(text) ? MINUS : '') + text;
}

/** A change with its sign: `+1.5`, `−0.4`, or `±0.0` when nothing moved. */
function signed(d: number, abs: string): string {
  if (!/[1-9]/.test(abs)) return `±${abs}`;
  return `${d < 0 ? MINUS : '+'}${abs}`;
}

/** How the value column prints numbers. */
interface DbFormat {
  /** A value, unit included. */
  readonly val: (v: number) => string;
  /** A value with no unit (the first of a pair; the unit follows the last). */
  readonly bare: (v: number) => string;
  /** A signed change, no unit: `+1.5`, `−90`. */
  readonly delta: (d: number) => string;
}

/**
 * One number vocabulary per chart: every value to the same decimals as the
 * most precise one (`5.0` beside `3.5`, so the column lines up), compact past
 * 10,000 (`1.25M`), and a byte unit scaled the way the axis scales it.
 */
function dumbbellFormat(values: readonly number[], ticks: readonly number[], unit: string | undefined): DbFormat {
  if (isByteUnit(unit)) {
    const val = (v: number): string => compactNum(v, unit);
    return { val, bare: val, delta: (d) => signed(d, compactNum(Math.abs(d), unit)) };
  }
  const suffix = (num: string): string =>
    unit === undefined || unit === '' ? num : /[kMBT]$/.test(num) && /^[A-Za-z]/.test(unit) ? `${num} ${unit}` : `${num}${unit}`;
  const top = Math.max(0, ...values.map(Math.abs), ...ticks.map(Math.abs));
  const bare =
    top >= 1e4
      ? (v: number): string => compactNum(v, undefined, 1e3)
      : ((dp) => (v: number): string => fixedNum(v, dp))(Math.min(2, Math.max(0, ...values.map(decimalsOf))));
  return { val: (v) => suffix(bare(v)), bare, delta: (d) => signed(d, bare(Math.abs(d))) };
}

/** How one series draws: its dot colour and the text class of a value printed in it. */
export interface DbPaint {
  readonly color: string;
  readonly text: string;
}

/**
 * The colour of each series. One series is `ink` (nothing to tell apart).
 * Of several, the focal one — the series the author flagged with `accent`,
 * else the last — takes the accent; the first is the neutral baseline; any
 * other takes a category hue. `accent: red` marks a series `negative`.
 */
export function dumbbellPaints(series: ReadonlyArray<Pick<Series, 'accent'>>): DbPaint[] {
  const k = series.length;
  const marks = marksOf(series.map((s) => s.accent));
  const flagged = marks.indexOf('focal');
  const focal = flagged >= 0 ? flagged : k - 1;
  let h = 0;
  return series.map((_s, i) => {
    if (marks[i] === 'negative') return { color: 'var(--negative)', text: 'c-negative' };
    if (k === 1) return { color: 'var(--ink)', text: 'c-ink' };
    if (i === focal) return { color: 'var(--accent)', text: 'c-accent' };
    if (i === 0) return { color: 'var(--soft)', text: 'c-soft' };
    const hue = DB_HUES[h++ % DB_HUES.length] ?? 'blue';
    return { color: `var(--hue-${hue})`, text: `c-${hue}` };
  });
}

/** One dot as drawn: its series, true value, x, vertical split, and which end it ran past (−1, 0, 1). */
interface DbDot {
  readonly si: number;
  readonly v: number;
  readonly x: number;
  readonly out: -1 | 0 | 1;
  dy: number;
}

/** The runs of dots closer than {@link DB_CLASH} to their neighbour, left to right. */
function clashRuns(dots: readonly DbDot[]): DbDot[][] {
  const runs: DbDot[][] = [];
  let run: DbDot[] = [];
  for (const d of [...dots].sort((a, b) => a.x - b.x || a.si - b.si)) {
    const prev = run[run.length - 1];
    if (prev !== undefined && d.x - prev.x >= DB_CLASH) {
      runs.push(run);
      run = [];
    }
    run.push(d);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** The row height a run of `m` split dots needs, px. */
const splitNeed = (m: number): number => (m - 1) * (2 * DB_R + 1) + 2 * DB_R + 6;

/**
 * Splits dots that would cover each other: each run of dots closer than
 * {@link DB_CLASH} spreads above and below the track, first series on top.
 * Every dot keeps its true x; only the vertical moves, inside the row.
 */
function splitDots(dots: DbDot[], rowH: number): void {
  for (const run of clashRuns(dots)) {
    const m = run.length;
    if (m < 2) continue;
    const step = Math.min(2 * DB_R + 1, (rowH - 2 * DB_R - 6) / (m - 1));
    [...run].sort((a, b) => a.si - b.si).forEach((d, j) => {
      d.dy = r1((j - (m - 1) / 2) * step);
    });
  }
}

export function renderDumbbell(data: ChartData): Drawn {
  const series: readonly Series[] = data.series ?? [];
  const k = series.length;
  // Rows are the labels; with none, the longest series numbers them (1, 2, 3, …).
  const tagLabels = (data.labels?.length ?? 0) > 0;
  const n = tagLabels ? (data.labels?.length ?? 0) : Math.max(0, ...series.map((sr) => sr.values.length));
  const labels = tagLabels ? (data.labels ?? []) : Array.from({ length: n }, (_v, i) => String(i + 1));
  const valueAt = (si: number, ri: number): number | undefined => {
    const v = series[si]?.values[ri];
    return v !== undefined && Number.isFinite(v) ? v : undefined;
  };
  const all = series.flatMap((sr) => finite(sr.values.slice(0, n)));
  const sc = dumbbellScale(all, data.min, data.max);
  const tick = axisFormat(sc.ticks, data.unit);
  const f = dumbbellFormat(all, sc.ticks, data.unit);
  const paints = dumbbellPaints(series);
  const paintOf = (si: number): DbPaint => paints[si] ?? { color: 'var(--ink)', text: 'c-ink' };

  // The value column: "first → last" and the change, three right-aligned
  // columns so digits line up row to row. One series prints its value alone.
  const cols = labels.map((_l, i) => {
    const a = valueAt(0, i);
    if (k < 2) return { a: a !== undefined ? f.val(a) : '–', b: '', d: '' };
    const b = valueAt(k - 1, i);
    return {
      a: a !== undefined ? f.bare(a) : '–',
      b: b !== undefined ? f.val(b) : '–',
      d: a !== undefined && b !== undefined ? f.delta(b - a) : '',
    };
  });
  const wOf = (key: 'a' | 'b' | 'd'): number => Math.max(0, ...cols.map((c) => textWidth(c[key], FONT.sub)));
  const wA = wOf('a');
  const wB = wOf('b');
  const wD = wOf('d');
  const ARROW = 17;
  const valueW = wA + (k >= 2 ? ARROW + wB : 0) + (wD > 0 ? 12 + wD : 0);

  // Row labels wrap to the label column (up to four lines); a cut is shown and reported.
  const longest = Math.max(0, ...labels.map((l) => textWidth(l, FONT.name)));
  const colW = Math.max(24, Math.min(DB_LABEL_MAX, Math.ceil(longest)));
  const plan = labels.map((l, i) =>
    fitText(l, {
      width: colW,
      font: FONT.name,
      maxLines: DB_LABEL_LINES,
      ...(tagLabels ? { report: { field: 'label', path: `labels.${i}`, hint: 'Shorten the row label, or split the chart.' } } : {}),
    }),
  );
  const labelW = Math.ceil(Math.max(24, ...plan.flatMap((w) => w.lines.map((ln) => textWidth(ln, FONT.name)))));

  const x0 = DB_PAD + labelW + DB_GAP;
  const trackW = Math.round(Math.max(DB_TRACK_MIN, Math.min(DB_TRACK_MAX, DB_TARGET_W - (x0 + DB_GAP + valueW + DB_PAD))));
  const x1 = x0 + trackW;
  const vx = x1 + DB_GAP;
  const width = Math.ceil(vx + valueW + DB_PAD);
  const span = sc.hi - sc.lo || 1;
  const X = (v: number): number => r1(x0 + (trackW * (Math.min(Math.max(v, sc.lo), sc.hi) - sc.lo)) / span);
  // The dots of each row, on their true x. A row grows to hold its label
  // lines, and a run of three or more dots that must split.
  const rowDots = labels.map((_l, i) => {
    const dots: DbDot[] = [];
    series.forEach((_sr, si) => {
      const v = valueAt(si, i);
      if (v !== undefined) dots.push({ si, v, x: X(v), out: v < sc.lo ? -1 : v > sc.hi ? 1 : 0, dy: 0 });
    });
    return dots;
  });
  const heights = plan.map((w, i) =>
    Math.max(DB_ROW, w.lines.length * DB_LINE_H + 12, ...clashRuns(rowDots[i] ?? []).map((run) => (run.length > 1 ? splitNeed(run.length) : 0))),
  );
  const top = 6;
  const axisY = top + heights.reduce((a, b) => a + b, 0) + 4;
  const height = axisY + 22;

  const a11y = svgName('Dumbbell chart', data.title, [countPhrase(n, 'row'), countPhrase(k, 'series', 'series')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;
  // Gridlines at the ticks, the axis, and its labels under the last row
  // (a label that would print over its neighbour is skipped).
  s += `<g${DECORATIVE}>`;
  for (const t of sc.ticks) s += `<line x1="${X(t)}" y1="${top}" x2="${X(t)}" y2="${axisY}" stroke="var(--rule)" stroke-width="1"/>`;
  s += `</g>`;
  s += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
  let lastEnd = -Infinity;
  for (const t of sc.ticks) {
    const text = tick(t);
    const w = textWidth(text, FONT.sub);
    const x = X(t);
    if (x - w / 2 < lastEnd + 6) continue;
    lastEnd = x + w / 2;
    s += `<text x="${x}" y="${axisY + 14}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(text)}</text>`;
  }

  // The first value prints in `muted` (a step above the baseline's `soft` dot,
  // so the number stays the easier read), or in its series colour when the
  // author flagged that series.
  const firstText = paintOf(0).text === 'c-soft' ? 'c-muted' : paintOf(0).text;
  const colA = r1(vx + wA);
  const colB = r1(colA + ARROW + wB);
  const colD = r1(colB + 12 + wD);
  let clamped = 0;
  let y = top;
  s += `<g${tagLabels ? bl('labels') : ''}>`;
  labels.forEach((label, i) => {
    const h = heights[i] ?? DB_ROW;
    const cy = r1(y + h / 2);
    y += h;
    const dots = rowDots[i] ?? [];
    splitDots(dots, h);
    const c = cols[i] ?? { a: '', b: '', d: '' };
    const past = (d: DbDot): string => (d.out === 0 ? '' : ` — past the axis ${d.out > 0 ? 'max' : 'min'} ${tick(d.out > 0 ? sc.hi : sc.lo)}`);
    const parts = dots.map((d) => `${series[d.si]?.label ?? ''} ${f.val(d.v)}${past(d)}`);
    const tip = `${label} — ${parts.join(' · ')}${c.d !== '' ? ` · change ${c.d}` : ''}`;
    s += `<g class="chart-db-row"><title>${escapeHtml(tip)}</title>`;
    // The track: a hairline the row's dots sit on.
    s += `<line x1="${x0}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    // The label, wrapped and centred on the track.
    const w = plan[i];
    const lines = w?.lines ?? [];
    const ly = r1(cy - ((lines.length - 1) * DB_LINE_H) / 2 + 4.5);
    const spans = lines
      .map((ln, li) => (lines.length === 1 ? escapeHtml(ln) : `<tspan x="${DB_PAD}" y="${r1(ly + li * DB_LINE_H)}">${escapeHtml(ln)}</tspan>`))
      .join('');
    s += `<text x="${DB_PAD}" y="${ly}" class="t-name"${tagLabels ? bp(`labels.${i}`) : ''}>${w !== undefined ? cutTitle(w) : ''}${spans}</text>`;
    // The connector, lowest dot to highest: drawn edge to edge between
    // neighbouring dots, so no part of it hides under a dot.
    const xs = [...new Set(dots.map((d) => d.x))].sort((p, q) => p - q);
    for (let j = 1; j < xs.length; j++) {
      const from = (xs[j - 1] ?? 0) + DB_R;
      const to = (xs[j] ?? 0) - DB_R;
      if (to - from > 1) s += `<line class="chart-db-link" x1="${r1(from)}" y1="${cy}" x2="${r1(to)}" y2="${cy}" stroke="var(--rule-solid)" stroke-width="2"/>`;
    }
    // Dots in series order, so the focal last series paints on top; a paper
    // ring cuts each one clear of the connector and of a close neighbour.
    for (const d of dots) {
      const p = paintOf(d.si);
      const dy = r1(cy + d.dy);
      s += `<g${bp(`series.${d.si}.values.${i}`)}><title>${escapeHtml(`${series[d.si]?.label ?? ''} · ${label}: ${f.val(d.v)}${past(d)}`)}</title>`;
      s += `<circle cx="${d.x}" cy="${dy}" r="${DB_R + 1.5}" fill="var(--paper)"${DECORATIVE}/>`;
      s += `<circle class="chart-db-dot" cx="${d.x}" cy="${dy}" r="${DB_R}" fill="${p.color}"/>`;
      if (d.out !== 0) {
        // A value past an authored end: an outward chevron beside the end dot.
        clamped++;
        const tip0 = d.x + d.out * (DB_R + 2);
        const tip1 = d.x + d.out * (DB_R + 5.5);
        s += `<path class="chart-db-clamp" d="M ${r1(tip0)} ${r1(dy - 3.5)} L ${r1(tip1)} ${dy} L ${r1(tip0)} ${r1(dy + 3.5)}" fill="none" stroke="${p.color}" stroke-width="1.5"/>`;
      }
      s += `</g>`;
    }
    // The values: first → last and the signed change.
    const vy = r1(cy + 3.5);
    if (k < 2) {
      s += `<text x="${colA}" y="${vy}" class="t-sub chart-db-val ${paintOf(0).text}" text-anchor="end" font-weight="600">${escapeHtml(c.a)}</text>`;
    } else {
      s +=
        `<text x="${colA}" y="${vy}" class="t-sub chart-db-val" text-anchor="end">` +
        `<tspan class="${firstText}">${escapeHtml(c.a)}</tspan>` +
        `<tspan x="${r1(colA + ARROW / 2)}" text-anchor="middle" class="c-soft">→</tspan>` +
        `<tspan x="${colB}" text-anchor="end" class="${paintOf(k - 1).text}" font-weight="600">${escapeHtml(c.b)}</tspan>` +
        (c.d !== '' ? `<tspan x="${colD}" text-anchor="end" class="c-muted">${escapeHtml(c.d)}</tspan>` : '') +
        `</text>`;
    }
    s += `</g>`;
  });
  s += `</g></svg>`;

  const legend: LegendItem[] = series.map((sr, si) => ({
    swatch: 'node-dot',
    fill: paintOf(si).color,
    stroke: paintOf(si).color,
    label: sr.label,
    path: `series.${si}`,
  }));
  if (clamped > 0) legend.push({ swatch: 'edge', label: 'past the axis end · the true value is printed' });
  return { svg: s, legend: renderLegend(legend, 'series') };
}
