/**
 * Auto-layout for a `c4` diagram whose author gave no coordinates.
 *
 * A C4 diagram reads from the people down: the people sit on the top row,
 * the system in scope (or the boundary around its containers) in the middle,
 * and what it depends on below it or to its side. A generic layered layout
 * ranks by the longest path, which pushes a person who only receives an
 * e-mail to the bottom and stacks a web app over the single-page app it
 * serves. This layout ranks by **hops from the people** instead:
 *
 * 1. **Rows.** Every person is on row 0. Every other element sits one row
 *    below the nearest element that calls it (a breadth-first walk from the
 *    people along the arrows). An element no walk reaches (it only calls
 *    in) sits beside the element it calls. With no people, the walk starts
 *    at the elements nothing calls.
 * 2. **Order.** Barycentre sweeps order each row to cut crossings. On the
 *    rows the boundary spans, its members stay together and every other
 *    element moves to the side it connects to, so the boundary stays a
 *    rectangle that encloses only its own elements.
 * 3. **Columns.** Each row takes integer columns close to the columns of
 *    its neighbours (a small dynamic programme per row, a few sweeps), so
 *    most arrows run straight and short rows sit centred.
 *
 * Pure and deterministic: the same nodes and edges give the same grid.
 */

/** One element as the layout sees it. */
export interface C4LayoutNode {
  readonly id: string;
  readonly kind: string;
}

/** One relationship as the layout sees it. */
export interface C4LayoutEdge {
  readonly from: string;
  readonly to: string;
}

/** A 1-based grid cell. */
export interface C4Cell {
  readonly col: number;
  readonly row: number;
}

/** Sweeps of the ordering and the column passes. */
const ROUNDS = 4;
/** A row this short tries every order of its elements. */
const PERMUTE_MAX = 7;

/** Every order of `items` (Heap's algorithm), the given order excluded. */
function permutations<T>(items: readonly T[]): T[][] {
  const a = [...items];
  const out: T[][] = [];
  const c = new Array<number>(a.length).fill(0);
  let i = 1;
  while (i < a.length) {
    if ((c[i] as number) < i) {
      const k = i % 2 === 0 ? 0 : (c[i] as number);
      [a[k], a[i]] = [a[i] as T, a[k] as T];
      out.push([...a]);
      c[i] = (c[i] as number) + 1;
      i = 1;
    } else {
      c[i] = 0;
      i++;
    }
  }
  return out;
}

/**
 * Places every element on the grid (see the module comment). `scope` holds
 * the ids the boundary encloses; `dir: LR` turns the result on its side
 * (people in the first column).
 */
export function c4Grid(
  nodes: readonly C4LayoutNode[],
  edges: readonly C4LayoutEdge[],
  scope: ReadonlySet<string>,
  dir: 'TB' | 'LR',
): Map<string, C4Cell> {
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const links = edges.filter((e) => e.from !== e.to && known.has(e.from) && known.has(e.to));
  const outs = new Map<string, string[]>(ids.map((id) => [id, []]));
  const nbrs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of links) {
    outs.get(e.from)?.push(e.to);
    nbrs.get(e.from)?.push(e.to);
    nbrs.get(e.to)?.push(e.from);
  }

  const rowOf = ranks(nodes, links, outs);
  spreadOutsiders(nodes, links, scope, rowOf);
  // Compact the rows: no empty row between two used ones.
  const used = [...new Set(rowOf.values())].sort((a, b) => a - b);
  const rowIndex = new Map(used.map((r, i) => [r, i]));
  const rows: string[][] = used.map(() => []);
  for (const id of ids) rows[rowIndex.get(rowOf.get(id) ?? 0) ?? 0]?.push(id);
  const row = new Map<string, number>();
  rows.forEach((list, r) => list.forEach((id) => row.set(id, r)));

  // The rows the boundary spans.
  const scopeRows = [...scope].filter((id) => row.has(id)).map((id) => row.get(id) as number);
  const s0 = scopeRows.length > 0 ? Math.min(...scopeRows) : Infinity;
  const s1 = scopeRows.length > 0 ? Math.max(...scopeRows) : -Infinity;
  const inSpan = (r: number): boolean => r >= s0 && r <= s1;

  // ── 2. order within each row ──────────────────────────────────────────
  const pos = new Map<string, number>();
  const setPos = (): void => rows.forEach((list) => list.forEach((id, i) => pos.set(id, i)));
  setPos();
  const bary = (id: string, near: (other: string) => boolean): number | undefined => {
    const xs = (nbrs.get(id) ?? []).filter(near).map((o) => pos.get(o) ?? 0);
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
  };
  const sortRow = (r: number, ref: number): void => {
    const list = rows[r] ?? [];
    const key = new Map(list.map((id) => [id, bary(id, (o) => row.get(o) === ref) ?? pos.get(id) ?? 0]));
    list.sort((a, b) => (key.get(a) ?? 0) - (key.get(b) ?? 0) || (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
    list.forEach((id, i) => pos.set(id, i));
  };
  let best = rows.map((l) => [...l]);
  let bestX = crossings(rows, links, row, pos);
  for (let round = 0; round < ROUNDS; round++) {
    for (let r = 1; r < rows.length; r++) sortRow(r, r - 1);
    for (let r = rows.length - 2; r >= 0; r--) sortRow(r, r + 1);
    const x = crossings(rows, links, row, pos);
    if (x < bestX) {
      bestX = x;
      best = rows.map((l) => [...l]);
    }
  }
  best.forEach((l, r) => (rows[r] = l));
  setPos();
  // A short row tries every order: fewest crossings with the rows around it,
  // and two elements that talk to each other side by side.
  for (let round = 0; round < 2; round++) {
    for (let r = 0; r < rows.length; r++) {
      const list = rows[r] ?? [];
      if (list.length < 2 || list.length > PERMUTE_MAX) continue;
      let bestList = [...list];
      let bestCost = rowCost(r, list);
      for (const perm of permutations(list)) {
        const c = rowCost(r, perm);
        if (c < bestCost - 1e-9) {
          bestCost = c;
          bestList = perm;
        }
      }
      rows[r] = bestList;
      bestList.forEach((id, i) => pos.set(id, i));
    }
  }
  function rowCost(r: number, list: readonly string[]): number {
    const at = new Map(list.map((id, i) => [id, i]));
    const p = (id: string): number => at.get(id) ?? pos.get(id) ?? 0;
    let cost = 0;
    for (const ref of [r - 1, r + 1]) {
      if (ref < 0 || ref >= rows.length) continue;
      const pairs: Array<[number, number]> = [];
      for (const e of links) {
        const a = row.get(e.from);
        const b = row.get(e.to);
        if (a === r && b === ref) pairs.push([p(e.from), pos.get(e.to) ?? 0]);
        else if (a === ref && b === r) pairs.push([p(e.to), pos.get(e.from) ?? 0]);
      }
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const [a1, b1] = pairs[i] as [number, number];
          const [a2, b2] = pairs[j] as [number, number];
          if ((a1 - a2) * (b1 - b2) < 0) cost += 1;
        }
      }
    }
    // An arrow along the row past other elements detours round each of them.
    for (const e of links) {
      if (row.get(e.from) !== r || row.get(e.to) !== r) continue;
      cost += 3 * (Math.abs(p(e.from) - p(e.to)) - 1);
    }
    // Members of the boundary together: an outsider between two of them costs.
    if (inSpan(r)) {
      const idx = list.map((id, i) => (scope.has(id) ? i : -1)).filter((i) => i >= 0);
      if (idx.length > 1) {
        const lo = Math.min(...idx);
        const hi = Math.max(...idx);
        for (let i = lo; i <= hi; i++) if (!scope.has(list[i] as string)) cost += 3;
      }
    }
    return cost;
  }

  // On the boundary's rows: left outsiders, the members, right outsiders.
  const side = new Map<string, 'L' | 'R'>();
  rows.forEach((list, r) => {
    if (!inSpan(r)) return;
    const members = list.filter((id) => scope.has(id));
    const centre = members.length > 0 ? members.reduce((a, id) => a + (pos.get(id) ?? 0), 0) / members.length : 0;
    const left: string[] = [];
    const right: string[] = [];
    // The sweeps set each outsider where its neighbours pull it; it keeps that side.
    for (const id of list) {
      if (scope.has(id)) continue;
      if ((pos.get(id) ?? 0) < centre) left.push(id);
      else right.push(id);
    }
    left.forEach((id) => side.set(id, 'L'));
    right.forEach((id) => side.set(id, 'R'));
    rows[r] = [...left, ...members, ...right];
  });
  setPos();

  // ── 3. columns ────────────────────────────────────────────────────────
  const spanRows = rows.filter((_, r) => inSpan(r));
  const sw = Math.max(0, ...spanRows.map((l) => l.filter((id) => scope.has(id)).length));
  const lMax = Math.max(0, ...spanRows.map((l) => l.filter((id) => side.get(id) === 'L').length));
  const rMax = Math.max(0, ...spanRows.map((l) => l.filter((id) => side.get(id) === 'R').length));
  const width = Math.max(lMax + sw + rMax, ...rows.map((l) => l.length), 1);
  /** The columns an element may take. */
  const range = (id: string, r: number): readonly [number, number] => {
    if (!inSpan(r)) return [0, width - 1];
    if (scope.has(id)) return [lMax, lMax + sw - 1];
    return side.get(id) === 'L' ? [0, lMax - 1] : [lMax + sw, width - 1];
  };
  const col = new Map<string, number>();
  // Start centred.
  rows.forEach((list, r) => {
    const off = (width - list.length) / 2;
    placeRow(list, r, (id, i) => off + i);
  });
  function placeRow(list: readonly string[], r: number, ideal: (id: string, i: number) => number): void {
    // An element with more arrows pulls harder towards its neighbours.
    const cols = fitRow(
      list.map((id, i) => ({ ideal: ideal(id, i), range: range(id, r), weight: Math.max(1, (nbrs.get(id) ?? []).length) })),
      width,
    );
    list.forEach((id, i) => col.set(id, cols[i] ?? i));
  }
  const pull = (id: string, i: number, list: readonly string[]): number => {
    const xs = (nbrs.get(id) ?? []).map((o) => col.get(o)).filter((c): c is number => c !== undefined);
    if (xs.length === 0) return (width - list.length) / 2 + i;
    xs.sort((a, b) => a - b);
    const m = xs.length >> 1;
    return xs.length % 2 === 1 ? (xs[m] as number) : ((xs[m - 1] as number) + (xs[m] as number)) / 2;
  };
  for (let round = 0; round < ROUNDS; round++) {
    const order = round % 2 === 0 ? rows.map((_, r) => r) : rows.map((_, r) => rows.length - 1 - r);
    for (const r of order) {
      const list = rows[r] ?? [];
      placeRow(list, r, (id, i) => pull(id, i, list));
    }
  }

  // Drop the columns no element takes.
  const taken = [...new Set(col.values())].sort((a, b) => a - b);
  const colIndex = new Map(taken.map((c, i) => [c, i]));
  const out = new Map<string, C4Cell>();
  for (const id of ids) {
    const c = (colIndex.get(col.get(id) ?? 0) ?? 0) + 1;
    const r = (row.get(id) ?? 0) + 1;
    out.set(id, dir === 'LR' ? { col: r, row: c } : { col: c, row: r });
  }
  return out;
}

/**
 * Rows by hops from the people (see the module comment): a breadth-first
 * walk along the arrows; an element no walk reaches sits beside the first
 * element it calls, or on the first row below the people when it calls
 * nothing that was placed.
 */
function ranks(
  nodes: readonly C4LayoutNode[],
  links: readonly C4LayoutEdge[],
  outs: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const rank = new Map<string, number>();
  const people = nodes.filter((n) => n.kind === 'person').map((n) => n.id);
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of links) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  let roots = people;
  if (roots.length === 0) roots = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (roots.length === 0 && nodes[0] !== undefined) roots = [nodes[0].id];
  const floor = people.length > 0 ? 1 : 0;
  const walk = (start: readonly string[]): void => {
    const queue = [...start];
    while (queue.length > 0) {
      const u = queue.shift() as string;
      for (const v of outs.get(u) ?? []) {
        if (rank.has(v)) continue;
        rank.set(v, Math.max(floor, (rank.get(u) ?? 0) + 1));
        queue.push(v);
      }
    }
  };
  for (const r of roots) rank.set(r, 0);
  walk(roots);
  // Elements no walk reached: beside what they call, then walk on from them.
  for (let guard = 0; guard < nodes.length; guard++) {
    const next = nodes.find((n) => !rank.has(n.id) && (outs.get(n.id) ?? []).some((v) => rank.has(v)));
    if (next === undefined) break;
    const targets = (outs.get(next.id) ?? []).filter((v) => rank.has(v)).map((v) => rank.get(v) as number);
    rank.set(next.id, Math.max(floor, Math.min(...targets)));
    walk([next.id]);
  }
  for (const n of nodes) {
    if (rank.has(n.id)) continue;
    rank.set(n.id, n.kind === 'person' ? 0 : floor);
    walk([n.id]);
  }
  // An element that calls a person back (sends the e-mail, pushes the alert)
  // sits on the first row under the people, so its arrow is short.
  if (people.length > 0) {
    const isPerson = new Set(people);
    for (const n of nodes) {
      if (isPerson.has(n.id)) continue;
      if ((outs.get(n.id) ?? []).some((v) => isPerson.has(v))) rank.set(n.id, floor);
    }
  }
  return rank;
}

/**
 * Two elements outside the boundary on one row widen the drawing by two
 * columns. An outsider that a row above calls moves up beside its caller
 * when that row holds fewer outsiders, so the outsiders line the side of
 * the boundary instead of widening it. People never move; nothing moves
 * onto the people's row.
 */
function spreadOutsiders(
  nodes: readonly C4LayoutNode[],
  links: readonly C4LayoutEdge[],
  scope: ReadonlySet<string>,
  rank: Map<string, number>,
): void {
  if (scope.size === 0) return;
  const floor = nodes.some((n) => n.kind === 'person') ? 1 : 0;
  const outsider = (n: C4LayoutNode): boolean => n.kind !== 'person' && !scope.has(n.id);
  const count = (r: number): number => nodes.filter((n) => outsider(n) && rank.get(n.id) === r).length;
  for (let guard = 0; guard < nodes.length; guard++) {
    let moved = false;
    for (const n of [...nodes].reverse()) {
      if (!outsider(n)) continue;
      const r = rank.get(n.id) ?? 0;
      if (r - 1 < floor || count(r) < 2 || count(r - 1) + 1 > count(r) - 1) continue;
      const calledFromAbove = links.some((e) => e.to === n.id && rank.get(e.from) === r - 1);
      if (!calledFromAbove) continue;
      rank.set(n.id, r - 1);
      moved = true;
      break;
    }
    if (!moved) break;
  }
}

/** Crossings between the edges of adjacent rows, at the current order. */
function crossings(
  rows: readonly (readonly string[])[],
  links: readonly C4LayoutEdge[],
  row: ReadonlyMap<string, number>,
  pos: ReadonlyMap<string, number>,
): number {
  let n = 0;
  for (let r = 0; r + 1 < rows.length; r++) {
    const pairs: Array<[number, number]> = [];
    for (const e of links) {
      const a = row.get(e.from);
      const b = row.get(e.to);
      if (a === r && b === r + 1) pairs.push([pos.get(e.from) ?? 0, pos.get(e.to) ?? 0]);
      else if (a === r + 1 && b === r) pairs.push([pos.get(e.to) ?? 0, pos.get(e.from) ?? 0]);
    }
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [p, q] = pairs[i] as [number, number];
        const [s, t] = pairs[j] as [number, number];
        if ((p - s) * (q - t) < 0) n++;
      }
    }
  }
  return n;
}

/**
 * Integer columns for one row: strictly increasing, each inside its range,
 * as close as possible to its ideal (L1, scaled by its weight), ties broken
 * towards the centre.
 * A small dynamic programme over the columns; a row that cannot meet its
 * ranges keeps its slots in order.
 */
export function fitRow(
  items: ReadonlyArray<{ readonly ideal: number; readonly range: readonly [number, number]; readonly weight?: number }>,
  width: number,
): number[] {
  const n = items.length;
  if (n === 0) return [];
  const W = Math.max(width, n);
  const centre = (W - 1) / 2;
  const INF = Number.POSITIVE_INFINITY;
  // dp[i][c]: least cost of the first i+1 items with item i at column c.
  const dp: number[][] = [];
  const from: number[][] = [];
  for (let i = 0; i < n; i++) {
    const it = items[i] as { ideal: number; range: readonly [number, number]; weight?: number };
    const row: number[] = new Array<number>(W).fill(INF);
    const back: number[] = new Array<number>(W).fill(-1);
    let bestPrev = INF;
    let bestAt = -1;
    for (let c = 0; c < W; c++) {
      if (i > 0 && c > 0) {
        const prev = (dp[i - 1] as number[])[c - 1] as number;
        if (prev < bestPrev) {
          bestPrev = prev;
          bestAt = c - 1;
        }
      }
      if (c < it.range[0] || c > it.range[1]) continue;
      const own = (it.weight ?? 1) * Math.abs(c - it.ideal) + 0.01 * Math.abs(c - centre);
      if (i === 0) row[c] = own;
      else if (bestPrev < INF) {
        row[c] = bestPrev + own;
        back[c] = bestAt;
      }
    }
    dp.push(row);
    from.push(back);
  }
  const last = dp[n - 1] as number[];
  let end = -1;
  for (let c = 0; c < W; c++) if (last[c] !== INF && (end < 0 || (last[c] as number) < (last[end] as number))) end = c;
  if (end < 0) return items.map((_, i) => i);
  const out: number[] = new Array<number>(n).fill(0);
  for (let i = n - 1, c = end; i >= 0; i--) {
    out[i] = c;
    c = (from[i] as number[])[c] as number;
  }
  return out;
}
