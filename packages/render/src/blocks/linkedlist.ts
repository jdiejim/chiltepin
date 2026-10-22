/**
 * Renders a `linkedlist` block — a pointer-chain diagram (singly or doubly),
 * in pure SVG inside the diagram frame (tag LIST).
 *
 * Each node is a 40px-tall rounded box split into a value cell and a narrow
 * pointer cell (the dot); every value cell is as wide as the widest value
 * (up to a cap, past which a value is cut with "…" and a title). Arrows run
 * from the pointer cell to the next node. Crowded marker labels alternate
 * between rows.
 * `kind: doubly` adds a second, lower back-arrow per link; `nullEnd` (default
 * true) terminates the chain in a ∅ ground symbol. `label` markers ("head",
 * "curr") render above their node with a ▼ tick. Node tones follow
 * `svg/dsTone.ts`; the legend names the tones in play.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DS_TONE_LEGEND, dsTone, dsToneAttrs, type DsTone } from '../svg/dsTone.js';
import { cutTitle, ellipsize, FONT, textWidth } from '../svg/wrapText.js';
import { DS_VALUE_FONT, staggerRows } from './array.js';
import { diagramFrame } from './frame.js';

type LinkedlistData = BlockDataMap['linkedlist'];

const NODE_H = 40;
/** The narrowest value cell; the pointer cell beside it is 18px. */
const MIN_VALUE_W = 38;
/** The widest a value cell grows; a longer value is cut with "…". */
const MAX_VALUE_W = 150;
const POINTER_W = 18;
const GAP = 34; // arrow run between nodes
const PAD_X = 8;
/** Room a value keeps from its cell's sides. */
const VALUE_PAD = 12;
const LABEL_ROW_H = 13;

const LINK = 'fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#skArrow)"';

export function renderLinkedlist(data: LinkedlistData): string {
  const nodes = data.nodes ?? [];
  const doubly = (data.kind ?? 'singly') === 'doubly';
  const nullEnd = data.nullEnd ?? true;
  const n = nodes.length;

  // One node width for the whole chain, from the widest value (up to a cap).
  const widest = Math.max(0, ...nodes.map((nd) => textWidth(nd.value, DS_VALUE_FONT)));
  const VALUE_W = Math.min(MAX_VALUE_W, Math.max(MIN_VALUE_W, Math.ceil(widest + VALUE_PAD)));
  const NODE_W = VALUE_W + POINTER_W;
  const xOf = (i: number): number => PAD_X + i * (NODE_W + GAP);

  // Marker labels: crowded neighbours alternate between rows (upward).
  const labelled = nodes.map((nd, i) => ({ nd, i })).filter(({ nd }) => nd.label !== undefined && nd.label.length > 0);
  const labelRows = staggerRows(
    labelled.map(({ i }) => xOf(i) + NODE_W / 2),
    labelled.map(({ nd }) => textWidth(nd.label ?? '', FONT.badge)),
  );
  const rowsUsed = labelled.length > 0 ? Math.max(...labelRows) + 1 : 0;

  const topPad = rowsUsed > 0 ? 30 + (rowsUsed - 1) * LABEL_ROW_H : 8;
  const cy = topPad + NODE_H / 2;
  const height = topPad + NODE_H + 10;
  const tailW = nullEnd ? GAP + 18 : 0;
  // Wide enough for a label that hangs past either end of the chain.
  const halfOf = (label: string | undefined): number => textWidth(label ?? '', FONT.badge) / 2 + PAD_X;
  const labelEdge = Math.max(0, ...labelled.map(({ nd, i }) => xOf(i) + NODE_W / 2 + halfOf(nd.label)));
  const shift = Math.ceil(-Math.min(0, ...labelled.map(({ nd, i }) => xOf(i) + NODE_W / 2 - halfOf(nd.label))));
  const width = Math.ceil(Math.max(PAD_X * 2 + Math.max(n, 1) * NODE_W + Math.max(n - 1, 0) * GAP + tailW, labelEdge) + shift);

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Linked list</title>`;

  if (n === 0) {
    s += `<text x="${PAD_X}" y="${cy + 4}" class="t-sub c-soft">(empty)</text></svg>`;
    return frame(data, s, '');
  }

  if (shift > 0) s += `<g transform="translate(${shift} 0)">`;

  // Link arrows first, so node boxes sit on top of the line ends.
  for (let i = 0; i < n - 1; i += 1) {
    const dotX = xOf(i) + VALUE_W + (NODE_W - VALUE_W) / 2;
    const nextX = xOf(i + 1);
    if (doubly) {
      s += `<path d="M${dotX},${cy - 7} L${nextX - 2},${cy - 7}" ${LINK}/>`;
      s += `<path d="M${nextX},${cy + 7} L${xOf(i) + NODE_W + 2},${cy + 7}" ${LINK}/>`;
    } else {
      s += `<path d="M${dotX},${cy} L${nextX - 2},${cy}" ${LINK}/>`;
    }
  }

  // Null terminator: arrow from the last pointer cell to a ∅ ground symbol.
  if (nullEnd) {
    const dotX = xOf(n - 1) + VALUE_W + (NODE_W - VALUE_W) / 2;
    const endX = xOf(n - 1) + NODE_W + GAP;
    const y = doubly ? cy - 7 : cy;
    s += `<path d="M${dotX},${y} L${endX - 2},${y}" ${LINK}/>`;
    s += `<text x="${endX + 8}" y="${y + 5}" class="t-name c-muted">∅</text>`;
  }

  // Node boxes: value cell + pointer cell (separator + dot).
  const tones = new Set<DsTone>();
  let plain = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((nd, i) => {
    const t = dsTone(nd.tone);
    if (nd.tone !== undefined) tones.add(nd.tone);
    else plain = true;
    const x = xOf(i);
    const value = ellipsize(nd.value, VALUE_W - VALUE_PAD + 4, DS_VALUE_FONT, {
      path: `nodes.${i}.value`,
      field: 'value',
      hint: 'Shorten the node `value`; put the full key in the prose.',
    });
    s +=
      `<g${bp(`nodes.${i}`)}>` +
      `<rect x="${x}" y="${topPad}" width="${NODE_W}" height="${NODE_H}" rx="4"${dsToneAttrs(t)}/>` +
      `<line x1="${x + VALUE_W}" y1="${topPad + 5}" x2="${x + VALUE_W}" y2="${topPad + NODE_H - 5}" stroke="${t.stroke}" stroke-width="1"/>` +
      `<circle cx="${x + VALUE_W + (NODE_W - VALUE_W) / 2}" cy="${cy}" r="3" fill="${t.text}"/>` +
      `<text x="${x + VALUE_W / 2}" y="${cy + 5}" class="ds-val" fill="${t.text}"${bp(`nodes.${i}.value`)}>${cutTitle(value)}${escapeHtml(value.lines[0] ?? '')}</text>` +
      `</g>`;
  });
  s += `</g>`; // close the nodes list container

  // Marker labels above their node, with a ▼ tick pointing down at it; a
  // label on a higher row stands on a thin stem.
  labelled.forEach(({ nd, i }, k) => {
    const cx = xOf(i) + NODE_W / 2;
    const row = labelRows[k] ?? 0;
    s += `<g${bp(`nodes.${i}.label`)}>`;
    s += `<text x="${cx}" y="${topPad - 14 - row * LABEL_ROW_H}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(nd.label ?? '')}</text>`;
    if (row > 0) {
      s += `<line x1="${cx}" y1="${topPad - 11 - row * LABEL_ROW_H}" x2="${cx}" y2="${topPad - 10}" stroke="var(--ink)" stroke-width="1"/>`;
    }
    s += `<path d="M${cx - 4},${topPad - 10} L${cx + 4},${topPad - 10} L${cx},${topPad - 4} z" fill="var(--ink)"/>`;
    s += `</g>`;
  });

  if (shift > 0) s += `</g>`;
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (plain) items.push({ swatch: 'node', label: 'node' });
  for (const tone of ['active', 'target', 'visited', 'muted'] as const) {
    if (tones.has(tone)) items.push(DS_TONE_LEGEND[tone]);
  }
  items.push({ swatch: 'edge', label: doubly ? 'next / prev' : 'next' });
  return frame(data, s, renderLegend(items));
}

function frame(data: LinkedlistData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'LIST',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
