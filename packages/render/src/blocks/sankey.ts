/**
 * Renders a `sankey` block — how much of something moves between stages.
 *
 * Every other flow block in the library answers "does this path exist";
 * this one answers "how heavy is it". Node height and ribbon thickness are
 * both the value, on one scale, so the picture is quantitative: the widest
 * ribbon leaving a stage IS where the volume goes.
 *
 * Layout, in one pass each:
 *   1. Columns — a node's column is the longest chain of links reaching it,
 *      so a stage always sits to the right of everything feeding it (an
 *      explicit `col` overrides). Cycles can't extend a chain past the node
 *      count, which is what stops the walk.
 *   2. Height — a node is as tall as the larger of what flows in and out,
 *      scaled so the busiest column fills the canvas.
 *   3. Slots — links leave and arrive stacked in the order they were written,
 *      biggest column first, so ribbons cross as little as the data allows.
 *
 * Ribbons are filled cubic curves (two horizontal-tangent beziers and two
 * straight edges). Skin (`DESIGN.md`): stages are ink bars; a ribbon is a
 * translucent tint of its source's hue with no outline, so a ribbon reads
 * back to where it came from and two crossing ribbons both stay visible.
 * When the author marks one node (`accent`), its flows take the accent and
 * every other ribbon steps back to a neutral tint; `accent: red` is
 * `negative`. A ribbon's value rides its centre line where the ribbon is
 * thick enough, at the first spot along it that clears every stage label and
 * every value already placed.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { HUES } from '../svg/hues.js';
import { FONT, textWidth } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type SankeyData = BlockDataMap['sankey'];
type Link = SankeyData['links'][number];

type Tone = 'plain' | 'accent' | 'negative';

/** A node's tone from its mark: `negative`, `focal` → accent, else plain. */
function toneOf(mark: Mark): Tone {
  if (mark === 'negative') return 'negative';
  if (mark === 'focal') return 'accent';
  return 'plain';
}

const NODE_FILL: Record<Tone, string> = {
  plain: 'var(--ink)',
  accent: 'var(--accent)',
  negative: 'var(--negative)',
};
/** Ribbon opacity: enough to read the hue, low enough that a crossing ribbon shows through. */
const RIBBON_OPACITY = 0.32;
/** A ribbon that is not the author's focus, when one node is flagged. */
const RIBBON_QUIET = 'fill="var(--ink)" fill-opacity="0.1"';


interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}
const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const W = 900;
const NODE_W = 13;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOT = 14;
const GAP = 16; // vertical breathing room between nodes in a column
const MIN_H = 3; // a tiny flow still has to be visible

interface Placed {
  readonly id: string;
  readonly label: string;
  readonly tone: Tone;
  col: number;
  value: number;
  x: number;
  y: number;
  h: number;
  /** Running offsets as ribbons are attached. */
  outAt: number;
  inAt: number;
  /** Data path of the authoring node, when one was declared. */
  path: string | undefined;
}

/** Value formatter — trims a trailing `.0` and appends the unit. */
function fmt(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit !== undefined ? `${text}${unit}` : text;
}

/**
 * Assigns every node a column: the longest link chain that reaches it. Relaxing
 * over all links `n` times settles any acyclic graph and can't loop forever on
 * a cyclic one.
 */
function columnsOf(ids: readonly string[], links: readonly Link[]): Map<string, number> {
  const col = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const l of links) {
      const from = col.get(l.from);
      const to = col.get(l.to);
      if (from === undefined || to === undefined) continue;
      if (to < from + 1) {
        col.set(l.to, from + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return col;
}

export function renderSankey(data: SankeyData): string {
  const links = data.links.filter((l) => l.from !== l.to && l.value > 0);
  const declared = data.nodes ?? [];
  const declaredAt = new Map(declared.map((n, i) => [n.id, i]));

  // Nodes come from the links, in first-seen order, so a bare link list works.
  const order: string[] = [];
  for (const n of declared) if (!order.includes(n.id)) order.push(n.id);
  for (const l of links) {
    if (!order.includes(l.from)) order.push(l.from);
    if (!order.includes(l.to)) order.push(l.to);
  }
  if (order.length === 0 || links.length === 0) {
    return frame(data, '<svg viewBox="0 0 900 60" role="img"><title>Sankey</title></svg>', '');
  }

  const derived = columnsOf(order, links);
  const nodes = new Map<string, Placed>();
  const marks = marksOf(declared.map((n) => n.accent));
  order.forEach((id) => {
    const di = declaredAt.get(id);
    const decl = declared[di ?? -1];
    const inflow = links.filter((l) => l.to === id).reduce((a, l) => a + l.value, 0);
    const outflow = links.filter((l) => l.from === id).reduce((a, l) => a + l.value, 0);
    nodes.set(id, {
      id,
      label: decl?.label ?? id,
      tone: toneOf(di !== undefined ? marks[di] : undefined),
      col: decl?.col !== undefined ? Math.max(0, decl.col - 1) : (derived.get(id) ?? 0),
      value: Math.max(inflow, outflow),
      x: 0,
      y: 0,
      h: 0,
      outAt: 0,
      inAt: 0,
      path: declaredAt.has(id) ? `nodes.${declaredAt.get(id) ?? 0}` : undefined,
    });
  });

  const cols = Math.max(...[...nodes.values()].map((n) => n.col)) + 1;
  const byCol: Placed[][] = Array.from({ length: cols }, () => []);
  for (const id of order) {
    const n = nodes.get(id);
    if (n !== undefined) byCol[n.col]?.push(n);
  }

  // The busiest column decides the scale: its flows plus its gaps fill the
  // canvas, and every other column is drawn on that same scale.
  const height = Math.max(220, Math.min(420, 60 + order.length * 34));
  const usable = height - PAD_TOP - PAD_BOT;
  const scale = Math.min(
    ...byCol
      .filter((c) => c.length > 0)
      .map((c) => {
        const total = c.reduce((a, n) => a + n.value, 0);
        const room = usable - GAP * (c.length - 1);
        return total > 0 ? Math.max(room, 40) / total : Infinity;
      }),
  );

  const colX = (c: number): number =>
    cols === 1 ? PAD_X : PAD_X + ((W - PAD_X * 2 - NODE_W) * c) / (cols - 1);

  byCol.forEach((column, c) => {
    const stack = column.reduce((a, n) => a + n.value * scale, 0) + GAP * (column.length - 1);
    let y = PAD_TOP + Math.max(0, (usable - stack) / 2);
    for (const n of column) {
      n.h = Math.max(MIN_H, n.value * scale);
      n.x = colX(c);
      n.y = y;
      n.outAt = y;
      n.inAt = y;
      y += n.h + GAP;
    }
  });

  // Colour: each source stage owns a hue (in first-seen order), and its
  // flows wear a translucent tint of it. A node the author flagged takes the
  // focus instead: its flows are accent (or negative), every other is quiet.
  const focused = [...nodes.values()].some((n) => n.tone !== 'plain');
  const hueOf = new Map<string, string>();
  for (const l of links) {
    if (!hueOf.has(l.from)) hueOf.set(l.from, `var(--hue-${HUES[hueOf.size % HUES.length] ?? 'blue'})`);
  }
  const ribbonPaint = (a: Placed): string => {
    if (a.tone === 'accent') return 'fill="var(--accent)" fill-opacity="0.42"';
    if (a.tone === 'negative') return 'fill="var(--negative)" fill-opacity="0.36"';
    if (focused) return RIBBON_QUIET;
    return `fill="${hueOf.get(a.id) ?? 'var(--ink)'}" fill-opacity="${RIBBON_OPACITY}"`;
  };

  // Stage labels sit outside the bar, flipping side on the last column so
  // they never run off the canvas, and staying inside it top and bottom.
  // Their boxes are known first: a ribbon value must clear every one.
  const labelOf = new Map<string, { tx: number; ty: number; anchor: 'start' | 'end'; box: Box; valueText: string; mw: number }>();
  for (const n of nodes.values()) {
    const last = n.col === cols - 1;
    const tx = last ? n.x - 8 : n.x + NODE_W + 8;
    const ty = Math.min(Math.max(n.y + n.h / 2, 12), height - 22);
    const valueText = fmt(n.value, data.unit);
    const mw = Math.max(textWidth(n.label, FONT.name), textWidth(valueText, FONT.sub)) + 8;
    const bx = last ? tx - mw + 4 : tx - 4;
    labelOf.set(n.id, { tx, ty, anchor: last ? 'end' : 'start', box: { x0: bx, x1: bx + mw, y0: ty - 9, y1: ty + 19 }, valueText, mw });
  }
  const placedBoxes: Box[] = [
    ...[...labelOf.values()].map((l) => l.box),
    // The stage bars themselves: a ribbon value never sits on a bar.
    ...[...nodes.values()].map((n) => ({ x0: n.x - 2, x1: n.x + NODE_W + 2, y0: n.y, y1: n.y + n.h })),
  ];

  let s = `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Flow volumes')}</title>`;

  // Ribbons first, so the node bars and their labels sit on top.
  const used = new Set<'hue' | 'accent' | 'negative' | 'quiet'>();
  let values = '';
  s += `<g${bl('links')}>`;
  data.links.forEach((l, li) => {
    const a = nodes.get(l.from);
    const b = nodes.get(l.to);
    if (a === undefined || b === undefined || l.value <= 0 || l.from === l.to) return;
    const t = Math.max(1, l.value * scale);
    const x0 = a.x + NODE_W;
    const x1 = b.x;
    const y0 = a.outAt;
    const y1 = b.inAt;
    a.outAt += t;
    b.inAt += t;
    const mid = (x0 + x1) / 2;
    const d =
      `M ${r(x0)} ${r(y0)} C ${r(mid)} ${r(y0)}, ${r(mid)} ${r(y1)}, ${r(x1)} ${r(y1)} ` +
      `L ${r(x1)} ${r(y1 + t)} C ${r(mid)} ${r(y1 + t)}, ${r(mid)} ${r(y0 + t)}, ${r(x0)} ${r(y0 + t)} Z`;
    used.add(a.tone === 'accent' ? 'accent' : a.tone === 'negative' ? 'negative' : focused ? 'quiet' : 'hue');
    s += `<path d="${d}" ${ribbonPaint(a)}${bp(`links.${li}`)}><title>${escapeHtml(`${a.label} → ${b.label}: ${fmt(l.value, data.unit)}`)}</title></path>`;
    // The value rides the ribbon's centre line where the ribbon can hold it,
    // at the first spot along it that clears the stage labels and the values
    // already placed. No spot → no label (the ribbon's tooltip keeps it).
    if (t >= 13) {
      const label = l.label ?? fmt(l.value, data.unit);
      const w = textWidth(label, FONT.arrow);
      const at = (u: number): { x: number; y: number } => {
        const v = 1 - u;
        const x = v * v * v * x0 + 3 * v * v * u * mid + 3 * v * u * u * mid + u * u * u * x1;
        const y = v * v * v * y0 + 3 * v * v * u * y0 + 3 * v * u * u * y1 + u * u * u * y1 + t / 2;
        return { x, y };
      };
      for (const u of [0.5, 0.38, 0.62, 0.28, 0.72]) {
        const p = at(u);
        const box: Box = { x0: p.x - w / 2 - 2, x1: p.x + w / 2 + 2, y0: p.y - 7, y1: p.y + 5 };
        if (placedBoxes.some((o) => overlaps(o, box))) continue;
        placedBoxes.push(box);
        const cls = a.tone === 'accent' ? 't-arrow c-accent' : a.tone === 'negative' ? 't-arrow c-negative' : 't-arrow c-ink';
        values += `<text x="${r(p.x)}" y="${r(p.y + 3)}" class="${cls}" text-anchor="middle">${escapeHtml(label)}</text>`;
        break;
      }
    }
  });
  s += values + `</g>`;

  s += `<g${bl('nodes')}>`;
  for (const n of nodes.values()) {
    const attrs = n.path !== undefined ? bp(n.path) : '';
    const lab = labelOf.get(n.id);
    s += `<g${attrs}>`;
    s += `<rect x="${r(n.x)}" y="${r(n.y)}" width="${NODE_W}" height="${r(n.h)}" fill="${NODE_FILL[n.tone]}"/>`;
    if (lab !== undefined) {
      const nameCls = n.tone === 'accent' ? 't-name c-accent' : n.tone === 'negative' ? 't-name c-negative' : 't-name';
      // A paper mask under both lines keeps the label off the ribbon edges
      // that leave and arrive around the bar.
      s += `<rect x="${r(lab.box.x0)}" y="${r(lab.box.y0)}" width="${r(lab.mw)}" height="28" rx="2" fill="var(--paper)"/>`;
      s += `<text x="${r(lab.tx)}" y="${r(lab.ty + 3)}" class="${nameCls}" text-anchor="${lab.anchor}">${escapeHtml(n.label)}</text>`;
      s += `<text x="${r(lab.tx)}" y="${r(lab.ty + 15)}" class="t-sub c-muted" text-anchor="${lab.anchor}">${escapeHtml(lab.valueText)}</text>`;
    }
    s += `</g>`;
  }
  s += `</g></svg>`;

  const items: LegendItem[] = [{ swatch: 'fill', fill: 'var(--ink)', label: 'stage (height = volume)' }];
  if (used.has('hue')) items.push({ swatch: 'fill', fill: hueOf.values().next().value ?? 'var(--ink)', label: 'flow (width = volume, colour = source)' });
  if (used.has('quiet')) items.push({ swatch: 'fill', fill: 'var(--paper-2)', label: 'flow (width = volume)' });
  if (used.has('accent')) items.push({ swatch: 'node-accent', label: 'focal flow' });
  if (used.has('negative')) items.push({ swatch: 'fill', fill: 'var(--negative-tint)', label: 'negative flow' });
  return frame(data, s, renderLegend(items));
}

/** Rounds to one decimal — SVG paths don't need more, and diffs stay small. */
function r(v: number): number {
  return Math.round(v * 10) / 10;
}

function frame(data: SankeyData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'SANKEY',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
