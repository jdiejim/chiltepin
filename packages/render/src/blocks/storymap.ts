/**
 * Renders a storymap — user story mapping. The backbone (the journey's
 * ordered activities) runs across the top as emphasized step cards; each
 * release slice is a horizontal band under it, with the slice label as a
 * left-side row header and the slice's cards stacked vertically under the
 * backbone step they belong to.
 *
 * Layout is plain HTML flex rows whose step columns share the row equally
 * (`flex: 1 1 0`) down to a {@link COL_MIN} floor, so columns align across
 * bands, fill the page when it is wide, rows grow with their tallest cell,
 * and nothing can overlap. Only when the floor no longer fits does the grid
 * scroll horizontally inside its own container; the slice-label gutter is
 * sticky-left and the backbone row is sticky-top (pure CSS), so cards keep
 * their context on a long scroll.
 * Card titles clamp to two lines with an ellipsis (CSS); any card that can
 * hit the clamp carries its full text in a `title` attribute.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

/** The narrowest a step column may get (px) before the grid scrolls; `css.ts` carries the same floor. */
const COL_MIN = 132;
/** Fixed slice-label column width (px). */
const LABEL_W = 128;

/**
 * Past this many characters the two clamped lines can start dropping text
 * (~2 × 20-char lines at the fixed card width) — add a full-text title attr.
 */
const CLAMP_HINT = 40;

type Card = BlockDataMap['storymap']['slices'][number]['cells'][number][number];

/** String and object cards normalize to one shape. */
function asCard(c: Card): { title: string; tag?: string | undefined } {
  return typeof c === 'string' ? { title: c } : c;
}

export function renderStorymap(data: BlockDataMap['storymap']): string {
  const n = data.backbone.length;
  const rowW = LABEL_W + n * COL_MIN;

  // Backbone header row: one paper step card per activity — an eyebrow with
  // the step number, the activity as the name, the note as a sublabel.
  let head = `<div class="sm-row sm-head"${bl('backbone')} style="min-width:${rowW}px">`;
  head += `<div class="sm-gutter"></div>`;
  data.backbone.forEach((step, i) => {
    const long = step.label.length > CLAMP_HINT;
    head += `<div class="sm-colcell"><div class="sm-step"${bp(`backbone.${i}`)}${long ? ` title="${escapeHtml(step.label)}"` : ''}>`;
    head += `<span class="t-eyebrow sm-step-eyebrow">Step ${i + 1}</span>`;
    head += `<div class="sm-step-label t-name"${bp(`backbone.${i}.label`)}>${escapeHtml(step.label)}</div>`;
    if (step.note !== undefined) {
      head += `<div class="sm-step-note">${escapeHtml(step.note)}</div>`;
    }
    head += `</div></div>`;
  });
  head += `</div>`;

  // One band per slice: label column + one cell (card stack) per step. The
  // first slice (the nearest release) is the map's one accent.
  let bands = `<div${bl('slices')}>`;
  data.slices.forEach((slice, si) => {
    bands += `<div class="sm-row sm-band${si === 0 ? ' sm-band-first' : ''}"${bp(`slices.${si}`)} style="min-width:${rowW}px">`;
    bands += `<div class="sm-gutter sm-slice"${bp(`slices.${si}.label`)}>${escapeHtml(slice.label)}</div>`;
    slice.cells.forEach((cell, ci) => {
      bands += `<div class="sm-colcell sm-cell"${bl(`slices.${si}.cells.${ci}`)}>`;
      cell.forEach((raw, k) => {
        const card = asCard(raw);
        const long = card.title.length > CLAMP_HINT;
        bands += `<div class="sm-card"${bp(`slices.${si}.cells.${ci}.${k}`)}${long ? ` title="${escapeHtml(card.title)}"` : ''}>`;
        bands += `<div class="sm-card-title">${escapeHtml(card.title)}</div>`;
        if (card.tag !== undefined) {
          bands += `<span class="sm-card-tag">${escapeHtml(card.tag)}</span>`;
        }
        bands += `</div>`;
      });
      bands += `</div>`;
    });
    bands += `</div>`;
  });
  bands += `</div>`;

  const inner = `<div class="storymap"><div class="sm-scroll">${head}${bands}</div></div>`;

  return diagramFrame(
    {
      tag: 'STORY MAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
