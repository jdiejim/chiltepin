/**
 * The layout of a `usecase` block: where each actor, case and line goes.
 * Pure geometry; `usecase.ts` draws it.
 *
 * **Who stands where.** Primary actors stand left of the subject, supporting
 * actors right of it, as UML draws them. `side` decides when the author sets
 * it. Otherwise an actor is supporting when every case it joins is an
 * included case or an extension (it never starts a goal of its own), or when
 * it is a system that joins a case another actor starts. A time actor starts
 * its case, so it stands left. A child actor (`generalize` between actors)
 * stands on its parent's side, right under it.
 *
 * **Which column.** Cases read left to right: a case an actor starts sits in
 * the first column; an included case, an extension, or a specialised case
 * sits one column right of the case it belongs to (at most two columns, so a
 * longer chain stacks in the second). A case that only a supporting actor
 * joins sits in the second column. A case joined from both sides tries both
 * columns, and a case a primary actor joins may also stay in the first
 * column, right under the case it belongs to. Without relations, up to twelve
 * cases try one column, and past six a split by actor group or in brick order.
 * Every plan is built in full and scored on its lines as drawn (crossings,
 * bends, routed lines, labels with no room, then size); the best one wins.
 *
 * **Which order.** Inside each column, and in each actor column, the order
 * keeps crossings rare: barycentre sweeps, then swaps of two neighbours while
 * the score improves. The author's order is a soft preference. A case sits
 * right under the case it belongs to when both share a column.
 *
 * **Which height.** Each column stacks its ellipses at an even gap. A case in
 * the second column moves level with the case it belongs to, so its arrow
 * runs flat; several cases that belong to one case centre on it, and the
 * first column leans toward them. Actors stand level with the mean of their
 * cases. Every spread keeps the order and the gaps and moves each item as
 * little as it can (isotonic regression).
 *
 * **Lines.** A line is straight and ends on the ellipse outline; an
 * association aims at the half of the case that faces its actor. A line that
 * would pass another case, an actor or the subject's name tries the case's
 * tip, then one bend into a free gap of the column it must cross (between two
 * cases, or level with the case), with the fewest crossings and never on a
 * track another line uses; then a bracket beside its column (for two cases of
 * one column); only then the shared orthogonal router. Several
 * specialisations of one case share one trunk and one hollow triangle.
 * Labels sit on their own line; when one finds no room, the gaps open up.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { edgeMaskSize } from '../svg/edgePill.js';
import { LABEL_RUN, labelForms, placeOnRoutes } from '../svg/edgeSteps.js';
import { routeEdges, type Pt, type RouteEdge, type RouteNode } from '../svg/router.js';
import { FONT, textWidth } from '../svg/wrapText.js';
import { wrapAll } from './wrapAll.js';

type Data = BlockDataMap['usecase'];
type Actor = Data['actors'][number];

export type ActorKind = 'person' | 'system' | 'time';
export type ActorSide = 'left' | 'right';
export type RelKind = 'include' | 'extend' | 'generalize';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One use case: an ellipse, its wrapped name and note. */
export interface UcCase {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly col: number;
  readonly name: readonly string[];
  readonly note: readonly string[];
}

/** One actor: its glyph anchor (`x`, `y`), kind, side and drawn extent. */
export interface UcActor {
  readonly x: number;
  readonly y: number;
  readonly kind: ActorKind;
  readonly side: ActorSide;
  readonly name: readonly string[];
  /** The glyph and name as drawn (what a line must not cross). */
  readonly box: Box;
  /** A system actor's box (the glyph is the box). */
  readonly glyph?: Box;
  /** Half-width of the glyph where an association starts. */
  readonly reach: number;
}

/** One drawn line: an association or a relation. */
export interface UcLine {
  readonly pts: readonly Pt[];
  /** The route came from the shared orthogonal router. */
  readonly routed: boolean;
  /** Corner radius at each bend (default 10). */
  readonly radius?: readonly number[];
}

/** A label set on its line: the mask's centre and its lines. */
export interface UcLabel {
  /** Data path of the line it names (`links.N`, `relations.N`). */
  readonly path: string;
  readonly lines: readonly string[];
  readonly lx: number;
  readonly ly: number;
  readonly box: Box;
}

/** A label that found no room on its line (it falls back to a numeral). */
export interface UcUnplaced {
  readonly path: string;
  readonly text: string;
  readonly pts: readonly Pt[];
}

/** A relation as the layout resolved it. */
export interface UcRel {
  readonly index: number;
  readonly kind: RelKind;
  /** Between two actors (actor generalisation) rather than two cases. */
  readonly actors: boolean;
  /** Arrow tail and head (`from` → `to`), as indices into cases or actors. */
  readonly from: number;
  readonly to: number;
}

export interface UcLayout {
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly bound: Box;
  /** Where the subject's name sits (an obstacle for every line). */
  readonly title: Box | undefined;
  readonly cases: readonly UcCase[];
  readonly actors: readonly UcActor[];
  readonly rels: readonly UcRel[];
  /** One line per `links` entry (undefined when an end names nothing). */
  readonly links: ReadonlyArray<UcLine | undefined>;
  /** One line per `relations` entry (undefined when an end names nothing). */
  readonly relLines: ReadonlyArray<UcLine | undefined>;
  /** For each link, the actor and case it joins (undefined when it names nothing). */
  readonly linkEnds: ReadonlyArray<{ readonly actor: number; readonly case: number } | undefined>;
  /** Every label that found room on its own line. */
  readonly labels: readonly UcLabel[];
  readonly unplaced: readonly UcUnplaced[];
  /** Index of the case in `focus`, if it names one. */
  readonly focus: number | undefined;
}

/* ── constants ─────────────────────────────────────────────────────────── */

/** The smallest ellipse. */
const RX0 = 74;
const RY0 = 26;
/** Case-name characters per line, and the most the wrap widens to. */
const CASE_CHARS = 18;
const CASE_CHARS_MAX = 24;
const NAME_LINE = 15;
const NOTE_LINE = 12;
/** Gaps: between two ellipses of a column, between two columns. */
const ROW_GAP = 24;
const COL_GAP = 72;
const PAD_X = 28;
const PAD_Y = 22;
const HEAD = 26;
const GUTTER = 50;
const MARGIN = 20;
const ACTOR_GAP = 20;
/** Extra room between a parent actor and a child actor, for the arrow. */
const GEN_GAP = 26;
const ACTOR_CHARS = 16;
/** The most cases one column may hold before the layout must split them. */
const SINGLE_MAX = 12;
/** The cost of one pair of cases out of document order, against 10 for a crossing. */
const INVERSION = 0.8;
/** A line keeps this far off an ellipse it does not end on. */
export const ELLIPSE_CLEAR = 4;

/** An actor whose name ends in one of these words is a system, unless `kind` says otherwise. */
const SYSTEM_NAME = /(?:^|[\s-])(?:system|service|gateway|server|api|database|platform|engine|bot)s?$/i;

/** The kind an actor draws as: its `kind`, else `system` when its name ends like one. */
export function actorKind(a: Pick<Actor, 'kind' | 'name'>): ActorKind {
  return a.kind ?? (SYSTEM_NAME.test(a.name.trim()) ? 'system' : 'person');
}

/* ── geometry helpers ──────────────────────────────────────────────────── */

/** Where a ray from the ellipse centre toward (px, py) leaves the ellipse. */
export function ellipseEdge(cx: number, cy: number, px: number, py: number, rx: number, ry: number): Pt {
  const dx = px - cx;
  const dy = py - cy;
  if (dx === 0 && dy === 0) return { x: cx + rx, y: cy };
  const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return { x: cx + dx * t, y: cy + dy * t };
}

/** True when the segment p→q passes through the ellipse at (cx, cy), grown by `pad`. */
export function segmentHitsEllipse(p: Pt, q: Pt, cx: number, cy: number, pad = ELLIPSE_CLEAR, rx = RX0, ry = RY0): boolean {
  // Scale to the unit circle, then the closest point of the segment.
  const ax = (p.x - cx) / (rx + pad);
  const ay = (p.y - cy) / (ry + pad);
  const bx = (q.x - cx) / (rx + pad);
  const by = (q.y - cy) / (ry + pad);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const x = ax + dx * t;
  const y = ay + dy * t;
  return x * x + y * y < 1;
}

/** True when the segment p→q crosses the box (exact, diagonal-safe). */
export function segmentHitsRect(p: Pt, q: Pt, b: Box): boolean {
  // Liang–Barsky clipping against the open box.
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const edges: Array<[number, number]> = [
    [-dx, p.x - b.x],
    [dx, b.x + b.w - p.x],
    [-dy, p.y - b.y],
    [dy, b.y + b.h - p.y],
  ];
  for (const [pk, qk] of edges) {
    if (pk === 0) {
      if (qk <= 0) return false;
      continue;
    }
    const r = qk / pk;
    if (pk < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 >= t1) return false;
  }
  return t1 - t0 > 1e-6;
}

/** True when segments a1→a2 and b1→b2 cross properly (not at a shared end). */
function segmentsCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d = (p: Pt, q: Pt, r: Pt): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Places items in order at or near `want`, each at least `sep[i]` below the
 * one before, and none above `min` — moving each as little as it can
 * (weighted isotonic regression by pool-adjacent-violators).
 */
export function spread(want: readonly number[], weight: readonly number[], sep: readonly number[], min: number): number[] {
  const n = want.length;
  const off: number[] = [];
  for (let i = 0; i < n; i++) off.push(i === 0 ? 0 : (off[i - 1] ?? 0) + (sep[i] ?? 0));
  // Pools of (mean, weight, count).
  const pools: Array<{ v: number; w: number; n: number }> = [];
  for (let i = 0; i < n; i++) {
    let pool = { v: (want[i] ?? 0) - (off[i] ?? 0), w: Math.max(1e-6, weight[i] ?? 1), n: 1 };
    let last = pools[pools.length - 1];
    while (last !== undefined && last.v > pool.v) {
      pools.pop();
      const w = last.w + pool.w;
      pool = { v: (last.v * last.w + pool.v * pool.w) / w, w, n: last.n + pool.n };
      last = pools[pools.length - 1];
    }
    pools.push(pool);
  }
  const out: number[] = [];
  for (const p of pools) for (let k = 0; k < p.n; k++) out.push(Math.max(p.v, min) + (off[out.length] ?? 0));
  return out;
}

/* ── sizes ─────────────────────────────────────────────────────────────── */

interface ActorShape {
  readonly kind: ActorKind;
  readonly name: string[];
  /** Width of glyph and name together. */
  readonly w: number;
  /** Extent above and below the anchor y. */
  readonly top: number;
  readonly bottom: number;
  readonly reach: number;
  /** A system actor's box size. */
  readonly glyph?: { readonly w: number; readonly h: number };
}

function actorShape(a: Actor): ActorShape {
  const kind = actorKind(a);
  if (kind === 'system') {
    const name = wrapAll(a.name, ACTOR_CHARS + 2);
    const nameW = Math.max(textWidth('«system»', FONT.sub), ...name.map((l) => textWidth(l)));
    const w = Math.max(92, Math.ceil(nameW + 26));
    const h = 22 + name.length * NAME_LINE + 8;
    return { kind, name, w, top: h / 2, bottom: h / 2, reach: w / 2 + 3, glyph: { w, h } };
  }
  const name = wrapAll(a.name, ACTOR_CHARS);
  const nameW = Math.max(0, ...name.map((l) => textWidth(l)));
  const w = Math.max(36, Math.ceil(nameW + 4));
  // Person: head top at -23, feet at +21, names from +36. Time: a clock of r 15.
  const top = kind === 'time' ? 16 : 23;
  const first = kind === 'time' ? 32 : 37;
  return { kind, name, w, top, bottom: first + (name.length - 1) * NAME_LINE + 5, reach: kind === 'time' ? 21 : 19 };
}

interface CaseText {
  readonly name: string[];
  readonly note: string[];
}

/** The ellipse half-height a case needs at half-width `rx` to hold every line. */
function caseRy(t: CaseText, rx: number): number {
  const lines = [
    ...t.name.map((l) => ({ w: textWidth(l), h: NAME_LINE })),
    ...t.note.map((l) => ({ w: textWidth(l, FONT.sub), h: NOTE_LINE })),
  ];
  const total = lines.reduce((s, l) => s + l.h, 0) + (t.note.length > 0 ? 2 : 0);
  let at = -total / 2;
  let need = RY0;
  lines.forEach((l, k) => {
    if (k === t.name.length && t.note.length > 0) at += 2;
    // The farther edge of this line's ink from the centre.
    const e = Math.max(Math.abs(at + 2), Math.abs(at + l.h - 2));
    const u = Math.min(0.97, (l.w / 2 + 9) / rx);
    need = Math.max(need, e / Math.sqrt(1 - u * u) + 3);
    at += l.h;
  });
  return Math.ceil(need);
}

/** Where each line of a case sits: a baseline y offset from the centre, per name and note line. */
export function caseBaselines(c: Pick<UcCase, 'name' | 'note'>): { name: number[]; note: number[] } {
  const total = c.name.length * NAME_LINE + c.note.length * NOTE_LINE + (c.note.length > 0 ? 2 : 0);
  let at = -total / 2;
  const name = c.name.map(() => {
    const b = at + NAME_LINE / 2 + 4.5;
    at += NAME_LINE;
    return b;
  });
  if (c.note.length > 0) at += 2;
  const note = c.note.map(() => {
    const b = at + NOTE_LINE / 2 + 3.5;
    at += NOTE_LINE;
    return b;
  });
  return { name, note };
}

/** The lines of a relation's label: the stereotype, then the author's label. */
export function relLabelLines(kind: RelKind, label: string | undefined): string[] {
  const head = kind === 'generalize' ? [] : [`«${kind}»`];
  if (label === undefined || label.trim() === '') return head;
  const forms = labelForms(label);
  const body = (label.trim().length <= 22 ? forms[0] : forms[forms.length - 1]) ?? [label];
  return [...head, ...body];
}

/* ── the model: what the data says, before any geometry ────────────────── */

interface Model {
  readonly data: Data;
  readonly actors: Data['actors'];
  readonly cases: Data['cases'];
  readonly links: NonNullable<Data['links']>;
  readonly relations: NonNullable<Data['relations']>;
  readonly linkEnds: ReadonlyArray<{ readonly actor: number; readonly case: number } | undefined>;
  readonly rels: readonly UcRel[];
  readonly caseRels: readonly UcRel[];
  readonly caseActors: readonly number[][];
  readonly actorCases: readonly number[][];
  readonly parentsOf: readonly number[][];
  readonly caseNbrs: readonly number[][];
  readonly actorParent: ReadonlyMap<number, number>;
  readonly sides: readonly ActorSide[];
  readonly shapes: readonly ActorShape[];
  readonly texts: readonly CaseText[];
}

/** The case a related case belongs to (its parent), and the case that belongs. */
function parentChild(r: UcRel): { parent: number; child: number } {
  return r.kind === 'include' ? { parent: r.from, child: r.to } : { parent: r.to, child: r.from };
}

function model(data: Data): Model {
  const actors = data.actors;
  const cases = data.cases;
  const links = data.links ?? [];
  const relations = data.relations ?? [];
  const caseIdx = new Map(cases.map((c, i) => [c.id, i]));
  const actorIdx = new Map(actors.map((a, i) => [a.id, i]));

  // A link joins an actor and a case; either order reads the same.
  const linkEnds = links.map((l) => {
    const a = actorIdx.get(l.from);
    const c = caseIdx.get(l.to);
    if (a !== undefined && c !== undefined) return { actor: a, case: c };
    const a2 = actorIdx.get(l.to);
    const c2 = caseIdx.get(l.from);
    if (a2 !== undefined && c2 !== undefined) return { actor: a2, case: c2 };
    return undefined;
  });
  const rels: UcRel[] = [];
  relations.forEach((r, index) => {
    const cf = caseIdx.get(r.from);
    const ct = caseIdx.get(r.to);
    if (cf !== undefined && ct !== undefined) {
      if (cf !== ct) rels.push({ index, kind: r.kind, actors: false, from: cf, to: ct });
      return;
    }
    const af = actorIdx.get(r.from);
    const at = actorIdx.get(r.to);
    if (r.kind === 'generalize' && af !== undefined && at !== undefined && af !== at) {
      rels.push({ index, kind: r.kind, actors: true, from: af, to: at });
    }
  });
  const caseRels = rels.filter((r) => !r.actors);

  const caseActors: number[][] = cases.map(() => []);
  const actorCases: number[][] = actors.map(() => []);
  for (const e of linkEnds) {
    if (e === undefined) continue;
    if (!(caseActors[e.case] ?? []).includes(e.actor)) caseActors[e.case]?.push(e.actor);
    if (!(actorCases[e.actor] ?? []).includes(e.case)) actorCases[e.actor]?.push(e.case);
  }
  const parentsOf: number[][] = cases.map(() => []);
  const caseNbrs: number[][] = cases.map(() => []);
  for (const r of caseRels) {
    const { parent, child } = parentChild(r);
    if (!(parentsOf[child] ?? []).includes(parent)) parentsOf[child]?.push(parent);
    caseNbrs[parent]?.push(child);
    caseNbrs[child]?.push(parent);
  }
  /** A case that never stands alone: an included case or an extension. */
  const secondary = cases.map((_, ci) => caseRels.some((r) => (r.kind === 'include' && r.to === ci) || (r.kind === 'extend' && r.from === ci)));
  const actorParent = new Map<number, number>();
  for (const g of rels) if (g.actors && !actorParent.has(g.from)) actorParent.set(g.from, g.to);

  // Sides: the author's, else inferred (see the module comment).
  const kinds = actors.map((a) => actorKind(a));
  const inferred = actors.map((a, ai): ActorSide => {
    if (a.side !== undefined) return a.side;
    const kind = kinds[ai];
    const mine = actorCases[ai] ?? [];
    if (kind === 'time') return 'left';
    if (mine.length > 0 && mine.every((ci) => secondary[ci] === true)) return 'right';
    if (kind === 'system') {
      if (mine.length === 0) return 'right';
      // It helps when a person or a timer also takes part in the case, or in a case it belongs to.
      const starter = (ci: number): boolean => (caseActors[ci] ?? []).some((o) => o !== ai && kinds[o] !== 'system' && actors[o]?.side !== 'right');
      const helps = mine.some((ci) => secondary[ci] === true || starter(ci) || (parentsOf[ci] ?? []).some(starter));
      return helps ? 'right' : 'left';
    }
    return 'left';
  });
  // With no primary actor at all, the inferred ones stand left after all.
  if (!inferred.some((s) => s === 'left')) actors.forEach((a, ai) => a.side === undefined && (inferred[ai] = 'left'));
  const sideOf = (ai: number, depth = 0): ActorSide => {
    const p = actorParent.get(ai);
    if (actors[ai]?.side === undefined && p !== undefined && depth < actors.length) return sideOf(p, depth + 1);
    return inferred[ai] ?? 'left';
  };
  const sides = actors.map((_, ai) => sideOf(ai));

  // Case names wrap wider (up to CASE_CHARS_MAX) until each fits two lines.
  let chars = CASE_CHARS;
  while (chars < CASE_CHARS_MAX && cases.some((c) => wrapAll(c.name, chars).length > 2)) chars++;
  const texts = cases.map((c) => ({ name: wrapAll(c.name, chars), note: c.note !== undefined ? wrapAll(c.note, chars + 6) : [] }));

  return {
    data,
    actors,
    cases,
    links,
    relations,
    linkEnds,
    rels,
    caseRels,
    caseActors,
    actorCases,
    parentsOf,
    caseNbrs,
    actorParent,
    sides,
    shapes: actors.map(actorShape),
    texts,
  };
}

/**
 * The column plans worth scoring. A case that belongs to another goes one
 * column right of it; a case only a supporting actor joins goes right; a case
 * joined from both sides tries each column. A second family keeps a case a
 * primary actor joins in the first column, right under the case it belongs to.
 */
function columnPlans(m: Model): number[][] {
  const n = m.cases.length;
  if (n < 2) return [m.cases.map(() => 0)];
  const linkedFrom = (ci: number, side: ActorSide): boolean => (m.caseActors[ci] ?? []).some((a) => m.sides[a] === side);
  const hasParents = (ci: number): boolean => (m.parentsOf[ci] ?? []).length > 0;
  const rightOnly = (ci: number): boolean => !hasParents(ci) && linkedFrom(ci, 'right') && !linkedFrom(ci, 'left');
  const both = (ci: number): boolean => !hasParents(ci) && linkedFrom(ci, 'left') && linkedFrom(ci, 'right');
  const all = m.cases.map((_, ci) => ci);
  if (!all.some((ci) => hasParents(ci) || rightOnly(ci))) {
    // No relations: one column; past six cases also two — the later actor
    // groups on the right, or each group zig-zagging over both (brick order).
    const out = n <= SINGLE_MAX ? [all.map(() => 0)] : [];
    if (n <= 6) return out;
    const firstActor = (ci: number): number => Math.min(Infinity, ...(m.caseActors[ci] ?? []));
    const order = [...all].sort((p, q) => firstActor(p) - firstActor(q) || p - q);
    const half = Math.ceil(n / 2);
    const groups = all.map(() => 0);
    order.forEach((ci, k) => (groups[ci] = k < half ? 0 : 1));
    const brick = all.map(() => 0);
    order.forEach((ci, k) => (brick[ci] = k % 2));
    return [...out, groups, brick];
  }
  const plans = new Map<string, number[]>();
  for (const keepLeft of [false, true]) {
    for (const free of ['short', 0, 1] as const) {
      const col = all.map((ci) => (rightOnly(ci) ? 1 : 0));
      for (let pass = 0; pass < n; pass++) {
        let changed = false;
        for (const ci of all) {
          const ps = m.parentsOf[ci] ?? [];
          if (ps.length === 0) continue;
          const c = keepLeft && linkedFrom(ci, 'left') && ps.every((p) => col[p] === 0) ? 0 : 1;
          if (col[ci] !== c) {
            col[ci] = c;
            changed = true;
          }
        }
        if (!changed) break;
      }
      const fixed = (k: number): number => all.filter((ci) => col[ci] === k && !both(ci)).length;
      let n0 = fixed(0);
      let n1 = fixed(1);
      for (const ci of all) {
        if (!both(ci)) continue;
        const to = free === 'short' ? (n1 < n0 ? 1 : 0) : free;
        col[ci] = to;
        if (to === 1) n1++;
        else n0++;
      }
      plans.set(col.join(','), col);
    }
  }
  return [...plans.values()];
}

/* ── one candidate layout ──────────────────────────────────────────────── */

interface Built {
  readonly layout: UcLayout;
  readonly score: number;
  readonly fallbacks: number;
}

function build(m: Model, colOf: readonly number[], extra: number): Built {
  const { actors, cases, linkEnds, rels, caseRels, caseActors, actorCases, parentsOf, caseNbrs, actorParent, sides, shapes, texts } = m;
  const cols = colOf.some((c) => c === 1) ? 2 : 1;
  const colRx = Array.from({ length: cols }, (_, k) => {
    let hw = 0;
    texts.forEach((t, ci) => {
      if (colOf[ci] !== k) return;
      for (const l of t.name) hw = Math.max(hw, textWidth(l) / 2);
      for (const l of t.note) hw = Math.max(hw, textWidth(l, FONT.sub) / 2);
    });
    return Math.max(RX0, Math.ceil((hw + 9) / 0.86));
  });
  const rxOf = (ci: number): number => colRx[colOf[ci] ?? 0] ?? RX0;
  const ryOf = texts.map((t, ci) => caseRy(t, rxOf(ci)));

  // Gaps open up so a stereotype fits on its own line.
  const rowGap = ROW_GAP + extra / 2;
  let colGap = COL_GAP + extra;
  const pairGap = new Map<string, number>();
  const pairKey = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;
  for (const r of caseRels) {
    const lines = relLabelLines(r.kind, m.relations[r.index]?.label);
    if (lines.length === 0) continue;
    const box = edgeMaskSize(lines);
    if (colOf[r.from] === colOf[r.to]) pairGap.set(pairKey(r.from, r.to), Math.max(pairGap.get(pairKey(r.from, r.to)) ?? 0, Math.ceil(box.h + LABEL_RUN + 14)));
    else colGap = Math.max(colGap, Math.ceil(box.w + LABEL_RUN + 18 + extra));
  }
  const gapBetween = (a: number, b: number): number => Math.max(rowGap, pairGap.get(pairKey(a, b)) ?? 0);

  // ── x
  const leftActors = actors.map((_, ai) => ai).filter((ai) => sides[ai] === 'left');
  const rightActors = actors.map((_, ai) => ai).filter((ai) => sides[ai] === 'right');
  const colW = (list: number[]): number => Math.max(96, ...list.map((ai) => shapes[ai]?.w ?? 0));
  const leftW = leftActors.length > 0 ? colW(leftActors) : 0;
  const rightW = rightActors.length > 0 ? colW(rightActors) : 0;
  const boundX = MARGIN + (leftW > 0 ? leftW + GUTTER : 0);
  const colX: number[] = [];
  let cursor = boundX + PAD_X;
  for (let k = 0; k < cols; k++) {
    colX.push(cursor + (colRx[k] ?? RX0));
    cursor += 2 * (colRx[k] ?? RX0) + colGap;
  }
  const boundW = cursor - colGap + PAD_X - boundX;
  const leftX = MARGIN + leftW / 2;
  const rightX = boundX + boundW + GUTTER + rightW / 2;
  const width = Math.ceil(rightW > 0 ? rightX + rightW / 2 + MARGIN : boundX + boundW + MARGIN);
  const boundY = PAD_Y;
  const top = boundY + HEAD + PAD_Y;
  const system = m.data.system;
  const title: Box | undefined =
    system !== undefined && system.trim() !== ''
      ? { x: boundX + 8, y: boundY + 5, w: Math.ceil(textWidth(system.toUpperCase(), FONT.eyebrow)) + 12, h: 18 }
      : undefined;
  const actorX = (ai: number): number => (sides[ai] === 'right' ? rightX : leftX);
  const caseX = (ci: number): number => colX[colOf[ci] ?? 0] ?? 0;

  // ── order
  const byCol = (k: number): number[] => cases.map((_, ci) => ci).filter((ci) => colOf[ci] === k);
  const groupActors = (list: readonly number[]): number[] => {
    // A child actor follows its parent.
    const out: number[] = [];
    const visit = (ai: number): void => {
      if (out.includes(ai)) return;
      out.push(ai);
      for (const c of list) if (actorParent.get(c) === ai) visit(c);
    };
    for (const ai of list) if (!list.includes(actorParent.get(ai) ?? -1)) visit(ai);
    for (const ai of list) visit(ai);
    return out;
  };
  const firstOf = (ci: number, side: ActorSide, order: readonly number[]): number => {
    let best = Infinity;
    for (const a of caseActors[ci] ?? []) if (sides[a] === side) best = Math.min(best, order.indexOf(a));
    return best;
  };
  let orderL = groupActors(leftActors);
  let orderR = groupActors(rightActors);
  const col0 = byCol(0).sort((p, q) => firstOf(p, 'left', orderL) - firstOf(q, 'left', orderL) || p - q);
  const col1 = byCol(1).sort((p, q) => {
    const bary = (ci: number): number => {
      const ns = (caseNbrs[ci] ?? []).filter((x) => colOf[x] === 0);
      return ns.length > 0 ? ns.reduce((s, x) => s + col0.indexOf(x), 0) / ns.length : 1000 + firstOf(ci, 'right', orderR);
    };
    return bary(p) - bary(q) || p - q;
  });

  /** Keeps a case right under the case it belongs to, when both share a column. */
  const keepRelatedClose = (list: number[]): number[] => {
    const out = [...list];
    const runEnd = (parent: number): number => {
      let at = out.indexOf(parent) + 1;
      while (at < out.length && (parentsOf[out[at] ?? -1] ?? []).includes(parent)) at++;
      return at;
    };
    for (const r of caseRels) {
      const { parent, child } = parentChild(r);
      const pp = out.indexOf(parent);
      const pc = out.indexOf(child);
      if (pp < 0 || pc < 0 || (pc > pp && pc < runEnd(parent))) continue;
      out.splice(pc, 1);
      out.splice(runEnd(parent), 0, child);
    }
    return out;
  };
  let orders: number[][] = (cols === 2 ? [col0, col1] : [col0]).map(keepRelatedClose);

  // ── height
  const sepCases = (list: readonly number[]): number[] =>
    list.map((ci, k) => (k === 0 ? 0 : (ryOf[list[k - 1] ?? 0] ?? RY0) + (ryOf[ci] ?? RY0) + gapBetween(list[k - 1] ?? 0, ci)));
  const stack = (list: readonly number[]): number[] => {
    const sep = sepCases(list);
    const out: number[] = [];
    list.forEach((ci, k) => out.push(k === 0 ? top + (ryOf[ci] ?? RY0) : (out[k - 1] ?? 0) + (sep[k] ?? 0)));
    return out;
  };
  const anyCross = caseRels.some((r) => colOf[r.from] !== colOf[r.to]);

  interface Placed {
    readonly caseY: number[];
    readonly actorY: number[];
  }
  const place = (ords: readonly number[][], oL: readonly number[], oR: readonly number[]): Placed => {
    const caseY = cases.map(() => 0);
    const set = (list: readonly number[], ys: readonly number[]): void => list.forEach((ci, k) => (caseY[ci] = ys[k] ?? 0));
    const c0 = ords[0] ?? [];
    const c1 = ords[1] ?? [];
    set(c0, stack(c0));
    if (c1.length > 0) {
      const guess = stack(c1);
      const placeCol1 = (): void => {
        // Brick order: a case with nothing to follow sits in a gap of the first column.
        const gaps = c0.map((ci, k) => {
          const next = c0[k + 1];
          return next !== undefined ? ((caseY[ci] ?? 0) + (caseY[next] ?? 0)) / 2 : (caseY[ci] ?? 0) + (ryOf[ci] ?? RY0) + rowGap;
        });
        const want: number[] = [];
        const wt: number[] = [];
        c1.forEach((ci, k) => {
          const rel = meanOf((caseNbrs[ci] ?? []).filter((x) => colOf[x] === 0).map((x) => caseY[x] ?? 0));
          // Next to the other cases of its actors, else in brick order.
          const sib = meanOf(
            (caseActors[ci] ?? []).flatMap((a) => (actorCases[a] ?? []).filter((x) => x !== ci && colOf[x] === 0)).map((x) => caseY[x] ?? 0),
          );
          if (rel !== undefined) {
            want.push(rel);
            wt.push(1);
          } else if ((caseNbrs[ci] ?? []).length > 0) {
            want.push(guess[k] ?? 0);
            wt.push(0.02);
          } else if (anyCross && sib !== undefined) {
            want.push(sib);
            wt.push(0.3);
          } else {
            want.push(gaps[k] ?? guess[k] ?? 0);
            wt.push(anyCross ? 0.05 : 1);
          }
        });
        set(c1, spread(want, wt, sepCases(c1), top + (ryOf[c1[0] ?? 0] ?? RY0)));
      };
      placeCol1();
      if (anyCross) {
        // The first column centres on the cases that belong to it, then the second follows.
        const base = c0.map((ci) => caseY[ci] ?? 0);
        const want: number[] = [];
        const wt: number[] = [];
        c0.forEach((ci, k) => {
          const mean = meanOf((caseNbrs[ci] ?? []).filter((x) => colOf[x] === 1).map((x) => caseY[x] ?? 0));
          want.push(mean ?? base[k] ?? 0);
          wt.push(mean !== undefined ? 1 : 0.1);
        });
        set(c0, spread(want, wt, sepCases(c0), top + (ryOf[c0[0] ?? 0] ?? RY0)));
        placeCol1();
      }
    }
    // Lift everything so the highest ellipse sits at the top.
    const high = Math.min(...cases.map((_, ci) => (caseY[ci] ?? 0) - (ryOf[ci] ?? RY0)));
    if (Number.isFinite(high)) for (let ci = 0; ci < cases.length; ci++) caseY[ci] = (caseY[ci] ?? 0) - (high - top);

    const actorY = actors.map(() => 0);
    for (const list of [oL, oR]) {
      const want: number[] = [];
      const wt: number[] = [];
      const sep: number[] = [];
      list.forEach((ai, k) => {
        const mean = meanOf((actorCases[ai] ?? []).map((ci) => caseY[ci] ?? 0));
        want.push(mean ?? (k === 0 ? top + 30 : (want[k - 1] ?? 0) + 90));
        wt.push(mean !== undefined ? 1 : 0.02);
        const prev = list[k - 1];
        const gen = prev !== undefined && list.slice(0, k).includes(actorParent.get(ai) ?? -1);
        sep.push(prev === undefined ? 0 : (shapes[prev]?.bottom ?? 0) + (shapes[ai]?.top ?? 0) + ACTOR_GAP + (gen ? GEN_GAP : 0));
      });
      const ys = spread(want, wt, sep, MARGIN + (shapes[list[0] ?? 0]?.top ?? 0));
      list.forEach((ai, k) => (actorY[ai] = ys[k] ?? 0));
    }
    return { caseY, actorY };
  };

  // Straight stand-ins, to score an order quickly.
  const quickScore = (p: Placed): number => {
    const segs: Array<{ a: Pt; b: Pt; ends: string[] }> = [];
    linkEnds.forEach((e) => {
      if (e === undefined) return;
      const right = sides[e.actor] === 'right';
      segs.push({
        a: { x: actorX(e.actor) + (right ? -1 : 1) * (shapes[e.actor]?.reach ?? 20), y: p.actorY[e.actor] ?? 0 },
        b: { x: caseX(e.case) + (right ? 1 : -1) * rxOf(e.case) * 0.6, y: p.caseY[e.case] ?? 0 },
        ends: [`a${e.actor}`, `c${e.case}`],
      });
    });
    for (const r of caseRels) {
      segs.push({ a: { x: caseX(r.from), y: p.caseY[r.from] ?? 0 }, b: { x: caseX(r.to), y: p.caseY[r.to] ?? 0 }, ends: [`c${r.from}`, `c${r.to}`] });
    }
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s = segs[i];
        const t = segs[j];
        if (s === undefined || t === undefined || s.ends.some((e) => t.ends.includes(e))) continue;
        if (segmentsCross(s.a, s.b, t.a, t.b)) crossings++;
      }
    }
    let hits = 0;
    let len = 0;
    for (const s of segs) {
      len += Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      cases.forEach((_, ci) => {
        if (!s.ends.includes(`c${ci}`) && segmentHitsEllipse(s.a, s.b, caseX(ci), p.caseY[ci] ?? 0, 2, rxOf(ci), ryOf[ci] ?? RY0)) hits++;
      });
    }
    return crossings * 10 + hits * 25 + len / 1000 + inversions(p.caseY) * INVERSION;
  };
  /** Pairs of one column out of document order: the author's order is a soft preference. */
  const inversions = (ys: readonly number[]): number => {
    let n = 0;
    for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) if (colOf[i] === colOf[j] && (ys[i] ?? 0) > (ys[j] ?? 0)) n++;
    return n;
  };

  let placed = place(orders, orderL, orderR);
  let best = { s: quickScore(placed), placed, orders, orderL, orderR };
  for (let iter = 0; iter < 6; iter++) {
    const y = placed;
    orders = orders.map((list, k) =>
      keepRelatedClose(
        [...list].sort((p, q) => {
          const key = (ci: number): number =>
            meanOf([
              ...(caseActors[ci] ?? []).map((a) => y.actorY[a] ?? 0),
              ...(caseNbrs[ci] ?? []).filter((x) => colOf[x] !== k).map((x) => y.caseY[x] ?? 0),
            ]) ?? (y.caseY[ci] ?? 0);
          return key(p) - key(q) || (y.caseY[p] ?? 0) - (y.caseY[q] ?? 0);
        }),
      ),
    );
    placed = place(orders, orderL, orderR);
    const y2 = placed;
    const sortActors = (list: readonly number[]): number[] => {
      // Family heads sort by the mean height of their family's cases; children follow.
      const heads = list.filter((ai) => !list.includes(actorParent.get(ai) ?? -1));
      const famKey = (ai: number): number => {
        const fam = list.filter((x) => x === ai || actorParent.get(x) === ai);
        // An actor with no case stands last.
        return meanOf(fam.flatMap((x) => (actorCases[x] ?? []).map((ci) => y2.caseY[ci] ?? 0))) ?? 1e6 + ai;
      };
      return groupActors([...heads].sort((p, q) => famKey(p) - famKey(q) || (y2.actorY[p] ?? 0) - (y2.actorY[q] ?? 0)).concat(list.filter((x) => !heads.includes(x))));
    };
    orderL = sortActors(orderL);
    orderR = sortActors(orderR);
    placed = place(orders, orderL, orderR);
    const s = quickScore(placed);
    if (s < best.s - 1e-9) best = { s, placed, orders, orderL, orderR };
  }
  // Then swap neighbours while that scores better (each swap keeps related cases together).
  orders = best.orders;
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let k = 0; k < orders.length; k++) {
      for (let i = 0; i + 1 < (orders[k] ?? []).length; i++) {
        const list = [...(orders[k] ?? [])];
        [list[i], list[i + 1]] = [list[i + 1] as number, list[i] as number];
        if (keepRelatedClose(list).join() !== list.join()) continue;
        const trial = orders.map((o, j) => (j === k ? list : o));
        const p = place(trial, best.orderL, best.orderR);
        const sc = quickScore(p);
        if (sc < best.s - 1e-9) {
          best = { s: sc, placed: p, orders: trial, orderL: best.orderL, orderR: best.orderR };
          orders = trial;
          improved = true;
        }
      }
    }
    // Actors too: two neighbours in one actor column (a family stays together).
    for (const side of ['L', 'R'] as const) {
      const cur = side === 'L' ? best.orderL : best.orderR;
      for (let i = 0; i + 1 < cur.length; i++) {
        const list = [...(side === 'L' ? best.orderL : best.orderR)];
        [list[i], list[i + 1]] = [list[i + 1] as number, list[i] as number];
        if (groupActors(list).join() !== list.join()) continue;
        const oL = side === 'L' ? list : best.orderL;
        const oR = side === 'R' ? list : best.orderR;
        const p = place(orders, oL, oR);
        const sc = quickScore(p);
        if (sc < best.s - 1e-9) {
          best = { s: sc, placed: p, orders, orderL: oL, orderR: oR };
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  const { caseY, actorY } = best.placed;

  const ucCases: UcCase[] = cases.map((_, ci) => ({
    cx: caseX(ci),
    cy: Math.round(caseY[ci] ?? 0),
    rx: rxOf(ci),
    ry: ryOf[ci] ?? RY0,
    col: colOf[ci] ?? 0,
    name: texts[ci]?.name ?? [],
    note: texts[ci]?.note ?? [],
  }));
  const ucActors: UcActor[] = actors.map((_, ai) => {
    const sh = shapes[ai] as ActorShape;
    const x = actorX(ai);
    const y = Math.round(actorY[ai] ?? 0);
    return {
      x,
      y,
      kind: sh.kind,
      side: sides[ai] ?? 'left',
      name: sh.name,
      box: { x: x - sh.w / 2, y: y - sh.top, w: sh.w, h: sh.top + sh.bottom },
      ...(sh.glyph !== undefined ? { glyph: { x: x - sh.glyph.w / 2, y: y - sh.glyph.h / 2, w: sh.glyph.w, h: sh.glyph.h } } : {}),
      reach: sh.reach,
    };
  });
  const contentBottom = Math.max(top, ...ucCases.map((c) => c.cy + c.ry));
  const bound: Box = { x: boundX, y: boundY, w: boundW, h: contentBottom + PAD_Y - boundY };
  const height = Math.ceil(Math.max(bound.y + bound.h, ...ucActors.map((a) => a.box.y + a.box.h)) + MARGIN);

  // ── lines
  const clear = (p: Pt, q: Pt, skipCases: readonly number[], skipActors: readonly number[]): boolean =>
    !ucCases.some((c, ci) => !skipCases.includes(ci) && segmentHitsEllipse(p, q, c.cx, c.cy, ELLIPSE_CLEAR, c.rx, c.ry)) &&
    !ucActors.some((a, ai) => !skipActors.includes(ai) && segmentHitsRect(p, q, grow(a.box, 3))) &&
    (title === undefined || !segmentHitsRect(p, q, title));
  const clearPath = (pts: readonly Pt[], skipCases: readonly number[], skipActors: readonly number[]): boolean =>
    pts.every((p, k) => k === 0 || clear(pts[k - 1] as Pt, p, skipCases, skipActors));
  const onEllipse = (ci: number, toward: Pt): Pt => {
    const c = ucCases[ci] as UcCase;
    const e = ellipseEdge(c.cx, c.cy, toward.x, toward.y, c.rx, c.ry);
    return { x: round1(e.x), y: round1(e.y) };
  };
  /** The y of every clear gap in column `k`: between two ellipses, and above and below them all. */
  const gapsOf = (k: number): number[] => {
    const list = ucCases.filter((c) => c.col === k).sort((p, q) => p.cy - q.cy);
    const out: number[] = [];
    const first = list[0];
    if (first !== undefined && first.cy - first.ry - 14 > bound.y + HEAD) out.push(first.cy - first.ry - 12);
    list.forEach((c, j) => {
      const next = list[j + 1];
      if (next !== undefined && next.cy - next.ry - (c.cy + c.ry) >= 16) out.push((c.cy + c.ry + next.cy - next.ry) / 2);
    });
    const last = list[list.length - 1];
    if (last !== undefined) out.push(last.cy + last.ry + Math.min(12, PAD_Y - 6));
    return out;
  };
  const colEdge = (k: number, side: 'l' | 'r'): number => (colX[k] ?? 0) + (side === 'l' ? -1 : 1) * ((colRx[k] ?? RX0) + 10);

  interface Plan {
    readonly kind: 'link' | 'rel';
    readonly index: number;
    pts: Pt[];
    route: boolean;
    readonly from: string;
    readonly to: string;
    readonly radius?: readonly number[];
  }
  const plans: Plan[] = [];
  // Specialisations of one case share one trunk when they sit one column right of it.
  const trunkOf = new Map<number, number>();
  for (const parent of new Set(caseRels.filter((r) => r.kind === 'generalize').map((r) => r.to))) {
    const kids = caseRels.filter((r) => r.kind === 'generalize' && r.to === parent).map((r) => r.from);
    const pc = ucCases[parent] as UcCase;
    if (kids.length >= 2 && kids.every((k) => ucCases[k]?.col === pc.col + 1)) trunkOf.set(parent, round1(pc.cx + pc.rx + colGap / 2));
  }
  const brackets = new Map<string, number>();
  for (const r of rels) {
    if (r.actors) {
      const child = ucActors[r.from] as UcActor;
      const parent = ucActors[r.to] as UcActor;
      const below = child.y > parent.y;
      let pts: Pt[] = [
        { x: child.x, y: below ? child.box.y - 3 : child.box.y + child.box.h + 3 },
        { x: parent.x, y: below ? parent.box.y + parent.box.h + 3 : parent.box.y - 3 },
      ];
      if (child.x === parent.x && !clearPath(pts, [], [r.from, r.to])) {
        // Another child stands between: a bracket on the outer side.
        const out = child.side === 'right' ? 1 : -1;
        const x = child.x + out * (Math.max(child.box.w, parent.box.w) / 2 + 8);
        pts = [
          { x: child.x + out * (child.box.w / 2 + 2), y: child.y },
          { x, y: child.y },
          { x, y: parent.y },
          { x: parent.x + out * (parent.box.w / 2 + 2), y: parent.y },
        ];
      }
      plans.push({ kind: 'rel', index: r.index, pts, route: false, from: `a:${r.from}`, to: `a:${r.to}` });
      continue;
    }
    const A = ucCases[r.from] as UcCase;
    const B = ucCases[r.to] as UcCase;
    const skip = [r.from, r.to];
    const trunk = r.kind === 'generalize' ? trunkOf.get(r.to) : undefined;
    if (trunk !== undefined) {
      const pts = simplifyPts([
        { x: A.cx - A.rx, y: A.cy },
        { x: trunk, y: A.cy },
        { x: trunk, y: B.cy },
        { x: B.cx + B.rx, y: B.cy },
      ]);
      // Round the bend at the child; keep the joint at the parent sharp, so the branches meet in one line.
      plans.push({ kind: 'rel', index: r.index, pts, route: !clearPath(pts, skip, []), from: `c:${r.from}`, to: `c:${r.to}`, radius: [10, 0] });
      continue;
    }
    const straight = [onEllipse(r.from, { x: B.cx, y: B.cy }), onEllipse(r.to, { x: A.cx, y: A.cy })];
    const tries: Pt[][] = [straight];
    if (A.col === B.col) {
      // A bracket beside the column, on the side that faces the other column.
      const side = cols === 2 ? (A.col === 0 ? 1 : -1) : rightActors.length > leftActors.length ? -1 : 1;
      const key = `${A.col}:${side}`;
      const k = brackets.get(key) ?? 0;
      brackets.set(key, k + 1);
      const x = A.cx + side * (A.rx + 16 + 10 * k);
      tries.push([
        { x: A.cx + side * A.rx, y: A.cy },
        { x, y: A.cy },
        { x, y: B.cy },
        { x: B.cx + side * B.rx, y: B.cy },
      ]);
    } else {
      // Level with one end, then across the column gap.
      const mid = round1((A.cx + B.cx) / 2);
      const toward = B.cx > A.cx ? 1 : -1;
      tries.push([{ x: A.cx + toward * A.rx, y: A.cy }, { x: mid, y: A.cy }, onEllipse(r.to, { x: mid, y: A.cy })]);
      tries.push([onEllipse(r.from, { x: mid, y: B.cy }), { x: mid, y: B.cy }, { x: B.cx - toward * B.rx, y: B.cy }]);
    }
    const ok = tries.filter((t) => clearPath(t, skip, []));
    const pick = ok[0] === straight ? straight : shortest(ok, pathLen);
    plans.push({ kind: 'rel', index: r.index, pts: pick ?? straight, route: pick === undefined, from: `c:${r.from}`, to: `c:${r.to}` });
  }

  // Associations, after the relations: a detour avoids crossing them.
  const crossCount = (pts: readonly Pt[]): number => {
    let n = 0;
    for (const pl of plans) {
      for (let i = 1; i < pts.length; i++) {
        for (let j = 1; j < pl.pts.length; j++) if (segmentsCross(pts[i - 1] as Pt, pts[i] as Pt, pl.pts[j - 1] as Pt, pl.pts[j] as Pt)) n++;
      }
    }
    return n;
  };
  /** Runs this path would share with a line already drawn (two lines on one track read as one). */
  const overlapCount = (pts: readonly Pt[]): number => {
    let n = 0;
    const shared = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(c.y - d.y) < 0.5 && Math.abs(a.y - c.y) < 3) {
        return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 4;
      }
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(c.x - d.x) < 0.5 && Math.abs(a.x - c.x) < 3) {
        return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 4;
      }
      return false;
    };
    for (const pl of plans) {
      for (let i = 1; i < pts.length; i++) {
        for (let j = 1; j < pl.pts.length; j++) if (shared(pts[i - 1] as Pt, pts[i] as Pt, pl.pts[j - 1] as Pt, pl.pts[j] as Pt)) n++;
      }
    }
    return n;
  };
  linkEnds.forEach((e, li) => {
    if (e === undefined) return;
    const a = ucActors[e.actor] as UcActor;
    const c = ucCases[e.case] as UcCase;
    const right = a.side === 'right';
    const start: Pt = { x: a.x + (right ? -a.reach : a.reach), y: a.y };
    // Aimed at the near half of the ellipse, so the line meets it on the actor's side.
    const aim: Pt = { x: c.cx + (right ? 0.5 : -0.5) * c.rx, y: c.cy };
    const tries: Pt[][] = [
      [start, clipToward(start, aim, c)],
      [start, { x: c.cx + (right ? c.rx : -c.rx), y: c.cy }],
    ];
    // Through a gap of the column between the actor and the case: between two
    // ellipses, or level with the case (or the actor) where that band is free.
    if (cols === 2 && (right ? c.col === 0 : c.col === 1)) {
      const k = right ? 1 : 0;
      const enter = colEdge(k, right ? 'r' : 'l');
      const leave = colEdge(k, right ? 'l' : 'r');
      const free = (y: number): boolean => ucCases.every((o) => o.col !== k || Math.abs(o.cy - y) > o.ry + 10);
      const bands = [...gapsOf(k), ...[c.cy, a.y].filter(free)];
      // The bend may sit at the column's edge or deeper in the gap, where the ellipses narrow.
      const inner = (colX[k] ?? 0) + (right ? 1 : -1) * (colRx[k] ?? RX0) * 0.4;
      for (const gy of bands) {
        for (const x of [enter, round1((enter + inner) / 2), round1(inner)]) {
          const via: Pt[] = [start, { x, y: round1(gy) }, { x: leave, y: round1(gy) }];
          tries.push(simplifyPts([...via, onEllipse(e.case, via[2] as Pt)]));
        }
      }
    }
    const ok = tries.filter((t) => clearPath(t, [e.case], [e.actor]));
    // Straight when it can be; else the detour with the fewest crossings, then the shortest.
    const straight = ok.find((t) => t.length === 2);
    let pick: Pt[] | undefined = straight;
    if (pick === undefined) {
      let bestCost = Infinity;
      for (const t of ok) {
        const cost = crossCount(t) * 120 + overlapCount(t) * 200 + pathLen(t) + (t.length - 2) * 24;
        if (cost < bestCost) {
          bestCost = cost;
          pick = t;
        }
      }
    }
    plans.push({ kind: 'link', index: li, pts: pick ?? (tries[0] as Pt[]), route: pick === undefined, from: `a:${e.actor}`, to: `c:${e.case}` });
  });

  // The last resort: the shared orthogonal router.
  const routed = plans.filter((pl) => pl.route);
  if (routed.length > 0) {
    const nodes: RouteNode[] = [
      ...ucCases.map((c, ci) => ({ id: `c:${ci}`, box: { x: c.cx - c.rx, y: c.cy - c.ry, w: 2 * c.rx, h: 2 * c.ry }, shape: 'round' as const })),
      ...ucActors.map((a, ai) => ({ id: `a:${ai}`, box: a.box })),
    ];
    const edges: RouteEdge[] = routed.map((pl) => ({ from: pl.from, to: pl.to }));
    const out = routeEdges(nodes, edges, {
      dir: 'LR',
      bounds: { x: 0, y: 0, w: width, h: height },
      obstacles: title !== undefined ? [title] : [],
      backEdges: 'direct',
    });
    routed.forEach((pl, k) => {
      const rt = out[k];
      if (rt === undefined || rt.points.length < 2) return;
      const pts = rt.points.map((p) => ({ x: p.x, y: p.y }));
      for (const [end, id] of [['first', pl.from], ['last', pl.to]] as const) {
        if (id.startsWith('c:')) snapToEllipse(pts, end, ucCases[Number(id.slice(2))] as UcCase);
      }
      pl.pts = pts;
    });
  }

  const linkLines: Array<UcLine | undefined> = m.links.map(() => undefined);
  const relLines: Array<UcLine | undefined> = m.relations.map(() => undefined);
  for (const pl of plans) {
    const line: UcLine = {
      pts: pl.pts.map((p) => ({ x: round1(p.x), y: round1(p.y) })),
      routed: pl.route,
      ...(pl.radius !== undefined ? { radius: pl.radius } : {}),
    };
    if (pl.kind === 'link') linkLines[pl.index] = line;
    else relLines[pl.index] = line;
  }

  // ── labels: each on its own line, clear of shapes, other labels and (softly) other lines.
  const avoid: Box[] = [...ucCases.map((c) => ({ x: c.cx - c.rx, y: c.cy - c.ry, w: 2 * c.rx, h: 2 * c.ry })), ...ucActors.map((a) => a.box)];
  if (title !== undefined) avoid.push(title);
  const pending: Array<{ path: string; pts: readonly Pt[]; forms: string[][]; text: string }> = [];
  m.links.forEach((l, li) => {
    const line = linkLines[li];
    if (line !== undefined && l.label !== undefined && l.label.trim() !== '') pending.push({ path: `links.${li}`, pts: line.pts, forms: labelForms(l.label), text: l.label });
  });
  m.relations.forEach((r, ri) => {
    const line = relLines[ri];
    const lines = relLabelLines(r.kind, r.label);
    if (line !== undefined && lines.length > 0) pending.push({ path: `relations.${ri}`, pts: line.pts, forms: [lines], text: lines.join(' ') });
  });
  const routes = [...linkLines, ...relLines].filter((l): l is UcLine => l !== undefined).map((l) => l.pts);
  const spots = placeOnRoutes(
    pending.map((p) => ({ points: p.pts, lx: p.pts[0]?.x ?? 0, ly: p.pts[0]?.y ?? 0, sizes: p.forms.map((f) => edgeMaskSize(f)) })),
    avoid,
    { bounds: { x: 0, y: 0, w: width, h: height }, routes },
  );
  const labels: UcLabel[] = [];
  const unplaced: UcUnplaced[] = [];
  pending.forEach((p, i) => {
    const sp = spots[i];
    if (sp !== undefined) labels.push({ path: p.path, lines: p.forms[sp.size] ?? [], lx: sp.lx, ly: sp.ly, box: sp.box });
    else unplaced.push({ path: p.path, text: p.text, pts: p.pts });
  });

  // ── score, on the lines as drawn
  const drawn = plans.map((pl) => ({ pts: pl.pts, ends: [pl.from, pl.to] }));
  let crossings = 0;
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      const s = drawn[i];
      const t = drawn[j];
      if (s === undefined || t === undefined || s.ends.some((e) => t.ends.includes(e))) continue;
      for (let a = 1; a < s.pts.length; a++) {
        for (let b = 1; b < t.pts.length; b++) {
          if (segmentsCross(s.pts[a - 1] as Pt, s.pts[a] as Pt, t.pts[b - 1] as Pt, t.pts[b] as Pt)) crossings++;
        }
      }
    }
  }
  const bends = plans.filter((pl) => pl.kind === 'link').reduce((sum, pl) => sum + Math.max(0, pl.pts.length - 2), 0);
  const score =
    crossings * 10 +
    bends * 4 +
    routed.length * 40 +
    unplaced.length * 60 +
    inversions(caseY) * INVERSION +
    (width + height) / 200 +
    Math.max(0, width - 900) / 10;

  const focusId = m.data.focus;
  const focus = focusId !== undefined ? cases.findIndex((c) => c.id === focusId) : -1;
  return {
    score,
    fallbacks: unplaced.length,
    layout: {
      width,
      height,
      cols,
      bound,
      title,
      cases: ucCases,
      actors: ucActors,
      rels,
      links: linkLines,
      relLines,
      linkEnds,
      labels,
      unplaced,
      focus: focus >= 0 ? focus : undefined,
    },
  };
}

/* ── the layout ────────────────────────────────────────────────────────── */

/**
 * Lays out a use-case diagram: every column plan is built and scored on its
 * lines as drawn (crossings, bends, routed lines, labels with no room, size),
 * and the best kept. A plan whose labels find no room opens its gaps first.
 */
export function layoutUsecase(data: Data): UcLayout {
  const m = model(data);
  let best: Built | undefined;
  for (const colOf of columnPlans(m)) {
    let built = build(m, colOf, 0);
    for (const extra of [28, 56]) {
      if (built.fallbacks === 0) break;
      const wider = build(m, colOf, extra);
      if (wider.fallbacks < built.fallbacks) built = wider;
    }
    if (best === undefined || built.score < best.score - 1e-9) best = built;
  }
  return (best as Built).layout;
}

function meanOf(ys: readonly number[]): number | undefined {
  return ys.length > 0 ? ys.reduce((s, y) => s + y, 0) / ys.length : undefined;
}

function pathLen(pts: readonly Pt[]): number {
  let s = 0;
  for (let k = 1; k < pts.length; k++) s += Math.hypot((pts[k] as Pt).x - (pts[k - 1] as Pt).x, (pts[k] as Pt).y - (pts[k - 1] as Pt).y);
  return s;
}

/* ── small helpers ─────────────────────────────────────────────────────── */

/** Where the segment from `p` (outside) toward `q` (inside) first meets the ellipse. */
function clipToward(p: Pt, q: Pt, c: UcCase): Pt {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const ux = (p.x - c.cx) / c.rx;
  const uy = (p.y - c.cy) / c.ry;
  const vx = dx / c.rx;
  const vy = dy / c.ry;
  const a = vx * vx + vy * vy;
  const b = 2 * (ux * vx + uy * vy);
  const k = ux * ux + uy * uy - 1;
  const disc = b * b - 4 * a * k;
  const t = a === 0 || disc < 0 ? 1 : Math.max(0, Math.min(1, (-b - Math.sqrt(disc)) / (2 * a)));
  return { x: round1(p.x + dx * t), y: round1(p.y + dy * t) };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function grow(b: Box, d: number): Box {
  return { x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d };
}

function shortest(list: readonly Pt[][], len: (pts: readonly Pt[]) => number): Pt[] | undefined {
  let best: Pt[] | undefined;
  let bestLen = Infinity;
  for (const pts of list) {
    // A bend costs a little, so a straight line wins a near tie.
    const l = len(pts) + (pts.length - 2) * 24;
    if (l < bestLen) {
      best = pts;
      bestLen = l;
    }
  }
  return best;
}

/** Drops repeated points and the middle of three on one horizontal or vertical line. */
function simplifyPts(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last !== undefined && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
    const prev = out[out.length - 2];
    if (prev !== undefined && last !== undefined && ((prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Moves the end of a routed polyline onto an ellipse: the last segment is
 * axis-aligned, so its end slides along that axis to the outline.
 */
function snapToEllipse(pts: Pt[], end: 'first' | 'last', c: UcCase): void {
  const i = end === 'last' ? pts.length - 1 : 0;
  const j = end === 'last' ? pts.length - 2 : 1;
  const a = pts[i];
  const b = pts[j];
  if (a === undefined || b === undefined) return;
  if (a.x === b.x) {
    const u = Math.max(-1, Math.min(1, (a.x - c.cx) / c.rx));
    const dy = c.ry * Math.sqrt(1 - u * u);
    pts[i] = { x: a.x, y: Math.round(b.y < c.cy ? c.cy - dy : c.cy + dy) };
  } else {
    const v = Math.max(-1, Math.min(1, (a.y - c.cy) / c.ry));
    const dx = c.rx * Math.sqrt(1 - v * v);
    pts[i] = { x: Math.round(b.x < c.cx ? c.cx - dx : c.cx + dx), y: a.y };
  }
}
