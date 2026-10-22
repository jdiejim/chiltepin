/**
 * Renders a state machine: rounded state pills + start/terminal markers + an
 * orthogonal-routed edge per transition, plus a transition table below.
 *
 * Skin (`DESIGN.md`): a state is a paper pill with an ink outline; a `wait`
 * state is the inactive fill (`paper-2`, hairline). The start marker is a
 * filled ink dot, a terminal a bullseye. Transitions are `muted`; a transition
 * into an error terminal is `negative`.
 *
 * Accent rule: the one terminal state that is not an error exit (its name does
 * not read as a failure) takes the accent, together with the transitions into
 * it — the success exit reads at a glance. Two or more candidates, or none,
 * means no accent.
 *
 * Labels: a transition reads `event [guard]` (UML). A long state name wraps
 * at spaces, and an identifier (`PAST_DUE_AWAITING_RETRY`, `awaitingRetry`)
 * breaks after `_` or at a case change; the pill grows a line instead of
 * overflowing. A self transition is a tall arc over its state with its label
 * above the apex, so the label never hides the arc. The transition table
 * (unnamed start / end shown as `● start` / `◉ end`) sits in a closed
 * `<details>` under the drawing — it repeats the diagram, so it stays one
 * click away (open when a label fell back to a numeral that points at it).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { routeEdges } from '../svg/router.js';
import { settleLabels } from '../svg/edgeLayout.js';
import { labelForms } from '../svg/edgeSteps.js';
import { edgeMaskSize } from '../svg/edgePill.js';
import { gapsForLabels, geometryOf, hasBackEdge, LOOP_PAD, type GeometryReport } from '../svg/geometry.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, groupLabelBoxes, groupPanelRects, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { autoDir, ensureGrid } from './autoLayout.js';
import { wrapAll } from './wrapAll.js';

type StateNode = NonNullable<BlockDataMap['state']['states']>[number];

/** A terminal whose name reads as a failure is an error exit, never the accent. */
const ERR_RE = /\b(error|fail|failed|failure|reject|rejected|cancel|cancelled|canceled|abort|aborted|timeout|timed out|expired|dead)\b/i;

/** True when most letters of `text` are capitals (a SCREAMING_CASE name sets wider). */
function mostlyCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && letters.replace(/[^A-Z]/g, '').length / letters.length >= 0.6;
}

/** Approximate advance of one 13px Inter 600 capital — for extents, never layout. */
const CAP_W = 9.2;

// Long state names wrap (word-aware, ~23 characters a line, ~20 for capitals)
// so a pill can never grow past its grid cell and overlap a neighbour; the
// pill gains 15px of height per extra line instead, and nothing is dropped.
function nameLines(s: StateNode): string[] {
  const name = s.name ?? '';
  return wrapAll(name, mostlyCaps(name) ? 20 : 23);
}

function rectFor(s: StateNode & { col: number; row: number }, cellW: number, cellH: number, gapX: number, gapY: number, padX: number, padTop: number): {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
} {
  const cx = padX + (s.col - 1) * (cellW + gapX) + cellW / 2;
  const cy = padTop + (s.row - 1) * (cellH + gapY) + cellH / 2;
  if (s.kind === 'start' || s.kind === 'terminal') {
    return { x: cx - 13, y: cy - 13, w: 26, h: 26, cx, cy };
  }
  const lines = nameLines(s);
  // Capitals set wider than the 8px average: a caps line is measured as caps.
  const longest = Math.max(0, ...lines.map((ln) => Math.max(ln.length * 8, mostlyCaps(ln) ? ln.length * CAP_W : 0)));
  const pw = Math.max(96, Math.min(Math.ceil(longest) + 26, cellW + gapX - 26));
  const ph = 46 + (Math.max(1, lines.length) - 1) * 15;
  return { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph, cx, cy };
}

function pillCls(kind: StateNode['kind']): string {
  if (kind === 'terminal') return 'pill pill-end';
  if (kind === 'wait') return 'pill pill-wait';
  if (kind === 'start') return 'pill pill-init';
  return 'pill pill-active';
}

export function renderState(data: BlockDataMap['state']): string {
  return fitState(data).html;
}

/** Lays out a `state` block in the author's direction, or the one that fits the page (see `autoDir`). */
function fitState(data: BlockDataMap['state']): { html: string; geometry: GeometryReport } {
  return autoDir(data, data.states ?? [], layoutState, (r) => r.html);
}

/** Geometry report for a `state` block (see `geometryReport`). */
export function stateGeometry(data: BlockDataMap['state']): GeometryReport {
  return fitState(data).geometry;
}

/** A transition's label in UML form: the event, then its guard in brackets (`retry [attempts < 4]`). */
export const transitionLabel = (t: { readonly event: string; readonly guard?: string | undefined }): string =>
  t.event + (t.guard !== undefined && t.guard.trim() !== '' ? ` [${t.guard.trim()}]` : '');

/** The arc of a self transition rises this far above its state (the label sits above the apex). */
const LOOP_RISE = 44;
/** Clear space above a self transition's label when its state is on row 1. */
const LOOP_HEAD = 6;

/** Lays out and draws a `state` block: the framed HTML plus its geometry report. */
function layoutState(data: BlockDataMap['state']): { html: string; geometry: GeometryReport } {
  const trans = data.transitions ?? [];
  const rawStates = data.states ?? [];
  const dir = data.dir ?? 'LR';
  const quick = !(rawStates.length > 0 && rawStates.every((n) => n.col !== undefined && n.row !== undefined));
  const states = ensureGrid(rawStates, trans, dir);
  const cellW = 168;
  // A pill of four or more lines grows the one row height (Studio's grid
  // metadata stays valid); up to three lines fit the 64px cell as before.
  const tallest = Math.max(0, ...states.map((st) => (st.kind === 'start' || st.kind === 'terminal' ? 0 : 46 + (Math.max(1, nameLines(st).length) - 1) * 15)));
  const cellH = Math.max(64, tallest - 12);
  // One column gap and one row gap, wide enough for every transition label.
  // A pill narrower than its cell leaves that room as slack.
  const cellOf = (id: string): (typeof states)[number] | undefined => states.find((st) => st.id === id);
  const baseW = (id: string): number => {
    const st = cellOf(id);
    return st === undefined ? cellW : rectFor(st, cellW, cellH, 74, 60, 0, 0).w;
  };
  const { gapX, gapY } = gapsForLabels(
    trans.map((t) => ({ from: t.from, to: t.to, label: transitionLabel(t) })),
    cellOf,
    dir,
    { gapX: 74, gapY: 60 },
    (a, b) => ({ x: Math.max(0, (cellW - baseW(a)) / 2 + (cellW - baseW(b)) / 2), y: 0 }),
  );
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  // Declared group nesting (`parent`) grows the outermost panels outward; the
  // pads grow with them so a nested group never clips at the viewBox edge.
  const nestPad = nestingPads(groups);
  // A back transition loops around its row (column in TB): room for the loop.
  const loop = hasBackEdge(trans, cellOf, dir) ? LOOP_PAD : 0;
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 30) + nestPad.padX + (dir === 'TB' ? loop : 0);
  // A self transition on the top row needs room for its arc and label.
  const loopLift = (ti: number): number => {
    const label = transitionLabel(trans[ti] ?? { event: '' });
    const h = Math.max(0, ...labelForms(label).map((lines) => edgeMaskSize(lines).h));
    return Math.ceil(h / 2) + 3;
  };
  // The arc rises LOOP_RISE·¾ over the pill, its label sits above that: the
  // top pad grows by whatever the arc and label need beyond the default pad.
  const selfTop = Math.max(
    0,
    ...trans.map((t, ti) => {
      const st = cellOf(t.from);
      if (t.from !== t.to || st === undefined || st.row !== 1) return 0;
      const inCell = (cellH - rectFor(st, cellW, cellH, 0, 0, 0, 0).h) / 2;
      return Math.ceil(LOOP_RISE * 0.75 + 2 * loopLift(ti) + LOOP_HEAD - 30 - inCell);
    }),
  );
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : 30) + nestPad.padTop + (dir === 'LR' ? loop : 0) + selfTop;
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 20) + nestPad.padBot + (dir === 'LR' ? loop : 0);
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...states.map((s) => s.col), gx.cols);
  const rows = Math.max(1, ...states.map((s) => s.row), gx.rows);
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop * 2 + rows * cellH + (rows - 1) * gapY + padBot;
  const byId = new Map(states.map((s) => [s.id, s]));

  // Error exits and the accent (see the header comment).
  const isErrTerminal = (s: StateNode | undefined): boolean =>
    s !== undefined && s.kind === 'terminal' && (ERR_RE.test(s.name ?? '') || ERR_RE.test(s.id));
  const successExits = states.filter((s) => s.kind === 'terminal' && !isErrTerminal(s));
  const accentId = successExits.length === 1 ? successExits[0]?.id : undefined;

  // Grid metadata for editors (Chiltepin Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each state's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const a11y = svgName('State machine', data.title, [
    countPhrase(states.length, 'state'),
    countPhrase(trans.length, 'transition'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}`;

  // Group panels — beneath transitions and states. Only emitted when present.
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  if (groups.length > 0) s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });

  // Every transition is routed around the states; its label sits on it.
  // A label that fits nowhere falls back to a numeral, and that numeral
  // points at the transition table's row (which then gains a № column)
  // instead of a second step legend.
  const used = { plain: false, error: false, accent: false };
  const boxOf = (st: (typeof states)[number]): ReturnType<typeof rectFor> =>
    rectFor(st, cellW, cellH, gapX, gapY, padX, padTop);
  const bounds = { x: 0, y: 0, w: width, h: height };
  const geo = { xOf, yOf, cellW, cellH, gapX, gapY };
  const avoid = states.map((st) => {
    const r = boxOf(st);
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  });
  const obstacles = groupLabelBoxes(groups, geo);
  // A self transition keeps its small arc over the state (not a routed
  // loop); every other transition is routed around the states.
  const isSelf = (ti: number): boolean => trans[ti]?.from === trans[ti]?.to;
  const first = routeEdges(
    states.map((st) => ({ id: st.id, box: boxOf(st), shape: 'round' as const })),
    trans,
    { dir, bounds, obstacles, rails: groupPanelRects(groups, geo) },
  ).map((r, ti) => (isSelf(ti) ? undefined : r));
  // The label of a self transition sits just above the apex of its arc (the
  // cubic's apex is 3/4 of the rise), clear of the stroke in either of the
  // forms the label may take (one line or two).
  const loopPoints = (st: (typeof states)[number], ti: number): Array<{ x: number; y: number }> => {
    const r = boxOf(st);
    const y = Math.floor(r.y - LOOP_RISE * 0.75 - loopLift(ti));
    return [
      { x: r.cx - 14, y },
      { x: r.cx + 14, y },
    ];
  };
  // Labels sit on their transitions; no line runs under another's label.
  const { routes, labels } = settleLabels({
    routes: first,
    meta: trans.map((t, ti) => {
      const B = byId.get(t.to);
      if (!byId.has(t.from) || B === undefined) return undefined;
      const isErr = isErrTerminal(B);
      const isAccent = !isErr && accentId !== undefined && t.to === accentId;
      return { label: transitionLabel(t), err: isErr, accent: isAccent, path: `transitions.${ti}`, reveal: ti };
    }),
    avoid,
    obstacles: [...avoid, ...obstacles],
    bounds,
    pointsOf: (ti) => {
      const A = byId.get(trans[ti]?.from ?? '');
      return isSelf(ti) && A !== undefined ? loopPoints(A, ti) : undefined;
    },
    labelOptions: { stepNumber: (ti) => ti + 1, noLegend: true },
    rails: groupPanelRects(groups, geo),
  });
  const numbered = labels.fallbackIndex.length > 0;

  trans.forEach((t, ti) => {
    const A = byId.get(t.from);
    const B = byId.get(t.to);
    if (!A || !B) return;
    const isErr = isErrTerminal(B);
    const isAccent = !isErr && accentId !== undefined && t.to === accentId;
    const stroke = isErr ? 'var(--negative)' : isAccent ? 'var(--accent)' : 'var(--muted)';
    const marker = isErr ? 'skErr' : isAccent ? 'skAccent' : 'skArrow';
    const sw = isAccent ? 1.75 : 1.5;
    if (isErr) used.error = true;
    else if (isAccent) used.accent = true;
    else used.plain = true;
    // Deck builds: transitions reveal in document order, the label with its arrow.
    const tAttrs = bp(`transitions.${ti}`) + revealAttr(ti);
    if (isSelf(ti)) {
      const r = boxOf(A);
      s += `<path d="M ${r.cx - 14} ${r.y} C ${r.cx - 40} ${r.y - LOOP_RISE}, ${r.cx + 40} ${r.y - LOOP_RISE}, ${r.cx + 14} ${r.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${tAttrs}/>`;
      return;
    }
    const p = routes[ti];
    if (p === undefined) return;
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${tAttrs}/>`;
  });

  // states
  const kinds = { active: false, wait: false, start: false, end: false, errEnd: false };
  s += `<g${bl('states')}>`;
  states.forEach((st, si) => {
    const r = rectFor(st, cellW, cellH, gapX, gapY, padX, padTop);
    const place = nodeCellAttrs(st.col, st.row);
    if (st.kind === 'start') {
      kinds.start = true;
      s += `<circle cx="${r.cx}" cy="${r.cy}" r="10" fill="var(--ink)"${bp(`states.${si}`)}${place}/>`;
    } else if (st.kind === 'terminal') {
      const accent = st.id === accentId;
      const err = isErrTerminal(st);
      if (err) kinds.errEnd = true;
      else if (!accent) kinds.end = true;
      const tone = accent ? 'var(--accent)' : err ? 'var(--negative)' : 'var(--ink)';
      const fill = accent ? 'var(--accent-tint)' : err ? 'var(--negative-tint)' : 'var(--paper)';
      s +=
        `<g${bp(`states.${si}`)}${place}>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="12" fill="${fill}" stroke="${tone}" stroke-width="1.5"/>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="6" fill="${tone}"/>` +
        `</g>`;
    } else {
      const wait = st.kind === 'wait';
      if (wait) kinds.wait = true;
      else kinds.active = true;
      const fill = wait ? 'var(--paper-2)' : 'var(--paper)';
      const stroke = wait ? 'var(--rule-solid)' : 'var(--ink)';
      const sw = wait ? 1 : 1.5;
      const lines = nameLines(st);
      const nameText =
        lines.length <= 1
          ? `<text x="${r.cx}" y="${r.cy + 4.5}" class="t-name" text-anchor="middle"${bp(`states.${si}.name`)}>${escapeHtml(st.name ?? '')}</text>`
          : `<g${bp(`states.${si}.name`)}>` +
            lines
              .map(
                (ln, j) =>
                  `<text x="${r.cx}" y="${r.cy + 4.5 - (lines.length - 1) * 7.5 + j * 15}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`,
              )
              .join('') +
            `</g>`;
      s +=
        `<g${bp(`states.${si}`)}${place}>` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="23" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
        nameText +
        `</g>`;
    }
  });
  s += `</g>`; // close the states list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const geometry = geometryOf({
    nodeWord: 'state',
    edgeWord: 'transition',
    nodes: states.map((st, si) => ({ id: st.id, name: st.name ?? st.id, path: `states.${si}`, col: st.col, row: st.row })),
    edges: trans.map((t, ti) => ({ from: t.from, to: t.to, label: transitionLabel(t), path: `transitions.${ti}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: avoid,
    quick,
    dir,
  });

  // transition table — in numbered mode a leading № column mirrors the circled
  // numerals on the diagram, so each arrow reads off its own table row.
  // An unnamed start / end reads as its marker word, never its id.
  const name = (id: string): string => {
    const st = byId.get(id);
    if (st?.name !== undefined && st.name !== '') return st.name;
    if (st?.kind === 'start') return '● start';
    if (st?.kind === 'terminal') return '◉ end';
    return id;
  };
  const numCell = (ti: number): string =>
    numbered ? `<td class="t-num"><span class="edge-step"><b>${ti + 1}</b></span></td>` : '';
  const rows2 = trans
    .map(
      (t, ti) =>
        `<tr${bp(`transitions.${ti}`)}${revealAttr(ti)}>` +
        numCell(ti) +
        `<td><span class="${pillCls(byId.get(t.from)?.kind)}">${escapeHtml(name(t.from))}</span></td>` +
        `<td style="font-family:var(--font-mono);font-size:11px"${bp(`transitions.${ti}.event`)}>${escapeHtml(t.event)}</td>` +
        `<td class="c-soft" style="font-size:11px"${bp(`transitions.${ti}.guard`)}>${escapeHtml(t.guard ?? '—')}</td>` +
        `<td><span class="${pillCls(byId.get(t.to)?.kind)}">${escapeHtml(name(t.to))}</span></td>` +
        `</tr>`,
    )
    .join('');
  // The table repeats the diagram, so it starts closed — unless a label fell
  // back to a numeral that points at its rows.
  const table =
    trans.length > 0
      ? `<details class="st-transitions"${numbered ? ' open' : ''}>` +
        `<summary class="t-eyebrow">Transition table (${trans.length})</summary>` +
        `<table class="transition-table">` +
        `<thead><tr>${numbered ? '<th>№</th>' : ''}<th>From</th><th>Event</th><th>Guard</th><th>To</th></tr></thead>` +
        `<tbody${bl('transitions')}>${rows2}</tbody></table></details>`
      : '';

  const items: LegendItem[] = [];
  if (kinds.start) items.push({ swatch: 'chip', chip: '●', label: 'start' });
  if (kinds.active) items.push({ swatch: 'node', label: 'state' });
  if (kinds.wait) items.push({ swatch: 'node-fill2', label: 'waiting' });
  if (kinds.end) items.push({ swatch: 'chip', chip: '◉', label: 'end' });
  if (used.plain) items.push({ swatch: 'edge', label: 'transition' });
  if (kinds.errEnd) items.push({ swatch: 'node-negative', label: 'error exit' });
  if (used.error) items.push({ swatch: 'edge-error', label: 'error transition' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'success exit' });
  const legend = renderLegend(items);

  const html = diagramFrame(
    {
      tag: 'STATE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(table.length > 0 ? { footerHtml: table } : {}),
    },
    s,
  );
  return { html, geometry };
}
