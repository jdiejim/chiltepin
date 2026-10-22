import { readSourceMarker, stripHeadingMarkers } from 'chiltepin-core';
import { escapeHtml } from './escape.js';
/**
 * Renders a prose segment to HTML via `marked`.
 *
 * Hardened for untrusted input (the renderer's output is shown in hosted
 * previews and the browser-side studio, which render documents from strangers):
 *
 * - Raw HTML is **not** passed through — `marked` v14 emits raw HTML by
 *   default, which is an XSS vector. We decline the block `html` and inline
 *   `tag` tokenizers so any literal `<tag>` falls through to text and is
 *   entity-escaped. This also matches Chiltepin's house rule: express structure
 *   through blocks, never raw HTML.
 * - Link / image hrefs with `javascript:`, `data:`, or `vbscript:` schemes are
 *   rewritten to `#` (see {@link safeUrl}).
 *
 * Output is deterministic: no smartypants, and heading ids come only from the
 * caller (`headingIds`, computed once per document by `parts.ts`).
 */

import { Marked, type Tokens } from 'marked';
import { safeUrl } from './sanitize.js';

const marked = new Marked({ gfm: true, breaks: false });

/**
 * Ids for the `##` / `###` headings of the prose run being rendered, in
 * order. Set by {@link renderProse} for one synchronous parse, then cleared;
 * empty means "no ids" (slides, inline fields).
 */
let pendingIds: string[] = [];

/** The `##` / `###` levels that take an anchor id (the doc outline). */
function isOutlineDepth(depth: number): boolean {
  return depth === 2 || depth === 3;
}

marked.use({
  tokenizer: {
    // Decline raw HTML at both block and inline level; the text falls through
    // to the paragraph/text tokenizer, which escapes it.
    html(): undefined {
      return undefined;
    },
    tag(): undefined {
      return undefined;
    },
  },
  renderer: {
    heading(token: Tokens.Heading): string {
      // Heading markers (`{split}`, `{top}`, `{source: …}`) address the slide,
      // not the text — a page strips them. The source is the exception: the
      // author wrote provenance, so the page prints it under the heading, the
      // way the deck prints it in the slide footer.
      const raw = this.parser.parseInline(token.tokens);
      // An outline heading takes the next precomputed id and a `#` link that
      // shows on hover (the glyph is CSS, so the heading's text stays clean).
      const id = isOutlineDepth(token.depth) ? pendingIds.shift() : undefined;
      const idAttr = id !== undefined ? ` id="${escapeHtml(id)}"` : '';
      const anchor =
        id !== undefined
          ? `<a class="h-anchor" href="#${escapeHtml(id)}" aria-label="Link to this section"></a>`
          : '';
      if (token.depth > 2) return `<h${token.depth}${idAttr}>${raw}${anchor}</h${token.depth}>\n`;
      const text = stripHeadingMarkers(raw);
      const src = readSourceMarker(raw);
      const note =
        src !== undefined ? `<p class="src-note">Source: ${escapeHtml(src)}</p>\n` : '';
      return `<h${token.depth}${idAttr}>${text}${anchor}</h${token.depth}>\n${note}`;
    },
    link(token: Tokens.Link): string {
      const href = safeUrl(token.href);
      const title = token.title !== null && token.title !== undefined ? ` title="${token.title}"` : '';
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${href}"${title}>${text}</a>`;
    },
    image(token: Tokens.Image): string {
      const href = safeUrl(token.href);
      const title = token.title !== null && token.title !== undefined ? ` title="${token.title}"` : '';
      return `<img src="${href}" alt="${token.text}"${title}>`;
    },
  },
});

/**
 * Renders Markdown prose to an HTML string wrapped in `<div class="prose">`.
 *
 * @param text - The Markdown source.
 * @param headingIds - Ids for the run's `##` / `###` headings, in order (see
 *   {@link proseHeadings}); a heading past the end of the list gets no id.
 * @returns The HTML output, wrapped in a `prose` div for styling scope.
 */
export function renderProse(text: string, headingIds: readonly string[] = []): string {
  pendingIds = [...headingIds];
  try {
    const html = marked.parse(text, { async: false });
    return `<div class="prose">${html}</div>`;
  } finally {
    pendingIds = [];
  }
}

/** One `##` / `###` heading of a prose run, in source order. */
export interface ProseHeading {
  /** 2 for `##`, 3 for `###`. */
  readonly depth: 2 | 3;
  /** The heading's Markdown source text, with slide markers (`{split}`, `{source: …}`) removed. */
  readonly text: string;
}

/**
 * The outline headings of a prose run, in the order {@link renderProse}
 * renders them — the same tokens, so the ids line up one to one.
 */
export function proseHeadings(text: string): ProseHeading[] {
  const out: ProseHeading[] = [];
  marked.walkTokens(marked.lexer(text), (token) => {
    if (token.type !== 'heading') return;
    const h = token as Tokens.Heading;
    if (h.depth === 2 || h.depth === 3) out.push({ depth: h.depth, text: stripHeadingMarkers(h.text) });
  });
  return out;
}

/**
 * Renders a text-first field (callout body, pullquote text) as INLINE
 * Markdown — bold/italic/`code`/links work, block constructs don't. Blank
 * lines become paragraph breaks. Same hardened pipeline as {@link renderProse}
 * (raw HTML declined, hrefs sanitized).
 */
export function renderInlineMd(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const inline = (p: string): string => marked.parseInline(p, { async: false });
  if (paras.length <= 1) return inline(paras[0] ?? '');
  return paras.map((p) => `<p>${inline(p)}</p>`).join('');
}
