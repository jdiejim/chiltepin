/**
 * Renders a `timing` block — the UML timing diagram. One lane per lifeline,
 * stacked; inside a lane every distinct state gets a level (first-seen
 * order, top to bottom) and the lifeline is a step path across time, the
 * state name printed once per contiguous segment. A shared time axis runs
 * under the lanes with nice ticks in `unit`.
 *
 * `events` are dashed vertical rules across every lane (or only their own),
 * labelled at the top and staggered onto tiers so labels never overlap.
 * `constraints` are `{ label }` duration brackets drawn above the lanes.
 *
 * Skin (`DESIGN.md`): the lifeline is `muted`; a state the author marked
 * `accent: red` is drawn in `negative` (a failure state); the FIRST other
 * marked state takes the accent (one focus per diagram) and later marks draw
 * plain, so two marks never cancel each other out.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { DECORATIVE } from '../svg/decorative.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import type { Mark } from '../svg/dsTone.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { cutTitle, ellipsize, FONT } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type TimingData = BlockDataMap['timing'];

const PLOT_W = 520;
const LEVEL_H = 22;
/** The lane's label row above its levels. */
const LANE_HEAD = 18;
const LANE_PAD = 8;
const PAD_L = 14;
const PAD_R = 24;
/** One tier of event labels. */
const TIER_H = 14;
/** Approximate widths: `.t-arrow` (9.5px mono), `.t-sub` (10px mono), `.t-name` (13px Inter). */
const ARROW_CH = 6;
const SUB_CH = 6.2;
const NAME_CH = 7.4;

/** A nice tick step (1 / 2 / 2.5 / 5 × 10^n) whose tick count over `span` lands near 5. */
function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(span / 5)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestScore = Infinity;
  for (const c of candidates) {
    const n = Math.ceil(span / c - 1e-9);
    const score = n >= 4 && n <= 6 ? Math.abs(n - 5) : 10 + Math.abs(n - 5);
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/**
 * The mark of every state: `red` is `negative`; the first other marked state
 * is `focal` (the one accent); any later mark draws plain. (The shared
 * `marksOf` drops every mark when two are set — a timing diagram keeps the
 * first, because the author clearly meant one state.)
 */
export function timingMarks(accents: ReadonlyArray<string | undefined>): Mark[] {
  let focal = false;
  return accents.map((a) => {
    if (a === undefined) return undefined;
    if (a === 'red') return 'negative';
    if (focal) return undefined;
    focal = true;
    return 'focal';
  });
}


/**
 * Assigns each label a tier so no two labels on one tier overlap: sorted by
 * x, each label takes the lowest tier whose last label ends before it starts.
 */
function tiersFor(items: ReadonlyArray<{ x: number; w: number }>): number[] {
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  const ends: number[] = [];
  const out = new Array<number>(items.length).fill(0);
  for (const it of order) {
    const left = it.x - it.w / 2;
    let t = ends.findIndex((e) => e + 6 <= left);
    if (t < 0) {
      t = ends.length;
      ends.push(-Infinity);
    }
    ends[t] = it.x + it.w / 2;
    out[it.i] = t;
  }
  return out;
}

export function renderTiming(data: TimingData): string {
  const lanes = data.lanes;
  const events = data.events ?? [];
  const constraints = data.constraints ?? [];
  const unit = data.unit ?? '';
  const unitSuffix = unit.length > 2 ? ` ${unit}` : unit;

  // Levels per lane: distinct states in first-seen order.
  const levelsOf = lanes.map((ln) => {
    const seen: string[] = [];
    for (const st of ln.states) if (!seen.includes(st.state)) seen.push(st.state);
    return seen;
  });
  const allStates = lanes.flatMap((ln) => ln.states);
  const marks = timingMarks(allStates.map((st) => st.accent));

  // Time domain from every time the block mentions.
  const times = [
    ...allStates.flatMap((st) => [st.from, st.to]),
    ...events.map((e) => e.at),
    ...constraints.flatMap((c) => [c.from, c.to]),
  ];
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const step = niceStep(Math.max(tMax - tMin, 1e-9));
  const lo = round6(Math.floor(tMin / step) * step);
  const hi = round6(Math.max(Math.ceil(tMax / step) * step, lo + step));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(round6(v));

  const gutterW = Math.max(
    88,
    ...lanes.map((ln) => ln.label.length * NAME_CH + 8),
    ...levelsOf.flatMap((ls) => ls.map((l) => l.length * SUB_CH + 12)),
  );
  const x0 = PAD_L + gutterW;
  const x1 = x0 + PLOT_W;
  const xOf = (t: number): number => x0 + ((t - lo) / (hi - lo)) * PLOT_W;

  // Vertical layout: event labels, constraint brackets, lanes, axis.
  const evLabels = events.map((e) => ({ x: xOf(e.at), w: e.label.length * ARROW_CH + 10 }));
  const evTiers = tiersFor(evLabels);
  const evTierCount = events.length > 0 ? Math.max(...evTiers) + 1 : 0;
  const evBandH = evTierCount > 0 ? evTierCount * TIER_H + 8 : 0;
  const cLabels = constraints.map((c) => ({ x: (xOf(c.from) + xOf(c.to)) / 2, w: (c.label.length + 4) * ARROW_CH + 10 }));
  const cTiers = tiersFor(cLabels);
  const cTierCount = constraints.length > 0 ? Math.max(...cTiers) + 1 : 0;
  const cBandH = cTierCount > 0 ? cTierCount * 24 + 4 : 0;
  const top = 10;
  const evBandY = top;
  const cBandY = evBandY + evBandH;
  const lanesY = cBandY + cBandH;
  const laneH = (i: number): number => LANE_HEAD + (levelsOf[i]?.length ?? 1) * LEVEL_H + LANE_PAD;
  const laneTops: number[] = [];
  let y = lanesY;
  for (let i = 0; i < lanes.length; i++) {
    laneTops.push(y);
    y += laneH(i);
  }
  const lanesBot = y;
  const axisY = lanesBot + 6;
  const height = axisY + 26;
  const width = x1 + PAD_R;

  const a11y = svgName('Timing diagram', data.title, [
    countPhrase(lanes.length, 'lane'),
    countPhrase(events.length, 'event'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // Gridlines, lane separators, and the axis.
  s += `<g${DECORATIVE}>`;
  for (const t of ticks) {
    const x = xOf(t);
    s += `<line x1="${x}" y1="${lanesY}" x2="${x}" y2="${lanesBot}" stroke="var(--rule)" stroke-width="1"/>`;
  }
  for (let i = 1; i < lanes.length; i++) {
    const ly = laneTops[i] ?? 0;
    s += `<line x1="${PAD_L}" y1="${ly}" x2="${width - 8}" y2="${ly}" stroke="var(--rule)" stroke-width="1"/>`;
  }
  s += `</g>`;
  s += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
  let lastTickEnd = -Infinity;
  for (const t of ticks) {
    const label = `${fmt(t)}${unitSuffix}`;
    const w = label.length * SUB_CH;
    const x = xOf(t);
    if (x - w / 2 < lastTickEnd + 6) continue;
    s += `<text x="${x}" y="${axisY + 14}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(label)}</text>`;
    lastTickEnd = x + w / 2;
  }

  // Lanes: label row, level names in the gutter, the step path, segment labels.
  let anyNegative = false;
  let anyAccent = false;
  let stateIndex = 0;
  s += `<g${bl('lanes')}>`;
  lanes.forEach((ln, li) => {
    const levels = levelsOf[li] ?? [];
    const lt = laneTops[li] ?? 0;
    const levelY = (name: string): number => lt + LANE_HEAD + (Math.max(0, levels.indexOf(name)) + 0.5) * LEVEL_H;
    let g = `<g${bp(`lanes.${li}`)} data-levels="${levels.length}">`;
    g += `<text x="${PAD_L}" y="${lt + 13}" class="t-name"${bp(`lanes.${li}.label`)}>${escapeHtml(ln.label)}</text>`;
    for (const lv of levels) {
      g += `<text x="${x0 - 8}" y="${levelY(lv) + 3.5}" class="t-sub c-soft tg-level" text-anchor="end">${escapeHtml(lv)}</text>`;
    }
    const segs = ln.states
      .map((st, si) => ({ st, si, mark: marks[stateIndex + si] }))
      .sort((a, b) => a.st.from - b.st.from || a.si - b.si);
    stateIndex += ln.states.length;
    // The base step path through every segment.
    let d = '';
    segs.forEach((sg, k) => {
      const xa = xOf(sg.st.from);
      const xb = xOf(sg.st.to);
      const yy = levelY(sg.st.state);
      d += k === 0 ? `M ${xa} ${yy} ` : `V ${yy} `;
      if (k > 0) {
        const prev = segs[k - 1];
        const prevEnd = prev !== undefined ? xOf(prev.st.to) : xa;
        // A gap between segments: the connector runs level, then steps.
        if (xa > prevEnd + 0.5) d += `H ${xa} `;
      }
      d += `H ${xb} `;
    });
    g += `<path d="${d.trim()}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linejoin="round"/>`;
    g += `<g${bl(`lanes.${li}.states`)}>`;
    for (const sg of segs) {
      const xa = xOf(sg.st.from);
      const xb = xOf(sg.st.to);
      const yy = levelY(sg.st.state);
      const tone = sg.mark === 'negative' ? 'var(--negative)' : sg.mark === 'focal' ? 'var(--accent)' : undefined;
      if (sg.mark === 'negative') anyNegative = true;
      if (sg.mark === 'focal') anyAccent = true;
      const cls = sg.mark === 'negative' ? ' c-negative' : sg.mark === 'focal' ? ' c-accent' : '';
      // A segment too short for its state name shows it cut with "…" (the
      // full name is its level's name at the left, and the hover title);
      // too short for even two characters, it shows none. Nothing is lost,
      // so the cut is not reported.
      const room = xb - xa - 6;
      const fit =
        room >= 2 * ARROW_CH
          ? ellipsize(sg.st.state, room, FONT.arrow)
          : { lines: [], truncated: true, full: sg.st.state };
      const shown = fit.lines[0] ?? '';
      const title = cutTitle(fit);
      g +=
        `<g${bp(`lanes.${li}.states.${sg.si}`)}>` +
        (tone !== undefined ? `<line x1="${xa}" y1="${yy}" x2="${xb}" y2="${yy}" stroke="${tone}" stroke-width="2.25"/>` : '') +
        (shown !== ''
          ? `<text x="${(xa + xb) / 2}" y="${yy - 5}" class="t-arrow${cls}" text-anchor="middle">${title}${escapeHtml(shown)}</text>`
          : '') +
        `</g>`;
    }
    g += `</g></g>`;
    s += g;
  });
  s += `</g>`;

  // Constraints: `{ label }` brackets above the lanes.
  if (constraints.length > 0) {
    s += `<g${bl('constraints')}>`;
    constraints.forEach((c, ci) => {
      const xa = xOf(c.from);
      const xb = xOf(c.to);
      const tier = cTiers[ci] ?? 0;
      const by = cBandY + 4 + (cTierCount - 1 - tier) * 24 + 16;
      s +=
        `<g${bp(`constraints.${ci}`)}>` +
        `<path d="M ${xa} ${by + 5} V ${by} H ${xb} V ${by + 5}" fill="none" stroke="var(--ink)" stroke-width="1"/>` +
        `<text x="${(xa + xb) / 2}" y="${by - 4}" class="t-arrow c-ink" text-anchor="middle">{ ${escapeHtml(c.label)} }</text>` +
        `</g>`;
    });
    s += `</g>`;
  }

  // Events: dashed rules from the label tier down through the lanes.
  if (events.length > 0) {
    const laneIndex = new Map(lanes.map((ln, i) => [ln.label, i]));
    s += `<g${bl('events')}>`;
    events.forEach((e, ei) => {
      const x = xOf(e.at);
      const tier = evTiers[ei] ?? 0;
      const ly = evBandY + (evTierCount - 1 - tier) * TIER_H + 10;
      const li = e.lane !== undefined ? laneIndex.get(e.lane) : undefined;
      const y1 = li !== undefined ? (laneTops[li] ?? lanesY) : lanesY;
      const y2 = li !== undefined ? (laneTops[li] ?? lanesY) + laneH(li) : lanesBot;
      const w = (evLabels[ei]?.w ?? 0);
      const tx = Math.min(Math.max(x, PAD_L + w / 2), width - 4 - w / 2);
      s +=
        `<g${bp(`events.${ei}`)}>` +
        `<line x1="${x}" y1="${ly + 4}" x2="${x}" y2="${y2}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
        `<circle cx="${x}" cy="${y1}" r="2.5" fill="var(--muted)"/>` +
        `<text x="${tx}" y="${ly}" class="t-arrow c-ink" text-anchor="middle"${bp(`events.${ei}.label`)}>${escapeHtml(e.label)}</text>` +
        `</g>`;
    });
    s += `</g>`;
  }
  s += `</svg>`;

  const items: LegendItem[] = [{ swatch: 'line', stroke: 'var(--muted)', label: 'state' }];
  if (anyNegative) items.push({ swatch: 'line', stroke: 'var(--negative)', label: 'failure state' });
  if (anyAccent) items.push({ swatch: 'line', stroke: 'var(--accent)', label: 'highlighted state' });
  if (events.length > 0) items.push({ swatch: 'line-dashed', stroke: 'var(--muted)', label: 'event' });
  if (constraints.length > 0) items.push({ swatch: 'chip', chip: '{ }', label: 'duration constraint' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'TIMING',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
