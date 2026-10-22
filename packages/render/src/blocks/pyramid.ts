/**
 * Renders a pyramid diagram (top → bottom widening bands) inside the diagram
 * frame (tag PYRAMID), like its sibling figures. The apex is a flat
 * trapezoid (not a zero-width point) so even the top band fits its label.
 *
 * Skin (`DESIGN.md`): one hue, one ramp — every band is a mix of
 * `hue-blue` into `paper`, strongest at the apex and fading toward the base,
 * with a `hue-blue` outline. The mixes stay light enough (in both themes)
 * that `ink` text clears 4.5:1 on every band, so the label never changes
 * colour. The pyramid spends no accent.
 *
 * Text: the label wraps to two lines and the `desc` to two lines, both to
 * the band's narrow (top) edge; every band takes the height its tallest text
 * needs. A label or desc too long for that is cut with "…" and kept whole in
 * the band's `<title>`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { fitText, type Font } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type PyramidData = BlockDataMap['pyramid'];

const W = 560;
const TOP = 12;
const GAP = 4;
const PAD = 12;
const MAX_W = 480;
/** A wide flat apex, so even the top band's label fits. */
const MIN_TOP = 250;
/** The `.pyr-label` (12.5px bold display) and `.pyr-desc` (10px body) type, for the width estimate. */
const LABEL_FONT: Font = { size: 12.5, weight: 700 };
const DESC_FONT: Font = { size: 10 };
const LABEL_LH = 14;
const DESC_LH = 12;

/** The share of the hue in band `i` of `n`: strongest at the apex, faintest at the base. */
export function pyramidMix(i: number, n: number): number {
  const hi = 36;
  const lo = 8;
  return n <= 1 ? hi : Math.round(hi - ((hi - lo) * i) / (n - 1));
}

/** Wraps `text` into at most `lines` lines of `width` px; the last ends with "…" (and the cut is reported) when it does not fit. */
function fitLines(text: string, width: number, lines: number, font: Font, path: string): { lines: string[]; cut: boolean } {
  const w = fitText(text, { width, font, maxLines: lines, report: { field: path.endsWith('desc') ? 'desc' : 'label', path } });
  return { lines: w.lines, cut: w.truncated };
}

export function renderPyramid(data: PyramidData): string {
  const levels = data.levels ?? [];
  const n = Math.max(levels.length, 1);
  const apex = W / 2;
  const wAt = (k: number): number => MIN_TOP + (MAX_W - MIN_TOP) * (k / n);

  // Text first: each band's lines, fitted to its narrow (top) edge.
  const texts = levels.map((L, i) => {
    const narrow = wAt(i) - 28;
    const label = fitLines(L.label, narrow, 2, LABEL_FONT, `levels.${i}.label`);
    const desc = L.desc !== undefined && L.desc !== '' ? fitLines(L.desc, narrow, 2, DESC_FONT, `levels.${i}.desc`) : { lines: [], cut: false };
    return { label, desc };
  });
  const need = Math.max(0, ...texts.map((t) => t.label.lines.length * LABEL_LH + t.desc.lines.length * DESC_LH));
  const rowH = Math.max(46, Math.min(78, Math.floor(300 / n)), need + 18);
  const H = TOP + levels.length * (rowH + GAP) - (levels.length > 0 ? GAP : 0) + PAD;

  const bands = levels
    .map((L, i) => {
      const y = TOP + i * (rowH + GAP);
      const wTop = wAt(i);
      const wBot = wAt(i + 1);
      const t = texts[i] ?? { label: { lines: [L.label], cut: false }, desc: { lines: [], cut: false } };
      const block = t.label.lines.length * LABEL_LH + t.desc.lines.length * DESC_LH;
      const y0 = y + rowH / 2 - block / 2 + 10.5;
      const mix = pyramidMix(i, levels.length);
      const fill = `color-mix(in srgb, var(--hue-blue) ${mix}%, var(--paper))`;
      const title = t.label.cut || t.desc.cut ? `<title>${escapeHtml(L.desc !== undefined ? `${L.label} — ${L.desc}` : L.label)}</title>` : '';
      const labelEls = t.label.lines
        .map((ln, j) => `<text x="${apex}" y="${y0 + j * LABEL_LH}" class="pyr-label">${escapeHtml(ln)}</text>`)
        .join('');
      const descY = y0 + t.label.lines.length * LABEL_LH - 1;
      const desc =
        t.desc.lines.length > 0
          ? `<text x="${apex}" y="${descY}" class="pyr-desc"${bp(`levels.${i}.desc`)}>${t.desc.lines
              .map((ln, j) => (j === 0 ? escapeHtml(ln) : `<tspan x="${apex}" y="${descY + j * DESC_LH}">${escapeHtml(ln)}</tspan>`))
              .join('')}</text>`
          : '';
      return (
        `<g${bp(`levels.${i}`)}>` +
        title +
        `<polygon points="${apex - wTop / 2},${y} ${apex + wTop / 2},${y} ${apex + wBot / 2},${y + rowH} ${apex - wBot / 2},${y + rowH}" style="fill:${fill}" stroke="var(--hue-blue)" stroke-width="1" stroke-linejoin="round"/>` +
        labelEls +
        desc +
        `</g>`
      );
    })
    .join('');

  const svg = `<svg viewBox="0 0 ${W} ${Math.max(H, 40)}" role="img"><title>Pyramid</title><g${bl('levels')}>${bands}</g></svg>`;
  return diagramFrame(
    {
      tag: 'PYRAMID',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    svg,
  );
}
