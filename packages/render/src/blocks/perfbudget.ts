/**
 * Renders a `perfbudget` block — one row per metric, a bar of the measured
 * value against its budget. Every row shares one budget mark: the dashed rule
 * at 70% of the track is "the budget", and each bar is measured ÷ budget of
 * that length, so a bar that crosses the rule is over budget whatever its
 * unit. A bar too long for the track is cut at its end, with break marks and
 * the true ratio (`5×`) printed at the break. The value prints after the
 * track; the budget under the metric name.
 *
 * Status derives per row (`lowerIsBetter` defaults to true): a miss — beyond
 * the budget on the bad side; near — within 10% of the budget; ok —
 * everything else. A miss reads "over" when lower is better and "below"
 * (under the target) when higher is better. Misses take `negative`; near rows
 * take `hue-amber` (a warning, not an error); ok rows are `muted`. The footer
 * counts each.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { DECORATIVE } from '../svg/decorative.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { groupNum } from './chartScale.js';
import { diagramFrame } from './frame.js';

type PerfData = BlockDataMap['perfbudget'];
type Metric = PerfData['metrics'][number];
export type PerfStatus = 'over' | 'near' | 'ok';

/** Where the budget mark sits along the track (fraction of the track width). */
const BUDGET_AT = 0.7;
/** A bar within this fraction of the budget reads "near". */
const NEAR_BAND = 0.1;
const TRACK_W = 300;
const ROW_H = 36;
const BAR_H = 12;
/** Approximate width of one 11px mono character. */
const LABEL_CH = 6.8;
/** Approximate width of one `.t-sub` (10px mono) character. */
const SUB_CH = 6.2;

/** Derives the row status from the measured value, the budget and the direction. */
export function perfStatus(m: Metric): PerfStatus {
  const lower = m.lowerIsBetter !== false;
  const over = lower ? m.measured > m.budget : m.measured < m.budget;
  if (over) return 'over';
  if (m.budget !== 0 && Math.abs(m.measured - m.budget) / Math.abs(m.budget) <= NEAR_BAND) return 'near';
  return 'ok';
}

/** A grouped number: `2140` → `2,140`, `0.04` → `0.04`, a true minus sign. */
function fmtNum(v: number): string {
  return groupNum(v);
}

/** The ratio printed at the break of a cut bar: `5×`, `12.5×`. */
function ratioText(r: number): string {
  if (!Number.isFinite(r)) return '∞×';
  return `${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}×`;
}

function valueText(v: number, unit: string | undefined): string {
  return unit !== undefined && unit !== '' ? `${fmtNum(v)}${unit.length <= 3 ? '' : ' '}${unit}` : fmtNum(v);
}

const BAR_FILL: Record<PerfStatus, string> = {
  over: 'var(--negative)',
  near: 'var(--hue-amber)',
  ok: 'var(--muted)',
};
const CHIP_CLASS: Record<PerfStatus, string> = { over: ' c-negative', near: ' c-amber', ok: ' c-muted' };
const CHIP_STROKE: Record<PerfStatus, string> = { over: 'var(--negative)', near: 'var(--hue-amber)', ok: 'var(--rule-solid)' };
const CHIP_FILL: Record<PerfStatus, string> = { over: 'var(--paper)', near: 'var(--hue-amber-tint)', ok: 'var(--paper)' };

/** The chip word: a miss is "over" a ceiling, or "below" a floor (higher is better). */
function chipWord(st: PerfStatus, m: Metric): string {
  if (st !== 'over') return st;
  return m.lowerIsBetter === false ? 'below' : 'over';
}

export function renderPerfbudget(data: PerfData): string {
  const metrics = data.metrics;
  const statuses = metrics.map(perfStatus);
  const subOf = (m: Metric): string => {
    const dir = m.lowerIsBetter === false ? '≥' : '≤';
    const note = m.note !== undefined && m.note !== '' ? ` · ${m.note}` : '';
    return `budget ${dir} ${valueText(m.budget, m.unit)}${note}`;
  };
  const subs = metrics.map(subOf);
  const labelW = Math.max(
    120,
    ...metrics.map((m) => m.metric.length * LABEL_CH + 8),
    ...subs.map((t) => t.length * SUB_CH + 8),
  );
  const padL = 16;
  const padR = 16;
  const valueW = Math.max(56, ...metrics.map((m) => valueText(m.measured, m.unit).length * SUB_CH + 14));
  const chipW = 44;
  const trackX = padL + labelW;
  const valueX = trackX + TRACK_W + 8;
  const chipX = valueX + valueW + 6;
  const width = chipX + chipW + padR;
  const ctxH = data.context !== undefined && data.context !== '' ? 18 : 0;
  const headH = 22;
  const top = 12 + ctxH + headH;
  const height = top + metrics.length * ROW_H + 10;
  const budgetX = trackX + TRACK_W * BUDGET_AT;

  const a11y = svgName('Performance budget', data.title, [countPhrase(metrics.length, 'metric')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;
  if (ctxH > 0) {
    s += `<text x="${padL}" y="${12 + 10}" class="t-sub c-muted"${bp('context')}>${escapeHtml(data.context ?? '')}</text>`;
  }
  // The shared budget mark: a dashed rule through every row, named once.
  const markTop = top - 6;
  const markBot = top + metrics.length * ROW_H;
  s += `<text x="${budgetX}" y="${top - 10}" class="t-eyebrow" text-anchor="middle">budget</text>`;
  s += `<line x1="${budgetX}" y1="${markTop}" x2="${budgetX}" y2="${markBot}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 3"/>`;

  s += `<g${bl('metrics')}>`;
  metrics.forEach((m, i) => {
    const st = statuses[i] ?? 'ok';
    const y = top + i * ROW_H;
    const cy = y + ROW_H / 2;
    const ratio = m.budget !== 0 ? Math.max(0, m.measured / m.budget) : m.measured > 0 ? Infinity : 0;
    const rawW = ratio * TRACK_W * BUDGET_AT;
    const clipped = rawW > TRACK_W;
    const barW = Math.max(0, Math.min(TRACK_W, rawW));
    const barEnd = trackX + barW;
    const fill = BAR_FILL[st];
    const value = valueText(m.measured, m.unit);
    s +=
      `<g${bp(`metrics.${i}`)} data-status="${st}">` +
      (i > 0 ? `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>` : '') +
      `<text x="${padL}" y="${cy - 2}" class="pb-label"${bp(`metrics.${i}.metric`)}>${escapeHtml(m.metric)}</text>` +
      `<text x="${padL}" y="${cy + 11}" class="t-sub c-soft"${bp(`metrics.${i}.budget`)}>${escapeHtml(subs[i] ?? '')}</text>` +
      `<rect x="${trackX}" y="${cy - BAR_H / 2}" width="${TRACK_W}" height="${BAR_H}" rx="2" fill="var(--paper-2)" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>` +
      `<rect x="${trackX}" y="${cy - BAR_H / 2}" width="${barW}" height="${BAR_H}" rx="2" fill="${fill}"${bp(`metrics.${i}.measured`)}/>` +
      // A bar past the track is cut: break marks say the value is off the
      // scale, and the true ratio to the budget prints at the break.
      (clipped
        ? `<path d="M${barEnd - 6} ${cy - BAR_H / 2 - 2} l -4 ${BAR_H + 4} M${barEnd - 2} ${cy - BAR_H / 2 - 2} l -4 ${BAR_H + 4}" stroke="var(--paper)" stroke-width="2" fill="none"/>` +
          `<text x="${barEnd - 14}" y="${cy + 3.5}" class="t-sub pb-ratio" text-anchor="end" style="fill:var(--paper);stroke:none">${escapeHtml(ratioText(ratio))}</text>`
        : '') +
      `<text x="${valueX}" y="${cy + 3.5}" class="t-sub c-ink pb-val">${escapeHtml(value)}</text>` +
      `<rect x="${chipX}" y="${cy - 7}" width="${chipW}" height="14" rx="2" fill="${CHIP_FILL[st]}" stroke="${CHIP_STROKE[st]}" stroke-width="1"/>` +
      `<text x="${chipX + chipW / 2}" y="${cy + 3}" class="t-eyebrow${CHIP_CLASS[st]}" text-anchor="middle">${chipWord(st, m)}</text>` +
      `</g>`;
  });
  s += `</g></svg>`;

  const count = (k: PerfStatus): number => statuses.filter((x) => x === k).length;
  const missWord = metrics.map((m, i) => chipWord(statuses[i] ?? 'ok', m));
  const nOver = missWord.filter((w) => w === 'over').length;
  const nBelow = missWord.filter((w) => w === 'below').length;
  const nNear = count('near');
  const nOk = count('ok');
  const items: LegendItem[] = [];
  if (nOver > 0) items.push({ swatch: 'fill', fill: 'var(--negative)', label: 'over budget' });
  if (nBelow > 0) items.push({ swatch: 'fill', fill: 'var(--negative)', label: 'below target (higher is better)' });
  if (nNear > 0) items.push({ swatch: 'fill', fill: 'var(--hue-amber)', label: 'near — within 10%' });
  if (nOk > 0) items.push({ swatch: 'fill', fill: 'var(--muted)', label: 'within budget' });
  items.push({ swatch: 'line-dashed', stroke: 'var(--ink)', label: 'budget' });
  const legend = renderLegend(items);
  const foot =
    `<div class="diagram-foot pb-foot">` +
    (nOver > 0 || nBelow === 0 ? `<span><strong>${nOver}</strong> over</span>` : '') +
    (nBelow > 0 ? `<span><strong>${nBelow}</strong> below</span>` : '') +
    `<span><strong>${nNear}</strong> near</span>` +
    `<span><strong>${nOk}</strong> ok</span>` +
    `</div>`;

  return diagramFrame(
    {
      tag: 'PERF BUDGET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      footerHtml: foot,
    },
    s,
  );
}
