/**
 * Wraps block content in the figure chrome of the skin (`DESIGN.md` › Chrome
 * around a figure): a `paper-2` ground on a dot grid with a hairline border,
 * a plain `.t-eyebrow` (`SEQUENCE · GET /orders`), the title / description,
 * the drawing, then the legend strip and any footer.
 *
 * Used by every diagram-type block (sequence, erd, block, …).
 */

import type { BlockType } from 'chiltepin-core';
import { BLOCK_ALIASES } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';

interface FrameOptions {
  /** Eyebrow family word (e.g. `SEQUENCE`, `ER`, `ARCH`). */
  readonly tag: string;
  /** Optional CSS class added to the eyebrow's family word (e.g. `post`, `c4`). */
  readonly tagClass?: string;
  /**
   * @deprecated The skin has no coloured family pill; the value is ignored.
   * Kept so the renderers that have not migrated still type-check.
   */
  readonly tagBg?: string;
  /** HTTP method word after the family word — the one eyebrow part that may take `accent`. */
  readonly method?: string;
  /** Endpoint path shown after the method (`SEQUENCE · GET /orders`). */
  readonly path?: string;
  /** Title shown next to the tag (often `data.title`). Plain text. */
  readonly title?: string;
  /** Pre-rendered HTML for the title — wins over `title` if provided. */
  readonly titleHtml?: string;
  /** Optional figure number (e.g. `FIG 1.1`). */
  readonly fignum?: string;
  /** Optional description shown under the header. */
  readonly desc?: string;
  /** Pre-rendered legend strip (see `svg/legend.ts`), rendered under the drawing. */
  readonly legendHtml?: string;
  /** Optional pre-rendered HTML rendered AFTER the inner content (e.g. footers). */
  readonly footerHtml?: string;
}

/** Drawings wider than this (in viewBox units) scroll instead of shrinking. */
const WIDE_STAGE = 1600;

/**
 * The smallest scale a drawing may shrink to before its stage scrolls
 * sideways instead. At 0.62 a 13px node name still renders at 8px on a
 * phone; below that the labels stop being readable.
 */
export const MIN_STAGE_SCALE = 0.62;

const VIEWBOX_RE = /<svg\b[^>]*\bviewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) [\d.]+"[^>]*>/;

/** The `viewBox` width of the first `<svg>` in `markup` (0 when there is none). */
export function svgWidth(markup: string): number {
  const m = VIEWBOX_RE.exec(markup);
  return m?.[1] !== undefined ? Number(m[1]) : 0;
}

/**
 * The drawing's stage: the first `<svg viewBox>` in `inner` is wrapped in
 * `.diagram-stage` (the dot grid lives there, not under the text around it)
 * and capped at `max-width:min(100%, W × --scale)` — figures never upscale,
 * so a small diagram stays small and a wide one fills the column. Decks set
 * `--scale` on the slide root.
 */
function stageSvg(inner: string): string {
  const m = VIEWBOX_RE.exec(inner);
  if (m === null || m[1] === undefined) return inner;
  const tag = m[0];
  if (tag.includes(' style=')) return inner;
  const w = Math.ceil(Number(m[1]));
  if (!Number.isFinite(w) || w <= 0) return inner;
  const close = inner.indexOf('</svg>', m.index + tag.length);
  if (close < 0) return inner;
  // A drawing wider than the column would otherwise shrink to fit — past
  // ~1600 units that means 10px labels at half size, unreadable. Such a
  // drawing keeps its natural width and the stage scrolls sideways instead;
  // print falls back to fit-to-page (see the print rules in css.ts).
  // Every other drawing shrinks to fit, but never below MIN_STAGE_SCALE: on
  // a narrow screen the stage scrolls (with an edge fade) instead of drawing
  // 5px labels. Print and slides drop the floor (css.ts).
  const wide = w > WIDE_STAGE;
  const floor = Math.round(w * MIN_STAGE_SCALE);
  const capped = wide
    ? `${tag.slice(0, -1)} style="width:calc(${w}px * var(--scale,1));max-width:none">`
    : `${tag.slice(0, -1)} style="max-width:min(100%,calc(${w}px * var(--scale,1)));min-width:${floor}px">`;
  const end = close + '</svg>'.length;
  return (
    inner.slice(0, m.index) +
    `<div class="diagram-stage${wide ? ' diagram-stage--wide' : ''}">` +
    capped +
    inner.slice(m.index + tag.length, end) +
    `</div>` +
    inner.slice(end)
  );
}

/** How every framed block's HTML starts: the card, then its head row. */
const FRAME_HEAD = '<div class="diagram"><div class="diagram-head">';

/**
 * Puts a figure caption (a pre-rendered `.diagram-title` span) into the head
 * row of a framed block — the slot a page-level title fills. Returns
 * `undefined` when `html` is not a frame, or when its head already carries a
 * title; the caller then sets the caption above the block instead.
 */
export function withFrameCaption(html: string, captionHtml: string): string | undefined {
  if (!html.startsWith(FRAME_HEAD)) return undefined;
  const rest = html.slice(FRAME_HEAD.length);
  const headEnd = rest.indexOf('</div>');
  if (headEnd < 0 || rest.slice(0, headEnd).includes('diagram-title')) return undefined;
  return FRAME_HEAD + captionHtml + rest;
}

/** Wraps the given inner HTML in a `.diagram` card. */
export function diagramFrame(opts: FrameOptions, inner: string): string {
  const tagClass = opts.tagClass !== undefined ? ` ${opts.tagClass}` : '';
  const method =
    opts.method !== undefined && opts.method.length > 0
      ? `<span class="diagram-tag-sep">·</span>` +
        `<span class="diagram-tag-method${tagClass}">${escapeHtml(opts.method)}</span>`
      : '';
  const path =
    opts.path !== undefined && opts.path.length > 0
      ? `<span class="diagram-tag-path">${escapeHtml(opts.path)}</span>`
      : '';
  const eyebrow =
    `<span class="diagram-eyebrow t-eyebrow">` +
    `<span class="diagram-tag${tagClass}">${escapeHtml(opts.tag)}</span>` +
    method +
    path +
    `</span>`;
  const titleHtml =
    opts.titleHtml !== undefined
      ? `<span class="diagram-title">${opts.titleHtml}</span>`
      : opts.title !== undefined && opts.title.length > 0
        ? `<span class="diagram-title">${escapeHtml(opts.title)}</span>`
        : '';
  const fignumHtml =
    opts.fignum !== undefined && opts.fignum.length > 0
      ? `<span class="diagram-fignum">${escapeHtml(opts.fignum)}</span>`
      : '';
  // Every frame caller passes `data.description` — tagging it here gives all
  // framed diagram blocks a clickable description at once.
  const descHtml =
    opts.desc !== undefined && opts.desc.length > 0
      ? `<p class="diagram-desc"${bp('description')}>${escapeHtml(opts.desc)}</p>`
      : '';
  const legendHtml = opts.legendHtml ?? '';
  const footerHtml = opts.footerHtml ?? '';
  return (
    `<div class="diagram">` +
    `<div class="diagram-head">` +
    eyebrow +
    titleHtml +
    fignumHtml +
    `</div>` +
    descHtml +
    stageSvg(inner) +
    legendHtml +
    footerHtml +
    `</div>`
  );
}

/**
 * Per-block-type label shown in `SECTION NN · LABEL`.
 *
 * Typed as `Record<BlockType, string>` so adding a new block type without a
 * label is a compile error — the same exhaustiveness guarantee the block
 * registry gives the renderers.
 */
export const SECTION_LABEL: Record<BlockType, string> = {
  meta: '',
  callout: 'Note',
  table: 'Comparison',
  sequence: 'Sequence',
  erd: 'Entity model',
  userstory: 'User story',
  timeline: 'Roadmap',
  kanban: 'Board',
  prose: 'Overview',
  glossary: 'Glossary',
  proscons: 'Trade-offs',
  cvt: 'Before / after',
  stats: 'Metrics',
  code: 'Code',
  agenda: 'Agenda',
  tree: 'Hierarchy',
  pyramid: 'Pyramid',
  flow: 'Flowchart',
  state: 'State machine',
  dfd: 'Data flow',
  journey: 'Journey',
  gantt: 'Schedule',
  graph: 'Graph',
  quadrant: 'Matrix',
  swimlane: 'Process',
  c4: 'C4 model',
  uml: 'Class model',
  frontend: 'Component tree',
  cluster: 'Cluster',
  block: 'Architecture',
  felogic: 'Frontend logic',
  wireframe: 'Mockup',
  endpoint: 'API endpoint',
  pullquote: 'Quote',
  layers: 'Layers',
  matrix: 'Capability matrix',
  anatomy: 'Anatomy',
  composition: 'Composition',
  drivers: 'Drivers',
  options: 'Options',
  spec: 'Spec',
  list: 'List',
  stories: 'User stories',
  pattern: 'Pattern',
  gallery: 'Gallery',
  chart: 'Chart',
  figure: 'Figure',
  steps: 'Steps',
  faq: 'FAQ',
  envelope: 'Capacity math',
  slo: 'Service objectives',
  swot: 'SWOT',
  okr: 'Objectives',
  persona: 'Personas',
  changelog: 'Changelog',
  team: 'Team',
  heatmap: 'Heatmap',
  scorecard: 'Decision matrix',
  risk: 'Risk register',
  palette: 'Palette',
  typescale: 'Type scale',
  dodont: 'Guidelines',
  inventory: 'Inventory',
  array: 'Array',
  linkedlist: 'Linked list',
  bintree: 'Binary tree',
  hashmap: 'Hash map',
  agentloop: 'Agent loop',
  trace: 'Trace',
  prompt: 'Prompt',
  context: 'Context window',
  archmap: 'Architecture map',
  divider: 'Divider',
  bignumber: 'Big number',
  takeaways: 'Takeaways',
  statustable: 'Status',
  cycle: 'Cycle',
  benchmark: 'Benchmark',
  sankey: 'Flow volumes',
  gitgraph: 'Branch model',
  treemap: 'Composition',
  packet: 'Wire format',
  venn: 'Overlap',
  wardley: 'Strategy map',
  harvey: 'Comparison',
  scqa: 'Summary',
  scenarios: 'Scenarios',
  fishbone: 'Cause & effect',
  storymap: 'Story map',
  eventcontract: 'Event contract',
  saga: 'Saga',
  slopegraph: 'Before / after',
  spans: 'Trace',
  rollout: 'Rollout',
  perfbudget: 'Performance budget',
  percentiles: 'Latency percentiles',
  timing: 'Timing diagram',
  threatmodel: 'Threat model',
  neuralnet: 'Neural net',
  mindmap: 'Mind map',
  usecase: 'Use cases',
  pkg: 'Packages',
  audit: 'Audit findings',
  checklist: 'Checklist',
  modelcard: 'Model card',
  chevrons: 'Process',
  roadmap: 'Roadmap',
};

/**
 * The `SECTION NN · LABEL` eyebrow text for a segment. Aliased fences (an
 * `infra` fence parsing to `block`, a `waterfall` fence parsing to `chart`, …)
 * keep the eyebrow their old type rendered with — `sourceType` carries the tag
 * as written, and the alias table carries its historical section label.
 */
export function sectionLabelFor(seg: {
  readonly kind: BlockType;
  readonly sourceType?: string;
  readonly data?: unknown;
}): string {
  if (seg.sourceType !== undefined) {
    const alias = BLOCK_ALIASES[seg.sourceType];
    if (alias !== undefined) return alias.sectionLabel;
  }
  // `felogic` draws backend logic too: `variant: be` is the former `belogic`.
  if (seg.kind === 'felogic' && (seg.data as { variant?: unknown } | null | undefined)?.variant === 'be') {
    return 'Backend logic';
  }
  return SECTION_LABEL[seg.kind];
}
