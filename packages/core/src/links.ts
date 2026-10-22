/**
 * Links in prose: where they are, what they point at, and which anchors a
 * document offers.
 *
 * Three forms are internal links (the authoring skill teaches them):
 *
 * - `[text](#anchor)` — a block id or heading id in the same document.
 * - `[text](other-doc#anchor)` — the `doc#id` scheme: `other-doc` is the
 *   document path under the docs root, without `.md`.
 * - `[text](./other.md)`, `[text](../x/other.md#anchor)` — a relative
 *   Markdown link, resolved against the linking document's folder.
 *
 * Everything else (`https:`, `mailto:`, a path to an image or a PDF) is not
 * a document link and is left alone. Pure: no I/O, no file system — a target
 * is checked against the parsed document set, never the disk.
 */

import type { Diagnostic } from './diagnostics.js';
import { headingIds, headingSlug } from './slug.js';
import { closest } from './suggest.js';
import type { Document } from './types.js';
import { stripHeadingMarkers, trailingHeading } from './validate.js';

/** One Markdown link written in a document's prose. */
export interface ProseLink {
  /** The link text as written. */
  readonly text: string;
  /** The link target as written. */
  readonly href: string;
  /** 1-based document line of the link. */
  readonly line: number;
  /** 1-based column of the `[`. */
  readonly column: number;
}

/** A link target resolved to a document slug and an optional anchor. */
export interface LinkTarget {
  /** The target document's slug (the linking document's own slug for `#anchor`). */
  readonly doc: string;
  /** The anchor (block id or heading id), when the link names one. */
  readonly anchor?: string;
  /** True for `#anchor` (same document). */
  readonly local: boolean;
}

/** Blocks that render a text field as inline Markdown (a link there is a real link). */
const INLINE_MD_BLOCKS: ReadonlySet<string> = new Set(['callout', 'pullquote', 'prose', 'scqa']);

/** `[text](href)` or `[text](href "title")`, not an image (`![…](…)`). */
const LINK_RE = /(?<!!)\[((?:[^\][\n]|\[[^\]\n]*\])*)\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

const blank = (s: string): string => s.replace(/[^\n]/g, ' ');

/** Same character offsets, with fenced code blocks blanked. */
function maskFences(text: string): string {
  // A backtick fence's info string holds no backtick (CommonMark), so
  // "```mermaid; `erd` accepts ```dbml" in a list item is text, not a fence.
  return text.replace(/^ {0,3}(`{3,}(?=[^`\n]*$)|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[ \t]*$|(?![\s\S]))/gm, blank);
}

/**
 * Same character offsets, with fenced code and inline code spans blanked. A
 * span is a run of backticks closed by a run of the same length, never across
 * a blank line.
 */
function maskCode(text: string): string {
  return maskFences(text).replace(/(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g, blank);
}

/** The same pattern, anchored, to read the groups from the unmasked text. */
const ONE_LINK_RE = new RegExp(`^${LINK_RE.source}`);

function linksIn(text: string, line: number, out: ProseLink[]): void {
  const masked = maskCode(text);
  for (const m of masked.matchAll(LINK_RE)) {
    const at = m.index;
    const original = ONE_LINK_RE.exec(text.slice(at, at + m[0].length)) ?? m;
    const before = text.slice(0, at);
    out.push({
      text: original[1] ?? '',
      href: original[2] ?? '',
      line: line + (before.match(/\n/g)?.length ?? 0),
      column: at - before.lastIndexOf('\n'),
    });
  }
}

function blockStrings(data: unknown, out: string[] = []): string[] {
  if (typeof data === 'string') out.push(data);
  else if (Array.isArray(data)) for (const v of data) blockStrings(v, out);
  else if (typeof data === 'object' && data !== null) for (const v of Object.values(data)) blockStrings(v, out);
  return out;
}

/**
 * Every Markdown link in a document's prose: the Markdown runs, plus the
 * text of the blocks that render inline Markdown (`callout`, `pullquote`,
 * `prose`, `scqa`). Links inside code (fenced or inline) are not links.
 */
export function proseLinks(doc: Document): ProseLink[] {
  const out: ProseLink[] = [];
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') {
      linksIn(seg.text, seg.line, out);
    } else if (INLINE_MD_BLOCKS.has(seg.kind) && seg.parseError === undefined) {
      // A block string has no offset into the file: the link sits on the fence.
      const found: ProseLink[] = [];
      for (const s of blockStrings(seg.data)) linksIn(s, seg.line, found);
      out.push(...found.map((l) => ({ ...l, line: seg.line, column: 1 })));
    }
  }
  return out;
}

/** One `##` / `###` heading of a Markdown run. */
export interface MarkdownHeading {
  /** 2 for `##`, 3 for `###`. */
  readonly depth: 2 | 3;
  /** The heading's Markdown text, with slide markers (`{split}`, `{source: …}`) removed. */
  readonly text: string;
}

/**
 * The outline headings of one Markdown run, in source order: ATX `##` /
 * `###` (indented up to three spaces, inside a blockquote too) and setext
 * level-2 headings (a paragraph underlined with `-`). Fenced code is skipped.
 * Mirrors `proseHeadings` in `chiltepin-render`, which reads marked's tokens;
 * core has no Markdown parser, so it reads the same lines.
 */
export function markdownHeadings(text: string): MarkdownHeading[] {
  const out: MarkdownHeading[] = [];
  const masked = maskFences(text).split('\n');
  const lines = text.split('\n').map((l) => l.replace(/^(?: {0,3}>[ ]?)+/, ''));
  const plain = masked.map((l) => l.replace(/^(?: {0,3}>[ ]?)+/, ''));
  let para: string[] = [];
  plain.forEach((m, i) => {
    const line = lines[i] ?? '';
    if (m.trim() === '' || line.trim() === '') {
      para = [];
      return;
    }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(m) !== null
      ? /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line)
      : null;
    if (atx !== null) {
      const depth = atx[1]?.length ?? 0;
      const body = (atx[2] ?? '').trim();
      if ((depth === 2 || depth === 3) && body !== '') out.push({ depth, text: stripHeadingMarkers(body) });
      para = [];
      return;
    }
    // A setext underline closes the paragraph above it as a heading.
    if (para.length > 0 && /^ {0,3}(?:-+|=+)[ \t]*$/.test(m)) {
      if (m.trim().startsWith('-')) out.push({ depth: 2, text: stripHeadingMarkers(para.join('\n').trim()) });
      para = [];
      return;
    }
    // Lines that start a block of their own are never a setext heading's text.
    if (/^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|\||(?:\*\s*){3,}$|(?:_\s*){3,}$|(?:-\s*){3,}$)/.test(m) || /^( {4,}|\t)/.test(m)) {
      para = [];
      return;
    }
    para.push(para.length === 0 ? line.trimStart() : line);
  });
  return out;
}

/** The text of every prose `##` and `###` heading in a document, in order. */
export function docHeadings(doc: Document): string[] {
  const out: string[] = [];
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') out.push(...markdownHeadings(seg.text).map((h) => h.text));
  }
  return out;
}

/** The block ids of a document (in order). */
export function blockIds(doc: Document): string[] {
  const out: string[] = [];
  for (const seg of doc.segments) if (seg.kind !== 'markdown' && seg.id !== undefined) out.push(seg.id);
  return out;
}

/** Blocks that draw their own `title` (it is the visual): no caption, no figure anchor. */
const OWNS_TITLE: ReadonlySet<string> = new Set(['divider', 'takeaways', 'callout']);
/** Narrative blocks: their `title` is a plain label, not a numbered figure. */
const NON_FIGURE: ReadonlySet<string> = new Set([
  'meta', 'callout', 'pullquote', 'divider', 'takeaways', 'prose', 'bignumber', 'list', 'steps', 'faq', 'glossary', 'scqa',
]);

const squash = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Every anchor a document offers a link, as the page draws them: block ids,
 * heading ids (the shared `headingIds`, with block ids reserved), and figure
 * anchors — a titled block with no `id:` takes `fig-<slug of its title>`,
 * unique among the ids before it. Mirrors the renderer's outline
 * (`planHeadings`, `figureAnchor`), so a link that resolves here resolves on
 * the page.
 */
export function docAnchors(doc: Document): Set<string> {
  const ids = blockIds(doc);
  const used = new Set([...ids, ...headingIds(docHeadings(doc), new Set(ids))]);
  const anchors = new Set(used);
  doc.segments.forEach((seg, i) => {
    if (seg.kind === 'markdown' || seg.kind === 'meta' || seg.parseError !== undefined) return;
    if (seg.id !== undefined || OWNS_TITLE.has(seg.kind)) return;
    const data = seg.data;
    const title = typeof data === 'object' && data !== null ? (data as { title?: unknown }).title : undefined;
    if (typeof title !== 'string' || title === '') return;
    const prev = doc.segments[i - 1];
    const heading = prev?.kind === 'markdown' ? trailingHeading(prev.text)?.text : undefined;
    const repeats = heading !== undefined && squash(title).length > 0 && squash(heading).includes(squash(title));
    // A narrative label that repeats the heading above is not drawn.
    if (NON_FIGURE.has(seg.kind) && repeats) return;
    const base = `fig-${headingSlug(title)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    anchors.add(id);
  });
  return anchors;
}

/** `x/./y/../z` → `x/z`; `undefined` when the path climbs above the root. */
function normalizePath(path: string): string | undefined {
  const parts: string[] = [];
  for (const p of path.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') {
      if (parts.length === 0) return undefined;
      parts.pop();
    } else parts.push(p);
  }
  return parts.join('/');
}

/** A doc slug: path segments of word characters, `.`, `-`, and `/`. */
const SLUG_RE = /^[\w.-]+(?:\/[\w.-]+)*$/;
/** A path to a file that is not a document (a page, an image, data). */
const FILE_EXT_RE = /\.(?:html?|png|jpe?g|gif|svg|webp|avif|ico|pdf|txt|json|ya?ml|csv|zip|css|js)$/i;

/**
 * Resolves a link target written in the document `fromSlug`. Returns
 * `undefined` for anything that is not a document link (a URL, an image, a
 * path that leaves the docs root).
 *
 * @param href - The link target as written.
 * @param fromSlug - The linking document's slug.
 */
export function resolveLinkTarget(href: string, fromSlug: string): LinkTarget | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('/')) return undefined;
  const hash = href.indexOf('#');
  const path = hash >= 0 ? href.slice(0, hash) : href;
  let anchor: string | undefined = hash >= 0 ? href.slice(hash + 1) : undefined;
  if (anchor !== undefined) {
    try {
      anchor = decodeURIComponent(anchor);
    } catch {
      /* keep it as written */
    }
    if (anchor === '') anchor = undefined;
  }
  if (path === '') {
    return anchor !== undefined ? { doc: fromSlug, anchor, local: true } : undefined;
  }
  if (/\.md$/i.test(path)) {
    const dir = fromSlug.includes('/') ? fromSlug.slice(0, fromSlug.lastIndexOf('/')) : '';
    const joined = normalizePath(`${dir}/${path.replace(/\.md$/i, '')}`);
    if (joined === undefined || joined === '') return undefined;
    return { doc: joined, ...(anchor !== undefined ? { anchor } : {}), local: false };
  }
  // The `doc#id` scheme: a slug, then an anchor. A bare path with no anchor
  // (`guides/setup`) could be any relative URL, so it is not read as a doc.
  if (anchor !== undefined && SLUG_RE.test(path) && !path.startsWith('.') && !FILE_EXT_RE.test(path)) {
    return { doc: path, anchor, local: false };
  }
  return undefined;
}

/** The renderer's own section anchors (`#section-03`) are valid on the page too. */
const SECTION_ANCHOR = /^section-\d{2,}$/;

/** The hint shared by every dangling-anchor finding. */
const ANCHOR_HINT =
  "Link to a block `id:` or to a heading's id: the heading text in lower case, with `-` between words (`## Order flow` → `#order-flow`).";

/**
 * One `E_DANGLING_LINK` finding. `docs` (every slug in the set) and
 * `anchors` (the target's anchors) feed the did-you-mean suggestions.
 */
export function danglingLink(
  file: string,
  link: ProseLink,
  target: LinkTarget,
  problem: 'doc' | 'anchor',
  candidates: readonly string[],
): Diagnostic {
  const suggestions = closest(problem === 'doc' ? target.doc : (target.anchor ?? ''), candidates, 3);
  const what =
    problem === 'doc'
      ? `no document "${target.doc}"`
      : target.local
        ? `this document has no block id or heading "${target.anchor ?? ''}"`
        : `"${target.doc}" has no block id or heading "${target.anchor ?? ''}"`;
  return {
    file,
    line: link.line,
    column: link.column,
    level: 'error',
    code: 'E_DANGLING_LINK',
    message: `Dangling link: [${link.text}](${link.href}): ${what}`,
    value: link.href,
    hint:
      problem === 'doc'
        ? 'Link to a document by its path under the docs folder, without `.md` (`payments/overview#seq-order`), or by a relative path (`./overview.md#seq-order`).'
        : ANCHOR_HINT,
    ...(suggestions.length > 0 ? { suggestions } : {}),
  };
}

/** True when `anchor` is a target in a document whose anchors are `anchors`. */
export function hasAnchor(anchors: ReadonlySet<string>, anchor: string): boolean {
  return anchors.has(anchor) || SECTION_ANCHOR.test(anchor);
}

/**
 * Same-document links (`[text](#anchor)`): every anchor must be a block id
 * or a heading id of this document. Links to other documents need the whole
 * document set and are checked by `resolveRefs`.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function lintLocalLinks(doc: Document, file: string): Diagnostic[] {
  const links = proseLinks(doc);
  if (links.length === 0) return [];
  const anchors = docAnchors(doc);
  const out: Diagnostic[] = [];
  for (const link of links) {
    const target = resolveLinkTarget(link.href, doc.slug);
    if (target === undefined || !target.local || target.anchor === undefined) continue;
    if (hasAnchor(anchors, target.anchor)) continue;
    out.push(danglingLink(file, link, target, 'anchor', [...anchors]));
  }
  return out;
}
