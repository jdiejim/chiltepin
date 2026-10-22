/**
 * Renders a swimlane diagram — horizontal lanes per role with labelled steps
 * in column positions, plus orthogonal links between steps.
 *
 * Placement comes from core (`swimlanePlacements`): a step names its lane by
 * label, id, or index, and its column is either the `col` it carries or its
 * longest-path rank through the links, so the renderer, the Studio canvas,
 * and `chiltepin check` agree on every cell. Optional `phases` band the columns
 * (BPMN milestones) as a header row above the lanes. A phase with no `to`
 * ends where the next phase starts; a step that names its `phase` stays
 * under that band when columns are derived (core returns the bands).
 *
 * Nothing is cut: step labels wrap to as many lines as they need (the boxes
 * first widen, up to 26 characters a line, then grow taller), notes and lane
 * labels wrap too, and every box and lane grows together.
 *
 * Skin (`DESIGN.md`): lanes are paper bands with hairline separators and a
 * `paper-2` label column; a step is a paper card with an ink outline whose
 * kind travels through shape and chip — `start` / `end` are stadiums (`start`
 * on the inactive fill), `decision` and `wait` carry an eyebrow chip, `wait`
 * on the inactive fill; a `note` is a mono sub-line under the label. Links
 * are `muted` arrows; `kind: dashed` is the open-headed dashed message flow,
 * `kind: error` is `negative`.
 *
 * Accent rule: author-marked. The one step the author sets `accent: true`
 * on takes the accent outline and tint; the renderer adds none of its own.
 */

import { resolveSwimlanePhase, swimlanePlacements, type BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { gapsForLabels, geometryOf, type GeometryIssue, type GeometryReport } from '../svg/geometry.js';
import { wrapAll } from './wrapAll.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Kind = 'action' | 'decision' | 'start' | 'end' | 'wait';

const CHIP: Record<Kind, string> = { action: '', decision: 'DECISION', start: '', end: '', wait: 'WAIT' };

/** Step label characters per line at the 150px box, and the most a box widens to. */
const STEP_CHARS = 18;
const STEP_CHARS_MAX = 26;
/** Approximate advance of one 13px Inter 600 glyph (box width per extra character). */
const NAME_CH = 7;
/** Note characters per line at the 150px box (10px mono). */
const NOTE_CHARS = 24;
/** Eyebrow advance (phase labels) and line height. */
const EYEBROW_CH = 6.4;
const PHASE_LINE = 11;

export function renderSwimlane(data: BlockDataMap['swimlane']): string {
  return layoutSwimlane(data).html;
}

/** Geometry report for a `swimlane` block (see `geometryReport`). */
export function swimlaneGeometry(data: BlockDataMap['swimlane']): GeometryReport {
  return layoutSwimlane(data).geometry;
}

/** Lays out and draws a `swimlane` block: the framed HTML plus its geometry report. */
function layoutSwimlane(data: BlockDataMap['swimlane']): { html: string; geometry: GeometryReport } {
  const lanes = data.lanes ?? [];
  const steps = data.steps ?? [];
  const links = data.links ?? [];
  const phases = data.phases ?? [];
  const { placements, derived, bands } = swimlanePlacements(data);
  const labelW = 132;
  const padX = 18;
  const padBot = 20;
  // Labels are never cut: the box widens (one width for every step) until
  // every label fits three lines, up to STEP_CHARS_MAX characters a line;
  // past that the boxes grow taller.
  let chars = STEP_CHARS;
  while (chars < STEP_CHARS_MAX && steps.some((st) => wrapAll(st.label, chars).length > 3)) chars++;
  const boxW = 150 + (chars - STEP_CHARS) * NAME_CH;
  const colW = boxW + 18;
  // One column gap, wide enough for every link label between neighbouring
  // columns (a step's lane is its row).
  const cellOfStep = (id: string): { col: number; row: number } | undefined => {
    const i = steps.findIndex((st) => st.id === id);
    const pl = i >= 0 ? placements[i] : undefined;
    return pl === undefined ? undefined : { col: pl.col, row: pl.lane + 1 };
  };
  const gapCol = gapsForLabels(links, cellOfStep, 'LR', { gapX: 34, gapY: 0 }, { x: colW - boxW, y: 0 }).gapX;
  // Step labels wrap to as many lines as they need; a note adds mono lines
  // under the label. Boxes and lanes grow uniformly so nothing overlaps.
  const stepLines = steps.map((st) => wrapAll(st.label, chars));
  const noteChars = Math.floor((NOTE_CHARS * boxW) / 150);
  const noteLines = steps.map((st) => (st.note !== undefined && st.note !== '' ? wrapAll(st.note, noteChars) : []));
  const maxLines = Math.max(1, ...stepLines.map((ls) => ls.length));
  const maxNote = Math.max(0, ...noteLines.map((ls) => ls.length));
  const noteH = maxNote * 12;
  const boxH = 52 + Math.max(0, maxLines - 2) * 14 + noteH;
  // A lane label wraps too; the lane grows to fit it.
  const laneLabelLines = lanes.map((L) => wrapAll(L.label, Math.max(8, Math.floor((labelW - 28) / 7))));
  const laneH = Math.max(boxH + 40, ...laneLabelLines.map((ls) => ls.length * 16 + 20));
  const cols = Math.max(1, ...placements.map((p) => p.col), ...bands.map((b) => b.to));
  const xCol = (c: number): number => labelW + padX + (c - 1) * (colW + gapCol);
  // Phase bands (core's columns: an open-ended phase stops where the next
  // one starts); the header row grows when a phase label wraps.
  const bandX = bands.map((b) => {
    const from = Math.min(b.from, cols);
    const to = Math.min(Math.max(b.to, from), cols);
    return {
      from,
      to,
      x0: from === 1 ? padX + labelW : xCol(from) - gapCol / 2,
      x1: to === cols ? 0 : xCol(to) + colW + gapCol / 2, // 0: the right edge, filled in below
    };
  });
  const phaseLines = phases.map((ph, pi) => {
    const b = bandX[pi];
    const w = b === undefined ? colW : (b.x1 === 0 ? labelW + padX + cols * colW + (cols - 1) * gapCol : b.x1) - b.x0;
    return wrapAll(ph.label.toUpperCase(), Math.max(6, Math.floor((w - 16) / EYEBROW_CH)));
  });
  // A phase header sits above the lanes; the lanes start below it.
  const phaseH = phases.length > 0 ? Math.max(26, 15 + Math.max(1, ...phaseLines.map((l) => l.length)) * PHASE_LINE) : 0;
  const padTop = 24 + phaseH;
  const yLane = (l: number): number => padTop + l * laneH;
  const rectFor = (p: { col: number; lane: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xCol(p.col) + (colW - boxW) / 2,
    y: yLane(p.lane) + (laneH - boxH) / 2,
    w: boxW,
    h: boxH,
  });
  const width = labelW + padX * 2 + cols * colW + (cols - 1) * gapCol;
  const lanesH = Math.max(1, lanes.length) * laneH;
  const height = padTop + lanesH + padBot;

  // Grid metadata for editors (Chiltepin Studio drag-to-move / drag-to-connect):
  // the step grid is labelW-offset columns × lanes-as-rows, so the left pad
  // includes the lane-label column and the row pitch is the lane height. Each
  // step's data-row below is its 1-based lane (`lane + 1`) — editors work in
  // row space and write back `lane = row - 1`. `quick` says the columns were
  // derived, so the first drag pins every step's `col`.
  const gridMeta = gridMetaAttrs({
    quick: derived,
    cols,
    rows: Math.max(1, lanes.length),
    cellW: colW,
    cellH: laneH,
    gapX: gapCol,
    gapY: 0,
    padX: labelW + padX,
    padTop,
  });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Swimlane</title>`;

  s += `<g${bl('lanes')}>`;
  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i];
    if (L === undefined) continue;
    // The lane label wraps (the lane grew to fit it) inside the label column.
    const llines = laneLabelLines[i] ?? [];
    const ltext = llines
      .map(
        (ln, j) =>
          `<text x="${padX + 14}" y="${(yLane(i) + laneH / 2 + 4 - (llines.length - 1) * 8 + j * 16).toFixed(1)}" class="t-name">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`lanes.${i}`)}>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${width - padX * 2}" height="${laneH}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${labelW}" height="${laneH}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      ltext +
      `</g>`;
  }
  s += `</g>`; // close the lanes list container

  // Phase bands: a header cell over the band's columns, and a hairline down
  // through the lanes at each band edge that is not the diagram's own edge.
  // Every band's cell is drawn before any label, so no band can hide one.
  if (phases.length > 0) {
    const yTop = padTop - phaseH;
    const yBot = padTop + lanesH;
    const edge = (pi: number): { x0: number; x1: number; from: number; to: number } => {
      const b = bandX[pi] ?? { from: 1, to: cols, x0: padX + labelW, x1: 0 };
      return { ...b, x1: b.x1 === 0 ? width - padX : b.x1 };
    };
    s += `<g${bl('phases')}>`;
    phases.forEach((_, pi) => {
      const { x0, x1, from, to } = edge(pi);
      const seps =
        (from > 1 ? `<line x1="${x0}" y1="${yTop}" x2="${x0}" y2="${yBot}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>` : '') +
        (to < cols ? `<line x1="${x1}" y1="${yTop}" x2="${x1}" y2="${yBot}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>` : '');
      s +=
        `<g${bp(`phases.${pi}`)}>` +
        `<rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${phaseH}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>` +
        seps +
        `</g>`;
    });
    phases.forEach((_, pi) => {
      const { x0, x1 } = edge(pi);
      const ls = phaseLines[pi] ?? [];
      const y0 = yTop + phaseH / 2 + 3 - ((ls.length - 1) * PHASE_LINE) / 2;
      s += ls
        .map(
          (ln, j) =>
            `<text x="${(x0 + x1) / 2}" y="${y0 + j * PHASE_LINE}" class="t-eyebrow" text-anchor="middle"${j === 0 ? bp(`phases.${pi}.label`) : ''}>${escapeHtml(ln)}</text>`,
        )
        .join('');
    });
    s += `</g>`; // close the phases list container
  }

  // Every link is routed around the steps, off the lane borders and clear of
  // the lane-label column; each label sits on its own link.
  const bounds = { x: 0, y: 0, w: width, h: height };
  const stepNodes = steps
    .map((st, i) => {
      const pl = placements[i];
      return pl === undefined ? undefined : { id: st.id, box: rectFor(pl), radius: (st.kind ?? 'action') === 'start' || (st.kind ?? 'action') === 'end' ? boxH / 2 : 4 };
    })
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  const laneRects = lanes.map((_, i) => ({ x: padX + labelW, y: yLane(i), w: width - padX * 2 - labelW, h: laneH }));
  const { routes, labels } = layoutEdges(
    stepNodes,
    links,
    links.map((lk, li) => ({ label: lk.label, err: lk.kind === 'error', path: `links.${li}` })),
    {
      dir: 'LR',
      bounds,
      obstacles: [{ x: padX, y: padTop, w: labelW, h: lanesH }],
      rails: laneRects,
    },
  );
  const used = { plain: false, dashed: false, error: false };
  s += `<g${bl('links')}>`;
  links.forEach((lk, li) => {
    const p = routes[li];
    if (p === undefined) return;
    const isErr = lk.kind === 'error';
    const isDashed = lk.kind === 'dashed';
    const stroke = isErr ? 'var(--negative)' : 'var(--muted)';
    const marker = isErr ? 'skErr' : isDashed ? 'skOpen' : 'skArrow';
    const dash = isDashed ? ' stroke-dasharray="5 4"' : '';
    if (isErr) used.error = true;
    else if (isDashed) used.dashed = true;
    else used.plain = true;
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash} marker-end="url(#${marker})"${bp(`links.${li}`)}/>`;
  });
  s += `</g>`; // close the links list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  let accented = false;
  s += `<g${bl('steps')}>`;
  steps.forEach((st, si) => {
    const place = placements[si] ?? { col: 1, lane: 0 };
    const r = rectFor(place);
    const kind: Kind = st.kind ?? 'action';
    kindsUsed.add(kind);
    const accent = st.accent === true;
    if (accent) accented = true;
    const inactive = !accent && (kind === 'start' || kind === 'wait');
    const fill = accent ? 'var(--accent-tint)' : inactive ? 'var(--paper-2)' : 'var(--paper)';
    const stroke = accent ? 'var(--accent)' : inactive ? 'var(--rule-solid)' : 'var(--ink)';
    const sw = inactive ? 1 : 1.5;
    const rx = kind === 'start' || kind === 'end' ? r.h / 2 : 4;
    const chip = CHIP[kind];
    const chipSvg =
      chip !== ''
        ? `<text x="${r.x + 10}" y="${r.y + 12}" class="t-eyebrow${accent ? ' c-accent' : inactive ? ' c-muted' : ''}">${chip}</text>`
        : '';
    // The name lines and the note lines form one block, centred in the card;
    // a chip takes the top of the card, so the block shifts down a step.
    const nls = noteLines[si] ?? [];
    const lines = stepLines[si] ?? [];
    const blockH = lines.length * 14 + (nls.length > 0 ? 4 + nls.length * 12 : 0);
    const top = r.y + (r.h - blockH) / 2 + (chip !== '' ? 5 : 0);
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${r.x + r.w / 2}" y="${top + 11 + j * 14}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    const noteSvg = nls
      .map(
        (ln, k) =>
          `<text x="${r.x + r.w / 2}" y="${top + lines.length * 14 + 13 + k * 12}" class="t-sub" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`steps.${si}`)}${nodeCellAttrs(place.col, place.lane + 1)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      chipSvg +
      texts +
      noteSvg +
      `</g>`;
  });
  s += `</g>`; // close the steps list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const stepLegend = labels.legend;
  const base = geometryOf({
    nodeWord: 'step',
    edgeWord: 'link',
    nodes: steps.map((st, si) => {
      const pl = placements[si];
      return { id: st.id, name: st.label, path: `steps.${si}`, ...(pl !== undefined ? { col: pl.col, row: pl.lane + 1 } : {}) };
    }),
    edges: links.map((lk, li) => ({ from: lk.from, to: lk.to, label: lk.label, path: `links.${li}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: stepNodes.map((n) => n.box),
    quick: derived,
    dir: 'LR',
  });
  // A step that names a phase no band has: report it (the step keeps its column).
  const phaseIssues: GeometryIssue[] = [];
  steps.forEach((st, si) => {
    if (st.phase === undefined || resolveSwimlanePhase(st.phase, phases) !== undefined) return;
    phaseIssues.push({
      kind: 'phase-unknown',
      path: `steps.${si}.phase`,
      message: `The step "${st.label}" names the phase "${st.phase}", and no phase has that label.`,
      hint:
        phases.length > 0
          ? `Use one of the phase labels: ${phases.map((p) => `"${p.label}"`).join(', ')}.`
          : 'Add the phase to `phases`, or remove `phase` from the step.',
    });
  });
  const geometry: GeometryReport = phaseIssues.length > 0 ? { ...base, issues: [...base.issues, ...phaseIssues] } : base;

  const items: LegendItem[] = [];
  if (kindsUsed.has('start')) items.push({ swatch: 'node-stadium-fill2', label: 'start' });
  if (kindsUsed.has('action')) items.push({ swatch: 'node', label: 'step' });
  if (kindsUsed.has('decision')) items.push({ swatch: 'chip', chip: 'DECISION', label: 'decision' });
  if (kindsUsed.has('wait')) items.push({ swatch: 'chip', chip: 'WAIT', label: 'waiting' });
  if (kindsUsed.has('end')) items.push({ swatch: 'node-stadium', label: 'end' });
  if (accented) items.push({ swatch: 'node-accent', label: 'focal step' });
  if (used.plain) items.push({ swatch: 'edge', label: 'next' });
  if (used.dashed) items.push({ swatch: 'edge-dashed', label: 'message' });
  if (used.error) items.push({ swatch: 'edge-error', label: 'error path' });
  const legend = renderLegend(items);

  const html = diagramFrame(
    {
      tag: 'LANES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + stepLegend,
  );
  return { html, geometry };
}
