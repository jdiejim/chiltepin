/**
 * Swimlane placement — the one place that turns a `swimlane` body into cells.
 *
 * A step names its lane by label, by `id`, or by 0-based index, and may omit
 * `col`. This module resolves both so every consumer (`chiltepin-render`, the
 * Studio canvas, `chiltepin check`) sees the same grid:
 *
 * - `resolveSwimlaneLane` — the lane index a `lane` value names, or
 *   `undefined` when nothing matches (validation reports that as
 *   `E_SWIMLANE_LANE`; a renderer falls back to lane 0 so the step stays
 *   visible).
 * - `swimlaneColumns` — one column per step. When every step carries `col`
 *   the columns are exactly those. Otherwise a step's column is its
 *   longest-path rank through `links`: `1 + max(col of its predecessors)`,
 *   an explicit `col` acting as a floor; steps with no links go after the
 *   last linked column, one column each in author order; two steps that
 *   land on the same cell are pushed right so nothing overlaps.
 * - Phases — with derived columns, a step that names its `phase` (by label)
 *   starts no earlier than that phase's first column, and a phase starts
 *   after the last column of the phase before it, so every step sits under
 *   its own band. `swimlanePlacements` returns each band's columns.
 *
 * Pure: data in, numbers out. No I/O, no DOM.
 */

/** The fields the layout reads from a step. */
export interface SwimlaneStepInput {
  readonly id: string;
  readonly col?: number | undefined;
  readonly lane: number | string;
  /** The phase this step belongs to, by the phase's `label`. */
  readonly phase?: string | undefined;
}

/** The fields the layout reads from a phase band. */
export interface SwimlanePhaseInput {
  readonly label: string;
  readonly from: number;
  readonly to?: number | undefined;
}

/** A phase band's effective columns, 1-based and inclusive. */
export interface SwimlaneBand {
  readonly from: number;
  readonly to: number;
}

/** The fields the layout reads from a lane. */
export interface SwimlaneLaneInput {
  readonly id?: string | undefined;
  readonly label: string;
}

/** The fields the layout reads from a link. */
export interface SwimlaneLinkInput {
  readonly from: string;
  readonly to: string;
}

/** A step's effective cell: 1-based column, 0-based lane index. */
export interface SwimlanePlacement {
  readonly col: number;
  readonly lane: number;
}

/** A lane name compared the way an author types it: trimmed, case-folded. */
const fold = (s: string): string => s.trim().toLowerCase();

/**
 * The 0-based index of the lane `ref` names — a number is taken as the index
 * (when it exists), a string matches a lane's `label` or `id`
 * (case-insensitive, trimmed). `undefined` when nothing matches.
 */
export function resolveSwimlaneLane(
  ref: number | string,
  lanes: ReadonlyArray<SwimlaneLaneInput>,
): number | undefined {
  if (typeof ref === 'number') {
    return Number.isInteger(ref) && ref >= 0 && ref < lanes.length ? ref : undefined;
  }
  const want = fold(ref);
  if (want.length === 0) return undefined;
  const byId = lanes.findIndex((l) => l.id !== undefined && fold(l.id) === want);
  if (byId >= 0) return byId;
  const byLabel = lanes.findIndex((l) => fold(l.label) === want);
  return byLabel >= 0 ? byLabel : undefined;
}

/**
 * One 1-based column per step, in step order. Explicit columns are kept when
 * every step has one; otherwise columns are derived from `links` (see the
 * module note for the rule).
 */
export function swimlaneColumns(
  steps: ReadonlyArray<SwimlaneStepInput>,
  links: ReadonlyArray<SwimlaneLinkInput>,
  floors?: ReadonlyArray<number>,
): number[] {
  if (steps.every((s) => s.col !== undefined)) return steps.map((s) => s.col as number);

  const index = new Map<string, number>();
  steps.forEach((s, i) => {
    if (!index.has(s.id)) index.set(s.id, i);
  });
  const succs = steps.map((): number[] => []);
  const linked = new Set<number>();
  for (const l of links) {
    const a = index.get(l.from);
    const b = index.get(l.to);
    if (a === undefined || b === undefined || a === b) continue;
    (succs[a] as number[]).push(b);
    linked.add(a);
    linked.add(b);
  }

  // One depth-first pass in author order gives a topological order and drops
  // the links that close a loop (a link back onto the current path), so a
  // cycle cuts at the author's first step, not somewhere in the middle.
  const visited = new Set<number>();
  const onPath = new Set<number>();
  const order: number[] = []; // post-order; reversed below
  const kept = steps.map((): number[] => []);
  const walk = (u: number): void => {
    visited.add(u);
    onPath.add(u);
    for (const v of succs[u] as number[]) {
      if (onPath.has(v)) continue; // back edge
      (kept[u] as number[]).push(v);
      if (!visited.has(v)) walk(v);
    }
    onPath.delete(u);
    order.push(u);
  };
  steps.forEach((_, i) => {
    if (linked.has(i) && !visited.has(i)) walk(i);
  });

  // Longest path in topological order: a step sits one column after the
  // furthest of its predecessors, and never left of the `col` it carries.
  const rank = steps.map((s, i) => (linked.has(i) ? Math.max(1, s.col ?? 1, floors?.[i] ?? 1) : 0));
  for (const u of order.reverse()) {
    for (const v of kept[u] as number[]) {
      rank[v] = Math.max(rank[v] as number, (rank[u] as number) + 1);
    }
  }
  const lastLinked = Math.max(0, ...rank);

  // Unlinked steps follow the linked ones, one column each, in author order.
  let next = lastLinked;
  steps.forEach((s, i) => {
    if (linked.has(i)) return;
    next = Math.max(next + 1, s.col ?? 0, floors?.[i] ?? 0);
    rank[i] = next;
  });

  return rank;
}

/** The index of the phase `ref` names (label, case-insensitive, trimmed), or `undefined`. */
export function resolveSwimlanePhase(
  ref: string | undefined,
  phases: ReadonlyArray<SwimlanePhaseInput>,
): number | undefined {
  if (ref === undefined) return undefined;
  const want = fold(ref);
  const i = phases.findIndex((p) => fold(p.label) === want);
  return i >= 0 ? i : undefined;
}

/**
 * Every step's effective cell, in step order. Unknown lanes fall back to
 * lane 0 (validation has already named them); overlapping cells are pushed
 * right, later step first, so two steps never share a cell.
 */
export function swimlanePlacements(data: {
  readonly lanes?: ReadonlyArray<SwimlaneLaneInput> | undefined;
  readonly steps?: ReadonlyArray<SwimlaneStepInput> | undefined;
  readonly links?: ReadonlyArray<SwimlaneLinkInput> | undefined;
  readonly phases?: ReadonlyArray<SwimlanePhaseInput> | undefined;
}): { readonly placements: SwimlanePlacement[]; readonly derived: boolean; readonly bands: SwimlaneBand[] } {
  const lanes = data.lanes ?? [];
  const steps = data.steps ?? [];
  const links = data.links ?? [];
  const phases = data.phases ?? [];
  const derived = steps.some((s) => s.col === undefined);
  const place = (cols: readonly number[]): SwimlanePlacement[] => {
    const taken = new Set<string>();
    return steps.map((s, i) => {
      const lane = resolveSwimlaneLane(s.lane, lanes) ?? 0;
      let col = cols[i] ?? 1;
      if (derived) {
        while (taken.has(`${col}:${lane}`)) col += 1;
      }
      taken.add(`${col}:${lane}`);
      return { col, lane };
    });
  };
  const member = steps.map((s) => resolveSwimlanePhase(s.phase, phases));
  if (!derived || !member.some((m) => m !== undefined)) {
    const placements = place(swimlaneColumns(steps, links));
    return { placements, derived, bands: authorBands(phases, placements) };
  }
  // Phase by phase: floor the phase's steps at its first column, lay out
  // again, and start the next phase after the last column this one uses.
  const floors = steps.map(() => 0);
  const bands: SwimlaneBand[] = [];
  let placements = place(swimlaneColumns(steps, links, floors));
  let start = 1;
  phases.forEach((ph, k) => {
    const lo = Math.max(ph.from, start);
    member.forEach((m, i) => {
      if (m === k) floors[i] = lo;
    });
    placements = place(swimlaneColumns(steps, links, floors));
    const cols = placements.filter((_, i) => member[i] === k).map((p) => p.col);
    const hi = Math.max(lo, ph.to ?? lo, ...cols);
    bands.push({ from: lo, to: hi });
    start = hi + 1;
  });
  // The last band runs to the last column.
  const last = Math.max(1, ...placements.map((p) => p.col));
  const tail = bands[bands.length - 1];
  if (tail !== undefined && tail.to < last) bands[bands.length - 1] = { from: tail.from, to: last };
  return { placements, derived, bands };
}

/**
 * The bands as the author wrote them: `from`..`to`; a phase with no `to`
 * runs to the column before the next phase starts (the last one to the last
 * column), so an open-ended phase never covers the phases after it.
 */
function authorBands(
  phases: ReadonlyArray<SwimlanePhaseInput>,
  placements: ReadonlyArray<SwimlanePlacement>,
): SwimlaneBand[] {
  const last = Math.max(1, ...placements.map((p) => p.col), ...phases.map((p) => p.to ?? p.from));
  return phases.map((ph) => {
    const next = phases
      .filter((o) => o.from > ph.from)
      .reduce((m, o) => Math.min(m, o.from), Number.POSITIVE_INFINITY);
    const to = ph.to ?? (Number.isFinite(next) ? next - 1 : last);
    return { from: ph.from, to: Math.max(ph.from, to) };
  });
}
