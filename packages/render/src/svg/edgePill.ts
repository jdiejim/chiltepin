/**
 * Renders an SVG edge label as a small rounded pill, sized to the label text.
 *
 * Returned as an SVG `<g>` fragment so it can be appended inside an enclosing
 * `<svg>`. Returns the empty string if `label` is falsy.
 *
 * Ported from `resources/doc-studio.jsx` `EdgePill`.
 */

import { escapeHtml } from '../escape.js';
import { DECORATIVE } from './decorative.js';

/** Pill placement (midpoint of the labelled edge). */
export interface PillPoint {
  readonly lx: number;
  readonly ly: number;
}

/**
 * @param p - Midpoint of the edge (typically from {@link ortho}).
 * @param label - Label text. Empty/undefined yields an empty string.
 * @param err - If true, the label is rendered in the error style.
 */
export function edgePill(p: PillPoint, label: string | undefined, err = false): string {
  if (label === undefined || label === '') return '';
  const w = Math.max(26, label.length * 5.4);
  const errClass = err ? ' err' : '';
  return (
    `<g>` +
    `<rect x="${p.lx - w / 2}" y="${p.ly - 9}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"${DECORATIVE}/>` +
    `<text x="${p.lx}" y="${p.ly + 3}" class="edge-label${errClass}">${escapeHtml(label)}</text>` +
    `</g>`
  );
}

/** Approximate advance of one `.t-arrow` character (9.5px mono, .04em tracking). */
export const ARROW_CHAR_W = 6;
/** Line pitch of a two-line edge label (px). */
export const ARROW_LINE_H = 12;

/** The paper mask an edge label needs: even width, so its x stays whole. */
export function edgeMaskSize(lines: readonly string[]): { w: number; h: number } {
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const w = Math.round(longest * ARROW_CHAR_W + 8);
  return { w: w + (w % 2), h: 14 + Math.max(0, lines.length - 1) * ARROW_LINE_H };
}

/**
 * The skin's edge label: `.t-arrow` on a plain `paper` mask (no pill outline)
 * so the text sits in a gap of the line it rides. `accent` colours the label
 * like its edge; `err` uses `negative`. An array draws one line per entry
 * (an edge label wraps to two lines at most), centred on `p`.
 */
export function edgeMask(
  p: PillPoint,
  label: string | readonly string[] | undefined,
  tone: 'muted' | 'error' | 'accent' = 'muted',
): string {
  if (label === undefined || label === '' || label.length === 0) return '';
  const lines = typeof label === 'string' ? [label] : label;
  const { w, h } = edgeMaskSize(lines);
  const cls = tone === 'error' ? ' c-negative' : tone === 'accent' ? ' c-accent' : '';
  const texts = lines
    .map((ln, j) => {
      const y = p.ly + 3.5 + (j - (lines.length - 1) / 2) * ARROW_LINE_H;
      return `<text x="${p.lx}" y="${y}" class="t-arrow${cls}" text-anchor="middle">${escapeHtml(ln)}</text>`;
    })
    .join('');
  return `<g>` + `<rect x="${p.lx - w / 2}" y="${p.ly - h / 2}" width="${w}" height="${h}" fill="var(--paper)"/>` + texts + `</g>`;
}
