/**
 * Renders a parsed {@link Document} to a standalone HTML string.
 *
 * - Inlines the house CSS in `<style>` so the output is self-contained.
 * - Wraps the body in `<div class="docskin">` so the CSS rules apply.
 * - Emits internal `themeVars` overrides (if any) as CSS variables on `:root`.
 * - Dark is the look. `colorScheme: 'light'` stamps `data-theme="light"` on
 *   `<html>`; `'system'` adds the media rule that lets the OS choose.
 *
 * The actual rendering is done by {@link renderDocumentParts} (in `parts.ts`);
 * this function just wraps those parts into a full HTML page. Embedding
 * consumers (e.g. a React app) should use `renderDocumentParts` directly.
 *
 * @example
 * ```ts
 * import { parseDocument } from 'chiltepin-core';
 * import { renderDocument } from 'chiltepin-render';
 *
 * const html = renderDocument(parseDocument(md, 'orders'));
 * ```
 */

import type { Document } from 'chiltepin-core';
import { FAVICON_LINK } from './brand.js';
import { escapeHtml } from './escape.js';
import { renderToc, wantsToc } from './outline.js';
import { renderDocumentSegments, type RenderPartsOptions } from './parts.js';
import { systemSchemeCss } from './css.js';

/** The `<html>` attribute and extra `<style>` a colour scheme needs. */
export function schemeMarkup(scheme: RenderPartsOptions['colorScheme']): { stamp: string; style: string } {
  if (scheme === 'light') return { stamp: ' data-theme="light"', style: '' };
  if (scheme === 'system') return { stamp: '', style: `<style>${systemSchemeCss}</style>` };
  return { stamp: '', style: '' };
}

/** Options for {@link renderDocument}. */
export type RenderOptions = RenderPartsOptions;

/**
 * Renders a document to a standalone HTML page.
 *
 * @param doc - The parsed Chiltepin document.
 * @param opts - Optional render options (internal variable overrides).
 * @returns A complete HTML string (`<!doctype html>…</html>`).
 */
export function renderDocument(doc: Document, opts: RenderOptions = {}): string {
  const parts = renderDocumentSegments(doc, opts);
  const themeBlock =
    parts.themeVars.length > 0 ? `\n<style>:root{${parts.themeVars}}</style>` : '';
  const scheme = schemeMarkup(opts.colorScheme);
  const segments = parts.segments.map((s) => s.html).join('');
  // A long document gets contents: a sticky rail beside the text on wide
  // screens, a collapsed list above the first section below that.
  const toc = wantsToc(doc, parts.outline) ? renderToc(parts.outline) : undefined;
  const main =
    toc !== undefined
      ? `<div class="doc-grid"><div class="doc-main">${toc.inline}${segments}` +
        `<p class="doc-end"><a href="#doc-top">Back to top</a></p></div>${toc.rail}</div>`
      : segments;
  return (
    `<!doctype html>\n` +
    `<html lang="en"${scheme.stamp}>\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${escapeHtml(parts.title)}</title>\n` +
    socialMeta(parts.title, doc.meta?.subtitle) +
    `${FAVICON_LINK}\n` +
    `<style>${parts.css}</style>` +
    themeBlock +
    scheme.style +
    `\n</head>\n` +
    `<body>\n` +
    `<div class="docskin${toc !== undefined ? ' has-toc' : ''}" id="doc-top">\n` +
    parts.defs +
    parts.cover +
    main +
    `</div>\n` +
    `</body>\n` +
    `</html>\n`
  );
}

/**
 * The page's description for search results and link previews: the cover's
 * subtitle as `<meta name="description">` and the Open Graph pair.
 */
function socialMeta(title: string, subtitle: string | undefined): string {
  const desc =
    subtitle !== undefined && subtitle.trim() !== ''
      ? `<meta name="description" content="${escapeHtml(subtitle)}">\n` +
        `<meta property="og:description" content="${escapeHtml(subtitle)}">\n`
      : '';
  return (
    desc +
    `<meta property="og:title" content="${escapeHtml(title)}">\n` +
    `<meta property="og:type" content="article">\n`
  );
}
