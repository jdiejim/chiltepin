/**
 * Renders an entity-relationship diagram as inline SVG.
 *
 * Layout (pure JS, no DOM, static SVG out) is a layered auto-layout ranked
 * by relation adjacency: the aggregate root sits in the middle column, its
 * neighbours fan out to both sides by BFS depth (each connected cluster of
 * the graph-minus-root goes wholly to one side, so no relation ever crosses
 * the root's column), and a join table lands between its two parents. `dir`
 * picks columns (`LR`, the default) or rows (`TB`). Schema groups — explicit
 * `groups`, or entities sharing a `schema` — are horizontal bands drawn as
 * `paper-2` panels with the name as an eyebrow tab; bands never overlap, so
 * a panel encloses its members and nothing else. Top-level `enums` are small
 * cards in a side column.
 *
 * Relations are routed at the FIELD level — from the foreign-key row to the
 * primary-key row — as orthogonal paths through the gutter between columns
 * (one slot per relation, so parallel routes never merge); a relation that
 * spans several columns rides a channel above the diagram. `1` / `N` /
 * `0..1` letters sit at each end, identifying relations are solid,
 * non-identifying dashed, labels ride a paper mask.
 *
 * Skin (`DESIGN.md`): an entity is a paper card with an ink outline, an
 * eyebrow (`ENTITY` / `JOIN` / `VIEW` / `ENUM` / `EXT` / `AGGREGATE ROOT`)
 * over the name, and mono rows with key markers — `#` primary key, `→`
 * foreign key (its target after the type when `ref` is set), `U` unique,
 * `?` nullable, `⌘` indexed — the default after the type, enum values as a
 * soft sub-row. The entity on the "one" side of the most relations is the
 * aggregate root and takes the accent. Nothing is truncated: cards grow.
 *
 * Fit: with `dir` unset, a left-to-right drawing wider than the page column
 * switches to top-to-bottom when that is narrower, so eight tables read at
 * full size instead of a scrolling strip. Relations that leave or reach the
 * same row of one card fan out a few pixels apart (one shared letter when
 * their cardinality matches), and every relation label is placed on its own
 * route by the shared label placement — off the cards, off the cardinality
 * letters, off the other labels and lines.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { placeOnRoutes } from '../svg/edgeSteps.js';
import { svgWidth } from './frame.js';
import { wrapAll } from './wrapAll.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type ErdData = BlockDataMap['erd'];
type ErdEntity = NonNullable<ErdData['entities']>[number];
type ErdColumn = NonNullable<ErdEntity['columns']>[number];
type ErdRelation = NonNullable<ErdData['relations']>[number];

const ROW_H = 20;
const HEAD_H = 40;
const BOT_PAD = 6;
const PAD_X = 12;
/** Approximate advance of one 10px mono glyph / one 13px Inter 600 glyph. */
const CH = 6.2;
const NAME_CH = 7.4;
const MIN_W = 150;
/** Gap between stacked cards, minimum gutter between columns, slot pitch inside a gutter. */
const GAP = 28;
const GUTTER_MIN = 64;
const SLOT = 14;
const PANEL_PAD = 14;
const PANEL_TAB = 18;
const MARGIN = 18;
const MARKER_W = 7;

/** Key markers, in the order they are drawn: pk, fk, unique, nullable, indexed. */
type Marker = '#' | '→' | 'U' | '?' | '⌘';

interface Row {
  /** `col` is a column row; `sub` a soft continuation (enum values, wrapped). */
  readonly kind: 'col' | 'sub';
  readonly col?: ErdColumn;
  readonly colIdx: number;
  readonly markers: readonly Marker[];
  readonly left: string;
  readonly right: string;
  readonly note?: string;
}

interface Box {
  readonly name: string;
  readonly idx: number; // index in data.entities (for data paths)
  readonly entity: ErdEntity;
  readonly cols: readonly ErdColumn[];
  readonly rows: readonly Row[];
  readonly headLines: readonly string[]; // wrapped entity note
  readonly headH: number;
  readonly pkIdx: number;
  readonly join: boolean;
  readonly kind: 'table' | 'view' | 'enum' | 'external';
  readonly w: number;
  readonly h: number;
}

interface EnumCard {
  readonly idx: number;
  readonly name: string;
  readonly values: readonly string[];
  readonly w: number;
  readonly h: number;
}

/** A relation with both ends resolved. */
interface Rel {
  readonly r: ErdRelation;
  readonly idx: number;
  readonly from: Box;
  readonly to: Box;
  readonly fromMany: boolean;
  readonly toMany: boolean;
  readonly toOptional: boolean;
  readonly dashed: boolean;
}

interface Node {
  readonly box: Box;
  band: number;
  layer: number;
  order: number; // stable input order
  u: number; // along the layer axis (LR: x)
  v: number; // along the stacking axis (LR: y)
  readonly du: number;
  readonly dv: number;
}

/** The page column: an auto-direction ERD wider than this tries top-to-bottom. */
const ERD_FIT_W = 1100;
/** Spacing of relation ends that share one anchor: along a row (LR), along a card edge (TB). */
const FAN_LR = 6;
const FAN_TB = 22;

export function renderErd(data: BlockDataMap['erd']): string {
  const lrHtml = layoutErd(data);
  if (data.dir !== undefined) return lrHtml;
  const wLR = svgWidth(lrHtml);
  if (wLR <= ERD_FIT_W) return lrHtml;
  const tbHtml = layoutErd({ ...data, dir: 'TB' });
  return svgWidth(tbHtml) < wLR ? tbHtml : lrHtml;
}

function layoutErd(data: BlockDataMap['erd']): string {
  const ents = data.entities ?? [];
  const rels = data.relations ?? [];
  const groups = data.groups ?? [];
  const enums = data.enums ?? [];
  const lr = data.dir !== 'TB';

  // ── Cards ──────────────────────────────────────────────────────────────
  const boxes: Box[] = ents.map((e, idx) => buildBox(e, idx));
  const byName = new Map<string, Box>();
  for (const b of boxes) {
    byName.set(b.name, b);
    if (b.entity.schema !== undefined) byName.set(`${b.entity.schema}.${b.name}`, b);
  }

  const valid: Rel[] = [];
  rels.forEach((r, idx) => {
    const from = byName.get(r.from);
    const to = byName.get(r.to);
    if (from === undefined || to === undefined) return;
    const card = parseCard(r.card);
    valid.push({ r, idx, from, to, ...card, dashed: r.identifying === false });
  });

  // The aggregate root: the entity on the "one" side of the most relations.
  // A tie means no root — zero accent is a valid outcome.
  const ones = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const x of valid) {
    if (!x.toMany) ones.set(x.to.name, (ones.get(x.to.name) ?? 0) + 1);
    if (!x.fromMany) ones.set(x.from.name, (ones.get(x.from.name) ?? 0) + 1);
    degree.set(x.from.name, (degree.get(x.from.name) ?? 0) + 1);
    if (x.to !== x.from) degree.set(x.to.name, (degree.get(x.to.name) ?? 0) + 1);
  }
  let rootName: string | undefined;
  let best = 0;
  let tied = false;
  for (const [name, n] of ones) {
    if (n > best) {
      best = n;
      rootName = name;
      tied = false;
    } else if (n === best) tied = true;
  }
  if (tied) rootName = undefined;

  // ── Bands (schema groups) ──────────────────────────────────────────────
  const bandNames: string[] = [];
  const bandOf = new Map<string, number>();
  const bandIsPanel: boolean[] = [];
  for (const g of groups) {
    const members = (g.entities ?? []).filter((n) => byName.has(n) && !bandOf.has(byName.get(n)?.name ?? n));
    if (members.length === 0) continue;
    const bi = bandNames.length;
    bandNames.push(g.name);
    bandIsPanel.push(true);
    for (const n of members) bandOf.set(byName.get(n)?.name ?? n, bi);
  }
  for (const b of boxes) {
    if (bandOf.has(b.name) || b.entity.schema === undefined) continue;
    let bi = bandNames.indexOf(b.entity.schema);
    if (bi === -1 || !bandIsPanel[bi]) {
      bi = bandNames.length;
      bandNames.push(b.entity.schema);
      bandIsPanel.push(true);
    }
    bandOf.set(b.name, bi);
  }
  const loose = boxes.filter((b) => !bandOf.has(b.name));
  if (loose.length > 0) {
    const bi = bandNames.length;
    bandNames.push('');
    bandIsPanel.push(false);
    for (const b of loose) bandOf.set(b.name, bi);
  }

  // ── Layers ─────────────────────────────────────────────────────────────
  const nodes: Node[] = boxes.map((box, order) => ({
    box,
    band: bandOf.get(box.name) ?? 0,
    layer: 0,
    order,
    u: 0,
    v: 0,
    du: lr ? box.w : box.h,
    dv: lr ? box.h : box.w,
  }));
  const nodeOf = new Map(nodes.map((n) => [n.box.name, n]));
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.box.name, new Set());
  for (const x of valid) {
    if (x.from === x.to) continue;
    adj.get(x.from.name)?.add(x.to.name);
    adj.get(x.to.name)?.add(x.from.name);
  }
  assignLayers(nodes, adj, degree, rootName, nodeOf);

  const layers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const minL = layers[0] ?? 0;
  const maxL = layers[layers.length - 1] ?? 0;

  // ── Gutter slots (which gutter each relation runs in) ──────────────────
  interface Route {
    readonly rel: Rel;
    readonly src: Node;
    readonly dst: Node;
    readonly g1: number; // gutter after column g1 (index = layer)
    readonly g2: number; // for long routes: the gutter before the target column
    readonly long: boolean;
    readonly self: boolean;
    slot1: number;
    slot2: number;
    channel: number;
  }
  const routes: Route[] = [];
  const gutterEdges = new Map<number, Route[]>();
  const push = (g: number, rt: Route): void => {
    const list = gutterEdges.get(g) ?? [];
    list.push(rt);
    gutterEdges.set(g, list);
  };
  let channels = 0;
  for (const rel of valid) {
    const src = nodeOf.get(rel.from.name);
    const dst = nodeOf.get(rel.to.name);
    if (src === undefined || dst === undefined) continue;
    const self = src === dst;
    const a = src.layer;
    const b = dst.layer;
    let g1: number;
    let g2: number;
    let long = false;
    if (self) {
      g1 = g2 = a;
    } else if (a < b) {
      g1 = a;
      g2 = b - 1;
      long = b - a > 1;
    } else if (a > b) {
      g1 = a - 1;
      g2 = b;
      long = a - b > 1;
    } else {
      g1 = g2 = a;
    }
    const rt: Route = { rel, src, dst, g1, g2, long, self, slot1: 0, slot2: 0, channel: long ? channels++ : -1 };
    routes.push(rt);
    if (!self) {
      push(g1, rt);
      if (long) push(g2, rt);
    }
  }
  const gutterW = new Map<number, number>();
  for (let l = minL; l <= maxL; l++) {
    const list = gutterEdges.get(l) ?? [];
    const n = list.length;
    // A busy left-to-right gutter (three or more labelled relations) widens
    // so a label fits on a horizontal run of its own route.
    const labelled = list.filter((rt) => (rt.rel.r.label ?? '') !== '');
    const room =
      lr && labelled.length > 2
        ? Math.max(...labelled.map((rt) => Math.round((rt.rel.r.label ?? '').length * CH + 8))) + 2 * SLOT + 18
        : 0;
    gutterW.set(l, Math.max(l === maxL ? (n > 0 ? (n + 1) * SLOT : 0) : GUTTER_MIN, (n + 1) * SLOT, room));
  }
  const topOffset = channels > 0 ? channels * SLOT + 8 : 0;

  // ── Place (bands × layers), refining the in-column order by barycentre ──
  const colU = new Map<number, number>();
  const colW = new Map<number, number>();
  const bandExtent: { top: number; bottom: number; minL: number; maxL: number }[] = [];
  const place = (): void => {
    let u = MARGIN;
    for (let l = minL; l <= maxL; l++) {
      const w = Math.max(0, ...nodes.filter((n) => n.layer === l).map((n) => n.du));
      colU.set(l, u);
      colW.set(l, w);
      u += w + (gutterW.get(l) ?? GUTTER_MIN);
    }
    let cursor = MARGIN + topOffset;
    bandExtent.length = 0;
    let prevPanel = false;
    bandNames.forEach((_, bi) => {
      const members = nodes.filter((n) => n.band === bi);
      const panel = bandIsPanel[bi] === true;
      if (members.length === 0) {
        bandExtent.push({ top: cursor, bottom: cursor, minL: 0, maxL: 0 });
        return;
      }
      const top = cursor + (bi > 0 ? (prevPanel ? PANEL_PAD : 0) + GAP : 0) + (panel ? PANEL_PAD + PANEL_TAB : 0);
      let bandH = 0;
      const stacks = new Map<number, Node[]>();
      for (const n of members) {
        const s = stacks.get(n.layer) ?? [];
        s.push(n);
        stacks.set(n.layer, s);
      }
      for (const s of stacks.values()) {
        s.sort((p, q) => p.order - q.order);
        bandH = Math.max(bandH, s.reduce((acc, n) => acc + n.dv, 0) + GAP * (s.length - 1));
      }
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const [l, s] of stacks) {
        const stackH = s.reduce((acc, n) => acc + n.dv, 0) + GAP * (s.length - 1);
        let v = top + (bandH - stackH) / 2;
        for (const n of s) {
          n.u = (colU.get(l) ?? 0) + ((colW.get(l) ?? n.du) - n.du) / 2;
          n.v = v;
          v += n.dv + GAP;
        }
        bMin = Math.min(bMin, l);
        bMax = Math.max(bMax, l);
      }
      bandExtent.push({ top, bottom: top + bandH, minL: bMin, maxL: bMax });
      cursor = top + bandH;
      prevPanel = panel;
    });
  };
  // Barycentre sweeps: outward from the root column, then inward, then out.
  place();
  const byAbs = [...layers].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  const sweep = (order: readonly number[], inner: (l: number) => number): void => {
    for (const l of order) {
      const ref = inner(l);
      for (const n of nodes) {
        if (n.layer !== l) continue;
        const nb = [...(adj.get(n.box.name) ?? [])].map((m) => nodeOf.get(m)).filter((m): m is Node => m !== undefined && m.layer === ref);
        if (nb.length === 0) continue;
        n.order = nb.reduce((acc, m) => acc + m.v + m.dv / 2, 0) / nb.length;
      }
    }
    place();
  };
  sweep(byAbs, (l) => (l > 0 ? l - 1 : l < 0 ? l + 1 : l));
  sweep([...byAbs].reverse(), (l) => (l >= 0 ? l + 1 : l - 1));
  sweep(byAbs, (l) => (l > 0 ? l - 1 : l < 0 ? l + 1 : l));

  // Slot order inside each gutter: by the mid position of the run, so
  // parallel routes nest instead of crossing.
  for (const [g, list] of gutterEdges) {
    const start = (colU.get(g) ?? 0) + (colW.get(g) ?? 0);
    const width = gutterW.get(g) ?? GUTTER_MIN;
    list.sort((p, q) => midV(p.src, p.dst) - midV(q.src, q.dst));
    list.forEach((rt, i) => {
      const su = start + ((i + 1) * width) / (list.length + 1);
      if (rt.g1 === g && rt.slot1 === 0) rt.slot1 = su;
      if (rt.long && rt.g2 === g) rt.slot2 = su;
      if (!rt.long) rt.slot2 = rt.slot1;
    });
  }

  // ── Coordinates ────────────────────────────────────────────────────────
  const X = (u: number, v: number): number => (lr ? u : v);
  const Y = (u: number, v: number): number => (lr ? v : u);
  /** Orthogonal path through (u, v) points, mapped to x / y. */
  const path = (pts: readonly (readonly [number, number])[]): string =>
    pts.map(([u, v], i) => `${i === 0 ? 'M' : 'L'}${rd(X(u, v))},${rd(Y(u, v))}`).join(' ');
  let maxX = 0;
  let maxY = 0;
  const grow = (x: number, y: number): void => {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const n of nodes) grow(X(n.u + n.du, n.v + n.dv), Y(n.u + n.du, n.v + n.dv));

  let s = '';

  // Panels (drawn first, under everything).
  let hasPanel = false;
  s += `<g${bl('groups')}>`;
  bandNames.forEach((name, bi) => {
    if (bandIsPanel[bi] !== true) return;
    const ext = bandExtent[bi];
    if (ext === undefined || ext.top === ext.bottom) return;
    hasPanel = true;
    const u0 = (colU.get(ext.minL) ?? 0) - PANEL_PAD;
    const u1 = (colU.get(ext.maxL) ?? 0) + (colW.get(ext.maxL) ?? 0) + PANEL_PAD;
    const v0 = ext.top - PANEL_PAD - PANEL_TAB;
    const v1 = ext.bottom + PANEL_PAD;
    const x = X(u0, v0);
    const y = Y(u0, v0);
    const w = X(u1, v1) - x;
    const h = Y(u1, v1) - y;
    grow(x + w, y + h);
    const gi = groups.findIndex((g) => g.name === name);
    s +=
      `<g${gi >= 0 ? bp(`groups.${gi}`) : ''}>` +
      `<rect x="${rd(x)}" y="${rd(y)}" width="${rd(w)}" height="${rd(h)}" rx="8" class="er-panel"/>` +
      `<text x="${rd(x + 12)}" y="${rd(y + 13)}" class="t-eyebrow er-panel-tab">${escapeHtml(name.toUpperCase())}</text>` +
      `</g>`;
  });
  s += `</g>`;

  const labels: string[] = [];
  // Relations (under the cards). First every route's two ends: which card
  // side and row each end anchors on.
  interface Plan {
    readonly rt: Route;
    vA: number;
    vB: number;
    readonly exitU: number;
    readonly enterU: number;
    readonly exitDir: number; // +1 = leaves src toward higher u
    readonly enterOut: number; // the outward direction of the dst end (for its letter)
  }
  const plans: Plan[] = routes.map((rt) => {
    const { rel, src, dst } = rt;
    // Which end holds the foreign key decides the row each end anchors on.
    const fkInFrom = rel.fromMany && !rel.toMany ? true : !rel.fromMany && rel.toMany ? false : holdsFk(rel.from, rel.to, rel.r.fromCol) || !holdsFk(rel.to, rel.from, rel.r.toCol);
    const nm = rel.fromMany && rel.toMany;
    const vA = nm ? src.v + src.dv / 2 : anchorV(src, lr, fkInFrom ? fkRow(rel.from, rel.to, rel.r.fromCol) : pkRow(rel.from, rel.r.fromCol));
    const vB = nm ? dst.v + dst.dv / 2 : anchorV(dst, lr, !fkInFrom ? fkRow(rel.to, rel.from, rel.r.toCol) : pkRow(rel.to, rel.r.toCol));
    if (rt.self || src.layer === dst.layer) {
      return { rt, vA, vB, exitU: src.u + src.du, enterU: dst.u + dst.du, exitDir: 1, enterOut: 1 };
    }
    const fwd = src.layer < dst.layer;
    return {
      rt,
      vA,
      vB,
      exitU: fwd ? src.u + src.du : src.u,
      enterU: fwd ? dst.u : dst.u + dst.du,
      exitDir: fwd ? 1 : -1,
      enterOut: fwd ? -1 : 1,
    };
  });
  // Ends that share one anchor (same card, same side, same row) fan out, in
  // the order of where their other ends lie, so they never draw as one line.
  interface EndRef {
    readonly plan: Plan;
    readonly which: 'A' | 'B';
  }
  const shared = new Map<string, EndRef[]>();
  for (const plan of plans) {
    for (const which of ['A', 'B'] as const) {
      if (plan.rt.self && which === 'B') continue;
      const node = which === 'A' ? plan.rt.src : plan.rt.dst;
      const u = which === 'A' ? plan.exitU : plan.enterU;
      const v = which === 'A' ? plan.vA : plan.vB;
      const key = `${node.box.name}|${rd(u)}|${rd(v)}`;
      const list = shared.get(key) ?? [];
      list.push({ plan, which });
      shared.set(key, list);
    }
  }
  const fan = lr ? FAN_LR : FAN_TB;
  /** Ends drawn as one letter: a fanned group whose letters all match. */
  const letterGroups: Array<{ ends: EndRef[]; text: string }> = [];
  const letterOf = (e: EndRef): string =>
    e.which === 'A' ? letterFor(e.plan.rt.rel.fromMany, false) : letterFor(e.plan.rt.rel.toMany, e.plan.rt.rel.toOptional);
  for (const list of shared.values()) {
    if (list.length < 2) continue;
    const other = (e: EndRef): number => (e.which === 'A' ? e.plan.vB : e.plan.vA);
    list.sort((p, q) => other(p) - other(q));
    const base = list[0]?.which === 'A' ? list[0].plan.vA : (list[0]?.plan.vB ?? 0);
    list.forEach((e, i) => {
      const v = base + (i - (list.length - 1) / 2) * fan;
      if (e.which === 'A') e.plan.vA = v;
      else e.plan.vB = v;
    });
    const texts = new Set(list.map(letterOf));
    if (texts.size === 1) letterGroups.push({ ends: list, text: letterOf(list[0] as EndRef) });
  }
  const grouped = new Map<string, { first: boolean; text: string }>();
  for (const g of letterGroups) {
    g.ends.forEach((e, i) => grouped.set(`${e.plan.rt.rel.idx}|${e.which}`, { first: i === 0, text: g.text }));
  }

  const routePts: Array<Array<{ x: number; y: number }>> = [];
  const labelItems: Array<{ idx: number; points: Array<{ x: number; y: number }>; lx: number; ly: number; text: string; w: number }> = [];
  const letterBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  let hasCard = false;
  let hasDashed = false;
  s += `<g${bl('relations')}>`;
  for (const plan of plans) {
    const { rt, vA, vB, exitU, enterU, exitDir } = plan;
    const { rel, src, dst } = rt;
    hasCard = true;
    if (rel.dashed) hasDashed = true;
    const a = src.layer;
    const b = dst.layer;
    let pts: Array<readonly [number, number]>;
    let labelAt: [number, number];
    if (rt.self) {
      const right = src.u + src.du;
      const vb = Math.abs(vB - vA) < 1 ? vA + ROW_H : vB;
      const su = right + SLOT;
      pts = [
        [right, vA],
        [su, vA],
        [su, vb],
        [right, vb],
      ];
      labelAt = [su + 8, Math.max(vA, vb) + 12];
    } else if (a === b) {
      const right = Math.max(src.u + src.du, dst.u + dst.du);
      const su = rt.slot1 > 0 ? rt.slot1 : right + SLOT;
      pts = [
        [exitU, vA],
        [su, vA],
        [su, vB],
        [enterU, vB],
      ];
      labelAt = [su, (vA + vB) / 2];
    } else if (!rt.long) {
      pts = [
        [exitU, vA],
        [rt.slot1, vA],
        [rt.slot1, vB],
        [enterU, vB],
      ];
      labelAt = [rt.slot1, (vA + vB) / 2];
    } else {
      const ch = MARGIN + rt.channel * SLOT + 4;
      pts = [
        [exitU, vA],
        [rt.slot1, vA],
        [rt.slot1, ch],
        [rt.slot2, ch],
        [rt.slot2, vB],
        [enterU, vB],
      ];
      labelAt = [(rt.slot1 + rt.slot2) / 2, ch];
    }
    const d = path(pts);
    const xy = pts.map(([u, v]) => ({ x: rd(X(u, v)), y: rd(Y(u, v)) }));
    routePts.push(xy);
    const dash = rel.dashed ? ' stroke-dasharray="5 4"' : '';
    // A fanned group whose letters match draws its letter once.
    const letter = (which: 'A' | 'B', u: number, v: number, outward: number, text: string): string => {
      const g = grouped.get(`${rel.idx}|${which}`);
      if (g !== undefined && !g.first) return '';
      letterBoxes.push(letterBox(u, v, outward, text, lr, X, Y));
      return cardLetter(u, v, outward, text, lr, X, Y);
    };
    // The whole routed connector is one editable part (`relations.N`).
    s +=
      `<g${bp(`relations.${rel.idx}`)}>` +
      `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.25"${dash}/>` +
      letter('A', exitU, vA, rt.self ? 1 : exitDir, letterFor(rel.fromMany, false)) +
      letter('B', enterU, vB, plan.enterOut, letterFor(rel.toMany, rel.toOptional)) +
      `</g>`;
    if (rel.r.label !== undefined && rel.r.label !== '') {
      const text = rel.r.label.toUpperCase();
      labelItems.push({
        idx: rel.idx,
        points: xy,
        lx: X(labelAt[0], labelAt[1]),
        ly: Y(labelAt[0], labelAt[1]),
        text,
        w: Math.round(text.length * CH + 8),
      });
    }
  }
  s += `</g>`;

  // Relation labels: each on its own route, at the clearest straight run —
  // off every card, every cardinality letter, every other label and line.
  const cardBoxes = nodes.map((n) => ({ x: X(n.u, n.v), y: Y(n.u, n.v), w: n.box.w, h: n.box.h }));
  const boxItems = labelItems.map((it) => ({ points: it.points, lx: it.lx, ly: it.ly, sizes: [{ w: it.w, h: 14 }] }));
  const spots = placeOnRoutes(boxItems, [...cardBoxes, ...letterBoxes], { routes: routePts });
  // A label with no clear spot tries again, allowed to touch a letter (never
  // a card or another label); only then does it keep its route's middle.
  const placed = spots.flatMap((sp) => (sp !== undefined ? [sp.box] : []));
  const retry = placeOnRoutes(
    boxItems.map((it, k) => (spots[k] === undefined ? it : undefined)),
    [...cardBoxes, ...placed],
    { routes: routePts },
  );
  retry.forEach((sp, k) => {
    if (sp !== undefined && spots[k] === undefined) spots[k] = sp;
  });
  labelItems.forEach((it, k) => {
    const sp = spots[k];
    const cx = sp?.lx ?? it.lx;
    const cy = sp?.ly ?? it.ly;
    labels.push(
      // The label twins with its route (same data path, as on every grid diagram).
      `<g${bp(`relations.${it.idx}`)}>` +
        `<rect x="${rd(cx - it.w / 2)}" y="${rd(cy - 7)}" width="${it.w}" height="14" fill="var(--paper)"/>` +
        `<text x="${rd(cx)}" y="${rd(cy + 3.5)}" class="t-arrow er-rel" text-anchor="middle">${escapeHtml(it.text)}</text>` +
        `</g>`,
    );
    grow(cx + it.w / 2, cy + 7);
  });

  // Entity cards.
  const used = new Set<Marker>();
  let hasJoin = false;
  const kinds = new Set<Box['kind']>();
  s += `<g${bl('entities')}>`;
  for (const n of nodes) {
    const b = n.box;
    const x = X(n.u, n.v);
    const y = Y(n.u, n.v);
    const root = b.name === rootName;
    const eyebrow = root ? 'AGGREGATE ROOT' : b.kind === 'view' ? 'VIEW' : b.kind === 'enum' ? 'ENUM' : b.kind === 'external' ? 'EXT' : b.join ? 'JOIN' : 'ENTITY';
    if (b.join && !root && b.kind === 'table') hasJoin = true;
    if (b.kind !== 'table') kinds.add(b.kind);
    const secondary = b.kind === 'view' || b.kind === 'enum';
    const stroke = root ? 'var(--accent)' : secondary ? 'var(--rule-solid)' : 'var(--ink)';
    const fill = root ? 'var(--accent-tint)' : b.kind === 'view' ? 'var(--paper-2)' : 'var(--paper)';
    const sw = secondary ? 1 : 1.5;
    const dash = b.kind === 'external' ? ' stroke-dasharray="4 3"' : '';
    s +=
      `<g${bp(`entities.${b.idx}`)}>` +
      `<rect x="${rd(x)}" y="${rd(y)}" width="${b.w}" height="${b.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>` +
      `<text x="${rd(x + PAD_X)}" y="${rd(y + 15)}" class="er-eyebrow t-eyebrow${root ? ' c-accent' : ''}">${eyebrow}</text>` +
      `<text x="${rd(x + PAD_X)}" y="${rd(y + 31)}" class="er-head-text t-name">${escapeHtml(b.name)}</text>`;
    b.headLines.forEach((line, i) => {
      s += `<text x="${rd(x + PAD_X)}" y="${rd(y + 44 + i * 13)}" class="er-col dim t-sub c-soft">${escapeHtml(line)}</text>`;
    });
    if (b.rows.length > 0 || b.headLines.length > 0) {
      s += `<line x1="${rd(x)}" y1="${rd(y + b.headH)}" x2="${rd(x + b.w)}" y2="${rd(y + b.headH)}" class="er-headline"/>`;
    }
    s += `<g${bl(`entities.${b.idx}.columns`)}>`;
    let open = -1;
    b.rows.forEach((row, j) => {
      const rowTop = y + b.headH + j * ROW_H;
      const ty = rowTop + 14;
      if (row.kind === 'col') {
        if (open >= 0) s += `</g>`;
        open = row.colIdx;
        s += `<g${bp(`entities.${b.idx}.columns.${row.colIdx}`)}>`;
        if (row.note !== undefined) s += `<title>${escapeHtml(row.note)}</title>`;
        if (j > 0) s += `<line x1="${rd(x + 1)}" y1="${rd(rowTop)}" x2="${rd(x + b.w - 1)}" y2="${rd(rowTop)}" class="er-rowline"${DECORATIVE}/>`;
        row.markers.forEach((m, k) => {
          used.add(m);
          s += `<text x="${rd(x + PAD_X + k * MARKER_W)}" y="${rd(ty)}" class="er-key ${markerClass(m)} t-sub c-muted">${escapeHtml(m)}</text>`;
        });
        s +=
          `<text x="${rd(x + PAD_X + markerPad(b))}" y="${rd(ty)}" class="er-col t-sub c-ink">${escapeHtml(row.left)}</text>` +
          (row.right.length > 0 ? `<text x="${rd(x + b.w - PAD_X)}" y="${rd(ty)}" class="er-col dim t-sub c-soft" text-anchor="end">${escapeHtml(row.right)}</text>` : '');
      } else {
        s += `<text x="${rd(x + PAD_X + markerPad(b))}" y="${rd(ty)}" class="er-col dim t-sub c-soft">${escapeHtml(row.left)}</text>`;
      }
    });
    if (open >= 0) s += `</g>`;
    s += `</g></g>`;
  }
  s += `</g>`;

  // Enum cards in a side column.
  const cards: EnumCard[] = enums.map((e, idx) => buildEnumCard(e.name, e.values, idx));
  if (cards.length > 0) {
    const cx = maxX + GUTTER_MIN;
    let cy = MARGIN + topOffset;
    s += `<g${bl('enums')}>`;
    for (const c of cards) {
      s +=
        `<g${bp(`enums.${c.idx}`)}>` +
        `<rect x="${rd(cx)}" y="${rd(cy)}" width="${c.w}" height="${c.h}" rx="6" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
        `<text x="${rd(cx + PAD_X)}" y="${rd(cy + 15)}" class="er-eyebrow t-eyebrow">ENUM</text>` +
        `<text x="${rd(cx + PAD_X)}" y="${rd(cy + 31)}" class="er-head-text t-name">${escapeHtml(c.name)}</text>` +
        `<line x1="${rd(cx)}" y1="${rd(cy + HEAD_H)}" x2="${rd(cx + c.w)}" y2="${rd(cy + HEAD_H)}" class="er-headline"/>`;
      c.values.forEach((v, j) => {
        const rowTop = cy + HEAD_H + j * ROW_H;
        if (j > 0) s += `<line x1="${rd(cx + 1)}" y1="${rd(rowTop)}" x2="${rd(cx + c.w - 1)}" y2="${rd(rowTop)}" class="er-rowline"${DECORATIVE}/>`;
        s += `<text x="${rd(cx + PAD_X)}" y="${rd(rowTop + 14)}" class="er-col t-sub c-ink">${escapeHtml(v)}</text>`;
      });
      s += `</g>`;
      grow(cx + c.w, cy + c.h);
      cy += c.h + GAP;
    }
    s += `</g>`;
  }

  s += labels.join(''); // relation labels on top of cards + lines

  const W = Math.ceil(maxX + MARGIN);
  const H = Math.ceil(maxY + MARGIN);
  const a11y = svgName('Entity relationship diagram', data.title, [
    countPhrase(ents.length, 'entity', 'entities'),
  ]);
  const svg = `<svg viewBox="0 0 ${W} ${H}"${a11y.attrs}>` + a11y.title + s + `</svg>`;

  const items: LegendItem[] = [];
  if (used.has('#')) items.push({ swatch: 'chip', chip: '#', label: 'primary key' });
  if (used.has('→')) items.push({ swatch: 'chip', chip: '→', label: 'foreign key' });
  if (used.has('U')) items.push({ swatch: 'chip', chip: 'U', label: 'unique' });
  if (used.has('?')) items.push({ swatch: 'chip', chip: '?', label: 'nullable' });
  if (used.has('⌘')) items.push({ swatch: 'chip', chip: '⌘', label: 'indexed' });
  if (hasCard) items.push({ swatch: 'chip', chip: '1 / N', label: 'cardinality' });
  if (hasDashed) {
    items.push({ swatch: 'line', label: 'identifying' });
    items.push({ swatch: 'line-dashed', label: 'non-identifying' });
  }
  if (hasJoin) items.push({ swatch: 'chip', chip: 'JOIN', label: 'join table' });
  if (kinds.has('view')) items.push({ swatch: 'node-fill2', label: 'view' });
  if (kinds.has('enum') || cards.length > 0) items.push({ swatch: 'chip', chip: 'ENUM', label: 'enum' });
  if (kinds.has('external')) items.push({ swatch: 'node-dashed', label: 'external' });
  if (hasPanel) items.push({ swatch: 'node-fill2', label: 'schema group' });
  if (rootName !== undefined) items.push({ swatch: 'node-accent', label: 'aggregate root' });
  const legend = renderLegend(items);

  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: 'ER',
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(legend.length > 0 ? { legendHtml: legend } : {}),
  };
  return diagramFrame(opts, svg);
}

// ── Cards ────────────────────────────────────────────────────────────────

function buildBox(e: ErdEntity, idx: number): Box {
  const cols = e.columns ?? [];
  const kind = e.kind ?? 'table';
  const maxMarkers = Math.max(0, ...cols.map((c) => markersOf(c).length));
  const markerPadW = maxMarkers > 0 ? maxMarkers * MARKER_W + 6 : 0;
  // Width from the widest content: name, or marker + name + gap + type cluster.
  let w = Math.max(MIN_W, e.name.length * NAME_CH + PAD_X * 2 + 24);
  const rights = cols.map((c) => rightText(c));
  cols.forEach((c, i) => {
    w = Math.max(w, PAD_X * 2 + markerPadW + c.name.length * CH + 16 + (rights[i]?.length ?? 0) * CH);
  });
  const inner = w - PAD_X * 2 - markerPadW;
  const rows: Row[] = [];
  cols.forEach((c, i) => {
    rows.push({
      kind: 'col',
      col: c,
      colIdx: i,
      markers: markersOf(c),
      left: c.name,
      right: rights[i] ?? '',
      ...(c.note !== undefined && c.note.length > 0 ? { note: c.note } : {}),
    });
    if (c.enum !== undefined && c.enum.length > 0) {
      for (const line of wrap(c.enum.join(' · '), Math.max(24, Math.floor(inner / CH)))) {
        rows.push({ kind: 'sub', colIdx: i, markers: [], left: line, right: '' });
      }
    }
  });
  const headLines = e.note !== undefined && e.note.length > 0 ? wrap(e.note, Math.max(24, Math.floor((w - PAD_X * 2) / CH))) : [];
  const headH = HEAD_H + (headLines.length > 0 ? headLines.length * 13 + 2 : 0);
  return {
    name: e.name,
    idx,
    entity: e,
    cols,
    rows,
    headLines,
    headH,
    pkIdx: cols.findIndex((c) => c.pk === true),
    join: cols.length > 0 && cols.every((c) => c.fk === true),
    kind,
    w: Math.round(w),
    h: headH + rows.length * ROW_H + (rows.length > 0 ? BOT_PAD : 0),
  };
}

function buildEnumCard(name: string, values: readonly string[], idx: number): EnumCard {
  const w = Math.round(Math.max(120, name.length * NAME_CH + PAD_X * 2 + 12, ...values.map((v) => v.length * CH + PAD_X * 2)));
  return { idx, name, values, w, h: HEAD_H + values.length * ROW_H + (values.length > 0 ? BOT_PAD : 0) };
}

function markersOf(c: ErdColumn): Marker[] {
  const out: Marker[] = [];
  if (c.pk === true) out.push('#');
  if (c.fk === true) out.push('→');
  if (c.unique === true) out.push('U');
  if (c.nullable === true) out.push('?');
  if (c.index === true) out.push('⌘');
  return out;
}

function markerClass(m: Marker): string {
  return m === '#' ? 'pk' : m === '→' ? 'fk' : m === 'U' ? 'uk' : m === '?' ? 'nul' : 'ix';
}

function markerPad(b: Box): number {
  const n = Math.max(0, ...b.cols.map((c) => markersOf(c).length));
  return n > 0 ? n * MARKER_W + 6 : 0;
}

/** The right-aligned cluster of a row: `type`, then `→ ref`, then `= default`. */
function rightText(c: ErdColumn): string {
  const parts: string[] = [];
  if (c.type !== undefined && c.type.length > 0) parts.push(c.type);
  if (c.ref !== undefined && c.ref.length > 0) parts.push(`→ ${c.ref}`);
  if (c.default !== undefined && c.default.length > 0) parts.push(`= ${c.default}`);
  return parts.join('  ');
}

/**
 * Word wrap to `max` characters that never drops text: a word longer than a
 * line breaks at its identifier joints (see `wrapAll`).
 */
function wrap(text: string, max: number): string[] {
  return wrapAll(text, max);
}

// ── Layers ───────────────────────────────────────────────────────────────

/**
 * Assigns each node a layer: BFS depth from the component's root, signed by
 * side. Depth-1 clusters (connected components of the graph minus the root)
 * go wholly left or right, largest first to the lighter side; nodes with no
 * relations spread across the existing layers (a grid when nothing relates).
 */
function assignLayers(
  nodes: Node[],
  adj: ReadonlyMap<string, ReadonlySet<string>>,
  degree: ReadonlyMap<string, number>,
  rootName: string | undefined,
  nodeOf: ReadonlyMap<string, Node>,
): void {
  const seen = new Set<string>();
  const components: Node[][] = [];
  for (const n of nodes) {
    if (seen.has(n.box.name) || (adj.get(n.box.name)?.size ?? 0) === 0) continue;
    const comp: Node[] = [];
    const queue = [n];
    seen.add(n.box.name);
    while (queue.length > 0) {
      const cur = queue.shift() as Node;
      comp.push(cur);
      for (const m of adj.get(cur.box.name) ?? []) {
        if (seen.has(m)) continue;
        seen.add(m);
        const mn = nodeOf.get(m);
        if (mn !== undefined) queue.push(mn);
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => {
    const ra = rootName !== undefined && a.some((n) => n.box.name === rootName) ? 1 : 0;
    const rb = rootName !== undefined && b.some((n) => n.box.name === rootName) ? 1 : 0;
    return rb - ra || b.length - a.length;
  });

  components.forEach((comp, ci) => {
    const root =
      comp.find((n) => n.box.name === rootName) ??
      comp.reduce((acc, n) => ((degree.get(n.box.name) ?? 0) > (degree.get(acc.box.name) ?? 0) ? n : acc), comp[0] as Node);
    // BFS depth.
    const depth = new Map<string, number>([[root.box.name, 0]]);
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift() as Node;
      const d = depth.get(cur.box.name) ?? 0;
      for (const m of adj.get(cur.box.name) ?? []) {
        if (depth.has(m)) continue;
        depth.set(m, d + 1);
        const mn = nodeOf.get(m);
        if (mn !== undefined) queue.push(mn);
      }
    }
    // Clusters of the graph minus the root.
    const clusterOf = new Map<string, number>();
    const clusters: string[][] = [];
    for (const n of comp) {
      if (n === root || clusterOf.has(n.box.name)) continue;
      const members: string[] = [];
      const q = [n.box.name];
      clusterOf.set(n.box.name, clusters.length);
      while (q.length > 0) {
        const cur = q.shift() as string;
        members.push(cur);
        for (const m of adj.get(cur) ?? []) {
          if (m === root.box.name || clusterOf.has(m)) continue;
          clusterOf.set(m, clusters.length);
          q.push(m);
        }
      }
      clusters.push(members);
    }
    // Side per cluster: only the root's component is centred; the rest go right.
    const side: number[] = clusters.map(() => 1);
    if (ci === 0 && clusters.length > 1) {
      const order = clusters.map((c, i) => ({ i, size: c.length })).sort((a, b) => b.size - a.size || a.i - b.i);
      let left = 0;
      let right = 0;
      for (const { i, size } of order) {
        if (right <= left) {
          side[i] = 1;
          right += size;
        } else {
          side[i] = -1;
          left += size;
        }
      }
    }
    for (const n of comp) {
      const d = depth.get(n.box.name) ?? 0;
      const c = clusterOf.get(n.box.name);
      n.layer = c === undefined ? 0 : (side[c] ?? 1) * d;
    }
  });

  // Nodes with no relations: spread across the existing layers, or a grid.
  const isolated = nodes.filter((n) => !seen.has(n.box.name));
  if (isolated.length === 0) return;
  const layers = [...new Set(nodes.filter((n) => seen.has(n.box.name)).map((n) => n.layer))].sort((a, b) => a - b);
  if (layers.length === 0) {
    isolated.forEach((n, i) => {
      n.layer = i % 4;
    });
    return;
  }
  isolated.forEach((n, i) => {
    n.layer = layers[i % layers.length] ?? 0;
  });
}

// ── Anchors ──────────────────────────────────────────────────────────────

/** True when `box` holds a column that references `other` (explicit `col`, a `ref`, or an FK named after it). */
function holdsFk(box: Box, other: Box, col: string | undefined): boolean {
  return fkRow(box, other, col) >= 0;
}

/** The visual row index of the FK column that references `other`, or -1. */
function fkRow(box: Box, other: Box, col: string | undefined): number {
  if (col !== undefined) {
    const i = box.cols.findIndex((c) => c.name === col);
    if (i >= 0) return rowIndex(box, i);
  }
  const target = other.name.toLowerCase();
  const singular = target.replace(/s$/, '');
  const fks = box.cols.map((c, i) => ({ c, i })).filter((x) => x.c.fk === true);
  const byRef = fks.find((x) => {
    const r = x.c.ref?.toLowerCase() ?? '';
    return r.startsWith(target + '.') || r === target || r.startsWith(other.name.toLowerCase());
  });
  if (byRef !== undefined) return rowIndex(box, byRef.i);
  const byName = fks.find((x) => {
    const n = x.c.name.toLowerCase();
    return n.includes(target) || n.includes(singular);
  });
  if (byName !== undefined) return rowIndex(box, byName.i);
  return -1;
}

/** The visual row index of the primary key (or the named column), or -1. */
function pkRow(box: Box, col: string | undefined): number {
  if (col !== undefined) {
    const i = box.cols.findIndex((c) => c.name === col);
    if (i >= 0) return rowIndex(box, i);
  }
  return box.pkIdx >= 0 ? rowIndex(box, box.pkIdx) : -1;
}

function rowIndex(box: Box, colIdx: number): number {
  return box.rows.findIndex((r) => r.kind === 'col' && r.colIdx === colIdx);
}

/** Stacking-axis anchor of a row: its centre in LR; the card centre in TB. */
function anchorV(n: Node, lr: boolean, row: number): number {
  if (!lr || row < 0) return n.v + n.dv / 2;
  return n.v + n.box.headH + row * ROW_H + ROW_H / 2;
}

function midV(a: Node, b: Node): number {
  return (a.v + a.dv / 2 + b.v + b.dv / 2) / 2;
}

// ── Cardinality ──────────────────────────────────────────────────────────

/**
 * Splits `card` into per-end multiplicity. `1:N` reads from → to; `0..1` /
 * `0..N` mean one `from` and an optional `to`. Absent → many → one (the
 * typical FK → PK shape).
 */
function parseCard(card: string | undefined): { fromMany: boolean; toMany: boolean; toOptional: boolean } {
  if (card === undefined) return { fromMany: true, toMany: false, toOptional: false };
  if (card === '0..1') return { fromMany: false, toMany: false, toOptional: true };
  if (card === '0..N') return { fromMany: false, toMany: true, toOptional: true };
  const parts = card.split(':');
  const many = (p: string | undefined): boolean => p !== undefined && p.trim().toUpperCase() !== '1';
  return { fromMany: many(parts[0]), toMany: many(parts[1]), toOptional: false };
}

function letterFor(many: boolean, optional: boolean): string {
  return optional ? (many ? '0..N' : '0..1') : many ? 'N' : '1';
}

/** The box a cardinality letter covers (see {@link cardLetter}), for label placement. */
function letterBox(
  u: number,
  v: number,
  outward: number,
  text: string,
  lr: boolean,
  X: (u: number, v: number) => number,
  Y: (u: number, v: number) => number,
): { x: number; y: number; w: number; h: number } {
  const w = text.length * 5.7 + 2;
  const uu = u + outward * 10;
  const x = X(uu, v);
  const y = Y(uu, v);
  if (lr) return { x: outward > 0 ? x - 1 : x - w + 1, y: y - 12, w, h: 10 };
  return { x: x + 3, y: y - 6, w, h: 10 };
}

/**
 * The cardinality letter just outside a card edge at (u, v): 10px out along
 * the line and 4px above it (LR), or beside it (TB).
 */
function cardLetter(
  u: number,
  v: number,
  outward: number,
  text: string,
  lr: boolean,
  X: (u: number, v: number) => number,
  Y: (u: number, v: number) => number,
): string {
  const uu = u + outward * 10;
  const x = X(uu, v);
  const y = Y(uu, v);
  if (lr) {
    const anchor = outward > 0 ? 'start' : 'end';
    return `<text x="${rd(x)}" y="${rd(y - 4)}" class="t-arrow er-card" text-anchor="${anchor}">${escapeHtml(text)}</text>`;
  }
  return `<text x="${rd(x + 4)}" y="${rd(y + 3)}" class="t-arrow er-card" text-anchor="start">${escapeHtml(text)}</text>`;
}

const rd = (n: number): number => Math.round(n * 10) / 10;
