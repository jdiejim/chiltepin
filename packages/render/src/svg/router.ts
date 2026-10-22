/**
 * Obstacle-aware orthogonal edge router, shared by the grid diagram renderers
 * (flow, block, c4, dfd, state, …).
 *
 * The router never draws: it turns node boxes and an edge list into polylines.
 * Geometry is derived from the data, so the same input always gives the same
 * integer coordinates.
 *
 * How it works:
 *
 * 1. **Grid.** Candidate lines run along every node side pushed out by a
 *    clearance (`hug` lines), through the centre of every channel between
 *    nodes, on parallel tracks either side of that centre, and through every
 *    port. Their intersections form a sparse orthogonal visibility graph; a
 *    point or segment inside a node (plus clearance) is blocked.
 * 2. **Sides (pass 1).** Each edge runs an A* search that may leave and enter
 *    any side. A side that faces away from the other end costs more; an edge
 *    against the flow (a back edge) prefers the sides across the flow, so it
 *    loops around the row or column instead of retracing the forward edge.
 *    Crossing a route already chosen costs extra, so a long edge picks the
 *    sides that go around a bundle instead of through it (up to
 *    {@link CAREFUL_EDGES} edges).
 * 3. **Ports.** Edges that share a node side spread along it in bundle order:
 *    walk the routes outward together; where they part, the one that turns
 *    left keeps left (the usual rule of orthogonal connector routers), so a
 *    fan-out leaves its node without crossing. A side with one edge lines up
 *    with the other end when the two face each other.
 * 4. **Routes (pass 2).** A* again, sides fixed, with a cost of length + bends
 *    + line preference (channel centre over hugging a node) + a penalty for
 *    running on, or right beside, a route already placed + a penalty per
 *    crossing. Edges are routed shortest first, in a stable order.
 * 5. **Nudge.** Interior segments that still share a channel move apart in
 *    {@link TRACK}px steps, never into a node.
 * 6. **Untangle.** Where two routes cross next to a channel they share, the
 *    two parallel segments swap lines (or one steps past the other) when that
 *    removes crossings — the channel order follows where each route turns off.
 * 7. **Second round.** When pass 2 took other ways than pass 1, the ports are
 *    ordered again by the routes pass 2 took and steps 4–6 run once more; the
 *    result with fewer crossings wins (up to {@link CAREFUL_EDGES} edges).
 *
 * A route that cannot avoid a node still completes (blocked steps are very
 * expensive, not forbidden) and names the node in `through`, so a geometry
 * report can tell the author.
 */

import type { Box } from './ortho.js';

/** Flow direction of a diagram: ranks run left-to-right or top-to-bottom. */
export type FlowDir = 'LR' | 'TB';

/** A node side. */
export type Side = 'L' | 'R' | 'T' | 'B';

/** The outline an arrow tip attaches to. */
export type PortShape = 'rect' | 'round' | 'diamond';

/** An integer point. */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** One node the router routes between and around. */
export interface RouteNode {
  readonly id: string;
  /** The outline arrows attach to (the visible shape's box). */
  readonly box: Box;
  /** The area edges keep clear of; defaults to `box`. */
  readonly obstacle?: Box | undefined;
  /** `round` = stadium / circle ends, `diamond` = decision. Default `rect`. */
  readonly shape?: PortShape | undefined;
  /** Corner radius of a `rect`: ports keep off the rounded corners. */
  readonly radius?: number | undefined;
  /**
   * A container other routes may cross (a parent package around its
   * children): edges attach to it, but it is not an obstacle.
   */
  readonly passable?: boolean | undefined;
}

/** One edge to route. */
export interface RouteEdge {
  readonly from: string;
  readonly to: string;
}

/** Router options. */
export interface RouterOptions {
  /** The diagram's flow direction (back edges are the ones against it). */
  readonly dir: FlowDir;
  /** The drawing area; every route stays inside it. */
  readonly bounds: Box;
  /** Distance a route keeps from any node (px). Default {@link CLEAR}. */
  readonly clearance?: number;
  /** Extra keep-out boxes (group tabs, captions) that are not nodes. */
  readonly obstacles?: readonly Box[];
  /**
   * Group / boundary panels. A route may cross a panel border but avoids
   * running along one, where it would read as part of the panel.
   */
  readonly rails?: readonly Box[];
  /**
   * `loop` (default): an edge against the flow leaves and enters across the
   * flow, so it loops around the row instead of retracing the forward edge.
   * `direct`: such an edge takes the facing sides like any other edge.
   */
  readonly backEdges?: 'loop' | 'direct';
}

/** One routed edge. */
export interface RoutedEdge {
  /** The polyline from the source outline to the target outline (integers). */
  readonly points: readonly Pt[];
  /** SVG path data for `points`, with small rounded corners. */
  readonly d: string;
  /** Exit side of the source. */
  readonly exit: Side;
  /** Entry side of the target. */
  readonly entry: Side;
  /** Ids of the nodes the route was forced through (empty when clean). */
  readonly through: readonly string[];
}

/** Default clearance between a route and any node (px). */
export const CLEAR = 12;
/** Spacing between parallel tracks in one channel (px). */
export const TRACK = 8;
/** Corner radius of a route bend (px). */
const RADIUS = 5;
/** Tracks either side of a channel centre. */
const MAX_TRACKS = 3;
/** Spacing between ports that share one side (px). */
const PORT_STEP = 20;
/** Keep ports this far from a side's corners (px). */
const PORT_MARGIN = 8;

// Cost model (units: px of route length).
const BEND = 36;
const OVERLAP = 3;
/** Fixed cost of each piece of route laid on top of another (lines merge). */
const OVERLAP_FIXED = 80;
const NEAR = 1.5;
const CROSS = 25;
/**
 * Pass 1 (sides): crossing a route already chosen costs this much, so a long
 * edge takes the sides that loop around a bundle instead of cutting it.
 */
const CROSS_SIDES = 60;
const BLOCKED = 20000;
const SIDE_LEVEL = 30;
const SIDE_AWAY = 90;
const SIDE_CROSS_FLOW = 10;
const BACK_FACING = 250;
/** Heuristic weight of the second pass: a little greedy, much faster when routes crowd. */
const PASS2_WEIGHT = 1.5;
/** Expansions a search may spend before it reruns greedily. */
const SEARCH_BUDGET = 3000;
/** Heuristic weight of the greedy rerun. */
const GREEDY_WEIGHT = 6;
/** Per px of route running along a panel border. */
const RAIL = 1.5;
/** A route this close to a panel border runs along it (px). */
const RAIL_NEAR = 8;

// Per-px line preference: route down channel centres, not along node sides.
const W_CENTRE = 0;
const W_PORT = 0.05;
const W_TRACK = 0.06;
const W_HUG = 0.35;
const W_RING = 0.6;

const SIDES: readonly Side[] = ['L', 'R', 'T', 'B'];

/** Direction codes: 0 = +x, 1 = −x, 2 = +y, 3 = −y. Reverse of `d` is `d ^ 1`. */
type Dir = 0 | 1 | 2 | 3;

/** The direction pointing out of a side. */
function outward(s: Side): Dir {
  return s === 'R' ? 0 : s === 'L' ? 1 : s === 'B' ? 2 : 3;
}

const horizontalSide = (s: Side): boolean => s === 'L' || s === 'R';

/* ------------------------------------------------------------------------ */
/* Geometry helpers                                                          */
/* ------------------------------------------------------------------------ */

const cx = (b: Box): number => b.x + b.w / 2;
const cy = (b: Box): number => b.y + b.h / 2;

/**
 * Where the obstacle `b` sits relative to `a` along side `s`'s normal:
 * fully beyond the side (`toward`), fully behind it (`away`), or overlapping.
 */
function relation(s: Side, a: Box, b: Box): 'toward' | 'level' | 'away' {
  switch (s) {
    case 'R':
      return b.x >= a.x + a.w ? 'toward' : b.x + b.w <= a.x ? 'away' : 'level';
    case 'L':
      return b.x + b.w <= a.x ? 'toward' : b.x >= a.x + a.w ? 'away' : 'level';
    case 'B':
      return b.y >= a.y + a.h ? 'toward' : b.y + b.h <= a.y ? 'away' : 'level';
    case 'T':
      return b.y + b.h <= a.y ? 'toward' : b.y >= a.y + a.h ? 'away' : 'level';
  }
}

/** True when `to` lies fully upstream of `from` along the flow. */
function isBackEdge(dir: FlowDir, from: Box, to: Box): boolean {
  return dir === 'LR' ? to.x + to.w <= from.x : to.y + to.h <= from.y;
}

/**
 * The cost of leaving (or entering) `self` through side `s` when the other
 * end is `other`. `back` marks an edge against the flow in `loop` mode.
 */
function sidePenalty(s: Side, self: Box, other: Box, dir: FlowDir, back: boolean): number {
  const rel = relation(s, self, other);
  const acrossFlow = dir === 'LR' ? !horizontalSide(s) : horizontalSide(s);
  if (back) {
    // Leave and enter across the flow: the loop goes around the row.
    if (acrossFlow) return 0;
    if (rel === 'toward') return BACK_FACING;
    return BACK_FACING + SIDE_AWAY;
  }
  const base = rel === 'toward' ? 0 : rel === 'level' ? SIDE_LEVEL : SIDE_AWAY;
  return base + (acrossFlow ? SIDE_CROSS_FLOW : 0);
}

/** The usable port range along side `s` of `b` (inclusive), plus its centre. */
function portRange(
  s: Side,
  b: Box,
  shape: PortShape,
  radius = 0,
): { lo: number; hi: number; mid: number } {
  const len = horizontalSide(s) ? b.h : b.w;
  const start = horizontalSide(s) ? b.y : b.x;
  const mid = Math.round(start + len / 2);
  let half: number;
  if (shape === 'diamond') half = len * 0.18;
  else if (shape === 'round') {
    const r = Math.min(b.w, b.h) / 2;
    // A rounded end: keep the tip on the steep part of the arc.
    const flat = Math.max(0, len / 2 - r);
    half = flat > 0 ? flat - 2 : r * 0.55;
  } else half = len / 2 - Math.max(PORT_MARGIN, radius);
  half = Math.max(0, half);
  return { lo: Math.round(mid - half), hi: Math.round(mid + half), mid };
}

/** The point on the outline of `b` (side `s`) at coordinate `t` along the side. */
function attachPoint(s: Side, b: Box, shape: PortShape, t: number): Pt {
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  if (shape === 'diamond') {
    const hw = b.w / 2;
    const hh = b.h / 2;
    if (horizontalSide(s)) {
      const k = Math.max(0, 1 - Math.abs(t - cy(b)) / hh);
      const x = s === 'R' ? cx(b) + hw * k : cx(b) - hw * k;
      return { x: Math.round(x), y: t };
    }
    const k = Math.max(0, 1 - Math.abs(t - cx(b)) / hw);
    const y = s === 'B' ? cy(b) + hh * k : cy(b) - hh * k;
    return { x: t, y: Math.round(y) };
  }
  if (shape === 'round') {
    const r = Math.min(b.w, b.h) / 2;
    if (horizontalSide(s)) {
      // Rounded ends sit on the left/right when the shape is wider than tall.
      const dy = Math.abs(t - cy(b));
      const flatH = b.h / 2 - r;
      const inset =
        dy <= flatH ? 0 : r - Math.sqrt(Math.max(0, r * r - (dy - flatH) * (dy - flatH)));
      return { x: Math.round(s === 'R' ? x1 - inset : x0 + inset), y: t };
    }
    const dx = Math.abs(t - cx(b));
    const flatW = b.w / 2 - r;
    const inset = dx <= flatW ? 0 : r - Math.sqrt(Math.max(0, r * r - (dx - flatW) * (dx - flatW)));
    return { x: t, y: Math.round(s === 'B' ? y1 - inset : y0 + inset) };
  }
  switch (s) {
    case 'R':
      return { x: Math.round(x1), y: t };
    case 'L':
      return { x: Math.round(x0), y: t };
    case 'B':
      return { x: t, y: Math.round(y1) };
    case 'T':
      return { x: t, y: Math.round(y0) };
  }
}

/** The stub point: one clearance out from the obstacle, on the port line. */
function stubPoint(s: Side, ob: Box, t: number, c: number): Pt {
  switch (s) {
    case 'R':
      return { x: Math.round(ob.x + ob.w + c), y: t };
    case 'L':
      return { x: Math.round(ob.x - c), y: t };
    case 'B':
      return { x: t, y: Math.round(ob.y + ob.h + c) };
    case 'T':
      return { x: t, y: Math.round(ob.y - c) };
  }
}

/** The smallest box holding both boxes. */
export function unionBox(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Drops repeated and collinear points. */
export function simplify(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last !== undefined && last.x === p.x && last.y === p.y) continue;
    const prev = out[out.length - 2];
    if (prev !== undefined && last !== undefined) {
      const col = (prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y);
      if (col) {
        // Same line: extend unless it doubles back (a spike), which we keep.
        const back =
          (prev.x === last.x && Math.sign(last.y - prev.y) !== Math.sign(p.y - last.y)) ||
          (prev.y === last.y && Math.sign(last.x - prev.x) !== Math.sign(p.x - last.x));
        if (!back) {
          out[out.length - 1] = p;
          continue;
        }
      }
    }
    out.push(p);
  }
  return out;
}

/** SVG path data for an orthogonal polyline, with small rounded corners. */
export function polylinePath(pts: readonly Pt[], radius = RADIUS): string {
  const first = pts[0];
  if (first === undefined) return '';
  let d = `M ${first.x} ${first.y}`;
  for (let k = 1; k < pts.length - 1; k++) {
    const prev = pts[k - 1] as Pt;
    const p = pts[k] as Pt;
    const next = pts[k + 1] as Pt;
    const lin = Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
    const lout = Math.abs(next.x - p.x) + Math.abs(next.y - p.y);
    const r = Math.floor(Math.min(radius, lin / 2, lout / 2));
    if (r < 1) {
      d += ` L ${p.x} ${p.y}`;
      continue;
    }
    const ax = p.x - Math.sign(p.x - prev.x) * r;
    const ay = p.y - Math.sign(p.y - prev.y) * r;
    const bx = p.x + Math.sign(next.x - p.x) * r;
    const by = p.y + Math.sign(next.y - p.y) * r;
    d += ` L ${ax} ${ay} Q ${p.x} ${p.y} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1] as Pt;
  if (pts.length > 1) d += ` L ${last.x} ${last.y}`;
  return d;
}

/** True when the segment p→q passes through the interior of `b`. */
export function segmentHitsBox(p: Pt, q: Pt, b: Box, inset = 0.5): boolean {
  const x0 = b.x + inset;
  const y0 = b.y + inset;
  const x1 = b.x + b.w - inset;
  const y1 = b.y + b.h - inset;
  if (x1 <= x0 || y1 <= y0) return false;
  const minX = Math.min(p.x, q.x);
  const maxX = Math.max(p.x, q.x);
  const minY = Math.min(p.y, q.y);
  const maxY = Math.max(p.y, q.y);
  if (p.y === q.y) return p.y > y0 && p.y < y1 && maxX > x0 && minX < x1;
  if (p.x === q.x) return p.x > x0 && p.x < x1 && maxY > y0 && minY < y1;
  // A diagonal segment (non-orthogonal renderers): sample it.
  const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 4);
  for (let k = 1; k < n; k++) {
    const x = p.x + ((q.x - p.x) * k) / n;
    const y = p.y + ((q.y - p.y) * k) / n;
    if (x > x0 && x < x1 && y > y0 && y < y1) return true;
  }
  return false;
}

/** Number of proper crossings between two orthogonal polylines. */
export function crossingsBetween(a: readonly Pt[], b: readonly Pt[]): number {
  let n = 0;
  for (let i = 0; i + 1 < a.length; i++) {
    const p = a[i] as Pt;
    const q = a[i + 1] as Pt;
    for (let j = 0; j + 1 < b.length; j++) {
      const r = b[j] as Pt;
      const s = b[j + 1] as Pt;
      const pH = p.y === q.y;
      const rH = r.y === s.y;
      if (pH === rH) continue;
      const h = pH ? [p, q] : [r, s];
      const v = pH ? [r, s] : [p, q];
      const [h0, h1] = h as [Pt, Pt];
      const [v0, v1] = v as [Pt, Pt];
      const y = h0.y;
      const x = v0.x;
      if (
        x > Math.min(h0.x, h1.x) &&
        x < Math.max(h0.x, h1.x) &&
        y > Math.min(v0.y, v1.y) &&
        y < Math.max(v0.y, v1.y)
      )
        n++;
    }
  }
  return n;
}

/* ------------------------------------------------------------------------ */
/* The routing grid                                                          */
/* ------------------------------------------------------------------------ */

interface Line {
  readonly v: number;
  readonly w: number;
  /** Exact lines (ports, hug lines) are never merged away. */
  readonly port: boolean;
}

interface Grid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly xw: readonly number[];
  readonly yw: readonly number[];
  readonly nx: number;
  readonly ny: number;
  /** Unit segment (i,j)→(i+1,j) passes inside an inflated obstacle. */
  readonly hBlock: Uint8Array;
  /** Unit segment (i,j)→(i,j+1) passes inside an inflated obstacle. */
  readonly vBlock: Uint8Array;
  /** Edges already routed along each unit segment. */
  readonly hOcc: Uint16Array;
  readonly vOcc: Uint16Array;
  /** Edges already routed straight through each point (by orientation). */
  readonly hPass: Uint16Array;
  readonly vPass: Uint16Array;
  /** Unit segment runs along (within {@link RAIL_NEAR}px of) a panel border. */
  readonly hRail: Uint8Array;
  readonly vRail: Uint8Array;
  /** Static cost of each unit segment: length × line weight, block, rail. */
  readonly hCost: Float64Array;
  readonly vCost: Float64Array;
  /** Whether the neighbouring line below / above sits closer than one track. */
  readonly nearLoY: Uint8Array;
  readonly nearHiY: Uint8Array;
  readonly nearLoX: Uint8Array;
  readonly nearHiX: Uint8Array;
  /** True once any route has been recorded (enables the interaction costs). */
  hasOcc: boolean;
  /** Cost of crossing a route already recorded, per crossing. */
  readonly crossCost: number;
}

/** Sorted, merged candidate lines along one axis. */
function axisLines(
  ranges: ReadonlyArray<readonly [number, number]>,
  lo: number,
  hi: number,
  c: number,
  ports: readonly number[],
  tracks = MAX_TRACKS,
  borders: readonly number[] = [],
): Line[] {
  const raw: Line[] = [];
  const bounds = [lo, hi];
  for (const [a, b] of ranges) {
    // Hug lines carry the stubs, so they are exact like ports.
    raw.push({ v: Math.round(a - c), w: W_HUG, port: true });
    raw.push({ v: Math.round(b + c), w: W_HUG, port: true });
    bounds.push(a, b);
  }
  // Channel centres between consecutive boundaries, plus tracks either side.
  const edges = [...new Set(bounds.map((v) => Math.round(v)))].sort((p, q) => p - q);
  for (let k = 0; k + 1 < edges.length; k++) {
    const a = edges[k] as number;
    const b = edges[k + 1] as number;
    if (b - a < 2) continue;
    const m = Math.round((a + b) / 2);
    raw.push({ v: m, w: W_CENTRE, port: false });
    const free = (b - a) / 2 - c - 2;
    for (let t = 1; t <= tracks && t * TRACK <= free; t++) {
      raw.push({ v: m - t * TRACK, w: W_TRACK * t, port: false });
      raw.push({ v: m + t * TRACK, w: W_TRACK * t, port: false });
    }
  }
  // Midway between a panel border and its neighbouring boundaries, so a route
  // can run beside a panel without riding its border.
  if (borders.length > 0) {
    const all = [...new Set([...edges, ...borders.map((v) => Math.round(v))])].sort(
      (p, q) => p - q,
    );
    for (let k = 0; k + 1 < all.length; k++) {
      const a = all[k] as number;
      const b = all[k + 1] as number;
      if (b - a < 2 * RAIL_NEAR) continue;
      raw.push({ v: Math.round((a + b) / 2), w: W_TRACK, port: false });
    }
  }
  // The outer ring, so a loop can pass outside the outermost nodes.
  raw.push({ v: Math.round(lo + 6), w: W_RING, port: false });
  raw.push({ v: Math.round(hi - 6), w: W_RING, port: false });
  for (const p of ports) raw.push({ v: Math.round(p), w: W_PORT, port: true });

  const inRange = raw.filter((l) => l.v >= lo + 2 && l.v <= hi - 2);
  inRange.sort((p, q) => p.v - q.v || p.w - q.w);
  // Merge lines that coincide; an exact line always survives, else the cheapest.
  const out: Line[] = [];
  for (const l of inRange) {
    const last = out[out.length - 1];
    if (last !== undefined && l.v === last.v) {
      out[out.length - 1] = { v: l.v, w: Math.min(l.w, last.w), port: l.port || last.port };
      continue;
    }
    if (last !== undefined && l.v - last.v < 2) {
      if (last.port && l.port) out.push(l);
      else if (last.port) continue;
      else if (l.port) out[out.length - 1] = { v: l.v, w: Math.min(l.w, last.w), port: true };
      else if (l.w < last.w) out[out.length - 1] = { v: last.v, w: l.w, port: false };
      continue;
    }
    out.push(l);
  }
  return out;
}

/** First index with `arr[i] >= v`. */
function lowerBound(arr: readonly number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if ((arr[m] as number) < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

function buildGrid(
  obstacles: readonly Box[],
  bounds: Box,
  c: number,
  xPorts: readonly number[],
  yPorts: readonly number[],
  rails: readonly Box[] = [],
  tracks = MAX_TRACKS,
  crossCost = CROSS,
): Grid {
  const xl = axisLines(
    obstacles.map((o) => [o.x, o.x + o.w] as const),
    bounds.x,
    bounds.x + bounds.w,
    c,
    xPorts,
    tracks,
    rails.flatMap((r) => [r.x, r.x + r.w]),
  );
  const yl = axisLines(
    obstacles.map((o) => [o.y, o.y + o.h] as const),
    bounds.y,
    bounds.y + bounds.h,
    c,
    yPorts,
    tracks,
    rails.flatMap((r) => [r.y, r.y + r.h]),
  );
  const xs = xl.map((l) => l.v);
  const ys = yl.map((l) => l.v);
  const nx = xs.length;
  const ny = ys.length;
  const hBlock = new Uint8Array(nx * ny);
  const vBlock = new Uint8Array(nx * ny);
  for (const o of obstacles) {
    const x0 = o.x - c;
    const x1 = o.x + o.w + c;
    const y0 = o.y - c;
    const y1 = o.y + o.h + c;
    // Lines strictly inside the inflated box.
    const ia = lowerBound(xs, x0);
    const ib = lowerBound(xs, x1);
    const ja = lowerBound(ys, y0);
    const jb = lowerBound(ys, y1);
    // Horizontal unit segments on rows strictly inside, spanning the box.
    for (let j = ja; j < jb; j++) {
      const y = ys[j] as number;
      if (y <= y0 || y >= y1) continue;
      for (let i = Math.max(0, ia - 1); i < Math.min(nx - 1, ib + 1); i++) {
        const mx = ((xs[i] as number) + (xs[i + 1] as number)) / 2;
        if (mx > x0 && mx < x1) hBlock[j * nx + i] = 1;
      }
    }
    for (let i = ia; i < ib; i++) {
      const x = xs[i] as number;
      if (x <= x0 || x >= x1) continue;
      for (let j = Math.max(0, ja - 1); j < Math.min(ny - 1, jb + 1); j++) {
        const my = ((ys[j] as number) + (ys[j + 1] as number)) / 2;
        if (my > y0 && my < y1) vBlock[j * nx + i] = 1;
      }
    }
  }
  // Panel borders: a route that runs along one reads as part of the panel.
  const hRail = new Uint8Array(nx * ny);
  const vRail = new Uint8Array(nx * ny);
  for (const r of rails) {
    for (const by of [r.y, r.y + r.h]) {
      for (let j = 0; j < ny; j++) {
        if (Math.abs((ys[j] as number) - by) >= RAIL_NEAR) continue;
        for (let i = 0; i + 1 < nx; i++) {
          const mx = ((xs[i] as number) + (xs[i + 1] as number)) / 2;
          if (mx > r.x && mx < r.x + r.w) hRail[j * nx + i] = 1;
        }
      }
    }
    for (const bx of [r.x, r.x + r.w]) {
      for (let i = 0; i < nx; i++) {
        if (Math.abs((xs[i] as number) - bx) >= RAIL_NEAR) continue;
        for (let j = 0; j + 1 < ny; j++) {
          const my = ((ys[j] as number) + (ys[j + 1] as number)) / 2;
          if (my > r.y && my < r.y + r.h) vRail[j * nx + i] = 1;
        }
      }
    }
  }
  const xw = xl.map((l) => l.w);
  const yw = yl.map((l) => l.w);
  const hCost = new Float64Array(nx * ny);
  const vCost = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const seg = j * nx + i;
      if (i + 1 < nx) {
        const len = (xs[i + 1] as number) - (xs[i] as number);
        hCost[seg] =
          len * (1 + (yw[j] as number)) +
          (hBlock[seg] === 1 ? BLOCKED : 0) +
          (hRail[seg] === 1 ? RAIL * len : 0);
      }
      if (j + 1 < ny) {
        const len = (ys[j + 1] as number) - (ys[j] as number);
        vCost[seg] =
          len * (1 + (xw[i] as number)) +
          (vBlock[seg] === 1 ? BLOCKED : 0) +
          (vRail[seg] === 1 ? RAIL * len : 0);
      }
    }
  }
  const near = (arr: readonly number[], k: number, dk: number): number => {
    const o = arr[k + dk];
    return o !== undefined && Math.abs(o - (arr[k] as number)) < TRACK ? 1 : 0;
  };
  const nearLoY = Uint8Array.from(ys.map((_, j) => near(ys, j, -1)));
  const nearHiY = Uint8Array.from(ys.map((_, j) => near(ys, j, 1)));
  const nearLoX = Uint8Array.from(xs.map((_, i) => near(xs, i, -1)));
  const nearHiX = Uint8Array.from(xs.map((_, i) => near(xs, i, 1)));
  return {
    xs,
    ys,
    xw,
    yw,
    nx,
    ny,
    hBlock,
    vBlock,
    hRail,
    vRail,
    hCost,
    vCost,
    nearLoY,
    nearHiY,
    nearLoX,
    nearHiX,
    hasOcc: false,
    crossCost,
    hOcc: new Uint16Array(nx * ny),
    vOcc: new Uint16Array(nx * ny),
    hPass: new Uint16Array(nx * ny),
    vPass: new Uint16Array(nx * ny),
  };
}

/* ------------------------------------------------------------------------ */
/* A* over (grid point, arrival direction)                                   */
/* ------------------------------------------------------------------------ */

/**
 * A binary min-heap of states keyed by cost. Ties go to the state closer to
 * the goal (smaller estimate), then to the earlier push — so the search runs
 * toward the goal instead of flooding equal-cost staircases, and stays
 * deterministic. Typed arrays, grown by doubling.
 */
class Heap {
  private f = new Float64Array(1024);
  private t = new Float64Array(1024);
  private seq = new Int32Array(1024);
  private st = new Int32Array(1024);
  private n = 0;
  private counter = 0;

  get size(): number {
    return this.n;
  }

  /** The smallest key (valid while `size > 0`). */
  peek(): number {
    return this.f[0] as number;
  }

  /** True when slot `a` orders before the key (`f`, `t`, `seq`). */
  private before(a: number, f: number, t: number, seq: number): boolean {
    const fa = this.f[a] as number;
    if (fa !== f) return fa < f;
    const ta = this.t[a] as number;
    if (ta !== t) return ta < t;
    return (this.seq[a] as number) < seq;
  }

  private copy(to: number, from: number): void {
    this.f[to] = this.f[from] as number;
    this.t[to] = this.t[from] as number;
    this.seq[to] = this.seq[from] as number;
    this.st[to] = this.st[from] as number;
  }

  push(f: number, tie: number, state: number): void {
    if (this.n === this.f.length) this.grow();
    const seq = this.counter++;
    let i = this.n++;
    // Sift up with a hole: move parents down until the slot fits.
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.before(p, f, tie, seq)) break;
      this.copy(i, p);
      i = p;
    }
    this.f[i] = f;
    this.t[i] = tie;
    this.seq[i] = seq;
    this.st[i] = state;
  }

  /** Removes the minimum and returns its state. */
  pop(): number {
    const top = this.st[0] as number;
    const n = --this.n;
    if (n > 0) {
      const f = this.f[n] as number;
      const tie = this.t[n] as number;
      const seq = this.seq[n] as number;
      const state = this.st[n] as number;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m =
          r < n && this.before(r, this.f[l] as number, this.t[l] as number, this.seq[l] as number)
            ? r
            : l;
        if (!this.before(m, f, tie, seq)) break;
        this.copy(i, m);
        i = m;
      }
      this.f[i] = f;
      this.t[i] = tie;
      this.seq[i] = seq;
      this.st[i] = state;
    }
    return top;
  }

  private grow(): void {
    const cap = this.f.length * 2;
    const f = new Float64Array(cap);
    f.set(this.f);
    const t = new Float64Array(cap);
    t.set(this.t);
    const seq = new Int32Array(cap);
    seq.set(this.seq);
    const st = new Int32Array(cap);
    st.set(this.st);
    this.f = f;
    this.t = t;
    this.seq = seq;
    this.st = st;
  }
}

/** A start or goal of one search: a grid point plus its side and cost. */
interface Terminal {
  readonly idx: number;
  readonly side: Side;
  readonly cost: number;
  /** The port's coordinate along its side (pass 1 offers several). */
  readonly t?: number;
}

/** Scratch arrays reused across searches on one grid (lazy reset by stamp). */
interface Scratch {
  readonly g: Float64Array;
  readonly parent: Int32Array;
  readonly stamp: Int32Array;
  readonly closed: Int32Array;
  /** Marks the goal points of the current search (by `run`). */
  readonly goal: Int32Array;
  run: number;
}

function newScratch(grid: Grid): Scratch {
  const n = grid.nx * grid.ny * 4;
  return {
    g: new Float64Array(n),
    parent: new Int32Array(n),
    stamp: new Int32Array(n),
    closed: new Int32Array(n),
    goal: new Int32Array(grid.nx * grid.ny),
    run: 0,
  };
}

interface SearchResult {
  /** Grid point indices from start to goal. */
  readonly path: number[];
  readonly start: Terminal;
  readonly goal: Terminal;
}

function search(
  grid: Grid,
  sc: Scratch,
  starts: readonly Terminal[],
  goals: readonly Terminal[],
  weight = 1,
  budget = Infinity,
): SearchResult | 'budget' | undefined {
  const { xs, ys, nx, ny } = grid;
  sc.run++;
  const run = sc.run;
  const goalAt = new Map<number, Terminal[]>();
  for (const t of goals) {
    goalAt.set(t.idx, [...(goalAt.get(t.idx) ?? []), t]);
    sc.goal[t.idx] = run;
  }
  const gx = goals.map((t) => xs[t.idx % nx] as number);
  const gy = goals.map((t) => ys[Math.floor(t.idx / nx)] as number);
  const gc = goals.map((t) => t.cost);
  // Admissible estimate: the Manhattan distance, plus the bends still needed
  // given the direction of travel, plus the goal's own cost.
  const h = (idx: number, d: Dir): number => {
    const x = xs[idx % nx] as number;
    const y = ys[Math.floor(idx / nx)] as number;
    let best = Infinity;
    for (let k = 0; k < gx.length; k++) {
      const dx = (gx[k] as number) - x;
      const dy = (gy[k] as number) - y;
      let bends = 0;
      if (dx !== 0 && dy !== 0) {
        const hd = dx > 0 ? 0 : 1;
        const vd = dy > 0 ? 2 : 3;
        bends = d === hd || d === vd ? 1 : 2;
      } else if (dx !== 0 || dy !== 0) {
        const want = dx > 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3;
        bends = d === want ? 0 : d === (want ^ 1) ? 2 : 1;
      }
      const v = Math.abs(dx) + Math.abs(dy) + bends * BEND + (gc[k] as number);
      if (v < best) best = v;
    }
    return best;
  };
  const heap = new Heap();
  const startOf = new Map<number, Terminal>();
  for (const t of starts) {
    const st = t.idx * 4 + outward(t.side);
    if (sc.stamp[st] === run && (sc.g[st] as number) <= t.cost) continue;
    sc.stamp[st] = run;
    sc.g[st] = t.cost;
    sc.parent[st] = -1;
    startOf.set(st, t);
    const est = h(t.idx, outward(t.side));
    heap.push(t.cost + weight * est, est, st);
  }
  let best = Infinity;
  let bestState = -1;
  let bestGoal: Terminal | undefined;
  let pops = 0;
  while (heap.size > 0) {
    const f = heap.peek();
    const st = heap.pop();
    if (f >= best) break;
    if (sc.closed[st] === run) continue;
    sc.closed[st] = run;
    if (++pops > budget) return 'budget';
    const g = sc.g[st] as number;
    const idx = st >> 2;
    const d = (st & 3) as Dir;
    const here = sc.goal[idx] === run ? goalAt.get(idx) : undefined;
    if (here !== undefined) {
      for (const t of here) {
        const inward = (outward(t.side) ^ 1) as Dir;
        const total =
          g + t.cost + (d === inward ? 0 : d === ((inward ^ 1) as Dir) ? Infinity : BEND);
        if (total < best) {
          best = total;
          bestState = st;
          bestGoal = t;
        }
      }
    }
    const i = idx % nx;
    const j = (idx - i) / nx;
    for (let nd = 0 as Dir; nd < 4; nd = (nd + 1) as Dir) {
      if (nd === (d ^ 1)) continue; // no doubling back
      let ni = i;
      let nj = j;
      if (nd === 0) ni++;
      else if (nd === 1) ni--;
      else if (nd === 2) nj++;
      else nj--;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const nidx = nj * nx + ni;
      const horiz = nd < 2;
      const seg = horiz ? j * nx + Math.min(i, ni) : Math.min(j, nj) * nx + i;
      let cost = horiz ? (grid.hCost[seg] as number) : (grid.vCost[seg] as number);
      if (nd !== d) cost += BEND;
      const occ = horiz ? (grid.hOcc[seg] as number) : (grid.vOcc[seg] as number);
      if (occ > 0 || grid.hasOcc) {
        const len = horiz
          ? (xs[Math.max(i, ni)] as number) - (xs[Math.min(i, ni)] as number)
          : (ys[Math.max(j, nj)] as number) - (ys[Math.min(j, nj)] as number);
        if (occ > 0) cost += occ * (OVERLAP * len + OVERLAP_FIXED);
        // Running right beside another route (closer than one track).
        if (horiz) {
          const c0 = Math.min(i, ni);
          if (grid.nearLoY[j] === 1 && (grid.hOcc[(j - 1) * nx + c0] as number) > 0)
            cost += NEAR * len;
          if (grid.nearHiY[j] === 1 && (grid.hOcc[(j + 1) * nx + c0] as number) > 0)
            cost += NEAR * len;
        } else {
          const r0 = Math.min(j, nj);
          if (grid.nearLoX[i] === 1 && (grid.vOcc[r0 * nx + i - 1] as number) > 0)
            cost += NEAR * len;
          if (grid.nearHiX[i] === 1 && (grid.vOcc[r0 * nx + i + 1] as number) > 0)
            cost += NEAR * len;
        }
      }
      const pass = horiz ? (grid.vPass[nidx] as number) : (grid.hPass[nidx] as number);
      if (pass > 0) cost += grid.crossCost * pass;
      const ns = nidx * 4 + nd;
      const ng = g + cost;
      if (sc.stamp[ns] === run && ng >= (sc.g[ns] as number)) continue;
      sc.stamp[ns] = run;
      sc.g[ns] = ng;
      sc.parent[ns] = st;
      const est = h(nidx, nd);
      heap.push(ng + weight * est, est, ns);
    }
  }
  if (bestState < 0 || bestGoal === undefined) return undefined;
  const path: number[] = [];
  let st = bestState;
  let first = st;
  while (st >= 0) {
    path.push(st >> 2);
    first = st;
    st = sc.parent[st] as number;
  }
  path.reverse();
  const start = startOf.get(first);
  if (start === undefined) return undefined;
  return { path, start, goal: bestGoal };
}

/** Records a routed path's unit segments and pass-through points on the grid. */
function occupy(grid: Grid, path: readonly number[]): void {
  const { nx } = grid;
  grid.hasOcc = true;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k] as number;
    const b = path[k + 1] as number;
    const ai = a % nx;
    const aj = (a - ai) / nx;
    const bi = b % nx;
    const bj = (b - bi) / nx;
    if (aj === bj) {
      const seg = aj * nx + Math.min(ai, bi);
      grid.hOcc[seg] = (grid.hOcc[seg] as number) + 1;
    } else {
      const seg = Math.min(aj, bj) * nx + ai;
      grid.vOcc[seg] = (grid.vOcc[seg] as number) + 1;
    }
  }
  markPassing(grid, path);
}

/**
 * Records the interior points a routed path runs straight through, so a later
 * search pays for crossing it there (without the overlap costs of
 * {@link occupy}).
 */
function markPassing(grid: Grid, path: readonly number[]): void {
  const { nx } = grid;
  for (let k = 1; k + 1 < path.length; k++) {
    const p = path[k - 1] as number;
    const q = path[k] as number;
    const r = path[k + 1] as number;
    const pi = p % nx;
    const ri = r % nx;
    const pj = (p - pi) / nx;
    const rj = (r - ri) / nx;
    if (pj === rj) grid.hPass[q] = (grid.hPass[q] as number) + 1;
    else if (pi === ri) grid.vPass[q] = (grid.vPass[q] as number) + 1;
  }
}

/** Nearest grid index for a point (the point is on grid lines by construction). */
function gridIndex(grid: Grid, p: Pt): number {
  const i = Math.min(grid.nx - 1, lowerBound(grid.xs, p.x));
  const j = Math.min(grid.ny - 1, lowerBound(grid.ys, p.y));
  return j * grid.nx + i;
}

function gridPoint(grid: Grid, idx: number): Pt {
  const i = idx % grid.nx;
  const j = (idx - i) / grid.nx;
  return { x: grid.xs[i] as number, y: grid.ys[j] as number };
}

/* ------------------------------------------------------------------------ */
/* Ports                                                                     */
/* ------------------------------------------------------------------------ */

interface EndInfo {
  readonly edge: number;
  /** 0 = source end, 1 = target end. */
  readonly end: 0 | 1;
  readonly node: string;
  readonly side: Side;
  /** −1 / 0 / +1: which way the route turns after leaving this end. */
  readonly lateral: number;
  /** How far the route runs straight out before that turn (px). */
  readonly run: number;
  /** The other end's centre, along this side's axis. */
  readonly other: number;
  /** The pass-1 route walked outward from this end (first point on the side). */
  readonly path: readonly Pt[];
}

/** The direction of the step p→q (−1 for a zero-length or diagonal step). */
function dirOf(p: Pt, q: Pt): Dir | -1 {
  if (p.y === q.y && q.x !== p.x) return q.x > p.x ? 0 : 1;
  if (p.x === q.x && q.y !== p.y) return q.y > p.y ? 2 : 3;
  return -1;
}

/** How far `p` lies along direction `d`. */
function forward(p: Pt, d: Dir): number {
  return d === 0 ? p.x : d === 1 ? -p.x : d === 2 ? p.y : -p.y;
}

/**
 * The turn a polyline makes at point `k`: +1 left, −1 right (of the direction
 * of travel, on screen), 0 when it ends there (or doubles back).
 */
function turnAt(pts: readonly Pt[], k: number): number {
  const a = pts[k - 1];
  const p = pts[k];
  const b = pts[k + 1];
  if (a === undefined || p === undefined || b === undefined) return 0;
  const d0 = dirOf(a, p);
  const d1 = dirOf(p, b);
  if (d0 < 0 || d1 < 0) return 0;
  // Left of (dx, dy) is (dy, −dx) in screen coordinates (y down).
  const dx0 = d0 === 0 ? 1 : d0 === 1 ? -1 : 0;
  const dy0 = d0 === 2 ? 1 : d0 === 3 ? -1 : 0;
  const dx1 = d1 === 0 ? 1 : d1 === 1 ? -1 : 0;
  const dy1 = d1 === 2 ? 1 : d1 === 3 ? -1 : 0;
  if (dx1 === dy0 && dy1 === -dx0) return 1;
  if (dx1 === -dy0 && dy1 === dx0) return -1;
  return 0;
}

/**
 * The bundle order of two routes that leave one node side: +1 when `a` keeps
 * to the left of `b` (looking outward), −1 when to the right, 0 when the
 * routes do not say. This is the usual rule of orthogonal connector routers:
 * walk both routes outward while they run together; at the first point where
 * they part, the route that turns left keeps left (it is the inner track of
 * that turn). Where one route ends, the side the other one passed it on
 * decides, else the way the other one turns next. Two turns the same way a
 * few tracks apart count as one turn of the bundle, so routes already on
 * parallel tracks compare like routes on one line. A bundle keeps its
 * left/right order through the turns it takes together, so the first
 * parting decides the order at the side.
 */
function bundleOrder(a: readonly Pt[], b: readonly Pt[]): number {
  for (let k = 0; k + 1 < a.length && k + 1 < b.length; k++) {
    const da = dirOf(a[k] as Pt, a[k + 1] as Pt);
    const db = dirOf(b[k] as Pt, b[k + 1] as Pt);
    if (da === -1 || da !== db) return 0;
    const fa = forward(a[k + 1] as Pt, da);
    const fb = forward(b[k + 1] as Pt, da);
    const ta = turnAt(a, k + 1);
    const tb = turnAt(b, k + 1);
    // Which of the two parallel runs lies further left (0 when on one line):
    // a route that ends here leaves the other one free to pass its end node
    // on either side, so the side it passed on decides.
    const sideBy = (): number => {
      const pa = a[k] as Pt;
      const pb = b[k] as Pt;
      // How far left of the direction of travel a point lies.
      const lat = (p: Pt): number => (da === 0 ? -p.y : da === 1 ? p.y : da === 2 ? p.x : -p.x);
      return Math.sign(lat(pa) - lat(pb));
    };
    // Two turns the same way within a few tracks are one turn of the bundle
    // (routes pass 2 placed on parallel tracks of one channel).
    const together = ta !== 0 && ta === tb && Math.abs(fa - fb) <= MAX_TRACKS * TRACK;
    // One route turns (or ends) first.
    if (fa < fb && !together) return ta !== 0 ? ta : sideBy() || -tb;
    if (fb < fa && !together) return tb !== 0 ? -tb : sideBy() || ta;
    // Both turn (or end) at the same point.
    if (ta !== tb) return ta !== 0 && tb !== 0 ? ta : sideBy() || (ta !== 0 ? ta : -tb);
    if (ta === 0) return 0;
  }
  return 0;
}

/** Turn direction and straight run of a polyline as seen from its first point. */
function turnOf(pts: readonly Pt[], side: Side): { lateral: number; run: number } {
  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  if (p0 === undefined || p1 === undefined) return { lateral: 0, run: 0 };
  const run = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
  if (p2 === undefined) return { lateral: 0, run };
  const lateral = horizontalSide(side) ? Math.sign(p2.y - p1.y) : Math.sign(p2.x - p1.x);
  return { lateral, run };
}

/* ------------------------------------------------------------------------ */
/* Nudging                                                                   */
/* ------------------------------------------------------------------------ */

/** True when a segment p→q keeps clear of every box (inflated by `pad`). */
function segmentClear(
  p: Pt,
  q: Pt,
  boxes: readonly Box[],
  pad: number,
  ends: readonly Pt[] = [],
): boolean {
  for (const b of boxes) {
    // A box a route starts or ends on is checked strictly: the route's own
    // port segment always runs through that box's clearance.
    const own = ends.some(
      (e) => e.x >= b.x - 1 && e.x <= b.x + b.w + 1 && e.y >= b.y - 1 && e.y <= b.y + b.h + 1,
    );
    const k = own ? 0 : pad;
    if (
      segmentHitsBox(
        p,
        q,
        { x: b.x - k, y: b.y - k, w: b.w + 2 * k, h: b.h + 2 * k },
        own ? 0.5 : 0,
      )
    )
      return false;
  }
  return true;
}

interface Seg {
  readonly edge: number;
  readonly k: number;
  readonly horiz: boolean;
  /** The fixed coordinate (y for horizontal, x for vertical). */
  readonly at: number;
  readonly lo: number;
  readonly hi: number;
}

function segmentsOf(routes: ReadonlyArray<readonly Pt[] | undefined>): Seg[] {
  const out: Seg[] = [];
  routes.forEach((pts, edge) => {
    if (pts === undefined) return;
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k] as Pt;
      const q = pts[k + 1] as Pt;
      if (p.y === q.y && p.x !== q.x)
        out.push({ edge, k, horiz: true, at: p.y, lo: Math.min(p.x, q.x), hi: Math.max(p.x, q.x) });
      else if (p.x === q.x && p.y !== q.y)
        out.push({
          edge,
          k,
          horiz: false,
          at: p.x,
          lo: Math.min(p.y, q.y),
          hi: Math.max(p.y, q.y),
        });
    }
  });
  return out;
}

/**
 * Moves interior segments that share a channel with another route (closer
 * than one track, overlapping in extent) apart, in track steps, as long as
 * the moved segment and its two neighbours stay clear of every node.
 */
function nudge(
  routes: Array<Pt[] | undefined>,
  order: readonly number[],
  boxes: readonly Box[],
  bounds: Box,
  c: number,
): void {
  const rank = new Map(order.map((e, k) => [e, k]));
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    // The segment list, kept current as segments move.
    let all = segmentsOf(routes);
    const refresh = (edge: number): void => {
      const one: Array<Pt[] | undefined> = routes.map((r, i) => (i === edge ? r : undefined));
      all = [...all.filter((o) => o.edge !== edge), ...segmentsOf(one)];
    };
    for (const s of segmentsOf(routes)) {
      const pts = routes[s.edge];
      if (pts === undefined) continue;
      // Only interior segments move: the first and last ride their ports.
      if (s.k === 0 || s.k + 2 >= pts.length) continue;
      const p = pts[s.k] as Pt;
      const q = pts[s.k + 1] as Pt;
      // The segment as it stands now (an earlier move may have shifted it).
      const at0 = s.horiz ? p.y : p.x;
      const lo = s.horiz ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
      const hi = s.horiz ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
      if ((s.horiz ? p.y !== q.y : p.x !== q.x) || hi - lo < 1) continue;
      // Another route's parallel segment closer than one track, overlapping.
      const clash = (at: number, onlyEarlier: boolean): boolean =>
        all.some(
          (o) =>
            o.edge !== s.edge &&
            o.horiz === s.horiz &&
            Math.abs(o.at - at) < TRACK &&
            Math.min(o.hi, hi) - Math.max(o.lo, lo) > 2 &&
            (!onlyEarlier || (rank.get(o.edge) ?? 0) < (rank.get(s.edge) ?? 0)),
        );
      // The earlier-routed edge keeps its line; the later one moves.
      if (!clash(at0, true)) continue;
      const before = pts[s.k - 1] as Pt;
      const after = pts[s.k + 2] as Pt;
      for (const off of [TRACK, -TRACK, 2 * TRACK, -2 * TRACK, 3 * TRACK, -3 * TRACK]) {
        const at = at0 + off;
        const np: Pt = s.horiz ? { x: p.x, y: at } : { x: at, y: p.y };
        const nq: Pt = s.horiz ? { x: q.x, y: at } : { x: at, y: q.y };
        // The neighbours must keep their direction (no spikes).
        const keep = (a: Pt, b: Pt, na: Pt, nb: Pt): boolean =>
          Math.sign(b.x - a.x) === Math.sign(nb.x - na.x) &&
          Math.sign(b.y - a.y) === Math.sign(nb.y - na.y);
        if (!keep(before, p, before, np) || !keep(q, after, nq, after)) continue;
        if (
          s.horiz
            ? at < bounds.y + 2 || at > bounds.y + bounds.h - 2
            : at < bounds.x + 2 || at > bounds.x + bounds.w - 2
        )
          continue;
        if (clash(at, false)) continue;
        const pad = c / 2;
        const ends = [pts[0] as Pt, pts[pts.length - 1] as Pt];
        if (
          !segmentClear(before, np, boxes, pad, ends) ||
          !segmentClear(np, nq, boxes, pad, ends) ||
          !segmentClear(nq, after, boxes, pad, ends)
        )
          continue;
        pts[s.k] = np;
        pts[s.k + 1] = nq;
        refresh(s.edge);
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
}

/**
 * Up to this many edges the router also weighs crossings when it picks sides
 * and runs a second round (ports ordered by the routes pass 2 took). A bigger
 * diagram skips both and stays fast.
 */
const CAREFUL_EDGES = 40;
/** Moves {@link untangle} may try in one call (keeps big diagrams fast). */
const UNTANGLE_BUDGET = 200;

/** Parallel segments of two routes closer than one track, overlapping in extent. */
function clashesBetween(a: readonly Pt[], b: readonly Pt[]): number {
  let n = 0;
  for (let i = 0; i + 1 < a.length; i++) {
    const p = a[i] as Pt;
    const q = a[i + 1] as Pt;
    const pH = p.y === q.y;
    for (let j = 0; j + 1 < b.length; j++) {
      const r = b[j] as Pt;
      const s = b[j + 1] as Pt;
      if (pH !== (r.y === s.y)) continue;
      const gap = pH ? Math.abs(p.y - r.y) : Math.abs(p.x - r.x);
      if (gap >= TRACK) continue;
      const lo = pH
        ? Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x))
        : Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y));
      const hi = pH
        ? Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x))
        : Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y));
      if (hi - lo > 2) n++;
    }
  }
  return n;
}

/**
 * Route `pts` with its interior segment `k` moved to the line `at`, or
 * undefined when a neighbour would change direction (a spike) or the segment
 * would leave the drawing area.
 */
function shiftSegment(pts: readonly Pt[], k: number, at: number, bounds: Box): Pt[] | undefined {
  const before = pts[k - 1];
  const p = pts[k];
  const q = pts[k + 1];
  const after = pts[k + 2];
  if (before === undefined || p === undefined || q === undefined || after === undefined)
    return undefined;
  const horiz = p.y === q.y;
  if (
    horiz
      ? at < bounds.y + 2 || at > bounds.y + bounds.h - 2
      : at < bounds.x + 2 || at > bounds.x + bounds.w - 2
  )
    return undefined;
  const np: Pt = horiz ? { x: p.x, y: at } : { x: at, y: p.y };
  const nq: Pt = horiz ? { x: q.x, y: at } : { x: at, y: q.y };
  const keep = (a: Pt, b: Pt, na: Pt, nb: Pt): boolean =>
    Math.sign(b.x - a.x) === Math.sign(nb.x - na.x) &&
    Math.sign(b.y - a.y) === Math.sign(nb.y - na.y);
  if (!keep(before, p, before, np) || !keep(q, after, nq, after)) return undefined;
  const out = [...pts];
  out[k] = np;
  out[k + 1] = nq;
  return out;
}

/** True when the orthogonal segments p→q and r→s cross properly. */
function segmentsCross(p: Pt, q: Pt, r: Pt, s: Pt): boolean {
  const pH = p.y === q.y;
  if (pH === (r.y === s.y)) return false;
  if (!pH) return segmentsCross(r, s, p, q);
  // p→q horizontal, r→s vertical.
  return (
    r.x > Math.min(p.x, q.x) &&
    r.x < Math.max(p.x, q.x) &&
    p.y > Math.min(r.y, s.y) &&
    p.y < Math.max(r.y, s.y)
  );
}

/**
 * Crossing-aware channel order. Two routes that run side by side through one
 * channel in the wrong order cross where one of them turns off: the route that
 * turns toward the other one must take the track nearer to it. Where two
 * routes cross, the segment of one that crosses and the parallel segment of
 * the other next to the crossing are such a pair. Each pair tries swapping
 * its two lines, moving one segment one or two tracks past the other, and
 * moving one onto the other's line while that one steps a track back.
 * The move that removes the most crossings is kept — when every moved
 * segment and its two neighbours stay clear of every node, the neighbours
 * keep their direction, a port stub keeps its length, and no route comes
 * closer than a track to another one where it did not before. Routes, pairs
 * and moves are visited in a fixed order, so the result is deterministic.
 */
function untangle(
  routes: Array<Pt[] | undefined>,
  boxes: readonly Box[],
  bounds: Box,
  c: number,
): void {
  const pad = c / 2;
  let budget = UNTANGLE_BUDGET;
  const len = (p: Pt, q: Pt): number => Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
  /** The part of a route that moves with segment `k`: the segment and its neighbours. */
  const part = (pts: readonly Pt[], k: number): Pt[] => pts.slice(k - 1, k + 3);
  /** An orthogonal segment strictly inside the box x0..x1 × y0..y1. */
  const hits = (p: Pt, q: Pt, x0: number, y0: number, x1: number, y1: number): boolean =>
    p.y === q.y
      ? p.y > y0 && p.y < y1 && Math.max(p.x, q.x) > x0 && Math.min(p.x, q.x) < x1
      : p.x > x0 && p.x < x1 && Math.max(p.y, q.y) > y0 && Math.min(p.y, q.y) < y1;
  /**
   * The moved part of `pts` keeps clear of every node (as {@link segmentClear}:
   * a box the route starts or ends on only keeps its interior clear), and its
   * port stubs keep their length (or at least one clearance).
   */
  const ownOf: Array<boolean[] | undefined> = routes.map(() => undefined);
  const valid = (edge: number, old: readonly Pt[], pts: readonly Pt[], k: number): boolean => {
    let own = ownOf[edge];
    if (own === undefined) {
      const ends = [pts[0] as Pt, pts[pts.length - 1] as Pt];
      own = boxes.map((b) =>
        ends.some(
          (e) => e.x >= b.x - 1 && e.x <= b.x + b.w + 1 && e.y >= b.y - 1 && e.y <= b.y + b.h + 1,
        ),
      );
      ownOf[edge] = own;
    }
    const last = pts.length - 2;
    for (let n = 0; n < boxes.length; n++) {
      const b = boxes[n] as Box;
      const g = own[n] === true ? -0.5 : pad;
      for (let m = k - 1; m <= k + 1; m++) {
        // A port segment runs into its own end's outline (a round or
        // diamond end attaches inside its box).
        if (own[n] === true && (m === 0 || m === last)) continue;
        if (hits(pts[m] as Pt, pts[m + 1] as Pt, b.x - g, b.y - g, b.x + b.w + g, b.y + b.h + g))
          return false;
      }
    }
    for (const m of [0, last]) {
      const was = len(old[m] as Pt, old[m + 1] as Pt);
      if (len(pts[m] as Pt, pts[m + 1] as Pt) < Math.min(was, c)) return false;
    }
    return true;
  };
  /** Each route's bounding box, so a score only looks at routes nearby. */
  const bbox = (pts: readonly Pt[]): Box => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const boxOf = routes.map((r) => (r === undefined ? undefined : bbox(r)));
  const near = (a: Box, b: Box): boolean =>
    a.x - TRACK < b.x + b.w &&
    b.x - TRACK < a.x + a.w &&
    a.y - TRACK < b.y + b.h &&
    b.y - TRACK < a.y + a.h;
  interface Score {
    cross: number;
    clash: number;
  }
  /** Crossings and clashes of `sub` with every route but `a` and `b`. */
  const others = (sub: readonly Pt[], a: number, b: number): Score => {
    const out = { cross: 0, clash: 0 };
    const sb = bbox(sub);
    for (let e = 0; e < routes.length; e++) {
      const o = routes[e];
      const ob = boxOf[e];
      if (e === a || e === b || o === undefined || ob === undefined || !near(sb, ob)) continue;
      out.cross += crossingsBetween(sub, o);
      out.clash += clashesBetween(sub, o);
    }
    return out;
  };
  const between = (x: readonly Pt[], y: readonly Pt[]): Score => ({
    cross: crossingsBetween(x, y),
    clash: clashesBetween(x, y),
  });
  const add = (...ss: Score[]): Score => ({
    cross: ss.reduce((n, s) => n + s.cross, 0),
    clash: ss.reduce((n, s) => n + s.clash, 0),
  });
  type Change = readonly [edge: number, k: number, pts: Pt[]];
  for (let pass = 0; pass < 4 && budget > 0; pass++) {
    let any = false;
    for (let a = 0; a < routes.length && budget > 0; a++) {
      for (let b = a + 1; b < routes.length && budget > 0; b++) {
        const A = routes[a];
        const B = routes[b];
        const boxA = boxOf[a];
        const boxB = boxOf[b];
        if (A === undefined || B === undefined || boxA === undefined || boxB === undefined)
          continue;
        if (!near(boxA, boxB)) continue;
        // Parallel interior segment pairs next to a crossing of A and B.
        const pairs: Array<[number, number]> = [];
        for (let i = 0; i + 1 < A.length; i++)
          for (let j = 0; j + 1 < B.length; j++) {
            if (!segmentsCross(A[i] as Pt, A[i + 1] as Pt, B[j] as Pt, B[j + 1] as Pt)) continue;
            for (const [pi, pj] of [
              [i, j - 1],
              [i, j + 1],
              [i - 1, j],
              [i + 1, j],
            ] as const) {
              if (pi < 1 || pi + 2 >= A.length || pj < 1 || pj + 2 >= B.length) continue;
              if (!pairs.some(([x, y]) => x === pi && y === pj)) pairs.push([pi, pj]);
            }
          }
        let best: { gain: number; changes: Change[] } | undefined;
        for (const [i, j] of pairs) {
          const p = A[i] as Pt;
          const q = A[i + 1] as Pt;
          const r = B[j] as Pt;
          const s = B[j + 1] as Pt;
          const horiz = p.y === q.y;
          if (horiz !== (r.y === s.y)) continue;
          const atA = horiz ? p.y : p.x;
          const atB = horiz ? r.y : r.x;
          if (atA === atB) continue;
          const lo = horiz
            ? Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x))
            : Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y));
          const hi = horiz
            ? Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x))
            : Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y));
          if (hi - lo <= 2) continue;
          const dir = Math.sign(atB - atA);
          let oldA: Score | undefined;
          let oldB: Score | undefined;
          const tries: ReadonlyArray<ReadonlyArray<readonly [0 | 1, number]>> = [
            [
              [0, atB],
              [1, atA],
            ],
            [[0, atB + dir * TRACK]],
            [[1, atA - dir * TRACK]],
            [[0, atB + 2 * dir * TRACK]],
            [[1, atA - 2 * dir * TRACK]],
            // One takes the other's line, the other steps a track back
            // past it (a crowded channel has no free line further out).
            [
              [0, atB],
              [1, atB - dir * TRACK],
            ],
            [
              [1, atA],
              [0, atA + dir * TRACK],
            ],
          ];
          for (const t of tries) {
            if (--budget < 0) break;
            let nA: Pt[] | undefined = A;
            let nB: Pt[] | undefined = B;
            for (const [who, at] of t) {
              if (who === 0) {
                nA = shiftSegment(A, i, at, bounds);
                if (nA !== undefined && !valid(a, A, nA, i)) nA = undefined;
              } else {
                nB = shiftSegment(B, j, at, bounds);
                if (nB !== undefined && !valid(b, B, nB, j)) nB = undefined;
              }
            }
            if (nA === undefined || nB === undefined) continue;
            let was: Score;
            let now: Score;
            const changes: Change[] = [];
            if (nA !== A && nB !== B) {
              oldA ??= others(part(A, i), a, b);
              oldB ??= others(part(B, j), a, b);
              was = add(oldA, oldB, between(A, B));
              now = add(others(part(nA, i), a, b), others(part(nB, j), a, b), between(nA, nB));
              changes.push([a, i, nA], [b, j, nB]);
            } else if (nA !== A) {
              oldA ??= others(part(A, i), a, b);
              was = add(oldA, between(part(A, i), B));
              now = add(others(part(nA, i), a, b), between(part(nA, i), B));
              changes.push([a, i, nA]);
            } else {
              oldB ??= others(part(B, j), a, b);
              was = add(oldB, between(part(B, j), A));
              now = add(others(part(nB, j), a, b), between(part(nB, j), A));
              changes.push([b, j, nB]);
            }
            const gain = was.cross - now.cross;
            if (gain <= 0 || now.clash > was.clash) continue;
            if (best === undefined || gain > best.gain) best = { gain, changes };
          }
        }
        if (best !== undefined) {
          for (const [edge, , pts] of best.changes) {
            routes[edge] = pts;
            boxOf[edge] = bbox(pts);
          }
          any = true;
        }
      }
    }
    if (!any) break;
  }
}

/** A placed edge label: its mask box and the edge it belongs to. */
export interface LabelBox {
  readonly box: Box;
  /** Index of the edge the label belongs to. */
  readonly edge: number;
}

/** True when segment p→q touches box `b` grown by `pad`. */
function touches(p: Pt, q: Pt, b: Box, pad: number): boolean {
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const x1 = b.x + b.w + pad;
  const y1 = b.y + b.h + pad;
  if (p.y === q.y)
    return p.y >= y0 && p.y <= y1 && Math.max(p.x, q.x) >= x0 && Math.min(p.x, q.x) <= x1;
  if (p.x === q.x)
    return p.x >= x0 && p.x <= x1 && Math.max(p.y, q.y) >= y0 && Math.min(p.y, q.y) <= y1;
  return false;
}

/**
 * Moves routes off the labels of OTHER edges: a placed label masks the line
 * under it, so an interior segment of another route that runs through a label
 * shifts sideways (in track steps, both ways, up to six tracks) until it
 * clears every label — as long as it stays clear of every node, keeps its
 * neighbours' direction, keeps a track from the other routes, and does not
 * carry its own edge's label (unless `keepOwn` is false: the caller then
 * places the labels again). A segment that cannot move stays (the label then
 * sits on a crossing). Returns new routes; `d` is rebuilt for moved ones.
 */
export function moveOffLabels(
  routes: ReadonlyArray<RoutedEdge | undefined>,
  labels: readonly LabelBox[],
  obstacles: readonly Box[],
  bounds: Box,
  clearance = CLEAR,
  keepOwn = true,
): Array<RoutedEdge | undefined> {
  if (labels.length === 0) return [...routes];
  const pts: Array<Pt[] | undefined> = routes.map((r) =>
    r === undefined ? undefined : [...r.points],
  );
  const moved = new Set<number>();
  for (let pass = 0; pass < 2; pass++) {
    let any = false;
    pts.forEach((line, e) => {
      if (line === undefined) return;
      for (let k = 1; k + 2 < line.length; k++) {
        const p = line[k] as Pt;
        const q = line[k + 1] as Pt;
        const horiz = p.y === q.y;
        if (!horiz && p.x !== q.x) continue;
        const hit = labels.some((l) => l.edge !== e && touches(p, q, l.box, 2));
        if (!hit) continue;
        const before = line[k - 1] as Pt;
        const after = line[k + 2] as Pt;
        // With `keepOwn`, never move this edge's own label off its line: the
        // segment that carries it, or a neighbour whose length would change.
        // (Without it the caller places the labels again afterwards.)
        const own = keepOwn ? labels.filter((l) => l.edge === e) : [];
        if (
          own.some(
            (l) =>
              touches(before, p, l.box, 0) ||
              touches(p, q, l.box, 0) ||
              touches(q, after, l.box, 0),
          )
        )
          continue;
        const at0 = horiz ? p.y : p.x;
        const lo = horiz ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
        const hi = horiz ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
        const valid = (off: number): boolean => {
          const at = at0 + off;
          const np: Pt = horiz ? { x: p.x, y: at } : { x: at, y: p.y };
          const nq: Pt = horiz ? { x: q.x, y: at } : { x: at, y: q.y };
          const keep = (a: Pt, b: Pt, na: Pt, nb: Pt): boolean =>
            Math.sign(b.x - a.x) === Math.sign(nb.x - na.x) &&
            Math.sign(b.y - a.y) === Math.sign(nb.y - na.y);
          if (!keep(before, p, before, np) || !keep(q, after, nq, after)) return false;
          if (
            horiz
              ? at < bounds.y + 2 || at > bounds.y + bounds.h - 2
              : at < bounds.x + 2 || at > bounds.x + bounds.w - 2
          )
            return false;
          const pad = clearance / 2;
          const ends = [line[0] as Pt, line[line.length - 1] as Pt];
          if (
            !segmentClear(before, np, obstacles, pad, ends) ||
            !segmentClear(np, nq, obstacles, pad, ends) ||
            !segmentClear(nq, after, obstacles, pad, ends)
          )
            return false;
          // The moved segment clears every other label; its two neighbours
          // touch no label they did not touch before.
          const foreign = labels.filter((l) => l.edge !== e);
          if (foreign.some((l) => touches(np, nq, l.box, 2))) return false;
          const worse = (a: Pt, b: Pt, na: Pt, nb: Pt): boolean =>
            foreign.some((l) => touches(na, nb, l.box, 2) && !touches(a, b, l.box, 2));
          if (worse(before, p, before, np) || worse(q, after, nq, after)) return false;
          return !segmentsOf(pts).some(
            (o) =>
              o.edge !== e &&
              o.horiz === horiz &&
              Math.abs(o.at - at) < TRACK &&
              Math.min(o.hi, hi) - Math.max(o.lo, lo) > 2,
          );
        };
        // Room from the nearest node along the moved segment's normal.
        const room = (off: number): number => {
          const at = at0 + off;
          let best = Infinity;
          for (const b of obstacles) {
            const inSpan = horiz ? b.x < hi && b.x + b.w > lo : b.y < hi && b.y + b.h > lo;
            if (!inSpan) continue;
            const d = horiz
              ? Math.max(b.y - at, at - (b.y + b.h))
              : Math.max(b.x - at, at - (b.x + b.w));
            if (d >= 0 && d < best) best = d;
          }
          return best;
        };
        // The smallest move that works; of two equal moves, the roomier one.
        for (let t = 1; t <= 6; t++) {
          const ok = [t * TRACK, -t * TRACK].filter(valid);
          if (ok.length === 0) continue;
          const off =
            ok.length === 2 && room(ok[1] as number) > room(ok[0] as number)
              ? (ok[1] as number)
              : (ok[0] as number);
          const at = at0 + off;
          line[k] = horiz ? { x: p.x, y: at } : { x: at, y: p.y };
          line[k + 1] = horiz ? { x: q.x, y: at } : { x: at, y: q.y };
          moved.add(e);
          any = true;
          break;
        }
      }
    });
    if (!any) break;
  }
  return routes.map((r, e) => {
    const line = pts[e];
    if (r === undefined || line === undefined || !moved.has(e)) return r;
    const clean = simplify(line);
    return { ...r, points: clean, d: polylinePath(clean) };
  });
}

/* ------------------------------------------------------------------------ */
/* Self loops                                                                */
/* ------------------------------------------------------------------------ */

/** A small orthogonal loop off the top-right corner of `b`. */
function selfLoop(n: RouteNode): RoutedEdge {
  const b = n.box;
  const ob = n.obstacle ?? b;
  const out = 18;
  const x = Math.round(b.x + b.w * 0.75);
  const y = Math.round(b.y + b.h * 0.3);
  const top = Math.round(ob.y - out);
  const right = Math.round(ob.x + ob.w + out);
  const pts: Pt[] = [
    { x, y: Math.round(b.y) },
    { x, y: top },
    { x: right, y: top },
    { x: right, y },
    { x: Math.round(b.x + b.w), y },
  ];
  return { points: pts, d: polylinePath(pts), exit: 'T', entry: 'R', through: [] };
}

/* ------------------------------------------------------------------------ */
/* The router                                                                */
/* ------------------------------------------------------------------------ */

/**
 * The clearance the layout allows: two nodes that face each other across a
 * gap narrower than two clearances would put their stubs past each other, so
 * the clearance shrinks to just under half the tightest such gap (never
 * below 4px).
 */
function fitClearance(boxes: readonly Box[], want: number): number {
  let c = want;
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i] as Box;
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j] as Box;
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
      const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
      if (overlapY > 0 && gapX > 0 && gapX < 2 * c + 2) c = Math.floor((gapX - 2) / 2);
      if (overlapX > 0 && gapY > 0 && gapY < 2 * c + 2) c = Math.floor((gapY - 2) / 2);
    }
  }
  return Math.max(4, c);
}

/**
 * Routes every edge. The result aligns with `edges` by index; an edge whose
 * endpoint is unknown is `undefined`. A self loop gets a small loop off the
 * node's top-right corner.
 */
export function routeEdges(
  nodes: readonly RouteNode[],
  edges: readonly RouteEdge[],
  opts: RouterOptions,
): Array<RoutedEdge | undefined> {
  const byId = new Map<string, RouteNode>();
  for (const n of nodes) if (!byId.has(n.id)) byId.set(n.id, n);
  const obOf = (n: RouteNode): Box => n.obstacle ?? n.box;
  const shapeOf = (n: RouteNode): PortShape => n.shape ?? 'rect';
  const solid = [...byId.values()].filter((n) => n.passable !== true);
  const obstacles = [...solid.map(obOf), ...(opts.obstacles ?? [])];
  const c = fitClearance(solid.map(obOf), opts.clearance ?? CLEAR);
  const loopBack = (opts.backEdges ?? 'loop') === 'loop';

  const out: Array<RoutedEdge | undefined> = edges.map(() => undefined);
  // Edges to route: known ends, distinct nodes, not stacked on each other.
  const todo: number[] = [];
  edges.forEach((e, i) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (a === undefined || b === undefined) return;
    if (e.from === e.to) {
      out[i] = selfLoop(a);
      return;
    }
    todo.push(i);
  });
  // Stable order: shortest first (the most constrained, straightest), by index.
  const dist = (i: number): number => {
    const e = edges[i] as RouteEdge;
    const a = obOf(byId.get(e.from) as RouteNode);
    const b = obOf(byId.get(e.to) as RouteNode);
    return Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
  };
  const order = [...todo].sort((p, q) => dist(p) - dist(q) || p - q);

  /* ---- pass 1: choose sides (any side may be used) ---- */
  // Each side offers its centre and, when the other end's facing side
  // overlaps it, the shared coordinate — so two nodes that partly line up get
  // a straight edge instead of a dogleg between the two centres.
  const opposite: Record<Side, Side> = { L: 'R', R: 'L', T: 'B', B: 'T' };
  const portsFor = (n: RouteNode, other: RouteNode, s: Side): number[] => {
    const pr = portRange(s, n.box, shapeOf(n), n.radius);
    const list = [pr.mid];
    if (relation(s, obOf(n), obOf(other)) !== 'toward') return list;
    const opr = portRange(opposite[s], other.box, shapeOf(other), other.radius);
    const lo = Math.max(pr.lo, opr.lo);
    const hi = Math.min(pr.hi, opr.hi);
    if (lo > hi) return list;
    const v = Math.round(Math.min(hi, Math.max(lo, (pr.mid + opr.mid) / 2)));
    if (v !== pr.mid) list.push(v);
    return list;
  };
  const centreX = [...byId.values()].map((n) => Math.round(cx(n.box)));
  const centreY = [...byId.values()].map((n) => Math.round(cy(n.box)));
  for (const i of order) {
    const e = edges[i] as RouteEdge;
    const A = byId.get(e.from) as RouteNode;
    const B = byId.get(e.to) as RouteNode;
    for (const sd of SIDES) {
      const extra = [...portsFor(A, B, sd).slice(1), ...portsFor(B, A, sd).slice(1)];
      (horizontalSide(sd) ? centreY : centreX).push(...extra);
    }
  }
  const rails = opts.rails ?? [];
  // Pass 1 only picks sides: channel centres are enough, no parallel tracks.
  const careful = order.length <= CAREFUL_EDGES;
  const grid1 = buildGrid(
    obstacles,
    opts.bounds,
    c,
    centreX,
    centreY,
    rails,
    0,
    careful ? CROSS_SIDES : CROSS,
  );
  const sc1 = newScratch(grid1);
  const sideOf = new Map<number, { exit: Side; entry: Side; pts: Pt[] }>();
  for (const i of order) {
    const e = edges[i] as RouteEdge;
    const A = byId.get(e.from) as RouteNode;
    const B = byId.get(e.to) as RouteNode;
    const back = loopBack && isBackEdge(opts.dir, obOf(A), obOf(B));
    const terminals = (n: RouteNode, other: RouteNode): Terminal[] =>
      SIDES.flatMap((s) =>
        portsFor(n, other, s).map((t) => ({
          idx: gridIndex(grid1, stubPoint(s, obOf(n), t, c)),
          side: s,
          cost: sidePenalty(s, obOf(n), obOf(other), opts.dir, back),
          t,
        })),
      );
    const tried = search(grid1, sc1, terminals(A, B), terminals(B, A), 1, SEARCH_BUDGET);
    const res =
      tried === 'budget'
        ? search(grid1, sc1, terminals(A, B), terminals(B, A), GREEDY_WEIGHT)
        : tried;
    if (res === undefined || res === 'budget') continue;
    const ta = res.start.t ?? portRange(res.start.side, A.box, shapeOf(A), A.radius).mid;
    const tb = res.goal.t ?? portRange(res.goal.side, B.box, shapeOf(B), B.radius).mid;
    const pa = attachPoint(res.start.side, A.box, shapeOf(A), ta);
    const pb = attachPoint(res.goal.side, B.box, shapeOf(B), tb);
    const pts = simplify([pa, ...res.path.map((idx) => gridPoint(grid1, idx)), pb]);
    sideOf.set(i, { exit: res.start.side, entry: res.goal.side, pts });
    // Later (longer) edges see this one and avoid cutting across it.
    if (careful) markPassing(grid1, res.path);
  }

  /* ---- ports: spread the edges that share a side ---- */
  /**
   * Port coordinates (`${edge}:${end}` → coordinate along the side) for the
   * routes `pathOf` gives: the pass-1 routes, or, in the second round, the
   * routes pass 2 actually took.
   */
  const assignPorts = (
    pathOf: (edge: number, pass1: readonly Pt[]) => readonly Pt[],
  ): Map<string, number> => {
    const ends = new Map<string, EndInfo[]>();
    for (const i of order) {
      const s = sideOf.get(i);
      if (s === undefined) continue;
      const e = edges[i] as RouteEdge;
      const A = byId.get(e.from) as RouteNode;
      const B = byId.get(e.to) as RouteNode;
      const path = pathOf(i, s.pts);
      const back = [...path].reverse();
      const tA = turnOf(path, s.exit);
      const tB = turnOf(back, s.entry);
      const along = (side: Side, n: RouteNode): number =>
        horizontalSide(side) ? cy(n.box) : cx(n.box);
      const push = (info: EndInfo): void => {
        const key = `${info.node}\u0000${info.side}`;
        ends.set(key, [...(ends.get(key) ?? []), info]);
      };
      push({
        edge: i,
        end: 0,
        node: e.from,
        side: s.exit,
        lateral: tA.lateral,
        run: tA.run,
        other: along(s.exit, B),
        path,
      });
      push({
        edge: i,
        end: 1,
        node: e.to,
        side: s.entry,
        lateral: tB.lateral,
        run: tB.run,
        other: along(s.entry, A),
        path: back,
      });
    }
    const port = new Map<string, number>(); // `${edge}:${end}` → coordinate along the side
    interface PortGroup {
      readonly keys: string[];
      readonly lo: number;
      readonly hi: number;
      /** Spacing between neighbouring ports on this side. */
      readonly step: number;
    }
    const groupOf = new Map<string, PortGroup>();
    for (const [, list] of [...ends.entries()].sort((p, q) =>
      p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0,
    )) {
      const first = list[0] as EndInfo;
      const n = byId.get(first.node) as RouteNode;
      const pr = portRange(first.side, n.box, shapeOf(n), n.radius);
      // Looking outward, "left" is the low end of the side for R and T.
      const leftIsLow = first.side === 'R' || first.side === 'T';
      const sorted = [...list].sort((p, q) => {
        const o = bundleOrder(p.path, q.path);
        if (o !== 0) return leftIsLow ? -o : o;
        const gp = p.lateral < 0 ? 0 : p.lateral === 0 ? 1 : 2;
        const gq = q.lateral < 0 ? 0 : q.lateral === 0 ? 1 : 2;
        if (gp !== gq) return gp - gq;
        if (gp === 0 && p.run !== q.run) return p.run - q.run;
        if (gp === 2 && p.run !== q.run) return q.run - p.run;
        if (gp === 1 && p.other !== q.other) return p.other - q.other;
        return p.edge - q.edge || p.end - q.end;
      });
      const k = sorted.length;
      const step = k > 1 ? Math.min(PORT_STEP, (pr.hi - pr.lo) / (k - 1)) : PORT_STEP;
      const group: PortGroup = {
        keys: sorted.map((info) => `${info.edge}:${info.end}`),
        lo: pr.lo,
        hi: pr.hi,
        step,
      };
      sorted.forEach((info, idx) => {
        const key = `${info.edge}:${info.end}`;
        port.set(key, Math.round(pr.mid + (idx - (k - 1) / 2) * (k > 1 ? step : 0)));
        groupOf.set(key, group);
      });
    }
    // An edge between two facing sides lines its two ports up, so a straight
    // edge stays straight instead of taking a jog: both ports move to a shared
    // coordinate and the other ports on each side shift apart to keep their
    // order and spacing. A port lined up once stays put; when a side has no
    // room, the edge keeps its jog.
    const pinned = new Set<string>();
    /** New positions for `key`'s side with `key` at `v`, or undefined when that cannot be done. */
    const shifted = (key: string, v: number): Map<string, number> | undefined => {
      const g = groupOf.get(key);
      if (g === undefined || v < g.lo || v > g.hi) return undefined;
      const at = g.keys.indexOf(key);
      const pos = g.keys.map((k) => port.get(k) as number);
      if (pinned.has(key) && pos[at] !== v) return undefined;
      pos[at] = v;
      for (let j = at - 1; j >= 0; j--) {
        const want = Math.min(pos[j] as number, (pos[j + 1] as number) - g.step);
        if (want !== pos[j] && pinned.has(g.keys[j] as string)) return undefined;
        pos[j] = Math.round(want);
        if (want < g.lo) return undefined;
      }
      for (let j = at + 1; j < pos.length; j++) {
        const want = Math.max(pos[j] as number, (pos[j - 1] as number) + g.step);
        if (want !== pos[j] && pinned.has(g.keys[j] as string)) return undefined;
        pos[j] = Math.round(want);
        if (want > g.hi) return undefined;
      }
      return new Map(g.keys.map((k, j) => [k, pos[j] as number]));
    };
    for (const i of order) {
      const sd = sideOf.get(i);
      if (sd === undefined) continue;
      const facing =
        (sd.exit === 'R' && sd.entry === 'L') ||
        (sd.exit === 'L' && sd.entry === 'R') ||
        (sd.exit === 'B' && sd.entry === 'T') ||
        (sd.exit === 'T' && sd.entry === 'B');
      if (!facing) continue;
      const kA = `${i}:0`;
      const kB = `${i}:1`;
      const vA = port.get(kA);
      const vB = port.get(kB);
      const gA = groupOf.get(kA);
      const gB = groupOf.get(kB);
      if (vA === undefined || vB === undefined || gA === undefined || gB === undefined) continue;
      const lo = Math.max(gA.lo, gB.lo);
      const hi = Math.min(gA.hi, gB.hi);
      if (lo > hi) continue;
      const clamp = (v: number): number => Math.round(Math.min(hi, Math.max(lo, v)));
      const tries = pinned.has(kA)
        ? [vA]
        : pinned.has(kB)
          ? [vB]
          : [clamp((vA + vB) / 2), clamp(vA), clamp(vB)];
      for (const v of [...new Set(tries)]) {
        const a = shifted(kA, v);
        const b = shifted(kB, v);
        if (a === undefined || b === undefined) continue;
        for (const [k, x] of a) port.set(k, x);
        for (const [k, x] of b) port.set(k, x);
        pinned.add(kA);
        pinned.add(kB);
        break;
      }
    }

    // Two ports of different edges that face each other across one channel on
    // the same line (an exit on X's right side, an entry on Y's left side, at
    // the same height) would put the two routes on one line: pull one of them
    // a step aside.
    const portEnds: Array<{ key: string; node: RouteNode; side: Side; edge: number }> = [];
    for (const i of order) {
      const sd = sideOf.get(i);
      if (sd === undefined) continue;
      const e = edges[i] as RouteEdge;
      portEnds.push({ key: `${i}:0`, node: byId.get(e.from) as RouteNode, side: sd.exit, edge: i });
      portEnds.push({ key: `${i}:1`, node: byId.get(e.to) as RouteNode, side: sd.entry, edge: i });
    }
    const faces = (
      a: { node: RouteNode; side: Side },
      b: { node: RouteNode; side: Side },
    ): boolean => {
      if (b.side !== opposite[a.side]) return false;
      const pa = obOf(a.node);
      const pb = obOf(b.node);
      const gap = Math.max(
        pb.x - (pa.x + pa.w),
        pa.x - (pb.x + pb.w),
        pb.y - (pa.y + pa.h),
        pa.y - (pb.y + pb.h),
      );
      return relation(a.side, pa, pb) === 'toward' && gap <= 4 * CLEAR + 8 * TRACK;
    };
    for (const a of portEnds) {
      for (const b of portEnds) {
        if (a.edge >= b.edge || !faces(a, b)) continue;
        const va = port.get(a.key);
        const vb = port.get(b.key);
        if (va === undefined || vb === undefined || Math.abs(va - vb) >= TRACK) continue;
        const g = groupOf.get(b.key);
        const step = Math.max(TRACK, g?.step ?? TRACK);
        const moves: Array<[string, number]> = [
          [b.key, vb + step],
          [b.key, vb - step],
          [a.key, va + step],
          [a.key, va - step],
        ];
        for (const [k, v] of moves) {
          const next = shifted(k, v);
          if (next === undefined) continue;
          for (const [kk, x] of next) port.set(kk, x);
          break;
        }
      }
    }
    return port;
  };

  /* ---- pass 2: route with fixed sides and ports, then nudge ---- */
  const routeWith = (
    port: ReadonlyMap<string, number>,
  ): { polylines: Array<Pt[] | undefined>; sides: Map<number, { exit: Side; entry: Side }> } => {
    const xPorts: number[] = [];
    const yPorts: number[] = [];
    for (const i of order) {
      const s = sideOf.get(i);
      if (s === undefined) continue;
      const a = port.get(`${i}:0`);
      const b = port.get(`${i}:1`);
      if (a !== undefined) (horizontalSide(s.exit) ? yPorts : xPorts).push(a);
      if (b !== undefined) (horizontalSide(s.entry) ? yPorts : xPorts).push(b);
    }
    const grid = buildGrid(obstacles, opts.bounds, c, xPorts, yPorts, rails);
    const sc = newScratch(grid);
    const polylines: Array<Pt[] | undefined> = edges.map(() => undefined);
    const sides = new Map<number, { exit: Side; entry: Side }>();
    for (const i of order) {
      const s = sideOf.get(i);
      const e = edges[i] as RouteEdge;
      const A = byId.get(e.from) as RouteNode;
      const B = byId.get(e.to) as RouteNode;
      if (s === undefined) {
        // No route found at all (should not happen): a straight centre line.
        const pts = simplify([
          { x: Math.round(cx(A.box)), y: Math.round(cy(A.box)) },
          { x: Math.round(cx(B.box)), y: Math.round(cy(A.box)) },
          { x: Math.round(cx(B.box)), y: Math.round(cy(B.box)) },
        ]);
        polylines[i] = pts;
        sides.set(i, { exit: 'R', entry: 'L' });
        continue;
      }
      const va = port.get(`${i}:0`) ?? portRange(s.exit, A.box, shapeOf(A), A.radius).mid;
      const vb = port.get(`${i}:1`) ?? portRange(s.entry, B.box, shapeOf(B), B.radius).mid;
      const sa = stubPoint(s.exit, obOf(A), va, c);
      const sb = stubPoint(s.entry, obOf(B), vb, c);
      const from = [{ idx: gridIndex(grid, sa), side: s.exit, cost: 0 }];
      const to = [{ idx: gridIndex(grid, sb), side: s.entry, cost: 0 }];
      // A route through a crowd of others can cost far above the estimate; past
      // the budget the search reruns greedily rather than explore every detour.
      const tried = search(grid, sc, from, to, PASS2_WEIGHT, SEARCH_BUDGET);
      const res = tried === 'budget' ? search(grid, sc, from, to, GREEDY_WEIGHT) : tried;
      const pa = attachPoint(s.exit, A.box, shapeOf(A), va);
      const pb = attachPoint(s.entry, B.box, shapeOf(B), vb);
      if (res === undefined || res === 'budget') {
        polylines[i] = simplify([pa, sa, { x: sa.x, y: sb.y }, sb, pb]);
      } else {
        occupy(grid, res.path);
        polylines[i] = simplify([pa, ...res.path.map((idx) => gridPoint(grid, idx)), pb]);
      }
      sides.set(i, { exit: s.exit, entry: s.entry });
    }

    // Nudge apart what still shares a channel, then fix the channel order.
    nudge(polylines, order, obstacles, opts.bounds, c);
    untangle(polylines, obstacles, opts.bounds, c);
    return { polylines, sides };
  };

  /** The routed edges (self loops included) for one set of polylines. */
  const finish = (r: ReturnType<typeof routeWith>): Array<RoutedEdge | undefined> => {
    const { polylines, sides } = r;
    const res = [...out];
    for (const i of order) {
      const pts = polylines[i];
      const sd = sides.get(i);
      if (pts === undefined || sd === undefined) continue;
      const e = edges[i] as RouteEdge;
      const clean = simplify(pts);
      const through: string[] = [];
      for (const n of solid) {
        const ob = obOf(n);
        const own = n.id === e.from || n.id === e.to;
        const hit = clean.some((p, k) => {
          const q = clean[k + 1];
          if (q === undefined) return false;
          // An end's own first / last segment runs into its own outline.
          if (own && (k === 0 || k === clean.length - 2)) return false;
          return segmentHitsBox(p, q, ob);
        });
        if (hit) through.push(n.id);
      }
      res[i] = { points: clean, d: polylinePath(clean), exit: sd.exit, entry: sd.entry, through };
    }
    return res;
  };

  const port1 = assignPorts((_, pass1) => pass1);
  const first = routeWith(port1);
  const firstOut = finish(first);
  const xings = countCrossings(firstOut);
  if (xings === 0 || !careful) return firstOut;
  // Second round: the ports were ordered by the pass-1 routes; where pass 2
  // took other ways, order them by the routes it took and route again. The
  // second result is kept only when it crosses less and enters no more nodes.
  const port2 = assignPorts((i, pass1) => first.polylines[i] ?? pass1);
  if ([...port2].every(([k, v]) => port1.get(k) === v)) return firstOut;
  const secondOut = finish(routeWith(port2));
  const thru = (rs: ReadonlyArray<RoutedEdge | undefined>): number =>
    rs.filter((r) => r !== undefined && r.through.length > 0).length;
  return thru(secondOut) <= thru(firstOut) && countCrossings(secondOut) < xings
    ? secondOut
    : firstOut;
}

/** Total proper crossings among a set of routes. */
export function countCrossings(routes: ReadonlyArray<RoutedEdge | undefined>): number {
  let n = 0;
  for (let i = 0; i < routes.length; i++) {
    const a = routes[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < routes.length; j++) {
      const b = routes[j];
      if (b === undefined) continue;
      n += crossingsBetween(a.points, b.points);
    }
  }
  return n;
}
