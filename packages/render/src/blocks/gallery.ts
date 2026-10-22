/**
 * Renders a `gallery` block — a true grid (2 columns by default) of cells. Each
 * cell is one of: a syntax-highlighted code snippet, a plain note (title +
 * caption), or a **nested block** (e.g. a `c4` / `block` / `belogic` diagram) so
 * you can compare several architectures side by side. Set `cols` to control the
 * column count (2 for a bug grid, 3–4 for a comparison).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { highlightCode } from '../highlight.js';
import { bl, bp } from '../paths.js';
// Same-package cycle: the registry imports this renderer, and we use the registry
// only at call time (renderNested), by which point it's fully initialised.
import { htmlRenderers } from '../registry.js';
import { MIN_STAGE_SCALE, svgWidth } from './frame.js';

/** The page column a gallery lays out in, in px (the default page width less its gutters). */
const COLUMN_PX = 1068;
/** Grid gap between cells, in px (`.gl-grid` in css.ts). */
const GAP_PX = 14;
/** A frame's own side padding plus the stage inset, in px. */
const FRAME_PAD_PX = 50;

/**
 * True when a nested drawing would shrink below the stage scale floor in one
 * grid cell — it then takes the whole row instead of rendering at 40%.
 */
export function needsFullRow(drawingWidth: number, cols: number): boolean {
  if (cols <= 1 || drawingWidth <= 0) return false;
  const cell = (COLUMN_PX - GAP_PX * (cols - 1)) / cols - FRAME_PAD_PX;
  return drawingWidth * MIN_STAGE_SCALE > cell;
}

type GalleryData = BlockDataMap['gallery'];
type GalleryItem = GalleryData['items'][number];

/** Renders a nested block (a `{ type, ...data }` cell) via the HTML registry. */
function renderNested(block: { readonly type: string }): string {
  const data: Record<string, unknown> = { ...block };
  delete data.type;
  const fn = (htmlRenderers as unknown as Record<string, (d: unknown) => string>)[block.type];
  return fn !== undefined ? fn(data) : '';
}

function renderCard(item: GalleryItem, i: number, cols: number): string {
  const accent = item.accent !== undefined ? ` gl-${item.accent}` : '';
  const title =
    item.title !== undefined
      ? `<div class="gl-card-title"${bp(`items.${i}.title`)}>${escapeHtml(item.title)}</div>`
      : '';
  const caption =
    item.caption !== undefined
      ? `<div class="gl-cap"${bp(`items.${i}.caption`)}>${escapeHtml(item.caption)}</div>`
      : '';

  // A nested diagram cell — the diagram brings its own frame, so no card chrome.
  // A drawing too wide for its cell takes the whole row (see needsFullRow).
  if (item.block !== undefined) {
    const nested = renderNested(item.block);
    const wide = needsFullRow(svgWidth(nested), cols) ? ' gl-span' : '';
    return `<div class="gl-cell${wide}${accent}"${bp(`items.${i}`)}>${title}${nested}${caption}</div>`;
  }
  // A code cell.
  if (item.code !== undefined) {
    const header =
      item.title !== undefined || item.lang !== undefined
        ? `<div class="code-header"><span>${escapeHtml(item.title ?? '')}</span><span>${escapeHtml(item.lang ?? '')}</span></div>`
        : '';
    return `<div class="gl-card gl-code${accent}"${bp(`items.${i}`)}>${header}<pre${bp(`items.${i}.code`)}>${highlightCode(item.code, item.lang)}</pre>${caption}</div>`;
  }
  // A plain note cell.
  return `<div class="gl-card${accent}"${bp(`items.${i}`)}>${title}${caption}</div>`;
}

export function renderGallery(data: GalleryData): string {
  const head = data.title !== undefined ? `<div class="gl-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="gl-desc">${escapeHtml(data.description)}</p>` : '';
  const cols = data.cols !== undefined && data.cols > 0 ? Math.floor(data.cols) : 2;
  const style = ` style="--gl-cols:${cols}"`;
  const cards = data.items.map((item, i) => renderCard(item, i, cols)).join('');
  return `<div class="gallery">${head}${desc}<div class="gl-grid"${style}${bl('items')}>${cards}</div></div>`;
}
