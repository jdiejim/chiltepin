/**
 * Renders an `array` block — a row of array cells for algorithm walkthroughs
 * (binary search, two pointers, sliding windows), in pure SVG inside the
 * diagram frame (tag ARRAY).
 *
 * 44px-tall cells, all as wide as the widest value (up to a cap, past which
 * a value is cut with "…" and a title); indices above (when `showIndex`,
 * default true); pointer `label`s below their cell with a small ▲ tick, and
 * crowded neighbours alternate between rows; an optional `window` draws a
 * dashed ink outline around an inclusive 0-based index range (out-of-bounds
 * values clamp). Cell tones follow `svg/dsTone.ts`: paper cells with an ink
 * outline, `active` / `target` on the accent, `visited` on `paper-2`, `muted`
 * as a dashed ghost — and the legend names the tones in play.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DS_TONE_LEGEND, dsTone, dsToneAttrs, type DsTone } from '../svg/dsTone.js';
import { cutTitle, ellipsize, FONT, textWidth, type Font } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type ArrayData = BlockDataMap['array'];

/** The narrowest cell (a square for one- and two-digit values). */
const CELL = 44;
/** The widest a cell grows for its value; a longer value is cut with "…". */
const MAX_CELL = 150;
const PAD_X = 8;
/** `.ds-val` sets in 13px mono 600. */
export const DS_VALUE_FONT: Font = { size: 13, mono: true, weight: 600 };
/** Room a value keeps from the cell's sides. */
const VALUE_PAD = 14;
/** Pointer labels are `.t-badge` (9px mono 600); neighbours keep this far apart. */
const LABEL_GAP = 8;
const LABEL_ROW_H = 13;

/**
 * Rows for labels centred on `centres`: each takes the first row where it
 * clears the previous label on that row, so crowded neighbours alternate
 * between rows instead of overprinting.
 */
export function staggerRows(centres: readonly number[], widths: readonly number[], gap = LABEL_GAP): number[] {
  const ends: number[] = [];
  return centres.map((c, i) => {
    const half = (widths[i] ?? 0) / 2;
    let row = 0;
    while (row < ends.length && (ends[row] ?? -Infinity) + gap > c - half) row += 1;
    ends[row] = c + half;
    return row;
  });
}

export function renderArray(data: ArrayData): string {
  const items = data.items ?? [];
  const showIndex = data.showIndex ?? true;
  const n = items.length;
  const window = n > 0 && data.window !== undefined ? data.window : undefined;

  // One cell width for the whole row, from the widest value (up to a cap).
  const widest = Math.max(0, ...items.map((it) => textWidth(it.value, DS_VALUE_FONT)));
  const cell = Math.min(MAX_CELL, Math.max(CELL, Math.ceil(widest + VALUE_PAD)));
  const xOf = (i: number): number => PAD_X + i * cell;

  // Pointer labels: crowded neighbours alternate between rows.
  const labelled = items.map((it, i) => ({ it, i })).filter(({ it }) => it.label !== undefined && it.label.length > 0);
  const labelRows = staggerRows(
    labelled.map(({ i }) => xOf(i) + cell / 2),
    labelled.map(({ it }) => textWidth(it.label ?? '', FONT.badge)),
  );
  const rowsUsed = labelled.length > 0 ? Math.max(...labelRows) + 1 : 0;

  // Vertical layout: [window label] [indices] [cells] [pointer ticks + labels].
  const winPad = window !== undefined ? 20 : 0;
  const idxH = showIndex ? 16 : 0;
  const cellsY = 6 + winPad + idxH;
  const labelH = rowsUsed > 0 ? 26 + (rowsUsed - 1) * LABEL_ROW_H : 0;
  const height = cellsY + CELL + labelH + 8;
  // Wide enough for every label that hangs past the row ends, and the window label.
  const winLabelW = window?.label !== undefined && window.label.length > 0 ? textWidth(window.label, FONT.eyebrow) : 0;
  const labelEdge = Math.max(
    0,
    ...labelled.map(({ it, i }) => xOf(i) + cell / 2 + textWidth(it.label ?? '', FONT.badge) / 2 + PAD_X),
  );
  const labelLeft = Math.min(0, ...labelled.map(({ it, i }) => xOf(i) + cell / 2 - textWidth(it.label ?? '', FONT.badge) / 2 - PAD_X));
  const shift = Math.ceil(-labelLeft);
  const width = Math.ceil(Math.max(PAD_X * 2 + Math.max(n, 1) * cell, labelEdge, winLabelW + PAD_X * 2) + shift);

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Array</title>`;

  if (n === 0) {
    s += `<text x="${PAD_X}" y="${cellsY + 26}" class="t-sub c-soft">(empty)</text></svg>`;
    return frame(data, s, '');
  }
  if (shift > 0) s += `<g transform="translate(${shift} 0)">`;

  // Cells (+ indices above).
  const tones = new Set<DsTone>();
  let plain = false;
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const t = dsTone(it.tone);
    if (it.tone !== undefined) tones.add(it.tone);
    else plain = true;
    const x = xOf(i);
    const value = ellipsize(it.value, cell - VALUE_PAD + 4, DS_VALUE_FONT, {
      path: `items.${i}.value`,
      field: 'value',
      hint: 'Shorten the cell `value`; put the full key in the prose.',
    });
    s += `<g${bp(`items.${i}`)}>`;
    if (showIndex) {
      s += `<text x="${x + cell / 2}" y="${cellsY - 5}" class="t-sub c-soft" text-anchor="middle">${i}</text>`;
    }
    s += `<rect x="${x}" y="${cellsY}" width="${cell}" height="${CELL}"${dsToneAttrs(t)}/>`;
    s += `<text x="${x + cell / 2}" y="${cellsY + CELL / 2 + 5}" class="ds-val" fill="${t.text}"${bp(`items.${i}.value`)}>${cutTitle(value)}${escapeHtml(value.lines[0] ?? '')}</text>`;
    s += `</g>`;
  });
  s += `</g>`; // close the items list container

  // Pointer labels below their cell, with a small ▲ tick pointing at it; a
  // label on a lower row hangs from a thin stem.
  labelled.forEach(({ it, i }, k) => {
    const cx = xOf(i) + cell / 2;
    const baseY = cellsY + CELL;
    const row = labelRows[k] ?? 0;
    s += `<g${bp(`items.${i}.label`)}>`;
    s += `<path d="M${cx - 4},${baseY + 9} L${cx},${baseY + 3} L${cx + 4},${baseY + 9} z" fill="var(--ink)"/>`;
    if (row > 0) {
      s += `<line x1="${cx}" y1="${baseY + 9}" x2="${cx}" y2="${baseY + 11 + row * LABEL_ROW_H}" stroke="var(--ink)" stroke-width="1"/>`;
    }
    s += `<text x="${cx}" y="${baseY + 20 + row * LABEL_ROW_H}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(it.label ?? '')}</text>`;
    s += `</g>`;
  });

  // Window outline (clamped to the index range) + its label above it: ending
  // at the window's right edge, or starting at its left when that keeps it in view.
  if (window !== undefined) {
    const lo = Math.max(0, Math.min(n - 1, Math.min(window.from, window.to)));
    const hi = Math.max(0, Math.min(n - 1, Math.max(window.from, window.to)));
    const wx = xOf(lo) - 3;
    const ww = (hi - lo + 1) * cell + 6;
    s += `<rect x="${wx}" y="${cellsY - 3}" width="${ww}" height="${CELL + 6}" rx="4" fill="none" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"${bp('window')}/>`;
    if (window.label !== undefined && window.label.length > 0) {
      const endFits = wx + ww - winLabelW >= -shift + 2;
      const lx = endFits ? wx + ww : Math.max(PAD_X - shift, Math.min(wx, width - shift - PAD_X - winLabelW));
      s += `<text x="${Math.round(lx * 10) / 10}" y="${cellsY - idxH - 6}"${endFits ? ' text-anchor="end"' : ''} class="t-eyebrow"${bp('window.label')}>${escapeHtml(window.label)}</text>`;
    }
  }

  if (shift > 0) s += `</g>`;
  s += `</svg>`;
  return frame(data, s, dsLegend(plain, tones, window !== undefined));
}

/** The legend: the plain cell, every tone present, and the window outline. */
function dsLegend(plain: boolean, tones: ReadonlySet<DsTone>, hasWindow: boolean): string {
  const items: LegendItem[] = [];
  if (plain) items.push({ swatch: 'node', label: 'cell' });
  for (const tone of ['active', 'target', 'visited', 'muted'] as const) {
    if (tones.has(tone)) items.push(DS_TONE_LEGEND[tone]);
  }
  if (hasWindow) items.push({ swatch: 'chip', chip: '[ ]', label: 'window' });
  return renderLegend(items);
}

function frame(data: ArrayData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'ARRAY',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
