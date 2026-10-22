/**
 * Renders a `context` block — a context-window token budget, in pure SVG
 * inside the diagram frame (tag CONTEXT). One horizontal stacked bar sized
 * against `window`: segments left-to-right proportional to their tokens.
 *
 * - **Colour.** A segment with an `accent` takes that colour's token; the
 *   rest take the series ramp, then the category hues. Two neighbours never
 *   share a colour.
 * - **Labels.** A segment wide enough carries its label on a paper mask; a
 *   narrower one carries the label cut with "…" (full text in a `<title>`),
 *   or its index numeral — the key to the legend row under the bar, which
 *   always shows the whole label.
 * - **Free space.** Room left in the window renders as a paper-2 "free (N)"
 *   segment. At 90% or more of the window, an amber "near limit" chip marks
 *   the window edge.
 * - **Over budget.** When the segments sum past the window, every segment
 *   still draws; the part past the dashed window boundary takes a negative
 *   hatch, and a chip says by how much — the prompt does not fit, an error.
 *
 * Zero-token segments are skipped; sums that hit the window exactly draw no
 * free segment.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { ellipsize, textWidth, type Font } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type ContextData = BlockDataMap['context'];
type Segment = ContextData['segments'][number];

/**
 * Accent name → colour token. Each name has its own token, so two segments
 * the author coloured differently never draw alike; `red` is the rose hue,
 * not the negative (that one marks the over-budget error).
 */
const ACCENT_TOKEN: Record<string, string> = {
  navy: 'var(--series-2)',
  blue: 'var(--hue-blue)',
  teal: 'var(--hue-teal)',
  green: 'var(--hue-green)',
  amber: 'var(--hue-amber)',
  purple: 'var(--hue-violet)',
  red: 'var(--hue-rose)',
  gray: 'var(--ink-3)',
};

/** Default colour cycle when a segment carries no accent: the series ramp, then the category hues. */
const CYCLE = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--hue-blue)',
  'var(--hue-amber)',
  'var(--hue-violet)',
  'var(--hue-teal)',
  'var(--hue-green)',
  'var(--hue-rose)',
];

/**
 * The fill of every segment, in bar order: an authored accent as written,
 * else the next cycle colour — skipping any colour the left neighbour has or
 * the right neighbour's accent claims, so neighbours always differ.
 */
function segmentColors(accents: readonly (string | undefined)[]): string[] {
  const out: string[] = [];
  let k = 0;
  accents.forEach((a, i) => {
    const own = a !== undefined ? ACCENT_TOKEN[a] : undefined;
    if (own !== undefined) {
      out.push(own);
      return;
    }
    const prev = out[i - 1];
    const nextA = accents[i + 1];
    const next = nextA !== undefined ? ACCENT_TOKEN[nextA] : undefined;
    let c = CYCLE[k % CYCLE.length] ?? 'var(--series-1)';
    for (let tries = 0; tries < CYCLE.length && (c === prev || c === next); tries++) {
      k++;
      c = CYCLE[k % CYCLE.length] ?? 'var(--series-1)';
    }
    out.push(c);
    k++;
  });
  return out;
}

/** `.ctx-seg-label`: 10px mono 600. */
const SEG_FONT: Font = { size: 10, mono: true, weight: 600 };
/** `.ctx-window-label`: 10px mono 500, `.06em`. */
const WINDOW_FONT: Font = { size: 10, mono: true, weight: 500, tracking: 0.06 };
/** `.ctx-chip`: 9.5px mono 600. */
const CHIP_FONT: Font = { size: 9.5, mono: true, weight: 600 };
/** A cut in-bar label keeps at least this many characters before the "…"; else the index shows. */
const MIN_CUT_CHARS = 5;

/**
 * A label on a paper mask: series fills are mid-tone, so no text reads on
 * them directly (DESIGN.md: labels sit on a paper mask, never on a fill).
 */
function maskedLabel(cx: number, cy: number, text: string, title = ''): string {
  const w = 10 + textWidth(text, SEG_FONT);
  return (
    `<rect x="${Math.round(cx - w / 2)}" y="${cy - 8}" width="${Math.round(w)}" height="16" rx="3" class="ctx-seg-mask"/>` +
    `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" class="ctx-seg-label">${title}${escapeHtml(text)}</text>`
  );
}

/**
 * The in-bar label of a segment `w` px wide: the whole label when it fits,
 * else the label cut with "…" (its full text in a `<title>`), else the
 * index numeral that keys the legend row, else nothing. The legend row
 * always shows the whole label, so an in-bar cut drops no text.
 */
function segmentLabel(cx: number, cy: number, w: number, label: string, index: number): string {
  const room = w - 16;
  if (textWidth(label, SEG_FONT) <= room) return maskedLabel(cx, cy, label);
  const cut = ellipsize(label, room, SEG_FONT);
  const shown = cut.lines[0] ?? '';
  if ([...shown].length - 1 >= MIN_CUT_CHARS) {
    return maskedLabel(cx, cy, shown, `<title>${escapeHtml(label)}</title>`);
  }
  if (w >= 22) return maskedLabel(cx, cy, String(index), `<title>${escapeHtml(label)}</title>`);
  return '';
}

const WIDTH = 820;
const BAR_H = 34;
const RADIUS = 8;
const TOP = 22;
/** The share of the window from which the bar marks "near limit". */
const NEAR_LIMIT = 0.9;

/** Clamps negatives / non-finite values to 0. */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a token count with thousands separators. */
const fmt = (v: number): string => Math.round(v).toLocaleString('en-US');

/**
 * A bar-segment path with independently rounded left / right corners, so the
 * stacked bar keeps its 8px radius at the outer edges only.
 */
function segPath(x: number, w: number, y: number, h: number, rl: number, rr: number): string {
  return (
    `M${x + rl} ${y} H ${x + w - rr}` +
    (rr > 0 ? ` a ${rr} ${rr} 0 0 1 ${rr} ${rr}` : '') +
    ` V ${y + h - rr}` +
    (rr > 0 ? ` a ${rr} ${rr} 0 0 1 -${rr} ${rr}` : '') +
    ` H ${x + rl}` +
    (rl > 0 ? ` a ${rl} ${rl} 0 0 1 -${rl} -${rl}` : '') +
    ` V ${y + rl}` +
    (rl > 0 ? ` a ${rl} ${rl} 0 0 1 ${rl} -${rl}` : '') +
    ` Z`
  );
}

export function renderContext(data: ContextData): string {
  const unit = data.unit ?? 'tokens';
  const window = pos(data.window);
  // Keep each segment's source index (`si`) for the data-path attributes; the
  // colour cycle stays keyed on the filtered position.
  const segments = data.segments
    .map((seg: Segment, si) => ({ seg, si }))
    .filter(({ seg }) => pos(seg.tokens) > 0);
  const colors = segmentColors(segments.map(({ seg }) => seg.accent));
  const colorAt = (i: number): string => colors[i] ?? 'var(--series-1)';
  const sum = segments.reduce((acc, { seg }) => acc + pos(seg.tokens), 0);
  const over = window > 0 && sum > window;
  const free = window > 0 && sum < window ? window - sum : 0;
  const near = window > 0 && !over && sum >= window * NEAR_LIMIT;
  const scaleMax = Math.max(window, sum, 1);
  const px = (v: number): number => Math.round((WIDTH * v) / scaleMax);

  const height = TOP + BAR_H + 8;
  const hatchId = `ctx-over-${Math.round(window)}-${Math.round(sum)}`;
  let s = `<svg viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img"><title>Context window</title>`;
  if (over) {
    // The over-budget hatch: negative diagonals, open between, so the
    // segments under it still read.
    s +=
      `<defs><pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="6" height="6" fill="var(--paper)" fill-opacity="0.25"/>` +
      `<line x1="0" y1="0" x2="0" y2="6" stroke="var(--negative)" stroke-width="2.2"/></pattern></defs>`;
  }

  // The window summary: top-right, or at the boundary when the bar runs past it.
  const windowText = `window: ${fmt(window)} ${unit}`;
  const windowW = textWidth(windowText, WINDOW_FONT);
  const bx = px(window);
  const overText = over ? `over budget · +${fmt(sum - window)}` : near ? 'near limit' : '';
  const chipW = overText !== '' ? Math.ceil(textWidth(overText, CHIP_FONT) + 20) : 0;
  // The chip sits just right of the boundary when it fits there, else left of
  // it; the window label sits left of whatever is at the boundary.
  const chipRight = bx + 6 + chipW <= WIDTH;
  const chipX = chipRight ? bx + 6 : Math.max(0, bx - 6 - chipW);
  const windowEnd =
    overText === '' ? WIDTH : chipRight ? (over || near ? Math.max(windowW, bx - 6) : WIDTH) : Math.max(windowW, chipX - 8);
  s += `<text x="${Math.round(windowEnd)}" y="${TOP - 8}" text-anchor="end" class="ctx-window-label"${bp('window')}>${escapeHtml(windowText)}</text>`;

  // Stacked segments — every one, also past the window.
  let running = 0;
  const labels: string[] = [];
  s += `<g${bl('segments')}>`;
  segments.forEach(({ seg, si }, i) => {
    const v = pos(seg.tokens);
    const x = px(running);
    const w = Math.max(px(running + v) - x, 2);
    const first = i === 0;
    const last = i === segments.length - 1 && free === 0;
    s += `<path d="${segPath(x, w, TOP, BAR_H, first ? RADIUS : 0, last ? RADIUS : 0)}" fill="${colorAt(i)}"${bp(`segments.${si}`)}/>`;
    labels.push(segmentLabel(x + Math.round(w / 2), TOP + Math.round(BAR_H / 2), w, seg.label, i + 1));
    running += v;
  });
  s += `</g>`; // close the segments list container

  // Free space (dim) — only when the segments leave room.
  if (free > 0) {
    const x = px(sum);
    const w = Math.max(WIDTH - x, 2);
    s += `<path d="${segPath(x, w, TOP, BAR_H, segments.length === 0 ? RADIUS : 0, RADIUS)}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>`;
    const freeText = `free (${fmt(free)})`;
    if (textWidth(freeText, SEG_FONT) + 16 <= w) {
      s += `<text x="${x + Math.round(w / 2)}" y="${TOP + 21}" text-anchor="middle" class="ctx-free-label">${escapeHtml(freeText)}</text>`;
    }
  }

  // Over budget: the hatch over the part past the window, under the labels.
  if (over) {
    const ow = Math.max(WIDTH - bx, 2);
    s += `<path d="${segPath(bx, ow, TOP, BAR_H, 0, RADIUS)}" fill="url(#${hatchId})" data-decorative="1"/>`;
  }

  // In-bar labels on top of the bar (and of the hatch).
  s += labels.join('');

  if (over) {
    s += `<line x1="${bx}" y1="${TOP - 6}" x2="${bx}" y2="${TOP + BAR_H + 5}" class="ctx-boundary"/>`;
    s += `<rect x="${chipX}" y="${TOP - 20}" width="${chipW}" height="16" rx="8" class="ctx-chip-bg"/>`;
    s += `<text x="${chipX + Math.round(chipW / 2)}" y="${TOP - 8.5}" text-anchor="middle" class="ctx-chip">${escapeHtml(overText)}</text>`;
  } else if (near) {
    // Near the limit: a warning at the window's end, in amber (the negative is for the error).
    s += `<rect x="${chipX}" y="${TOP - 20}" width="${chipW}" height="16" rx="8" fill="var(--hue-amber-tint)" stroke="var(--hue-amber)" stroke-width="1"/>`;
    s += `<text x="${chipX + Math.round(chipW / 2)}" y="${TOP - 8.5}" text-anchor="middle" class="ctx-chip" fill="var(--hue-amber)" style="fill:var(--hue-amber)">${escapeHtml(overText)}</text>`;
  }

  s += `</svg>`;

  // Legend — one row per segment: numbered dot, label, tokens · %, desc.
  // Rows reuse the same `segments.N` paths as the bar (dual representation).
  const rows = segments
    .map(({ seg, si }, i) => {
      const v = pos(seg.tokens);
      const pct = window > 0 ? Math.round((v / window) * 100) : 0;
      const desc =
        seg.desc !== undefined && seg.desc.length > 0
          ? `<span class="ctx-note"${bp(`segments.${si}.desc`)}>${escapeHtml(seg.desc)}</span>`
          : '';
      return (
        `<div class="ctx-row"${bp(`segments.${si}`)}>` +
        `<span class="ctx-dot" style="background:${colorAt(i)}"></span>` +
        `<span class="ctx-idx">${i + 1}</span>` +
        `<span class="ctx-label"${bp(`segments.${si}.label`)}>${escapeHtml(seg.label)}</span>` +
        `<span class="ctx-num"${bp(`segments.${si}.tokens`)}>${escapeHtml(fmt(v))} ${escapeHtml(unit)} · ${pct}%</span>` +
        desc +
        `</div>`
      );
    })
    .join('');
  const legend =
    rows.length > 0
      ? `<div class="ctx-legend"${bl('segments')}><span class="lg-title t-eyebrow">Legend</span>${rows}</div>`
      : '';

  return diagramFrame(
    {
      tag: 'CONTEXT',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
