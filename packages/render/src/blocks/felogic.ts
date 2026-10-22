/**
 * Frontend / backend module-graph rendering — design-pattern nodes (engine,
 * interface, strategy, controller, service, repo, worker, middleware, model,
 * db, cache, queue, hook, store, external) as module cards.
 *
 * Backs `felogic` (with `variant: be` for the former `belogic` framing).
 *
 * Skin (`DESIGN.md`): a module is a paper card with an ink outline and an
 * eyebrow chip for its pattern role (`ENGINE`, `INTERFACE`, `CONTROLLER`, …);
 * `interface` is dashed (a contract, not a body); `middleware` and `state`
 * sit on the inactive fill. Data, transport and external nodes borrow the
 * block family's shapes (cylinder, pipe, stack, cloud). Edges follow the
 * stroke table: `uses` solid, `implements` dashed with the UML hollow
 * triangle, `reads` dashed with an open head, `async` dotted, network calls
 * (`egress` / `https` / `api`) in `link`.
 *
 * Accent rule: the single entry module — `engine` / `core` on the frontend
 * variant, `controller` / `handler` / `route` on `variant: be`. Two or more
 * candidates, or none, means no accent.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { gapsForLabels, geometryOf, type GeometryReport } from '../svg/geometry.js';
import { nodeSkin } from '../svg/blockStyle.js';
import type { Hue } from '../svg/hues.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { edgeAnchorRect, growCells, renderShapedNode, shapedLabelDeficit } from './blockGraph.js';
import { cutTitle, fitStack, FONT, reportCut, type FittedStack } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { declaredNesting, nestingPads } from '../svg/gridGroups.js';

type Data = BlockDataMap['felogic'];
type Group = NonNullable<Data['groups']>[number];
type Node = NonNullable<Data['nodes']>[number];

/**
 * Every module `kind` {@link feSkin} styles specially (plus `component`, the
 * default) — the canonical dropdown of documented kinds for `felogic` /
 * `belogic` nodes. Keep it in sync when adding a case below.
 */
export const KNOWN_LOGIC_KINDS: readonly string[] = [
  'component',
  'engine', 'core',
  'interface',
  'strategy', 'impl',
  'adapter',
  'controller', 'handler', 'route',
  'gateway',
  'service', 'usecase',
  'apiclient', 'client',
  'repository', 'repo', 'dao',
  'worker', 'consumer',
  'middleware',
  'model', 'entity',
  'db', 'store', 'database',
  'cache',
  'queue', 'bus', 'broker',
  'state',
  'hook',
  'external', 'backend', 'egress', 'api', 'thirdparty',
];

/** How the skin draws one module card. */
interface FeSkin {
  readonly chip: string;
  readonly primary: boolean;
  readonly fill: 'paper' | 'paper-2';
  readonly dashed: boolean;
}

const card = (chip: string): FeSkin => ({ chip, primary: true, fill: 'paper', dashed: false });
const inactive = (chip: string): FeSkin => ({ chip, primary: false, fill: 'paper-2', dashed: false });

function feSkin(kind: string | undefined): FeSkin {
  const k = (kind ?? 'component').toLowerCase();
  switch (k) {
    case 'component':
      return card('');
    case 'engine':
    case 'core':
      return card('ENGINE');
    case 'interface':
      return { chip: 'INTERFACE', primary: true, fill: 'paper', dashed: true };
    case 'strategy':
    case 'impl':
      return card('STRATEGY');
    case 'adapter':
      return card('ADAPTER');
    case 'controller':
    case 'handler':
    case 'route':
      return card('CONTROLLER');
    case 'gateway':
      return card('GATEWAY');
    case 'service':
    case 'usecase':
      return card('SERVICE');
    case 'apiclient':
    case 'client':
      return card('CLIENT');
    case 'repository':
    case 'repo':
    case 'dao':
      return card('REPOSITORY');
    case 'worker':
    case 'consumer':
      return card('WORKER');
    case 'middleware':
      return inactive('MIDDLEWARE');
    case 'model':
    case 'entity':
      return card('MODEL');
    case 'state':
    case 'store_state':
      return inactive('STATE');
    case 'hook':
      return card('HOOK');
    default:
      return card(k.toUpperCase());
  }
}

interface FeEdgeStyle {
  readonly stroke: string;
  readonly sw: number;
  readonly dash: string;
  readonly marker: string;
  readonly legend: 'uses' | 'implements' | 'reads' | 'async' | 'network';
}

function feEdge(kind: string | undefined): FeEdgeStyle {
  switch ((kind ?? 'uses').toLowerCase()) {
    case 'implements':
      return { stroke: 'var(--muted)', sw: 1.5, dash: '5 4', marker: 'feTri', legend: 'implements' };
    case 'egress':
    case 'https':
    case 'api':
      return { stroke: 'var(--link)', sw: 1.5, dash: '', marker: 'feLink', legend: 'network' };
    case 'reads':
    case 'dashed':
      return { stroke: 'var(--muted)', sw: 1.5, dash: '5 4', marker: 'skOpen', legend: 'reads' };
    case 'async':
      return { stroke: 'var(--muted)', sw: 1.25, dash: '2 3', marker: 'skOpen', legend: 'async' };
    default:
      return { stroke: 'var(--muted)', sw: 1.5, dash: '', marker: 'skArrow', legend: 'uses' };
  }
}

// Kinds that render with the shared shape language instead of a module card.
const SHAPE_REMAP: Record<string, string> = {
  bus: 'queue',
  backend: 'external',
  api: 'external',
  thirdparty: 'external',
  egress: 'external',
};
const SHAPED_KINDS = new Set(['db', 'store', 'database', 'queue', 'broker', 'cache', 'redis', 'external']);

const FE_NAME_LH = 15;
const FE_NOTE_LH = 12;
const FE_GAP = 3;
/** The room a module card keeps under a label block that fills it (half each side when centred). */
const FE_BOTTOM = 6;

/**
 * A module card's name and note fitted to the card below its chip: the
 * stack, where it starts, and the room it had.
 */
function feCardLabels(
  n: { readonly name: string; readonly note?: string | undefined },
  r: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  chip: boolean,
): { fit: FittedStack; top: number; room: number } {
  const top = r.y + (chip ? 20 : 8);
  const room = r.y + r.h - FE_BOTTOM - top;
  const fit = fitStack(
    { text: n.name, font: FONT.name, lineH: FE_NAME_LH, maxLines: 4 },
    n.note !== undefined ? { text: n.note, font: FONT.sub, lineH: FE_NOTE_LH, maxLines: 3 } : undefined,
    r.w - 24,
    room,
    FE_GAP,
  );
  return { fit, top, room };
}

function renderFelogicGraph(data: Data, tag: string): string {
  return layoutFelogic(data, tag).html;
}

/** Geometry report for a `felogic` block (see `geometryReport`). */
export function felogicGeometry(data: BlockDataMap['felogic']): GeometryReport {
  return layoutFelogic(data, 'LOGIC').geometry;
}

/** Lays out and draws a module graph: the framed HTML plus its geometry report. */
function layoutFelogic(data: Data, tag: string): { html: string; geometry: GeometryReport } {
  const groups = data.groups ?? [];
  const edges = data.edges ?? [];
  const dir = data.dir ?? 'LR';
  // Quick mode: with no coordinate-anchored groups, nodes missing `col`/`row`
  // trigger auto-layout of the whole graph from the edges (left-to-right).
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes =
    groups.length === 0
      ? ensureGrid(rawNodes, edges, dir)
      : rawNodes.map((n) => ({ ...n, col: n.col ?? 1, row: n.row ?? 1 }));
  const cellW = 178;
  // One column gap and one row gap, wide enough for every edge label.
  const cellOf = (id: string): (typeof nodes)[number] | undefined => nodes.find((n) => n.id === id);
  const { gapX, gapY } = gapsForLabels(edges, cellOf, dir, { gapX: 54, gapY: 60 });
  // One cell height: tall enough for every module's whole name and note, up to a cap.
  const cellH = growCells(80, 140, (h) =>
    Math.max(
      0,
      ...nodes.map((n) => {
        const r = { x: 0, y: 0, w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX, h };
        const k = SHAPE_REMAP[(n.kind ?? '').toLowerCase()] ?? (n.kind ?? '').toLowerCase();
        if (SHAPED_KINDS.has(k)) return shapedLabelDeficit({ kind: k, name: n.name, tech: n.note }, r);
        const fit = feCardLabels(n, r, feSkin(n.kind).chip !== '');
        return fit.fit.need - fit.room;
      }),
    ),
  );
  // Declared group nesting (`parent`) steps each child panel in and grows its
  // ancestors out. Two levels need more room than a single panel's 22px of
  // label headroom, so a nesting document uses the shared group overshoot and
  // grows the pads to match — the outermost tab must stay inside the viewBox.
  // With no `parent` anywhere the map is empty and the output is unchanged.
  const nesting = declaredNesting(groups);
  const nestPad = nestingPads(groups);
  const over = nesting.size > 0 ? { x: 28, top: 38, bot: 28 } : { x: 16, top: 22, bot: 16 };
  const padX = 26 + (over.x - 16) + nestPad.padX;
  const padTop = 30 + (over.top - 22) + nestPad.padTop;
  const padBot = 20 + (over.bot - 16) + nestPad.padBot;
  const cols = Math.max(
    1,
    ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)),
    ...groups.map((g) => g.col + (g.cols ?? 1) - 1),
  );
  const rows = Math.max(
    1,
    ...nodes.map((n) => n.row),
    ...groups.map((g) => g.row + (g.rows ?? 1) - 1),
  );
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: Node & { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xOf(n.col),
    y: yOf(n.row),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const groupRect = (g: Group): { x: number; y: number; w: number; h: number } => ({
    x: xOf(g.col) - over.x,
    y: yOf(g.row) - over.top,
    w: (g.cols ?? 1) * cellW + ((g.cols ?? 1) - 1) * gapX + over.x * 2,
    h: (g.rows ?? 1) * cellH + ((g.rows ?? 1) - 1) * gapY + over.top + over.bot,
  });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;
  // Largest groups first so smaller ones layer on top (index kept for paths).
  // With declared nesting, parents draw first (shallowest depth), then by area.
  const area = (g: Group): number => (g.cols ?? 1) * (g.rows ?? 1);
  const sortedGroups = groups
    .map((g, gi) => ({ g, gi }))
    .sort((a, b) =>
      nesting.size > 0
        ? (nesting.get(a.g)?.depth ?? 0) - (nesting.get(b.g)?.depth ?? 0) ||
          area(b.g) - area(a.g) ||
          a.gi - b.gi
        : area(b.g) - area(a.g),
    );

  // The accent (see the header comment).
  const entryKinds = data.variant === 'be' ? ['controller', 'handler', 'route'] : ['engine', 'core'];
  const entries0 = nodes.filter((n) => entryKinds.includes((n.kind ?? '').toLowerCase()));
  const accentId = entries0.length === 1 ? entries0[0]?.id : undefined;

  // Grid metadata for editors (Chiltepin Studio drag/connect/context menus):
  // inert attrs mirroring the layout constants plus each node's effective cell.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Module graph</title>` +
    // The network-call head in `link` — local, since the shared defs carry
    // only the muted / accent / negative heads.
    `<defs><marker id="feLink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--link)"/></marker>` +
    // `implements` carries the UML hollow triangle (the same relation as in
    // `uml`), so it never reads like a `reads` edge.
    `<marker id="feTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/></marker></defs>`;

  // A group's panel rect (nesting insets applied), its tab side and the box
  // its eyebrow tab covers.
  const panelOf = (g: Group): { r: { x: number; y: number; w: number; h: number }; tabEnd: boolean; tab: { x: number; y: number; w: number; h: number } } => {
    const raw = groupRect(g);
    // A declared child steps IN from its parent and its ancestors grow OUT, so
    // the levels never sit on each other; the tab alternates left / right per
    // level so three levels of label never collide.
    const nest = nesting.get(g);
    const r =
      nest === undefined
        ? raw
        : {
            x: raw.x + nest.inset.x,
            y: raw.y + nest.inset.y,
            w: raw.w - nest.inset.w,
            h: raw.h - nest.inset.h,
          };
    const tabEnd = nest !== undefined && nest.depth % 2 === 1;
    const tw = Math.ceil(g.label.length * 6.4) + 4;
    const tab = { x: tabEnd ? r.x + r.w - 12 - tw : r.x + 10, y: r.y + 5, w: tw, h: 13 };
    return { r, tabEnd, tab };
  };

  // Group panels — the skin's paper-2 wash with a `rule-solid` hairline and a
  // mono eyebrow tab. A group's `color` is not a stroke: boundaries never
  // borrow `link` or any hue (the tab keeps `soft`).
  s += `<g${bl('groups')}>`;
  for (const { g, gi } of sortedGroups) {
    const { r, tabEnd } = panelOf(g);
    const lbl = tabEnd
      ? `<text x="${r.x + r.w - 12}" y="${r.y + 15}" class="t-eyebrow" text-anchor="end">${escapeHtml(g.label)}</text>`
      : `<text x="${r.x + 12}" y="${r.y + 15}" class="t-eyebrow">${escapeHtml(g.label)}</text>`;
    s +=
      `<g${bp(`groups.${gi}`)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="var(--rule-solid)" stroke-width="1"/>` +
      lbl +
      `</g>`;
  }
  s += `</g>`; // close the groups list container

  // Shaped nodes (cloud/stack) anchor edges to their visible outline.
  const anchorOf = (n: Node & { col: number; row: number }): { x: number; y: number; w: number; h: number } => {
    const k = (n.kind ?? '').toLowerCase();
    return edgeAnchorRect(SHAPE_REMAP[k] ?? k, rectFor(n));
  };
  const edgeLegend = new Set<FeEdgeStyle['legend']>();
  s += `<g${bl('edges')}>`;
  // Every edge is routed around the modules, never through one, and its
  // label sits on it; routes keep off the group panels' borders and tabs.
  const bounds = { x: 0, y: 0, w: width, h: height };
  const panels = sortedGroups.map(({ g }) => panelOf(g));
  const { routes, labels } = layoutEdges(
    nodes.map((n) => ({ id: n.id, box: anchorOf(n), obstacle: rectFor(n) })),
    edges,
    edges.map((e, ei) => ({ label: e.label, path: `edges.${ei}` })),
    { dir, bounds, obstacles: panels.map((p) => p.tab), rails: panels.map((p) => p.r) },
  );
  edges.forEach((e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    const st = feEdge(e.kind);
    edgeLegend.add(st.legend);
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"${dash} marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`; // close the edges list container

  // The value is the family hue a shaped kind (store, queue, cache) carries into the legend.
  const chipsUsed = new Map<string, Hue | undefined>();
  let dashedUsed = false;
  let inactiveUsed = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const k = (n.kind ?? '').toLowerCase();
    const accent = n.id === accentId;
    // Data/transport/external nodes use the shared shape language (cylinder,
    // pipe, stack, cloud) instead of a card — same silhouettes as the block
    // family, so `payments-db` is a cylinder here too.
    const shapeKind = SHAPE_REMAP[k] ?? k;
    if (SHAPED_KINDS.has(shapeKind)) {
      const sk = nodeSkin(shapeKind);
      if (sk.chip !== '' && !chipsUsed.has(sk.chip)) chipsUsed.set(sk.chip, sk.hue);
      if (sk.dashed) dashedUsed = true;
      // A shaped store draws in its family tint, not on `paper-2`.
      if (sk.fill === 'paper-2' && sk.hue === undefined) inactiveUsed = true;
      s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)}>${renderShapedNode(
        { kind: shapeKind, name: n.name, ...(n.note !== undefined ? { tech: n.note } : {}), path: `nodes.${ni}` },
        r,
        undefined,
        accent,
      )}</g>`;
      return;
    }
    const sk = feSkin(n.kind);
    if (sk.chip !== '' && !chipsUsed.has(sk.chip)) chipsUsed.set(sk.chip, undefined);
    if (sk.dashed) dashedUsed = true;
    if (sk.fill === 'paper-2') inactiveUsed = true;
    const stroke = accent ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = accent || sk.primary ? 1.5 : 1;
    const fill = accent ? 'var(--accent-tint)' : sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
    const dashAttr = sk.dashed ? ' stroke-dasharray="4 3"' : '';
    const cardSvg = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>`;
    const chipTone = accent ? ' c-accent' : sk.fill === 'paper-2' ? ' c-muted' : '';
    const chip =
      sk.chip !== ''
        ? `<text x="${r.x + 12}" y="${r.y + 14}" class="t-eyebrow${chipTone}">${escapeHtml(sk.chip)}</text>`
        : '';
    // Name over note, centred vertically in the space below the chip; the
    // grid grew the cells for them, and what still does not fit ends in "…".
    const nx = r.x + 12;
    const { fit, top } = feCardLabels(n, r, sk.chip !== '');
    if (fit.head.truncated) {
      reportCut({ path: `nodes.${ni}.name`, field: 'name', full: fit.head.full, hint: 'Shorten `name`, or move the detail to `note`.' });
    }
    if (fit.tail.truncated) {
      reportCut({ path: `nodes.${ni}.note`, owner: n.name, field: 'note', full: fit.tail.full, hint: 'Shorten `note`, and put the rest in the prose.' });
    }
    const blockH = fit.height;
    let ty = top + (r.y + r.h - top - blockH) / 2 + FE_NAME_LH - 4;
    let labelSvg = '';
    fit.head.lines.forEach((ln, i) => {
      labelSvg += `<text x="${nx}" y="${ty.toFixed(1)}" class="t-name${accent ? ' c-accent' : ''}">${i === 0 ? cutTitle(fit.head) : ''}${escapeHtml(ln)}</text>`;
      ty += FE_NAME_LH;
    });
    if (fit.tail.lines.length > 0) {
      ty += FE_GAP - FE_NAME_LH + FE_NOTE_LH;
      fit.tail.lines.forEach((ln, i) => {
        labelSvg += `<text x="${nx}" y="${ty.toFixed(1)}" class="t-sub">${i === 0 ? cutTitle(fit.tail) : ''}${escapeHtml(ln)}</text>`;
        ty += FE_NOTE_LH;
      });
    }
    s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)}>` + cardSvg + chip + labelSvg + `</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const steps = labels.legend;
  const geometry = geometryOf({
    nodeWord: 'module',
    edgeWord: 'edge',
    nodes: nodes.map((n, ni) => ({ id: n.id, name: n.name, path: `nodes.${ni}`, col: n.col, row: n.row, w: n.w })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: e.label, path: `edges.${ei}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: nodes.map((n) => rectFor(n)),
    quick,
    dir,
  });

  const items: LegendItem[] = [];
  for (const [chip, hue] of chipsUsed) {
    items.push({ swatch: 'chip', chip, label: CHIP_LABEL[chip] ?? chip.toLowerCase(), ...(hue !== undefined ? { hue } : {}) });
  }
  if (dashedUsed) items.push({ swatch: 'node-dashed', label: 'contract / external' });
  if (inactiveUsed) items.push({ swatch: 'node-fill2', label: 'passive (state, middleware, store)' });
  if (edgeLegend.has('uses')) items.push({ swatch: 'edge', label: 'uses' });
  if (edgeLegend.has('implements')) items.push({ swatch: 'edge-implements', label: 'implements' });
  if (edgeLegend.has('reads')) items.push({ swatch: 'edge-dashed', label: 'reads / optional' });
  if (edgeLegend.has('async')) items.push({ swatch: 'edge-async', label: 'async' });
  if (edgeLegend.has('network')) items.push({ swatch: 'edge-link', label: 'network call' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'entry point' });
  const legend = renderLegend(items);

  const html = diagramFrame(
    {
      tag,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
  return { html, geometry };
}

/** Legend wording for the chips a module graph can show. */
const CHIP_LABEL: Record<string, string> = {
  ENGINE: 'engine / core',
  INTERFACE: 'interface',
  STRATEGY: 'strategy',
  ADAPTER: 'adapter',
  CONTROLLER: 'controller / route',
  GATEWAY: 'gateway',
  SERVICE: 'service / use case',
  CLIENT: 'API client',
  REPOSITORY: 'repository',
  WORKER: 'worker / consumer',
  MIDDLEWARE: 'middleware',
  MODEL: 'model / entity',
  STATE: 'state store',
  HOOK: 'hook',
  DB: 'database',
  QUEUE: 'queue / bus',
  CACHE: 'cache',
  EXT: 'external',
};

/**
 * `felogic` — module logic graph (`LOGIC` eyebrow). `variant: be` keeps the
 * former `belogic` framing: the entry module is the controller, not the engine.
 */
export function renderFelogic(data: BlockDataMap['felogic']): string {
  return renderFelogicGraph(data, 'LOGIC');
}
