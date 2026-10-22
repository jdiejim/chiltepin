/**
 * Renders a `chart` block — a declarative data chart in pure SVG (no deps).
 * Kinds: `bar` (grouped), `stacked`, `line`, `area`, `scatter` (ordinal, or
 * numeric with `points`), `donut`, `pie`, `gauge`, `radar`, `waterfall`,
 * `funnel`, and the statistical kinds in `chartKinds.ts` — `histogram`,
 * `bell`, `boxplot`, `pareto`, `bullet`, `dumbbell`.
 *
 * Truth first. Bar, line, area, scatter, stacked and radar charts use a
 * signed domain with a zero baseline: a negative bar grows down from 0, a
 * line dips under it. Only the part-of-whole kinds (donut, pie, gauge,
 * funnel) clamp a negative part to 0, and even they print the true value.
 *
 * Skin (`DESIGN.md`, `svg/dsTone.ts`): axes are `rule` hairlines on a
 * `rule-solid` zero line, tick labels `.t-sub` in `soft`, category labels
 * `.t-sub`, value labels `.t-arrow` on the paper halo. Numbers follow one
 * format (`chartScale.ts`): ticks share one suffix per axis (`0 · 2M · 4M`),
 * value labels are compact (`1.25M`, `−340k`), exact values (tooltips,
 * waterfall, funnel) are grouped (`2,055,000`). Colour is spent on the
 * series only: one series is `ink`; several take the category hues in order,
 * with a dash and marker past six; a series marked `accent: red` is
 * `negative`. No gradients, no shadows, no 3D.
 *
 * Layout adapts to the labels: the y gutter is as wide as the widest tick
 * label; category labels wrap to two lines, thin out on an ordered axis, or
 * turn; a `bar` chart with more than ten categories, or labels that do not
 * fit, turns into horizontal bars. A value label wider than its bar is
 * dropped (the bar's tooltip keeps the number).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, seriesStyle, type Mark, type SeriesStyle } from '../svg/dsTone.js';
import { FONT, cutTitle, ellipsize, fitText, textWidth } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';
import {
  ARROW_CH,
  axisFormat,
  compactNum,
  exactNum,
  valueFormat,
  numScale,
  pos,
  r1,
  svgOpenSize,
  textW,
  zeroScale,
  type LinScale,
} from './chartScale.js';
import { renderBell, renderBoxplot, renderBullet, renderDumbbell, renderHistogram, renderPareto } from './chartKinds.js';

type ChartData = BlockDataMap['chart'];
type Series = NonNullable<ChartData['series']>[number];
type DonutItem = NonNullable<ChartData['items']>[number];

/** Text drawn ON a dark fill: `paper`, and no paper halo (it would blur). */
const ON_DARK = ' style="fill:var(--paper);stroke:none"';

/** A finite number, or `undefined` for a gap in the data. */
const num = (v: number | undefined): number | undefined => (v !== undefined && Number.isFinite(v) ? v : undefined);

// ─── category labels ────────────────────────────────────────────────────────

/** Line height of a wrapped category label. */
const CAT_LINE_H = 12;
/** Angle of a turned category label, in degrees. */
const CAT_TURN = 35;
/** A turned label wider than this (px) is cut with "…" (its `<title>` keeps it whole). */
const CAT_TURN_W = 196;

/** How the category labels under a vertical chart are laid out. */
interface CatPlan {
  readonly mode: 'flat' | 'wrap' | 'thin' | 'turn';
  /** The lines drawn for each label; `[]` for a label thinned away. */
  readonly lines: readonly (readonly string[])[];
  /** True for a label drawn shorter than its text. */
  readonly cut: readonly boolean[];
  /** The band under the plot that the labels need, in px. */
  readonly height: number;
}

/**
 * Wraps `label` into at most `maxLines` lines of `width` px in `font`, only at
 * spaces; `undefined` when it does not fit whole (a cut, or a word that would
 * have to break — `00:00` never wraps as `00:` / `00`).
 */
function wrapWhole(label: string, width: number, maxLines: number, font = FONT.sub): string[] | undefined {
  const w = fitText(label, { width, font, maxLines });
  if (w.truncated || w.lines.join(' ') !== w.full) return undefined;
  return w.lines.length > 0 ? w.lines : [''];
}

/**
 * Plans the category labels for slots `slot` px wide: one line when every
 * label fits; else two lines; else, on an ordered axis (line, area), every
 * k-th label whole; else every label turned {@link CAT_TURN}°.
 */
function planCats(labels: readonly string[], slot: number, ordered: boolean): CatPlan {
  const room = Math.max(1, slot - 6);
  const none = labels.map(() => false);
  if (labels.every((l) => textWidth(l, FONT.sub) <= room)) {
    return { mode: 'flat', lines: labels.map((l) => [l]), cut: none, height: 24 };
  }
  const two = labels.map((l) => wrapWhole(l, room, 2));
  if (two.every((w) => w !== undefined)) {
    return { mode: 'wrap', lines: two.map((w) => w ?? []), cut: none, height: 24 + CAT_LINE_H };
  }
  if (ordered) {
    const widest = Math.max(...labels.map((l) => textWidth(l, FONT.sub)));
    const every = Math.max(2, Math.ceil((widest + 10) / slot));
    return { mode: 'thin', lines: labels.map((l, i) => (i % every === 0 ? [l] : [])), cut: none, height: 24 };
  }
  const shown = labels.map((l, i) => ellipsize(l, CAT_TURN_W, FONT.sub, { field: 'label', path: `labels.${i}`, hint: 'shorten the category label' }));
  const longest = Math.max(0, ...shown.map((w) => textWidth(w.lines[0] ?? '', FONT.sub)));
  const rise = Math.sin((CAT_TURN * Math.PI) / 180);
  return {
    mode: 'turn',
    lines: shown.map((w) => [w.lines[0] ?? '']),
    cut: shown.map((w) => w.truncated),
    height: Math.ceil(18 + longest * rise),
  };
}

/** The category labels under the plot, centred on their slots (or turned). */
function catLabels(plan: CatPlan, labels: readonly string[], xAt: (i: number) => number, top: number, tagLabels: boolean): string {
  let s = tagLabels ? `<g${bl('labels')}>` : '';
  plan.lines.forEach((lines, i) => {
    if (lines.length === 0) return;
    const x = r1(xAt(i));
    const tag = tagLabels ? bp(`labels.${i}`) : '';
    const title = plan.cut[i] === true ? `<title>${escapeHtml(labels[i] ?? '')}</title>` : '';
    if (plan.mode === 'turn') {
      const y = top + 12;
      s += `<text x="${x}" y="${y}" class="t-sub" text-anchor="end" transform="rotate(-${CAT_TURN} ${x} ${y})"${tag}>${title}${escapeHtml(lines[0] ?? '')}</text>`;
      return;
    }
    const spans = lines
      .map((ln, li) => (lines.length === 1 ? escapeHtml(ln) : `<tspan x="${x}" y="${top + 16 + li * CAT_LINE_H}">${escapeHtml(ln)}</tspan>`))
      .join('');
    s += `<text x="${x}" y="${top + 16}" class="t-sub" text-anchor="middle"${tag}>${title}${spans}</text>`;
  });
  return s + (tagLabels ? `</g>` : '');
}

// ─── the cartesian frame (bar, stacked, line, area, ordinal scatter) ─────────

/** Shared cartesian frame geometry for the vertical-category kinds. */
interface Frame {
  readonly width: number;
  readonly height: number;
  readonly x0: number; // plot left
  readonly x1: number; // plot right
  readonly y0: number; // plot top
  readonly y1: number; // plot bottom
  readonly scale: LinScale;
  /** Value → y, clamped to the axis. */
  readonly y: (v: number) => number;
  /** The zero baseline. */
  readonly zeroY: number;
  readonly tick: (v: number) => string;
  /** Value labels, in the axis's units. */
  readonly label: (v: number) => string;
  readonly slot: number;
  readonly cats: CatPlan;
  /** Top of the category-label band (under the plot, below any negative value label). */
  readonly catTop: number;
}

const PLOT_H = 190;
const PLOT_TOP = 18;

/** The data extent a frame must hold: single values, or the positive and negative stack totals. */
function extentOf(series: readonly Series[], cats: number, stacked: boolean): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  if (stacked) {
    for (let ci = 0; ci < cats; ci++) {
      let up = 0;
      let down = 0;
      for (const sr of series) {
        const v = num(sr.values[ci]) ?? 0;
        if (v > 0) up += v;
        else down += v;
      }
      hi = Math.max(hi, up);
      lo = Math.min(lo, down);
    }
  } else {
    for (const sr of series) {
      for (const v of sr.values.slice(0, Math.max(cats, 0))) {
        const n = num(v);
        if (n === undefined) continue;
        hi = Math.max(hi, n);
        lo = Math.min(lo, n);
      }
    }
  }
  return { lo, hi };
}

function frameFor(data: ChartData, labels: readonly string[], opts: { stacked?: boolean; ordered?: boolean } = {}): Frame {
  const cats = labels.length;
  const width = Math.max(420, Math.min(680, 120 + cats * 84));
  const series = data.series ?? [];
  const { lo, hi } = extentOf(series, cats, opts.stacked === true);
  const scale = zeroScale(lo, hi, data.max);
  const tick = axisFormat(scale.ticks, data.unit);
  // The gutter is as wide as the widest tick label, never a fixed guess.
  const gutter = Math.max(0, ...scale.ticks.map((t) => textW(tick(t))));
  const x0 = Math.round(Math.max(30, gutter + 16));
  const x1 = width - 18;
  const slot = (x1 - x0) / Math.max(cats, 1);
  const y0 = PLOT_TOP;
  const y1 = y0 + PLOT_H;
  const plan = planCats(labels, slot, opts.ordered === true);
  // A negative value label hangs under its bar; keep it off the category labels.
  const catTop = y1 + (scale.lo < 0 ? 12 : 0);
  const span = scale.hi - scale.lo || 1;
  const y = (v: number): number => r1(y1 - ((y1 - y0) * (Math.min(Math.max(v, scale.lo), scale.hi) - scale.lo)) / span);
  const label = valueFormat(scale.ticks, data.unit);
  return { width, height: catTop + plan.height, x0, x1, y0, y1, scale, y, zeroY: y(0), tick, label, slot, cats: plan, catTop };
}

/** Gridlines at every tick (the zero line solid), tick labels, and the category labels. */
function axes(f: Frame, labels: readonly string[], tagLabels: boolean): string {
  let s = '';
  for (const t of f.scale.ticks) {
    const y = f.y(t);
    s += `<line x1="${f.x0}" y1="${y}" x2="${f.x1}" y2="${y}" stroke="${t === 0 ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${f.x0 - 8}" y="${r1(y + 3)}" class="t-sub c-soft" text-anchor="end">${escapeHtml(f.tick(t))}</text>`;
  }
  s += catLabels(f.cats, labels, (i) => f.x0 + f.slot * i + f.slot / 2, f.catTop, tagLabels);
  return s;
}

/** A label box, for collision checks. */
interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const boxesOverlap = (a: LabelBox, b: LabelBox): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The series legend — one swatch per series; a line chart shows lines (dashed past six). */
function seriesLegend(series: readonly Series[], lines = false): string {
  const items: LegendItem[] = series.map((sr, i) => {
    const st = seriesStyle(i, series.length, sr.accent);
    if (lines) return { swatch: st.dash !== '' ? 'line-dashed' : 'line', stroke: st.color, label: sr.label, path: `series.${i}` };
    if (st.round > 0) return { swatch: 'node-dot', fill: st.tint, stroke: st.color, label: sr.label, path: `series.${i}` };
    return { swatch: 'fill', fill: st.color, label: sr.label, path: `series.${i}` };
  });
  return renderLegend(items, 'series');
}

/** Fill attributes for a bar or a stack segment: solid in the first rotation, hollow (tint + outline) past six series. */
function barPaint(st: SeriesStyle): string {
  return st.round > 0 ? `fill="${st.tint}" stroke="${st.color}" stroke-width="1.25"` : `fill="${st.color}"`;
}

/** A bar's tooltip: series, category, and the exact value. */
function barTip(sr: Series, label: string | undefined, v: number, unit: string | undefined): string {
  return `<title>${escapeHtml(`${sr.label}${label !== undefined ? ` · ${label}` : ''} — ${exactNum(v, unit)}`)}</title>`;
}

/** True when the `bar` kind reads better as horizontal bars: many categories, or labels that do not fit. */
function wantsHorizontal(labels: readonly string[]): boolean {
  if (labels.length > 10) return true;
  const width = Math.max(420, Math.min(680, 120 + labels.length * 84));
  const slot = (width - 18 - 60) / Math.max(labels.length, 1);
  return planCats(labels, slot, false).mode === 'turn';
}

function renderBars(data: ChartData, labels: readonly string[], series: readonly Series[], tagLabels: boolean): string {
  const f = frameFor(data, labels);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const k = Math.max(series.length, 1);
  const groupPad = Math.min(18, slot * 0.18);
  const barGap = k > 1 ? 3 : 0;
  const barW = Math.max(3, (slot - groupPad * 2 - barGap * (k - 1)) / k);
  const placed: LabelBox[] = [];
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const st = seriesStyle(si, series.length, sr.accent);
    s += `<g${bp(`series.${si}`)}>`;
    for (let ci = 0; ci < labels.length; ci++) {
      const v = num(sr.values[ci]);
      if (v === undefined) continue;
      const x = r1(f.x0 + slot * ci + groupPad + si * (barW + barGap));
      const yv = f.y(v);
      const top = Math.min(yv, f.zeroY);
      const h = r1(Math.abs(yv - f.zeroY));
      s += `<g${bp(`series.${si}.values.${ci}`)}>`;
      s += `<rect x="${x}" y="${top}" width="${r1(barW)}" height="${Math.max(h, 1)}" ${barPaint(st)}${h === 0 ? ' opacity="0.35"' : ''}>${barTip(sr, labels[ci], v, data.unit)}</rect>`;
      // The value rides the bar end — only when it is no wider than its own
      // bar lane and clear of every label already placed.
      const text = f.label(v);
      const w = textW(text, ARROW_CH);
      const cx = x + barW / 2;
      const ty = v < 0 ? top + h + 11 : top - 4;
      const box: LabelBox = { x0: cx - w / 2, x1: cx + w / 2, y0: ty - 8, y1: ty + 2 };
      if (w <= barW + barGap + 2 && !placed.some((b) => boxesOverlap(b, box))) {
        placed.push(box);
        s += `<text x="${r1(cx)}" y="${r1(ty)}" class="t-arrow" text-anchor="middle">${escapeHtml(text)}</text>`;
      }
      s += `</g>`;
    }
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpenSize(f.width, f.height) + axes(f, labels, tagLabels) + s + `</svg>`;
}

/**
 * `kind: bar` with many categories or long labels: one row per category, the
 * label in a left column (wrapped to two lines), bars growing right from the
 * zero line (left for a negative value), the value at the bar end.
 */
function renderBarsH(data: ChartData, labels: readonly string[], series: readonly Series[], tagLabels: boolean): string {
  const width = 680;
  const k = Math.max(series.length, 1);
  const unit = data.unit;
  const { lo, hi } = extentOf(series, labels.length, false);
  const scale = zeroScale(lo, hi, data.max);
  const tick = axisFormat(scale.ticks, unit);
  const valueText = valueFormat(scale.ticks, unit);

  // Label column: one line up to LABEL_COL px, else two lines of it.
  const LABEL_COL = 206;
  const longest = Math.max(24, ...labels.map((l) => textWidth(l, FONT.sub)));
  const colW = Math.min(LABEL_COL, longest > LABEL_COL ? Math.max(LABEL_COL * 0.6, Math.ceil(longest / 2) + 12) : longest);
  const plan = labels.map((l, i) => {
    const w = fitText(l, { width: colW, font: FONT.sub, maxLines: 2, report: { field: 'label', path: `labels.${i}`, hint: 'shorten the category label' } });
    return { lines: w.lines, cut: w.truncated, title: cutTitle(w) };
  });
  const labelW = Math.max(...plan.flatMap((p) => p.lines.map((ln) => textWidth(ln, FONT.sub))), 24);
  const lx = Math.round(10 + labelW);

  const values = series.flatMap((sr) => sr.values.slice(0, labels.length).map(num).filter((v): v is number => v !== undefined));
  const posPad = Math.max(0, ...values.filter((v) => v >= 0).map((v) => textW(valueText(v), ARROW_CH))) + 10;
  const negPad = values.some((v) => v < 0) ? Math.max(...values.filter((v) => v < 0).map((v) => textW(valueText(v), ARROW_CH))) + 10 : 0;
  const px0 = lx + 14 + negPad;
  const px1 = width - 12 - posPad;
  const span = scale.hi - scale.lo || 1;
  const X = (v: number): number => r1(px0 + ((px1 - px0) * (Math.min(Math.max(v, scale.lo), scale.hi) - scale.lo)) / span);
  const zeroX = X(0);

  const barH = k === 1 ? 14 : Math.max(5, Math.min(11, Math.floor(30 / k)));
  const bands = plan.map((p) => Math.max(p.lines.length * CAT_LINE_H + 10, k * barH + (k - 1) * 2 + 10));
  const top = 10;
  const plotBot = top + bands.reduce((a, b) => a + b, 0);
  const height = plotBot + 24;

  let s = svgOpenSize(width, height);
  // Vertical gridlines and the tick labels under the plot (a label that would
  // print over its neighbour is skipped).
  let lastEnd = -Infinity;
  for (const t of scale.ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${plotBot}" stroke="${t === 0 ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    const text = tick(t);
    const w = textW(text);
    if (x - w / 2 < lastEnd + 6) continue;
    lastEnd = x + w / 2;
    s += `<text x="${x}" y="${plotBot + 16}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(text)}</text>`;
  }

  // Category labels, right-aligned against the plot.
  let y = top;
  s += tagLabels ? `<g${bl('labels')}>` : '';
  plan.forEach((p, ci) => {
    const band = bands[ci] ?? 0;
    const y0 = y + band / 2 - ((p.lines.length - 1) * CAT_LINE_H) / 2 + 3.5;
    const title = p.title;
    const spans = p.lines.map((ln, li) => (p.lines.length === 1 ? escapeHtml(ln) : `<tspan x="${lx}" y="${r1(y0 + li * CAT_LINE_H)}">${escapeHtml(ln)}</tspan>`)).join('');
    s += `<text x="${lx}" y="${r1(y0)}" class="t-sub c-ink" text-anchor="end"${tagLabels ? bp(`labels.${ci}`) : ''}>${title}${spans}</text>`;
    y += band;
  });
  s += tagLabels ? `</g>` : '';

  // Bars.
  s += `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const st = seriesStyle(si, series.length, sr.accent);
    s += `<g${bp(`series.${si}`)}>`;
    let yy = top;
    for (let ci = 0; ci < labels.length; ci++) {
      const band = bands[ci] ?? 0;
      const v = num(sr.values[ci]);
      if (v !== undefined) {
        const groupH = k * barH + (k - 1) * 2;
        const by = r1(yy + (band - groupH) / 2 + si * (barH + 2));
        const xv = X(v);
        const x = Math.min(xv, zeroX);
        const w = r1(Math.abs(xv - zeroX));
        s += `<g${bp(`series.${si}.values.${ci}`)}>`;
        s += `<rect x="${x}" y="${by}" width="${Math.max(w, 1)}" height="${barH}" ${barPaint(st)}${w === 0 ? ' opacity="0.35"' : ''}>${barTip(sr, labels[ci], v, unit)}</rect>`;
        const text = valueText(v);
        const tx = v < 0 ? x - 4 : x + Math.max(w, 1) + 4;
        s += `<text x="${r1(tx)}" y="${r1(by + barH / 2 + 3.5)}" class="t-arrow"${v < 0 ? ' text-anchor="end"' : ''}>${escapeHtml(text)}</text>`;
        s += `</g>`;
      }
      yy += band;
    }
    s += `</g>`;
  });
  s += `</g>`;
  return s + `</svg>`;
}

/** A vertex marker of a line series: circle, square or diamond (the shape changes past six series). */
function marker(st: SeriesStyle, x: number, y: number, r: number): string {
  const paint = `fill="var(--paper)" stroke="${st.color}" stroke-width="1.5"`;
  if (st.marker === 'square') return `<rect x="${r1(x - r)}" y="${r1(y - r)}" width="${r1(r * 2)}" height="${r1(r * 2)}" ${paint}/>`;
  if (st.marker === 'diamond') {
    const d = r * 1.3;
    return `<path d="M ${r1(x)} ${r1(y - d)} L ${r1(x + d)} ${r1(y)} L ${r1(x)} ${r1(y + d)} L ${r1(x - d)} ${r1(y)} Z" ${paint}/>`;
  }
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" ${paint}/>`;
}

function renderLineArea(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  area: boolean,
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels, { ordered: true });
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const xAt = (i: number): number => r1(f.x0 + slot * i + slot / 2);
  const rMark = slot < 16 ? 2 : 3;
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const st = seriesStyle(si, series.length, sr.accent);
    // A gap in the data (a missing value) breaks the line instead of
    // inventing a zero.
    const runs: { i: number; v: number }[][] = [];
    let run: { i: number; v: number }[] = [];
    sr.values.slice(0, labels.length).forEach((raw, i) => {
      const v = num(raw);
      if (v === undefined) {
        if (run.length > 0) runs.push(run);
        run = [];
        return;
      }
      run.push({ i, v });
    });
    if (run.length > 0) runs.push(run);
    if (runs.length === 0) return;
    s += `<g${bp(`series.${si}`)}>`;
    const dash = st.dash !== '' ? ` stroke-dasharray="${st.dash}"` : '';
    for (const r of runs) {
      const pts = r.map((p) => `${xAt(p.i)},${f.y(p.v)}`);
      if (area && r.length > 1) {
        const first = xAt(r[0]?.i ?? 0);
        const last = xAt(r[r.length - 1]?.i ?? 0);
        s += `<polygon points="${first},${f.zeroY} ${pts.join(' ')} ${last},${f.zeroY}" fill="${st.color}" fill-opacity="0.12" stroke="none"/>`;
      }
      if (r.length > 1) {
        s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${st.color}" stroke-width="1.75" stroke-linejoin="round"${dash}/>`;
      }
    }
    for (const r of runs) {
      for (const p of r) {
        s += `<g>${barTip(sr, labels[p.i], p.v, data.unit)}${marker(st, xAt(p.i), f.y(p.v), rMark)}</g>`;
      }
    }
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpenSize(f.width, f.height) + axes(f, labels, tagLabels) + s + `</svg>`;
}

/** A drawing plus the legend strip the frame shows under it. */
export interface Drawn {
  readonly svg: string;
  readonly legend: string;
}

// ─── donut / pie ────────────────────────────────────────────────────────────

/** At most this many named slices; the rest fold into one "Other" slice. */
const MAX_SLICES = 6;

/** One drawn slice: an item (with its data index), or the folded "Other". */
interface Slice {
  readonly label: string;
  readonly value: number;
  /** The authored value, printed as written (a negative part is drawn as 0). */
  readonly raw: number;
  readonly index: number | undefined;
  readonly mark: Mark;
  readonly folded: readonly DonutItem[];
}

/**
 * The slices to draw: every item when there are at most six (an authored
 * "Other" does not count), else the six largest in authored order plus one
 * "Other" that sums the rest. Six hues and one neutral never repeat a colour.
 */
function sliceItems(items: readonly DonutItem[]): Slice[] {
  const marks = marksOf(items.map((it) => it.accent));
  const isOther = (l: string): boolean => /^others?$/i.test(l.trim());
  const named = items.map((it, i) => ({ it, i })).filter((x) => !isOther(x.it.label));
  const others = items.map((it, i) => ({ it, i })).filter((x) => isOther(x.it.label));
  const asSlice = (x: { it: DonutItem; i: number }): Slice => ({
    label: x.it.label,
    value: pos(x.it.value),
    raw: x.it.value,
    index: x.i,
    mark: marks[x.i],
    folded: [],
  });
  if (named.length <= MAX_SLICES && others.length <= 1) return items.map((it, i) => asSlice({ it, i }));
  const keep = new Set(
    [...named]
      .sort((a, b) => pos(b.it.value) - pos(a.it.value) || a.i - b.i)
      .slice(0, MAX_SLICES)
      .map((x) => x.i),
  );
  const rest = [...named.filter((x) => !keep.has(x.i)), ...others].sort((a, b) => a.i - b.i);
  const sum = rest.reduce((a, x) => a + pos(x.it.value), 0);
  return [
    ...named.filter((x) => keep.has(x.i)).map(asSlice),
    { label: 'Other', value: sum, raw: sum, index: undefined, mark: undefined, folded: rest.map((x) => x.it) },
  ];
}

/**
 * The fill of each slice. Named slices take the category hues in order; the
 * folded "Other" is neutral. A `negative` mark is `negative`. A focal mark
 * takes the accent, and the other slices step back to neutral greys so the
 * one answer stands out.
 */
function sliceFills(slices: readonly Slice[]): string[] {
  const focal = slices.some((sl) => sl.mark === 'focal');
  let k = 0;
  return slices.map((sl) => {
    if (sl.mark === 'negative') return 'var(--negative)';
    if (sl.mark === 'focal') return 'var(--accent)';
    if (sl.index === undefined) return 'var(--ink-3)';
    const i = k++;
    if (focal) return i % 2 === 0 ? 'var(--ink-3)' : 'var(--ink-2)';
    return seriesStyle(i, Math.max(slices.length, 2)).color;
  });
}

/** The items legend (donut / pie / gauge) — label and exact value per slice. */
function sliceLegend(slices: readonly Slice[], fills: readonly string[], unit: string | undefined): string {
  const entries: LegendItem[] = slices.map((sl, i) => {
    const label =
      sl.index === undefined && sl.folded.length > 0
        ? `Other (${sl.folded.length}) — ${exactNum(sl.raw, unit)}`
        : `${sl.label} — ${exactNum(sl.raw, unit)}`;
    return {
      swatch: 'fill',
      fill: fills[i] ?? 'var(--ink)',
      label,
      ...(sl.index !== undefined ? { path: `items.${sl.index}` } : {}),
    };
  });
  return renderLegend(entries, 'items');
}

/** The widest (px) a slice callout name may print before it is cut (its `<title>` keeps it whole). */
const CALLOUT_W = 242;

/**
 * `kind: donut`, and `kind: pie` when `pie` is set — the same ring of slices,
 * legend and callouts, but a pie fills the centre (wedges instead of a
 * stroked ring, seams from the centre) and carries no centre total.
 */
function renderDonut(data: ChartData, items: readonly DonutItem[], pie = false): Drawn {
  const slices = sliceItems(items);
  const fills = sliceFills(slices);
  const total = slices.reduce((acc, sl) => acc + sl.value, 0);
  const r = 74;
  const sw = 26;
  // A pie's rim sits where the donut's outer edge is; its "hole" radius is 0.
  const rim = r + sw / 2;
  const hole = pie ? 0 : r - sw / 2;
  // Every slice worth ≥ 8% is named beside the ring. The canvas is as wide as
  // the widest callout needs, so a long name never runs off the drawing.
  const calloutText = (sl: Slice): { text: string; cut: boolean } => {
    const name = ellipsize(sl.label, CALLOUT_W, FONT.sub, {
      field: 'label',
      ...(sl.index !== undefined ? { path: `items.${sl.index}.label` } : {}),
      hint: 'shorten the slice label (the legend keeps it whole)',
    });
    return { text: `${name.lines[0] ?? ''} ${compactNum(sl.raw, data.unit)}`, cut: name.truncated };
  };
  const named = total > 0 ? slices.filter((sl) => sl.value / total >= 0.08) : [];
  const widest = Math.max(0, ...named.map((sl) => textW(calloutText(sl).text)));
  const width = Math.max(480, Math.ceil(2 * (rim + 18 + widest) + 12));
  const height = 236;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  let s = svgOpenSize(width, height);
  const ringEdges =
    `<circle cx="${cx}" cy="${cy}" r="${rim}" fill="none" stroke="var(--rule-solid)" stroke-width="1"/>` +
    (pie ? '' : `<circle cx="${cx}" cy="${cy}" r="${hole}" fill="none" stroke="var(--rule-solid)" stroke-width="1"/>`);
  if (total <= 0) {
    s += pie
      ? `<circle cx="${cx}" cy="${cy}" r="${rim}" fill="var(--paper)"${DECORATIVE}/>` + ringEdges
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper)" stroke-width="${sw}"${DECORATIVE}/>` + ringEdges;
  } else {
    let angle = -90;
    const seams: string[] = [];
    const seam = (deg: number): void => {
      const a = (deg * Math.PI) / 180;
      const x0 = r1(cx + (pie ? 0 : hole - 1) * Math.cos(a));
      const y0 = r1(cy + (pie ? 0 : hole - 1) * Math.sin(a));
      const x1 = r1(cx + (rim + 1) * Math.cos(a));
      const y1 = r1(cy + (rim + 1) * Math.sin(a));
      seams.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="var(--paper-2)" stroke-width="2"${DECORATIVE}/>`);
    };
    const callouts: { mid: number; text: string; full: string | undefined }[] = [];
    s += `<g${bl('items')}>`;
    slices.forEach((sl, i) => {
      const v = sl.value;
      if (v === 0) return;
      const sweep = (v / total) * 360;
      const color = fills[i] ?? 'var(--ink)';
      const share = `${Math.round((v / total) * 1000) / 10}%`;
      const what =
        sl.folded.length > 0
          ? `Other — ${exactNum(sl.raw, data.unit)} (${share}): ${sl.folded.map((it) => `${it.label} ${exactNum(it.value, data.unit)}`).join(', ')}`
          : `${sl.label} — ${exactNum(sl.raw, data.unit)} (${share})`;
      const tip = `<title>${escapeHtml(what)}</title>`;
      const tag = sl.index !== undefined ? bp(`items.${sl.index}`) : ' data-folded="1"';
      if (sweep >= 359.999) {
        // A full circle can't be a single arc — draw a ring (or a disc).
        s += pie
          ? `<circle cx="${cx}" cy="${cy}" r="${rim}" fill="${color}"${tag}>${tip}</circle>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"${tag}>${tip}</circle>`;
      } else if (pie) {
        const a0 = (angle * Math.PI) / 180;
        const a1 = ((angle + sweep) * Math.PI) / 180;
        const large = sweep > 180 ? 1 : 0;
        s += `<path d="M ${cx} ${cy} L ${r1(cx + rim * Math.cos(a0))} ${r1(cy + rim * Math.sin(a0))} A ${rim} ${rim} 0 ${large} 1 ${r1(cx + rim * Math.cos(a1))} ${r1(cy + rim * Math.sin(a1))} Z" fill="${color}" stroke="none"${tag}>${tip}</path>`;
        seam(angle);
      } else {
        const a0 = (angle * Math.PI) / 180;
        const a1 = ((angle + sweep) * Math.PI) / 180;
        const large = sweep > 180 ? 1 : 0;
        s += `<path d="M ${r1(cx + r * Math.cos(a0))} ${r1(cy + r * Math.sin(a0))} A ${r} ${r} 0 ${large} 1 ${r1(cx + r * Math.cos(a1))} ${r1(cy + r * Math.sin(a1))}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt"${tag}>${tip}</path>`;
        seam(angle);
      }
      if (v / total >= 0.08) {
        const c = calloutText(sl);
        callouts.push({ mid: angle + sweep / 2, text: c.text, full: c.cut ? sl.label : undefined });
      }
      angle += sweep;
    });
    s += `</g>`;
    s += ringEdges;
    // Ground-coloured seams between slices, so pale steps stay separable.
    if (seams.length > 1) s += seams.join('');
    s += donutCallouts(callouts, cx, cy, rim);
  }
  if (!pie) {
    s += `<text x="${cx}" y="${cy + 2}" class="chart-total"><title>${escapeHtml(exactNum(total, data.unit))}</title>${escapeHtml(compactNum(total, data.unit))}</text>`;
    s += `<text x="${cx}" y="${cy + 20}" class="t-eyebrow" text-anchor="middle">TOTAL</text>`;
  }
  s += `</svg>`;
  return { svg: s, legend: sliceLegend(slices, fills, data.unit) };
}

/**
 * Slice callouts: a short leader from the ring's rim to a `.t-sub` label just
 * outside it, anchored away from the ring. Labels on the same side are swept
 * top-down and pushed at least 12px apart so neighbours never overprint.
 */
function donutCallouts(
  callouts: ReadonlyArray<{ mid: number; text: string; full: string | undefined }>,
  cx: number,
  cy: number,
  rim: number,
): string {
  const placed = callouts.map((c) => {
    const a = (c.mid * Math.PI) / 180;
    const right = Math.cos(a) >= 0;
    return {
      text: c.text,
      full: c.full,
      right,
      x0: cx + (rim + 2) * Math.cos(a),
      y0: cy + (rim + 2) * Math.sin(a),
      x1: cx + (rim + 12) * Math.cos(a),
      y: cy + (rim + 12) * Math.sin(a),
    };
  });
  for (const side of [true, false]) {
    const group = placed.filter((p) => p.right === side).sort((a, b) => a.y - b.y);
    let floor = -Infinity;
    for (const p of group) {
      const y = Math.max(p.y, floor + 12);
      (p as { y: number }).y = y;
      floor = y;
    }
  }
  return placed
    .map((p) => {
      const lx = p.right ? Math.max(p.x1, cx + rim + 8) : Math.min(p.x1, cx - rim - 8);
      const title = p.full !== undefined ? `<title>${escapeHtml(p.full)}</title>` : '';
      return (
        `<line x1="${r1(p.x0)}" y1="${r1(p.y0)}" x2="${r1(lx)}" y2="${r1(p.y)}" stroke="var(--muted)" stroke-width="0.75"/>` +
        `<text x="${r1(lx + (p.right ? 4 : -4))}" y="${r1(p.y + 3.5)}" class="t-sub c-ink" text-anchor="${p.right ? 'start' : 'end'}">${title}${escapeHtml(p.text)}</text>`
      );
    })
    .join('');
}

/**
 * `kind: stacked` — bars that sum instead of standing side by side, for the
 * case where the total matters as much as the split (spend by team per
 * quarter, requests by status per day). Positive parts stack up from the
 * zero line, negative parts stack down from it; the net total of the column
 * prints at its end.
 */
function renderStacked(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels, { stacked: true });
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const barW = Math.max(10, Math.min(56, slot * 0.55));
  let s = `<g${bl('series')}>`;
  for (let ci = 0; ci < labels.length; ci++) {
    const x = r1(f.x0 + slot * ci + (slot - barW) / 2);
    let up = 0;
    let down = 0;
    let net = 0;
    let any = false;
    series.forEach((sr, si) => {
      const v = num(sr.values[ci]);
      if (v === undefined || v === 0) return;
      any = true;
      net += v;
      const from = v > 0 ? up : down;
      const to = from + v;
      if (v > 0) up = to;
      else down = to;
      const yA = f.y(from);
      const yB = f.y(to);
      const st = seriesStyle(si, series.length, sr.accent);
      s += `<rect x="${x}" y="${Math.min(yA, yB)}" width="${r1(barW)}" height="${r1(Math.abs(yA - yB))}" ${barPaint(st)}${st.round > 0 ? '' : ' stroke="var(--paper-2)" stroke-width="1"'}${DECORATIVE}${bp(`series.${si}.values.${ci}`)}>${barTip(sr, labels[ci], v, data.unit)}</rect>`;
    });
    // The column's net total sits at its end, which is the number people read.
    if (any) {
      const text = f.label(net);
      if (textW(text, ARROW_CH) <= slot - 4) {
        const ty = up > 0 ? f.y(up) - 5 : f.y(down) + 12;
        s += `<text x="${r1(x + barW / 2)}" y="${r1(ty)}" class="t-arrow" text-anchor="middle">${escapeHtml(text)}</text>`;
      }
    }
  }
  s += `</g>`;
  return svgOpenSize(f.width, f.height) + axes(f, labels, tagLabels) + s + `</svg>`;
}

/**
 * `kind: scatter` — points instead of a joined line, for the case where the
 * x order carries no meaning and the question is where things cluster.
 */
function renderScatter(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const xAt = (i: number): number => r1(f.x0 + slot * i + slot / 2);
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const st = seriesStyle(si, series.length, sr.accent);
    s += `<g${bp(`series.${si}`)}>`;
    sr.values.slice(0, labels.length).forEach((raw, i) => {
      const v = num(raw);
      if (v === undefined) return;
      s += `<circle cx="${xAt(i)}" cy="${f.y(v)}" r="5" fill="${st.color}" fill-opacity="0.2" stroke="${st.color}" stroke-width="1.5"${st.dash !== '' ? ` stroke-dasharray="${st.dash}"` : ''}>${barTip(sr, labels[i], v, data.unit)}</circle>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpenSize(f.width, f.height) + axes(f, labels, tagLabels) + s + `</svg>`;
}

// ─── kind: scatter with `points` (numeric axes) ──────────────────────────────
// Each point owns its own x/y, so both axes are numeric: domains come from the
// data (extended to include any guides), padded, and snapped to nice tick
// steps. `size` drives the bubble radius on a sqrt scale (area reads as the
// value); `label` sits beside its bubble, nudged vertically when two labels
// would overlap. `guides` draws dashed reference lines and optional muted
// quadrant labels in the plot corners (TL, TR, BL, BR order).

type ScatterPoint = NonNullable<ChartData['points']>[number];

/** Truncation cap for point labels — the full text still ships in <title>. */
const SC_LABEL_CHARS = 40;

function scLabel(label: string): string {
  return label.length > SC_LABEL_CHARS ? `${label.slice(0, SC_LABEL_CHARS - 1)}…` : label;
}

/** Bubble radius: sqrt scale over `size`, r 4–18; 5 when `size` is absent. */
function scRadius(size: number | undefined, minS: number, maxS: number): number {
  if (size === undefined) return 5;
  const s = Math.max(size, 0);
  if (maxS <= minS) return 8;
  const t = (Math.sqrt(s) - Math.sqrt(minS)) / (Math.sqrt(maxS) - Math.sqrt(minS));
  return Math.round((4 + t * 14) * 10) / 10;
}

interface Dot {
  readonly px: number;
  readonly py: number;
  readonly r: number;
}

/** True when a bubble's disc overlaps a label box (closest-point test). */
function circleHitsBox(c: Dot, b: LabelBox): boolean {
  const nx = Math.max(b.x0, Math.min(c.px, b.x1));
  const ny = Math.max(b.y0, Math.min(c.py, b.y1));
  const dx = c.px - nx;
  const dy = c.py - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

/** A point's colour: `ink`, or the accent / negative its mark gives it. */
function pointColor(mark: Mark): string {
  if (mark === 'negative') return 'var(--negative)';
  if (mark === 'focal') return 'var(--accent)';
  return 'var(--ink)';
}

function renderScatterPoints(data: ChartData, points: readonly ScatterPoint[]): Drawn {
  const guides = data.guides;
  const width = 560;
  const height = 320;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  // Guides join the extent so an off-data guide extends the domain instead of
  // drawing outside the plot.
  if (guides?.x !== undefined) xs.push(guides.x);
  if (guides?.y !== undefined) ys.push(guides.y);
  const sx = numScale(xs);
  const sy = numScale(ys);
  const tickY = axisFormat(sy.ticks, data.unit);
  const tickX = axisFormat(sx.ticks);
  // The gutter is as wide as the widest y tick label (plus the axis title).
  const gutter = Math.max(0, ...sy.ticks.map((t) => textW(tickY(t))));
  const x0 = Math.round(Math.max(40, gutter + 16) + (data.yLabel !== undefined ? 16 : 0));
  const x1 = width - 20;
  const y0 = 18;
  const y1 = height - (data.xLabel !== undefined ? 48 : 34);
  const X = (v: number): number =>
    Math.round((x0 + ((x1 - x0) * (v - sx.min)) / (sx.max - sx.min)) * 10) / 10;
  const Y = (v: number): number =>
    Math.round((y1 - ((y1 - y0) * (v - sy.min)) / (sy.max - sy.min)) * 10) / 10;

  const sizes = points.filter((p) => p.size !== undefined).map((p) => Math.max(p.size ?? 0, 0));
  const minS = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxS = sizes.length > 0 ? Math.max(...sizes) : 0;

  let s = svgOpenSize(width, height);

  // Gridlines + tick labels on both axes.
  for (const t of sy.ticks) {
    const y = Y(t);
    s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t === sy.min ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x0 - 8}" y="${y + 3}" class="t-sub c-soft" text-anchor="end">${escapeHtml(tickY(t))}</text>`;
  }
  for (const t of sx.ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${t === sx.min ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x}" y="${y1 + 16}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(tickX(t))}</text>`;
  }

  // Axis titles.
  if (data.xLabel !== undefined) {
    s += `<text x="${Math.round((x0 + x1) / 2)}" y="${height - 8}" class="t-eyebrow" text-anchor="middle"${bp('xLabel')}>${escapeHtml(data.xLabel)}</text>`;
  }
  if (data.yLabel !== undefined) {
    const cy = Math.round((y0 + y1) / 2);
    s += `<text x="14" y="${cy}" class="t-eyebrow" text-anchor="middle" transform="rotate(-90 14 ${cy})"${bp('yLabel')}>${escapeHtml(data.yLabel)}</text>`;
  }

  // Dashed reference guides + quadrant corner labels (TL, TR, BL, BR).
  if (guides !== undefined) {
    if (guides.x !== undefined) {
      const gx = X(guides.x);
      s += `<line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y1}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 4"${bp('guides.x')}/>`;
    }
    if (guides.y !== undefined) {
      const gy = Y(guides.y);
      s += `<line x1="${x0}" y1="${gy}" x2="${x1}" y2="${gy}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 4"${bp('guides.y')}/>`;
    }
    if (guides.quadrants !== undefined && guides.quadrants.length === 4) {
      const [tl, tr, bl_, br] = guides.quadrants;
      const corner = (
        text: string | undefined,
        x: number,
        y: number,
        anchor: 'start' | 'end',
        i: number,
      ): string =>
        text === undefined || text === ''
          ? ''
          : `<text x="${x}" y="${y}" class="t-eyebrow" text-anchor="${anchor}"${bp(`guides.quadrants.${i}`)}>${escapeHtml(text)}</text>`;
      s += corner(tl, x0 + 8, y0 + 12, 'start', 0);
      s += corner(tr, x1 - 8, y0 + 12, 'end', 1);
      s += corner(bl_, x0 + 8, y1 - 8, 'start', 2);
      s += corner(br, x1 - 8, y1 - 8, 'end', 3);
    }
  }

  // Bubble geometry first — a label must dodge EVERY bubble, so all discs are
  // known before any label is placed. Dots always sit at their true
  // coordinates, even when coincident; only labels move.
  const dots: Dot[] = points.map((p) => ({
    px: X(p.x),
    py: Y(p.y),
    r: scRadius(p.size, minS, maxS),
  }));

  const marks = marksOf(points.map((p) => p.accent));
  let dotSvg = `<g${bl('points')}>`;
  points.forEach((p, i) => {
    const d = dots[i];
    if (d === undefined) return;
    const color = pointColor(marks[i]);
    const tip = `${p.label !== undefined ? `${p.label} — ` : ''}${exactNum(p.x)}, ${exactNum(p.y, data.unit)}${p.size !== undefined ? ` (${exactNum(p.size)})` : ''}`;
    dotSvg += `<circle cx="${d.px}" cy="${d.py}" r="${d.r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"${bp(`points.${i}`)}><title>${escapeHtml(tip)}</title></circle>`;
  });
  dotSvg += `</g>`;

  // Label placement, in point-index order (deterministic). Candidates per
  // label: right of the bubble, left (end-anchor flip), above, below. A
  // candidate is rejected when its box leaves the SVG, crosses ANY bubble, or
  // crosses an already-placed label. No candidate fits → the label is
  // SUPPRESSED (the bubble's <title> still carries it). A label that lands
  // >14px from its default anchor gets a thin leader line back to its bubble.
  const placed: LabelBox[] = [];
  let leaders = '';
  let labels = '';
  points.forEach((p, i) => {
    const d = dots[i];
    if (d === undefined || p.label === undefined || p.label === '') return;
    const text = scLabel(p.label);
    const w = text.length * 6;
    const { px, py, r } = d;
    // Clearance radius: a coincident or covering bubble (think identical
    // coordinates with different sizes) is what the label really has to
    // clear, not just this point's own disc.
    let rc = r;
    for (const c of dots) {
      const dist = Math.sqrt((c.px - px) * (c.px - px) + (c.py - py) * (c.py - py));
      if (dist < c.r && c.r + dist > rc) rc = c.r + dist;
    }
    const candidates: ReadonlyArray<{ anchor: 'start' | 'end' | 'middle'; lx: number; ly: number }> = [
      { anchor: 'start', lx: px + rc + 5, ly: py + 3 },
      { anchor: 'end', lx: px - rc - 5, ly: py + 3 },
      { anchor: 'middle', lx: px, ly: py - rc - 7 },
      { anchor: 'middle', lx: px, ly: py + rc + 12 },
    ];
    const boxFor = (c: (typeof candidates)[number]): LabelBox => ({
      x0: c.anchor === 'start' ? c.lx : c.anchor === 'end' ? c.lx - w : c.lx - w / 2,
      x1: c.anchor === 'start' ? c.lx + w : c.anchor === 'end' ? c.lx : c.lx + w / 2,
      y0: c.ly - 9,
      y1: c.ly + 2,
    });
    const fits = (b: LabelBox): boolean =>
      b.x0 >= 2 &&
      b.x1 <= width - 2 &&
      b.y0 >= 2 &&
      b.y1 <= height - 2 &&
      !dots.some((c) => circleHitsBox(c, b)) &&
      !placed.some((pb) => boxesOverlap(pb, b));
    const pick = candidates.find((c) => fits(boxFor(c)));
    if (pick === undefined) return; // suppressed — <title> keeps the data
    const box = boxFor(pick);
    placed.push(box);
    // Leader when the label sits away from its default (right-of-bubble) spot.
    const dx = pick.lx - (px + r + 5);
    const dy = pick.ly - (py + 3);
    if (Math.sqrt(dx * dx + dy * dy) > 14) {
      // From the box edge nearest the bubble to just outside the bubble rim.
      const sxp = Math.max(box.x0, Math.min(px, box.x1));
      const syp = Math.max(box.y0, Math.min(py, box.y1));
      const len = Math.sqrt((px - sxp) * (px - sxp) + (py - syp) * (py - syp));
      if (len > r + 2) {
        const ex = px - ((px - sxp) / len) * (r + 1.5);
        const ey = py - ((py - syp) / len) * (r + 1.5);
        leaders += `<line x1="${Math.round(sxp * 10) / 10}" y1="${Math.round(syp * 10) / 10}" x2="${Math.round(ex * 10) / 10}" y2="${Math.round(ey * 10) / 10}" stroke="var(--muted)" stroke-width="0.75"/>`;
      }
    }
    const full = p.label.length > SC_LABEL_CHARS ? `<title>${escapeHtml(p.label)}</title>` : '';
    // Inline style, not an attribute: editors read the anchor back from it.
    labels += `<text x="${Math.round(pick.lx * 10) / 10}" y="${Math.round(pick.ly * 10) / 10}" class="t-sub c-ink" style="text-anchor:${pick.anchor}"${bp(`points.${i}.label`)}>${escapeHtml(text)}${full}</text>`;
  });

  // Leaders under the bubbles, labels on top.
  s += leaders + dotSvg + labels + `</svg>`;

  const items: LegendItem[] = [];
  if (marks.some((m) => m === undefined)) items.push({ swatch: 'fill', fill: 'var(--ink)', label: 'point' });
  if (marks.some((m) => m === 'focal')) items.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal' });
  if (marks.some((m) => m === 'negative')) items.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  if (guides?.x !== undefined || guides?.y !== undefined) items.push({ swatch: 'edge-dashed', label: 'guide' });
  return { svg: s, legend: renderLegend(items) };
}

/**
 * `kind: gauge` — radial progress against a ceiling.
 *
 * A donut answers "how does the whole split up"; a gauge answers "how far
 * along is this one number", which is the shape an SLO, a quota, a migration
 * or a rollout actually has. Each item is an arc over the same 270° sweep
 * (open at the bottom, so the dial reads as a dial rather than a ring), swept
 * to `value / max` — `max` defaults to 100, the percentage case. The arc is
 * clamped to the dial; the number in the middle is always the true value
 * (`132%` of a quota prints 132%, a full arc, and a tick past the end).
 *
 * One item draws a single big dial with the value in the middle; several
 * become concentric rings, outermost first, each in its own hue, with the
 * track behind it so an empty arc still reads as "nearly none of it" instead
 * of as missing.
 */
function renderGauge(data: ChartData, items: readonly DonutItem[]): Drawn {
  const width = 420;
  const solo = items.length <= 1;
  const height = solo ? 246 : 264;
  const cx = Math.round(width / 2);
  const cy = solo ? 150 : 158;
  const max = data.max !== undefined && data.max > 0 ? data.max : 100;
  // 270°: from 135° past the bottom-left, clockwise to 45°.
  const START = 135;
  const SWEEP = 270;
  const outer = solo ? 92 : 96;
  const band = solo ? 26 : 16;
  const gap = 7;

  const pointOn = (r: number, deg: number): string => {
    const a = (deg * Math.PI) / 180;
    return `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
  };
  const arc = (r: number, fraction: number): string => {
    const sweep = SWEEP * Math.min(Math.max(fraction, 0), 1);
    if (sweep <= 0) return '';
    const large = sweep > 180 ? 1 : 0;
    return `M ${pointOn(r, START)} A ${r} ${r} 0 ${large} 1 ${pointOn(r, START + sweep)}`;
  };

  let s = svgOpenSize(width, height);
  const marks = marksOf(items.map((it) => it.accent));
  const colorOf = (i: number): string =>
    marks[i] === 'negative' ? 'var(--negative)' : marks[i] === 'focal' ? 'var(--accent)' : seriesStyle(i, items.length).color;
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const r = outer - i * (band + gap);
    if (r <= band) return; // out of rings — the legend still names the item
    const fraction = pos(it.value) / max;
    s += `<g${bp(`items.${i}`)}><title>${escapeHtml(`${it.label} — ${exactNum(it.value, data.unit)} of ${exactNum(max, data.unit)}`)}</title>`;
    s += `<path d="${arc(r, 1)}" fill="none" stroke="var(--paper)" stroke-width="${band}" stroke-linecap="round"${DECORATIVE}/>`;
    const filled = arc(r, fraction);
    if (filled !== '') {
      s += `<path d="${filled}" fill="none" stroke="${colorOf(i)}" stroke-width="${band}" stroke-linecap="round"/>`;
    }
    // Past the ceiling: a small arrowhead just beyond the dial's end, outside
    // the band, says "over" (the number in the middle says by how much).
    if (fraction > 1) {
      const deg = START + SWEEP + 9;
      const a = (deg * Math.PI) / 180;
      const tx = (rr: number, d: number): string => {
        const b = ((deg + d) * Math.PI) / 180;
        return `${r1(cx + rr * Math.cos(b))} ${r1(cy + rr * Math.sin(b))}`;
      };
      const mid = `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
      s += `<path class="chart-over" d="M ${tx(r - band / 2, -7)} L ${mid} L ${tx(r + band / 2, -7)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`;
    }
    s += `</g>`;
  });
  s += `</g>`;

  const lead = items[0];
  if (lead !== undefined) {
    // The middle carries the leading item: its true value big, then what it is.
    s += `<text x="${cx}" y="${cy + (solo ? 6 : 2)}" class="chart-total">${escapeHtml(compactNum(lead.value, data.unit))}</text>`;
    const caption = solo ? (lead.desc ?? lead.label) : 'OF ' + compactNum(max, data.unit);
    s += `<text x="${cx}" y="${cy + (solo ? 26 : 20)}" class="t-eyebrow" text-anchor="middle">${escapeHtml(caption.toUpperCase())}</text>`;
  }
  // Scale ends, just outside the two open ends of the dial (135° and 45°) —
  // clear of the stroke, so a full arc never runs over its own labels.
  const scaleR = outer + band / 2 + 13;
  const scaleX = Math.round(scaleR * Math.cos((135 * Math.PI) / 180));
  const scaleY = Math.round(cy + scaleR * Math.sin((135 * Math.PI) / 180));
  s += `<text x="${cx + scaleX}" y="${scaleY}" class="t-sub c-soft" text-anchor="middle">0</text>`;
  s += `<text x="${cx - scaleX}" y="${scaleY}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(compactNum(max, data.unit))}</text>`;
  s += `</svg>`;

  let legend = '';
  if (items.length > 1 || (items[0]?.desc !== undefined && !solo)) {
    legend = renderLegend(
      items.map((it, i) => ({ swatch: 'fill', fill: colorOf(i), label: `${it.label} — ${exactNum(it.value, data.unit)}`, path: `items.${i}` })),
      'items',
    );
  }
  return { svg: s, legend };
}

/**
 * `kind: radar` — one closed polygon per series over 3+ axes. The rings are
 * the nice ticks of a signed domain: a negative score sits inside the zero
 * ring (drawn solid) instead of collapsing onto the centre.
 */
function renderRadar(data: ChartData, labels: readonly string[], series: readonly Series[]): string {
  const height = 280;
  const cy = Math.round(height / 2);
  const r = 100;
  const n = labels.length;
  // Fewer than 3 axes can't form a web — render the empty frame.
  if (n < 3) return svgOpenSize(420, 60) + `</svg>`;
  // The canvas is as wide as the longest axis label needs, so none runs off it.
  let half = 210;
  labels.forEach((label, i) => {
    const cos = Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n);
    const x = (r + 14) * cos;
    const w = textW(label);
    const reach = cos > 0.3 ? x + w : cos < -0.3 ? -x + w : w / 2;
    half = Math.max(half, Math.ceil(reach + 12));
  });
  const width = half * 2;
  const cx = half;
  const { lo, hi } = extentOf(series, n, false);
  const scale = zeroScale(lo, hi, data.max);
  const span = scale.hi - scale.lo || 1;
  const radius = (v: number): number => (r * (Math.min(Math.max(v, scale.lo), scale.hi) - scale.lo)) / span;
  const angleAt = (i: number): number => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const ptAt = (i: number, rr: number): readonly [number, number] => {
    const a = angleAt(i);
    return [r1(cx + rr * Math.cos(a)), r1(cy + rr * Math.sin(a))];
  };
  let s = svgOpenSize(width, height);
  // Concentric rings (hairline polygons, one per nice tick) + axis spokes.
  scale.ticks.forEach((t, ri) => {
    if (t === scale.lo) return;
    const pts = Array.from({ length: n }, (_, i) => ptAt(i, radius(t)).join(','));
    const solid = ri === scale.ticks.length - 1 || (t === 0 && scale.lo < 0);
    s += `<polygon points="${pts.join(' ')}" fill="none" stroke="${solid ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
  });
  for (let i = 0; i < n; i++) {
    const [x, y] = ptAt(i, r);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  }
  // Axis labels at the spoke ends, anchored away from the web.
  s += `<g${bl('labels')}>`;
  labels.forEach((label, i) => {
    const a = angleAt(i);
    const [x, y] = ptAt(i, r + 14);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    s += `<text x="${x}" y="${r1(y + 3)}" class="t-sub" text-anchor="${anchor}"${bp(`labels.${i}`)}>${escapeHtml(label)}</text>`;
  });
  s += `</g>`;
  // One stroked polygon (+ vertex dots) per series.
  s += `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const st = seriesStyle(si, series.length, sr.accent);
    const vals = Array.from({ length: n }, (_, i) => num(sr.values[i]) ?? 0);
    const pts = vals.map((v, i) => ptAt(i, radius(v)));
    const dash = st.dash !== '' ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<g${bp(`series.${si}`)}>`;
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${st.color}" fill-opacity="0.1" stroke="${st.color}" stroke-width="1.75" stroke-linejoin="round"${dash}/>`;
    pts.forEach(([x, y], i) => {
      s += `<g>${barTip(sr, labels[i], vals[i] ?? 0, data.unit)}${marker(st, x, y, 2.5)}</g>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return s + `</svg>`;
}

// ─── kind: waterfall (a bridge / budget cascade — the former `waterfall` type) ─
// Horizontal cascading bars: each step starts where the running total stands
// and moves it by its signed value — an increase runs right (solid), a
// decrease runs left (outlined), and a dashed connector carries the running
// total down to the next step. The final TOTAL row runs from 0 to the signed
// sum in ink. The axis holds 0 and every running total, so a cascade that dips
// under zero shows it (a solid zero line). An optional `budget` draws a dashed
// cap line — the part of an increase past it tints negative — and the total
// row gets an over / under / on-budget chip. Renders inside the diagram frame
// (tag BUDGET).

const WFL_MIN_WIDTH = 720;
const WFL_BAR_H = 34;
const WFL_GAP = 14;
/** The widest the label column gets (px); a label wider than one line wraps to two. */
const WFL_LABEL_W = 220;

/** An exact value with the unit (default "ms", the former latency-budget type), thousands grouped. */
function wflFmt(v: number, unit: string | undefined): string {
  return exactNum(v, unit === undefined ? ' ms' : unit.startsWith(' ') || isWordUnit(unit) ? spaced(unit) : unit);
}

/** A word unit (`ms`, `USD`) reads better spaced from its number. */
function isWordUnit(unit: string): boolean {
  return /^[A-Za-z]/.test(unit);
}
function spaced(unit: string): string {
  return unit.startsWith(' ') ? unit : ` ${unit}`;
}

/** The label lines of a step: the label wrapped to two lines, or the label over its desc. */
function wflLines(item: DonutItem, i: number): { lines: string[]; desc: string | undefined; cut: boolean } {
  const hasDesc = item.desc !== undefined && item.desc.length > 0;
  const label = fitText(item.label, {
    width: WFL_LABEL_W,
    font: FONT.name,
    maxLines: hasDesc ? 1 : 2,
    report: { field: 'label', path: `items.${i}.label`, hint: 'shorten the step label' },
  });
  if (!hasDesc) return { lines: label.lines, desc: undefined, cut: label.truncated };
  const desc = fitText(item.desc, { width: WFL_LABEL_W, font: FONT.sub, maxLines: 1, report: { field: 'desc', path: `items.${i}.desc` } });
  return { lines: label.lines, desc: desc.lines[0], cut: label.truncated || desc.truncated };
}

function renderWaterfallBody(data: ChartData): string {
  const items = data.items ?? [];
  const unit = data.unit;
  const vals = items.map((it) => num(it.value) ?? 0);
  const starts: number[] = [];
  const ends: number[] = [];
  let run = 0;
  for (const v of vals) {
    starts.push(run);
    run += v;
    ends.push(run);
  }
  const total = run;
  const budget = data.budget !== undefined && data.budget > 0 ? data.budget : undefined;
  const hasBudget = budget !== undefined;
  const topPad = hasBudget ? 22 : 6;
  const rows = items.length + (items.length > 0 ? 1 : 0); // items + TOTAL
  const height = Math.max(topPad + rows * (WFL_BAR_H + WFL_GAP) - (rows > 0 ? WFL_GAP : 0) + 6, 40);

  const labels = items.map(wflLines);
  const labelW = Math.min(
    WFL_LABEL_W,
    Math.max(80, ...labels.map((l) => Math.max(...l.lines.map((ln) => textWidth(ln, FONT.name)), l.desc !== undefined ? textWidth(l.desc, FONT.sub) : 0))),
  );
  const x0 = Math.round(labelW + 14);

  // The value printed beside a step: signed for a change, plain for the
  // first step (the base the bridge starts from) and the total.
  const stepText = (v: number, i: number): string => (i > 0 && v > 0 ? `+${wflFmt(v, unit)}` : wflFmt(v, unit));
  const valueW = Math.max(74, ...vals.map((v, i) => textW(stepText(v, i)) + 12), textW(wflFmt(total, unit)) + 12);

  // The domain holds 0, every running total and (when near) the budget.
  const extent = [0, ...starts, ...ends];
  const lo = Math.min(...extent);
  const hiData = Math.max(...extent);
  // A budget far beyond the cascade would crush the bars into slivers: scale to
  // the bars instead and annotate the off-scale budget (the under-chip carries
  // the headroom). The in-plot cap line only draws when it's within ~1.4× the top.
  const budgetOnScale = hasBudget && hiData > 0 && budget <= hiData * 1.4;
  const hi = budgetOnScale ? Math.max(hiData, budget) : hiData;
  const chipW = (label: string): number => 20 + label.length * 6;
  const budgetLabel = (): string => {
    if (budget === undefined) return '';
    const diff = Math.round((total - budget) * 100) / 100;
    return diff === 0 ? 'on budget' : diff > 0 ? `${wflFmt(diff, unit)} over` : `${wflFmt(-diff, unit)} under`;
  };
  const chipRoom = hasBudget ? textW(wflFmt(total, unit)) + 8 + chipW(budgetLabel()) + 12 : 0;
  const plotW = WFL_MIN_WIDTH - x0 - Math.max(valueW, chipRoom);
  const span = hi - lo || 1;
  const px = (v: number): number => r1(x0 + (plotW * (v - lo)) / span);
  const width = WFL_MIN_WIDTH;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Budget waterfall</title>`;

  // The zero line, when the cascade crosses it.
  if (lo < 0) {
    s += `<line x1="${px(0)}" y1="${topPad - 4}" x2="${px(0)}" y2="${height - 4}" stroke="var(--rule-solid)" stroke-width="1"${DECORATIVE}/>`;
  }

  let over = false;
  let ups = false;
  let downs = false;
  const marks = marksOf(items.map((it) => it.accent));
  const focal = marks.includes('focal');
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const v = vals[i] ?? 0;
    const a = starts[i] ?? 0;
    const b = ends[i] ?? 0;
    const y = topPad + i * (WFL_BAR_H + WFL_GAP);
    const left = px(Math.min(a, b));
    const right = px(Math.max(a, b));
    const bw = Math.max(r1(right - left), 2);
    const down = v < 0;
    if (down) downs = true;
    else ups = true;
    const mark = marks[i];
    const paint =
      mark === 'negative'
        ? 'fill="var(--negative)"'
        : mark === 'focal'
          ? 'fill="var(--accent)"'
          : down
            ? 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25"'
            : 'fill="var(--muted)"';
    const lab = labels[i] ?? { lines: [it.label], desc: undefined, cut: false };
    const full = it.desc !== undefined && it.desc.length > 0 ? `${it.label} — ${it.desc}` : it.label;
    s += `<g${bp(`items.${i}`)}>`;
    if (lab.cut) s += `<title>${escapeHtml(full)}</title>`;
    // Label column: one or two name lines, or the name over its desc.
    const lines = lab.lines;
    const n = lines.length + (lab.desc !== undefined ? 1 : 0);
    const ly0 = y + WFL_BAR_H / 2 - ((n - 1) * 14) / 2 + 4.5;
    s += `<text x="0" y="${r1(ly0)}" class="t-name"${bp(`items.${i}.label`)}>${lines.map((ln, li) => (li === 0 ? escapeHtml(ln) : `<tspan x="0" y="${r1(ly0 + li * 14)}">${escapeHtml(ln)}</tspan>`)).join('')}</text>`;
    if (lab.desc !== undefined) {
      s += `<text x="0" y="${r1(ly0 + lines.length * 14)}" class="t-sub c-soft"${bp(`items.${i}.desc`)}>${escapeHtml(lab.desc)}</text>`;
    }
    s += `<rect x="${left}" y="${y}" width="${bw}" height="${WFL_BAR_H}" ${paint} data-dir="${down ? 'down' : 'up'}"/>`;
    // The part of an increase past the budget tints negative.
    if (hasBudget && !down && b > budget) {
      over = true;
      const overStart = Math.max(a, budget);
      const ox = px(overStart);
      const ow = Math.max(r1(px(b) - ox), 2);
      s += `<rect x="${ox}" y="${y}" width="${ow}" height="${WFL_BAR_H}" fill="var(--negative)"/>`;
    }
    s += `<text x="${r1(left + bw + 6)}" y="${y + 22}" class="t-sub c-muted"${bp(`items.${i}.value`)}>${escapeHtml(stepText(v, i))}</text>`;
    // Connector: the running total carried down to the next row.
    const nextY = y + WFL_BAR_H + WFL_GAP;
    s += `<line x1="${px(b)}" y1="${y + WFL_BAR_H}" x2="${px(b)}" y2="${nextY}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="2 2"${DECORATIVE}/>`;
    s += `</g>`;
  });
  s += `</g>`;

  // The TOTAL row: from 0 to the signed sum, in ink.
  if (items.length > 0) {
    const y = topPad + items.length * (WFL_BAR_H + WFL_GAP);
    const left = px(Math.min(0, total));
    const tw = Math.max(r1(px(Math.max(0, total)) - left), 2);
    s += `<g class="wf-total"><text x="0" y="${y + 22}" class="t-eyebrow c-ink">TOTAL</text>`;
    s += `<rect x="${left}" y="${y}" width="${tw}" height="${WFL_BAR_H}" fill="var(--ink)"/>`;
    const totalText = wflFmt(total, unit);
    const tx = r1(left + tw + 6);
    s += `<text x="${tx}" y="${y + 22}" class="t-sub c-ink">${escapeHtml(totalText)}</text>`;
    // Over / under / on-budget chip after the total value.
    if (hasBudget) {
      const label = budgetLabel();
      const isOver = total > budget;
      const cw = chipW(label);
      const cx = r1(tx + textW(totalText) + 8);
      const stroke = isOver ? 'var(--negative)' : 'var(--rule-solid)';
      const cls = isOver ? ' c-negative' : ' c-muted';
      s += `<rect x="${cx}" y="${y + 4}" width="${cw}" height="${WFL_BAR_H - 8}" rx="2" fill="var(--paper)" stroke="${stroke}" stroke-width="1"/>`;
      s += `<text x="${r1(cx + cw / 2)}" y="${y + 21}" class="t-arrow${cls}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }
    s += `</g>`;
  }

  // Dashed budget cap line + label (drawn last so it sits above the bars).
  if (hasBudget && budgetOnScale) {
    const lx = px(budget);
    s += `<line x1="${lx}" y1="${topPad - 6}" x2="${lx}" y2="${height - 4}" stroke="var(--negative)" stroke-width="1.25" stroke-dasharray="5 4"/>`;
    const text = `budget: ${wflFmt(budget, unit)}`;
    // Flip the label to the left of the line when it would overflow the frame.
    const flip = lx + 6 + textW(text, ARROW_CH) > width - 4;
    s += `<text x="${r1(flip ? lx - 6 : lx + 6)}" y="${topPad - 8}" class="t-arrow c-negative"${flip ? ' text-anchor="end"' : ''}${bp('budget')}>${escapeHtml(text)}</text>`;
  } else if (hasBudget) {
    // Off-scale budget: annotate instead of drawing an unreachable line.
    s += `<text x="${width - 4}" y="${topPad - 8}" class="t-arrow c-negative" text-anchor="end"${bp('budget')}>budget: ${escapeHtml(wflFmt(budget, unit))} — beyond scale →</text>`;
  }

  s += `</svg>`;

  const legend: LegendItem[] = [];
  if (ups) legend.push({ swatch: 'fill', fill: 'var(--muted)', label: 'increase' });
  if (downs) legend.push({ swatch: 'node', label: 'decrease' });
  if (items.length > 0) legend.push({ swatch: 'fill', fill: 'var(--ink)', label: 'total' });
  if (focal) legend.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal step' });
  if (hasBudget) legend.push({ swatch: 'edge-dashed', label: 'budget cap' });
  if (over) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'over budget' });
  const legendHtml = renderLegend(legend);
  return diagramFrame(
    {
      tag: 'BUDGET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

// ─── kind: funnel (conversion funnel — the former `funnel` type) ─────────────
// Stages stack vertically as centred trapezoid bands whose width is truly
// proportional to `value / maxValue` — a stage worth 0.5% of the top is a
// sliver (never less than a few px), not a floored block that looks like its
// neighbours. A stage's name and value sit inside its band when they fit and
// beside it when the band is too narrow. Between bands, a small mono chip
// shows the stage-to-stage conversion (`↓ 40%`) — honestly above 100% when a
// stage grows, and 0% when the previous stage is 0. Every stage after the
// first also prints its share of the first stage. Stages come from `items`,
// or the funnel-era legacy `stages` (whose data paths they keep). Renders
// inside the diagram frame (tag FUNNEL).

/** The widest band (the largest stage). */
const FN_BAND_MAX = 520;
/** The narrowest band: a stage that rounds to nothing still shows. */
const FN_MIN_PX = 3;
const FN_BAND_H = 54;
const FN_GAP = 10; // gap between a band and the conversion-chip zone
const FN_CHIP_H = 18;
/** Gap between a narrow band and the label beside it. */
const FN_BESIDE = 14;

/** Band width in px for a value: proportional, floored at {@link FN_MIN_PX}. */
function fnWidthFor(value: number, maxValue: number): number {
  const frac = maxValue > 0 ? pos(value) / maxValue : 0;
  return Math.max(FN_MIN_PX, r1(FN_BAND_MAX * frac));
}

/** A share as a short percent: `40%`, `7.2%`, `0.44%`. */
function pctText(p: number): string {
  if (!Number.isFinite(p)) return '0%';
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${Math.round(p * 10) / 10}%`;
  if (p === 0) return '0%';
  return `${Number(p.toPrecision(2))}%`;
}

interface FunnelRow {
  readonly stage: DonutItem;
  readonly topW: number;
  readonly botW: number;
  readonly value: string;
  readonly inside: boolean;
  /** Width the text needs (the widest of its lines). */
  readonly textW: number;
  /** The band's widest point across the text block — a label beside the band starts past it. */
  readonly reach: number;
}

/** The text lines of a funnel stage: their baselines (offset from the band top) and widths. */
function funnelLines(stage: DonutItem, value: string): { dy: number; w: number }[] {
  const hasDesc = stage.desc !== undefined && stage.desc.length > 0;
  const lines = [
    { dy: hasDesc ? 20 : 24, w: textWidth(stage.label, FONT.name) },
    { dy: hasDesc ? 35 : 40, w: textW(value) },
  ];
  if (hasDesc) lines.push({ dy: 47, w: textW(stage.desc ?? '') });
  return lines;
}

function funnelRows(stages: readonly DonutItem[], maxValue: number, unit: string | undefined): FunnelRow[] {
  const first = pos(stages[0]?.value ?? 0);
  return stages.map((stage, i) => {
    const next = stages[i + 1];
    const topW = fnWidthFor(stage.value, maxValue);
    const botW = next !== undefined ? fnWidthFor(next.value, maxValue) : topW;
    const share = i > 0 && first > 0 ? ` · ${pctText((pos(stage.value) / first) * 100)} of top` : '';
    const value = `${exactNum(stage.value, unit === undefined ? undefined : spaced(unit))}${share}`;
    // The band's width at a height inside it (it runs from topW to botW).
    const at = (dy: number): number => topW + ((botW - topW) * Math.min(Math.max(dy, 0), FN_BAND_H)) / FN_BAND_H;
    const lines = funnelLines(stage, value);
    // Inside only when every line fits the band at its own height, with room
    // to spare at the narrow end of the glyphs (cap height above the baseline).
    const inside = lines.every((ln) => Math.min(at(ln.dy - 10), at(ln.dy + 3)) >= ln.w + 24);
    const top = (lines[0]?.dy ?? 0) - 10;
    const bottom = (lines[lines.length - 1]?.dy ?? 0) + 3;
    return {
      stage,
      topW,
      botW,
      value,
      inside,
      textW: Math.max(...lines.map((ln) => ln.w)),
      reach: Math.max(at(top), at(bottom)),
    };
  });
}

function renderFunnelBand(row: FunnelRow, i: number, mark: Mark, cx: number, y: number, key: string): string {
  const { stage, topW, botW } = row;
  const fill = mark === 'negative' ? 'var(--negative)' : mark === 'focal' ? 'var(--accent)' : 'var(--ink-2)';
  const pts = [
    `${r1(cx - topW / 2)},${y}`,
    `${r1(cx + topW / 2)},${y}`,
    `${r1(cx + botW / 2)},${y + FN_BAND_H}`,
    `${r1(cx - botW / 2)},${y + FN_BAND_H}`,
  ].join(' ');
  const hasDesc = stage.desc !== undefined && stage.desc.length > 0;
  const labelY = hasDesc ? y + 20 : y + 24;
  const valueY = hasDesc ? y + 35 : y + 40;
  // Inside a band the text is paper (no halo); beside it the text keeps the roles.
  const tx = row.inside ? cx : r1(cx + row.reach / 2 + FN_BESIDE);
  const anchor = row.inside ? 'middle' : 'start';
  const nameAttrs = row.inside ? ` class="t-name"${ON_DARK}` : ' class="t-name"';
  const subAttrs = row.inside ? ` class="t-sub"${ON_DARK}` : ' class="t-sub c-muted"';
  const descText = hasDesc
    ? `<text x="${tx}" y="${y + 47}"${subAttrs} text-anchor="${anchor}"${bp(`${key}.${i}.desc`)}>${escapeHtml(stage.desc ?? '')}</text>`
    : '';
  return (
    `<g${bp(`${key}.${i}`)}>` +
    `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="1" data-label="${row.inside ? 'inside' : 'beside'}"><title>${escapeHtml(`${stage.label} — ${exactNum(stage.value)}`)}</title></polygon>` +
    `<text x="${tx}" y="${labelY}"${nameAttrs} text-anchor="${anchor}"${bp(`${key}.${i}.label`)}>${escapeHtml(stage.label)}</text>` +
    `<text x="${tx}" y="${valueY}"${subAttrs} text-anchor="${anchor}"${bp(`${key}.${i}.value`)}>${escapeHtml(row.value)}</text>` +
    descText +
    `</g>`
  );
}

function renderFunnelChip(from: DonutItem, to: DonutItem, cx: number, y: number): string {
  const prev = pos(from.value);
  const next = pos(to.value);
  const label = `↓ ${prev > 0 ? pctText((next / prev) * 100) : '0%'}`;
  const w = 20 + textW(label, ARROW_CH);
  return (
    `<rect x="${r1(cx - w / 2)}" y="${y}" width="${r1(w)}" height="${FN_CHIP_H}" rx="2" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
    `<text x="${cx}" y="${y + 13}" class="t-arrow" text-anchor="middle">${escapeHtml(label)}</text>`
  );
}

function renderFunnelBody(data: ChartData): string {
  // `items` is the canonical field; `stages` is the funnel-era legacy synonym.
  // Data paths address whichever field the YAML actually uses.
  const key = data.items !== undefined ? 'items' : 'stages';
  const stages = data.items ?? data.stages ?? [];
  const maxValue = Math.max(...stages.map((s) => pos(s.value)), 0);
  const rows = funnelRows(stages, maxValue, data.unit);
  const stepH = FN_BAND_H + FN_GAP + FN_CHIP_H + FN_GAP;
  const height = Math.max(stages.length * FN_BAND_H + (stages.length - 1) * (FN_GAP + FN_CHIP_H + FN_GAP), 0);
  // The funnel's axis sits left of centre when a label beside a narrow band
  // needs the room; the canvas grows to hold the widest of them.
  const cx = FN_BAND_MAX / 2 + 20;
  const reach = Math.max(
    cx + FN_BAND_MAX / 2 + 20,
    ...rows.filter((r) => !r.inside).map((r) => cx + r.reach / 2 + FN_BESIDE + r.textW + 12),
  );
  const width = Math.ceil(reach);
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Funnel</title>`;
  const marks = marksOf(stages.map((st) => st.accent));
  s += `<g${bl(key)}>`;
  rows.forEach((row, i) => {
    const y = i * stepH;
    s += renderFunnelBand(row, i, marks[i], cx, y, key);
    const next = stages[i + 1];
    if (next !== undefined) s += renderFunnelChip(row.stage, next, cx, y + FN_BAND_H + FN_GAP);
  });
  s += `</g>`;
  s += `</svg>`;
  const legend: LegendItem[] = [];
  if (stages.length > 1) legend.push({ swatch: 'fill', fill: 'var(--ink-2)', label: 'stage (width = count)' });
  if (marks.includes('focal')) legend.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal stage' });
  if (marks.includes('negative')) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  if (stages.length > 1) legend.push({ swatch: 'chip', chip: '↓ %', label: 'conversion from the stage above' });
  const legendHtml = renderLegend(legend);
  return diagramFrame(
    {
      tag: 'FUNNEL',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

export function renderChart(data: ChartData): string {
  const kind = data.kind ?? 'bar';
  // Waterfall and funnel are whole visual languages of their own (moved in
  // from the former `waterfall` / `funnel` types) — they own their frame.
  if (kind === 'waterfall') return renderWaterfallBody(data);
  if (kind === 'funnel') return renderFunnelBody(data);
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  let drawn: Drawn;
  if (kind === 'donut' || kind === 'pie') {
    drawn = renderDonut(data, data.items ?? [], kind === 'pie');
  } else if (kind === 'histogram') {
    drawn = renderHistogram(data);
  } else if (kind === 'bell') {
    drawn = renderBell(data);
  } else if (kind === 'boxplot') {
    drawn = renderBoxplot(data);
  } else if (kind === 'pareto') {
    drawn = renderPareto(data);
  } else if (kind === 'bullet') {
    drawn = renderBullet(data);
  } else if (kind === 'dumbbell') {
    drawn = renderDumbbell(data);
  } else if (kind === 'gauge') {
    drawn = renderGauge(data, data.items ?? []);
  } else if (kind === 'scatter' && data.points !== undefined && data.points.length > 0) {
    // Numeric-axis scatter: each point owns its x/y. The `labels`+`series`
    // scatter below stays as the ordinal fallback for existing docs.
    drawn = renderScatterPoints(data, data.points);
  } else if (kind === 'radar') {
    // Radar uses `labels` as the axes (3+ required to draw a web).
    drawn = { svg: renderRadar(data, labels, series), legend: seriesLegend(series, true) };
  } else {
    // Derive labels when omitted so a bare series still charts (1, 2, 3, …).
    const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
    const cats = labels.length > 0 ? labels : Array.from({ length: n }, (_, i) => String(i + 1));
    const tagLabels = labels.length > 0;
    const body =
      kind === 'bar'
        ? wantsHorizontal(cats)
          ? renderBarsH(data, cats, series, tagLabels)
          : renderBars(data, cats, series, tagLabels)
        : kind === 'stacked'
          ? renderStacked(data, cats, series, tagLabels)
          : kind === 'scatter'
            ? renderScatter(data, cats, series, tagLabels)
            : renderLineArea(data, cats, series, kind === 'area', tagLabels);
    drawn = { svg: body, legend: seriesLegend(series, kind === 'line' || kind === 'area') };
  }
  return diagramFrame(
    {
      tag: 'CHART',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(drawn.legend.length > 0 ? { legendHtml: drawn.legend } : {}),
    },
    drawn.svg,
  );
}
