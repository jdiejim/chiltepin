/**
 * Auto-layout for the coordinate-grid diagram blocks (flow, c4, state, dfd, uml).
 *
 * These renderers place nodes on an integer `col`/`row` grid. When an author
 * supplies coordinates we honour them exactly; when any are missing we derive a
 * clean layered grid from the edges using dagre (pure JS, no DOM) — ranks become
 * one axis, order-within-rank the other — so you can declare just nodes + edges
 * and still get a sensible diagram. The downstream renderers are unchanged.
 *
 * Every caller passes `data.dir ?? 'LR'`: ranks run left-to-right by default,
 * because a page is wider than it is tall and a stack of ranks running *down*
 * outgrows both the page column and the slide stage. `dir: TB` opts back in.
 */

import dagre from '@dagrejs/dagre';
import { svgWidth } from './frame.js';

/**
 * The widest left-to-right drawing auto-layout keeps (viewBox units): the
 * stage width past which a drawing stops shrinking and scrolls sideways
 * instead (`WIDE_STAGE` in `frame.ts`), hiding its right side from a reader
 * who does not scroll. Narrower drawings keep left to right, which also suits
 * the 16:9 slide stage.
 */
const LR_FIT_W = 1600;

/**
 * Picks the direction of an auto-laid-out diagram whose author left `dir`
 * unset: left to right, unless that drawing is wider than {@link LR_FIT_W}
 * and the top-to-bottom drawing is narrower. An explicit `dir`, or nodes the
 * author placed (every node has `col` and `row`), always win.
 *
 * @param data - The block data.
 * @param items - The nodes (states, …) whose placement decides auto mode.
 * @param layout - Lays out and draws the block for a given data.
 * @param markup - The SVG (or framed HTML) of a layout, to measure its width.
 */
export function autoDir<D extends { readonly dir?: 'LR' | 'TB' | undefined }, R>(
  data: D,
  items: ReadonlyArray<HasGrid>,
  layout: (d: D) => R,
  markup: (r: R) => string,
): R {
  const lr = layout(data);
  const placed = items.length > 0 && items.every((n) => n.col !== undefined && n.row !== undefined);
  if (data.dir !== undefined || placed) return lr;
  const wLR = svgWidth(markup(lr));
  if (wLR <= LR_FIT_W) return lr;
  const tb = layout({ ...data, dir: 'TB' });
  return svgWidth(markup(tb)) < wLR ? tb : lr;
}

interface HasGrid {
  readonly id: string;
  readonly col?: number | undefined;
  readonly row?: number | undefined;
}

interface Edge {
  readonly from: string;
  readonly to: string;
}

/**
 * Returns the items with `col`/`row` guaranteed. If every item already has both,
 * they're used verbatim; otherwise all are placed by {@link autoGrid}.
 */
export function ensureGrid<T extends HasGrid>(
  items: readonly T[],
  edges: readonly Edge[],
  rankdir: 'TB' | 'LR',
): Array<T & { col: number; row: number }> {
  const allPlaced =
    items.length > 0 && items.every((n) => n.col !== undefined && n.row !== undefined);
  if (allPlaced) {
    return items.map((n) => ({ ...n, col: n.col as number, row: n.row as number }));
  }
  const grid = autoGrid(
    items.map((n) => n.id),
    edges,
    rankdir,
  );
  return items.map((n) => {
    const g = grid.get(n.id) ?? { col: 1, row: 1 };
    return { ...n, col: g.col, row: g.row };
  });
}

/**
 * The edges that close a cycle: a depth-first walk from the roots (nodes no
 * edge enters, in document order, then any node still unvisited) marks an
 * edge back when it points at a node still on the walk's stack. Such an edge
 * runs against the flow, so it must not push its target to a later rank.
 */
export function backEdges(ids: readonly string[], edges: readonly Edge[]): Set<number> {
  const idSet = new Set(ids);
  const outs = new Map<string, number[]>(ids.map((id) => [id, []]));
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  edges.forEach((e, i) => {
    if (e.from === e.to || !idSet.has(e.from) || !idSet.has(e.to)) return;
    outs.get(e.from)?.push(i);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });
  const back = new Set<number>();
  const state = new Map<string, 1 | 2>(); // 1 = on the stack, 2 = done
  const visit = (root: string): void => {
    // Iterative DFS (deep chains must not overflow the call stack).
    const stack: Array<{ id: string; k: number }> = [{ id: root, k: 0 }];
    state.set(root, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1] as { id: string; k: number };
      const list = outs.get(top.id) ?? [];
      if (top.k >= list.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const ei = list[top.k++] as number;
      const to = (edges[ei] as Edge).to;
      const st = state.get(to);
      if (st === 1) back.add(ei);
      else if (st === undefined) {
        state.set(to, 1);
        stack.push({ id: to, k: 0 });
      }
    }
  };
  for (const id of ids) if ((indeg.get(id) ?? 0) === 0 && !state.has(id)) visit(id);
  for (const id of ids) if (!state.has(id)) visit(id);
  return back;
}

/**
 * Maps coordinates to 1-based slots: equal coordinates (within 2px) share a
 * slot, and slots follow coordinate order with no empty slot between them.
 */
function slots(values: readonly number[]): Map<number, number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out = new Map<number, number>();
  let slot = 0;
  let last = -Infinity;
  for (const v of sorted) {
    if (v - last > 2) slot++;
    out.set(v, slot);
    last = v;
  }
  return out;
}

/**
 * Lays out a directed graph with dagre using uniform node sizes (we only want
 * topology, not pixels), then snaps the result to an integer grid without
 * losing dagre's alignment: each distinct rank coordinate is a column (`LR`)
 * or row (`TB`), and each distinct cross coordinate — across ALL ranks — is a
 * row (or column). A straight chain therefore stays on one row, a parent sits
 * level with the middle of the siblings it fans out to, and two nodes of one
 * rank never share a cell. Back edges (see {@link backEdges}) enter dagre
 * reversed, so a cycle never changes a rank.
 */
function autoGrid(
  ids: readonly string[],
  edges: readonly Edge[],
  rankdir: 'TB' | 'LR',
): Map<string, { col: number; row: number }> {
  const idSet = new Set(ids);
  const back = backEdges(ids, edges);
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 16, ranksep: 16, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) g.setNode(id, { width: 10, height: 10 });
  edges.forEach((e, i) => {
    if (e.from === e.to || !idSet.has(e.from) || !idSet.has(e.to)) return;
    if (back.has(i)) g.setEdge(e.to, e.from);
    else g.setEdge(e.from, e.to);
  });
  dagre.layout(g);

  const pos = ids.map((id) => {
    const n = g.node(id) as { x?: number; y?: number } | undefined;
    return { id, x: Math.round(n?.x ?? 0), y: Math.round(n?.y ?? 0) };
  });
  const rankOf = (p: { x: number; y: number }): number => (rankdir === 'TB' ? p.y : p.x);
  const crossOf = (p: { x: number; y: number }): number => (rankdir === 'TB' ? p.x : p.y);
  const rankSlot = slots(pos.map(rankOf));
  const crossSlot = slots(pos.map(crossOf));

  const out = new Map<string, { col: number; row: number }>();
  for (const p of pos) {
    const r = rankSlot.get(rankOf(p)) ?? 1;
    const c = crossSlot.get(crossOf(p)) ?? 1;
    out.set(p.id, rankdir === 'TB' ? { col: c, row: r } : { col: r, row: c });
  }
  return out;
}
