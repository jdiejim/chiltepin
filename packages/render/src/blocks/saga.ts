/**
 * Renders a `saga` — a distributed transaction as forward steps left to
 * right, each with the compensation that undoes it drawn beneath, and the
 * compensating flow running right to left from the step that fails.
 *
 * Skin (`DESIGN.md`): a step is a paper card with an ink outline — a hollow
 * step badge, the owning service as an eyebrow chip, the name, the action as
 * a mono sublabel. A compensation is a dashed-outline card under its step.
 * Forward arrows are the default `muted` edge; the arrows past the failure
 * are dashed with an open head (never taken). The compensating flow is
 * `negative`, dashed, with a filled head. With `mode: orchestration` the
 * coordinator sits in a `paper-2` band on top and fans out to every step.
 *
 * Accent rule: the step that fails (`failAt`, else the first step whose
 * `status` is `failed`) — accent outline on the accent tint, a `FAILED`
 * chip. Zero accent when nothing fails.
 *
 * Fit: text wraps and never drops (the cards grow). Past four steps, a row
 * wider than the page column narrows its cards to fit it: the gaps tighten,
 * the service eyebrow wraps, and the status chip takes its own row under it,
 * so a six-step saga reads at full size instead of scrolling.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { wrapAll } from './wrapAll.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type SagaData = BlockDataMap['saga'];
type Step = SagaData['steps'][number];
type Status = NonNullable<Step['status']>;

const PAD_X = 22;
const PAD_TOP = 22;
const PAD_BOT = 18;
/** Narrowest step card; cards grow uniformly to fit the longest text. */
const MIN_W = 176;
const GAP_FULL = 44;
const COORD_H = 34;
const COORD_GAP = 36;
const COMP_GAP = 34;
const NAME_CHARS = 22;
const ACTION_CHARS = 28;
/** The page column: a row of more than four steps wider than this narrows its cards. */
const FIT_W = 1000;
/** Compact cards (past four steps): the narrowest card and the tighter gap. */
const MIN_W_COMPACT = 130;
const GAP_COMPACT = 34;

/** Approximate glyph widths per type role (px per character). */
const NAME_PX = 7.4;
const SUB_PX = 6;
const EYEBROW_PX = 6.3;

const CHIP_TEXT: Record<Status, string> = {
  ok: '',
  failed: 'FAILED',
  skipped: 'SKIPPED',
  compensated: 'COMPENSATED',
};

const ORCH_CHIP = 'ORCHESTRATOR';
const COMP_CHIP = 'COMPENSATE';

type Tone = 'muted' | 'accent' | 'negative';

const toneClass = (tone: Tone): string =>
  tone === 'accent' ? ' c-accent' : tone === 'negative' ? ' c-negative' : '';

/** An outlined word chip, centred on its own box; `x` is its left or (anchored end) right edge. */
function chipSvg(x: number, y: number, text: string, tone: Tone, anchorEnd: boolean): string {
  const w = Math.round(text.length * EYEBROW_PX + 10);
  const x0 = anchorEnd ? x - w : x;
  const stroke = tone === 'accent' ? 'var(--accent)' : tone === 'negative' ? 'var(--negative)' : 'var(--rule-solid)';
  return (
    `<rect x="${x0}" y="${y - 8}" width="${w}" height="15" rx="2" fill="var(--paper)" stroke="${stroke}" stroke-width="1"/>` +
    `<text x="${x0 + w / 2}" y="${y + 3.5}" class="t-eyebrow${toneClass(tone)}" text-anchor="middle">${escapeHtml(text)}</text>`
  );
}

const longest = (lines: readonly string[]): number => Math.max(0, ...lines.map((l) => l.length));

/**
 * The effective status of every step. An explicit `status` wins; otherwise
 * `failAt` derives them — before it `compensated`, at it `failed`, after it
 * `skipped` — and with no failure every step is `ok`.
 */
function effectiveStatuses(steps: readonly Step[], failIdx: number): Status[] {
  return steps.map((s, i) => {
    if (s.status !== undefined) return s.status;
    if (failIdx < 0) return 'ok';
    return i < failIdx ? 'compensated' : i === failIdx ? 'failed' : 'skipped';
  });
}

export function renderSaga(data: SagaData): string {
  const steps = data.steps;
  const n = steps.length;
  const orchestrated = data.mode === 'orchestration';
  const coordinator = data.coordinator ?? 'Orchestrator';
  const failIdx =
    data.failAt !== undefined
      ? steps.findIndex((s) => s.id === data.failAt)
      : steps.findIndex((s) => s.status === 'failed');
  const statuses = effectiveStatuses(steps, failIdx);

  // Text wraps (never truncates); the cards grow uniformly to the tallest
  // and widest content so the row stays aligned.
  const wrapAt = (nameChars: number, actionChars: number) => ({
    nameLines: steps.map((s) => wrapAll(s.name, nameChars)),
    actionLines: steps.map((s) => (s.action !== undefined ? wrapAll(s.action, actionChars) : [])),
    compLines: steps.map((s) => (s.compensate !== undefined ? wrapAll(s.compensate, nameChars) : [])),
  });
  let { nameLines, actionLines, compLines } = wrapAt(NAME_CHARS, ACTION_CHARS);

  const widths: number[] = [MIN_W];
  steps.forEach((s, i) => {
    const chipText = CHIP_TEXT[statuses[i] ?? 'ok'];
    const chipW = chipText.length > 0 ? chipText.length * EYEBROW_PX + 10 + 8 : 0;
    widths.push(12 + 14 + 8 + s.service.length * EYEBROW_PX + 8 + chipW + 10);
    widths.push(longest(nameLines[i] ?? []) * NAME_PX + 24);
    widths.push(longest(actionLines[i] ?? []) * SUB_PX + 24);
    widths.push(longest(compLines[i] ?? []) * NAME_PX + 24);
  });
  let W = Math.ceil(Math.max(...widths));
  let GAP = GAP_FULL;
  // Past four steps a row wider than the page column narrows its cards: the
  // service wraps and the status chip takes its own row (see the header).
  const compact = n > 4 && PAD_X * 2 + n * W + (n - 1) * GAP > FIT_W;
  if (compact) {
    GAP = GAP_COMPACT;
    W = Math.max(MIN_W_COMPACT, Math.floor((FIT_W - PAD_X * 2 - (n - 1) * GAP) / n));
    ({ nameLines, actionLines, compLines } = wrapAt(
      Math.floor((W - 24) / NAME_PX),
      Math.floor((W - 24) / SUB_PX),
    ));
  }
  if (orchestrated) {
    // The coordinator band spans the row; its name must fit inside it.
    const inner = 14 + coordinator.length * NAME_PX + 12 + ORCH_CHIP.length * EYEBROW_PX + 10 + 14;
    const rowW = n * W + (n - 1) * GAP;
    if (inner > rowW) W = Math.ceil((inner - (n - 1) * GAP) / n);
  }
  // The header: the step badge and the service (wrapped on a compact card),
  // then — on a compact card — the status chip on a row of its own.
  const svcLines = steps.map((s) => (compact ? wrapAll(s.service, Math.max(6, Math.floor((W - 34 - 10) / EYEBROW_PX))) : [s.service]));
  const headExtra = (Math.max(1, ...svcLines.map((l) => l.length)) - 1) * 11;
  const chipRow = compact && statuses.some((st) => CHIP_TEXT[st].length > 0) ? 18 : 0;
  const maxName = Math.max(1, ...nameLines.map((l) => l.length));
  const maxAction = Math.max(0, ...actionLines.map((l) => l.length));
  const maxComp = Math.max(0, ...compLines.map((l) => l.length));
  const hasComp = maxComp > 0;
  const nameTop = 30 + headExtra + chipRow;
  const cardH = nameTop + maxName * 15 + (maxAction > 0 ? maxAction * 13 + 4 : 0) + 8;
  const compH = 22 + maxComp * 15 + 8;

  const xOf = (i: number): number => PAD_X + i * (W + GAP);
  const cxOf = (i: number): number => xOf(i) + W / 2;
  const coordY = PAD_TOP;
  const stepY = orchestrated ? PAD_TOP + COORD_H + COORD_GAP : PAD_TOP;
  const stepCy = stepY + cardH / 2;
  const compY = stepY + cardH + COMP_GAP;
  const compCy = compY + compH / 2;
  const width = PAD_X * 2 + n * W + (n - 1) * GAP;
  const height = (hasComp ? compY + compH : stepY + cardH) + PAD_BOT;

  // The compensating flow's stops: every earlier step with a compensation,
  // from the failure point back to the first.
  const targets: number[] = [];
  if (failIdx > 0 && hasComp) {
    for (let j = failIdx - 1; j >= 0; j--) if ((compLines[j] ?? []).length > 0) targets.push(j);
  }
  // Deck build order (`data-reveal`): the steps left to right (a forward
  // arrow arrives with the step it enters), then the compensating flow — one
  // step per stop, from the failure point back. A compensation the flow never
  // reaches appears with its own step.
  const stepReveal = (i: number): number => i;
  const compReveal = (j: number): number => {
    const k = targets.indexOf(j);
    return k < 0 ? j : n + k;
  };

  const a11y = svgName('Saga', data.title, [
    countPhrase(n, 'step'),
    ...(compLines.filter((l) => l.length > 0).length > 0
      ? [countPhrase(compLines.filter((l) => l.length > 0).length, 'compensation')]
      : []),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // Coordinator band (orchestration only) with a fan-out arrow into every step.
  if (orchestrated) {
    const nameX = PAD_X + 14;
    const chipX = nameX + coordinator.length * NAME_PX + 12;
    s +=
      `<g${bp('coordinator')}>` +
      `<rect x="${PAD_X}" y="${coordY}" width="${width - PAD_X * 2}" height="${COORD_H}" rx="4" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<text x="${nameX}" y="${coordY + COORD_H / 2 + 4.5}" class="t-name">${escapeHtml(coordinator)}</text>` +
      chipSvg(chipX, coordY + COORD_H / 2, ORCH_CHIP, 'muted', false) +
      `</g>`;
    s += `<g class="sg-fanout">`;
    for (let i = 0; i < n; i++) {
      s += `<line x1="${cxOf(i)}" y1="${coordY + COORD_H}" x2="${cxOf(i)}" y2="${stepY}" stroke="var(--muted)" stroke-width="1.25" marker-end="url(#skArrow)"${revealAttr(stepReveal(i))}/>`;
    }
    s += `</g>`;
  }

  // Forward arrows between steps. Past the failure the path is never taken:
  // dashed, open head.
  let usedNext = false;
  let usedUnreached = false;
  s += `<g class="sg-forward">`;
  for (let i = 0; i < n - 1; i++) {
    const unreached = failIdx >= 0 && i >= failIdx;
    if (unreached) usedUnreached = true;
    else usedNext = true;
    const dash = unreached ? ' stroke-dasharray="5 4"' : '';
    const marker = unreached ? 'skOpen' : 'skArrow';
    s += `<line x1="${xOf(i) + W}" y1="${stepCy}" x2="${xOf(i + 1)}" y2="${stepCy}" stroke="var(--muted)" stroke-width="1.5"${dash} marker-end="url(#${marker})"${revealAttr(stepReveal(i + 1))}/>`;
  }
  s += `</g>`;

  // Step cards.
  const kindsUsed = new Set<Status>();
  s += `<g${bl('steps')}>`;
  steps.forEach((st, i) => {
    const status = statuses[i] ?? 'ok';
    kindsUsed.add(status);
    const x = xOf(i);
    const isAccent = i === failIdx;
    const isFailed = status === 'failed';
    const isSkipped = status === 'skipped';
    const stroke = isAccent
      ? 'var(--accent)'
      : isFailed
        ? 'var(--negative)'
        : isSkipped
          ? 'var(--rule-solid)'
          : 'var(--ink)';
    const fill = isAccent
      ? 'var(--accent-tint)'
      : isFailed
        ? 'var(--negative-tint)'
        : isSkipped
          ? 'var(--paper-2)'
          : 'var(--paper)';
    const sw = isSkipped ? 1 : 1.5;
    const tone: Tone = isAccent ? 'accent' : isFailed ? 'negative' : 'muted';
    const tc = toneClass(tone);
    const headY = stepY + 16;
    // Header row: hollow step badge · service chip · status chip (right).
    let card =
      `<rect x="${x}" y="${stepY}" width="${W}" height="${cardH}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      `<circle cx="${x + 19}" cy="${headY}" r="7" fill="var(--paper)" stroke="${isAccent ? 'var(--accent)' : 'var(--muted)'}" stroke-width="1"/>` +
      `<text x="${x + 19}" y="${headY + 3}" class="t-badge${tc}" text-anchor="middle">${i + 1}</text>` +
      (svcLines[i] ?? [])
        .map(
          (ln, j) =>
            `<text x="${x + 34}" y="${headY + 3 + j * 11}" class="t-eyebrow${tc}"${j === 0 ? bp(`steps.${i}.service`) : ''}>${escapeHtml(ln)}</text>`,
        )
        .join('');
    const chipText = CHIP_TEXT[status];
    if (chipText.length > 0) {
      // A compact card puts the chip on its own row, under the header.
      card += compact
        ? chipSvg(x + 12, stepY + 30 + headExtra + 4, chipText, tone, false)
        : chipSvg(x + W - 10, headY, chipText, tone, true);
    }
    const lines = nameLines[i] ?? [];
    lines.forEach((ln, j) => {
      card += `<text x="${x + 12}" y="${stepY + nameTop + 11 + j * 15}" class="t-name${isAccent ? ' c-accent' : ''}">${escapeHtml(ln)}</text>`;
    });
    const aLines = actionLines[i] ?? [];
    aLines.forEach((ln, j) => {
      card += `<text x="${x + 12}" y="${stepY + nameTop + maxName * 15 + 12 + j * 13}" class="t-sub"${j === 0 ? bp(`steps.${i}.action`) : ''}>${escapeHtml(ln)}</text>`;
    });
    // The compensation card, joined to its step by a short dotted connector.
    const cLines = compLines[i] ?? [];
    if (cLines.length > 0) {
      const cr = revealAttr(compReveal(i));
      card +=
        `<line x1="${cxOf(i)}" y1="${stepY + cardH}" x2="${cxOf(i)}" y2="${compY}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="2 3"${cr}/>` +
        `<g${bp(`steps.${i}.compensate`)}${cr}>` +
        `<rect x="${x}" y="${compY}" width="${W}" height="${compH}" rx="4" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"/>` +
        `<text x="${x + 12}" y="${compY + 14}" class="t-eyebrow">${COMP_CHIP}</text>`;
      cLines.forEach((ln, j) => {
        card += `<text x="${x + 12}" y="${compY + 22 + 12 + j * 15}" class="t-name">${escapeHtml(ln)}</text>`;
      });
      card += `</g>`;
    }
    s += `<g${bp(`steps.${i}`)}${revealAttr(stepReveal(i))}>${card}</g>`;
  });
  s += `</g>`;

  // The compensating flow: from the failed step, down into the compensation
  // row, then right to left through every earlier compensation.
  let usedFlow = false;
  if (targets.length > 0) {
    usedFlow = true;
    const attrs = `fill="none" stroke="var(--negative)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#skErr)"`;
    s += `<g class="sg-compflow">`;
    const first = targets[0] ?? 0;
    const dropX = xOf(failIdx) - GAP / 2;
    // Leave the failed card low on its left edge — below the forward arrow
    // that enters it — so the drop never crosses that arrow.
    const leaveY = stepY + cardH - 12;
    s += `<path d="M${xOf(failIdx)},${leaveY} H${dropX} V${compCy} H${xOf(first) + W}" ${attrs}${revealAttr(compReveal(first))}/>`;
    for (let k = 1; k < targets.length; k++) {
      const from = targets[k - 1] ?? 0;
      const to = targets[k] ?? 0;
      s += `<path d="M${xOf(from)},${compCy} H${xOf(to) + W}" ${attrs}${revealAttr(compReveal(to))}/>`;
    }
    s += `</g>`;
  }

  s += `</svg>`;

  const items: LegendItem[] = [];
  if (orchestrated) items.push({ swatch: 'chip', chip: ORCH_CHIP, label: 'coordinates every step' });
  items.push({ swatch: 'node', label: 'step' });
  if (hasComp) items.push({ swatch: 'node-dashed', label: 'compensation' });
  if (failIdx >= 0) items.push({ swatch: 'node-accent', label: 'failure point' });
  if (kindsUsed.has('compensated')) items.push({ swatch: 'chip', chip: CHIP_TEXT.compensated, label: 'undone' });
  if (kindsUsed.has('skipped')) items.push({ swatch: 'node-fill2', label: 'skipped' });
  if (usedNext) items.push({ swatch: 'edge', label: 'next' });
  if (usedUnreached) items.push({ swatch: 'edge-dashed', label: 'not reached' });
  if (usedFlow) items.push({ swatch: 'edge-negative-dashed', label: 'compensating flow' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'SAGA',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
