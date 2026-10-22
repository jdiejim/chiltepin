/**
 * Renders a user-journey map — a table of touchpoints across stages, plus an
 * optional emotion curve (SVG polyline) showing user sentiment per stage.
 *
 * The curve is the table's last row: its cell spans the stage columns, which
 * share one fixed width, so each dot sits over the centre of its stage. The
 * curve reads around a dashed neutral midline. Values may run 0…1 (0.5 is
 * neutral) or −1…1 (0 is neutral): any value below 0 selects the −1…1 scale.
 *
 * Skin (`DESIGN.md`): the curve is an ink line; each stage's dot tells the
 * sentiment by fill rather than hue — a high point is solid ink, a middling
 * one is a hollow paper dot, and a low point is `negative`, the one place a
 * real problem may be coloured. A legend under the table names the fills
 * present. The block sits in its own frame and scrolls sideways on a phone
 * instead of squeezing the stages.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DECORATIVE } from '../svg/decorative.js';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

type Mood = 'high' | 'mid' | 'low';

/** The mood of a value on the 0…1 scale (0.5 neutral). */
function moodOf(t: number): Mood {
  return t >= 0.6 ? 'high' : t <= 0.35 ? 'low' : 'mid';
}

/** Width of one stage column in the curve's viewBox units. */
const STAGE_W = 150;
/** Height of the curve's viewBox. */
const CURVE_H = 96;
/** Vertical inset that keeps a dot at ±1 inside the box. */
const CURVE_PAD = 14;

// A `paper` ring keeps a dot legible where it crosses the curve — a halo, not
// a boundary, so it is decoration; the dot's FILL is the mark.
const DOT_ATTRS: Record<Mood, string> = {
  high: `fill="var(--ink)" stroke="var(--paper)" stroke-width="1.5"${DECORATIVE}`,
  mid: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"',
  low: `fill="var(--negative)" stroke="var(--paper)" stroke-width="1.5"${DECORATIVE}`,
};

const MOOD_LEGEND: Record<Mood, LegendItem> = {
  high: { swatch: 'fill', fill: 'var(--ink)', label: 'positive' },
  mid: { swatch: 'node', label: 'neutral' },
  low: { swatch: 'fill', fill: 'var(--negative)', label: 'negative' },
};

export function renderJourney(data: BlockDataMap['journey']): string {
  const stages = data.stages ?? [];
  const rows = data.rows ?? [];
  const emotion = data.emotion ?? [];
  const n = Math.max(stages.length, emotion.length, 1);
  // Any value below zero means the author wrote the −1…1 scale.
  const signed = emotion.some((v) => v < 0);
  const norm = (v: number): number => (signed ? (clamp(v, -1, 1) + 1) / 2 : clamp(v, 0, 1));
  const W = n * STAGE_W;
  const ex = (i: number): number => STAGE_W * (i + 0.5);
  const ey = (t: number): number => CURVE_PAD + (1 - t) * (CURVE_H - CURVE_PAD * 2);

  const cols = `<colgroup><col class="jr-col-label">${'<col>'.repeat(n)}</colgroup>`;
  const head =
    `<tr${bl('stages')}><th></th>` +
    stages.map((s, i) => `<th class="c"${bp(`stages.${i}`)}>${escapeHtml(s.label)}</th>`).join('') +
    `</tr>`;
  const body = rows
    .map(
      (r, ri) =>
        `<tr${bp(`rows.${ri}`)}><td class="lead"${bp(`rows.${ri}.label`)}>${escapeHtml(r.label)}</td>` +
        (r.cells ?? [])
          .map((c, ci) => `<td class="c"${bp(`rows.${ri}.cells.${ci}`)}>${escapeHtml(c)}</td>`)
          .join('') +
        `</tr>`,
    )
    .join('');

  let curve = '';
  let legend = '';
  if (emotion.length > 0) {
    const moods = new Set<Mood>();
    const points = emotion.map((v, i) => `${ex(i)},${ey(norm(v))}`).join(' ');
    const dots = emotion
      .map((v, i) => {
        const mood = moodOf(norm(v));
        moods.add(mood);
        return `<circle cx="${ex(i)}" cy="${ey(norm(v))}" r="5" ${DOT_ATTRS[mood]}${bp(`emotion.${i}`)}/>`;
      })
      .join('');
    const mid = ey(0.5);
    curve =
      `<tbody class="jr-emo"><tr>` +
      `<th scope="row" class="jr-emo-label t-eyebrow">Emotion</th>` +
      `<td class="jr-emo-cell" colspan="${n}">` +
      `<svg viewBox="0 0 ${W} ${CURVE_H}" role="img"><title>Emotion curve</title>` +
      `<line x1="0" y1="${mid}" x2="${W}" y2="${mid}" class="jr-mid"${DECORATIVE}/>` +
      `<polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<g${bl('emotion')}>${dots}</g>` +
      `</svg></td></tr></tbody>`;
    legend = renderLegend(
      (['high', 'mid', 'low'] as const).filter((m) => moods.has(m)).map((m) => MOOD_LEGEND[m]),
    );
  }

  return (
    `<div class="jr">` +
    `<div class="jr-scroll"><table class="pres-table jr-table" style="--jr-stages:${n}">` +
    `${cols}<thead>${head}</thead><tbody${bl('rows')}>${body}</tbody>${curve}</table></div>` +
    legend +
    `</div>`
  );
}
