/**
 * Geometry checks shared by the grid diagram renderers, and the helpers that
 * size a grid for its edge labels.
 *
 * A renderer routes its edges ({@link routeEdges}), places its labels
 * (`edgeLabelLayer`), then hands the result to {@link geometryOf}. The report
 * names what the layout could not avoid — two nodes in one cell, an edge
 * forced through a node, a label that fell back to a numeral, many crossings —
 * and each issue's hint says the fix in terms the author controls (move a
 * node, drop `col`/`row`, try `dir: TB`, shorten a label, split the diagram),
 * never in pixels.
 */

import { LABEL_RUN, labelBox } from './edgeSteps.js';
import { countCrossings, type FlowDir, type Pt, type RoutedEdge } from './router.js';
import type { LabelCut } from './wrapText.js';

/** What went wrong. */
export type GeometryIssueKind =
  | 'boundary-encloses'
  | 'phase-unknown'
  | 'cell-overlap'
  | 'edge-through-node'
  | 'label-fallback'
  | 'crossings'
  | 'label-truncated';

/** One geometry problem the layout could not avoid. */
export interface GeometryIssue {
  readonly kind: GeometryIssueKind;
  /** Data path of the part the issue is about (`edges.3`, `nodes.1`), when one. */
  readonly path?: string | undefined;
  /** What is wrong, naming the nodes and edges. */
  readonly message: string;
  /** The fix, in terms of the block's data. */
  readonly hint: string;
}

/** The geometry report of one diagram. */
export interface GeometryReport {
  readonly issues: readonly GeometryIssue[];
  /** Proper crossings between edge routes. */
  readonly crossings: number;
  /** Edges forced through a node that is not one of their ends. */
  readonly throughNode: number;
  /** Edge labels that fell back to a numeral. */
  readonly labelFallbacks: number;
  /** Pairs of nodes that share a grid cell. */
  readonly sharedCells: number;
  /** Placed labels that cover a node box (always 0 unless placement regressed). */
  readonly labelOverlaps: number;
}

/** An empty report (a block type with no grid geometry). */
export const NO_GEOMETRY: GeometryReport = {
  issues: [],
  crossings: 0,
  throughNode: 0,
  labelFallbacks: 0,
  sharedCells: 0,
  labelOverlaps: 0,
};

/** One node as the report names it. */
export interface GeoNode {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly col?: number | undefined;
  readonly row?: number | undefined;
  readonly w?: number | undefined;
  readonly h?: number | undefined;
}

/** One edge as the report names it. */
export interface GeoEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string | undefined;
  readonly path: string;
}

/** Inputs to {@link geometryOf}. */
export interface GeometryInput {
  /** What the block calls a node and an edge (`state` / `transition`, …). */
  readonly nodeWord: string;
  readonly edgeWord: string;
  readonly nodes: readonly GeoNode[];
  readonly edges: readonly GeoEdge[];
  /** Routes aligned with `edges` (undefined: unrouted). */
  readonly routes: ReadonlyArray<RoutedEdge | undefined>;
  /** Indices into `edges` whose label fell back to a numeral. */
  readonly fallbacks: readonly number[];
  /** True when auto-layout placed the nodes (no author coordinates). */
  readonly quick: boolean;
  readonly dir: FlowDir;
  /** False for renderers whose layout has no author cells (no cell check). */
  readonly cells?: boolean;
  /** The mask box of every label placed on its edge. */
  readonly labelBoxes?: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }>;
  /** Every node's box (what a label must never cover). */
  readonly nodeBoxes?: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }>;
}

/**
 * A tangle is reported when the edges cross more often than there are edges
 * (each edge crossing two others on average), and at least this often.
 */
const CROSSING_FLOOR = 6;

/** What the report calls a node: its name, else its id, else its data path. */
function nameOf(n: GeoNode): string {
  if (n.name.trim() !== '') return n.name;
  return n.id.trim() !== '' ? n.id : n.path;
}

/** `"Name"` for a node id (falls back to the id). */
function quoted(nodes: ReadonlyMap<string, GeoNode>, id: string): string {
  const n = nodes.get(id);
  return `"${n !== undefined ? nameOf(n) : id}"`;
}

/** Builds the geometry report from a renderer's routed, labelled result. */
export function geometryOf(input: GeometryInput): GeometryReport {
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  const issues: GeometryIssue[] = [];
  const flip = input.dir === 'LR' ? 'TB' : 'LR';
  const relayout = input.quick
    ? `try \`dir: ${flip}\`, or split the diagram into two`
    : 'remove `col` and `row` from every node and let auto-layout place them';

  // Two nodes in one cell (author coordinates only; auto-layout never does it).
  let sharedCells = 0;
  if (input.cells !== false) {
    const nodes = input.nodes.filter((n) => n.col !== undefined && n.row !== undefined);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i] as GeoNode;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j] as GeoNode;
        const ac = a.col as number;
        const ar = a.row as number;
        const bc = b.col as number;
        const br = b.row as number;
        const colHit = ac <= bc + (b.w ?? 1) - 1 && bc <= ac + (a.w ?? 1) - 1;
        const rowHit = ar <= br + (b.h ?? 1) - 1 && br <= ar + (a.h ?? 1) - 1;
        if (!colHit || !rowHit) continue;
        sharedCells++;
        issues.push({
          kind: 'cell-overlap',
          path: b.path,
          message: `The ${input.nodeWord}s "${nameOf(a)}" and "${nameOf(b)}" use the same cell (col ${bc}, row ${br}).`,
          hint: `Move "${nameOf(b)}" to a free cell: a \`col\` and \`row\` no other ${input.nodeWord} uses.`,
        });
      }
    }
  }

  // Edges forced through a node.
  let throughNode = 0;
  input.edges.forEach((e, i) => {
    const r = input.routes[i];
    if (r === undefined || r.through.length === 0) return;
    throughNode++;
    const names = r.through.map((id) => quoted(byId, id)).join(', ');
    const first = r.through[0] ?? '';
    issues.push({
      kind: 'edge-through-node',
      path: e.path,
      message: `The ${input.edgeWord} ${quoted(byId, e.from)} → ${quoted(byId, e.to)} goes through ${input.nodeWord} ${names}.`,
      hint: `Move ${quoted(byId, first)} to a free cell off the line between the two, or ${relayout}.`,
    });
  });

  // Labels that could not sit on their edge.
  for (const i of input.fallbacks) {
    const e = input.edges[i];
    if (e === undefined) continue;
    issues.push({
      kind: 'label-fallback',
      path: e.path,
      message: `The label "${e.label ?? ''}" on ${quoted(byId, e.from)} → ${quoted(byId, e.to)} has no clear place on its ${input.edgeWord} and shows as a number.`,
      hint: `Shorten the label, or move ${quoted(byId, e.from)} or ${quoted(byId, e.to)} so the ${input.edgeWord} has a longer straight part.`,
    });
  }

  const crossings = countCrossings(input.routes);
  const limit = Math.max(CROSSING_FLOOR, input.edges.length);
  if (crossings > limit) {
    issues.push({
      kind: 'crossings',
      message: `The ${input.edgeWord}s cross ${crossings} times, more than there are ${input.edgeWord}s; they are hard to follow.`,
      hint: input.quick
        ? `Try \`dir: ${flip}\`, or split the diagram into two.`
        : `Put linked ${input.nodeWord}s in neighbouring cells, or ${relayout}.`,
    });
  }

  // A placed label never covers a node (a guard on the placement itself).
  const labelOverlaps = (input.labelBoxes ?? []).filter((l) =>
    (input.nodeBoxes ?? []).some(
      (b) => l.x < b.x + b.w && b.x < l.x + l.w && l.y < b.y + b.h && b.y < l.y + l.h,
    ),
  ).length;

  return {
    issues,
    crossings,
    throughNode,
    labelFallbacks: input.fallbacks.length,
    sharedCells,
    labelOverlaps,
  };
}

/** The point halfway along a polyline (the label anchor of last resort). */
export function routeMidpoint(pts: readonly Pt[]): { lx: number; ly: number } {
  let total = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = pts[k] as Pt;
    const q = pts[k + 1] as Pt;
    total += Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
  }
  let left = total / 2;
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = pts[k] as Pt;
    const q = pts[k + 1] as Pt;
    const len = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
    if (left <= len && len > 0) {
      return {
        lx: Math.round(p.x + ((q.x - p.x) * left) / len),
        ly: Math.round(p.y + ((q.y - p.y) * left) / len),
      };
    }
    left -= len;
  }
  const p = pts[0] ?? { x: 0, y: 0 };
  return { lx: p.x, ly: p.y };
}

/** A cell an edge end sits in. */
export interface CellRef {
  readonly col: number;
  readonly row: number;
}

/** Free room a cell leaves around its node box, per axis (cell minus box). */
export interface Slack {
  readonly x: number;
  readonly y: number;
}

/**
 * The uniform column and row gaps a grid needs so every edge label fits on
 * its edge. Only an edge between NEIGHBOURING columns or rows must fit its
 * label inside one gap: a longer edge has a long straight run of its own, and
 * a back edge loops around the outside. A neighbour edge across columns (in
 * `LR`, or along a row in `TB`) needs a column gap wider than its narrowest
 * label form; one across rows needs a row gap taller than it. `slack` is the
 * room the two cells already leave around their boxes. One gap per axis, so
 * the Studio grid metadata stays valid.
 */
export function gapsForLabels(
  edges: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
    readonly label?: string | undefined;
  }>,
  cellOf: (id: string) => (CellRef & { readonly w?: number | undefined }) | undefined,
  dir: FlowDir,
  base: { readonly gapX: number; readonly gapY: number },
  slack: Slack | ((from: string, to: string) => Slack) = { x: 0, y: 0 },
): { gapX: number; gapY: number } {
  let gapX = base.gapX;
  let gapY = base.gapY;
  for (const e of edges) {
    if (e.label === undefined || e.label === '' || e.from === e.to) continue;
    const a = cellOf(e.from);
    const b = cellOf(e.to);
    if (a === undefined || b === undefined) continue;
    if (hasBackEdge([e], cellOf, dir)) continue;
    const s = typeof slack === 'function' ? slack(e.from, e.to) : slack;
    const { w, h } = labelBox(e.label);
    const aEnd = a.col + (a.w ?? 1) - 1;
    const bEnd = b.col + (b.w ?? 1) - 1;
    const colStep = b.col > aEnd ? b.col - aEnd : a.col > bEnd ? a.col - bEnd : 0;
    const rowStep = Math.abs(a.row - b.row);
    if (colStep === 1 && (dir === 'LR' || rowStep === 0))
      gapX = Math.max(gapX, w + LABEL_RUN - s.x);
    if (rowStep === 1 && (dir === 'TB' || colStep === 0))
      gapY = Math.max(gapY, h + LABEL_RUN - s.y);
  }
  return { gapX: Math.ceil(gapX / 2) * 2, gapY: Math.ceil(gapY / 2) * 2 };
}

/**
 * True when some edge runs against the flow (its target sits fully upstream).
 * Such an edge loops around the outside of its row (or column), so the grid
 * gives the outer pads room for the loop and its label.
 */
export function hasBackEdge(
  edges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
  cellOf: (id: string) => (CellRef & { readonly w?: number | undefined }) | undefined,
  dir: FlowDir,
): boolean {
  return edges.some((e) => {
    const a = cellOf(e.from);
    const b = cellOf(e.to);
    if (a === undefined || b === undefined || e.from === e.to) return false;
    return dir === 'LR' ? b.col + (b.w ?? 1) - 1 < a.col : b.row < a.row;
  });
}

/** Extra outer pad (px) a grid adds on the loop sides when it has a back edge. */
export const LOOP_PAD = 18;

/** The longest stretch of author text a cut message quotes. */
const QUOTE_MAX = 60;

/** `text`, cut to {@link QUOTE_MAX} characters for a message. */
function quote(text: string): string {
  const chars = [...text];
  return chars.length <= QUOTE_MAX ? text : `${chars.slice(0, QUOTE_MAX - 1).join('').trimEnd()}…`;
}

/**
 * One `label-truncated` issue per text a renderer had to cut, in report
 * order, with repeats (the same field cut twice, as when a layout is tried in
 * two directions) dropped. The message names the field and its owner; the
 * hint says the fix in data terms.
 */
export function cutIssues(cuts: readonly LabelCut[]): GeometryIssue[] {
  const seen = new Set<string>();
  const out: GeometryIssue[] = [];
  for (const c of cuts) {
    const key = `${c.path ?? ''}\u0000${c.field}\u0000${c.full}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const owner = c.owner !== undefined && c.owner.trim() !== '' && c.owner !== c.full ? ` of "${quote(c.owner)}"` : '';
    out.push({
      kind: 'label-truncated',
      ...(c.path !== undefined ? { path: c.path } : {}),
      message: `The \`${c.field}\`${owner} does not fit its box and is cut: "${quote(c.full)}".`,
      hint: c.hint ?? `Shorten \`${c.field}\`, or move the detail to a note.`,
    });
  }
  return out;
}
