/**
 * The page outline: heading anchors, figure numbers, the table of contents,
 * and the reading stats the cover prints.
 *
 * The contract (DESIGN.md › Headings and figures):
 *
 * - The author's `##` / `###` headings are the only document headings. Each
 *   gets a deterministic id from `headingIds` in `chiltepin-core`, with every
 *   block `id:` reserved, so `[text](#slug)` resolves the same way in
 *   `chiltepin check` and on the page.
 * - A block's `title` is its figure caption, "Fig. N · title". Figures are
 *   numbered in document order; only a titled figure takes a number, so the
 *   caption, the figure list, and the shots all print the same N.
 * - Narrative blocks (callout, list, steps, …) are not figures: their title is
 *   a plain label with no number.
 */

import type { BlockType, Document, Segment } from 'chiltepin-core';
import { headingIds, headingSlug, stripInlineStyling } from 'chiltepin-core';
import { escapeHtml } from './escape.js';
import { proseHeadings, renderInlineMd } from './markdown.js';
import { bp } from './paths.js';

/**
 * Blocks whose `title` is a plain label, not a numbered figure caption: text
 * the reader reads in line, not an exhibit they look at.
 */
export const NON_FIGURE: ReadonlySet<BlockType> = new Set<BlockType>([
  'meta',
  'callout',
  'pullquote',
  'divider',
  'takeaways',
  'prose',
  'bignumber',
  'list',
  'steps',
  'faq',
  'glossary',
  'scqa',
]);

/** One `##` / `###` heading of the page, in document order. */
export interface DocumentHeading {
  /** The heading's anchor id (`headingIds` in `chiltepin-core`). */
  readonly id: string;
  /** 2 for `##`, 3 for `###`. */
  readonly depth: 2 | 3;
  /** The heading's Markdown source (slide markers removed). */
  readonly text: string;
}

/** One numbered figure of the page. */
export interface DocumentFigure {
  /** The figure number, 1-based, in document order. */
  readonly num: number;
  /** The caption text (the block's `title`). */
  readonly title: string;
  /** The anchor that links to the figure: its block `id:`, else `fig-<slug>`. */
  readonly anchor: string;
  /** DOM id of the figure's `<section>`. */
  readonly sectionId: string;
}

/** The page's headings and figures, for a table of contents. */
export interface DocumentOutline {
  readonly headings: readonly DocumentHeading[];
  readonly figures: readonly DocumentFigure[];
}

/** Heading anchors for a whole document, computed once before rendering. */
export interface HeadingPlan {
  /** Ids for each prose segment's outline headings, in order. */
  readonly bySegment: WeakMap<Segment, readonly string[]>;
  /** Every heading, in document order. */
  readonly headings: readonly DocumentHeading[];
  /** Every id taken so far: block ids plus heading ids. */
  readonly used: Set<string>;
}

/**
 * Plans the heading ids of a document: every `##` / `###` in every prose run,
 * in order, with every block `id:` reserved — the shared `headingIds`
 * algorithm, so a link `check` accepts lands on the page.
 */
export function planHeadings(doc: Document): HeadingPlan {
  const reserved = new Set<string>();
  for (const s of doc.segments) if (s.kind !== 'markdown' && s.id !== undefined) reserved.add(s.id);
  const perSegment: Array<{ seg: Segment; count: number }> = [];
  const all: Array<{ depth: 2 | 3; text: string }> = [];
  for (const s of doc.segments) {
    if (s.kind !== 'markdown') continue;
    const hs = proseHeadings(s.text);
    perSegment.push({ seg: s, count: hs.length });
    all.push(...hs);
  }
  const ids = headingIds(
    all.map((h) => h.text),
    reserved,
  );
  const bySegment = new WeakMap<Segment, readonly string[]>();
  let at = 0;
  for (const { seg, count } of perSegment) {
    bySegment.set(seg, ids.slice(at, at + count));
    at += count;
  }
  const headings = all.map((h, i) => ({ id: ids[i] ?? 'section', depth: h.depth, text: h.text }));
  return { bySegment, headings, used: new Set([...reserved, ...ids]) };
}

/** A figure anchor from its caption, unique among the ids already `used`. */
export function figureAnchor(title: string, used: Set<string>): string {
  const base = `fig-${headingSlug(title)}`;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/**
 * The caption's inner HTML: "Fig. N · title". `num` is undefined for a
 * narrative label; `title` is undefined when the heading above already says
 * it (the caption keeps the number only). The title span carries the
 * `title` data path, so a click on it edits the field.
 */
export function captionInner(num: number | undefined, title: string | undefined): string {
  const n = num !== undefined ? `<span class="fig-num">Fig.&nbsp;${num}</span>` : '';
  const sep = num !== undefined && title !== undefined ? `<span class="fig-sep" aria-hidden="true"> · </span>` : '';
  const t = title !== undefined ? `<span class="fig-title"${bp('title')}>${escapeHtml(title)}</span>` : '';
  return n + sep + t;
}

/**
 * A heading's text as inline HTML for the contents list: links unwrapped, and
 * highlights, chips, and icons reduced to their words.
 */
function headingHtml(text: string): string {
  return renderInlineMd(stripInlineStyling(text)).replace(/<\/?a\b[^>]*>/g, '');
}

/** True when a document is long enough to need contents: 4+ headings, or about 3+ screens. */
export function wantsToc(doc: Document, outline: DocumentOutline): boolean {
  const entries = outline.headings.length + outline.figures.length;
  if (entries < 2) return false;
  if (outline.headings.length >= 4) return true;
  // About three screens (~2700px): a block is ~450px, a line of prose ~26px.
  let height = 0;
  for (const s of doc.segments) {
    if (s.kind === 'meta') continue;
    if (s.kind === 'markdown') height += (s.text.length / 95) * 26;
    else height += 450;
  }
  return height > 2700;
}

/** The contents list items: the headings (`###` nested under their `##`), else the figures. */
function contentsList(outline: DocumentOutline): string {
  if (outline.headings.length === 0) return figuresList(outline, 'toc-list');
  const top: Array<{ h: DocumentHeading; kids: DocumentHeading[] }> = [];
  for (const h of outline.headings) {
    const last = top[top.length - 1];
    if (h.depth === 3 && last !== undefined && last.h.depth === 2) last.kids.push(h);
    else top.push({ h, kids: [] });
  }
  const link = (h: DocumentHeading): string => `<a href="#${escapeHtml(h.id)}">${headingHtml(h.text)}</a>`;
  return (
    `<ol class="toc-list">` +
    top
      .map(
        ({ h, kids }) =>
          `<li${h.depth === 3 ? ' class="toc-h3"' : ''}>${link(h)}` +
          (kids.length > 0 ? `<ol class="toc-sub">${kids.map((k) => `<li>${link(k)}</li>`).join('')}</ol>` : '') +
          `</li>`,
      )
      .join('') +
    `</ol>`
  );
}

function figuresList(outline: DocumentOutline, cls: string): string {
  return (
    `<ol class="${cls} toc-figs">` +
    outline.figures
      .map(
        (f) =>
          `<li><a href="#${escapeHtml(f.anchor)}"><span class="toc-fignum">Fig.&nbsp;${f.num}</span>` +
          `<span class="toc-figtitle">${escapeHtml(f.title)}</span></a></li>`,
      )
      .join('') +
    `</ol>`
  );
}

/** The contents body: headings, then a figure list when both exist. */
function tocBody(outline: DocumentOutline): string {
  const label = outline.headings.length > 0 ? 'Contents' : 'Figures';
  const figs =
    outline.headings.length > 0 && outline.figures.length > 0
      ? `<details class="toc-figlist"><summary class="toc-label t-eyebrow">Figures · ${outline.figures.length}</summary>` +
        figuresList(outline, 'toc-list') +
        `</details>`
      : '';
  return `<div class="toc-label t-eyebrow">${label}</div>` + contentsList(outline) + figs;
}

/**
 * The two forms of the table of contents: a sticky rail beside the text on
 * wide screens, and a collapsed `<details>` above the first section below
 * that. CSS shows one of them.
 */
export function renderToc(outline: DocumentOutline): { rail: string; inline: string } {
  const body = tocBody(outline);
  return {
    rail:
      `<nav class="toc-rail" aria-label="Contents">${body}` +
      `<a class="toc-top" href="#doc-top">Back to top</a></nav>`,
    inline:
      `<details class="toc-inline"><summary><span class="t-eyebrow">Contents</span>` +
      `<span class="toc-count">${outline.headings.length > 0 ? `${outline.headings.length} sections` : ''}` +
      `${outline.headings.length > 0 && outline.figures.length > 0 ? ' · ' : ''}` +
      `${outline.figures.length > 0 ? `${outline.figures.length} figures` : ''}</span></summary>` +
      `<div class="toc-inline-body">${body}</div></details>`,
  };
}

/** The cover's derived line: how long the doc takes to read, and how many figures it has. */
export interface ReadingStats {
  readonly minutes: number;
  readonly figures: number;
}

/** Words in a string (anything between whitespace that holds a letter or digit). */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Every string leaf of a block's data, so labels count as text the reader reads. */
function dataWords(v: unknown, depth = 0): number {
  if (depth > 8) return 0;
  if (typeof v === 'string') return countWords(v);
  if (Array.isArray(v)) return v.reduce<number>((a, x) => a + dataWords(x, depth + 1), 0);
  if (v !== null && typeof v === 'object') {
    let n = 0;
    for (const [k, x] of Object.entries(v)) if (k !== 'id' && k !== 'ref') n += dataWords(x, depth + 1);
    return n;
  }
  return 0;
}

/** Reading time at 230 words a minute, plus 10 seconds a figure; at least 1 minute. */
export function readingStats(doc: Document, figures: number): ReadingStats {
  let words = 0;
  for (const s of doc.segments) {
    if (s.kind === 'meta') continue;
    if (s.kind === 'markdown') words += countWords(s.text.replace(/[#*_`>|-]/g, ' '));
    else words += dataWords(s.data);
  }
  return { minutes: Math.max(1, Math.round(words / 230 + figures / 6)), figures };
}
