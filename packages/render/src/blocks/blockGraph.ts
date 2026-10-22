/**
 * Block-graph rendering — backs `block`, `infra`, `event`, `ddd`, and
 * `network`. Two layout modes share the same data shape:
 *
 * - **Layered:** if `spec.layers` is present, nodes are placed in horizontal
 *   bands by their `layer` index.
 * - **Grid:** otherwise nodes use `(col, row, w?)` placements, optionally
 *   wrapped in dashed group boxes.
 *
 * Skin (`DESIGN.md`): every node is paper (stores, caches and queues take
 * `paper-2`) with an ink or hairline outline, dashed for external kinds, and
 * an eyebrow chip (`SVC`, `DB`, `QUEUE`, …) naming the kind. Hue is spent on
 * one thing: the entry node (`gateway`, or the preset's entry kind) when
 * exactly one exists. Groups and layers are `paper-2` panels with an eyebrow.
 *
 * Ported from doc-studio.jsx `GridBlock` + `LayeredBlock` + `BlockDiagram`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { unionBox } from '../svg/router.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { LABEL_RUN, labelBox, labelForms, STEP_H, STEP_W } from '../svg/edgeSteps.js';
import { edgeMaskSize } from '../svg/edgePill.js';
import { gapsForLabels, geometryOf, hasBackEdge, LOOP_PAD, type GeometryReport } from '../svg/geometry.js';
import {
  isAgentCard,
  modelChipSvg,
  nodeGlyph,
  nodeSkin,
  skinFill,
  skinGlyphColor,
  SKIN_EDGE,
  type EdgeStyle,
  type NodeSkin,
} from '../svg/blockStyle.js';
import type { NodeColors } from '../svg/blockStyle.js';
import { gridGroupsSvg, groupLabelBoxes, groupPanelRects, nestingPads } from '../svg/gridGroups.js';
import { assignPanelHues, dominantHue, hueClass, hueInk, HUES, hueTint, type Hue } from '../svg/hues.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { cutTitle, fitStack, fitText, FONT, reportCut, splitIdentifier, textWidth, type Font, type Wrapped } from '../svg/wrapText.js';
import { safeColor } from '../sanitize.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { autoDir, ensureGrid } from './autoLayout.js';
import { DECORATIVE } from '../svg/decorative.js';

type Data = BlockDataMap['block'];
type Node = NonNullable<Data['nodes']>[number];

interface FrameOpts {
  /** Eyebrow family word. */
  readonly tag: string;
  /** Kinds that mark the diagram's entry; the accent goes to the one node of these kinds, if exactly one. */
  readonly entry: readonly string[];
}

const FALLBACK_EDGE: EdgeStyle = SKIN_EDGE['solid'] ?? {
  stroke: 'var(--muted)',
  sw: 1.5,
  dash: '',
  marker: 'skArrow',
  err: false,
};

/** Legend wording per chip. */
const CHIP_LABEL: Record<string, string> = {
  CLIENT: 'client',
  SVC: 'service',
  WORKER: 'worker',
  DATA: 'data',
  DB: 'database',
  BUCKET: 'object store',
  WAREHOUSE: 'warehouse',
  QUEUE: 'queue',
  TOPIC: 'topic',
  BUS: 'stream',
  CACHE: 'cache',
  SEARCH: 'search index',
  REGISTRY: 'registry',
  GATEWAY: 'gateway',
  LB: 'load balancer',
  FN: 'function',
  EDGE: 'edge / CDN',
  EXT: 'external',
  PRODUCER: 'producer',
  CONSUMER: 'consumer',
  CONTEXT: 'bounded context',
  WAF: 'firewall',
  DNS: 'DNS',
  AUTH: 'identity',
  OBS: 'observability',
  CRON: 'scheduler',
  ANALYTICS: 'analytics',
  CI: 'pipeline',
  GIT: 'repository',
  EMAIL: 'messaging',
  CONFIG: 'config',
  AI: 'model / ML',
  AGENT: 'agent',
  LLM: 'model call',
  TOOL: 'tool',
  MEMORY: 'agent memory',
  VECTOR: 'vector store',
  HUMAN: 'human review',
  GUARD: 'guardrail',
  EVAL: 'eval / judge',
  PROMPT: 'prompt',
  HOST: 'host',
  SECRETS: 'secrets',
  WEBHOOK: 'webhook',
  REGION: 'region',
  DEPLOY: 'deployment',
  POD: 'pod',
  INGRESS: 'ingress',
  NS: 'namespace',
  NODE: 'node',
  CLUSTER: 'cluster',
};

/** The single accent node id: the one node whose kind is an entry kind, else none. */
function accentNodeId(nodes: readonly { readonly id: string; readonly kind?: string | undefined }[], entry: readonly string[]): string | undefined {
  const hits = nodes.filter((n) => entry.includes((n.kind ?? '').toLowerCase()));
  return hits.length === 1 ? hits[0]?.id : undefined;
}

/**
 * The hue of each named request path (`edges[].path`), in order of first use:
 * the category hues in their rotation order, so the first two paths (a read
 * and a write path) take blue and amber, which stay apart for every common
 * colour-vision type.
 */
function pathHues(edges: ReadonlyArray<{ readonly path?: string | undefined }>): Map<string, Hue> {
  const out = new Map<string, Hue>();
  for (const e of edges) {
    const name = e.path?.trim() ?? '';
    if (name === '' || out.has(name)) continue;
    out.set(name, HUES[out.size % HUES.length] as Hue);
  }
  return out;
}

/** The legend words for a path: its name, with "path" added unless the name ends in it. */
function pathLabel(name: string): string {
  return /\bpath$/i.test(name) ? name : `${name} path`;
}

/**
 * The arrowheads of the path hues the diagram uses: a filled head and an open
 * (async) head per hue. The skin's shared heads are `muted` only.
 */
function pathMarkers(hues: Iterable<Hue>): string {
  let d = '';
  for (const h of new Set(hues)) {
    const c = hueInk(h);
    d +=
      `<marker id="skPath-${h}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>` +
      `<marker id="skPathOpen-${h}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="${c}" stroke-width="1.6"/></marker>`;
  }
  return d === '' ? '' : `<defs>${d}</defs>`;
}

/**
 * An edge's stroke: the skin's style for its `kind`, in its path's hue when it
 * has one. Error and forbidden edges keep `negative` on any path.
 */
function edgeStyleOf(e: { readonly kind?: string | undefined; readonly path?: string | undefined }, hues: ReadonlyMap<string, Hue>): EdgeStyle & { readonly hue?: Hue } {
  const base = SKIN_EDGE[e.kind ?? 'solid'] ?? FALLBACK_EDGE;
  const hue = hues.get(e.path?.trim() ?? '');
  if (hue === undefined || base.err) return base;
  return { ...base, stroke: hueInk(hue), marker: `${base.marker === 'skOpen' ? 'skPathOpen' : 'skPath'}-${hue}`, hue };
}

/** Room kept between two labels stacked on parallel edges (px). */
const PARALLEL_LABEL_GAP = 6;

/**
 * The extra room the labels between two nodes take in the gap they ride, as
 * the negative slack {@link gapsForLabels} reads. A step numeral widens its
 * label. Parallel edges between the same two nodes (a read and a write request
 * through one load balancer) run one port apart, so their labels stack only
 * on one line each: across the flow the gap holds each label's one-line
 * form, and along it (TB) the labels' heights add up.
 */
function labelSlack(
  edges: ReadonlyArray<{ readonly from: string; readonly to: string; readonly label?: string | undefined; readonly step?: number | undefined }>,
): (from: string, to: string) => { x: number; y: number } {
  const key = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  interface Unit {
    readonly narrow: { w: number; h: number } | undefined;
    readonly oneLine: number;
    readonly stepW: number;
    readonly h: number;
  }
  const pairs = new Map<string, Unit[]>();
  for (const e of edges) {
    const labelled = e.label !== undefined && e.label !== '';
    if (!labelled && e.step === undefined) continue;
    const narrow = labelled ? labelBox(e.label ?? '') : undefined;
    const one = labelled ? edgeMaskSize(labelForms(e.label ?? '')[0] ?? []).w : 0;
    const stepW = e.step === undefined ? 0 : labelled ? STEP_W : STEP_H;
    const k = key(e.from, e.to);
    pairs.set(k, [...(pairs.get(k) ?? []), { narrow, oneLine: one, stepW, h: Math.max(narrow?.h ?? 0, e.step !== undefined ? STEP_H : 0) }]);
  }
  return (from, to) => {
    const units = pairs.get(key(from, to)) ?? [];
    const boxes = units.flatMap((u) => (u.narrow !== undefined ? [u.narrow] : []));
    if (boxes.length === 0) return { x: 0, y: 0 };
    const widest = Math.max(...boxes.map((b) => b.w));
    const tallest = Math.max(...boxes.map((b) => b.h));
    const parallel = units.length > 1;
    const needW = Math.max(...units.map((u) => (parallel ? u.oneLine : (u.narrow?.w ?? 0)) + u.stepW));
    const needH = parallel ? units.reduce((a, u) => a + u.h, 0) + PARALLEL_LABEL_GAP * (units.length - 1) : Math.max(...units.map((u) => u.h));
    return { x: -(needW - widest), y: -(needH - tallest) };
  };
}

/**
 * Legend items for the kinds and edge styles a diagram used. Exported so the
 * other block-family renderers (cluster) list their kinds with the same words.
 */
export function blockLegend(
  nodes: readonly { readonly kind?: string | undefined }[],
  edgeKinds: ReadonlySet<string>,
  accent: boolean,
  /** A node carries `replicas` ≥ 2 (the stacked card + `×N` chip). */
  replicas = false,
  /** The named request paths, each with its hue, in order of first use. */
  paths: ReadonlyMap<string, Hue> = new Map(),
): string {
  const items: LegendItem[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const sk = nodeSkin(n.kind);
    if (sk.chip === '' || seen.has(sk.chip)) continue;
    seen.add(sk.chip);
    items.push({
      swatch: 'chip',
      chip: sk.chip,
      label: CHIP_LABEL[sk.chip] ?? sk.chip.toLowerCase(),
      ...(sk.hue !== undefined ? { hue: sk.hue } : {}),
      ...(sk.dashed ? { dashed: true } : {}),
    });
  }
  if (replicas) items.push({ swatch: 'chip', chip: '×N', label: 'replicas' });
  for (const [name, hue] of paths) items.push({ swatch: 'line', stroke: hueInk(hue), label: pathLabel(name) });
  if (edgeKinds.has('solid')) items.push({ swatch: 'edge', label: 'calls' });
  if (edgeKinds.has('dashed')) items.push({ swatch: 'edge-dashed', label: 'async / optional' });
  if (edgeKinds.has('forbidden')) items.push({ swatch: 'edge-error', label: 'forbidden' });
  if (edgeKinds.has('error')) items.push({ swatch: 'edge-error', label: 'error' });
  if (accent) items.push({ swatch: 'node-accent', label: 'entry point' });
  return renderLegend(items);
}

/** `.blk-name` sets in 13px Inter 700; `.blk-tech` in 9.5px mono. */
const NAME_FONT: Font = { size: 13, weight: 700 };
const TECH_FONT: Font = { size: 9.5, mono: true };
const NAME_LH = 15;
const TECH_LH = 12;
const LABEL_GAP = 4;
/** The most lines a node name, and its `tech`, ever take. */
const NAME_MAX_LINES = 4;
const TECH_MAX_LINES = 3;

/** Height of a label block of `n` name lines and `t` tech lines. */
function labelBlockH(n: number, t: number): number {
  return n * NAME_LH + (t > 0 ? LABEL_GAP + t * TECH_LH : 0);
}

/** Where a node's label block goes: its column, its box, and the line above which it never starts. */
interface LabelSlot {
  readonly x: number;
  readonly boxY: number;
  readonly boxH: number;
  readonly textW: number;
  readonly anchor?: 'middle';
  /** The label block never starts above this y (it clears the kind chip). */
  readonly minTop?: number;
  /** The label block never ends below this y (it clears the box's bottom edge). */
  readonly maxBottom?: number;
}

/** The room a slot gives the label block, top to bottom. */
function slotRoom(slot: LabelSlot): number {
  const bottom = Math.min(slot.boxY + slot.boxH, slot.maxBottom ?? Infinity);
  return bottom - Math.max(slot.boxY, slot.minTop ?? slot.boxY);
}

/** Where a label block of height `blockH` starts: centred in the slot, clear of the chip and the bottom edge. */
function slotTop(slot: LabelSlot, blockH: number): number {
  const centred = slot.boxY + (slot.boxH - blockH) / 2;
  const lowest = Math.min(centred, (slot.maxBottom ?? Infinity) - blockH);
  return Math.max(lowest, slot.minTop ?? -Infinity);
}

/**
 * Fits a node's `name` and `tech` to a slot (see `fitStack`): the whole text
 * when it fits, else `tech` gives up lines first and what still does not fit
 * ends with "…". `need` is the height the whole text wants, so a grid can
 * grow its cells before anything is cut.
 */
function fitNodeLabels(
  name: string,
  tech: string | undefined,
  textW: number,
  room: number,
): { name: Wrapped; tech: Wrapped; need: number } {
  const fit = fitStack(
    { text: name, font: NAME_FONT, lineH: NAME_LH, maxLines: NAME_MAX_LINES },
    tech !== undefined ? { text: tech, font: TECH_FONT, lineH: TECH_LH, maxLines: TECH_MAX_LINES } : undefined,
    textW,
    room,
    LABEL_GAP,
  );
  return { name: fit.head, tech: fit.tail, need: fit.need };
}

/** Where a node's label cut is reported: the node's data path and name. */
interface LabelSite {
  readonly path?: string | undefined;
}

/**
 * Renders a node's `name` and optional `tech`, vertically centred in the slot
 * (and never above `minTop`, so it clears the kind chip). Long text wraps;
 * text that still does not fit ends with "…", carries its full text in a
 * `<title>`, and is reported as a cut. `anchor: 'middle'` centres each line
 * on `x` (for shaped nodes).
 */
function nodeLabels(
  opts: LabelSlot & {
    readonly name: string;
    readonly tech?: string;
    readonly nameFill: string;
    readonly techFill: string;
    /** Skin mode: type-role classes carry the colour (`nameFill`/`techFill` ignored). */
    readonly skin?: boolean;
    readonly accent?: boolean;
    readonly site?: LabelSite;
  },
): string {
  const anchorAttr = opts.anchor === 'middle' ? ' text-anchor="middle"' : '';
  const fit = fitNodeLabels(opts.name, opts.tech, opts.textW, slotRoom(opts));
  reportNodeCuts(fit, opts.name, opts.site);
  const nameLines = fit.name.lines;
  const techLines = fit.tech.lines;
  const nameAttrs =
    opts.skin === true ? ` class="blk-name t-name${opts.accent === true ? ' c-accent' : ''}"` : ` class="blk-name" fill="${opts.nameFill}"`;
  const techAttrs = opts.skin === true ? ' class="blk-tech t-sub"' : ` class="blk-tech" fill="${opts.techFill}"`;
  const blockH = labelBlockH(nameLines.length, techLines.length);
  let y = slotTop(opts, blockH) + NAME_LH - 4;
  let s = '';
  nameLines.forEach((ln, i) => {
    s += `<text x="${opts.x}" y="${y.toFixed(1)}"${nameAttrs}${anchorAttr}>${i === 0 ? cutTitle(fit.name) : ''}${escapeHtml(ln)}</text>`;
    y += NAME_LH;
  });
  if (techLines.length > 0) {
    y += LABEL_GAP - NAME_LH + TECH_LH;
    techLines.forEach((ln, i) => {
      s += `<text x="${opts.x}" y="${y.toFixed(1)}"${techAttrs}${anchorAttr}>${i === 0 ? cutTitle(fit.tech) : ''}${escapeHtml(ln)}</text>`;
      y += TECH_LH;
    });
  }
  return s;
}

/** Reports the name and tech a node had to cut, with a fix in data terms. */
function reportNodeCuts(fit: { readonly name: Wrapped; readonly tech: Wrapped }, owner: string, site: LabelSite | undefined): void {
  const at = (field: string): string | undefined => (site?.path !== undefined ? `${site.path}.${field}` : undefined);
  if (fit.name.truncated) {
    reportCut({ path: at('name'), field: 'name', full: fit.name.full, hint: 'Shorten `name`, or move the detail to `tech`.' });
  }
  if (fit.tech.truncated) {
    reportCut({
      path: at('tech'),
      owner,
      field: 'tech',
      full: fit.tech.full,
      hint: 'Shorten `tech` to the technology itself, and put the rest in the prose.',
    });
  }
}

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/**
 * The rect edges should anchor to for a given kind — most shapes fill their
 * grid cell, but the cloud's outline is inset (arrows would float in air) and
 * the instance stack's back cards overhang the cell top-right (they'd be drawn
 * over incoming arrowheads). Boxless shapes anchor to their visible core.
 */
/**
 * The visible bar inside a gateway / load-balancer cell: half the cell wide
 * (never under 84 units, so a two-line name fits), the full cell height —
 * and, with a row span, the full height of every row it fronts.
 */
export function barRect(r: Rect, name?: string): Rect {
  // Wide enough for the name's longest word, so the bar never splits a word —
  // unless that word is a long identifier, which breaks at its joints instead.
  const word = Math.max(
    0,
    ...(name ?? '').split(/\s+/).map((wd) => {
      const whole = textWidth(wd, NAME_FONT);
      return whole + 16 <= r.w * 0.7 ? whole : Math.max(...splitIdentifier(wd).map((p) => textWidth(p, NAME_FONT)));
    }),
  );
  const w = Math.min(r.w, Math.max(84, Math.round(r.w * 0.5), Math.ceil(word + 16)));
  return { x: Math.round(r.x + (r.w - w) / 2), y: r.y, w, h: r.h };
}

/** True for the kinds drawn as a vertical bar. */
export function isBarKind(kind: string | undefined): boolean {
  return shapeFor(kind) === 'bar';
}

export function edgeAnchorRect(kind: string | undefined, r: Rect, replicas?: number, name?: string): Rect {
  const shape = shapeFor(kind);
  const base = ((): Rect => {
    switch (shape) {
      case 'bar':
        return barRect(r, name);
      case 'cloud':
        return { x: r.x + r.w * 0.07, y: r.y + r.h * 0.3, w: r.w * 0.86, h: r.h * 0.7 - 4 };
      case 'fn': {
        // The circle's square: an arrow ends on the circle, not at the cell side.
        const rad = fnRadius(r);
        return { x: r.x + r.w / 2 - rad, y: r.y + r.h / 2 - rad, w: rad * 2, h: rad * 2 };
      }
      case 'vault': {
        // The padlock: the body's width, from the shackle's top to the base.
        const bw = vaultBodyW(r);
        return { x: r.x + (r.w - bw) / 2, y: r.y + 4, w: bw, h: r.h - 4 };
      }
      case 'shards':
        // The three cylinders sit inside a 12px pad.
        return { x: r.x + SHARD_PAD, y: r.y, w: r.w - SHARD_PAD * 2, h: r.h };
      case 'figure':
      case 'crowd':
        return { x: r.x + r.w * 0.28, y: r.y, w: r.w * 0.44, h: r.h };
      case 'globe':
        return { x: r.x + r.w * 0.3, y: r.y, w: r.w * 0.4, h: r.h };
      default:
        return r;
    }
  })();
  // A replica pile recedes INSIDE the cell (see `pileRect`), so it needs no overhang.
  void replicas;
  return base;
}

/** The stack offset between one replica card and the next. */
const PILE_OFF = 6;

/**
 * With `replicas ≥ 2` the front card gives up the pile's footprint (two
 * offsets) so the back cards recede down-right inside the cell — a group
 * panel that encloses the cell encloses the whole pile.
 */
function pileRect(replicas: number | undefined, shape: Shape, r: Rect): Rect {
  return hasReplicaStack(replicas, shape) ? { x: r.x, y: r.y, w: r.w - PILE_OFF * 2, h: r.h - PILE_OFF * 2 } : r;
}

/** Shapes that already read as a stack — `replicas` adds only the `×N` chip there. */
const STACKED_SHAPES: ReadonlySet<string> = new Set(['replica', 'shards', 'crowd']);
/** Shapes whose kind chip sits top-right; the `×N` chip moves to the top-left. */
const CHIP_RIGHT_SHAPES: ReadonlySet<string> = new Set(['cloud', 'shield', 'figure', 'crowd', 'globe', 'shards', 'replica']);

/** A function circle's radius in its cell. */
function fnRadius(r: Rect): number {
  return Math.min(r.h / 2, r.w * 0.32);
}

/** The padlock body's width in its cell. */
function vaultBodyW(r: Rect): number {
  return Math.min(r.w * 0.72, r.h * 1.6);
}

/** The side pad around a sharded store's three cylinders. */
const SHARD_PAD = 12;

/** A cache's memory contacts: pin width, pitch, height, and their gap above the base. */
const MEM_PIN_W = 4;
const MEM_PIN_PITCH = 7;
const MEM_PIN_H = 7;
const MEM_PIN_BASE = 3;
/** The strip a cache's contacts take at the bottom of its card (px). */
const MEM_STRIP = MEM_PIN_H + MEM_PIN_BASE + 3;

function hasReplicaStack(replicas: number | undefined, shape: Shape): boolean {
  return replicas !== undefined && replicas >= 2 && !STACKED_SHAPES.has(shape);
}

/** Where the `×N` chip sits: top-right, pulled in from a shape's slanted or rounded corner. */
function replicaChipPos(shape: Shape, r: Rect): { x: number; y: number; end: boolean } {
  switch (shape) {
    case 'pipe':
      return { x: r.x + r.w - Math.min(15, r.w * 0.11) * 2 - 4, y: r.y + 13, end: true };
    case 'cylinder':
      return { x: r.x + r.w - 14, y: r.y + Math.min(13, r.h * 0.16) * 2 + 8, end: true };
    case 'window':
    case 'phone':
      // The kind chip holds the top-right corner: the count takes the bottom-right.
      return { x: r.x + r.w - 8, y: r.y + r.h - 7, end: true };
    default:
      return CHIP_RIGHT_SHAPES.has(shape) ? { x: r.x + 8, y: r.y + 13, end: false } : { x: r.x + r.w - 8, y: r.y + 13, end: true };
  }
}

/**
 * `replicas ≥ 2`: two paper cards receding down-right behind the node (the
 * stacked-card idiom) and a `×N` mono chip at the top-right. Returns the
 * back cards (drawn first, under the body) and the chip (drawn last, over it).
 */
function replicaMarks(replicas: number | undefined, shape: Shape, r: Rect, st: Paint): { back: string; chip: string } {
  if (replicas === undefined || replicas < 2) return { back: '', chip: '' };
  const off = PILE_OFF;
  const card = (i: number, op: number): string =>
    `<rect x="${r.x + off * i}" y="${r.y + off * i}" width="${r.w}" height="${r.h}" rx="6" fill="${st.fill}" stroke="${st.accent}" stroke-width="1" opacity="${op}"/>`;
  const back = hasReplicaStack(replicas, shape) ? card(2, 0.45) + card(1, 0.7) : '';
  const at = replicaChipPos(shape, r);
  const chip = `<text x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}" class="blk-rep t-sub"${at.end ? ' text-anchor="end"' : ''}>×${replicas}</text>`;
  return { back, chip };
}

/** Puts `back` right after the body's opening `<g>` and `tail` before its closing tag. */
function wrapBody(body: string, back: string, tail: string): string {
  const withBack = back.length > 0 ? body.replace(/^<g[^>]*>/, (m) => m + back) : body;
  return tail.length > 0 ? withBack.replace(/<\/g>$/, `${tail}</g>`) : withBack;
}

/**
 * The canonical system-design shapes, chosen by node kind: data stores render
 * as cylinders, queues/streams as pipes (stadiums), CDN/external as clouds,
 * gateways/load-balancers as the tall vertical bar of system-design diagrams
 * (it spans the rows of the services it fronts). Everything else keeps the
 * accent card.
 */
type Shape =
  | 'cylinder'
  | 'pipe'
  | 'cloud'
  | 'bar'
  | 'memory'
  | 'pail'
  | 'tiered'
  | 'rack'
  | 'shield'
  | 'figure'
  | 'crowd'
  | 'window'
  | 'phone'
  | 'fn'
  | 'clock'
  | 'vault'
  | 'shards'
  | 'replica'
  | 'globe'
  | 'card';

function shapeFor(kind: string | undefined): Shape {
  switch ((kind ?? '').toLowerCase()) {
    case 'db':
    case 'database':
    case 'store':
    case 'postgres':
    case 'mysql':
    case 'mongo':
    case 'mongodb':
    case 'dynamo':
    case 'vector':
    case 'embeddings':
      return 'cylinder';
    case 'warehouse':
    case 'lake':
      return 'tiered';
    case 'bucket':
    case 'blob':
    case 'object':
    case 's3':
      return 'pail';
    case 'queue':
    case 'topic':
    case 'stream':
    case 'mq':
    case 'broker':
    case 'sqs':
    case 'rabbitmq':
    case 'kafka':
    case 'kinesis':
      return 'pipe';
    case 'sns':
      return 'pipe';
    case 'cdn':
    case 'external':
      return 'cloud';
    case 'gateway':
    case 'proxy':
    case 'ingress':
    case 'lb':
      return 'bar';
    case 'cache':
    case 'redis':
    case 'memcached':
      // A memory module, never a pile: a pile of cards means `replicas`.
      return 'memory';
    case 'vm':
    case 'server':
    case 'host':
    case 'node':
      return 'rack';
    case 'waf':
    case 'firewall':
    case 'shield':
      return 'shield';
    case 'user':
    case 'person':
    case 'actor':
      return 'figure';
    case 'users':
    case 'crowd':
      return 'crowd';
    case 'browser':
    case 'web':
      return 'window';
    case 'mobile':
      return 'phone';
    case 'function':
    case 'lambda':
      return 'fn';
    case 'scheduler':
    case 'cron':
    case 'job':
    case 'cronjob':
      return 'clock';
    case 'secrets':
    case 'vault':
    case 'kms':
    case 'secret':
      return 'vault';
    case 'shard':
    case 'shards':
    case 'sharded':
      return 'shards';
    case 'replica':
    case 'replicas':
    case 'replicaset':
      return 'replica';
    case 'region':
    case 'geo':
    case 'globe':
      return 'globe';
    default:
      return 'card';
  }
}

/** A node's outline / fill / text colours, plus the skin's stroke attributes. */
interface Paint extends NodeColors {
  /** Legacy palette mode (pre-skin renderers): shadows on, hex palette, no chip. */
  readonly legacy: boolean;
  /** Outline stroke width. */
  readonly sw: number;
  /** Dashed outline (external / boundary kinds). */
  readonly dashed: boolean;
  /** The node carries the diagram's accent (`accent` itself is the outline colour, a legacy field name). */
  readonly focal: boolean;
  /** Glyph and silhouette colour: the family hue, `accent` when focal, `muted` when neutral. */
  readonly glyph: string;
}

function skinPaint(sk: NodeSkin, focal: boolean): Paint {
  return {
    accent: focal ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)',
    fill: skinFill(sk, focal),
    text: 'var(--ink)',
    legacy: false,
    sw: focal || sk.primary ? 1.5 : 1,
    dashed: sk.dashed,
    focal,
    glyph: skinGlyphColor(sk, focal),
  };
}

/** The chip's colour class: the accent on the focal node (it is part of that mark), else the family hue. */
function chipTone(sk: NodeSkin, focal: boolean): string {
  return focal ? ' c-accent' : hueClass(sk.hue);
}

/**
 * Where a kind's eyebrow chip sits (its baseline): boxy shapes top-left,
 * cylinders under the rim, the rest top-right. Warehouses and buckets draw
 * as cards, so their chip sits where a card's does.
 */
function chipAt(shape: Shape, r: Rect): { x: number; y: number; anchor: '' | 'middle' | 'end' } {
  const cx = r.x + r.w / 2;
  switch (shape) {
    case 'cylinder':
      return { x: cx, y: r.y + Math.min(13, r.h * 0.16) * 2 + 8, anchor: 'middle' };
    case 'pipe':
      return { x: r.x + Math.min(15, r.w * 0.11) + 6, y: r.y + 12, anchor: '' };
    case 'bar':
      return { x: cx, y: r.y + 12, anchor: 'middle' };
    case 'fn': {
      const rad = fnRadius(r);
      return { x: cx, y: r.y + r.h / 2 - rad * 0.62, anchor: 'middle' };
    }
    case 'cloud':
      // Inside the outline, over the name — never out at the cell corner.
      return { x: r.x + r.w * 0.48, y: r.y + r.h * 0.5, anchor: 'middle' };
    case 'shards':
      // Inside the middle cylinder, under its rim.
      return { x: cx, y: r.y + Math.min(7, r.h * 0.58 * 0.18) * 2 + 10, anchor: 'middle' };
    case 'replica': {
      // Under the front cylinder's rim, as on a single database.
      const off = 7;
      return { x: r.x + (r.w - off * 2) / 2, y: r.y + off * 2 + Math.min(11, r.h * 0.14) * 2 + 8, anchor: 'middle' };
    }
    case 'figure':
      // Beside the head and shoulders.
      return { x: cx + Math.min(11, r.h * 0.13) * 1.8 + 6, y: r.y + Math.min(11, r.h * 0.13) * 2 + 12, anchor: '' };
    case 'crowd': {
      const hr = Math.min(9, r.h * 0.11);
      return { x: cx + hr * 4.1 + 6, y: r.y + 4 + hr * 2.6, anchor: '' };
    }
    case 'globe': {
      const rad = Math.min(r.h * 0.33, 30);
      return { x: cx + rad + 6, y: r.y + rad + 5, anchor: '' };
    }
    case 'vault':
      return { x: cx, y: r.y + r.h * 0.3 + 11, anchor: 'middle' };
    case 'card':
    case 'tiered':
    case 'pail':
    case 'memory':
    case 'rack':
    case 'clock':
      return { x: r.x + 10, y: r.y + (shape === 'clock' ? Math.min(18, r.h * 0.22) + 14 : 12), anchor: '' };
    case 'window':
      // In the header band, clear of the traffic dots at its left.
      return { x: r.x + r.w - 8, y: r.y + 12.5, anchor: 'end' };
    case 'phone':
      // The phone frame takes the left of the card: the chip sits top-right.
      return { x: r.x + r.w - 8, y: r.y + 12, anchor: 'end' };
    default:
      return { x: r.x + r.w - 4, y: r.y + 12, anchor: 'end' };
  }
}

function chipFor(shape: Shape, sk: NodeSkin, r: Rect, focal = false): string {
  if (sk.chip === '') return '';
  const at = chipAt(shape, r);
  const anchor = at.anchor === '' ? '' : ` text-anchor="${at.anchor}"`;
  return `<text x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}" class="blk-chip t-eyebrow${chipTone(sk, focal)}"${anchor}>${escapeHtml(sk.chip)}</text>`;
}

/** The shapes drawn as the plain card ({@link cardBody}). */
const CARD_SHAPES: ReadonlySet<Shape> = new Set<Shape>(['card', 'tiered', 'pail', 'rack', 'shield']);

/**
 * The label slot of a shaped node — the same numbers its body draws with —
 * and the line its label never starts above when a chip shares its column.
 */
function labelSlot(shape: Shape, r: Rect, kind: string | undefined, chip: boolean, replicas?: number): LabelSlot {
  const cx = r.x + r.w / 2;
  const below = (y: number): number | undefined => (chip ? y + 3 : undefined);
  const hasGlyph = nodeGlyph(kind, 0, 0, 'var(--muted)', 'var(--paper)').length > 0;
  const opt = (minTop: number | undefined): { minTop?: number } => (minTop !== undefined ? { minTop } : {});
  switch (shape) {
    case 'cylinder': {
      const ry = Math.min(13, r.h * 0.16);
      return { x: cx, boxY: r.y + ry * 2, boxH: r.h - ry * 2.6, textW: r.w - 30, anchor: 'middle', ...opt(below(chipAt(shape, r).y)) };
    }
    case 'pipe': {
      const ex = Math.min(15, r.w * 0.11);
      return { x: r.x + (r.w - ex) / 2, boxY: r.y, boxH: r.h, textW: r.w - ex * 3.2, anchor: 'middle', maxBottom: r.y + r.h - 6, ...opt(below(r.y + 12)) };
    }
    case 'memory': {
      // The card's slot, clear of the contacts along the bottom.
      const card = labelSlot('card', r, kind, chip, replicas);
      return { ...card, maxBottom: r.y + r.h - MEM_STRIP };
    }
    case 'cloud':
      return { x: r.x + r.w * 0.48, boxY: r.y + r.h * 0.34, boxH: r.h * 0.58, textW: r.w * 0.52, anchor: 'middle', ...opt(below(chipAt(shape, r).y)) };
    case 'bar':
      return { x: cx, boxY: r.y + 18, boxH: r.h - 24, textW: r.w - 14, anchor: 'middle' };
    case 'figure': {
      const headR = Math.min(11, r.h * 0.13);
      const shoulderY = r.y + headR + 2 + headR + 20;
      return { x: cx, boxY: shoulderY + 2, boxH: r.y + r.h - shoulderY - 2, textW: r.w - 12, anchor: 'middle' };
    }
    case 'fn': {
      const rad = fnRadius(r);
      const cy = r.y + r.h / 2;
      return { x: cx, boxY: cy - rad * 0.1, boxH: rad, textW: rad * 1.7, anchor: 'middle' };
    }
    case 'clock': {
      const hh = Math.min(18, r.h * 0.22);
      return { x: cx, boxY: r.y + 3 + hh, boxH: r.h - 3 - hh, textW: r.w - 40, anchor: 'middle', ...opt(below(chipAt(shape, r).y)) };
    }
    case 'vault': {
      const bodyY = r.y + r.h * 0.3;
      const bw = vaultBodyW(r);
      return { x: cx, boxY: bodyY, boxH: r.h * 0.7, textW: bw - 18, anchor: 'middle', ...opt(below(chipAt(shape, r).y)) };
    }
    case 'shards': {
      const ch = r.h * 0.58;
      return { x: cx, boxY: r.y + ch + 2, boxH: r.h - ch - 2, textW: r.w - 16, anchor: 'middle' };
    }
    case 'replica': {
      const off = 7;
      const ry = Math.min(11, r.h * 0.14);
      const cw = r.w - off * 2;
      return { x: r.x + cw / 2, boxY: r.y + off * 2 + ry * 2, boxH: r.h - off * 2 - ry * 2.6, textW: cw - 24, anchor: 'middle', ...opt(below(chipAt(shape, r).y)) };
    }
    case 'crowd': {
      const top = r.y + 4 + Math.min(9, r.h * 0.11) * 4.6;
      return { x: cx, boxY: top, boxH: r.y + r.h - top, textW: r.w - 12, anchor: 'middle' };
    }
    case 'globe': {
      const rad = Math.min(r.h * 0.33, 30);
      const top = r.y + rad + 2 + rad + 2;
      return { x: cx, boxY: top, boxH: r.y + r.h - top, textW: r.w - 12, anchor: 'middle' };
    }
    case 'phone': {
      const nx = r.x + 12 + 34 + 14;
      return { x: nx, boxY: r.y, boxH: r.h, textW: r.x + r.w - nx - 12, maxBottom: r.y + r.h - 6, ...opt(below(r.y + 12)) };
    }
    case 'window':
      return { x: cx, boxY: r.y + 18, boxH: r.h - 18, textW: r.w - 24, anchor: 'middle' };
    default: {
      // The card: the label block centres below a top-left chip, and clears
      // the chip and the `×N` replica chip on the top line.
      const nx = hasGlyph ? r.x + 40 : r.x + 16;
      const rep = replicas !== undefined && replicas >= 2;
      return {
        x: nx,
        boxY: chip ? r.y + 10 : r.y,
        boxH: chip ? r.h - 10 : r.h,
        textW: r.x + r.w - nx - 14,
        maxBottom: r.y + r.h - 6,
        ...opt(chip || rep ? r.y + 15 : undefined),
      };
    }
  }
}

/**
 * Renders one node — shaped by kind — inside its grid rect. Exported so other
 * architecture renderers (felogic/belogic, …) can reuse the shape language for
 * their data/queue/cache/external nodes: passing `legacy` colours keeps the
 * pre-skin look (shadow, palette hue, no chip); without it the skin applies.
 */
export function renderShapedNode(
  n: ShapedNode,
  r: Rect,
  legacy?: NodeColors,
  accent = false,
): string {
  const sk = nodeSkin(n.kind);
  const st: Paint =
    legacy !== undefined
      ? { ...legacy, legacy: true, sw: 1.2, dashed: false, focal: false, glyph: legacy.accent }
      : skinPaint(sk, accent);
  const shape = shapeFor(n.kind);
  const rr = st.legacy ? r : shape === 'bar' ? barRect(r, n.name) : pileRect(n.replicas, shape, r);
  const body = shapedBody(n, rr, st, shape);
  if (st.legacy) return body;
  const rep = replicaMarks(n.replicas, shape, rr, st);
  return wrapBody(body, rep.back, chipFor(shape, sk, rr, accent) + rep.chip);
}

/** A node as the shape renderer draws it; `path` (its data path) names a cut. */
interface ShapedNode {
  readonly kind?: string | undefined;
  readonly name: string;
  readonly tech?: string | undefined;
  readonly replicas?: number | undefined;
  readonly path?: string | undefined;
  /** Room (px) the label leaves free at the bottom of the box, for marks drawn there. */
  readonly reserveBottom?: number | undefined;
}

/** The node's label slot, with the bottom strip it reserves for marks taken out. */
function nodeSlot(shape: Shape, r: Rect, n: ShapedNode, chip: boolean, replicas?: number): LabelSlot {
  const slot = labelSlot(shape, r, n.kind, chip, replicas);
  if (n.reserveBottom === undefined || n.reserveBottom <= 0) return slot;
  return { ...slot, maxBottom: Math.min(slot.maxBottom ?? Infinity, r.y + r.h - n.reserveBottom) };
}

/**
 * How much taller (px) a node's cell must be for its whole `name` and `tech`
 * to fit its shape; 0 or less when they fit. A grid grows its cells by this
 * before any label is cut.
 */
export function shapedLabelDeficit(n: ShapedNode, r: Rect, layered = false): number {
  const shape = layered ? 'card' : shapeFor(n.kind);
  const rr = shape === 'bar' ? barRect(r, n.name) : pileRect(n.replicas, shape, r);
  const chip = nodeSkin(n.kind).chip !== '';
  if (CARD_SHAPES.has(shape) && isAgentCard(n.kind) && n.tech !== undefined && n.tech.trim() !== '') {
    const slot = nodeSlot('card', rr, n, chip, n.replicas);
    const textW = slot.textW + 2;
    const lines = fitText(n.name, { width: textW, font: NAME_FONT, maxLines: NAME_MAX_LINES }).lines.length;
    return lines * NAME_LH + 4 + 13 - slotRoom(slot);
  }
  const slot = nodeSlot(CARD_SHAPES.has(shape) ? 'card' : shape, rr, n, chip, n.replicas);
  return fitNodeLabels(n.name, n.tech, slot.textW, slotRoom(slot)).need - slotRoom(slot);
}

function shapedBody(n: ShapedNode, r: Rect, st: Paint, shape: Shape): string {
  const cx = r.x + r.w / 2;
  const tech = n.tech !== undefined ? { tech: n.tech } : {};
  const shadow = st.legacy ? ' filter="url(#gshadow)"' : '';
  const sw = st.sw;
  const dashA = st.dashed ? ' stroke-dasharray="4 3"' : '';
  const gc = st.glyph;
  const techTok = st.legacy ? st.accent : 'var(--muted)';
  const skinOpts = st.legacy ? {} : { skin: true, accent: st.focal };
  const slot = { ...nodeSlot(shape, r, n, !st.legacy && nodeSkin(n.kind).chip !== ''), site: { path: n.path } };

  if (shape === 'cylinder') {
    const ry = Math.min(13, r.h * 0.16);
    const rx = r.w / 2;
    return (
      `<g${shadow}>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'pipe') {
    // A horizontal cylinder — the classic queue/topic silhouette. The rim
    // ellipse marks the open (consumer) end on the right.
    const ex = Math.min(15, r.w * 0.11);
    const ry = r.h / 2;
    const cy = r.y + ry;
    return (
      `<g${shadow}>` +
      `<path d="M${r.x + ex} ${r.y} H ${r.x + r.w - ex} A ${ex} ${ry} 0 0 1 ${r.x + r.w - ex} ${r.y + r.h} H ${r.x + ex} A ${ex} ${ry} 0 0 1 ${r.x + ex} ${r.y} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<ellipse cx="${r.x + r.w - ex}" cy="${cy}" rx="${ex}" ry="${ry}" fill="none" stroke="${st.accent}" stroke-width="1.1" stroke-opacity="0.7"${DECORATIVE}/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'memory') {
    // A cache: a memory module — the card with a row of contacts along its
    // base, broken by one key notch. One card, so it never reads as the pile
    // of cards that means `replicas`.
    // A renderer that draws its own marks along the base (`cluster`'s
    // replica bars) keeps that strip: the contacts give way to them.
    const x0 = r.x + 14;
    const count = (n.reserveBottom ?? 0) > 0 ? 0 : Math.max(4, Math.floor((r.w - 28 + (MEM_PIN_PITCH - MEM_PIN_W)) / MEM_PIN_PITCH));
    const notch = Math.round(count * 0.38);
    const py = r.y + r.h - MEM_PIN_BASE - MEM_PIN_H;
    let pins = '';
    for (let i = 0; i < count; i++) {
      if (i === notch) continue;
      pins += `<rect x="${x0 + i * MEM_PIN_PITCH}" y="${py}" width="${MEM_PIN_W}" height="${MEM_PIN_H}" rx="0.8"/>`;
    }
    const top = slot.boxY;
    const gl = nodeGlyph(n.kind, r.x + 14, Math.round((top + r.y + r.h - MEM_STRIP) / 2 - 8), gc, st.fill);
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      (pins === '' ? '' : `<g class="blk-pins" fill="${gc}" fill-opacity="0.55"${DECORATIVE}>${pins}</g>`) +
      gl +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'cloud') {
    const b = r.y + r.h - 3;
    const p =
      `M ${r.x + r.w * 0.2} ${b} ` +
      `A ${r.w * 0.13} ${r.h * 0.2} 0 0 1 ${r.x + r.w * 0.14} ${b - r.h * 0.32} ` +
      `A ${r.w * 0.17} ${r.h * 0.28} 0 0 1 ${r.x + r.w * 0.43} ${b - r.h * 0.58} ` +
      `A ${r.w * 0.18} ${r.h * 0.26} 0 0 1 ${r.x + r.w * 0.72} ${b - r.h * 0.5} ` +
      `A ${r.w * 0.13} ${r.h * 0.21} 0 0 1 ${r.x + r.w * 0.82} ${b} Z`;
    return (
      `<g${shadow}>` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA} stroke-linejoin="round"/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'bar') {
    // The gateway / load-balancer bar of system-design diagrams: a tall,
    // narrow rectangle with square corners, standing between the callers and
    // the services it fronts. `r` is already the bar (see `barRect`).
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'figure') {
    // A boxless actor: head + shoulders above the name (UML-actor spirit).
    const headR = Math.min(11, r.h * 0.13);
    const headCy = r.y + headR + 2;
    const shoulderY = headCy + headR + 20;
    return (
      `<g>` +
      `<circle cx="${cx}" cy="${headCy.toFixed(1)}" r="${headR}" fill="${gc}"/>` +
      `<path d="M ${cx - headR * 1.8} ${shoulderY.toFixed(1)} a ${headR * 1.8} ${headR * 2} 0 0 1 ${headR * 3.6} 0 z" fill="${gc}"/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'fn') {
    // A function/lambda: a circle with the ƒ mark.
    const rad = fnRadius(r);
    const cy = r.y + r.h / 2;
    return (
      `<g${shadow}>` +
      `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<text x="${cx}" y="${(cy - rad * 0.25).toFixed(1)}" font-family="Georgia, serif" font-size="${Math.max(15, rad * 0.42).toFixed(0)}" font-style="italic" font-weight="700" fill="${gc}" text-anchor="middle">ƒ</text>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'clock') {
    // A scheduler/cron: the industry-standard calendar card with a clock badge.
    const hh = Math.min(18, r.h * 0.22);
    const ringY = r.y + 3;
    const ring = (fx: number): string =>
      `<path d="M${fx.toFixed(1)} ${(ringY - 6).toFixed(1)} V ${(ringY + 4).toFixed(1)}" stroke="${st.accent}" stroke-width="3" stroke-linecap="round"/>`;
    const ccx = r.x + r.w - 18;
    const ccy = r.y + r.h - 16;
    const cr = Math.min(11, r.h * 0.14);
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y + 3}" width="${r.w}" height="${r.h - 3}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + 12} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + 3 + hh} H ${r.x} Z" fill="${gc}" fill-opacity="0.16"/>` +
      `<path d="M${r.x} ${r.y + 3 + hh} H ${r.x + r.w}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.5"${DECORATIVE}/>` +
      ring(r.x + r.w * 0.3) +
      ring(r.x + r.w * 0.7) +
      `<circle cx="${ccx}" cy="${ccy}" r="${cr}" fill="var(--paper)" stroke="${st.accent}" stroke-width="1.4"/>` +
      `<path d="M${ccx} ${(ccy - cr * 0.55).toFixed(1)} V ${ccy} L ${(ccx + cr * 0.45).toFixed(1)} ${(ccy + cr * 0.3).toFixed(1)}" stroke="${st.accent}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'vault') {
    // Secrets: a padlock — shackle arc over a rounded body.
    const bodyY = r.y + r.h * 0.3;
    const bodyH = r.h * 0.7;
    const bw = vaultBodyW(r);
    const bx = cx - bw / 2;
    const shR = bw * 0.22;
    return (
      `<g${shadow}>` +
      `<path d="M${(cx - shR).toFixed(1)} ${(bodyY + 4).toFixed(1)} V ${(r.y + shR * 0.9 + 4).toFixed(1)} A ${shR.toFixed(1)} ${(shR * 0.95).toFixed(1)} 0 0 1 ${(cx + shR).toFixed(1)} ${(r.y + shR * 0.9 + 4).toFixed(1)} V ${(bodyY + 4).toFixed(1)}" fill="none" stroke="${st.accent}" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="${bx.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bw.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'shards') {
    // A sharded store: three small cylinders side by side.
    const gap = 8;
    const pad = SHARD_PAD;
    const cw = (r.w - pad * 2 - gap * 2) / 3;
    const ch = r.h * 0.58;
    const ry = Math.min(7, ch * 0.18);
    let cyls = '';
    for (let i = 0; i < 3; i++) {
      const sx = r.x + pad + i * (cw + gap);
      cyls +=
        `<path d="M${sx.toFixed(1)} ${r.y + ry} A ${cw / 2} ${ry} 0 0 1 ${(sx + cw).toFixed(1)} ${r.y + ry} V ${(r.y + ch - ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${sx.toFixed(1)} ${(r.y + ch - ry).toFixed(1)} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.1"/>` +
        `<path d="M${sx.toFixed(1)} ${r.y + ry} A ${cw / 2} ${ry} 0 0 0 ${(sx + cw).toFixed(1)} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.1"/>`;
    }
    return (
      `<g${shadow}>` +
      cyls +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'replica') {
    // A replica set: a cylinder with two receding copies behind it.
    const off = 7;
    const ry = Math.min(11, r.h * 0.14);
    const cw = r.w - off * 2;
    const cyl = (dx: number, dy: number, op: number, sw: number): string =>
      `<g opacity="${op}"><path d="M${(r.x + dx).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${(r.x + dx + cw).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} V ${(r.y + dy + r.h - off * 2 - ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${(r.x + dx).toFixed(1)} ${(r.y + dy + r.h - off * 2 - ry).toFixed(1)} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"/>` +
      `<path d="M${(r.x + dx).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 0 ${(r.x + dx + cw).toFixed(1)} ${(r.y + dy + ry).toFixed(1)}" fill="none" stroke="${st.accent}" stroke-width="${sw}"/></g>`;
    return (
      `<g${shadow}>` +
      cyl(off * 2, 0, 0.5, 1) +
      cyl(off, off, 0.75, 1) +
      cyl(0, off * 2, 1, 1.2) +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'crowd') {
    // Many users: overlapping actor figures.
    const hr = Math.min(9, r.h * 0.11);
    const fig = (fx: number, fy: number, scale: number, op: number): string => {
      const rr = hr * scale;
      return (
        `<g opacity="${op}">` +
        `<circle cx="${fx}" cy="${(fy + rr).toFixed(1)}" r="${rr.toFixed(1)}" fill="${gc}"/>` +
        `<path d="M ${(fx - rr * 1.7).toFixed(1)} ${(fy + rr * 2 + rr * 1.9).toFixed(1)} a ${(rr * 1.7).toFixed(1)} ${(rr * 1.9).toFixed(1)} 0 0 1 ${(rr * 3.4).toFixed(1)} 0 z" fill="${gc}"/>` +
        `</g>`
      );
    };
    const baseY = r.y + 4;
    return (
      `<g>` +
      fig(cx - hr * 2.4, baseY + 3, 0.85, 0.45) +
      fig(cx + hr * 2.4, baseY + 3, 0.85, 0.45) +
      fig(cx, baseY, 1, 1) +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'globe') {
    // A region / geo node: boxless globe above the label.
    const rad = Math.min(r.h * 0.33, 30);
    const gcy = r.y + rad + 2;
    return (
      `<g>` +
      `<circle cx="${cx}" cy="${gcy.toFixed(1)}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<ellipse cx="${cx}" cy="${gcy.toFixed(1)}" rx="${(rad * 0.42).toFixed(1)}" ry="${rad}" fill="none" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.65"${DECORATIVE}/>` +
      `<path d="M${(cx - rad).toFixed(1)} ${gcy.toFixed(1)} H ${(cx + rad).toFixed(1)}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.65"${DECORATIVE}/>` +
      `<path d="M${(cx - rad * 0.87).toFixed(1)} ${(gcy - rad * 0.45).toFixed(1)} a ${rad * 1.15} ${rad * 1.15} 0 0 1 ${(rad * 1.74).toFixed(1)} 0" fill="none" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.45"${DECORATIVE}/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'phone') {
    // A mobile client: phone frame at the left, label beside it.
    const pw = 34;
    const px2 = r.x + 12;
    const py = r.y + 5;
    const ph = r.h - 10;
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<rect x="${px2}" y="${py}" width="${pw}" height="${ph}" rx="7" fill="var(--paper)" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${px2 + pw / 2 - 5} ${py + 6} H ${px2 + pw / 2 + 5}" stroke="${st.accent}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="${px2 + pw / 2}" cy="${py + ph - 7}" r="2" fill="${gc}"/>` +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }
  if (shape === 'window') {
    // A browser window: rounded frame, header band with traffic dots.
    const hh = 18;
    const dot = (i: number): string =>
      `<circle cx="${r.x + 12 + i * 10}" cy="${r.y + hh / 2}" r="2.6" fill="${gc}" opacity="${0.85 - i * 0.2}"/>`;
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + 9} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + hh} H ${r.x} Z" fill="${gc}" fill-opacity="0.14"/>` +
      `<path d="M${r.x} ${r.y + hh} H ${r.x + r.w}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.5"${DECORATIVE}/>` +
      dot(0) +
      dot(1) +
      dot(2) +
      nodeLabels({ name: n.name, ...tech, ...slot, nameFill: st.text, techFill: techTok, ...skinOpts }) +
      `</g>`
    );
  }

  return cardBody(n, r, st);
}

/**
 * The clean card alone (rounded, glyph, no left bar). The layered band layout
 * uses this directly: its short bands crowd the taller kind silhouettes, so
 * every node stays a calm box there.
 */
function renderCardNode(n: ShapedNode, r: Rect, accent = false): string {
  const sk = nodeSkin(n.kind);
  const st = skinPaint(sk, accent);
  const rr = pileRect(n.replicas, 'card', r);
  const body = cardBody(n, rr, st);
  const rep = replicaMarks(n.replicas, 'card', rr, st);
  return wrapBody(body, rep.back, chipFor('card', sk, rr, accent) + rep.chip);
}

function cardBody(n: ShapedNode, r: Rect, st: Paint): string {
  const gc = st.glyph;
  const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, gc, st.fill);
  const shadow = st.legacy ? ' filter="url(#gshadow)"' : '';
  const dashA = st.dashed ? ' stroke-dasharray="4 3"' : '';
  // With a chip in the top-left corner the label block centres in the space below it.
  const hasChip = !st.legacy && nodeSkin(n.kind).chip !== '';
  const slot = nodeSlot('card', r, n, hasChip, st.legacy ? undefined : n.replicas);
  const frame = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${st.legacy ? 10 : 6}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${st.sw}"${dashA}/>`;
  if (!st.legacy && isAgentCard(n.kind) && n.tech !== undefined && n.tech.trim() !== '') {
    // The agent card (`agentloop`, `flow`): the sparkle, the name, and `tech`
    // as a mono model chip under it — an agent reads as an agent at a glance.
    const nx = slot.x;
    const textW = r.x + r.w - nx - 12;
    const room = slotRoom(slot);
    const all = fitText(n.name, { width: textW, font: NAME_FONT, maxLines: NAME_MAX_LINES });
    const fitLines = Math.max(1, Math.floor((room - 4 - 13) / NAME_LH));
    const name = all.lines.length <= fitLines ? all : fitText(n.name, { width: textW, font: NAME_FONT, maxLines: fitLines });
    if (name.truncated) {
      reportCut({ path: n.path !== undefined ? `${n.path}.name` : undefined, field: 'name', full: name.full, hint: 'Shorten `name`.' });
    }
    // The model chip cuts a long model id with "…" and a `<title>` (see `modelChipSvg`).
    if (Math.max(4, Math.floor((textW - 12) / 5.6)) < n.tech.length) {
      reportCut({ path: n.path !== undefined ? `${n.path}.tech` : undefined, owner: n.name, field: 'tech', full: n.tech, hint: 'Shorten `tech` to the model id.' });
    }
    const blockH = name.lines.length * NAME_LH + 4 + 13;
    let y = slotTop(slot, blockH) + 11;
    let names = '';
    name.lines.forEach((ln, i) => {
      names += `<text x="${nx}" y="${y.toFixed(1)}" class="blk-name t-name${st.focal ? ' c-accent' : ''}">${i === 0 ? cutTitle(name) : ''}${escapeHtml(ln)}</text>`;
      y += NAME_LH;
    });
    return `<g>${frame}${gl}${names}${modelChipSvg(nx, Math.round(y - 11 + 4), n.tech, textW)}</g>`;
  }
  return (
    `<g${shadow}>` +
    frame +
    gl +
    nodeLabels({
      name: n.name,
      ...(n.tech !== undefined ? { tech: n.tech } : {}),
      ...slot,
      site: { path: n.path },
      nameFill: st.text,
      techFill: st.legacy ? st.accent : 'var(--muted)',
      ...(st.legacy ? {} : { skin: true, accent: st.focal }),
    }) +
    `</g>`
  );
}

/**
 * A gateway / load balancer with no explicit `h` stretches over the rows of
 * the services it fronts: the neighbours in the adjacent column with the most
 * of them, when they sit in consecutive rows and no other node occupies the
 * bar's column across that range. The bar then reads the way system-design
 * diagrams draw it — one tall rectangle the fan-out hangs off. Explicit
 * coordinates are never moved for any other node.
 */
function spanBars<N extends { readonly id: string; readonly kind?: string | undefined; col: number; row: number; readonly w?: number | undefined; readonly h?: number | undefined }>(
  nodes: readonly N[],
  edges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
): N[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    if (!isBarKind(n.kind) || n.h !== undefined) return n;
    // Each neighbour counts once: a read and a write request from one client
    // are two edges, not two callers.
    const neighbours = [
      ...new Set(
        edges
          .filter((e) => e.from === n.id || e.to === n.id)
          .map((e) => byId.get(e.from === n.id ? e.to : e.from))
          .filter((m): m is N => m !== undefined && m.id !== n.id),
      ),
    ];
    // Group neighbours by which column they sit in; the fan-out side wins.
    const sides = new Map<number, N[]>();
    for (const m of neighbours) sides.set(m.col, [...(sides.get(m.col) ?? []), m]);
    const fan = [...sides.values()].sort((a, b) => b.length - a.length)[0];
    if (fan === undefined || fan.length < 2) return n;
    const rowsOf = [...new Set(fan.map((m) => m.row))].sort((a, b) => a - b);
    const r1 = rowsOf[0] ?? n.row;
    const r2 = rowsOf[rowsOf.length - 1] ?? n.row;
    if (r2 <= r1) return n;
    // The bar's own column must be free across the span (other than itself).
    const blocked = nodes.some(
      (m) => m.id !== n.id && m.col <= n.col + ((n.w ?? 1) - 1) && m.col + ((m.w ?? 1) - 1) >= n.col && m.row + ((m.h ?? 1) - 1) >= r1 && m.row <= r2,
    );
    if (blocked) return n;
    return { ...n, row: r1, h: r2 - r1 + 1 };
  });
}

/** The grid's cell height when every label fits, and the most it grows to. */
const BASE_CELL_H = 88;
const MAX_CELL_H = 148;

/**
 * The smallest height from `base` (in 4px steps, at most `max`) at which
 * `deficit` reports no shortfall; `max` when none does.
 */
export function growCells(base: number, max: number, deficit: (h: number) => number): number {
  let h = base;
  while (h < max && deficit(h) > 0.5) h += 4;
  return h;
}

function renderGrid(data: Data, entry: readonly string[]): { svg: string; legend: string; geometry: GeometryReport } {
  const groups = data.groups ?? [];
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  // Quick mode: with no coordinate-anchored groups, nodes missing `col`/`row`
  // trigger auto-layout of the whole graph from the edges (left-to-right).
  // Groups are positioned by explicit grid ranges, so they require coordinates.
  const quick =
    groups.length === 0 &&
    !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const dir = data.dir ?? 'LR';
  const placed =
    groups.length === 0
      ? ensureGrid(rawNodes, edges, dir)
      : rawNodes.map((n) => ({ ...n, col: n.col ?? 1, row: n.row ?? 1 }));
  const nodes = spanBars(placed, edges);
  const cellW = 178;
  // One column gap and one row gap, wide enough for every edge label.
  const cellOf = (id: string): (typeof nodes)[number] | undefined => nodes.find((n) => n.id === id);
  const { gapX, gapY } = gapsForLabels(edges, cellOf, dir, { gapX: 64, gapY: 64 }, labelSlack(edges));
  // One cell height for the grid (the Studio metadata has one): tall enough
  // for every node's whole name and tech, up to a cap; past it, labels cut.
  const cellH = growCells(BASE_CELL_H, MAX_CELL_H, (h) =>
    Math.max(
      0,
      ...nodes.map((n) =>
        shapedLabelDeficit(n, {
          x: 0,
          y: 0,
          w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
          h: (n.h ?? 1) * h + ((n.h ?? 1) - 1) * gapY,
        }),
      ),
    ),
  );
  // Declared group nesting grows the outermost panels; the pads grow with them.
  // A back edge loops around its row (column in TB): room for the loop.
  const nestPad = nestingPads(groups);
  const loop = hasBackEdge(edges, cellOf, dir) ? LOOP_PAD : 0;
  const padX = 38 + nestPad.padX + (dir === 'TB' ? loop : 0);
  const padTop = 52 + nestPad.padTop + (dir === 'LR' ? loop : 0);
  const padBot = 36 + nestPad.padBot + (dir === 'LR' ? loop : 0);
  const cols = Math.max(
    1,
    ...nodes.map((n) => (n.col ?? 1) + ((n.w ?? 1) - 1)),
    ...groups.map((g) => g.col + (g.cols ?? 1) - 1),
  );
  const rows = Math.max(
    1,
    ...nodes.map((n) => (n.row ?? 1) + ((n.h ?? 1) - 1)),
    ...groups.map((g) => g.row + (g.rows ?? 1) - 1),
  );
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: Node): { x: number; y: number; w: number; h: number } => ({
    x: xOf(n.col ?? 1),
    y: yOf(n.row ?? 1),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: (n.h ?? 1) * cellH + ((n.h ?? 1) - 1) * gapY,
  });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Grid metadata for editors (Chiltepin Studio drag-to-move / drag-to-connect):
  // inert attributes mirroring the layout constants above plus each node's
  // EFFECTIVE cell — crucial in quick mode, where the placements only exist
  // post-auto-layout.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });

  const a11y = svgName('Block diagram', data.title, [
    countPhrase(nodes.length, 'node'),
    countPhrase(edges.length, 'connection'),
  ]);
  const hues = pathHues(edges);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}${pathMarkers(hues.values())}`;

  // Group panels (shared drawing across the grid diagrams).
  s += gridGroupsSvg(groups, {
    xOf,
    yOf,
    cellW,
    cellH,
    gapX,
    gapY,
    skin: true,
    members: nodes.map((n) => ({ col: n.col ?? 1, row: n.row ?? 1, hue: nodeSkin(n.kind).hue })),
  });

  const accentId = accentNodeId(nodes, entry);
  const edgeKinds = new Set<string>();
  s += `<g${bl('edges')}>`;
  // Arrows meet the shape a kind draws (a gateway's bar, a cloud's outline);
  // routes keep clear of the whole cell plus whatever the shape overhangs.
  const bounds = { x: 0, y: 0, w: width, h: height };
  const routeNodes = nodes.map((n) => {
    const anchor = edgeAnchorRect(n.kind, rectFor(n), n.replicas, n.name);
    // A bar carries its name inside: routes and labels may use the empty
    // cell beside it. Every other shape keeps its whole cell clear.
    return { id: n.id, box: anchor, obstacle: isBarKind(n.kind) ? anchor : unionBox(rectFor(n), anchor) };
  });
  const styleOf = (e: (typeof edges)[number]): EdgeStyle & { readonly hue?: Hue } => edgeStyleOf(e, hues);
  const geo = { xOf, yOf, cellW, cellH, gapX, gapY };
  const { routes, labels } = layoutEdges(
    routeNodes,
    edges,
    edges.map((e, ei) => edgeMeta(e, ei, styleOf(e))),
    { dir, bounds, obstacles: groupLabelBoxes(groups, geo), rails: groupPanelRects(groups, geo) },
  );
  edges.forEach((e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    const st = styleOf(e);
    noteEdgeKind(edgeKinds, e.kind, st);
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`; // close the edges list container

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const place = nodeCellAttrs(n.col ?? 1, n.row ?? 1, n.w ?? 1);
    s += `<g${bp(`nodes.${ni}`)}${place}>${renderShapedNode({ ...n, path: `nodes.${ni}` }, rectFor(n), undefined, n.id === accentId)}</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  // Groups place by cells, so every node needs `col` and `row`. Nodes without
  // them all land in the first cell: one issue for the block, not one per pair.
  const unplaced = groups.length > 0 ? rawNodes.filter((n) => n.col === undefined || n.row === undefined) : [];
  const grid = geometryOf({
    nodeWord: 'node',
    edgeWord: 'edge',
    nodes: nodes.map((n, ni) => ({ id: n.id, name: n.name, path: `nodes.${ni}`, col: n.col, row: n.row, w: n.w, h: n.h })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: e.label, path: `edges.${ei}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: routeNodes.map((n) => n.obstacle),
    quick,
    dir,
    cells: unplaced.length === 0,
  });
  const geometry: GeometryReport =
    unplaced.length === 0
      ? grid
      : {
          ...grid,
          issues: [
            {
              kind: 'cell-overlap',
              path: `nodes.${rawNodes.indexOf(unplaced[0] as Node)}`,
              message: `The block has \`groups\`, but ${countPhrase(unplaced.length, 'node')} ${unplaced.length === 1 ? 'has' : 'have'} no \`col\` and \`row\`, so they stack in one cell.`,
              hint: 'Groups need `col` and `row` on every node. Add them, or remove `groups` to get auto-layout.',
            },
            ...grid.issues,
          ],
        };
  return {
    svg: s + labels.legend,
    legend: blockLegend(nodes, edgeKinds, accentId !== undefined, hasReplicas(nodes), hues),
    geometry,
  };
}

/** What the label layer needs about one edge: its label, step, tone and data path. */
function edgeMeta(
  e: { readonly label?: string | undefined; readonly step?: number | undefined },
  ei: number,
  st: EdgeStyle & { readonly hue?: Hue },
): { label: string | undefined; err: boolean; path: string; step?: number; hue?: Hue } {
  return {
    label: e.label,
    err: st.err,
    path: `edges.${ei}`,
    ...(e.step !== undefined ? { step: e.step } : {}),
    ...(st.hue !== undefined ? { hue: st.hue } : {}),
  };
}

/**
 * Records an edge's style for the legend. A solid edge on a named path is
 * explained by its path entry, so it adds no "calls" entry of its own.
 */
function noteEdgeKind(kinds: Set<string>, kind: string | undefined, st: { readonly hue?: Hue }): void {
  const k = kind ?? 'solid';
  const known = k in SKIN_EDGE ? k : 'solid';
  if (known === 'solid' && st.hue !== undefined) return;
  kinds.add(known);
}

/** True when any node draws the replica stack. */
function hasReplicas(nodes: readonly { readonly replicas?: number | undefined }[]): boolean {
  return nodes.some((n) => n.replicas !== undefined && n.replicas >= 2);
}

/** Gap between two nodes of one layer band when the diagram has edges: room for a routing channel. */
const LAYER_ROUTE_GAP = 44;

function renderLayered(data: Data, entry: readonly string[]): { svg: string; legend: string; geometry: GeometryReport } {
  const layers = data.layers ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const byLayer: Node[][] = layers.map((_, i) =>
    nodes.filter((n) => (n.layer ?? 0) === i),
  );
  const outerPad = 28;
  // Extra bottom padding under the system label so the first band doesn't crowd it.
  const titleH = data.systemLabel !== undefined ? 46 : 16;
  const labelW = 132;
  const bandPadX = 16;
  const bandPadY = 14;
  const bandGap = 12;
  const nodeW = 158;
  // One card height for every band: tall enough for the longest name and tech.
  const nodeH = growCells(64, 112, (h) =>
    Math.max(0, ...nodes.map((n) => shapedLabelDeficit(n, { x: 0, y: 0, w: nodeW, h }, true))),
  );
  // Nodes in a band sit close; with edges the gap leaves a routing channel
  // between them, and a label on an edge between two band neighbours fits.
  const layerOf = new Map(nodes.map((n) => [n.id, n.layer ?? 0]));
  const sameBandLabel = Math.max(
    0,
    ...edges
      .filter((e) => e.label !== undefined && e.label !== '' && layerOf.get(e.from) === layerOf.get(e.to))
      .map((e) => labelBox(e.label ?? '').w + LABEL_RUN + (e.step !== undefined ? STEP_W : 0)),
  );
  // An edge that skips a layer, goes back up, or stays in its layer runs down
  // the channels between the nodes: each such edge widens them by one track.
  const channelEdges = edges.filter((e) => {
    const d = (layerOf.get(e.to) ?? 0) - (layerOf.get(e.from) ?? 0);
    return d !== 1;
  }).length;
  const routeGap = LAYER_ROUTE_GAP + 8 * Math.min(6, Math.max(0, channelEdges - 1));
  const nodeGap = edges.length > 0 ? Math.max(routeGap, sameBandLabel) : 22;
  const rowW = (c: number): number => c * nodeW + (c - 1) * nodeGap;
  const contentW = Math.max(220, ...byLayer.map((a) => rowW(Math.max(a.length, 1))));
  const bandInnerW = contentW + bandPadX * 2;
  const bandH = nodeH + bandPadY * 2;
  const innerX = outerPad + 14;
  const contentX = innerX + labelW;
  const width = contentX + bandInnerW + 14 + outerPad;
  const top = outerPad + titleH;
  const bandY = (i: number): number => top + i * (bandH + bandGap);
  // Inner bottom padding so the last band doesn't touch the dashed boundary.
  const innerBot = 16;
  const height = bandY(layers.length) - bandGap + innerBot + outerPad;

  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  byLayer.forEach((arr, i) => {
    const startX = contentX + (bandInnerW - rowW(arr.length)) / 2;
    arr.forEach((n, j) => {
      rects.set(n.id, {
        x: startX + j * (nodeW + nodeGap),
        y: bandY(i) + bandPadY,
        w: nodeW,
        h: nodeH,
      });
    });
  });

  const a11y = svgName('Layered architecture', data.title, [
    countPhrase(layers.length, 'layer'),
    countPhrase(nodes.length, 'node'),
  ]);
  const hues = pathHues(edges);
  let s =
    `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}${pathMarkers(hues.values())}` +
    // The system boundary: a dashed hairline, the label as an eyebrow.
    `<rect x="${outerPad}" y="${outerPad}" width="${width - outerPad * 2}" height="${height - outerPad * 2}" rx="8" fill="none" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>`;
  if (data.systemLabel !== undefined) {
    s += `<text x="${outerPad + 14}" y="${outerPad + 18}" class="grp-label t-eyebrow c-muted"${bp('systemLabel')}>${escapeHtml(data.systemLabel)}</text>`;
  }
  const accentId = accentNodeId(nodes, entry);
  const edgeKinds = new Set<string>();
  // A band takes a hue the way a group does: the one the author names
  // (`color: teal`), else the family most of its nodes share, else the next
  // free hue — so neighbouring bands differ. A hex keeps the legacy tint.
  const bandHues = assignPanelHues(
    layers.map((L) => L.color),
    layers.map((_, i) => dominantHue(nodes.filter((n) => (n.layer ?? 0) === i).map((n) => nodeSkin(n.kind).hue))),
  );
  s += `<g${bl('layers')}>`;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L === undefined) continue;
    const hue = bandHues[i];
    // An explicit hex is the author's data and tints the label and outline;
    // a hue paints the band's tint and its label.
    const tint = hue === undefined ? safeColor(L.color, '') : '';
    const stroke = tint.length > 0 ? tint : 'var(--rule-solid)';
    const text = tint.length > 0 ? tint : 'var(--soft)';
    const fill = hue !== undefined ? hueTint(hue) : 'var(--paper-2)';
    // Wrap the band label to the lines the band holds, inside the label column.
    const lbl = fitText(L.label, {
      width: labelW - 24,
      font: FONT.eyebrow,
      maxLines: Math.max(3, Math.floor((bandH - 20) / 12)),
      report: { path: `layers.${i}.label`, field: 'label', hint: 'Shorten the layer `label`.' },
    });
    const lblText = lbl.lines
      .map(
        (ln, j) =>
          `<text x="${innerX + 12}" y="${(bandY(i) + 16 + j * 12).toFixed(1)}" class="layer-label t-eyebrow${hueClass(hue)}"${hue === undefined ? ` fill="${text}"` : ''}>${j === 0 ? cutTitle(lbl) : ''}${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`layers.${i}`)}>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW + bandInnerW}" height="${bandH}" rx="6" fill="${fill}" fill-opacity="0.6" stroke="${stroke}" stroke-width="1"/>` +
      lblText +
      `</g>`;
  }
  s += `</g>`; // close the layers list container

  s += `<g${bl('edges')}>`;
  // Layers stack top to bottom: route as a TB flow around every node card.
  const bounds = { x: 0, y: 0, w: width, h: height };
  const styleOf = (e: (typeof edges)[number]): EdgeStyle & { readonly hue?: Hue } => edgeStyleOf(e, hues);
  const { routes, labels } = layoutEdges(
    [...rects.entries()].map(([id, box]) => ({ id, box })),
    edges,
    edges.map((e, ei) => edgeMeta(e, ei, styleOf(e))),
    { dir: 'TB', bounds },
  );
  edges.forEach((e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    const st = styleOf(e);
    noteEdgeKind(edgeKinds, e.kind, st);
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`; // close the edges list container

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rects.get(n.id);
    if (r === undefined) return;
    s += `<g${bp(`nodes.${ni}`)}>${renderCardNode({ ...n, path: `nodes.${ni}` }, r, n.id === accentId)}</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const geometry = geometryOf({
    nodeWord: 'node',
    edgeWord: 'edge',
    nodes: nodes.map((n, ni) => ({ id: n.id, name: n.name, path: `nodes.${ni}` })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: e.label, path: `edges.${ei}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: [...rects.values()],
    quick: false,
    dir: 'TB',
    cells: false,
  });
  return {
    svg: s + labels.legend,
    legend: blockLegend(nodes, edgeKinds, accentId !== undefined, hasReplicas(nodes), hues),
    geometry,
  };
}

/** Lays out a block graph (layered or grid) — the SVG, legend and geometry. */
function layoutBlockGraph(data: Data, entry: readonly string[]): { svg: string; legend: string; geometry: GeometryReport } {
  if (data.layers !== undefined && data.layers.length > 0) return renderLayered(data, entry);
  return autoDir(data, data.nodes ?? [], (d) => renderGrid(d, entry), (r) => r.svg);
}

/** Geometry report for a `block` block (see `geometryReport`). */
export function blockGeometry(data: BlockDataMap['block']): GeometryReport {
  return layoutBlockGraph(data, PRESET_FRAME[data.preset ?? 'arch'].entry).geometry;
}

function renderBlockGraph(data: Data, frame: FrameOpts): string {
  const { svg, legend } = layoutBlockGraph(data, frame.entry);
  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: frame.tag,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(legend.length > 0 ? { legendHtml: legend } : {}),
  };
  return diagramFrame(opts, svg);
}

/**
 * Eyebrow word + entry kinds per `preset` — the ONLY things that ever differed
 * between the former `block` / `infra` / `event` / `ddd` / `network` types.
 * No preset = the generic architecture look (the old bare `block`). The
 * presets keep their meaning through chips and dash, never hue.
 */
const PRESET_FRAME: Record<'arch' | NonNullable<Data['preset']>, FrameOpts> = {
  arch: { tag: 'ARCH', entry: ['gateway'] },
  infra: { tag: 'INFRA', entry: ['gateway'] },
  event: { tag: 'EVENT', entry: ['producer'] },
  ddd: { tag: 'DDD', entry: [] },
  network: { tag: 'ZONES', entry: ['gateway', 'firewall', 'waf', 'shield'] },
  // Kubernetes: namespaces are groups; the ingress is the entry.
  k8s: { tag: 'K8S', entry: ['ingress', 'gateway'] },
};

/** `block` block — generic architecture (grid or layered); `preset` picks the eyebrow + entry kind. */
export function renderBlock(data: BlockDataMap['block']): string {
  return renderBlockGraph(data, PRESET_FRAME[data.preset ?? 'arch']);
}
