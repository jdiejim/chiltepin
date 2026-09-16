/**
 * Renders a flowchart — decision diamonds, stadium start/end nodes, rectangles
 * for processes (with an eyebrow chip for the AI kinds: agent, llm, tool,
 * human, memory), with orthogonal edges.
 *
 * Skin (`DESIGN.md`): every node is paper with an ink outline; the shape
 * carries the kind. The accent goes to the `end` node(s) that are not error
 * exits — and to the edge into them — so the happy path reads at a glance.
 * Error edges (`kind: error`, or a label like "no" / "fail") are `negative`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Kind = 'start' | 'end' | 'decision' | 'process' | 'agent' | 'llm' | 'tool' | 'human' | 'memory';

/**
 * AI-workflow kinds draw as steps with an eyebrow chip, so a RAG pipeline or a
 * multi-agent hand-off reads which step is a model, a tool, a person, or a
 * store without a legend lookup. `human` is a dashed boundary (a gate outside
 * the automation); `memory` takes the store fill.
 */
const AI_CHIP: Readonly<Partial<Record<Kind, string>>> = {
  agent: 'AGENT',
  llm: 'LLM',
  tool: 'TOOL',
  human: 'HUMAN',
  memory: 'MEMORY',
};

/**
 * Deck build order (`data-reveal`): a topological walk from the `start`
 * node(s) — else from the nodes nothing points at, else the first node —
 * breadth-first along the edges, so a node appears only after everything that
 * leads to it. Nodes a cycle keeps unreachable follow in document order. An
 * edge takes the step of the later of its two ends: it appears together with
 * the node it leads to (or, for a back edge, with the node it leaves).
 */
export function flowRevealOrder(
  nodes: ReadonlyArray<{ readonly id: string; readonly kind?: Kind | undefined }>,
  edges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  const outs = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    outs.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    outs.get(e.from)?.push(e.to);
  }
  let roots = nodes.filter((n) => n.kind === 'start').map((n) => n.id);
  if (roots.length === 0) roots = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (roots.length === 0 && nodes[0] !== undefined) roots = [nodes[0].id];
  const order = new Map<string, number>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (order.has(id)) continue;
    order.set(id, order.size);
    for (const to of outs.get(id) ?? []) {
      const d = (indeg.get(to) ?? 0) - 1;
      indeg.set(to, d);
      if (d <= 0 && !order.has(to)) queue.push(to);
    }
  }
  for (const n of nodes) if (!order.has(n.id)) order.set(n.id, order.size);
  return order;
}

const ERR_LABEL_RE = /^(no|fail|failed|error|reject|rejected)\b/i;

/** Cell geometry: the node box is 150×52 inside a 160×64 cell; a decision diamond fills the cell. */
const CELL_W = 160;
const CELL_H = 64;
const NODE_W = 150;
const NODE_H = 52;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The inner SVG + legend strip (no diagram frame). */
function renderFlowSvg(data: BlockDataMap['flow']): { svg: string; legend: string } {
  const edges = data.edges ?? [];
  const groups = data.groups ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, data.dir ?? 'LR');
  const cellW = CELL_W;
  const cellH = CELL_H;
  const gapX = 56;
  const gapY = 48;
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist.
  // Declared group nesting (`parent`) grows the outermost panels outward; the
  // pads grow with them so a nested group never clips at the viewBox edge.
  const nestPad = nestingPads(groups);
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 22) + nestPad.padX;
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : 22) + nestPad.padTop;
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 18) + nestPad.padBot;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const cellFor = (n: { col: number; row: number; w?: number | undefined }): Rect => ({
    x: xOf(n.col),
    y: yOf(n.row),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  /** The drawn box: decisions fill the cell, every other shape is inset. */
  const boxFor = (n: { col: number; row: number; w?: number | undefined; kind?: Kind | undefined }): Rect => {
    const c = cellFor(n);
    if ((n.kind ?? 'process') === 'decision') return c;
    const dx = (cellW - NODE_W) / 2;
    const dy = (cellH - NODE_H) / 2;
    return { x: c.x + dx, y: c.y + dy, w: c.w - dx * 2, h: NODE_H };
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Error edges: explicit kind, or a label that reads as the failure branch.
  const isErrEdge = (e: { kind?: string | undefined; label?: string | undefined }): boolean =>
    e.kind === 'error' || ERR_LABEL_RE.test(e.label ?? '');
  // The accent: `end` nodes that no error edge reaches (and whose own label
  // does not read as a failure). Zero accent is a valid outcome.
  const errTargets = new Set(edges.filter(isErrEdge).map((e) => e.to));
  const accentIds = new Set(
    nodes
      .filter((n) => n.kind === 'end' && !errTargets.has(n.id) && !ERR_LABEL_RE.test(n.label))
      .map((n) => n.id),
  );

  // Grid metadata for editors (Chiltepin Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const a11y = svgName('Flowchart', data.title, [countPhrase(nodes.length, 'step')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}`;

  // Group panels — beneath edges and nodes. Only emitted when present.
  if (groups.length > 0) s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });

  const used = { plain: false, dashed: false, error: false, accent: false };
  const pending: EdgeLabelPoint[] = [];
  const lanes = edgeLanes(edges);
  const order = flowRevealOrder(nodes, edges);
  const stepOf = (id: string): number => order.get(id) ?? 0;
  const entries = entryPortOffsets(edges, (id) => {
    const n = byId.get(id);
    return n !== undefined ? boxFor(n) : undefined;
  });
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(boxFor(A), boxFor(B), lanes[ei] ?? 0, entries[ei] ?? 0);
    const isErr = isErrEdge(e);
    const isAccent = !isErr && accentIds.has(e.to);
    const isDashed = !isErr && e.kind === 'dashed';
    const stroke = isErr ? 'var(--negative)' : isAccent ? 'var(--accent)' : 'var(--muted)';
    const marker = isErr ? 'skErr' : isAccent ? 'skAccent' : isDashed ? 'skOpen' : 'skArrow';
    const sw = isAccent ? 1.75 : 1.5;
    const dash = isDashed ? ' stroke-dasharray="5 4"' : '';
    if (isErr) used.error = true;
    else if (isAccent) used.accent = true;
    else if (isDashed) used.dashed = true;
    else used.plain = true;
    const reveal = Math.max(stepOf(e.from), stepOf(e.to));
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash} marker-end="url(#${marker})"${bp(`edges.${ei}`)}${revealAttr(reveal)}/>`;
    pending.push({
      lx: p.lx,
      ly: p.ly,
      ...(e.label !== undefined ? { label: e.label } : {}),
      err: isErr,
      accent: isAccent,
      path: `edges.${ei}`,
      reveal,
    });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const kind: Kind = n.kind ?? 'process';
    kindsUsed.add(kind);
    const r = boxFor(n);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const accent = accentIds.has(n.id);
    const chip = AI_CHIP[kind];
    const secondary = kind === 'start' || kind === 'memory';
    const stroke = accent ? 'var(--accent)' : secondary ? 'var(--rule-solid)' : 'var(--ink)';
    const sw = accent ? 1.5 : secondary ? 1 : 1.5;
    const fill = accent ? 'var(--accent-tint)' : secondary ? 'var(--paper-2)' : 'var(--paper)';
    const dash = kind === 'human' ? ' stroke-dasharray="4 3"' : '';
    let shape: string;
    if (kind === 'decision') {
      shape = `<polygon points="${cx},${r.y} ${r.x + r.w},${cy} ${cx},${r.y + r.h} ${r.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    } else if (kind === 'start' || kind === 'end') {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
    }
    if (chip !== undefined) {
      shape += `<text x="${r.x + 8}" y="${r.y + 11}" class="blk-chip t-sub">${chip}</text>`;
    }
    // A label with a line break keeps its first line as the name and the
    // rest as a mono sublabel; otherwise the name wraps to two lines.
    const nl = n.label.indexOf('\n');
    const name = nl >= 0 ? n.label.slice(0, nl) : n.label;
    const sub = nl >= 0 ? n.label.slice(nl + 1).replace(/\s+/g, ' ').trim() : '';
    const maxChars = kind === 'decision' ? 18 : 20;
    const lines = sub.length > 0 ? wrapText(name, maxChars, 1) : wrapText(name, maxChars, 2);
    const tone = accent ? ' c-accent' : '';
    // A chip takes the top of the box; the label sits a little lower.
    const dy = chip !== undefined ? 4 : 0;
    let texts = '';
    if (sub.length > 0) {
      texts =
        `<text x="${cx}" y="${cy - 1 + dy}" class="fc-label t-name${tone}">${escapeHtml(lines[0] ?? name)}</text>` +
        `<text x="${cx}" y="${cy + 12 + dy}" class="fc-sub t-sub" text-anchor="middle">${escapeHtml(sub)}</text>`;
    } else {
      texts = lines
        .map(
          (ln, j) =>
            `<text x="${cx}" y="${cy + 4.5 + dy - (lines.length - 1) * 7.5 + j * 15}" class="fc-label t-name${tone}">${escapeHtml(ln)}</text>`,
        )
        .join('');
    }
    s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)}${revealAttr(stepOf(n.id))}>${shape}${texts}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, nodes.map((n) => boxFor(n)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (kindsUsed.has('start')) items.push({ swatch: 'node-fill2', label: 'start' });
  if (kindsUsed.has('process')) items.push({ swatch: 'node', label: 'step' });
  if (kindsUsed.has('decision')) items.push({ swatch: 'node', label: 'decision (diamond)' });
  if (kindsUsed.has('agent')) items.push({ swatch: 'node', label: 'AGENT · autonomous step' });
  if (kindsUsed.has('llm')) items.push({ swatch: 'node', label: 'LLM · model call' });
  if (kindsUsed.has('tool')) items.push({ swatch: 'node', label: 'TOOL · retrieval / API / code' });
  if (kindsUsed.has('human')) items.push({ swatch: 'node-dashed', label: 'HUMAN · review gate' });
  if (kindsUsed.has('memory')) items.push({ swatch: 'node-fill2', label: 'MEMORY · store' });
  if (kindsUsed.has('end') && [...accentIds].length < nodes.filter((n) => n.kind === 'end').length) {
    items.push({ swatch: 'node', label: 'exit' });
  }
  if (used.plain) items.push({ swatch: 'edge', label: 'next' });
  if (used.dashed) items.push({ swatch: 'edge-dashed', label: 'optional' });
  if (used.error) items.push({ swatch: 'edge-error', label: 'error path' });
  if (accentIds.size > 0) items.push({ swatch: 'node-accent', label: 'happy path' });
  return { svg: s + steps, legend: renderLegend(items) };
}

function renderFlowFrame(data: BlockDataMap['flow'], tag: string): string {
  const { svg, legend } = renderFlowSvg(data);
  return diagramFrame(
    {
      tag,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    svg,
  );
}

/**
 * `flow` — decision flow (`FLOW` eyebrow); `variant: dag` keeps the former
 * `dag` presentation (`DAG` eyebrow — pipeline / directed-acyclic graph).
 */
export function renderFlow(data: BlockDataMap['flow']): string {
  return renderFlowFrame(data, data.variant === 'dag' ? 'DAG' : 'FLOW');
}
