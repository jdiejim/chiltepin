/**
 * Renders a `bintree` block — a binary tree in pure SVG inside the diagram
 * frame (tag TREE).
 *
 * In-order layout: every node takes the next column in an in-order walk, so
 * a node's x is its rank in sorted order (a BST reads left to right in key
 * order) and no two nodes can share a column. Columns are half a node apart:
 * two nodes on one level always have their common ancestor between them, so
 * they stand at least a full node apart, whatever the shape — a lone child
 * never lands on its parent's sibling. Nodes without a parent are roots and
 * lay out side by side.
 *
 * Every node is one size, sized from the widest value (a long value is cut
 * with "…" and kept whole in the node's `<title>`). Levels are spaced from
 * that size; edges are `muted` 1.5px lines drawn behind the nodes, and every
 * node sits on an opaque paper disc, so a tinted tone never shows an edge
 * through it. Node tones follow `svg/dsTone.ts`; the legend names the tones
 * in play.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DS_TONE_LEGEND, dsTone, dsToneAttrs, type DsTone } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type BintreeData = BlockDataMap['bintree'];
type Node = NonNullable<BintreeData['nodes']>[number];

/** The smallest node radius (36px circles), and the largest a long value may grow it to. */
const R_MIN = 18;
const R_MAX = 38;
/** A value longer than this is cut with "…" (the node's `<title>` keeps it whole). */
const MAX_CHARS = 8;
/** Approximate advance of one 12.5px semibold mono character. */
const VAL_CH = 7.6;
const PAD_X = 10;
const PAD_TOP = 8;

/** The text a node shows, and whether it was cut. */
function fit(v: string): { text: string; cut: boolean } {
  const chars = [...v];
  return chars.length > MAX_CHARS ? { text: `${chars.slice(0, MAX_CHARS - 1).join('')}…`, cut: true } : { text: v, cut: false };
}

/** One node radius for the whole tree, from the widest value it shows. */
export function bintreeRadius(values: readonly string[]): number {
  const widest = Math.max(0, ...values.map((v) => [...fit(v).text].length * VAL_CH));
  return Math.min(R_MAX, Math.max(R_MIN, Math.ceil(widest / 2 + 7)));
}

interface Placed {
  readonly node: Node;
  readonly x: number; // in-order column (normalized later)
  readonly depth: number;
}

export function renderBintree(data: BintreeData): string {
  const nodes = data.nodes ?? [];

  if (nodes.length === 0) {
    const s = `<svg viewBox="0 0 220 44" width="220" height="44" role="img"><title>Binary tree</title><text x="${PAD_X}" y="26" class="t-sub c-soft">(empty)</text></svg>`;
    return frame(data, s, '');
  }

  const R = bintreeRadius(nodes.map((n) => n.value));
  // Half a node apart per column, with a little air: same-level nodes are
  // two columns apart at least, so 2 × UNIT ≥ 2R + 8.
  const UNIT = R + 6;
  const LEVEL_H = Math.max(64, 2 * R + 26);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, { left?: Node; right?: Node }>();
  const roots: Node[] = [];
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent)) {
      roots.push(n);
      continue;
    }
    const slots = children.get(n.parent) ?? {};
    if (n.side === 'right') slots.right = n;
    else slots.left = n; // schema guarantees `side` when `parent` is set
    children.set(n.parent, slots);
  }

  // In-order walk: left subtree, the node, right subtree — one column each.
  const placed = new Map<string, Placed>();
  let column = 0;
  const visiting = new Set<string>();
  const place = (n: Node, depth: number): void => {
    if (placed.has(n.id) || visiting.has(n.id)) return; // cycle guard
    visiting.add(n.id);
    const kids = children.get(n.id) ?? {};
    if (kids.left !== undefined) place(kids.left, depth + 1);
    placed.set(n.id, { node: n, x: column, depth });
    column += 1;
    if (kids.right !== undefined) place(kids.right, depth + 1);
    visiting.delete(n.id);
  };
  roots.forEach((root, i) => {
    if (i > 0) column += 1; // a free column between side-by-side roots
    place(root, 0);
  });

  const all = [...placed.values()];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const maxDepth = Math.max(...all.map((p) => p.depth));
  const cxOf = (p: Placed): number => PAD_X + R + Math.round((p.x - minX) * UNIT);
  const cyOf = (p: Placed): number => PAD_TOP + R + p.depth * LEVEL_H;
  const width = PAD_X * 2 + 2 * R + Math.round((maxX - minX) * UNIT);
  const height = PAD_TOP + 2 * R + maxDepth * LEVEL_H + 8;

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Binary tree</title>`;

  // Edges behind the nodes.
  for (const p of all) {
    const parentId = p.node.parent;
    if (parentId === undefined) continue;
    const pp = placed.get(parentId);
    if (pp === undefined) continue;
    s += `<line x1="${cxOf(pp)}" y1="${cyOf(pp)}" x2="${cxOf(p)}" y2="${cyOf(p)}" stroke="var(--muted)" stroke-width="1.5"/>`;
  }

  // Nodes (source order keeps the output deterministic).
  const tones = new Set<DsTone>();
  let plain = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const p = placed.get(n.id);
    if (p === undefined) return; // unreachable (cyclic parents)
    const t = dsTone(n.tone);
    if (n.tone !== undefined) tones.add(n.tone);
    else plain = true;
    const shown = fit(n.value);
    s +=
      `<g${bp(`nodes.${ni}`)}>` +
      (shown.cut ? `<title>${escapeHtml(n.value)}</title>` : '') +
      // The opaque base: a tinted tone must not show the edge beneath it.
      `<circle cx="${cxOf(p)}" cy="${cyOf(p)}" r="${R}" fill="var(--paper)" stroke="none" class="bt-base"/>` +
      `<circle cx="${cxOf(p)}" cy="${cyOf(p)}" r="${R}"${dsToneAttrs(t)}/>` +
      `<text x="${cxOf(p)}" y="${cyOf(p) + 4}" class="bt-val" fill="${t.text}"${bp(`nodes.${ni}.value`)}>${escapeHtml(shown.text)}</text>` +
      `</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += `</svg>`;

  const items: LegendItem[] = [];
  if (plain) items.push({ swatch: 'node', label: 'node' });
  for (const tone of ['active', 'target', 'visited', 'muted'] as const) {
    if (tones.has(tone)) items.push(DS_TONE_LEGEND[tone]);
  }
  return frame(data, s, renderLegend(items));
}

function frame(data: BintreeData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'TREE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
