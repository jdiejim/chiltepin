/**
 * The parts of a C4 drawing: what an element looks like (its shape, hue and
 * type line), the element shapes themselves, the relationship labels, and
 * the key. `c4.ts` lays the diagram out and calls these.
 *
 * C4 notation, drawn in the skin (`DESIGN.md`):
 *
 * - **Elements.** Name (bold), then the type line in brackets —
 *   `[Person]`, `[Software System]`, `[Container: Go, gRPC]`,
 *   `[Component: Spring Bean]` — then the description, which wraps and is
 *   never cut without a report.
 * - **Shapes.** A person is a head over rounded shoulders; a database is a
 *   cylinder; a queue is a pipe on its side; a web front end is a browser
 *   window; a mobile app is a phone on its side; everything else is a
 *   rounded card.
 * - **Colour.** Hue is the category (people rose, systems and containers
 *   blue, stores amber, queues teal, or the hue of the block kind a
 *   `family` names). Anything outside the scope is neutral: the `paper-2`
 *   fill, a `rule-solid` dashed outline. The system in scope of a context
 *   diagram takes the accent.
 * - **Relationships.** One-way arrows; the label states the intent, and the
 *   technology sits on its own line in brackets. A dynamic diagram puts the
 *   step numeral above the label.
 */

import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';
import { edgeMaskSize } from '../svg/edgePill.js';
import { edgeStep, labelForms, LABEL_RUN, placeOnRoutes, type AvoidRect } from '../svg/edgeSteps.js';
import { nodeSkin } from '../svg/blockStyle.js';
import { hueTint, type Hue } from '../svg/hues.js';
import { routeMidpoint } from '../svg/geometry.js';
import { moveOffLabels, polylinePath, segmentHitsBox, type Pt, type RoutedEdge } from '../svg/router.js';
import type { Box } from '../svg/ortho.js';
import { revealAttr } from '../svg/reveal.js';

/** The outline an element draws. */
export type C4Shape = 'person' | 'box' | 'cylinder' | 'pipe' | 'browser' | 'phone';

/** How one element is drawn. */
export interface C4Look {
  readonly shape: C4Shape;
  /** Outside the scope: neutral fill, dashed `rule-solid` outline. */
  readonly external: boolean;
  /** The category hue; absent when external. */
  readonly hue?: Hue;
  /** The C4 element type: `Person`, `Software System`, `Container`, `Component`. */
  readonly type: string;
}

/** The element fields the look depends on. */
export interface C4ElementData {
  readonly kind: string;
  readonly family?: string | undefined;
  readonly name: string;
  readonly tech?: string | undefined;
}

const words = (list: string): ReadonlySet<string> => new Set(list.split(' '));
/** `family` words that draw a database cylinder. */
const STORE_FAMILY = words(
  'store data db database datastore sql nosql postgres mysql mongo mongodb dynamo cache redis memcached warehouse lake bucket blob object s3 search index elasticsearch opensearch vector',
);
/** `family` words that draw a pipe (a queue, a topic, an event stream). */
const PIPE_FAMILY = words('queue topic stream kafka kinesis mq broker sqs sns rabbitmq bus eventbus pubsub');
/** `family` words that draw a browser window. */
const WEB_FAMILY = words('web browser spa frontend webapp');
/** `family` words that draw a phone. */
const PHONE_FAMILY = words('mobile ios android phone');
/** In a `client` element's name or technology: a phone, or no device at all. */
const PHONE_HINT = /\b(mobile|ios|android|iphone|ipad|phone|react native|flutter|swift|swiftui|kotlin|xamarin)\b/i;
const DESKTOP_HINT = /\b(desktop|electron|cli|command[- ]line|terminal|tauri|wpf|winforms)\b/i;

/** The look of one element (see the module comment). */
export function c4Look(n: C4ElementData): C4Look {
  const f = (n.family ?? '').trim().toLowerCase();
  const ext = f === 'external';
  switch (n.kind) {
    case 'person':
      return ext ? { shape: 'person', external: true, type: 'Person' } : { shape: 'person', external: false, hue: 'rose', type: 'Person' };
    case 'system':
      return ext ? { shape: 'box', external: true, type: 'Software System' } : { shape: 'box', external: false, hue: 'blue', type: 'Software System' };
    case 'external':
      return { shape: 'box', external: true, type: 'Software System' };
    case 'store':
      return ext ? { shape: 'cylinder', external: true, type: 'Container' } : { shape: 'cylinder', external: false, hue: 'amber', type: 'Container' };
    default: {
      const type = n.kind === 'component' ? 'Component' : 'Container';
      if (ext) return { shape: 'box', external: true, type };
      if (STORE_FAMILY.has(f)) return { shape: 'cylinder', external: false, hue: 'amber', type };
      if (PIPE_FAMILY.has(f)) return { shape: 'pipe', external: false, hue: 'teal', type };
      if (WEB_FAMILY.has(f)) return { shape: 'browser', external: false, hue: 'rose', type };
      if (PHONE_FAMILY.has(f)) return { shape: 'phone', external: false, hue: 'rose', type };
      if (f === 'client') {
        const hint = `${n.name} ${n.tech ?? ''}`;
        const shape: C4Shape = PHONE_HINT.test(hint) ? 'phone' : DESKTOP_HINT.test(hint) ? 'box' : 'browser';
        return { shape, external: false, hue: 'rose', type };
      }
      return { shape: 'box', external: false, hue: nodeSkin(f).hue ?? 'blue', type };
    }
  }
}

/** The bracketed type line: `[Container: Go, gRPC]`. */
export function typeLine(look: C4Look, tech: string | undefined): string {
  const t = tech?.trim() ?? '';
  return `[${look.type}${t.length > 0 ? `: ${t}` : ''}]`;
}

/* ── shapes ───────────────────────────────────────────────────────────── */

/** A box in viewBox units. */
export interface C4Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Head radius of the person shape. */
const HEAD_R = 21;
/** Where the person's body starts, below the top of its cell: the body hides the lower part of the head. */
const BODY_TOP = 2 * HEAD_R - 13;

/** Width of a phone's bezel, either side of its screen. */
const PHONE_BEZEL = 18;

/** Room the shape takes around its text: top, bottom, and each side. */
export function shapeInsets(shape: C4Shape): { top: number; bottom: number; side: number; right?: number } {
  switch (shape) {
    case 'person':
      return { top: BODY_TOP + 14, bottom: 12, side: 14 };
    case 'cylinder':
      return { top: 26, bottom: 14, side: 12 };
    case 'pipe':
      return { top: 10, bottom: 10, side: 18, right: 26 };
    case 'browser':
      return { top: 26, bottom: 12, side: 12 };
    case 'phone':
      return { top: 10, bottom: 10, side: PHONE_BEZEL + 8 };
    default:
      return { top: 12, bottom: 12, side: 12 };
  }
}

/** The text area of an element drawn in `r`. */
export function textArea(shape: C4Shape, r: C4Rect): C4Rect {
  const i = shapeInsets(shape);
  const right = i.right ?? i.side;
  return { x: r.x + i.side, y: r.y + i.top, w: r.w - i.side - right, h: r.h - i.top - i.bottom };
}

/** The box arrows attach to: the body of a person, the whole shape otherwise. */
export function portBox(shape: C4Shape, r: C4Rect): C4Rect {
  return shape === 'person' ? { x: r.x, y: r.y + BODY_TOP, w: r.w, h: r.h - BODY_TOP } : r;
}

const n1 = (v: number): number => Math.round(v * 10) / 10;

/** The paint of an element: fill, outline, its width and dash. */
export interface C4Paint {
  readonly fill: string;
  readonly stroke: string;
  readonly sw: number;
  readonly dash: string;
}

/** The paint of an element from its look (`accent`: the system in scope). */
export function c4Paint(look: C4Look, accent: boolean): C4Paint {
  if (accent) return { fill: 'var(--accent-tint)', stroke: 'var(--accent)', sw: 1.75, dash: '' };
  if (look.external) return { fill: 'var(--paper-2)', stroke: 'var(--rule-solid)', sw: 1.25, dash: '4 3' };
  return { fill: look.hue !== undefined ? hueTint(look.hue) : 'var(--paper)', stroke: 'var(--ink)', sw: 1.5, dash: '' };
}

/**
 * The outline of an element in `r`. A person: a head over a body with
 * rounded shoulders (the first `rect` is the body). A cylinder: the body
 * and the front of its top rim. A pipe: the body and the front of its right
 * end. A browser: the window and its tab bar with three dots. A phone: the
 * rounded body with the speaker and the button.
 */
export function shapeSvg(shape: C4Shape, r: C4Rect, p: C4Paint): string {
  const dash = p.dash.length > 0 ? ` stroke-dasharray="${p.dash}"` : '';
  const line = `fill="none" stroke="${p.stroke}" stroke-width="${p.sw}"${dash}`;
  const solid = `fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}"${dash}`;
  const { x, y, w, h } = r;
  switch (shape) {
    case 'person': {
      const cx = x + w / 2;
      // The head first: the body's shoulders hide its lower part.
      return (
        `<circle cx="${cx}" cy="${y + HEAD_R}" r="${HEAD_R}" ${solid}/>` +
        `<rect x="${x}" y="${y + BODY_TOP}" width="${w}" height="${h - BODY_TOP}" rx="22" ${solid}/>`
      );
    }
    case 'cylinder': {
      const ry = 10;
      return (
        `<path d="M${x} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} A ${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry} Z" ${solid}/>` +
        `<path d="M${x} ${y + ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}" ${line}/>`
      );
    }
    case 'pipe': {
      const rx = 10;
      const ry = h / 2;
      return (
        `<path d="M${x + rx} ${y} H ${x + w - rx} A ${rx} ${n1(ry)} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${n1(ry)} 0 0 1 ${x + rx} ${y} Z" ${solid}/>` +
        `<path d="M${x + w - rx} ${y} A ${rx} ${n1(ry)} 0 0 0 ${x + w - rx} ${y + h}" ${line}/>`
      );
    }
    case 'browser': {
      const dot = (k: number): string => `<circle cx="${x + 11 + k * 7}" cy="${y + 8}" r="2" fill="${p.stroke}"/>`;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${solid}/>` +
        `<path d="M${x} ${y + 16} H ${x + w}" ${line}/>` +
        dot(0) + dot(1) + dot(2)
      );
    }
    case 'phone': {
      // A phone on its side: the screen between two bezels, the speaker on
      // the left one, the button on the right one.
      const cy = y + h / 2;
      const ink = `fill="none" stroke="${p.stroke}"`;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" ${solid}/>` +
        `<path d="M${x + PHONE_BEZEL} ${y} V ${y + h} M${x + w - PHONE_BEZEL} ${y} V ${y + h}" ${ink} stroke-width="1"/>` +
        `<path d="M${x + PHONE_BEZEL / 2} ${n1(cy - 7)} V ${n1(cy + 7)}" ${ink} stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="${x + w - PHONE_BEZEL / 2}" cy="${n1(cy)}" r="3.5" ${ink} stroke-width="1"/>`
      );
    }
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${solid}/>`;
  }
}

/* ── relationship labels ───────────────────────────────────────────────── */

/** One relationship label to place. */
export interface C4RelLabel {
  /** The intent ("Reads from and writes to"); may be empty. */
  readonly label?: string | undefined;
  /** The technology, drawn as `[tech]` on its own line. */
  readonly tech?: string | undefined;
  /** The step of a dynamic diagram (the numeral above the label). */
  readonly step?: number | undefined;
  readonly err: boolean;
  readonly path: string;
}

/** The longest technology line before it wraps (characters). */
const TECH_ONE_LINE_MAX = 30;
/** Height of the step numeral row above a label (px). */
const STEP_ROW = 20;

/** One way to set a label: its lines, how many of them are the technology, and its mask. */
interface RelForm {
  readonly intent: readonly string[];
  readonly tech: readonly string[];
  readonly w: number;
  readonly h: number;
  /**
   * How far the label hangs below the point it is placed at: a tall label
   * keeps its first line close to the line it labels (within
   * {@link FIRST_LINE_REACH}), so it never reads as another edge's label.
   */
  readonly drop: number;
}

/** The farthest the centre of a label's first line sits from its line (px). */
const FIRST_LINE_REACH = 10;

/** The technology in brackets, on one line or (long) two. */
function techLines(tech: string | undefined): string[] {
  const t = tech?.trim() ?? '';
  if (t === '') return [];
  const one = `[${t}]`;
  if (one.length <= TECH_ONE_LINE_MAX) return [one];
  const split = labelForms(t).find((f) => f.length === 2);
  return split !== undefined ? [`[${split[0] ?? ''}`, `${split[1] ?? ''}]`] : [one];
}

/** An intent this long (characters) may also take three balanced lines. */
const INTENT_THREE_LINES = 40;

/** The balanced three-line split of `text` (the split whose longest line is shortest). */
function threeLines(text: string): string[] | undefined {
  const w = text.split(/\s+/).filter((x) => x.length > 0);
  if (w.length < 3) return undefined;
  let best: string[] | undefined;
  for (let i = 1; i < w.length - 1; i++) {
    for (let j = i + 1; j < w.length; j++) {
      const lines = [w.slice(0, i).join(' '), w.slice(i, j).join(' '), w.slice(j).join(' ')];
      if (best === undefined || Math.max(...lines.map((l) => l.length)) < Math.max(...best.map((l) => l.length))) best = lines;
    }
  }
  return best;
}

/** The ways a relationship label may be set, preferred first. */
export function relForms(l: C4RelLabel): RelForm[] {
  const tech = techLines(l.tech);
  const text = l.label?.trim() ?? '';
  const intents = text !== '' ? labelForms(text) : [[]];
  const three = text.length >= INTENT_THREE_LINES ? threeLines(text) : undefined;
  if (three !== undefined) intents.push(three);
  const out: RelForm[] = [];
  for (const intent of intents) {
    const lines = [...intent, ...tech];
    if (lines.length === 0 && l.step === undefined) continue;
    const mask = lines.length > 0 ? edgeMaskSize(lines) : { w: 0, h: 0 };
    const stepH = l.step !== undefined ? STEP_ROW : 0;
    const h = mask.h + stepH;
    const first = lines.length > 0 ? stepH + 7 : 10;
    const drop = Math.max(0, h / 2 - first - FIRST_LINE_REACH);
    out.push({ intent, tech, w: Math.max(mask.w, l.step !== undefined ? 20 : 0), h, drop });
  }
  return out;
}

/** The smallest straight run a label needs on a horizontal and on a vertical segment. */
export function relNeed(l: C4RelLabel): { w: number; h: number } {
  const forms = relForms(l);
  if (forms.length === 0) return { w: 0, h: 0 };
  return {
    w: Math.min(...forms.map((f) => f.w)) + LABEL_RUN,
    h: Math.min(...forms.map((f) => f.h + 2 * f.drop)) + LABEL_RUN,
  };
}

/** The text of a label in one line (geometry report, fallback list). */
export function relText(l: C4RelLabel): string {
  const t = l.tech?.trim() ?? '';
  return [l.label?.trim() ?? '', t !== '' ? `[${t}]` : ''].filter((s) => s !== '').join(' ');
}

/** Draws one placed label: the mask, the step numeral, the intent, the technology. */
function relMark(lx: number, ly: number, f: RelForm, l: C4RelLabel): string {
  const top = ly - f.h / 2 + f.drop;
  const step = l.step !== undefined ? edgeStep({ lx, ly: top + 10 }, l.step, l.err, true) : '';
  const lines = [...f.intent.map((t) => ({ t, tech: false })), ...f.tech.map((t) => ({ t, tech: true }))];
  const textTop = top + (l.step !== undefined ? STEP_ROW : 0);
  const mask = lines.length > 0 ? edgeMaskSize(lines.map((x) => x.t)) : { w: 0, h: 0 };
  const texts = lines
    .map((x, j) => {
      const tone = x.tech ? ' c-soft' : l.err ? ' c-negative' : '';
      return `<text x="${lx}" y="${n1(textTop + 10.5 + j * 12)}" class="t-arrow${tone}" text-anchor="middle">${escapeHtml(x.t)}</text>`;
    })
    .join('');
  const rect = lines.length > 0 ? `<rect x="${n1(lx - mask.w / 2)}" y="${n1(textTop)}" width="${mask.w}" height="${mask.h}" fill="var(--paper)"/>` : '';
  // The text first: its first line is the one a reader ties to the edge.
  return rect + texts + step;
}

/** What {@link c4Labels} returns. */
export interface C4LabelLayer {
  /** The routes, moved off the labels of other edges. */
  readonly routes: ReadonlyArray<RoutedEdge | undefined>;
  /** The label SVG, drawn on top of everything. */
  readonly overlay: string;
  /** The list under the drawing for labels with no place on their edge. */
  readonly list: string;
  /** Edge indices whose label fell back to a numeral. */
  readonly fallbacks: readonly number[];
  /** The mask box of every placed label. */
  readonly boxes: readonly AvoidRect[];
}

/** Rounds of "place labels, move lines off them". */
const SETTLE_ROUNDS = 2;

/** How far a label keeps from a panel border (px). */
const RAIL_CLEAR = 6;
const grow = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });

/** An outline of a box as a closed polyline (a panel border a label avoids). */
const outlineOf = (b: Box): Pt[] => [
  { x: b.x, y: b.y },
  { x: b.x + b.w, y: b.y },
  { x: b.x + b.w, y: b.y + b.h },
  { x: b.x, y: b.y + b.h },
  { x: b.x, y: b.y },
];

/**
 * Places every relationship label on its own route (the longest straight
 * run first, never on an element, another label, or — softly — another
 * line), then moves other routes off the placed labels and places again. A
 * label with no place shows its step (or the next free numeral) on the
 * route and its text in the list under the drawing.
 */
export function c4Labels(
  routes0: ReadonlyArray<RoutedEdge | undefined>,
  rels: readonly C4RelLabel[],
  opts: {
    readonly avoid: readonly Box[];
    readonly obstacles: readonly Box[];
    readonly bounds: Box;
    readonly rails: readonly Box[];
    readonly reveal?: (edge: number) => number | undefined;
  },
): C4LabelLayer {
  const forms = rels.map(relForms);
  const place = (routes: ReadonlyArray<RoutedEdge | undefined>): ReturnType<typeof placeOnRoutes> =>
    placeOnRoutes(
      rels.map((_, i) => {
        const f = forms[i] ?? [];
        const pts = routes[i]?.points;
        if (f.length === 0 || pts === undefined) return undefined;
        // A label that hangs below its point reserves the same room above it.
        return { points: pts, ...routeMidpoint(pts), sizes: f.map((x) => ({ w: x.w, h: x.h + 2 * x.drop })) };
      }),
      opts.avoid,
      // A panel border counts as a line the label should not sit on, and as
      // a thick one: a label just beside it reads as sitting on it.
      { bounds: opts.bounds, routes: [...routes.map((r) => r?.points), ...opts.rails.map((b) => outlineOf(grow(b, RAIL_CLEAR)))] },
    );
  let routes = routes0;
  let spots = place(routes);
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const boxes = spots.flatMap((s, i) => (s !== undefined ? [{ box: s.box, edge: i }] : []));
    const moved = moveOffLabels(routes, boxes, opts.obstacles, opts.bounds, undefined, false);
    if (moved.every((r, i) => r === routes[i])) break;
    routes = moved;
    spots = place(routes);
  }

  const overlay: string[] = [];
  const boxes: AvoidRect[] = [];
  const fallbacks: number[] = [];
  const listItems: string[] = [];
  const badgeAvoid: AvoidRect[] = [...opts.avoid, ...spots.flatMap((s) => (s !== undefined ? [s.box] : []))];
  const usedSteps = new Set(rels.flatMap((l) => (l.step !== undefined ? [l.step] : [])));
  let nextNum = 1;
  rels.forEach((l, i) => {
    const f = forms[i] ?? [];
    if (f.length === 0) return;
    const reveal = opts.reveal?.(i);
    const attrs = bp(l.path) + (reveal !== undefined ? revealAttr(reveal) : '');
    const s = spots[i];
    if (s !== undefined) {
      const form = f[s.size] as RelForm;
      boxes.push({ x: s.lx - form.w / 2, y: s.ly - form.h / 2 + form.drop, w: form.w, h: form.h });
      overlay.push(`<g${attrs}>${relMark(s.lx, s.ly, form, l)}</g>`);
      return;
    }
    const pts = routes[i]?.points;
    if (pts === undefined) return;
    // Last resort: a numeral on the route, the text in the list below.
    let num = l.step;
    if (num === undefined) {
      while (usedSteps.has(nextNum)) nextNum++;
      num = nextNum++;
    }
    const badge = (c: { lx: number; ly: number }): AvoidRect => ({ x: c.lx - 10, y: c.ly - 10, w: 20, h: 20 });
    const free = freeSpot(pts, (c) => !badgeAvoid.some((r) => hit(badge(c), r)));
    badgeAvoid.push(badge(free));
    fallbacks.push(i);
    overlay.push(`<g${attrs}>${edgeStep(free, num, l.err, true)}</g>`);
    listItems.push(
      `<span class="edge-step${l.err ? ' err' : ''}"${bp(l.path)}${reveal !== undefined ? revealAttr(reveal) : ''}><b>${num}</b>${escapeHtml(relText(l))}</span>`,
    );
  });
  return {
    routes,
    overlay: overlay.join(''),
    list: listItems.length > 0 ? `<div class="edge-steps">${listItems.join('')}</div>` : '',
    fallbacks,
    boxes,
  };
}

const hit = (a: AvoidRect, b: AvoidRect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The first point along a route (by eighths, middle first) that `ok` accepts; the midpoint else. */
function freeSpot(pts: readonly Pt[], ok: (c: { lx: number; ly: number }) => boolean): { lx: number; ly: number } {
  const total = pts.slice(1).reduce((a, q, k) => a + Math.hypot(q.x - (pts[k] as Pt).x, q.y - (pts[k] as Pt).y), 0);
  const at = (t: number): { lx: number; ly: number } => {
    let left = t * total;
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k] as Pt;
      const q = pts[k + 1] as Pt;
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (left <= len && len > 0) return { lx: Math.round(p.x + ((q.x - p.x) * left) / len), ly: Math.round(p.y + ((q.y - p.y) * left) / len) };
      left -= len;
    }
    const last = pts[pts.length - 1] as Pt;
    return { lx: last.x, ly: last.y };
  };
  for (const t of [0.5, 0.375, 0.625, 0.25, 0.75, 0.125, 0.875]) {
    const c = at(t);
    if (ok(c)) return c;
  }
  return at(0.5);
}

/* ── junctions ─────────────────────────────────────────────────────────── */

/** True when `p` lies on the segment a→b (orthogonal segments, 1 px slack). */
function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  if (a.x === b.x) return Math.abs(p.x - a.x) <= 1 && p.y >= Math.min(a.y, b.y) - 1 && p.y <= Math.max(a.y, b.y) + 1;
  if (a.y === b.y) return Math.abs(p.y - a.y) <= 1 && p.x >= Math.min(a.x, b.x) - 1 && p.x <= Math.max(a.x, b.x) + 1;
  return false;
}

/** True when `p` lies on any segment of `line`. */
const onLine = (p: Pt, line: readonly Pt[]): boolean => line.some((a, k) => k + 1 < line.length && onSegment(p, a, line[k + 1] as Pt));

/** The steps a moved segment tries, nearest first (px). */
const NUDGES = [8, -8, 16, -16, 24, -24];

/**
 * Moves a route off a bend it shares with another route. When one line
 * turns exactly where another line runs or turns, the two read as two
 * straight lines that cross, or as a branch: a false link. The segment
 * next to such a bend steps sideways (a track at a time) to a place where
 * it touches no element, no other route, and keeps its neighbours' turns.
 * A bend that cannot move stays.
 */
export function separateBends(routes: ReadonlyArray<RoutedEdge | undefined>, boxes: readonly Box[]): Array<RoutedEdge | undefined> {
  const pts = routes.map((r) => (r === undefined ? undefined : r.points.map((p) => ({ x: p.x, y: p.y }))));
  const others = (i: number): Pt[][] => pts.filter((l, j): l is Pt[] => l !== undefined && j !== i);
  const clear = (i: number, line: readonly Pt[], from: number, to: number): boolean => {
    // The moved run keeps clear of every element; its neighbours (one of them
    // may start on its own element) only stay out of them.
    for (let k = Math.max(0, from - 1); k < Math.min(line.length - 1, to + 1); k++) {
      const a = line[k] as Pt;
      const b = line[k + 1] as Pt;
      const pad = k >= from && k < to ? 4 : 0;
      if (boxes.some((bx) => segmentHitsBox(a, b, grow(bx, pad)))) return false;
    }
    for (const o of others(i)) {
      for (let k = from; k <= to; k++) if (onLine(line[k] as Pt, o)) return false;
      // No run on top of, or right beside, another route.
      for (let k = from; k < to; k++) {
        const a = line[k] as Pt;
        const b = line[k + 1] as Pt;
        for (let m = 0; m + 1 < o.length; m++) {
          const c = o[m] as Pt;
          const d = o[m + 1] as Pt;
          const both = (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 6) || (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 6);
          if (!both) continue;
          const lo = a.x === b.x ? Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) : Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
          const hi = a.x === b.x ? Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) : Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
          if (hi > lo) return false;
        }
      }
    }
    return true;
  };
  let changed = false;
  pts.forEach((first, i) => {
    if (first === undefined) return;
    let line = first;
    for (let k = 1; k + 1 < line.length; k++) {
      if (!others(i).some((o) => onLine(line[k] as Pt, o))) continue;
      // Move the interior segment next to the bend: k → k+1, else k−1 → k.
      for (const [s0, s1] of [[k, k + 1], [k - 1, k]] as const) {
        if (s0 < 1 || s1 > line.length - 2) continue;
        const a = line[s0] as Pt;
        const b = line[s1] as Pt;
        const vertical = a.x === b.x;
        let done = false;
        for (const d of NUDGES) {
          const moved = line.map((p, j) => (j === s0 || j === s1 ? (vertical ? { x: p.x + d, y: p.y } : { x: p.x, y: p.y + d }) : p));
          // The neighbours keep their direction and some length.
          const keeps = [s0 - 1, s1].every((j) => {
            const p = line[j] as Pt;
            const q = line[j + 1] as Pt;
            const mp = moved[j] as Pt;
            const mq = moved[j + 1] as Pt;
            const len = Math.abs(mq.x - mp.x) + Math.abs(mq.y - mp.y);
            return len >= 6 && Math.sign(mq.x - mp.x) === Math.sign(q.x - p.x) && Math.sign(mq.y - mp.y) === Math.sign(q.y - p.y);
          });
          if (!keeps || !clear(i, moved, s0, s1)) continue;
          pts[i] = moved;
          line = moved;
          changed = true;
          done = true;
          break;
        }
        if (done) break;
      }
    }
  });
  if (!changed) return [...routes];
  return routes.map((r, i) => {
    const p = pts[i];
    if (r === undefined || p === undefined) return r;
    const same = p.every((q, j) => q.x === r.points[j]?.x && q.y === r.points[j]?.y);
    return same ? r : { ...r, points: p, d: polylinePath(p) };
  });
}

/* ── the key ───────────────────────────────────────────────────────────── */

/** One entry of the key. */
export interface C4KeyItem {
  /** The swatch: an element shape, a boundary, a line, or the step numeral. */
  readonly swatch: C4Shape | 'boundary' | 'edge' | 'edge-dashed' | 'edge-error' | 'edge-forbidden' | 'step';
  readonly label: string;
  readonly paint?: C4Paint | undefined;
  /** The colour of the glyph details (browser dots), when the swatch is a shape. */
  readonly hue?: Hue | undefined;
}

const SW_W = 30;
const SW_H = 18;

/** A small copy of a shape or a line, for the key. */
function keySwatch(it: C4KeyItem): string {
  const p = it.paint ?? { fill: 'var(--paper)', stroke: 'var(--ink)', sw: 1.25, dash: '' };
  const dash = p.dash.length > 0 ? ` stroke-dasharray="${p.dash === '4 3' ? '3 2' : p.dash}"` : '';
  const solid = `fill="${p.fill}" stroke="${p.stroke}" stroke-width="${Math.min(p.sw, 1.25)}"${dash}`;
  const line = `fill="none" stroke="${p.stroke}" stroke-width="${Math.min(p.sw, 1.25)}"${dash}`;
  const arrow = (stroke: string, dashA: string, open: boolean): string =>
    `<line x1="1" y1="9" x2="${SW_W - 7}" y2="9" stroke="${stroke}" stroke-width="1.5"${dashA}/>` +
    (open
      ? `<path d="M${SW_W - 7},6 L${SW_W - 1},9 L${SW_W - 7},12" fill="none" stroke="${stroke}" stroke-width="1.2"/>`
      : `<path d="M${SW_W - 7},6 L${SW_W - 1},9 L${SW_W - 7},12 z" fill="${stroke}"/>`);
  let inner: string;
  switch (it.swatch) {
    case 'person':
      inner = `<rect x="7" y="8" width="16" height="9" rx="4" ${solid}/><circle cx="15" cy="5" r="3.6" ${solid}/>`;
      break;
    case 'cylinder':
      inner =
        `<path d="M8 4 A 7 2.5 0 0 1 22 4 V 14 A 7 2.5 0 0 1 8 14 Z" ${solid}/>` +
        `<path d="M8 4 A 7 2.5 0 0 0 22 4" ${line}/>`;
      break;
    case 'pipe':
      inner =
        `<path d="M6 3 H 24 A 2.5 6 0 0 1 24 15 H 6 A 2.5 6 0 0 1 6 3 Z" ${solid}/>` +
        `<path d="M24 3 A 2.5 6 0 0 0 24 15" ${line}/>`;
      break;
    case 'browser':
      inner = `<rect x="3" y="2" width="24" height="14" rx="2" ${solid}/><path d="M3 6 H 27" ${line}/>`;
      break;
    case 'phone':
      inner = `<rect x="3" y="3" width="24" height="12" rx="4" ${solid}/><path d="M7 3 V 15 M23 3 V 15" ${line}/>`;
      break;
    case 'boundary':
      inner = `<rect x="2" y="2" width="26" height="14" rx="3" fill="none" stroke="var(--muted)" stroke-width="1.25" stroke-dasharray="4 2.5"/>`;
      break;
    case 'edge':
      inner = arrow('var(--muted)', '', false);
      break;
    case 'edge-dashed':
      inner = arrow('var(--muted)', ' stroke-dasharray="5 4"', true);
      break;
    case 'edge-error':
      inner = arrow('var(--negative)', '', false);
      break;
    case 'edge-forbidden':
      inner = arrow('var(--negative)', ' stroke-dasharray="4 3"', false);
      break;
    case 'step':
      inner = `<circle cx="15" cy="9" r="7.5" fill="var(--paper)" stroke="var(--muted)" stroke-width="1"/><text x="15" y="12" text-anchor="middle" class="t-badge">1</text>`;
      break;
    default:
      inner = `<rect x="3" y="2" width="24" height="14" rx="3" ${solid}/>`;
  }
  return `<svg class="lg-sw" viewBox="0 0 ${SW_W} ${SW_H}" width="${SW_W}" height="${SW_H}" aria-hidden="true">${inner}</svg>`;
}

/** The key under a C4 drawing: one entry per notation the diagram uses. */
export function c4Key(items: readonly C4KeyItem[]): string {
  if (items.length < 2) return '';
  const parts = items
    .map((it) => `<span class="lg-item">${keySwatch(it)}<span class="lg-label">${escapeHtml(it.label)}</span></span>`)
    .join('');
  return `<div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span>${parts}</div>`;
}
