/**
 * The shared orthogonal router (`svg/router.ts`): no route enters a node that
 * is not one of its ends, parallel segments keep a track apart, an A→B / B→A
 * pair takes two separate routes, a back edge loops around its row, edges
 * that share a side spread their ports, and the output is integer,
 * deterministic and fast.
 */

import { describe, expect, it } from 'vitest';
import {
  countCrossings,
  moveOffLabels,
  polylinePath,
  routeEdges,
  segmentHitsBox,
  TRACK,
  type Pt,
  type RouteEdge,
  type RoutedEdge,
  type RouteNode,
} from '../svg/router.js';
import { edgeLabelLayer, labelForms } from '../svg/edgeSteps.js';

/** A grid of 150×52 boxes in 160×64 cells, 56px column gap, 48px row gap. */
const cell = (col: number, row: number): { x: number; y: number; w: number; h: number } => ({
  x: 22 + (col - 1) * 216 + 5,
  y: 22 + (row - 1) * 112 + 6,
  w: 150,
  h: 52,
});

function bounds(nodes: readonly RouteNode[]): { x: number; y: number; w: number; h: number } {
  const w = Math.max(...nodes.map((n) => n.box.x + n.box.w)) + 40;
  const h = Math.max(...nodes.map((n) => n.box.y + n.box.h)) + 40;
  return { x: 0, y: 0, w, h };
}

/** Every route's segments that pass through a node other than its own ends. */
function intrusions(
  nodes: readonly RouteNode[],
  edges: readonly RouteEdge[],
  routes: ReadonlyArray<RoutedEdge | undefined>,
): string[] {
  const out: string[] = [];
  routes.forEach((r, i) => {
    const e = edges[i];
    if (r === undefined || e === undefined) return;
    for (const n of nodes) {
      const own = n.id === e.from || n.id === e.to;
      for (let k = 0; k + 1 < r.points.length; k++) {
        if (own && (k === 0 || k === r.points.length - 2)) continue;
        if (segmentHitsBox(r.points[k] as Pt, r.points[k + 1] as Pt, n.box))
          out.push(`${e.from}->${e.to} through ${n.id}`);
      }
    }
  });
  return out;
}

/** Collinear overlapping segments of different edges closer than one track. */
function crowding(routes: ReadonlyArray<RoutedEdge | undefined>): string[] {
  const segs: Array<{
    e: number;
    horiz: boolean;
    at: number;
    lo: number;
    hi: number;
    first: boolean;
  }> = [];
  routes.forEach((r, e) => {
    if (r === undefined) return;
    for (let k = 0; k + 1 < r.points.length; k++) {
      const p = r.points[k] as Pt;
      const q = r.points[k + 1] as Pt;
      const end = k === 0 || k === r.points.length - 2;
      if (p.y === q.y)
        segs.push({
          e,
          horiz: true,
          at: p.y,
          lo: Math.min(p.x, q.x),
          hi: Math.max(p.x, q.x),
          first: end,
        });
      else
        segs.push({
          e,
          horiz: false,
          at: p.x,
          lo: Math.min(p.y, q.y),
          hi: Math.max(p.y, q.y),
          first: end,
        });
    }
  });
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i];
      const b = segs[j];
      if (a === undefined || b === undefined || a.e === b.e || a.horiz !== b.horiz) continue;
      const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      if (overlap > 2 && Math.abs(a.at - b.at) < TRACK)
        out.push(`edges ${a.e} and ${b.e} share a channel at ${a.at}`);
    }
  }
  return out;
}

describe('router: obstacles', () => {
  it('a skip edge over a node in between goes around it, never through it', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: cell(1, 1) },
      { id: 'b', box: cell(2, 1) },
      { id: 'c', box: cell(3, 1) },
    ];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ];
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: bounds(nodes) });
    expect(intrusions(nodes, edges, routes)).toEqual([]);
    expect(routes.every((r) => r !== undefined && r.through.length === 0)).toBe(true);
  });

  it('no route enters a non-endpoint node on a dense 4×3 grid with long and back edges', () => {
    const nodes: RouteNode[] = [];
    for (let r = 1; r <= 3; r++)
      for (let c = 1; c <= 4; c++) nodes.push({ id: `n${c}${r}`, box: cell(c, r) });
    const edges: RouteEdge[] = [
      { from: 'n11', to: 'n41' },
      { from: 'n11', to: 'n43' },
      { from: 'n12', to: 'n33' },
      { from: 'n41', to: 'n11' },
      { from: 'n23', to: 'n21' },
      { from: 'n32', to: 'n12' },
      { from: 'n13', to: 'n42' },
      { from: 'n22', to: 'n23' },
      { from: 'n31', to: 'n32' },
      { from: 'n42', to: 'n13' },
    ];
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: bounds(nodes) });
    expect(routes.every((r) => r !== undefined)).toBe(true);
    expect(intrusions(nodes, edges, routes)).toEqual([]);
  });

  it('a target walled in by touching nodes still gets a route, which names the node it crosses', () => {
    const t = { x: 200, y: 200, w: 100, h: 60 };
    const nodes: RouteNode[] = [
      { id: 'src', box: { x: 20, y: 200, w: 80, h: 60 } },
      { id: 't', box: t },
      // Four walls flush against each other: no gap anywhere around `t`.
      { id: 'wl', box: { x: 150, y: 150, w: 50, h: 160 } },
      { id: 'wr', box: { x: 300, y: 150, w: 50, h: 160 } },
      { id: 'wt', box: { x: 200, y: 150, w: 100, h: 50 } },
      { id: 'wb', box: { x: 200, y: 260, w: 100, h: 50 } },
    ];
    const [r] = routeEdges(nodes, [{ from: 'src', to: 't' }], {
      dir: 'LR',
      bounds: { x: 0, y: 0, w: 420, h: 400 },
    });
    expect(r).toBeDefined();
    expect(r?.through.length).toBeGreaterThan(0);
    expect(['wl', 'wr', 'wt', 'wb']).toContain(r?.through[0]);
  });

  it('endpoints attach on the outline of their own boxes', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: cell(1, 1) },
      { id: 'b', box: cell(2, 2) },
    ];
    const [r] = routeEdges(nodes, [{ from: 'a', to: 'b' }], { dir: 'LR', bounds: bounds(nodes) });
    const first = r?.points[0];
    const last = r?.points[(r?.points.length ?? 1) - 1];
    const onOutline = (
      p: Pt | undefined,
      b: { x: number; y: number; w: number; h: number },
    ): boolean =>
      p !== undefined &&
      (((p.x === b.x || p.x === b.x + b.w) && p.y >= b.y && p.y <= b.y + b.h) ||
        ((p.y === b.y || p.y === b.y + b.h) && p.x >= b.x && p.x <= b.x + b.w));
    expect(onOutline(first, cell(1, 1))).toBe(true);
    expect(onOutline(last, cell(2, 2))).toBe(true);
  });
});

describe('router: separation', () => {
  it('a fan-out from one side keeps every parallel segment a track apart', () => {
    const nodes: RouteNode[] = [
      { id: 'hub', box: cell(1, 2) },
      { id: 'a', box: cell(2, 1) },
      { id: 'b', box: cell(2, 2) },
      { id: 'c', box: cell(2, 3) },
      { id: 'd', box: cell(3, 1) },
      { id: 'e', box: cell(3, 3) },
    ];
    const edges = ['a', 'b', 'c', 'd', 'e'].map((to) => ({ from: 'hub', to }));
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: bounds(nodes) });
    expect(crowding(routes)).toEqual([]);
    expect(intrusions(nodes, edges, routes)).toEqual([]);
  });

  it('a bar node that fans out to three targets in a row leaves without a crossing', () => {
    // A tall bar (a load balancer) left of three columns; each column holds
    // its target on top with two more nodes below, so the routes to the
    // second and third target climb channels and must nest, not cross.
    const nodes: RouteNode[] = [{ id: 'bar', box: { x: 40, y: 40, w: 60, h: 300 } }];
    for (let k = 0; k < 3; k++) {
      const x = 180 + k * 200;
      nodes.push({ id: `t${k}`, box: { x, y: 40, w: 150, h: 52 } });
      nodes.push({ id: `w${k}`, box: { x, y: 150, w: 150, h: 52 } });
      nodes.push({ id: `d${k}`, box: { x, y: 260, w: 150, h: 52 } });
    }
    const edges = [0, 1, 2].map((k) => ({ from: 'bar', to: `t${k}` }));
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: { x: 0, y: 0, w: 820, h: 380 } });
    expect(countCrossings(routes)).toBe(0);
    expect(intrusions(nodes, edges, routes)).toEqual([]);
    expect(crowding(routes)).toEqual([]);
    // Bundle order at the bar: the nearest target takes the top port.
    const exits = routes.map((r) => r?.points[0]?.y ?? 0);
    expect(exits[0]).toBeLessThan(exits[1] as number);
    expect(exits[1]).toBeLessThan(exits[2] as number);
  });

  it('edges into one side get distinct entry ports (no stacked arrowheads)', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: cell(1, 1) },
      { id: 'b', box: cell(1, 2) },
      { id: 'c', box: cell(1, 3) },
      { id: 't', box: cell(2, 2) },
    ];
    const edges = ['a', 'b', 'c'].map((from) => ({ from, to: 't' }));
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: bounds(nodes) });
    const ends = routes.map((r) => {
      const p = r?.points[(r?.points.length ?? 1) - 1];
      return `${p?.x},${p?.y}`;
    });
    expect(new Set(ends).size).toBe(3);
  });

  it('an A→B / B→A pair takes two clearly separate routes', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: cell(1, 1) },
      { id: 'b', box: cell(1, 2) },
    ];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ];
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: bounds(nodes) });
    expect(routes[0]?.d).not.toBe(routes[1]?.d);
    expect(crowding(routes)).toEqual([]);
    // The two vertical runs stay at least one track apart.
    const xs = routes.map((r) => r?.points[0]?.x ?? 0);
    expect(Math.abs((xs[0] ?? 0) - (xs[1] ?? 0))).toBeGreaterThanOrEqual(TRACK);
  });

  it('a back edge loops around the row (across the flow) instead of retracing the forward edge', () => {
    const nodes: RouteNode[] = [
      { id: 'draft', box: cell(1, 1) },
      { id: 'check', box: cell(2, 1) },
    ];
    const edges = [
      { from: 'draft', to: 'check' },
      { from: 'check', to: 'draft' },
    ];
    const routes = routeEdges(nodes, edges, { dir: 'LR', bounds: { x: 0, y: 0, w: 500, h: 160 } });
    expect(routes[0]?.exit).toBe('R');
    expect(routes[0]?.entry).toBe('L');
    expect(['T', 'B']).toContain(routes[1]?.exit);
    expect(routes[1]?.entry).toBe(routes[1]?.exit);
    expect(crowding(routes)).toEqual([]);
  });

  it('moveOffLabels moves another edge off a label but never into a node', () => {
    const route: RoutedEdge = {
      points: [
        { x: 300, y: 200 },
        { x: 300, y: 160 },
        { x: 100, y: 160 },
        { x: 100, y: 120 },
      ],
      d: '',
      exit: 'T',
      entry: 'B',
      through: [],
    };
    const [moved] = moveOffLabels(
      [route],
      [{ box: { x: 180, y: 153, w: 40, h: 14 }, edge: 9 }],
      [
        { x: 250, y: 200, w: 100, h: 50 },
        { x: 50, y: 70, w: 100, h: 50 },
      ],
      { x: 0, y: 0, w: 400, h: 300 },
    );
    const mid = moved?.points[1];
    expect(mid?.y).not.toBe(160);
    expect(Math.abs((mid?.y ?? 0) - 160)).toBeGreaterThanOrEqual(TRACK);
  });
});

describe('router: shapes, output and determinism', () => {
  it('a diamond takes its arrow at the outline, not the bounding box', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: cell(1, 1) },
      { id: 'd', box: { x: 238, y: 22, w: 160, h: 64 }, shape: 'diamond' },
    ];
    const [r] = routeEdges(nodes, [{ from: 'a', to: 'd' }], {
      dir: 'LR',
      bounds: { x: 0, y: 0, w: 450, h: 120 },
    });
    const tip = r?.points[(r?.points.length ?? 1) - 1];
    // Straight in at the left vertex.
    expect(tip).toEqual({ x: 238, y: 54 });
  });

  it('every coordinate is an integer and the path is orthogonal', () => {
    const nodes: RouteNode[] = [
      { id: 'a', box: { x: 10.5, y: 10, w: 101, h: 47 } },
      { id: 'b', box: { x: 220, y: 133.5, w: 97, h: 51 } },
      { id: 'c', box: { x: 400, y: 20, w: 120, h: 40 }, shape: 'round' },
    ];
    const routes = routeEdges(
      nodes,
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
      { dir: 'LR', bounds: { x: 0, y: 0, w: 600, h: 260 } },
    );
    for (const r of routes) {
      expect(r).toBeDefined();
      for (let k = 0; k + 1 < (r?.points.length ?? 0); k++) {
        const p = r?.points[k] as Pt;
        const q = r?.points[k + 1] as Pt;
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        expect(p.x === q.x || p.y === q.y).toBe(true);
      }
      expect(r?.d).not.toMatch(/\d\.\d/);
    }
  });

  it('the same input routes to byte-identical output', () => {
    const nodes: RouteNode[] = [];
    for (let r = 1; r <= 3; r++)
      for (let c = 1; c <= 3; c++) nodes.push({ id: `n${c}${r}`, box: cell(c, r) });
    const edges: RouteEdge[] = [
      { from: 'n11', to: 'n33' },
      { from: 'n31', to: 'n13' },
      { from: 'n22', to: 'n11' },
      { from: 'n12', to: 'n32' },
    ];
    const opts = { dir: 'LR' as const, bounds: bounds(nodes) };
    expect(JSON.stringify(routeEdges(nodes, edges, opts))).toBe(
      JSON.stringify(routeEdges(nodes, edges, opts)),
    );
  });

  it('a self loop is a small orthogonal loop off the node', () => {
    const nodes: RouteNode[] = [{ id: 'a', box: cell(1, 1) }];
    const [r] = routeEdges(nodes, [{ from: 'a', to: 'a' }], {
      dir: 'LR',
      bounds: { x: 0, y: 0, w: 300, h: 120 },
    });
    expect(r?.points.length).toBe(5);
    expect(r?.through).toEqual([]);
  });

  it('routes 60 nodes and 100 edges well inside 50 ms', () => {
    const nodes: RouteNode[] = [];
    for (let r = 1; r <= 6; r++)
      for (let c = 1; c <= 10; c++) nodes.push({ id: `n${c}-${r}`, box: cell(c, r) });
    // A diagram-like mix: chains along each row, some drops between rows,
    // and a deterministic spread of long and back edges.
    const edges: RouteEdge[] = [];
    for (let r = 1; r <= 6; r++)
      for (let c = 1; c < 10; c++) edges.push({ from: `n${c}-${r}`, to: `n${c + 1}-${r}` });
    for (let c = 1; c <= 10; c += 2)
      for (let r = 1; r < 6; r += 2) edges.push({ from: `n${c}-${r}`, to: `n${c}-${r + 1}` });
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    while (edges.length < 100) {
      const a = nodes[next() % nodes.length];
      const b = nodes[next() % nodes.length];
      if (a === undefined || b === undefined || a === b) continue;
      edges.push({ from: a.id, to: b.id });
    }
    const opts = { dir: 'LR' as const, bounds: bounds(nodes) };
    routeEdges(nodes, edges, opts); // warm the JIT
    // Best of five: the full suite runs files in parallel, and one sample can
    // catch a scheduler stall that says nothing about the router.
    let ms = Number.POSITIVE_INFINITY;
    let routes = routeEdges(nodes, edges, opts);
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      routes = routeEdges(nodes, edges, opts);
      ms = Math.min(ms, performance.now() - t0);
    }
    expect(routes.filter((r) => r !== undefined).length).toBe(100);
    expect(intrusions(nodes, edges, routes)).toEqual([]);
    expect(ms).toBeLessThan(50);
  });

  it('polylinePath rounds each bend with a small quadratic corner', () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
      ]),
    ).toBe('M 0 0 L 35 0 Q 40 0 40 5 L 40 30');
  });
});

describe('edge labels on their edge', () => {
  it('a label sits on its own route (on the longest straight run), not in a legend', () => {
    const points = [
      { x: 0, y: 50 },
      { x: 30, y: 50 },
      { x: 30, y: 10 },
      { x: 300, y: 10 },
    ];
    const layer = edgeLabelLayer(
      [{ lx: 0, ly: 0, points, label: 'publishes', path: 'edges.0' }],
      [],
      { skin: true },
    );
    expect(layer.fallbacks).toEqual([]);
    expect(layer.legend).toBe('');
    expect(layer.overlay).toContain('class="t-arrow"');
    expect(layer.overlay).toContain('data-bp="edges.0"');
    const box = layer.boxes[0];
    // On the 270px horizontal run at y = 10.
    expect(box !== undefined && box.y < 10 && box.y + box.h > 10).toBe(true);
  });

  it('a long label wraps to two lines, never more, and never drops a word', () => {
    const forms = labelForms('retry with exponential backoff and jitter after a timeout');
    for (const f of forms) expect(f.length).toBeLessThanOrEqual(2);
    for (const f of forms)
      expect(f.join(' ')).toBe('retry with exponential backoff and jitter after a timeout');
  });

  it('only a label with no clear spot falls back to a numeral plus a legend entry', () => {
    const points = [
      { x: 0, y: 50 },
      { x: 20, y: 50 },
    ];
    // Nodes 10px either side of the line: no mask fits between them.
    const wall = [
      { x: -100, y: -100, w: 400, h: 140 },
      { x: -100, y: 60, w: 400, h: 100 },
      { x: -100, y: 40, w: 90, h: 20 },
      { x: 30, y: 40, w: 300, h: 20 },
    ];
    const layer = edgeLabelLayer(
      [{ lx: 10, ly: 50, points, label: 'far too long for this', path: 'edges.4' }],
      wall,
      {
        skin: true,
      },
    );
    expect(layer.fallbacks).toEqual(['edges.4']);
    expect(layer.legend).toContain(
      '<span class="edge-step" data-bp="edges.4"><b>1</b>far too long for this</span>',
    );
  });
});
