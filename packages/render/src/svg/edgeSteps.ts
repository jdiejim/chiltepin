/**
 * Edge labels on their own edge.
 *
 * {@link edgeLabelLayer} is the one rule every edge-bearing renderer shares:
 * each label sits ON its edge, as `.t-arrow` text on a paper mask, at the best
 * clear spot along the route — the longest straight segment first, never on a
 * node, never on another label, and (softly) never on another edge's line. A
 * long label wraps to two lines. Only a label that fits nowhere falls back to
 * a circled numeral on the edge with its text in a step legend under the SVG
 * (the agent-loop language, which `cycle` still uses for its steps).
 */

import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';
import { edgeMask, edgeMaskSize, edgePill, type PillPoint } from './edgePill.js';
import { hueClass, hueInk, type Hue } from './hues.js';
import { revealAttr } from './reveal.js';
import type { Pt } from './router.js';

/** Radius of the skin's step badge (px). */
const STEP_R = 8;
/**
 * The width a request step adds to its edge label: the badge plus a 2px gap.
 * A stepped label is one unit, `③ label`, placed and kept clear as a whole.
 */
export const STEP_W = STEP_R * 2 + 2;
/** The height of a stepped label: the badge, or a two-line label when taller. */
export const STEP_H = STEP_R * 2;

/**
 * A circled step numeral at an edge midpoint. `skin` draws the hollow badge of
 * the skin (`muted` stroke, `.t-badge` number, `negative` for errors). `tone`
 * (skin only) marks an authored request step: `ink`, or its path's hue.
 */
export function edgeStep(p: PillPoint, n: number, err = false, skin = false, tone?: Hue | 'ink'): string {
  if (skin) {
    const cls = err ? ' c-negative' : tone === 'ink' ? ' c-ink' : hueClass(tone);
    const stroke = err ? 'var(--negative)' : tone === 'ink' ? 'var(--ink)' : tone !== undefined ? hueInk(tone) : 'var(--muted)';
    return (
      `<g>` +
      `<circle cx="${p.lx}" cy="${p.ly}" r="${STEP_R}" fill="var(--paper)" stroke="${stroke}" stroke-width="${tone !== undefined ? 1.25 : 1}"/>` +
      `<text x="${p.lx}" y="${p.ly + 3}" text-anchor="middle" class="t-badge${cls}">${n}</text>` +
      `</g>`
    );
  }
  const stroke = err ? 'var(--negative)' : 'var(--charcoal)';
  const text = err ? 'var(--negative)' : 'var(--charcoal)';
  return (
    `<g>` +
    `<circle cx="${p.lx}" cy="${p.ly}" r="9.5" fill="var(--white)" stroke="${stroke}" stroke-width="1.2"/>` +
    `<text x="${p.lx}" y="${p.ly + 3.5}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;font-weight:700" fill="${text}">${n}</text>` +
    `</g>`
  );
}

/**
 * The legend row under the SVG: `① label · ② label …`. A step's `path` (its
 * edge's data path, e.g. `edges.3`) is emitted as `data-bp` so editors can
 * twin-highlight the legend entry with its arrow.
 */
export function stepsLegend(
  steps: ReadonlyArray<{ label: string; err?: boolean; path?: string; reveal?: number; n?: number }>,
): string {
  if (steps.length === 0) return '';
  const items = steps
    .map(
      (s, i) =>
        `<span class="edge-step${s.err === true ? ' err' : ''}"${s.path !== undefined ? bp(s.path) : ''}${s.reveal !== undefined ? revealAttr(s.reveal) : ''}><b>${s.n ?? i + 1}</b>${escapeHtml(s.label)}</span>`,
    )
    .join('');
  return `<div class="edge-steps">${items}</div>`;
}

/** One collected edge label, with the edge's route and data path. */
export interface EdgeLabelPoint {
  /** Fallback anchor (the route midpoint) when `points` is absent. */
  readonly lx: number;
  readonly ly: number;
  /** The edge's route; the label is placed along it. */
  readonly points?: readonly Pt[] | undefined;
  readonly label?: string | undefined;
  readonly err?: boolean;
  /** The edge carries the diagram's accent (skin renderers only). */
  readonly accent?: boolean;
  /** Data path of the edge in the block's YAML, e.g. `edges.3` / `links.0`. */
  readonly path: string;
  /** The edge's deck build step (`data-reveal`), when the renderer orders its edges. */
  readonly reveal?: number;
  /**
   * The request step the edge carries (`block` edges): a circled numeral drawn
   * just before the label, as one unit, or alone on the edge when unlabelled.
   */
  readonly step?: number;
  /** The hue of the step numeral (the edge's named path). */
  readonly hue?: Hue;
}

/** A node box the badge layer must keep clear of. */
export interface AvoidRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Clearance around a node box: the badge radius (9.5) plus breathing room. */
const DODGE_PAD = 13;

/**
 * Nudges a label point out of any `avoid` box it overlaps: an edge midpoint
 * can land ON a node (a long edge passing a box in a tight layout), printing
 * the numeral over the node's label. The point escapes along the axis with the
 * shortest exit — which tracks the (orthogonal) edge it rides on. Two passes,
 * so escaping one box into a neighbour resolves too.
 */
export function dodge(lx: number, ly: number, avoid: ReadonlyArray<AvoidRect>): PillPoint {
  let x = lx;
  let y = ly;
  let dodged = false;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const r of avoid) {
      const x0 = r.x - DODGE_PAD;
      const y0 = r.y - DODGE_PAD;
      const x1 = r.x + r.w + DODGE_PAD;
      const y1 = r.y + r.h + DODGE_PAD;
      if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
      // Escape distances to each inflated side; take the cheapest.
      const dl = x - x0;
      const dr = x1 - x;
      const dt = y - y0;
      const db = y1 - y;
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) x = x0;
      else if (min === dr) x = x1;
      else if (min === dt) y = y0;
      else y = y1;
      moved = true;
      dodged = true;
    }
    if (!moved) break;
  }
  // An undisturbed point passes through bit-exact (byte-determinism holds for
  // every diagram that never had a collision); a dodged one rounds cleanly.
  return dodged ? { lx: Math.round(x), ly: Math.round(y) } : { lx, ly };
}


/** A label longer than this (characters) always wraps to two lines. */
export const LABEL_ONE_LINE_MAX = 28;
/** A label this short (characters) never wraps. */
const LABEL_NO_WRAP = 8;

/**
 * The ways an edge label may be set, preferred first: one line, and — for a
 * label of two or more words — the balanced two-line split (the split whose
 * longer line is shortest). A label never takes more than two lines and never
 * loses a word; a very long label offers only the two-line form.
 */
export function labelForms(label: string): string[][] {
  const words = label.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const one = words.join(' ');
  if (words.length < 2 || one.length <= LABEL_NO_WRAP) return [[one]];
  let best: string[] | undefined;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    if (best === undefined || Math.max(a.length, b.length) < Math.max(...best.map((l) => l.length))) best = [a, b];
  }
  const two = best ?? [one];
  return one.length > LABEL_ONE_LINE_MAX ? [two] : [[one], two];
}

/** The narrowest mask an edge label can take (see {@link labelForms}). */
export function labelBox(label: string): { w: number; h: number; lines: string[] } {
  const forms = labelForms(label);
  let best = { w: 0, h: 0, lines: [] as string[] };
  for (const lines of forms) {
    const size = edgeMaskSize(lines);
    if (best.lines.length === 0 || size.w < best.w) best = { ...size, lines };
  }
  return best;
}

/** Clearance kept between a label and a node or another label (px). */
const LABEL_GAP = 3;
/** Keep a label this far from the arrowhead end of its route (px). */
const ARROW_ROOM = 12;
/** Keep a label this far from the start of its route (px). */
const START_ROOM = 6;
/** The straight run a label of width `w` needs: `w + LABEL_RUN` (px). */
export const LABEL_RUN = START_ROOM + ARROW_ROOM;
/** Cost of a label covering one segment of another edge. */
const LINE_HIT = 250;

const overlaps = (a: AvoidRect, b: AvoidRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** True when segment p→q touches the box (orthogonal or diagonal). */
function segmentTouches(p: Pt, q: Pt, b: AvoidRect): boolean {
  if (p.y === q.y) {
    return p.y >= b.y && p.y <= b.y + b.h && Math.max(p.x, q.x) >= b.x && Math.min(p.x, q.x) <= b.x + b.w;
  }
  if (p.x === q.x) {
    return p.x >= b.x && p.x <= b.x + b.w && Math.max(p.y, q.y) >= b.y && Math.min(p.y, q.y) <= b.y + b.h;
  }
  const n = Math.max(2, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 4));
  for (let k = 0; k <= n; k++) {
    const x = p.x + ((q.x - p.x) * k) / n;
    const y = p.y + ((q.y - p.y) * k) / n;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** One spot a label may take, with its preference (lower is better). */
interface Candidate {
  readonly lx: number;
  readonly ly: number;
  readonly score: number;
}

/**
 * Candidate label centres along a route, best first: on each straight
 * segment, from the segment's middle outward, where the whole mask fits on the
 * segment clear of its ends (and of the arrowhead). Longer segments rank
 * first. A segment too short for the mask offers its midpoint at a penalty.
 */
function candidates(points: readonly Pt[], w: number, h: number): Candidate[] {
  const out: Candidate[] = [];
  const n = points.length - 1;
  for (let k = 0; k < n; k++) {
    const p = points[k] as Pt;
    const q = points[k + 1] as Pt;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 1) continue;
    const horiz = p.y === q.y;
    const vert = p.x === q.x;
    // The extent the mask covers along this segment.
    const need = horiz ? w : vert ? h : Math.max(w, h) * 0.7;
    const lo = (k === 0 ? START_ROOM : 4) + need / 2;
    const hi = len - (k === n - 1 ? ARROW_ROOM : 4) - need / 2;
    const at = (t: number): { x: number; y: number } => ({
      x: Math.round(p.x + ((q.x - p.x) * t) / len),
      y: Math.round(p.y + ((q.y - p.y) * t) / len),
    });
    // Horizontal text reads best along a horizontal run.
    const base = -Math.min(len, 400) * 0.25 + (vert ? 6 : 0) + (!horiz && !vert ? 4 : 0);
    if (hi < lo) {
      const m = at(len / 2);
      out.push({ lx: m.x, ly: m.y, score: base + 300 + (lo - hi) });
      continue;
    }
    const mid = (lo + hi) / 2;
    const span = (hi - lo) / 2;
    for (let j = 0; j <= 24; j++) {
      const off = Math.ceil(j / 2) * 8 * (j % 2 === 0 ? 1 : -1);
      if (Math.abs(off) > span) break;
      const m = at(mid + off);
      out.push({ lx: m.x, ly: m.y, score: base + Math.abs(off) * 0.15 });
    }
    // The two ends of the range too: a clear window narrower than one step
    // often sits right against a node.
    if (span > 0) {
      for (const t of [lo, hi]) {
        const m = at(t);
        out.push({ lx: m.x, ly: m.y, score: base + span * 0.15 });
      }
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

/** One box to set on a route, in one or more sizes (preferred first). */
export interface RouteBoxItem {
  /** The route; without one the box sits at (`lx`, `ly`). */
  readonly points?: readonly Pt[] | undefined;
  readonly lx: number;
  readonly ly: number;
  /** The sizes the box may take, preferred first (a one- and a two-line label). */
  readonly sizes: ReadonlyArray<{ readonly w: number; readonly h: number }>;
}

/** Where {@link placeOnRoutes} put a box. */
export interface RouteBoxSpot {
  readonly lx: number;
  readonly ly: number;
  /** Index into the item's `sizes`. */
  readonly size: number;
  /** The box as placed. */
  readonly box: AvoidRect;
}

/** Options for {@link placeOnRoutes}. */
export interface PlaceOptions {
  /** Keep every box inside this one (the viewBox). */
  readonly bounds?: AvoidRect | undefined;
  /** Every edge route, so a box avoids sitting on another edge's line. */
  readonly routes?: ReadonlyArray<readonly Pt[] | undefined>;
}

/**
 * Sets boxes (labels) on their routes: each at the best clear spot along its
 * own route — the longest straight segment first, from its middle outward —
 * never on a node (`avoid`) or another placed box, inside the bounds, and
 * (softly) off other routes' lines. Most-constrained items go first. An item
 * with no clear spot gets `undefined`. Deterministic.
 */
export function placeOnRoutes(
  items: ReadonlyArray<RouteBoxItem | undefined>,
  avoid: ReadonlyArray<AvoidRect>,
  opts: PlaceOptions = {},
): Array<RouteBoxSpot | undefined> {
  const bounds = opts.bounds;
  const routes = opts.routes ?? [];
  const inBounds = (b: AvoidRect): boolean =>
    bounds === undefined ||
    (b.x >= bounds.x && b.y >= bounds.y && b.x + b.w <= bounds.x + bounds.w && b.y + b.h <= bounds.y + bounds.h);
  const hitsNode = (b: AvoidRect): boolean => avoid.some((r) => overlaps(b, r));
  /** Segments of other edges a box would cover. */
  const lineHits = (b: AvoidRect, own: readonly Pt[] | undefined): number => {
    let n = 0;
    for (const r of routes) {
      if (r === undefined || r === own) continue;
      for (let k = 0; k + 1 < r.length; k++) if (segmentTouches(r[k] as Pt, r[k + 1] as Pt, b)) n++;
    }
    return n;
  };
  /** One candidate spot: where, in which size, and how good. */
  interface Spot extends Candidate {
    readonly size: number;
    readonly w: number;
    readonly h: number;
  }
  const spotsOf: Spot[][] = items.map((it) => {
    if (it === undefined) return [];
    const routed = it.points !== undefined && it.points.length >= 2;
    const spots: Spot[] = [];
    it.sizes.forEach((sz, si) => {
      // The first size reads best; the next ones are fallbacks.
      const cs = routed ? candidates(it.points ?? [], sz.w, sz.h) : [{ lx: it.lx, ly: it.ly, score: 0 }];
      for (const c of cs) spots.push({ ...c, score: c.score + si * 14, size: si, w: sz.w, h: sz.h });
    });
    return spots.sort((a, b) => a.score - b.score);
  });
  const boxAt = (c: Spot, pad: number): AvoidRect => ({
    x: c.lx - c.w / 2 - pad,
    y: c.ly - c.h / 2 - pad,
    w: c.w + 2 * pad,
    h: c.h + 2 * pad,
  });
  const fits = (c: Spot): boolean => inBounds(boxAt(c, 0)) && !hitsNode(boxAt(c, LABEL_GAP));
  const freedom = spotsOf.map((spots) => spots.filter(fits).length);
  const order = items
    .map((_, i) => i)
    .filter((i) => items[i] !== undefined)
    .sort((a, b) => (freedom[a] ?? 0) - (freedom[b] ?? 0) || a - b);
  const placed: AvoidRect[] = [];
  const out: Array<RouteBoxSpot | undefined> = items.map(() => undefined);
  for (const i of order) {
    let best: { c: Spot; cost: number } | undefined;
    for (const c of spotsOf[i] ?? []) {
      if (best !== undefined && c.score >= best.cost) break; // sorted: nothing cheaper follows
      if (!fits(c)) continue;
      const padded = boxAt(c, LABEL_GAP);
      if (placed.some((p) => overlaps(padded, p))) continue;
      const cost = c.score + lineHits(boxAt(c, 4), items[i]?.points) * LINE_HIT;
      if (best === undefined || cost < best.cost) best = { c, cost };
    }
    if (best !== undefined) {
      const box = boxAt(best.c, 0);
      placed.push(box);
      out[i] = { lx: best.c.lx, ly: best.c.ly, size: best.c.size, box };
    }
  }
  return out;
}

/** Options for {@link edgeLabelLayer}. */
export interface LabelLayerOptions extends PlaceOptions {
  /** The skin's label language (paper masks + hollow badges). */
  readonly skin?: boolean;
  /** Number shown on a fallback numeral (default: 1, 2, … in edge order). */
  readonly stepNumber?: (index: number) => number;
  /** Omit the step legend (the renderer lists the numerals elsewhere). */
  readonly noLegend?: boolean;
}

/** What {@link edgeLabelLayer} drew. */
export interface LabelLayer {
  /** SVG for the labels, to draw last (on top of everything). */
  readonly overlay: string;
  /** The step legend under the SVG (fallback numerals only). */
  readonly legend: string;
  /** Data paths of the labels that fell back to a numeral. */
  readonly fallbacks: readonly string[];
  /** Indices (into `pending`) of the labels that fell back to a numeral. */
  readonly fallbackIndex: readonly number[];
  /** The mask box of every label placed on its edge. */
  readonly boxes: readonly AvoidRect[];
  /** Each placed label's mask box with its index into `pending`. */
  readonly placed: ReadonlyArray<{ readonly index: number; readonly box: AvoidRect }>;
}

/**
 * Places every edge label on its own edge (see the module comment) and draws
 * them, in edge order. A fallback numeral's legend entry carries the same
 * `data-bp` as its arrow, so twin highlighting works. Pass the node boxes as
 * `avoid`.
 *
 * An edge with a request `step` (skin only) sets its numeral and its label as
 * one unit, `③ label`, so the number can never drift from the words; an
 * unlabelled step sets the numeral alone. A stepped label with no clear place
 * keeps its numeral on the edge and lists the words under its own number.
 */
export function edgeLabelLayer(
  pending: ReadonlyArray<EdgeLabelPoint>,
  avoid: ReadonlyArray<AvoidRect> = [],
  opts: LabelLayerOptions = {},
): LabelLayer {
  const skin = opts.skin === true;
  const bounds = opts.bounds;
  const inBounds = (b: AvoidRect): boolean =>
    bounds === undefined ||
    (b.x >= bounds.x && b.y >= bounds.y && b.x + b.w <= bounds.x + bounds.w && b.y + b.h <= bounds.y + bounds.h);
  const stepOf = (l: EdgeLabelPoint): number | undefined => (skin ? l.step : undefined);
  const forms = pending.map((l) =>
    l.label === undefined || l.label === '' ? [] : skin ? labelForms(l.label) : [[l.label]],
  );
  const spots = placeOnRoutes(
    pending.map((l, i) => {
      const f = forms[i] ?? [];
      const stepped = stepOf(l) !== undefined;
      if (f.length === 0 && !stepped) return undefined;
      const sizes =
        f.length === 0
          ? [{ w: STEP_H, h: STEP_H }]
          : f.map((lines) => {
              if (!skin) return { w: Math.max(26, (l.label?.length ?? 0) * 5.4), h: 18 };
              const m = edgeMaskSize(lines);
              return stepped ? { w: m.w + STEP_W, h: Math.max(m.h, STEP_H) } : m;
            });
      return { points: l.points, lx: l.lx, ly: l.ly, sizes };
    }),
    avoid,
    opts,
  );
  const placedBoxes: AvoidRect[] = [];
  const placed: Array<{ index: number; box: AvoidRect }> = [];
  spots.forEach((sp, i) => {
    if (sp === undefined) return;
    placedBoxes.push(sp.box);
    placed.push({ index: i, box: sp.box });
  });
  const items = pending
    .map((l, i) => ({ i, l, text: l.label ?? '', step: stepOf(l) }))
    .filter((it) => it.text !== '' || it.step !== undefined);
  const at = new Map<number, { lx: number; ly: number; w: number; lines: readonly string[] }>();
  spots.forEach((sp, i) => {
    if (sp !== undefined) at.set(i, { lx: sp.lx, ly: sp.ly, w: sp.box.w, lines: forms[i]?.[sp.size] ?? [] });
  });
  // A numeral that only stands in for a label never repeats an authored step.
  const firstFree = Math.max(0, ...items.map((it) => it.step ?? 0));

  const overlay: string[] = [];
  const steps: Array<{ label: string; err?: boolean; path?: string; reveal?: number; n?: number }> = [];
  const fallbacks: string[] = [];
  const fallbackIndex: number[] = [];
  const badgeAvoid: AvoidRect[] = [...avoid, ...placedBoxes];
  for (const it of items) {
    const l = it.l;
    const err = l.err === true;
    // The label reveals with its edge (deck builds).
    const attrs = bp(l.path) + (l.reveal !== undefined ? revealAttr(l.reveal) : '');
    const p = at.get(it.i);
    if (p !== undefined) {
      const tone = err ? 'error' : l.accent === true ? 'accent' : 'muted';
      if (it.step !== undefined) {
        overlay.push(`<g${attrs}>${steppedMark(p, it.step, err, l.hue, tone)}</g>`);
        continue;
      }
      const mark = skin ? edgeMask({ lx: p.lx, ly: p.ly }, p.lines, tone) : edgePill({ lx: p.lx, ly: p.ly }, l.label, err);
      overlay.push(`<g${attrs}>${mark}</g>`);
      continue;
    }
    // Last resort: a numeral on the route, clear of nodes and labels.
    const badge = (c: { lx: number; ly: number }): AvoidRect => ({ x: c.lx - 10, y: c.ly - 10, w: 20, h: 20 });
    const free = l.points !== undefined && l.points.length >= 2 ? candidates(l.points, 20, 20) : [];
    const spot = free.find((c) => inBounds(badge(c)) && !badgeAvoid.some((r) => overlaps(badge(c), r))) ?? dodge(l.lx, l.ly, badgeAvoid);
    badgeAvoid.push(badge(spot));
    if (it.text === '') {
      // An unlabelled step: its numeral is the whole mark, so nothing is lost.
      overlay.push(`<g${attrs}>${edgeStep({ lx: spot.lx, ly: spot.ly }, it.step ?? 0, err, true, l.hue ?? 'ink')}</g>`);
      continue;
    }
    const num =
      it.step ??
      (opts.stepNumber !== undefined ? opts.stepNumber(it.i) : firstFree + steps.filter((st) => st.n !== undefined && st.n > firstFree).length + 1);
    steps.push({
      label: it.text,
      path: l.path,
      n: num,
      ...(err ? { err: true } : {}),
      ...(l.reveal !== undefined ? { reveal: l.reveal } : {}),
    });
    fallbacks.push(l.path);
    fallbackIndex.push(it.i);
    overlay.push(`<g${attrs}>${edgeStep({ lx: spot.lx, ly: spot.ly }, num, err, skin, it.step !== undefined ? (l.hue ?? 'ink') : undefined)}</g>`);
  }
  return {
    overlay: overlay.join(''),
    legend: opts.noLegend === true ? '' : stepsLegend(steps),
    fallbacks,
    fallbackIndex,
    boxes: placedBoxes,
    placed,
  };
}

/**
 * A request step on its edge: the numeral alone, or the numeral then the
 * label on one paper mask (`③ label`), centred on the placed spot `p` of
 * width `p.w`.
 */
function steppedMark(
  p: { readonly lx: number; readonly ly: number; readonly w: number; readonly lines: readonly string[] },
  step: number,
  err: boolean,
  hue: Hue | undefined,
  tone: 'muted' | 'error' | 'accent',
): string {
  if (p.lines.length === 0) return edgeStep({ lx: p.lx, ly: p.ly }, step, err, true, hue ?? 'ink');
  const left = p.lx - p.w / 2;
  const bx = left + STEP_R + 1;
  const mask = edgeMaskSize(p.lines);
  const mx = left + STEP_W + mask.w / 2;
  // The mask reaches back under the numeral, so no line shows between them.
  const bridge = `<rect x="${bx}" y="${p.ly - mask.h / 2}" width="${STEP_W - STEP_R - 1}" height="${mask.h}" fill="var(--paper)"/>`;
  return bridge + edgeMask({ lx: mx, ly: p.ly }, p.lines, tone) + edgeStep({ lx: bx, ly: p.ly }, step, err, true, hue ?? 'ink');
}
