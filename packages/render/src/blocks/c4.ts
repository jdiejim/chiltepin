/**
 * Renders a C4 model diagram: system context, container and component
 * levels, and the dynamic view of any of them (relationships with a `step`).
 *
 * The notation follows the C4 model and the skin (`DESIGN.md`); the parts
 * live in `c4Parts.ts`:
 *
 * - every element shows its name, its bracketed type line
 *   (`[Container: Go, gRPC]`) and its description, which wraps and grows the
 *   cell — nothing is cut without a report;
 * - a person is a head over shoulders, a database a cylinder, a queue a
 *   pipe, a web front end a browser window, a mobile app a phone;
 * - hue is the category, anything outside the scope is neutral and dashed,
 *   and the system in scope of a context diagram takes the accent;
 * - each relationship is a one-way arrow whose label states the intent, with
 *   the technology in brackets on its own line;
 * - boundaries are dashed, rounded panels that name their scope and its
 *   type (`[Software System]`, `[Container]`, `[Enterprise]`);
 * - the key lists exactly the notation the diagram uses, and the eyebrow
 *   names the diagram type and its scope (`Container diagram · Payments`).
 *
 * Auto-layout (no `col`/`row`) puts the people on top, the scope in the
 * middle and its dependencies below or beside it (`c4Layout.ts`).
 *
 * A boundary never encloses an element that is not in it. Its panel is the
 * rectilinear hull of its elements' cells: every cell between them, minus
 * any cell another element takes (an L, or a ring around an external, when
 * the author's grid needs one). When the author's grid splits a boundary in
 * two, each part gets its own panel and the geometry report names the
 * element to move.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { geometryOf, type GeometryIssue, type GeometryReport } from '../svg/geometry.js';
import { cutTitle, fitText, FONT, textWidth, type Wrapped } from '../svg/wrapText.js';
import { SKIN_EDGE } from '../svg/blockStyle.js';
import { hueClass } from '../svg/hues.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, groupLabelBoxes, groupPanelRects, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { routeEdges } from '../svg/router.js';
import { LABEL_RUN } from '../svg/edgeSteps.js';
import { safeColor } from '../sanitize.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame, svgWidth } from './frame.js';
import { c4Grid } from './c4Layout.js';
import {
  c4Key,
  c4Labels,
  c4Look,
  c4Paint,
  portBox,
  relNeed,
  relText,
  separateBends,
  shapeInsets,
  shapeSvg,
  textArea,
  typeLine,
  type C4KeyItem,
  type C4Look,
  type C4RelLabel,
} from './c4Parts.js';

type Node = NonNullable<BlockDataMap['c4']['nodes']>[number];
type Level = 'context' | 'container' | 'component';

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One grid cell. */
interface Cell {
  readonly c: number;
  readonly r: number;
}

/** The cells an element takes (a `w` span covers several columns). */
const cellsOf = (n: { readonly col: number; readonly row: number; readonly w?: number | undefined }): Cell[] =>
  Array.from({ length: Math.max(1, n.w ?? 1) }, (_, k) => ({ c: n.col + k, r: n.row }));

const cellKey = (c: number, r: number): string => `${c},${r}`;

/**
 * The region a boundary's panel covers: every cell in the bounding box of
 * its members' cells, minus the cells other elements take, split into its
 * 4-connected parts (only parts holding a member are kept). Pure.
 */
export function boundaryCells(
  members: ReadonlyArray<{ readonly col: number; readonly row: number; readonly w?: number | undefined }>,
  others: ReadonlyArray<{ readonly col: number; readonly row: number; readonly w?: number | undefined }>,
): { parts: Cell[][]; inBox: number[] } {
  const mine = new Set(members.flatMap(cellsOf).map((x) => cellKey(x.c, x.r)));
  const all = members.flatMap(cellsOf);
  if (all.length === 0) return { parts: [], inBox: [] };
  const c0 = Math.min(...all.map((x) => x.c));
  const c1 = Math.max(...all.map((x) => x.c));
  const r0 = Math.min(...all.map((x) => x.r));
  const r1 = Math.max(...all.map((x) => x.r));
  const taken = new Set<string>();
  const inBox: number[] = [];
  others.forEach((o, i) => {
    let hit = false;
    for (const x of cellsOf(o)) {
      if (mine.has(cellKey(x.c, x.r))) continue;
      taken.add(cellKey(x.c, x.r));
      if (x.c >= c0 && x.c <= c1 && x.r >= r0 && x.r <= r1) hit = true;
    }
    if (hit) inBox.push(i);
  });
  const free = new Set<string>();
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (!taken.has(cellKey(c, r))) free.add(cellKey(c, r));
  const seen = new Set<string>();
  const parts: Cell[][] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const k0 = cellKey(c, r);
      if (!free.has(k0) || seen.has(k0)) continue;
      const part: Cell[] = [];
      const queue: Cell[] = [{ c, r }];
      seen.add(k0);
      while (queue.length > 0) {
        const cur = queue.shift() as Cell;
        part.push(cur);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = cellKey(cur.c + dc, cur.r + dr);
          if (!free.has(k) || seen.has(k)) continue;
          seen.add(k);
          queue.push({ c: cur.c + dc, r: cur.r + dr });
        }
      }
      if (part.some((x) => mine.has(cellKey(x.c, x.r)))) parts.push(part);
    }
  }
  return { parts, inBox };
}

/** A point of a panel outline. */
interface XY {
  readonly x: number;
  readonly y: number;
}

/** Where each side of a cell's panel edge sits, given the cell's column and row. */
interface PanelSides {
  readonly top: (r: number) => number;
  readonly bottom: (r: number) => number;
  readonly left: (c: number) => number;
  readonly right: (c: number) => number;
}

/**
 * The outline loops of a set of cells: the boundary edges of the cells,
 * chained clockwise (a hole runs the other way), collinear runs merged, each
 * side placed by `sides`. At a pinch (two cells touching only at a corner)
 * the walk turns right, so each part closes on its own.
 */
export function cellOutline(cells: readonly Cell[], sides: PanelSides): XY[][] {
  const has = new Set(cells.map((x) => cellKey(x.c, x.r)));
  type Side = 'T' | 'R' | 'B' | 'L';
  interface Edge {
    readonly a: readonly [number, number];
    readonly b: readonly [number, number];
    readonly side: Side;
    /** The x (L / R) or y (T / B) the edge is drawn at. */
    readonly at: number;
  }
  const edges: Edge[] = [];
  for (const { c, r } of cells) {
    if (!has.has(cellKey(c, r - 1))) edges.push({ a: [c - 1, r - 1], b: [c, r - 1], side: 'T', at: sides.top(r) });
    if (!has.has(cellKey(c + 1, r))) edges.push({ a: [c, r - 1], b: [c, r], side: 'R', at: sides.right(c) });
    if (!has.has(cellKey(c, r + 1))) edges.push({ a: [c, r], b: [c - 1, r], side: 'B', at: sides.bottom(r) });
    if (!has.has(cellKey(c - 1, r))) edges.push({ a: [c - 1, r], b: [c - 1, r - 1], side: 'L', at: sides.left(c) });
  }
  const outOf = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = cellKey(e.a[0], e.a[1]);
    const list = outOf.get(k) ?? [];
    list.push(e);
    outOf.set(k, list);
  }
  const dirOf = (e: Edge): readonly [number, number] => [e.b[0] - e.a[0], e.b[1] - e.a[1]];
  const used = new Set<Edge>();
  const loops: XY[][] = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: Edge[] = [];
    let e: Edge | undefined = start;
    while (e !== undefined && !used.has(e)) {
      used.add(e);
      loop.push(e);
      const [dx, dy] = dirOf(e);
      const next: Edge[] = (outOf.get(cellKey(e.b[0], e.b[1])) ?? []).filter((n) => !used.has(n));
      // Right turn first (y down: right of (dx, dy) is (-dy, dx)), then straight, then left.
      const rank = (n: Edge): number => {
        const [nx, ny] = dirOf(n);
        if (nx === -dy && ny === dx) return 0;
        if (nx === dx && ny === dy) return 1;
        return 2;
      };
      e = next.sort((p, q) => rank(p) - rank(q))[0];
    }
    // Merge collinear runs, then place each corner where its two sides meet.
    const runs: Edge[] = [];
    for (const x of loop) {
      const last = runs[runs.length - 1];
      if (last !== undefined && last.side === x.side) continue;
      runs.push(x);
    }
    const first = runs[0];
    const tail = runs[runs.length - 1];
    if (runs.length > 1 && first !== undefined && tail !== undefined && first.side === tail.side) runs.pop();
    const vertical = (x: Edge): boolean => x.side === 'L' || x.side === 'R';
    const pts: XY[] = [];
    runs.forEach((x, i) => {
      const prev = runs[(i - 1 + runs.length) % runs.length] as Edge;
      // The corner where `prev` ends and `x` starts.
      pts.push(vertical(x) ? { x: x.at, y: prev.at } : { x: prev.at, y: x.at });
    });
    if (pts.length >= 4) loops.push(pts);
  }
  return loops;
}

/** A closed path through `pts` with corners rounded by up to `radius`. */
function roundedLoop(pts: readonly XY[], radius: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n] as XY;
    const c = pts[i] as XY;
    const q = pts[(i + 1) % n] as XY;
    const lp = Math.hypot(c.x - p.x, c.y - p.y);
    const lq = Math.hypot(q.x - c.x, q.y - c.y);
    const rr = Math.min(radius, lp / 2, lq / 2);
    const a = { x: c.x + ((p.x - c.x) * rr) / (lp || 1), y: c.y + ((p.y - c.y) * rr) / (lp || 1) };
    const b = { x: c.x + ((q.x - c.x) * rr) / (lq || 1), y: c.y + ((q.y - c.y) * rr) / (lq || 1) };
    d += `${i === 0 ? 'M' : 'L'}${rnd(a.x)} ${rnd(a.y)} Q${rnd(c.x)} ${rnd(c.y)} ${rnd(b.x)} ${rnd(b.y)} `;
  }
  return `${d}Z`;
}

const rnd = (v: number): number => Math.round(v * 10) / 10;

/** The level a diagram draws: the author's, else the deepest kind it holds. */
export function c4Level(data: BlockDataMap['c4']): Level {
  if (data.level !== undefined) return data.level;
  const kinds = new Set((data.nodes ?? []).map((n) => n.kind));
  if (kinds.has('component')) return 'component';
  if (kinds.has('container') || (kinds.has('store') && data.boundary !== undefined)) return 'container';
  return 'context';
}

/** True when an element is outside the scope by its `family`. */
const isExternalFamily = (n: Node): boolean => (n.family ?? '').trim().toLowerCase() === 'external';

/**
 * The elements the single `boundary` encloses: the systems of a context
 * diagram (an enterprise boundary), the containers and stores of a
 * container diagram, the components of a component diagram. An element
 * whose `family` is `external` stays outside.
 */
function enclosed(n: Node, level: Level): boolean {
  if (isExternalFamily(n)) return false;
  if (level === 'component') return n.kind === 'component';
  if (level === 'container') return n.kind === 'container' || n.kind === 'store';
  return n.kind === 'system';
}

/** The type a boundary names at a level: what it is the scope of. */
function boundaryType(level: Level): string {
  if (level === 'component') return 'Container';
  if (level === 'container') return 'Software System';
  return 'Enterprise';
}

/** The diagram type the eyebrow names. */
function diagramWord(level: Level, dynamic: boolean): string {
  if (dynamic) return 'Dynamic diagram';
  if (level === 'component') return 'Component diagram';
  if (level === 'container') return 'Container diagram';
  return 'System context';
}

export function renderC4(data: BlockDataMap['c4']): string {
  return fitC4(data).html;
}

/** Geometry report for a `c4` block (see `geometryReport`). */
export function c4Geometry(data: BlockDataMap['c4']): GeometryReport {
  return fitC4(data).geometry;
}

/**
 * The room a boundary's side takes in a gap: the panel overshoots its cells
 * by 16 px, and a label keeps 6 px off the border on either side.
 */
const BORDER_ROOM = 16 + 2 * 6;

/** The widest drawing auto-layout keeps before it tries the other direction (the wide-stage width). */
const FIT_W = 1600;

/**
 * Lays out a `c4` block. Auto-layout runs top to bottom (people on top); a
 * drawing wider than the stage tries left to right and keeps the narrower.
 * An explicit `dir`, or a grid the author placed, always wins.
 */
function fitC4(data: BlockDataMap['c4']): { html: string; geometry: GeometryReport } {
  const nodes = data.nodes ?? [];
  const placed = nodes.length > 0 && nodes.every((n) => n.col !== undefined && n.row !== undefined);
  if (placed || data.dir !== undefined) return roomyHeads(data, data.dir ?? (placed ? 'LR' : 'TB'));
  const tb = roomyHeads(data, 'TB');
  const wTB = svgWidth(tb.html);
  if (wTB <= FIT_W) return tb;
  const lr = roomyHeads(data, 'LR');
  return svgWidth(lr.html) < wTB ? lr : tb;
}

/**
 * Lays out in one direction. When an arrow crosses a boundary's head band
 * where its label would sit and no stretch of the band is wide enough, the
 * layout runs again with that label's name wrapped to the widest free
 * stretch, so the arrow keeps its straight line and the label stays clear.
 */
function roomyHeads(data: BlockDataMap['c4'], dir: 'LR' | 'TB'): { html: string; geometry: GeometryReport } {
  const first = layoutC4(data, dir);
  if (first.cramped.size === 0) return first;
  const again = layoutC4(data, dir, first.cramped);
  return again.cramped.size <= first.cramped.size ? again : first;
}

/** One element's text, fitted to its shape. */
interface ElementText {
  readonly name: Wrapped;
  readonly type: Wrapped;
  readonly desc: Wrapped | undefined;
  /** Height of the stacked text block (px). */
  readonly h: number;
}

/** Line pitch of a name, a type line and a description line (px). */
const NAME_LH = 16;
const TYPE_LH = 12;
const DESC_LH = 14;
/** Gap between the name and the type line, and between the type line and the description. */
const GAP_TYPE = 3;
const GAP_DESC = 7;
/** The description's font: 11px Inter (`.c4-desc`). */
const DESC_FONT = FONT.small;

/** The height of a text block with these line counts. */
const blockH = (name: number, type: number, desc: number): number =>
  name * NAME_LH + GAP_TYPE + type * TYPE_LH + (desc > 0 ? GAP_DESC + desc * DESC_LH : 0);

/** Lays out and draws a `c4` block in one direction: the framed HTML plus its geometry report. */
function layoutC4(
  data: BlockDataMap['c4'],
  dir: 'LR' | 'TB',
  narrow?: ReadonlyMap<string, number>,
): { html: string; geometry: GeometryReport; cramped: Map<string, number> } {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const level = c4Level(data);
  const dynamic = edges.some((e) => e.step !== undefined);
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));

  // The scope auto-layout keeps together: the single boundary's elements,
  // else the first named boundary's.
  const named = data.boundaries ?? [];
  const scope = new Set<string>(
    data.boundary !== undefined
      ? rawNodes.filter((n) => enclosed(n, level)).map((n) => n.id)
      : (named[0]?.nodes ?? []),
  );
  const grid = quick ? c4Grid(rawNodes, edges, scope, dir) : undefined;
  const nodes = rawNodes.map((n) => {
    const at = grid?.get(n.id);
    return { ...n, col: at?.col ?? n.col ?? 1, row: at?.row ?? n.row ?? 1 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // ── element text and the cell size ──────────────────────────────────────
  const cellW = 212;
  const looks: C4Look[] = nodes.map((n) => c4Look(n));
  const nodeW = (n: (typeof nodes)[number]): number => (n.w ?? 1) * cellW;
  const texts: ElementText[] = nodes.map((n, i) => {
    const look = looks[i] as C4Look;
    const room = textArea(look.shape, { x: 0, y: 0, w: nodeW(n), h: 0 }).w;
    const name = fitText(n.name, { width: room, font: FONT.name, maxLines: 3, report: { owner: n.name, field: 'name', path: `nodes.${i}.name` } });
    const type = fitText(typeLine(look, n.tech), {
      width: room,
      font: FONT.sub,
      maxLines: 3,
      report: { owner: n.name, field: 'tech', path: `nodes.${i}.tech` },
    });
    const desc =
      n.desc !== undefined && n.desc.trim() !== ''
        ? fitText(n.desc, {
            width: room,
            font: DESC_FONT,
            maxLines: 7,
            report: { owner: n.name, field: 'desc', path: `nodes.${i}.desc`, hint: 'Shorten the description, or move the detail into the prose under the diagram.' },
          })
        : undefined;
    return { name, type, desc, h: blockH(name.lines.length, type.lines.length, desc?.lines.length ?? 0) };
  });
  const cellH = Math.max(
    96,
    ...nodes.map((_, i) => {
      const ins = shapeInsets((looks[i] as C4Look).shape);
      return Math.ceil(ins.top + (texts[i]?.h ?? 0) + ins.bottom);
    }),
  );

  // ── relationship labels and the gaps between cells ──────────────────────
  const rels: C4RelLabel[] = edges.map((e, ei) => ({
    label: e.label,
    tech: e.tech,
    step: e.step,
    err: (SKIN_EDGE[e.kind ?? 'solid'] ?? SKIN_EDGE['solid'])?.err === true,
    path: `edges.${ei}`,
  }));
  let gapX = 64;
  let gapY = 64;
  // The boundaries each element sits in: an arrow that crosses a boundary's
  // side needs room for its label beside the border, not on it.
  const panelSets = [
    ...(data.boundary !== undefined ? [new Set(nodes.filter((n) => enclosed(n, level)).map((n) => n.id))] : []),
    ...named.map((b) => new Set(b.nodes)),
  ];
  const crossesBorder = (a: string, b: string): boolean => panelSets.some((set) => set.has(a) !== set.has(b));
  // Two relationships between one pair (two steps of a dynamic view) run
  // side by side, so their labels share one gap: their needs add up.
  const pairKey = (e: { from: string; to: string }): string => [e.from, e.to].sort().join('\u0000');
  const shared = new Map<string, { w: number; h: number }>();
  edges.forEach((e, ei) => {
    const n = relNeed(rels[ei] as C4RelLabel);
    if (n.w === 0) return;
    const k = pairKey(e);
    const prev = shared.get(k);
    shared.set(k, prev === undefined ? n : { w: prev.w + n.w - LABEL_RUN, h: prev.h + n.h - LABEL_RUN });
  });
  edges.forEach((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (a === undefined || b === undefined || e.from === e.to) return;
    const base = shared.get(pairKey(e));
    if (base === undefined) return;
    const border = crossesBorder(e.from, e.to) ? BORDER_ROOM : 0;
    const need = { w: base.w + border, h: base.h + border };
    const aEnd = a.col + (a.w ?? 1) - 1;
    const bEnd = b.col + (b.w ?? 1) - 1;
    const colStep = b.col > aEnd ? b.col - aEnd : a.col > bEnd ? a.col - bEnd : 0;
    const rowStep = Math.abs(a.row - b.row);
    // A label rides the straight run between two cells, or the run across
    // the gap an elbow takes (the gap between rows top to bottom).
    if (rowStep === 0 && colStep === 1) gapX = Math.max(gapX, need.w);
    else if (colStep === 0 && rowStep === 1) gapY = Math.max(gapY, need.h);
    else if (rowStep > 0 && colStep > 0) {
      if (dir === 'TB') gapY = Math.max(gapY, need.h);
      else gapX = Math.max(gapX, need.w);
    }
  });

  // ── boundaries: their members, label and head room ─────────────────────
  interface Panel {
    readonly members: ReadonlyArray<(typeof nodes)[number]>;
    readonly label: string;
    readonly color: string | undefined;
    readonly path: string;
  }
  const panels: Panel[] = [];
  if (data.boundary !== undefined) {
    panels.push({ members: nodes.filter((n) => enclosed(n, level)), label: data.boundary.label, color: undefined, path: 'boundary' });
  }
  named.forEach((b, bi) => {
    const members = b.nodes.map((id) => byId.get(id)).filter((n): n is NonNullable<typeof n> => n !== undefined);
    panels.push({ members, label: b.label, color: b.color, path: `boundaries.${bi}` });
  });
  const bType = `[${boundaryType(level)}]`;
  const typeW = textWidth(bType, FONT.sub);
  /**
   * A boundary panel's label: the name (≤ 2 lines, or ≤ 3 when an arrow
   * leaves it a narrow stretch) over the type, as C4 tools set it.
   */
  const panelHead = (p: Panel): { name: Wrapped; w: number; h: number } => {
    const cols = p.members.map((n) => [n.col, n.col + (n.w ?? 1) - 1]).flat();
    const span = cols.length > 0 ? Math.max(...cols) - Math.min(...cols) + 1 : 1;
    const tight = narrow?.get(p.path);
    const room = tight ?? span * cellW + (span - 1) * gapX + 32 - 24;
    const name = fitText(p.label, {
      width: room,
      font: FONT.name,
      maxLines: tight !== undefined ? 3 : 2,
      report: { owner: p.label, field: 'label', path: `${p.path}.label` },
    });
    const nameW = Math.max(0, ...name.lines.map((ln) => textWidth(ln, FONT.name)));
    return { name, w: Math.ceil(Math.max(nameW, typeW)) + 8, h: 14 + name.lines.length * NAME_LH + TYPE_LH + 2 };
  };
  const heads = panels.map((p) => (p.members.length > 0 ? panelHead(p) : undefined));
  const headRoom = Math.max(0, ...heads.map((h) => h?.h ?? 0));
  // A boundary's head takes room in the gap above its top row.
  if (headRoom > 0) gapY += headRoom;

  // ── the grid ────────────────────────────────────────────────────────────
  const groups = data.groups ?? [];
  const nestPad = nestingPads(groups);
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 26) + nestPad.padX;
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : headRoom > 0 ? headRoom + 18 : 24) + nestPad.padTop;
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 26) + nestPad.padBot;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)), groups.length > 0 ? gx.cols : 1);
  const rows = Math.max(1, ...nodes.map((n) => n.row), groups.length > 0 ? gx.rows : 1);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: (typeof nodes)[number]): Rect => ({
    x: xOf(n.col),
    y: yOf(n.row),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // The accent: the one system in scope of a context diagram.
  const systems = nodes.filter((n) => n.kind === 'system' && !isExternalFamily(n));
  const accentId = level === 'context' && systems.length === 1 ? systems[0]?.id : undefined;

  // ── boundary panels: outlines first, labels once the routes are known ───
  const panelRects: Rect[] = [];
  const boundaryIssues: GeometryIssue[] = [];
  const sides: PanelSides = {
    top: (r) => yOf(r) - headRoom,
    bottom: (r) => yOf(r) + cellH + 16,
    left: (c) => xOf(c) - 16,
    right: (c) => xOf(c) + cellW + 16,
  };
  /** One drawn part of a boundary: its outline and the top edge its label rides. */
  interface PanelPart {
    readonly panel: Panel;
    readonly head: ReturnType<typeof panelHead>;
    readonly d: string;
    readonly top: { readonly x0: number; readonly x1: number; readonly y: number } | undefined;
  }
  const parts: PanelPart[] = [];
  panels.forEach((p, pi) => {
    const head = heads[pi];
    if (head === undefined) return;
    const others = nodes.filter((n) => !p.members.includes(n));
    const hull = boundaryCells(p.members, others);
    if (hull.parts.length > 1) {
      const names = hull.inBox.map((i) => `"${others[i]?.name ?? ''}"`).join(', ');
      const first = others[hull.inBox[0] ?? 0]?.name ?? '';
      boundaryIssues.push({
        kind: 'boundary-encloses',
        path: p.path,
        message: `The boundary "${p.label}" cannot enclose its elements without enclosing ${names}; it is drawn in ${hull.parts.length} parts.`,
        hint: `Move "${first}" to an outer column, outside the boundary's elements, or move the boundary's elements next to each other.`,
      });
    }
    for (const cells of hull.parts) {
      const loops = cellOutline(cells, sides);
      if (loops.length === 0) continue;
      let top: { x0: number; x1: number; y: number } | undefined;
      for (const loop of loops) {
        loop.forEach((pt, i) => {
          const q = loop[(i + 1) % loop.length] as XY;
          panelRects.push({ x: Math.min(pt.x, q.x), y: Math.min(pt.y, q.y), w: Math.abs(q.x - pt.x), h: Math.abs(q.y - pt.y) });
          // The label rides the topmost (then leftmost) top edge of the outline.
          if (pt.y !== q.y || q.x <= pt.x) return;
          if (top === undefined || pt.y < top.y || (pt.y === top.y && pt.x < top.x0)) top = { x0: pt.x, x1: q.x, y: pt.y };
        });
      }
      parts.push({ panel: p, head, d: loops.map((l) => roundedLoop(l, 10)).join(' '), top });
    }
  });

  // ── groups, then the frame of the svg ───────────────────────────────────
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const groupsSvg =
    groups.length > 0
      ? gridGroupsSvg(groups, {
          xOf,
          yOf,
          cellW,
          cellH,
          gapX,
          gapY,
          skin: true,
          members: nodes.map((n, i) => ({ col: n.col, row: n.row, hue: (looks[i] as C4Look).hue })),
        })
      : '';
  const a11y = svgName('C4 diagram', data.title, [countPhrase(nodes.length, 'element'), countPhrase(edges.length, 'relationship')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}${groupsSvg}`;

  // ── relationships ───────────────────────────────────────────────────────
  const bounds = { x: 0, y: 0, w: width, h: height };
  const geo = { xOf, yOf, cellW, cellH, gapX, gapY };
  const routed = separateBends(routeEdges(
    nodes.map((n, i) => {
      const r = rectFor(n);
      const shape = (looks[i] as C4Look).shape;
      return { id: n.id, box: portBox(shape, r), obstacle: r, radius: shape === 'person' ? 20 : shape === 'phone' ? 16 : 6 };
    }),
    edges,
    {
      dir,
      bounds,
      obstacles: groupLabelBoxes(groups, geo),
      rails: [...panelRects, ...groupPanelRects(groups, geo)],
      backEdges: 'direct',
    },
  ), nodes.map((n) => rectFor(n)));

  // Each boundary label takes the leftmost stretch of its head band that no
  // arrow crosses, so an arrow into the boundary runs straight.
  const panelLabels: Rect[] = [];
  const cramped = new Map<string, number>();
  for (const part of parts) {
    if (part.top === undefined) continue;
    const { top, head } = part;
    const band = { y0: top.y, y1: top.y + head.h };
    const at = freeStretch(routed, band, top.x0 + 8, top.x1 - 8, head.w);
    if (!at.fits && at.widest >= MIN_HEAD_ROOM + 8) cramped.set(part.panel.path, at.widest - 8);
    panelLabels.push({ x: at.x, y: top.y + 6, w: head.w, h: head.h - 8 });
  }
  let labelAt = 0;
  for (const part of parts) {
    const tint = safeColor(part.panel.color, '');
    const stroke = tint.length > 0 ? tint : 'var(--muted)';
    let labels = '';
    if (part.top !== undefined) {
      const box = panelLabels[labelAt++] as Rect;
      const { head } = part;
      const ty0 = part.top.y;
      const x = box.x + 4;
      const nameTone = tint.length > 0 ? ` fill="${tint}"` : '';
      head.name.lines.forEach((ln, j) => {
        labels += `<text x="${x}" y="${ty0 + 21 + j * NAME_LH}" class="t-name"${nameTone}>${cutTitle(head.name)}${escapeHtml(ln)}</text>`;
      });
      const ty = ty0 + 21 + (head.name.lines.length - 1) * NAME_LH + TYPE_LH + 2;
      labels += `<text x="${x}" y="${ty}" class="t-sub c-soft">${escapeHtml(bType)}</text>`;
    }
    s +=
      `<g${bp(part.panel.path)}>` +
      `<path d="${part.d}" fill="var(--paper-2)" fill-opacity="0.45" fill-rule="evenodd" stroke="${stroke}" stroke-width="1.25" stroke-dasharray="7 4"/>` +
      labels +
      `</g>`;
  }
  const layer = c4Labels(routed, rels, {
    avoid: [...nodes.map((n) => rectFor(n)), ...panelLabels],
    obstacles: [...nodes.map((n) => rectFor(n)), ...panelLabels],
    bounds,
    rails: [...panelRects, ...groupPanelRects(groups, geo)],
  });
  const routes = layer.routes;
  const edgeKinds = new Set<string>();
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    edgeKinds.add(e.kind ?? 'solid');
    const st = SKIN_EDGE[e.kind ?? 'solid'] ?? (SKIN_EDGE['solid'] as NonNullable<(typeof SKIN_EDGE)[string]>);
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"${dash} marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`;

  // ── elements ────────────────────────────────────────────────────────────
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const look = looks[ni] as C4Look;
    const t = texts[ni] as ElementText;
    const accent = n.id === accentId;
    const paint = c4Paint(look, accent);
    const area = textArea(look.shape, r);
    const cx = Math.round(area.x + area.w / 2);
    // The text block sits in the middle of the shape's text area.
    const top = area.y + Math.max(0, (area.h - t.h) / 2);
    // The type line is the element's chip: it takes the category hue (the
    // focal element's name already carries the accent; outside the scope it is `soft`).
    const sub = look.external ? ' c-soft' : accent || look.hue === undefined ? ' c-muted' : hueClass(look.hue);
    let y = top;
    let text = '';
    t.name.lines.forEach((ln, j) => {
      text += `<text x="${cx}" y="${rnd(y + 12 + j * NAME_LH)}" class="t-name${accent ? ' c-accent' : ''}" text-anchor="middle">${cutTitle(t.name)}${escapeHtml(ln)}</text>`;
    });
    y += t.name.lines.length * NAME_LH + GAP_TYPE;
    t.type.lines.forEach((ln, j) => {
      text += `<text x="${cx}" y="${rnd(y + 9 + j * TYPE_LH)}" class="t-sub${sub}" text-anchor="middle">${cutTitle(t.type)}${escapeHtml(ln)}</text>`;
    });
    y += t.type.lines.length * TYPE_LH;
    if (t.desc !== undefined) {
      y += GAP_DESC;
      const desc = t.desc;
      desc.lines.forEach((ln, j) => {
        text += `<text x="${cx}" y="${rnd(y + 10.5 + j * DESC_LH)}" class="c4-desc" text-anchor="middle">${escapeHtml(ln)}</text>`;
      });
    }
    // A cut description keeps its whole text as the element's hover title.
    const title = t.desc !== undefined ? cutTitle(t.desc) : '';
    s +=
      `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)} data-c4="${look.shape}">` +
      title +
      shapeSvg(look.shape, r, paint) +
      text +
      `</g>`;
  });
  s += `</g>`;
  s += layer.overlay;
  s += `</svg>`;

  const base = geometryOf({
    nodeWord: 'element',
    edgeWord: 'relationship',
    nodes: nodes.map((n, ni) => ({ id: n.id, name: n.name, path: `nodes.${ni}`, col: n.col, row: n.row, w: n.w })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: relText(rels[ei] as C4RelLabel), path: `edges.${ei}` })),
    routes,
    fallbacks: layer.fallbacks,
    labelBoxes: layer.boxes,
    nodeBoxes: nodes.map((n) => rectFor(n)),
    quick,
    dir,
  });
  const geometry = boundaryIssues.length > 0 ? { ...base, issues: [...base.issues, ...boundaryIssues] } : base;

  const key = c4Key(keyItems(nodes, looks, accentId, panels.length > 0 ? boundaryType(level) : undefined, edgeKinds, dynamic));
  const scopeName =
    data.boundary?.label ?? named[0]?.label ?? (accentId !== undefined ? byId.get(accentId)?.name : undefined);
  const html = diagramFrame(
    {
      tag: `${diagramWord(level, dynamic)}${scopeName !== undefined && scopeName.trim() !== '' ? ` · ${scopeName.trim()}` : ''}`,
      tagClass: 'c4',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(key.length > 0 ? { legendHtml: key } : {}),
    },
    s + layer.list,
  );
  return { html, geometry, cramped };
}

/**
 * The leftmost x in [`x0`, `x1` − `w`] where a box `w` wide in the band
 * `y0`..`y1` crosses no route; `x0` when every stretch is crossed.
 */
function freeStretch(
  routes: ReadonlyArray<{ readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }> } | undefined>,
  band: { readonly y0: number; readonly y1: number },
  x0: number,
  x1: number,
  w: number,
): { x: number; fits: boolean; widest: number } {
  const blocked: Array<[number, number]> = [];
  for (const r of routes) {
    const pts = r?.points ?? [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k] as { x: number; y: number };
      const q = pts[k + 1] as { x: number; y: number };
      if (Math.max(p.y, q.y) < band.y0 || Math.min(p.y, q.y) > band.y1) continue;
      blocked.push([Math.min(p.x, q.x) - 8, Math.max(p.x, q.x) + 8]);
    }
  }
  const free = (x: number, width: number): boolean => !blocked.some(([a, b]) => a < x + width && x < b);
  const starts = [x0, ...blocked.map(([, b]) => b)].filter((x) => x >= x0 && x < x1).sort((a, b) => a - b);
  for (const x of starts) if (x + w <= x1 && free(x, w)) return { x: Math.round(x), fits: true, widest: w };
  // The widest stretch no arrow crosses, from the left.
  let widest = 0;
  let at = x0;
  for (const x of starts) {
    const ends = [x1, ...blocked.map(([a]) => a).filter((a) => a > x)];
    const room = Math.min(...ends) - x;
    if (free(x, room) && room > widest) {
      widest = room;
      at = x;
    }
  }
  return { x: Math.round(widest >= MIN_HEAD_ROOM + 8 ? at : x0), fits: false, widest };
}

/** The narrowest stretch a boundary label is wrapped into (px). */
const MIN_HEAD_ROOM = 56;

/** The key's word for an element of this look. */
function keyLabel(look: C4Look, kind: string): string {
  if (look.shape === 'person') return look.external ? 'external person' : 'person';
  if (look.external) return kind === 'external' || kind === 'system' ? 'external system' : `external ${look.type.toLowerCase()}`;
  if (look.shape === 'cylinder') return 'database';
  if (look.shape === 'pipe') return 'queue';
  if (look.shape === 'browser') return 'web front end';
  if (look.shape === 'phone') return 'mobile app';
  return look.type.toLowerCase();
}

/**
 * The key: one entry per element notation in use (shape, category, scope),
 * in the order a reader meets them, then the boundary, the line styles and
 * the step numeral. Two elements under one word with different hues share
 * a neutral swatch: no single hue stands for that word.
 */
function keyItems(
  nodes: ReadonlyArray<Node>,
  looks: readonly C4Look[],
  accentId: string | undefined,
  boundary: string | undefined,
  edgeKinds: ReadonlySet<string>,
  dynamic: boolean,
): C4KeyItem[] {
  const RANK: Record<string, number> = { person: 0, box: 1, browser: 2, phone: 3, cylinder: 4, pipe: 5 };
  const entries = new Map<string, { item: C4KeyItem; order: number }>();
  nodes.forEach((n, i) => {
    const look = looks[i] as C4Look;
    const accent = n.id === accentId;
    const label = accent ? 'system in scope' : keyLabel(look, n.kind);
    const paint = c4Paint(look, accent);
    const order = (accent ? -0.5 : 0) + (look.external ? 10 : 0) + (RANK[look.shape] ?? 1) + (look.type === 'Component' ? 0.2 : 0);
    const seen = entries.get(label);
    if (seen === undefined) {
      entries.set(label, { item: { swatch: look.shape, label, paint, hue: look.hue }, order });
    } else if (seen.item.paint?.fill !== paint.fill) {
      entries.set(label, { item: { swatch: look.shape, label, paint: { ...paint, fill: 'var(--paper)' } }, order: seen.order });
    }
  });
  const items = [...entries.values()].sort((a, b) => a.order - b.order).map((e) => e.item);
  if (boundary !== undefined) items.push({ swatch: 'boundary', label: `${boundary.toLowerCase()} boundary` });
  if (edgeKinds.has('solid')) items.push({ swatch: 'edge', label: 'uses' });
  if (edgeKinds.has('dashed')) items.push({ swatch: 'edge-dashed', label: 'async' });
  if (edgeKinds.has('forbidden')) items.push({ swatch: 'edge-forbidden', label: 'forbidden' });
  if (edgeKinds.has('error')) items.push({ swatch: 'edge-error', label: 'error' });
  if (dynamic) items.push({ swatch: 'step', label: 'step in the scenario' });
  return items;
}
