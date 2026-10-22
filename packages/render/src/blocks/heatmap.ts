/**
 * Renders a `heatmap` block — a numeric grid with an intensity ramp, in pure
 * HTML (a CSS grid). Row labels sit left (right-aligned), column labels on
 * top; each cell is a tile on the skin's one-hue ink ramp (`paper-2` →
 * `ink-3` → `ink-2` → `ink`) by normalized value, a literal zero on plain
 * `paper`, with the value centered in mono. Cell text switches to `paper`
 * from the third step up, decided by the step index rather than by measuring
 * the colour. Short rows pad missing cells as blank tiles. Renders inside the
 * diagram frame (tag HEATMAP); the legend names the value range each step
 * covers.
 *
 * Binning: four equal-width steps over the value range — unless one outlier
 * would flatten the rest (more than {@link CROWD} of the values in one
 * step), in which case the steps are quartiles of the data, so every step
 * holds about a quarter of the cells and the outlier only tops the last
 * step. The author's `min` / `max` always mean equal-width steps over that
 * range. The legend prints each step's true range either way.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { groupNum } from './chartScale.js';
import { diagramFrame } from './frame.js';

type HeatmapData = BlockDataMap['heatmap'];

/** The one-hue ramp, low → high (the ink-tone tokens), and the step from which text on the tile is `paper`. */
const RAMP = ['var(--paper-2)', 'var(--ink-3)', 'var(--ink-2)', 'var(--ink)'] as const;
const DARK_FROM = 2;
/** A hairline edge on every tile — the lowest step is the frame's own ground. */
const EDGE = 'box-shadow:inset 0 0 0 1px var(--rule-solid)';

/** The ramp step (0..4) for a normalized value. */
function stepAt(t: number): number {
  return Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)));
}

/** Equal-width binning that puts more than this share of the values in one step is "flattened". */
export const CROWD = 0.6;

/** Formats a value: grouped thousands, float noise trimmed. */
function fmt(v: number): string {
  return groupNum(v);
}

/** Rounds a quartile break to two significant digits, so the legend reads `0.4`, not `0.4083`. */
function roundBreak(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  return Number(v.toPrecision(2));
}

/**
 * The step bounds for `values`: `[lo, b1, b2, b3, hi]`. Equal-width over
 * [min, max] — or quartile breaks when equal widths would crowd more than
 * {@link CROWD} of the values into one step (one outlier stretching the
 * range). Duplicate breaks merge, so a step is never empty by construction.
 */
export function heatBins(values: readonly number[], min: number, max: number, fixed: boolean): { bounds: number[]; quantile: boolean } {
  const range = max - min;
  const equal = [0, 1, 2, 3, 4].map((k) => min + (range * k) / 4);
  if (fixed || values.length < 8 || range <= 0) return { bounds: equal, quantile: false };
  const counts = [0, 0, 0, 0];
  for (const v of values) {
    const k = stepAt((v - min) / range);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  if (Math.max(...counts) / values.length <= CROWD) return { bounds: equal, quantile: false };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? max;
  const breaks = [q(0.25), q(0.5), q(0.75)].map(roundBreak).filter((b) => b > min && b < max);
  const bounds = [min, ...[...new Set(breaks)].sort((a, b) => a - b), max];
  return { bounds, quantile: true };
}

export function renderHeatmap(data: HeatmapData): string {
  const cols = data.xLabels;
  const rows = data.rows;
  const values = rows.flatMap((r) => r.values.slice(0, cols.length)).filter((v) => Number.isFinite(v));
  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 1;
  const min = data.min ?? dataMin;
  const max = data.max ?? dataMax;
  const range = max - min;
  // Zeros print on plain paper and do not take part in the binning.
  const binned = values.filter((v) => v !== 0);
  const { bounds } = heatBins(binned, binned.length > 0 && data.min === undefined ? Math.min(...binned) : min, max, data.min !== undefined || data.max !== undefined);
  const steps = bounds.length - 1;
  /** The ramp step of a value: the last bound it reaches, spread over the four tones. */
  const stepOf = (v: number): number => {
    if (range <= 0) return Math.floor(RAMP.length / 2);
    let k = 0;
    for (let b = 1; b < steps; b++) if (v >= (bounds[b] ?? Infinity)) k = b;
    // Fewer than four bins (merged breaks): spread them over the ramp.
    return steps >= RAMP.length ? k : Math.round((k * (RAMP.length - 1)) / Math.max(steps - 1, 1));
  };
  const binOfStep = new Map<number, number>();

  const used = new Set<number>();
  let zero = false;
  let grid = `<div class="hm-corner"></div>`;
  grid += cols.map((c, i) => `<div class="hm-col t-eyebrow"${bp(`xLabels.${i}`)}>${escapeHtml(c)}</div>`).join('');
  rows.forEach((row, ri) => {
    grid += `<div class="hm-rowlabel t-name"${bp(`rows.${ri}.label`)}>${escapeHtml(row.label)}</div>`;
    for (let i = 0; i < cols.length; i++) {
      const v = row.values[i];
      if (v === undefined || !Number.isFinite(v)) {
        grid += `<div class="hm-cell hm-blank" style="background:var(--paper);${EDGE}"></div>`;
        continue;
      }
      const title = data.unit !== undefined ? ` title="${escapeHtml(`${fmt(v)} ${data.unit}`)}"` : '';
      if (v === 0) {
        zero = true;
        grid += `<div class="hm-cell" style="background:var(--paper);color:var(--ink);${EDGE}"${title}${bp(`rows.${ri}.values.${i}`)}>0</div>`;
        continue;
      }
      const step = stepOf(v);
      used.add(step);
      if (!binOfStep.has(step)) {
        let k = 0;
        for (let b = 1; b < steps; b++) if (v >= (bounds[b] ?? Infinity)) k = b;
        binOfStep.set(step, k);
      }
      const text = step >= DARK_FROM ? 'var(--paper)' : 'var(--ink)';
      grid += `<div class="hm-cell" style="background:${RAMP[step]};color:${text};${EDGE}"${title}${bp(`rows.${ri}.values.${i}`)}>${escapeHtml(fmt(v))}</div>`;
    }
  });

  // The legend names the value range of every step the grid actually used.
  const unitSuffix = data.unit !== undefined ? ` ${data.unit}` : '';
  const items: LegendItem[] = [...used]
    .sort((a, b) => a - b)
    .map((step) => {
      const k = binOfStep.get(step) ?? 0;
      const lo = bounds[k] ?? min;
      const hi = bounds[k + 1] ?? max;
      // Step bounds are bins, not data: whole numbers once the range allows.
      const bound = (v: number): string => (range >= 20 ? groupNum(Math.round(v)) : fmt(v));
      const label = range <= 0 ? `${fmt(min)}${unitSuffix}` : `${bound(lo)}–${bound(hi)}${unitSuffix}`;
      return { swatch: 'fill', fill: RAMP[step] ?? RAMP[0], label };
    });
  if (zero) items.unshift({ swatch: 'fill', fill: 'var(--paper)', label: `0${unitSuffix}` });
  const legendHtml = renderLegend(items);

  const inner =
    `<div class="heatmap" style="overflow-x:auto">` +
    `<div class="hm-grid" style="grid-template-columns:auto repeat(${cols.length},minmax(44px,1fr))"${bl('rows')}>${grid}</div>` +
    `</div>`;
  return diagramFrame(
    {
      tag: 'HEATMAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
