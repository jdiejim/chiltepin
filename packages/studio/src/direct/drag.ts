/**
 * Pure rules for drag-to-move on diagrams. Pointer-event drags (not HTML5
 * DnD) let users reposition the things a diagram is made of:
 *
 * - **Order-based reorder** — items whose layout derives from array order
 *   (sequence actors, table rows/columns, kanban cards/columns, timeline
 *   items). A drag along the list's axis picks an insertion gap; the drop
 *   commits the reordered array.
 * - **Grid coordinate moves** — the block-graph kind (`block`, whatever its
 *   `preset`: infra/event/ddd/network fences all parse to it) places nodes on
 *   an integer col/row grid; a drag snaps the node to the hovered cell and
 *   writes `nodes.N.col`/`nodes.N.row`.
 *
 * Everything here is measured-rect / index math — no React, no DOM — so the
 * intent classifier, reorder computations, grid snapping, and op builders are
 * unit-testable. The DOM glue lives in `useDrag.ts`.
 */

import { specFor } from './connect.js';
import type { PathSeg } from './paths.js';

/* ─── drag-intent classifier ──────────────────────────────────────────────── */

/** Pointer travel below this stays a click (→ micro-editor); above it, a drag. */
const DRAG_THRESHOLD_PX = 6;

/** True once pointer travel exceeds the drag-intent threshold. */
export function isDragGesture(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) > threshold;
}

/* ─── what a grabbed path means, per block kind ───────────────────────────── */

/** The draggable thing a `data-bp` path resolves to. */
export type DragTarget =
  /** Reorder one item of a flat list along the list's dominant axis. */
  | { readonly mode: 'reorder'; readonly listPath: string; readonly index: number }
  /** Table column: compound reorder of `columns` AND every row's cells. */
  | { readonly mode: 'table-cols'; readonly index: number }
  /** Kanban card: reorder within its column or move across columns. */
  | { readonly mode: 'kanban-card'; readonly col: number; readonly index: number }
  /** Grid node: move to a cell (node list per kind — `nodes`/`states`/`steps`). */
  | { readonly mode: 'grid-node'; readonly listPath: string; readonly index: number }
  /** Dashed group wrapper: move the whole cell range (writes `col`/`row`). */
  | { readonly mode: 'grid-group'; readonly index: number }
  /** Cycle stage: reorder around the ring by pointer angle. */
  | { readonly mode: 'ring'; readonly listPath: string; readonly index: number };

/**
 * Ordered lists whose items drag-reorder like timeline items — one entry per
 * kind is all the machinery needs (measured axis, insertion gap, ghost,
 * one-commit drop all come from the shared reorder path).
 *
 * `saga` is here rather than in the grid family on purpose: a saga step has no
 * `col`/`row` — the schema is strict and has neither — so its position IS its
 * array index. Dragging a step along the row therefore splices it to a new
 * index (the useful gesture for a saga: reordering the transaction), and the
 * grid metadata the coordinate diagrams emit would be a lie here.
 *
 * The context menu reads the same map (`listMenu` in `menu.ts`), so a kind
 * added here gets the drag AND the right-click menu from one entry.
 */
export const REORDER_LISTS: Readonly<Record<string, string>> = {
  glossary: 'terms',
  faq: 'items',
  steps: 'items',
  list: 'items',
  takeaways: 'items',
  agenda: 'items',
  team: 'members',
  stats: 'stats',
  saga: 'steps',
};

/**
 * Maps a grabbed `data-bp` path to its drag target for a block kind, or null
 * when that part is not draggable. Deep paths resolve to the item that moves:
 * a table CELL (`rows.2.1`) drags its row, a kanban column LABEL drags its
 * column, a timeline sub-field drags its item. WHICH kinds place nodes on a
 * col/row grid — and which carry `groups` ranges — comes from the connect
 * spec table (one source of truth, no parallel kind sets); segment kinds are
 * always canonical (alias fences like `infra` parse to `block`).
 */
export function dragTargetFor(kind: string, path: string): DragTarget | null {
  let m: RegExpExecArray | null;
  if (kind === 'sequence') {
    m = /^actors\.(\d+)$/.exec(path);
    return m !== null ? { mode: 'reorder', listPath: 'actors', index: Number(m[1]) } : null;
  }
  if (kind === 'table') {
    m = /^columns\.(\d+)$/.exec(path);
    if (m !== null) return { mode: 'table-cols', index: Number(m[1]) };
    m = /^rows\.(\d+)(?:\.\d+)?$/.exec(path);
    return m !== null ? { mode: 'reorder', listPath: 'rows', index: Number(m[1]) } : null;
  }
  if (kind === 'kanban') {
    m = /^columns\.(\d+)\.cards\.(\d+)$/.exec(path);
    if (m !== null) return { mode: 'kanban-card', col: Number(m[1]), index: Number(m[2]) };
    m = /^columns\.(\d+)(?:\.label)?$/.exec(path);
    return m !== null ? { mode: 'reorder', listPath: 'columns', index: Number(m[1]) } : null;
  }
  if (kind === 'timeline') {
    m = /^items\.(\d+)(?:\.\w+)?$/.exec(path);
    return m !== null ? { mode: 'reorder', listPath: 'items', index: Number(m[1]) } : null;
  }
  const rl = REORDER_LISTS[kind];
  if (rl !== undefined) {
    // Ordered HTML lists (glossary rows, FAQ items, step lists…): the item —
    // or any tagged leaf inside it — drags the item, timeline-style.
    m = new RegExp(`^${rl}\\.(\\d+)(?:\\..+)?$`).exec(path);
    return m !== null ? { mode: 'reorder', listPath: rl, index: Number(m[1]) } : null;
  }
  if (kind === 'cycle') {
    // A stage pill group is `steps.N`; its wrapped label carries
    // `steps.N.label` (object steps) — both grab the stage.
    m = /^steps\.(\d+)(?:\.label)?$/.exec(path);
    return m !== null ? { mode: 'ring', listPath: 'steps', index: Number(m[1]) } : null;
  }
  const spec = specFor(kind);
  if (spec !== null) {
    if (spec.gridNodes) {
      m = new RegExp(`^${spec.nodesField}\\.(\\d+)$`).exec(path);
      if (m !== null) return { mode: 'grid-node', listPath: spec.nodesField, index: Number(m[1]) };
    }
    if (spec.groups) {
      m = /^groups\.(\d+)$/.exec(path);
      if (m !== null) return { mode: 'grid-group', index: Number(m[1]) };
    }
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Whether a block kind has draggable diagram parts at all (drives the footer
 * "drag → move parts" hint): the order-based kinds, the ring (cycle), and
 * every grid kind from the connect spec table — except a block-graph in
 * LAYERED mode (bands by `layer` index, no col/row grid) when `data` says so.
 */
export function blockSupportsDrag(kind: string, data?: unknown): boolean {
  if (
    kind === 'sequence' ||
    kind === 'table' ||
    kind === 'kanban' ||
    kind === 'timeline' ||
    kind === 'cycle' ||
    kind in REORDER_LISTS
  ) {
    return true;
  }
  if (specFor(kind)?.gridNodes !== true) return false;
  const layers = asRecord(data)?.['layers'];
  return !(Array.isArray(layers) && layers.length > 0);
}

/* ─── axis + insertion math for order-based reorder ───────────────────────── */

/** A rectangle (any consistent coordinate space — wrapper-relative here). */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The axis a list lays out along: the larger spread of the item centers. */
export function dominantAxis(boxes: readonly Box[]): 'x' | 'y' {
  if (boxes.length === 0) return 'y';
  const cx = boxes.map((b) => b.left + b.width / 2);
  const cy = boxes.map((b) => b.top + b.height / 2);
  const spreadX = Math.max(...cx) - Math.min(...cx);
  const spreadY = Math.max(...cy) - Math.min(...cy);
  return spreadX >= spreadY ? 'x' : 'y';
}

/** Item center coordinates along an axis, in item (index) order. */
export function centersAlong(boxes: readonly Box[], axis: 'x' | 'y'): number[] {
  return boxes.map((b) => (axis === 'x' ? b.left + b.width / 2 : b.top + b.height / 2));
}

/**
 * The insertion GAP (0 … n) for a pointer coordinate against the item centers:
 * gap `g` means "insert before item g". Before the first center → 0, past the
 * last → n.
 */
export function insertionIndex(centers: readonly number[], pointer: number): number {
  let gap = 0;
  for (const c of centers) if (pointer > c) gap += 1;
  return gap;
}

/**
 * Moves `arr[from]` into gap `gap` (insert-before semantics, 0 … n). Returns
 * the reordered copy, or `null` when the move is a no-op (`gap === from` or
 * `gap === from + 1`) or out of range.
 */
export function applyReorder<T>(arr: readonly T[], from: number, gap: number): T[] | null {
  if (!Number.isInteger(from) || from < 0 || from >= arr.length) return null;
  if (!Number.isInteger(gap) || gap < 0 || gap > arr.length) return null;
  if (gap === from || gap === from + 1) return null;
  const out = arr.slice();
  const [item] = out.splice(from, 1);
  out.splice(gap > from ? gap - 1 : gap, 0, item as T);
  return out;
}

/**
 * Where the insertion indicator sits along the axis for gap `g`: the midpoint
 * of the seam between items `g-1` and `g`, or just outside the first/last item
 * at the ends.
 */
export function gapPosition(boxes: readonly Box[], axis: 'x' | 'y', gap: number): number {
  if (boxes.length === 0) return 0;
  const start = (b: Box): number => (axis === 'x' ? b.left : b.top);
  const end = (b: Box): number => (axis === 'x' ? b.left + b.width : b.top + b.height);
  const first = boxes[0] as Box;
  const last = boxes[boxes.length - 1] as Box;
  if (gap <= 0) return start(first) - 3;
  if (gap >= boxes.length) return end(last) + 3;
  return (end(boxes[gap - 1] as Box) + start(boxes[gap] as Box)) / 2;
}

/* ─── compound op builders (committed as ONE applyOp → one undo step) ─────── */

/** One `setYamlPath` write; a list of these composes into a single undo step. */
export interface PathSet {
  readonly path: ReadonlyArray<PathSeg>;
  readonly value: unknown;
}

/** The permutation (new order of old indices) a from→gap move produces. */
export function permutationFor(n: number, from: number, gap: number): number[] | null {
  return applyReorder(
    Array.from({ length: n }, (_, i) => i),
    from,
    gap,
  );
}

/**
 * Table column reorder: `columns` AND every row's cells reordered by the same
 * permutation, as one set list. Ragged rows are handled: short rows are padded
 * with `''` to the column count before permuting (a cell that didn't exist
 * becomes an empty one), and cells beyond the column count keep their tail
 * positions. The `foot` (totals) row moves with the columns; a group row
 * (`[{ v, group: true }]`) is one label across the table and stays as it is.
 * Returns null for a no-op move or non-array `columns`.
 *
 * A permutation is a whole-list write by nature — no per-index path expresses
 * it — which is what core's terse-aware `setYamlPath` exists for: it moves the
 * author's own YAML nodes rather than reserialising them.
 */
export function tableColumnReorderSets(
  data: unknown,
  from: number,
  gap: number,
): PathSet[] | null {
  const rec = asRecord(data);
  const columns = rec !== null && Array.isArray(rec['columns']) ? rec['columns'] : null;
  if (columns === null) return null;
  const perm = permutationFor(columns.length, from, gap);
  if (perm === null) return null;
  const sets: PathSet[] = [{ path: ['columns'], value: perm.map((i) => columns[i]) }];
  const rows = rec !== null && Array.isArray(rec['rows']) ? rec['rows'] : [];
  const permuted = (row: readonly unknown[]): unknown[] => {
    const padded = row.slice();
    while (padded.length < columns.length) padded.push('');
    return [...perm.map((i) => padded[i]), ...padded.slice(columns.length)];
  };
  rows.forEach((row, ri) => {
    if (!Array.isArray(row) || row.some((c) => asRecord(c)?.['group'] === true)) return;
    sets.push({ path: ['rows', ri], value: permuted(row) });
  });
  const foot = rec?.['foot'];
  if (Array.isArray(foot)) sets.push({ path: ['foot'], value: permuted(foot) });
  return sets;
}

function cardsOf(col: unknown): unknown[] | null {
  const rec = asRecord(col);
  if (rec === null) return null;
  const cards = rec['cards'];
  if (cards === undefined) return [];
  return Array.isArray(cards) ? cards : null;
}

/**
 * Kanban card move: within one column → a single reordered `cards` set;
 * across columns → remove from the source list + insert into the target list
 * at `gap` (clamped), two sets composed into one undo step. Returns null for
 * no-ops or unresolvable columns.
 *
 * The SOURCE write stays a whole-list set: a {@link PathSet} has no `remove`
 * form, and the two writes must land as one undo step. A drop at the END of
 * the target column is a plain append, so that half addresses one index.
 */
export function kanbanCardMoveSets(
  data: unknown,
  fromCol: number,
  fromIdx: number,
  toCol: number,
  gap: number,
): PathSet[] | null {
  const rec = asRecord(data);
  const columns = rec !== null && Array.isArray(rec['columns']) ? rec['columns'] : null;
  if (columns === null) return null;
  const src = cardsOf(columns[fromCol]);
  const dst = cardsOf(columns[toCol]);
  if (src === null || dst === null) return null;
  if (fromCol === toCol) {
    const next = applyReorder(src, fromIdx, gap);
    return next === null ? null : [{ path: ['columns', fromCol, 'cards'], value: next }];
  }
  const card = src[fromIdx];
  if (card === undefined) return null;
  const g = Math.max(0, Math.min(gap, dst.length));
  return [
    { path: ['columns', fromCol, 'cards'], value: src.filter((_, i) => i !== fromIdx) },
    g === dst.length
      ? { path: ['columns', toCol, 'cards', g], value: card }
      : { path: ['columns', toCol, 'cards'], value: [...dst.slice(0, g), card, ...dst.slice(g)] },
  ];
}

/* ─── grid snapping (block-graph family) ──────────────────────────────────── */

/**
 * The grid geometry a block-graph SVG advertises via data attributes, plus
 * the live CSS scale (rendered px per viewBox unit — SVGs shrink to fit).
 */
export interface GridGeom {
  readonly cellW: number;
  readonly cellH: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly padX: number;
  readonly padTop: number;
  readonly cols: number;
  readonly rows: number;
  readonly scale: number;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/**
 * The nearest grid cell for a pointer position (CSS px relative to the SVG's
 * top-left corner). Cells snap by center; one extra column/row beyond the
 * current extent is allowed so a drop can grow the grid.
 */
export function cellAtPoint(
  geom: GridGeom,
  x: number,
  y: number,
): { col: number; row: number } {
  const vx = x / geom.scale;
  const vy = y / geom.scale;
  return {
    col: clampInt((vx - geom.padX - geom.cellW / 2) / (geom.cellW + geom.gapX) + 1, 1, geom.cols + 1),
    row: clampInt((vy - geom.padTop - geom.cellH / 2) / (geom.cellH + geom.gapY) + 1, 1, geom.rows + 1),
  };
}

/** A cell's rectangle in CSS px relative to the SVG's top-left corner. */
export function cellBox(geom: GridGeom, col: number, row: number, w = 1): Box {
  return {
    left: (geom.padX + (col - 1) * (geom.cellW + geom.gapX)) * geom.scale,
    top: (geom.padTop + (row - 1) * (geom.cellH + geom.gapY)) * geom.scale,
    width: (w * geom.cellW + (w - 1) * geom.gapX) * geom.scale,
    height: geom.cellH * geom.scale,
  };
}

/* ─── grid move op builder ────────────────────────────────────────────────── */

/** An effective node placement (from the renderer's data-col/data-row attrs). */
export interface Placement {
  readonly col: number;
  readonly row: number;
}

/**
 * The writes a grid-node move commits (one applyOp → one undo step):
 *
 * - normal mode → the dragged node's `col`/`row`; when the target cell is
 *   already occupied the two nodes SWAP (the renderer stacks same-cell nodes
 *   on top of each other — unreadable), adding the partner's writes;
 * - quick mode (auto-layout: every node lacked col/row in the YAML) → the
 *   first drag MATERIALIZES the effective placement of EVERY node, plus the
 *   dragged node's new cell (and a swap partner's, if any), so the diagram
 *   stops re-flowing under the user.
 *
 * Returns null when the drop lands on the node's own cell (no-op).
 *
 * `field` is the node list to write into (`nodes` by default; `states` for
 * state machines, `steps` for swimlanes) and `writeCell` maps a grid cell to
 * that kind's position fields (`{col,row}` by default; `{col,lane}` with the
 * 0-based lane for swimlanes).
 */
export function gridMoveSets(args: {
  readonly placements: ReadonlyArray<Placement>;
  readonly index: number;
  readonly target: Placement;
  readonly quick: boolean;
  readonly field?: string;
  readonly writeCell?: (cell: Placement) => Readonly<Record<string, number>>;
}): { sets: PathSet[]; swapped: number | null; materialized: boolean } | null {
  const { placements, index, target, quick } = args;
  const field = args.field ?? 'nodes';
  const writeCell = args.writeCell ?? ((p: Placement): Record<string, number> => ({ col: p.col, row: p.row }));
  const cur = placements[index];
  if (cur === undefined) return null;
  if (cur.col === target.col && cur.row === target.row) return null;
  const swapped = placements.findIndex(
    (p, i) => i !== index && p.col === target.col && p.row === target.row,
  );
  const finalOf = (i: number): Placement =>
    i === index ? target : i === swapped ? cur : (placements[i] as Placement);
  const sets: PathSet[] = [];
  const write = (i: number): void => {
    for (const [k, value] of Object.entries(writeCell(finalOf(i)))) {
      sets.push({ path: [field, i, k], value });
    }
  };
  if (quick) {
    placements.forEach((_, i) => write(i));
  } else {
    write(index);
    if (swapped >= 0) write(swapped);
  }
  return { sets, swapped: swapped >= 0 ? swapped : null, materialized: quick };
}

/** Toast shown when a quick-mode drag pins the auto-layout. */
export const MATERIALIZE_TOAST = 'Auto-layout pinned — nodes now keep their positions';

/* ─── ring reorder (cycle stages on a circle) ─────────────────────────────── */

/** A point (same coordinate space as the measured boxes). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The centroid of the stage pill centers — the ring's center. */
export function ringCenter(centers: readonly Point[]): Point {
  const n = Math.max(1, centers.length);
  return {
    x: centers.reduce((a, p) => a + p.x, 0) / n,
    y: centers.reduce((a, p) => a + p.y, 0) / n,
  };
}

/**
 * The insertion GAP (1 … n) for a pointer position against stage centers laid
 * out on a ring: the angular slot the pointer sits in, measured from stage 0
 * (stages render clockwise, uniformly spaced). Pointer between stage `g-1`
 * and stage `g` → gap `g`; the seam between the last and first stage is gap
 * `n` (insert at the end). Null when there are fewer than two stages.
 */
export function ringGap(centers: readonly Point[], px: number, py: number): number | null {
  const n = centers.length;
  if (n < 2) return null;
  const c = ringCenter(centers);
  const first = centers[0] as Point;
  const a0 = Math.atan2(first.y - c.y, first.x - c.x);
  const step = (2 * Math.PI) / n;
  const raw = Math.atan2(py - c.y, px - c.x) - a0;
  const delta = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.max(1, Math.min(n, Math.ceil(delta / step)));
}

/** Where the gap indicator sits: on the ring, at the seam angle for `gap`. */
export function ringGapPoint(centers: readonly Point[], gap: number): Point {
  const n = Math.max(1, centers.length);
  const c = ringCenter(centers);
  const first = centers[0] as Point;
  const a0 = Math.atan2(first.y - c.y, first.x - c.x);
  const radius = centers.reduce((a, p) => a + Math.hypot(p.x - c.x, p.y - c.y), 0) / n;
  const theta = a0 + (gap - 0.5) * ((2 * Math.PI) / n);
  return { x: c.x + radius * Math.cos(theta), y: c.y + radius * Math.sin(theta) };
}
