/**
 * Renders a `percentiles` block — a dot-and-whisker plot of latency
 * distributions: one row per series, one shared axis. The whisker (a
 * `rule-solid` line) runs from p50 to the last value the row has (p99 /
 * p999 / max); p50 is the filled ink dot, p90 and p95 small hollow ink rings,
 * p99 the filled accent dot (the tail is the story of every row), max a
 * hollow ring with a × mark. A small dot that would sit on another moves just
 * off the whisker, with a hairline back to its true x.
 *
 * The SLO is a dashed vertical rule (`slo` on the block; a row's own `slo`
 * draws a short rule across that row instead). A row whose p99 crosses its
 * SLO takes `negative` on the p99 dot and its value.
 *
 * One long tail must not squeeze every row to a dot. Without a `scale`, the
 * axis turns log (decade ticks, a `LOG SCALE` tag) when the largest tail is
 * more than {@link LOG_RATIO}× the smallest p50. On a linear axis (the
 * author's `scale: linear`, or a p50 of 0) a tail past 1.5 × the largest p99
 * is cut: the domain stops near there, and the row's whisker ends in an arrow
 * at the plot edge with the true value beside it.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { DECORATIVE } from '../svg/decorative.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf } from '../svg/dsTone.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { axisFormat, compactNum, exactNum, niceStep } from './chartScale.js';
import { diagramFrame } from './frame.js';

type PctData = BlockDataMap['percentiles'];
type Row = PctData['rows'][number];

const PLOT_W = 440;
const ROW_H = 34;
const PAD_R = 24;
/** Approximate width of one `.t-sub` (10px mono) character. */
const SUB_CH = 6.2;
/** Approximate width of one 11px mono row-label character. */
const LABEL_CH = 6.8;
/** Gap between a dot and the value printed beside it. */
const VAL_GAP = 7;
/** Without an authored `scale`, a tail this many times the smallest p50 turns the axis log. */
export const LOG_RATIO = 30;
/** On a linear axis, a tail past this multiple of the largest p99 is drawn as an arrow at the edge. */
const CAP_AT = 1.5;

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** A value as printed beside a dot: grouped, no unit (the axis carries it). */
function fmt(v: number): string {
  return exactNum(v);
}

interface Scale {
  readonly lo: number;
  readonly hi: number;
  readonly ticks: readonly number[];
  readonly x: (v: number) => number;
  readonly log: boolean;
}

/** The shared axis: linear (nice-stepped from the smallest p50) or log10 (decade ticks, 2× and 5× when few). */
function scaleFor(min: number, max: number, log: boolean, x0: number, w: number): Scale {
  if (log && min > 0 && max > 0) {
    const d0 = Math.floor(Math.log10(min));
    const d1 = Math.ceil(Math.log10(max) - 1e-9);
    const lo = Math.pow(10, d0);
    const hi = Math.pow(10, Math.max(d1, d0 + 1));
    const decades = Math.max(1, Math.log10(hi) - Math.log10(lo));
    const ticks: number[] = [];
    for (let d = d0; d <= Math.log10(hi) + 1e-9; d++) {
      const base = Math.pow(10, d);
      ticks.push(round6(base));
      if (decades <= 3 && base * 10 <= hi + 1e-9) {
        ticks.push(round6(base * 2), round6(base * 5));
      }
    }
    const l0 = Math.log10(lo);
    const span = Math.log10(hi) - l0;
    return { lo, hi, ticks, log: true, x: (v) => x0 + ((Math.log10(Math.max(v, lo)) - l0) / span) * w };
  }
  const span0 = Math.max(max - min, 1e-9);
  const step = niceStep(span0);
  const lo = round6(Math.floor(min / step) * step);
  const hi = round6(Math.max(Math.ceil(max / step) * step, lo + step));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(round6(v));
  const span = hi - lo;
  return { lo, hi, ticks, log: false, x: (v) => x0 + ((v - lo) / span) * w };
}

/** The last value on a row's whisker: max, else p999, else p99. */
function tailOf(r: Row): number {
  return r.max ?? r.p999 ?? r.p99;
}

/** A small dot (p90 / p95 / p999 / max) as drawn: its true x, and the y it moved to when it would sit on another. */
interface SmallDot {
  readonly key: 'p90' | 'p95' | 'p999' | 'max';
  readonly x: number;
  dy: number;
}

/**
 * Moves the small dots of one row off the whisker where they would overlap a
 * big dot (p50, p99) or each other: up first, then down. A dot keeps its x.
 */
export function dodgeDots(small: SmallDot[], big: readonly number[]): void {
  const R_SMALL = 3.5;
  const R_BIG = 4;
  const placed: { x: number; dy: number; r: number }[] = big.map((x) => ({ x, dy: 0, r: R_BIG }));
  for (const d of [...small].sort((a, b) => a.x - b.x)) {
    const hits = (dy: number): boolean =>
      placed.some((p) => Math.abs(p.x - d.x) < p.r + R_SMALL + 1 && Math.abs(p.dy - dy) < p.r + R_SMALL + 1);
    d.dy = [0, -8, 8, -15, 15].find((dy) => !hits(dy)) ?? 0;
    placed.push({ x: d.x, dy: d.dy, r: R_SMALL });
  }
}

export function renderPercentiles(data: PctData): string {
  const rows = data.rows;
  const unit = data.unit ?? '';
  const marks = marksOf(rows.map((r) => r.accent));
  const sloOf = (r: Row): number | undefined => r.slo ?? data.slo;
  const labelW = Math.max(96, ...rows.map((r) => r.label.length * LABEL_CH + 12));
  const padL = 12;
  const x0 = padL + labelW;
  const minV = Math.min(...rows.map((r) => r.p50));
  const slos = rows.map((r) => sloOf(r)).filter((v): v is number => v !== undefined);
  const maxTail = Math.max(...rows.map(tailOf));
  const maxBody = Math.max(...rows.map((r) => r.p99), ...slos);
  // Log when the author asks, or (no `scale` given) when one tail dwarfs the
  // smallest median; a log axis needs every value above 0.
  const canLog = minV > 0;
  const log = canLog && (data.scale === 'log' || (data.scale === undefined && maxTail / minV > LOG_RATIO));
  // On a linear axis a far tail is cut: the domain ends near 1.5 × the largest p99.
  const cap = !log && maxTail > maxBody * CAP_AT ? maxBody * CAP_AT : undefined;
  const sc = scaleFor(minV, cap ?? Math.max(maxTail, maxBody), log, x0, PLOT_W);
  const x1 = x0 + PLOT_W;
  // A linear axis shares one suffix; a log axis spans decades, so each tick
  // takes its own (`1ms · 10ms · 100ms · 1k ms`).
  const tick = sc.log ? (v: number): string => compactNum(v, unit, 1e3) : axisFormat(sc.ticks, unit);
  const offScale = (v: number): boolean => v > sc.hi + 1e-9;
  const sloLabelH = data.slo !== undefined ? 16 : 0;
  const top = 12 + sloLabelH;
  const axisY = top + rows.length * ROW_H + 8;
  const height = axisY + (sc.log ? 34 : 26);
  // The widest text right of the plot: a p99 value beside its dot, or the
  // true value of a cut tail beside its arrow. The viewBox grows to hold it.
  const arrowText = (r: Row): string => `${fmt(tailOf(r))}${unit}`;
  const rightText = Math.max(
    0,
    ...rows.map((r) => (fmt(r.p99).length + 1) * SUB_CH),
    ...rows.filter((r) => offScale(tailOf(r))).map((r) => arrowText(r).length * SUB_CH + 14),
  );
  const width = x1 + PAD_R + Math.max(0, rightText - PAD_R + 8);

  const a11y = svgName('Latency percentiles', data.title, [countPhrase(rows.length, 'row')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // Gridlines and the axis.
  s += `<g${DECORATIVE}>`;
  for (const t of sc.ticks) {
    const x = sc.x(t);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${axisY}" stroke="var(--rule)" stroke-width="1"/>`;
  }
  s += `</g>`;
  s += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
  // Tick labels: skip any that would print over its neighbour.
  let lastTickEnd = -Infinity;
  for (const t of sc.ticks) {
    const label = tick(t);
    const w = label.length * SUB_CH;
    const x = sc.x(t);
    if (x - w / 2 < lastTickEnd + 6) continue;
    s += `<text x="${x}" y="${axisY + 14}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(label)}</text>`;
    lastTickEnd = x + w / 2;
  }
  // A log axis says so: equal steps are ×10, not +N.
  if (sc.log) s += `<text x="${x1}" y="${axisY + 25}" class="t-eyebrow pc-scale" text-anchor="end">log scale</text>`;

  // The block SLO: one dashed rule through every row, named at the top.
  if (data.slo !== undefined) {
    const x = sc.x(data.slo);
    s +=
      `<g${bp('slo')}>` +
      `<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${axisY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 3"/>` +
      `<text x="${x}" y="${top - 8}" class="t-eyebrow" text-anchor="middle">SLO ${escapeHtml(fmt(data.slo))}${escapeHtml(unit)}</text>` +
      `</g>`;
  }

  let anyOver = false;
  let anyP9x = false;
  let anyMax = false;
  let anyCut = false;
  s += `<g${bl('rows')}>`;
  rows.forEach((r, i) => {
    const y = top + i * ROW_H;
    const cy = y + ROW_H / 2;
    const slo = sloOf(r);
    const over = slo !== undefined && r.p99 > slo;
    if (over) anyOver = true;
    const negRow = marks[i] === 'negative';
    const tail = tailOf(r);
    const cut = offScale(tail);
    if (cut) anyCut = true;
    const at = (v: number): number => Math.min(sc.x(v), x1);
    const p50x = at(r.p50);
    const p99x = at(r.p99);
    const tailX = cut ? x1 : at(tail);
    const small: SmallDot[] = [];
    for (const k of ['p90', 'p95', 'p999', 'max'] as const) {
      const v = r[k];
      if (v === undefined || offScale(v)) continue;
      small.push({ key: k, x: at(v), dy: 0 });
    }
    dodgeDots(small, [p50x, p99x]);
    let g = `<g${bp(`rows.${i}`)}${over ? ' data-over="1"' : ''}${cut ? ' data-cut="1"' : ''}>`;
    if (i > 0) g += `<line x1="${padL}" y1="${y}" x2="${width - 8}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    g += `<text x="${padL}" y="${cy + 4}" class="pc-label${negRow ? ' c-negative' : ''}"${bp(`rows.${i}.label`)}>${escapeHtml(r.label)}</text>`;
    // A row's own SLO: a short dashed rule across this row only.
    if (r.slo !== undefined) {
      const x = sc.x(r.slo);
      g +=
        `<line x1="${x}" y1="${y + 3}" x2="${x}" y2="${y + ROW_H - 3}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 3"${bp(`rows.${i}.slo`)}/>` +
        `<text x="${x + 4}" y="${y + 10}" class="t-eyebrow">SLO ${escapeHtml(fmt(r.slo))}${escapeHtml(unit)}</text>`;
    }
    // Whisker: p50 → tail (to the plot edge, with an arrow, when the tail is cut).
    g += `<line x1="${p50x}" y1="${cy}" x2="${tailX}" y2="${cy}" stroke="var(--rule-solid)" stroke-width="1.5"/>`;
    if (cut) {
      const parts = (['p999', 'max'] as const).filter((k) => r[k] !== undefined && offScale(r[k] ?? 0)).map((k) => `${k} ${fmt(r[k] ?? 0)}${unit}`);
      g +=
        `<g class="pc-cut"><title>${escapeHtml(`${parts.join(' · ')} — past the axis`)}</title>` +
        `<path d="M${x1 - 6} ${cy - 4} L${x1} ${cy} L${x1 - 6} ${cy + 4}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>` +
        `<text x="${x1 + 6}" y="${cy + 3.5}" class="t-sub c-ink">${escapeHtml(arrowText(r))}</text></g>`;
    }
    // Small dots, tail first, each with a hairline back to the whisker when it moved.
    for (const d of [...small].reverse()) {
      const dy = cy + d.dy;
      if (d.dy !== 0) g += `<line x1="${d.x}" y1="${cy}" x2="${d.x}" y2="${dy}" stroke="var(--rule-solid)" stroke-width="0.75"${DECORATIVE}/>`;
      if (d.key === 'max') {
        anyMax = true;
        g +=
          `<g${bp(`rows.${i}.max`)}><circle cx="${d.x}" cy="${dy}" r="3.5" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25"/>` +
          `<path d="M${d.x - 2} ${dy - 2} l 4 4 M${d.x + 2} ${dy - 2} l -4 4" stroke="var(--ink)" stroke-width="1" fill="none"/></g>`;
      } else {
        if (d.key !== 'p999') anyP9x = true;
        g += `<circle cx="${d.x}" cy="${dy}" r="2.5" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25"${bp(`rows.${i}.${d.key}`)}/>`;
      }
    }
    const p99Fill = over ? 'var(--negative)' : 'var(--accent)';
    g += `<circle cx="${p99x}" cy="${cy}" r="4" fill="${p99Fill}"${bp(`rows.${i}.p99`)}/>`;
    g += `<circle cx="${p50x}" cy="${cy}" r="4" fill="var(--ink)"${bp(`rows.${i}.p50`)}/>`;
    // Values: p50 left of its dot, p99 right of its dot — only where they do
    // not run into another dot, the label gutter or the row's neighbours.
    const p50Text = fmt(r.p50);
    const p50W = p50Text.length * SUB_CH;
    if (p50x - VAL_GAP - p50W >= x0 - 2) {
      g += `<text x="${p50x - VAL_GAP}" y="${cy + 3.5}" class="t-sub c-muted" text-anchor="end">${escapeHtml(p50Text)}</text>`;
    }
    const p99Text = fmt(r.p99);
    const p99W = p99Text.length * SUB_CH;
    const p99L = p99x + VAL_GAP;
    const p99R = p99L + p99W;
    const rightDots = [...small.filter((d) => d.x > p99x && d.dy === 0).map((d) => d.x), ...(cut ? [x1] : [])];
    const clear = rightDots.every((x) => x - 4 > p99R + 2 || x + 4 < p99L - 2);
    if (clear) {
      g += `<text x="${p99L}" y="${cy + 3.5}" class="t-sub${over ? ' c-negative' : ' c-muted'}">${escapeHtml(p99Text)}</text>`;
    }
    g += `</g>`;
    s += g;
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [{ swatch: 'node-dot', fill: 'var(--ink)', stroke: 'var(--ink)', label: 'p50' }];
  if (anyP9x) items.push({ swatch: 'node-dot', fill: 'var(--paper)', stroke: 'var(--ink)', label: 'p90 · p95' });
  items.push({ swatch: 'node-dot', fill: 'var(--accent)', stroke: 'var(--accent)', label: 'p99' });
  if (anyOver) items.push({ swatch: 'node-dot', fill: 'var(--negative)', stroke: 'var(--negative)', label: 'p99 over the SLO' });
  if (anyMax) items.push({ swatch: 'node-dot', fill: 'var(--paper)', stroke: 'var(--ink)', label: 'max' });
  if (anyCut) items.push({ swatch: 'edge', label: 'tail past the axis (true value beside it)' });
  if (rows.some((r) => sloOf(r) !== undefined)) items.push({ swatch: 'line-dashed', stroke: 'var(--ink)', label: 'SLO' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'PERCENTILES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
