/**
 * Renders a parsed {@link Document} into its composable PARTS — the CSS, the
 * variable-override string, the inner body HTML (for a `<div class="docskin">`),
 * the title, and a section index for navigation.
 *
 * {@link renderDocument} (in `document.ts`) wraps these parts into a standalone
 * `<!doctype html>` page. Embedding consumers (e.g. a React app) inject the
 * parts directly: one `<style>` with `css`, a scoped `<style>` that sets the
 * variable overrides, and the `body` inside their own `.docskin` host. This
 * avoids nesting a full HTML document inside the page and enables
 * section-level navigation (each section carries an `id`).
 */

import type { BlockDataMap, BlockType, Document, Segment, TypedSegment } from 'chiltepin-core';
import {
  isNearDuplicateTitle,
  readAlignMarker,
  readBuildMarker,
  readSourceMarker,
  stripHeadingMarkers,
  trailingHeading,
} from 'chiltepin-core';
import { houseCss } from './css.js';
import { escapeHtml } from './escape.js';
import { renderCover } from './blocks/meta.js';
import { sectionLabelFor, withFrameCaption } from './blocks/frame.js';
import { renderProse } from './markdown.js';
import {
  captionInner,
  figureAnchor,
  NON_FIGURE,
  planHeadings,
  readingStats,
  type DocumentFigure,
  type DocumentHeading,
  type DocumentOutline,
} from './outline.js';
import { bp } from './paths.js';
import { htmlRenderers } from './registry.js';
import { globalDefsSvg } from './svg/defs.js';
import { DEFAULT_THEME, themeStyle, type ThemeName } from './themes.js';

/**
 * Which token set a page shows. `dark` (the default) stamps nothing: the
 * stylesheet's own root is dark. `light` stamps `data-theme="light"` on the
 * page root. `system` lets the reader's OS choose, light or dark.
 */
export type ColorScheme = 'dark' | 'light' | 'system';

/** Options shared by {@link renderDocumentParts} and the page renderer. */
export interface RenderPartsOptions {
  /** The page's colour scheme; the parts renderer ignores it (a page-level stamp). */
  readonly colorScheme?: ColorScheme;
  /** The look. Only `textbook` (the editorial skin) exists; defaults to it. */
  readonly theme?: ThemeName;
  /**
   * Internal escape hatch: CSS-variable overrides emitted on `:root`, e.g.
   * `{ '--accent': '#123456' }`. No user-facing surface sets this.
   */
  readonly themeVars?: Readonly<Record<string, string>>;
}

/** One navigable section of a rendered document. */
export interface DocumentSection {
  /** DOM id of the `<section>` (e.g. `section-01`). */
  readonly id: string;
  /** 1-based section number. */
  readonly num: number;
  /** Section label (e.g. `Roadmap`, `Sequence`). */
  readonly label: string;
  /** The block's title, if it has one. */
  readonly title?: string;
  /** The block's user-supplied `id:` (referenceable as `doc#id`), if it has one. */
  readonly blockId?: string;
  /**
   * The stable anchor a link should use: the block `id:`, else the figure's
   * `fig-<slug>` anchor. `section-NN` renumbers when a block is inserted;
   * this does not.
   */
  readonly anchor?: string;
}

/** The composable pieces of a rendered document. */
export interface DocumentParts {
  /** Theme-independent house stylesheet. Inject once. */
  readonly css: string;
  /** Theme variable declarations (e.g. `--navy:#0f766e;`), or `''` for default. */
  readonly themeVars: string;
  /** Inner HTML for a `<div class="docskin">` host: defs + cover + sections. */
  readonly body: string;
  /** Document title (from the `meta` block). */
  readonly title: string;
  /** Section index for navigation. */
  readonly sections: readonly DocumentSection[];
  /**
   * The page's headings and numbered figures, for a table of contents.
   * Always set by {@link renderDocumentParts}; optional so a caller that
   * builds its own parts (an error page) need not invent one.
   */
  readonly outline?: DocumentOutline;
}

interface RenderCtx {
  /**
   * `page`: block titles become figure captions and headings take anchor ids.
   * `slides`: the deck's section head, unchanged — the slide header replaces it.
   */
  readonly mode: 'page' | 'slides';
  sectionNum: number;
  sections: DocumentSection[];
  /** Typed segment → the trailing heading of the prose run directly above it. */
  headingFor: WeakMap<Segment, string>;
  /** Page mode: the numbered figures so far. */
  figures: DocumentFigure[];
  /** Page mode: every anchor id already taken (block ids, headings, figures). */
  used: Set<string>;
  /** Page mode: the outline heading ids of each prose run. */
  headingIds: WeakMap<Segment, readonly string[]>;
  /** Page mode: every outline heading, in document order. */
  headings: readonly DocumentHeading[];
}

/** A context for one render pass. */
function newCtx(doc: Document, mode: 'page' | 'slides'): RenderCtx {
  const plan = mode === 'page' ? planHeadings(doc) : undefined;
  return {
    mode,
    sectionNum: 0,
    sections: [],
    headingFor: headingTitleMap(doc.segments),
    figures: [],
    used: plan?.used ?? new Set(),
    headingIds: plan?.bySegment ?? new WeakMap(),
    headings: plan?.headings ?? [],
  };
}

/**
 * "The heading titles the block": for every typed segment whose immediately
 * preceding segment is a prose run ENDING with a heading, record that heading
 * text. The section head then suppresses a near-duplicate block `title` (no
 * more two stacked headings saying the same thing), and a title-less block
 * inherits the heading for the sections nav — so the Markdown heading is the
 * one place a title needs to be written.
 */
function headingTitleMap(segments: readonly Segment[]): WeakMap<Segment, string> {
  const map = new WeakMap<Segment, string>();
  for (let i = 0; i < segments.length - 1; i++) {
    const prose = segments[i];
    const next = segments[i + 1];
    if (prose === undefined || next === undefined) continue;
    if (prose.kind !== 'markdown' || next.kind === 'markdown') continue;
    const heading = trailingHeading(prose.text);
    if (heading !== undefined) map.set(next, heading.text);
  }
  return map;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Blocks whose `title` is the visual centerpiece — the section head must not
 * lift it (the block renders it itself at presentation scale).
 */
const OWNS_TITLE: ReadonlySet<BlockType> = new Set(['divider', 'takeaways', 'callout']);

/** Reads optional title/lede from a block's data, defensively typed. */
function readTitleAndLede(data: unknown): { title?: string; lede?: string } {
  if (data === null || typeof data !== 'object') return {};
  const d = data as { title?: unknown; lede?: unknown };
  const out: { title?: string; lede?: string } = {};
  if (typeof d.title === 'string' && d.title.length > 0) out.title = d.title;
  if (typeof d.lede === 'string' && d.lede.length > 0) out.lede = d.lede;
  return out;
}

function renderSectionHead(num: number, label: string, title?: string, lede?: string): string {
  const eyebrow = `<div class="section-num">SECTION ${pad2(num)} · ${escapeHtml(label)}</div>`;
  // A bare head (no title, no lede — untitled blocks and OWNS_TITLE blocks like
  // divider/takeaways) keeps only a quiet eyebrow: no empty h2, no rule band —
  // otherwise it stacks a second rule under the preceding markdown heading.
  if (title === undefined && lede === undefined) {
    return `<div class="section-head bare">${eyebrow}</div>`;
  }
  // The section head owns the block's top-level title/lede — tag them here so
  // clicking the heading or intro paragraph edits the right field on EVERY block.
  const titleHtml =
    title !== undefined
      ? `<h2 class="section-title"${bp('title')}>${escapeHtml(title)}</h2>`
      : '';
  const ledeHtml =
    lede !== undefined ? `<p class="section-lede"${bp('lede')}>${escapeHtml(lede)}</p>` : '';
  return `<div class="section-head">` + eyebrow + titleHtml + ledeHtml + `</div>`;
}

/**
 * Dispatches a typed block to its renderer. The registry is keyed by the same
 * `BlockType` discriminant as the segment, so this single contained cast asserts
 * the invariant rather than leaking casts to every call site.
 */
function dispatchBlock<K extends BlockType>(kind: K, data: BlockDataMap[K]): string {
  const fn = htmlRenderers[kind] as (data: BlockDataMap[K]) => string;
  return fn(data);
}

function renderTypedSegment(seg: TypedSegment, ctx: RenderCtx): string {
  if (seg.kind === 'meta') return '';
  if (seg.parseError !== undefined) {
    return `<div class="err">${escapeHtml(seg.kind)} block — parse error:\n${escapeHtml(seg.parseError)}</div>`;
  }
  if (seg.data === null || seg.data === undefined) return '';

  if (ctx.mode === 'page') return renderPageSection(seg, ctx);
  const { title, lede } = readTitleAndLede(seg.data);
  // The section head owns the title at the top level — strip it from the data
  // so the block's own header doesn't repeat it (nested renders, e.g. gallery
  // cells, go through the registry directly and keep theirs). Blocks in
  // OWNS_TITLE render the title themselves (it IS the visual), so it stays.
  const ownsTitle = OWNS_TITLE.has(seg.kind);
  const bodyData =
    !ownsTitle && title !== undefined && typeof seg.data === 'object'
      ? { ...(seg.data as Record<string, unknown>), title: undefined }
      : seg.data;
  const body = dispatchBlock(seg.kind, bodyData as BlockDataMap[typeof seg.kind]);

  // The heading directly above titles this block: a near-duplicate block
  // `title` is suppressed visually (the heading already says it), and a
  // title-less block inherits the heading text for the sections nav.
  const heading = ctx.headingFor.get(seg);
  const dupOfHeading =
    !ownsTitle && title !== undefined && heading !== undefined && isNearDuplicateTitle(heading, title);
  const navTitle = title ?? (!ownsTitle ? heading : undefined);

  ctx.sectionNum += 1;
  const num = ctx.sectionNum;
  const id = `section-${pad2(num)}`;
  ctx.sections.push({
    id,
    num,
    label: sectionLabelFor(seg),
    ...(navTitle !== undefined ? { title: navTitle } : {}),
    ...(seg.id !== undefined ? { blockId: seg.id } : {}),
  });
  const head = renderSectionHead(
    num,
    sectionLabelFor(seg),
    ownsTitle || dupOfHeading ? undefined : title,
    lede,
  );

  // A section can't carry two DOM ids: `section-NN` stays on the <section>
  // (existing nav consumers rely on it) and the block's user `id:` lands on a
  // nested zero-height anchor span, so `#<id>` links (ref chips) resolve.
  const anchor =
    seg.id !== undefined
      ? `<span class="block-anchor" id="${escapeHtml(seg.id)}" aria-hidden="true"></span>`
      : '';
  const dataId = seg.id !== undefined ? ` data-block-id="${escapeHtml(seg.id)}"` : '';

  return `<section id="${id}" class="section-block"${dataId}>${anchor}${head}${body}</section>`;
}

/** Lowercase letters and digits only, so near-identical titles compare equal. */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * True when a caption title says nothing the heading above does not: the
 * heading contains it. A title MORE specific than its heading ("Single-write
 * rollout" under "## Rollout") keeps its words.
 */
export function captionRepeatsHeading(heading: string, title: string): boolean {
  const h = squash(heading);
  const t = squash(title);
  return t.length > 0 && h.includes(t);
}

/**
 * A block on a page: the author's headings are the document's headings, so
 * the block's `title` becomes its figure caption — "Fig. N · title" in the
 * frame's head row, or a caption line above a block that has no frame. The
 * `lede` is a one-line takeaway above the figure. No `SECTION NN` eyebrow.
 */
function renderPageSection(seg: TypedSegment, ctx: RenderCtx): string {
  if (seg.data === null || seg.data === undefined) return '';
  const { title, lede } = readTitleAndLede(seg.data);
  const ownsTitle = OWNS_TITLE.has(seg.kind);
  const bodyData =
    !ownsTitle && title !== undefined && typeof seg.data === 'object'
      ? { ...(seg.data as Record<string, unknown>), title: undefined }
      : seg.data;
  let body = dispatchBlock(seg.kind, bodyData as BlockDataMap[typeof seg.kind]);

  const heading = ctx.headingFor.get(seg);
  const dupOfHeading =
    !ownsTitle && title !== undefined && heading !== undefined && captionRepeatsHeading(heading, title);
  const navTitle = title ?? (!ownsTitle ? heading : undefined);

  ctx.sectionNum += 1;
  const num = ctx.sectionNum;
  const id = `section-${pad2(num)}`;

  // The caption: numbered for a figure, a plain label for a narrative block.
  let caption = '';
  let anchor = seg.id;
  let figure = false;
  if (!ownsTitle && title !== undefined) {
    figure = !NON_FIGURE.has(seg.kind);
    // A narrative label that repeats the heading above says nothing new.
    if (figure || !dupOfHeading) {
      const capId = seg.id === undefined ? figureAnchor(title, ctx.used) : undefined;
      anchor = seg.id ?? capId;
      const figNum = figure ? ctx.figures.length + 1 : undefined;
      if (figNum !== undefined && anchor !== undefined) {
        ctx.figures.push({ num: figNum, title, anchor, sectionId: id });
      }
      const inner = captionInner(figNum, dupOfHeading ? undefined : title);
      const idAttr = capId !== undefined ? ` id="${escapeHtml(capId)}"` : '';
      const framed = withFrameCaption(body, `<span class="diagram-title fig-caption"${idAttr}>${inner}</span>`);
      if (framed !== undefined) body = framed;
      else caption = `<p class="fig-caption${figure ? '' : ' is-label'}"${idAttr}>${inner}</p>`;
    }
  }
  ctx.sections.push({
    id,
    num,
    label: sectionLabelFor(seg),
    ...(navTitle !== undefined ? { title: navTitle } : {}),
    ...(seg.id !== undefined ? { blockId: seg.id } : {}),
    ...(anchor !== undefined ? { anchor } : {}),
  });
  const ledeHtml =
    lede !== undefined ? `<p class="section-lede"${bp('lede')}>${escapeHtml(lede)}</p>` : '';
  const blockAnchor =
    seg.id !== undefined
      ? `<span class="block-anchor" id="${escapeHtml(seg.id)}" aria-hidden="true"></span>`
      : '';
  const dataId = seg.id !== undefined ? ` data-block-id="${escapeHtml(seg.id)}"` : '';
  const cls = figure ? 'section-block is-figure' : 'section-block';
  return `<section id="${id}" class="${cls}"${dataId}>${blockAnchor}${ledeHtml}${caption}${body}</section>`;
}

function renderSegment(seg: Segment, ctx: RenderCtx): string {
  if (seg.kind === 'markdown') return renderProse(seg.text, ctx.headingIds.get(seg) ?? []);
  return renderTypedSegment(seg, ctx);
}

/** Builds the `:root` variable declaration string (look + internal overrides). */
export function buildThemeVars(
  theme: ThemeName,
  vars?: Readonly<Record<string, string>>,
): string {
  let css = themeStyle(theme);
  if (vars !== undefined) {
    for (const k of Object.keys(vars)) css += `${k}:${vars[k]};`;
  }
  return css;
}

/** One rendered segment, index-aligned with `doc.segments`. */
export interface RenderedSegment {
  /** The segment's HTML (`''` for the meta block and empty/`null`-body blocks). */
  readonly html: string;
  /** DOM id of the segment's `<section>`, when it produced one. */
  readonly sectionId?: string;
  /** 1-based section number, when the segment produced a section. */
  readonly sectionNum?: number;
}

/** A document rendered segment-by-segment, plus the shared page pieces. */
export interface DocumentSegmentsResult {
  /** Theme-independent house stylesheet. Inject once. */
  readonly css: string;
  /** Theme variable declarations (e.g. `--navy:#0f766e;`), or `''` for default. */
  readonly themeVars: string;
  /** Document title (from the `meta` block). */
  readonly title: string;
  /** Shared SVG `<defs>` (markers + filters) — the body's leading chunk. */
  readonly defs: string;
  /** The cover/meta header HTML the document body starts with. */
  readonly cover: string;
  /** EXACTLY one entry per `doc.segments[i]`, index-aligned. */
  readonly segments: readonly RenderedSegment[];
  /** Section index for navigation. */
  readonly sections: readonly DocumentSection[];
  /** The page's headings and numbered figures, for a table of contents. */
  readonly outline: DocumentOutline;
}

/**
 * Renders a document one segment at a time — the primitive under
 * {@link renderDocumentParts}. Recomposing
 * `defs + cover + segments.map((s) => s.html).join('')` yields exactly
 * `renderDocumentParts(doc, opts).body`, while keeping each segment's HTML
 * addressable by its index in `doc.segments` (for editors that re-render one
 * block at a time).
 *
 * @param doc - The parsed Chiltepin document.
 * @param opts - Optional theme + variable overrides.
 * @returns The shared page pieces plus one rendered entry per segment.
 */
export function renderDocumentSegments(
  doc: Document,
  opts: RenderPartsOptions = {},
): DocumentSegmentsResult {
  const title = doc.meta?.title ?? 'Untitled';
  const theme = opts.theme ?? DEFAULT_THEME;
  const themeVars = buildThemeVars(theme, opts.themeVars);
  const ctx = newCtx(doc, 'page');
  const segments: RenderedSegment[] = doc.segments.map((s) => {
    const before = ctx.sections.length;
    const html = renderSegment(s, ctx);
    // renderSegment pushed a section exactly when this segment became one.
    const section = ctx.sections.length > before ? ctx.sections[ctx.sections.length - 1] : undefined;
    return {
      html,
      ...(section !== undefined ? { sectionId: section.id, sectionNum: section.num } : {}),
    };
  });
  const outline: DocumentOutline = { headings: ctx.headings, figures: ctx.figures };
  return {
    css: houseCss,
    themeVars,
    title,
    defs: globalDefsSvg(),
    cover: renderCover(doc.meta, readingStats(doc, ctx.figures.length)),
    segments,
    sections: ctx.sections,
    outline,
  };
}

/**
 * Renders a document into its composable parts.
 *
 * Implemented on top of {@link renderDocumentSegments}: the body is
 * `defs + cover + segments.join('')`.
 *
 * @param doc - The parsed Chiltepin document.
 * @param opts - Optional theme + variable overrides.
 * @returns The CSS, theme vars, body HTML, title, and section index.
 */
export function renderDocumentParts(doc: Document, opts: RenderPartsOptions = {}): DocumentParts {
  const { css, themeVars, title, defs, cover, segments, sections, outline } = renderDocumentSegments(
    doc,
    opts,
  );
  const body = defs + cover + segments.map((s) => s.html).join('');
  return { css, themeVars, body, title, sections, outline };
}

/**
 * One piece of a slide, for structure-aware exporters (e.g. editable PPTX):
 * the same content as the slide's HTML, but still addressable as prose text or
 * a typed block with its parsed data.
 */
export interface SlidePart {
  readonly kind: 'prose' | 'block';
  /** This part's rendered HTML (a slice of the slide's `html`). */
  readonly html: string;
  /** Raw Markdown source (prose parts only). */
  readonly text?: string;
  /** Block type (block parts only). */
  readonly type?: BlockType;
  /** Parsed, sugar-normalized block data (block parts only). */
  readonly data?: unknown;
}

/** One presentation slide (used by the slides export). */
export interface Slide {
  /** Section label (e.g. `Sequence`), or `Cover`. */
  readonly label: string;
  /** The block's title, if any. */
  readonly title?: string;
  /**
   * The exhibit's supporting line — a block's `lede`. On a page it sits in the
   * section head; on a stage the deck pins it under the slide title, where an
   * action title's supporting line belongs and where the fitter can't shrink
   * it with the exhibit.
   */
  readonly lede?: string;
  /**
   * Provenance for the exhibit — `## Title {source: internal QA, Oct 2026}`.
   * Every consulting exhibit carries one, and it belongs in the slide footer
   * rather than under the block, where the fitter would scale it away.
   */
  readonly source?: string;
  /** The part (divider band) this slide belongs to, for the deck tracker. */
  readonly part?: string;
  /** Inner HTML for a `<div class="docskin slide">`. */
  readonly html: string;
  /** Vertical alignment of the content (auto by weight, or forced via a heading marker). */
  readonly align?: 'top' | 'center' | 'bottom';
  /** `split` = consulting layout: prose (message) left, blocks (exhibit) right.
   *  Forced via a `{split}` heading marker. */
  readonly layout?: 'split';
  /** `{nobuild}` heading marker: the deck shows this slide whole instead of
   *  stepping through its diagrams' `data-reveal` order. */
  readonly nobuild?: true;
  /** The slide's content as structured parts (empty for the cover — exporters
   *  read `doc.meta` for it). Concatenating part HTML yields `html`, modulo
   *  the split-layout column wrappers. */
  readonly parts?: readonly SlidePart[];
}

/** A document rendered as a sequence of slides. */
export interface SlidesResult {
  readonly css: string;
  readonly themeVars: string;
  readonly title: string;
  /** Shared SVG `<defs>` (markers + filters). Place once at the deck root —
   *  NOT inside a slide, since slides toggle `display:none` and a filter
   *  referenced from a hidden subtree won't resolve (the element vanishes). */
  readonly defs: string;
  readonly slides: readonly Slide[];
}

/**
 * Renders a document as a deck of slides — one slide for the cover and one per
 * top-level section block. Markdown prose is attached to the slide that follows
 * it (or a trailing "Notes" slide). The SVG `<defs>` ride along on the first
 * slide so diagram markers resolve document-wide.
 */
/** Loose view of block data for sizing — only the array fields we count. */
type SizedData = {
  items?: unknown[];
  rows?: unknown[];
  stats?: unknown[];
  blocks?: ReadonlyArray<{ code?: string }>;
  /** The flat `code` block form — one snippet at the top level. */
  code?: unknown;
  levels?: unknown[];
  terms?: unknown[];
  parts?: unknown[];
  gates?: unknown[];
  nodes?: unknown[];
  screens?: unknown[];
  classes?: unknown[];
  states?: unknown[];
  entities?: unknown[];
  tasks?: unknown[];
  columns?: ReadonlyArray<{ cards?: unknown[] }>;
  lanes?: unknown[];
  steps?: unknown[];
  clusters?: unknown[];
  personas?: unknown[];
  areas?: unknown[];
  series?: unknown[];
  actors?: unknown[];
  messages?: unknown[];
  criteria?: unknown[];
  links?: unknown[];
  pros?: unknown[];
  cons?: unknown[];
  causes?: unknown[];
  backbone?: unknown[];
  slices?: ReadonlyArray<{ cells?: ReadonlyArray<unknown[]> }>;
  current?: { items?: unknown[] };
  target?: { items?: unknown[] };
};

const arrLen = (a: unknown): number => (Array.isArray(a) ? a.length : 0);

/** Largest array among a block's common item fields — a rough "how tall" proxy. */
function maxArr(d: SizedData): number {
  const fields = [
    d.items, d.rows, d.stats, d.blocks, d.levels, d.terms, d.parts, d.gates, d.nodes,
    d.screens, d.classes, d.states, d.entities, d.tasks, d.columns, d.lanes, d.steps, d.clusters,
    d.personas, d.areas, d.series, d.causes,
  ];
  let m = 0;
  for (const f of fields) m = Math.max(m, arrLen(f));
  return m;
}

/**
 * Per-item weight by block type (slide units per counted item; default 1.1).
 * Calibrated so a block crosses {@link HERO_WEIGHT} at the item count where it
 * genuinely fills a slide on its own:
 *
 * - Rich cards (a bordered card with icon/title/body/tag per item) ≈ 2 rows of
 *   a table each → hero from 3 cards.
 * - Node diagrams (SVG height grows with node count) → hero around 5–6 nodes.
 * - Dense tabular rows stay cheap → an 8-row table or 7-row matrix is a hero,
 *   a 3–4-row one still shares the stage with its prose.
 */
const ITEM_WEIGHT: Partial<Record<BlockType, number>> = {
  // rich cards / fat rows
  drivers: 2,
  persona: 2,
  // A chart is a full plotted figure (~240px of axes + series + legend); its
  // arrays are tiny (2 series / 3 wedges) so the default weight let three
  // charts share one slide and scale unreadably small.
  chart: 2,
  erd: 2, // each entity is a little attribute table
  composition: 2, // each gate is a wide card + the result banner
  wireframe: 2, // each screen is a whole mockup
  spec: 1.5,
  timeline: 1.5,
  // tabular
  table: 1.4,
  benchmark: 1.4,
  sankey: 1.2,
  gitgraph: 1.2,
  treemap: 1.2,
  packet: 1.4,
  wardley: 1.2,
  harvey: 1.4,
  scenarios: 1.4,
  scqa: 1.6,
  matrix: 1.2,
  // node diagrams (block/graph layout engines + aliases)
  flow: 1.2,
  state: 1.2,
  dfd: 1.2,
  graph: 1.2,
  swimlane: 1.2,
  c4: 1.2,
  uml: 1.2,
  frontend: 1.2,
  cluster: 1.2,
  block: 1.2,
  felogic: 1.2,
  archmap: 1.2,
  cycle: 1.2,
  fishbone: 1.4, // each bone carries a label plus its item ticks
  slopegraph: 0.9, // each item is one thin line plus two short labels
  eventcontract: 1.4, // a card of tables, like endpoint
  saga: 1.6, // each step is a card with a compensation card under it
  spans: 0.7, // one thin bar row per span; lanes add nothing on their own
  rollout: 1.6, // each stage is a card in one horizontal strip
  perfbudget: 0.8, // one bar row per metric
  percentiles: 0.8, // one dot-and-whisker row per series
  timing: 1.2, // each lane stacks its state levels
  threatmodel: 1.6, // grid nodes plus a threats table under the drawing
  neuralnet: 0.7, // layers are columns side by side; height is the tallest column
  mindmap: 0.7, // nodes split across two sides; each is one text row
  usecase: 1.0, // cases stack in one column of ellipses
  pkg: 1.2, // folders on a grid, members printed inside
  audit: 1.0, // one table row per finding, four cells of text
  checklist: 0.8, // one row per item: chip, text, mono evidence
  modelcard: 1.4, // a card of lists and a metrics table, like endpoint
  chevrons: 0.7, // one chevron per step in a single strip; wraps past eight
  roadmap: 0.9, // one chip per item in a theme row; overlaps add a lane
};

/**
 * Estimates how much vertical space a block needs, in arbitrary "slide units",
 * from its data (not pixels — this runs at build time). Used to paginate a heavy
 * heading across multiple slides so nothing is scaled down to an unreadable size.
 *
 * Exported for tests only — not part of the public render API.
 */
export function blockWeight(seg: TypedSegment): number {
  if (seg.kind === 'meta') return 0;
  if (seg.parseError !== undefined || seg.data === null || seg.data === undefined) return 2;
  const d = seg.data as SizedData;
  if (seg.kind === 'callout' || seg.kind === 'pullquote') return 3;
  if (seg.kind === 'proscons') return 2 + (arrLen(d.pros) + arrLen(d.cons)) * 1.1;
  if (seg.kind === 'cvt') return 2 + (arrLen(d.current?.items) + arrLen(d.target?.items)) * 1.1;
  if (seg.kind === 'code') {
    // Both spellings weigh in: the blocks[] form AND the flat top-level
    // `code:` form (which used to count as 2.0 no matter how tall — two
    // 24-line terminals then stacked onto one slide at half scale).
    let lines = 0;
    let cards = arrLen(d.blocks);
    for (const b of d.blocks ?? []) lines += String(b.code ?? '').split('\n').length;
    if (typeof d.code === 'string') {
      cards += 1;
      lines += d.code.split('\n').length;
    }
    return 2 + cards * 1.5 + lines * 0.35;
  }
  // Height comes from actors (columns set the diagram's text density) AND the
  // message rows beneath them.
  if (seg.kind === 'sequence') return 2 + arrLen(d.actors) * 0.6 + arrLen(d.messages) * 0.9;
  // Each option is a tall comparison card whose height grows with its pros/cons.
  if (seg.kind === 'options') {
    let sub = 0;
    const items = (d.items ?? []) as ReadonlyArray<{ pros?: unknown[]; cons?: unknown[] }>;
    for (const it of items) sub += arrLen(it.pros) + arrLen(it.cons);
    return 2 + arrLen(d.items) * 2 + sub * 0.4;
  }
  if (seg.kind === 'kanban') {
    let cards = 0;
    for (const c of d.columns ?? []) cards += arrLen(c.cards);
    return 2 + arrLen(d.columns) + cards * 0.7;
  }
  // Height comes from the backbone header row plus the tallest stack a slice
  // adds; total card count is the honest proxy for how tall the bands get.
  if (seg.kind === 'storymap') {
    let cards = 0;
    for (const s of d.slices ?? []) for (const cell of s.cells ?? []) cards += arrLen(cell);
    return 2 + arrLen(d.backbone) * 0.4 + arrLen(d.slices) + cards * 0.5;
  }
  if (seg.kind === 'userstory') return 2 + arrLen(d.criteria) * 1.5 + arrLen(d.links) * 0.4;
  // Every line is a table row — parents and their nested subtasks alike.
  if (seg.kind === 'statustable') {
    let subs = 0;
    const rows = (d.rows ?? []) as ReadonlyArray<{ subtasks?: unknown[] }>;
    for (const r of rows) subs += arrLen(r.subtasks);
    return 2 + (arrLen(d.rows) + subs) * 1.4;
  }
  return 2 + maxArr(d) * (ITEM_WEIGHT[seg.kind] ?? 1.1); // lists, charts, …
}

/** Max content weight before a heading spills onto a continuation slide. */
const SLIDE_BUDGET = 10;
/**
 * A block at least this heavy (~80% of the budget) is a full-slide exhibit —
 * it never shares the stage with its section's prose. The prose stays on the
 * preceding slide; the exhibit gets the whole stage (the slide title keeps the
 * section context, exactly like an overflow continuation).
 */
const HERO_WEIGHT = 8;
/**
 * A short connective intro (≤ ~400 chars → prose weight 2.2) may ride along
 * above a hero exhibit as its kicker — splitting a two-sentence lede onto its
 * own slide reads sparse-broken.
 */
const KICKER_WEIGHT = 2.2;
/**
 * …unless the exhibit already overflows the stage this badly (1.25× budget):
 * then even a one-line kicker eats into space the exhibit needs, and it
 * stands alone.
 */
const SOLO_WEIGHT = 12.5;

export function renderSlides(doc: Document, opts: RenderPartsOptions = {}): SlidesResult {
  const title = doc.meta?.title ?? 'Untitled';
  const theme = opts.theme ?? DEFAULT_THEME;
  const themeVars = buildThemeVars(theme, opts.themeVars);
  const ctx = newCtx(doc, 'slides');
  const slides: Slide[] = [];

  if (doc.meta !== undefined) slides.push({ label: 'Cover', title, html: renderCover(doc.meta) });

  // Slide-break mode: each top-level Markdown heading (`#`/`##`) starts a new
  // slide and is its title; everything until the next heading (prose + blocks)
  // stays on that slide. `###`+ headings stay in the body. If the doc has no
  // top-level headings at all, we fall back to one slide per block (legacy).
  const headingRe = /^(#{1,2})\s+(.+?)\s*$/;
  const usesHeadings = doc.segments.some(
    (s) => s.kind === 'markdown' && s.text.split('\n').some((l) => headingRe.test(l)),
  );

  if (usesHeadings) {
    let parts: Array<{ h: string; w: number; block: boolean; chars: number; part: SlidePart }> = [];
    let heading: string | undefined;
    let label: string | undefined;
    let forced: 'top' | 'center' | 'bottom' | undefined;
    let forcedLayout: 'split' | undefined;
    let sourceNote: string | undefined;
    let noBuild = false;
    // A `divider` block opens a part of the deck; every slide after it belongs
    // to that part until the next one, which is what the tracker walks.
    let part: string | undefined;
    // `keep` = true for a continuation slide (same heading spilled over): keep the
    // title/marker, reset only the content. `false` = a real new heading boundary.
    const pushSlide = (keep: boolean): void => {
      const raw = parts.map((p) => p.h).join('');
      if (raw.trim() !== '' || (heading !== undefined && !keep)) {
        const blocks = parts.filter((p) => p.block).length;
        const proseChars = parts.reduce((a, p) => a + p.chars, 0);
        // Split slides center on the stage regardless of prose length — the
        // message column reads as a unit beside its exhibit. Prose-only slides
        // (no blocks) always center: top-aligned lone prose leaves a dead
        // bottom half. Mixed slides sit at the top once they get heavy.
        const align =
          forced ??
          (forcedLayout === 'split'
            ? 'center'
            : blocks >= 2 || (blocks >= 1 && proseChars > 240)
              ? 'top'
              : 'center');
        // Split layout: prose becomes the left "message" column, blocks the
        // right "exhibit" column — the classic consulting slide.
        const html =
          forcedLayout === 'split' && raw.trim() !== ''
            ? `<div class="sl-msg">${parts.filter((p) => !p.block).map((p) => p.h).join('')}</div>` +
              `<div class="sl-exhibit">${parts.filter((p) => p.block).map((p) => p.h).join('')}</div>`
            : raw;
        // The first exhibit's lede becomes the slide's supporting line. It is
        // hidden inside the (display:none) section head otherwise — a line the
        // author wrote and the deck silently dropped.
        const ledeOf = (part: SlidePart): string | undefined => {
          if (part.kind !== 'block') return undefined;
          const d = part.data as { lede?: unknown } | undefined;
          return typeof d?.lede === 'string' && d.lede.length > 0 ? d.lede : undefined;
        };
        const lede = parts.map((p) => ledeOf(p.part)).find((l) => l !== undefined);
        slides.push({
          label: label ?? 'Slide',
          ...(heading !== undefined ? { title: heading } : {}),
          ...(lede !== undefined ? { lede } : {}),
          ...(sourceNote !== undefined ? { source: sourceNote } : {}),
          ...(part !== undefined ? { part } : {}),
          html,
          align,
          ...(forcedLayout !== undefined ? { layout: forcedLayout } : {}),
          ...(noBuild ? { nobuild: true as const } : {}),
          parts: parts.map((p) => p.part),
        });
      }
      parts = [];
      label = undefined;
      if (!keep) {
        heading = undefined;
        forced = undefined;
        forcedLayout = undefined;
        sourceNote = undefined;
        noBuild = false;
      }
    };
    const pendingWeight = (): number => parts.reduce((a, p) => a + p.w, 0);
    // Append a piece of content, spilling onto a continuation slide first if it
    // would overflow the budget (but never flush an empty slide). Split-layout
    // slides never spill: message + exhibit belong together, and the deck's
    // fit() scaler absorbs the size.
    const addPart = (part: SlidePart, w: number, chars = 0): void => {
      const h = part.html;
      const block = part.kind === 'block';
      const hero = block && w >= HERO_WEIGHT;
      if (forcedLayout !== 'split' && parts.length > 0) {
        if (hero) {
          // Hero rule: a full-slide exhibit never shares with the section's
          // prose — the prose keeps this slide, the exhibit takes the next one
          // (same title, so it keeps its section context). A trailing one-line
          // lede may ride along as the exhibit's kicker, unless the exhibit is
          // so heavy it needs every pixel of the stage.
          const tail = parts[parts.length - 1];
          const carry =
            tail !== undefined && !tail.block && tail.w <= KICKER_WEIGHT && w < SOLO_WEIGHT
              ? parts.pop()
              : undefined;
          if (parts.length > 0) pushSlide(true);
          if (carry !== undefined) parts.push(carry);
        } else if (pendingWeight() + w > SLIDE_BUDGET) {
          // AUTO-SPLIT: substantial prose + this section's FIRST real exhibit
          // won't fit stacked — instead of spilling (or letting fit() shrink
          // the stack), lay them out side by side: prose becomes the message
          // column, the block the exhibit. Same layout the `{split}` marker
          // forces, chosen automatically for the classic two-part slide.
          const allProse = parts.every((p) => !p.block);
          if (block && allProse && pendingWeight() >= 2 && w >= 3) {
            forcedLayout = 'split';
            forced = undefined; // split slides center; drop stack alignment
          } else {
            pushSlide(true);
          }
        }
      }
      // A hero consumes the whole budget: whatever follows spills to the next
      // slide instead of squeezing in under the exhibit.
      parts.push({ h, w: hero ? Math.max(w, SLIDE_BUDGET + 0.5) : w, block, chars, part });
    };
    for (const seg of doc.segments) {
      if (seg.kind === 'meta') continue;
      if (seg.kind === 'markdown') {
        let buf: string[] = [];
        const flushBuf = (): void => {
          const text = buf.join('\n').trim();
          if (text !== '') {
            const h = renderProse(buf.join('\n'));
            if (h.trim() !== '') {
              addPart({ kind: 'prose', html: h, text }, Math.max(1, text.length / 180), text.length);
            }
          }
          buf = [];
        };
        for (const line of seg.text.split('\n')) {
          const m = headingRe.exec(line);
          if (m !== null) {
            flushBuf();
            pushSlide(false); // a heading starts a new slide
            // Optional marker, e.g. `## Title {top}` or `## Title {split}` —
            // stripped from the title.
            // Markers are parsed by chiltepin-core so the deck, the page and
            // the nav can't disagree about what a title says.
            const raw = m[2] ?? '';
            const src = readSourceMarker(raw);
            if (src !== undefined) sourceNote = src;
            const a = readAlignMarker(raw);
            if (a === 'split') forcedLayout = 'split';
            else if (a !== undefined) {
              forced = a === 'middle' || a === 'center' ? 'center' : a === 'bottom' ? 'bottom' : 'top';
            }
            if (readBuildMarker(raw)) noBuild = true;
            heading = stripHeadingMarkers(raw);
          } else {
            buf.push(line);
          }
        }
        flushBuf();
      } else {
        if (seg.kind === 'divider') {
          const d = seg.data as { label?: unknown; title?: unknown } | undefined;
          const name =
            typeof d?.label === 'string' ? d.label : typeof d?.title === 'string' ? d.title : undefined;
          if (name !== undefined && name !== '') {
            // Flush whatever is pending FIRST: that content belongs to the
            // part it was written under, not to the one this divider opens.
            if (parts.length > 0) pushSlide(false);
            part = name;
          }
        }
        addPart(
          { kind: 'block', html: renderSegment(seg, ctx), type: seg.kind, data: seg.data },
          blockWeight(seg),
        );
        label = ctx.sections[ctx.sections.length - 1]?.label;
      }
    }
    pushSlide(false);
  } else {
    // No headings/breaks: one slide per block (legacy).
    let prose = '';
    let proseParts: SlidePart[] = [];
    for (const seg of doc.segments) {
      if (seg.kind === 'markdown') {
        const h = renderProse(seg.text);
        if (h.trim() !== '') {
          prose += h;
          proseParts.push({ kind: 'prose', html: h, text: seg.text.trim() });
        }
        continue;
      }
      if (seg.kind === 'meta') continue;
      const html = renderSegment(seg, ctx);
      const sec = ctx.sections[ctx.sections.length - 1];
      slides.push({
        label: sec?.label ?? 'Section',
        ...(sec?.title !== undefined ? { title: sec.title } : {}),
        html: prose + html,
        parts: [...proseParts, { kind: 'block', html, type: seg.kind, data: seg.data }],
      });
      prose = '';
      proseParts = [];
    }
    if (prose.trim() !== '') slides.push({ label: 'Notes', html: prose, parts: proseParts });
  }

  return { css: houseCss, themeVars, title, defs: globalDefsSvg(), slides };
}
