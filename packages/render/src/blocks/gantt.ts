/**
 * Renders a Gantt chart — period columns across the top, task rows with
 * horizontal bars told apart by kind.
 *
 * Skin (`DESIGN.md`): hairline period columns, `.t-eyebrow` period heads,
 * `.t-name` task labels. A planned bar is `paper-2` with an ink outline;
 * `done` is solid ink; `active` / `current` — the work happening now, the
 * one thing the schedule is read for — takes the accent; `milestone` is a
 * dashed outline. Renders inside the diagram frame (tag GANTT) with a legend
 * strip naming the kinds present.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { cutTitle, ellipsize, fitText, FONT, lineCount, textWidth } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type Kind = 'planned' | 'done' | 'active' | 'milestone';

function kindOf(kind: string | undefined): Kind {
  switch ((kind ?? '').toLowerCase()) {
    case 'done':
      return 'done';
    case 'active':
    case 'current':
      return 'active';
    case 'milestone':
      return 'milestone';
    default:
      return 'planned';
  }
}

const BAR_ATTRS: Record<Kind, string> = {
  planned: 'fill="var(--paper-2)" stroke="var(--ink)" stroke-width="1"',
  done: 'fill="var(--ink)" stroke="var(--ink)" stroke-width="1"',
  active: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  milestone: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"',
};

const KIND_LEGEND: Record<Kind, LegendItem> = {
  planned: { swatch: 'node-fill2', label: 'planned' },
  done: { swatch: 'fill', fill: 'var(--ink)', label: 'done' },
  active: { swatch: 'node-accent', label: 'in progress' },
  milestone: { swatch: 'node-dashed', label: 'milestone' },
};

/** One period head, cut with "…" (full text in a <title>, the cut reported) only when even two columns cannot hold it. */
function periodHead(text: string, x: number, y: number, room: number, i: number): string {
  const head = ellipsize(text, room, FONT.eyebrow, {
    path: `periods.${i}`,
    field: 'period',
    hint: 'Shorten the period name.',
  });
  return `<text x="${x}" y="${y}" class="t-eyebrow" text-anchor="middle">${cutTitle(head)}${escapeHtml(head.lines[0] ?? '')}</text>`;
}

/** The label gutter: from its base width, as wide as it takes (up to a cap) for every task label to fit in two lines. */
const LABEL_TEXT_W = 136;
const LABEL_TEXT_MAX = 280;
/** The most lines a task label takes; past them it ends in "…". */
const LABEL_LINES = 3;
/** A period column: its base width, and the widest it grows for its head (one row, then two staggered rows). */
const COL_W = 64;
const COL_ONE_ROW_MAX = 88;
const COL_TWO_ROW_MAX = 104;

export function renderGantt(data: BlockDataMap['gantt']): string {
  const periods = data.periods ?? [];
  const tasks = data.tasks ?? [];
  const P = Math.max(periods.length, 1);
  const padX = 20;
  const barH = 18;
  // Task labels: widen the gutter until every label fits in two lines (up to
  // a cap); a label that still needs more wraps to three, then ends in "…".
  let textW = LABEL_TEXT_W;
  const longest = (w: number): number => Math.max(1, ...tasks.map((t) => lineCount(t.label, w)));
  while (textW < LABEL_TEXT_MAX && longest(textW) > 2) textW += 4;
  const labelW = textW + padX;
  // Period heads are eyebrow caps. A column grows to hold its head; when
  // that is not enough the heads alternate between two rows; when even two
  // columns cannot hold one it is cut, with the full text in a <title>.
  // Neighbouring heads never print over each other.
  const widest = Math.max(0, ...periods.map((t) => textWidth(t, FONT.eyebrow)));
  const oneRow = Math.ceil(widest + 6) <= COL_ONE_ROW_MAX;
  const colW = oneRow
    ? Math.max(COL_W, Math.ceil(widest + 6))
    : Math.min(COL_TWO_ROW_MAX, Math.max(COL_ONE_ROW_MAX, Math.ceil((widest + 6) / 2)));
  const staggered = !oneRow;
  const headRoom = (staggered ? colW * 2 : colW) - 6;
  const padTop = staggered ? 48 : 34;
  const padBot = 14;
  // Every row grows uniformly when any label wraps.
  const labelLines = tasks.map((t, i) =>
    fitText(t.label, {
      width: textW,
      font: FONT.name,
      maxLines: LABEL_LINES,
      report: { path: `tasks.${i}.label`, field: 'label', hint: 'Shorten the task `label`.' },
    }),
  );
  const maxLines = Math.max(1, ...labelLines.map((w) => w.lines.length));
  const rowH = 30 + (maxLines - 1) * 14;
  const width = labelW + padX * 2 + P * colW;
  const height = padTop + tasks.length * rowH + padBot;
  const xCol = (i: number): number => labelW + padX + i * colW;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Schedule</title>`;
  s += `<g${bl('periods')}>`;
  for (let i = 0; i < periods.length; i++) {
    s +=
      `<g${bp(`periods.${i}`)}>` +
      `<line x1="${xCol(i)}" y1="${padTop - 6}" x2="${xCol(i)}" y2="${height - padBot}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>` +
      periodHead(periods[i] ?? '', xCol(i) + colW / 2, padTop - 12 - (staggered && i % 2 === 0 ? 14 : 0), headRoom, i) +
      `</g>`;
  }
  s += `</g>`;
  s += `<line x1="${xCol(P)}" y1="${padTop - 6}" x2="${xCol(P)}" y2="${height - padBot}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  const kinds = new Set<Kind>();
  s += `<g${bl('tasks')}>`;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t === undefined) continue;
    const kind = kindOf(t.kind);
    kinds.add(kind);
    const y = padTop + i * rowH;
    const bx = xCol(t.start ?? 0);
    const span = Math.max(1, t.span ?? 1);
    const bw = span * colW - 8;
    const fit = labelLines[i];
    const ls = fit?.lines ?? [];
    const tip = fit !== undefined ? cutTitle(fit) : '';
    const cls = kind === 'active' ? 't-name c-accent' : 't-name';
    const label =
      ls.length <= 1
        ? `<text x="${padX}" y="${y + rowH / 2 + 4.5}" class="${cls}"${bp(`tasks.${i}.label`)}>${tip}${escapeHtml(ls[0] ?? '')}</text>`
        : `<g${bp(`tasks.${i}.label`)}>` +
          tip +
          ls
            .map(
              (ln, j) =>
                `<text x="${padX}" y="${y + rowH / 2 + 4.5 - (ls.length - 1) * 7 + j * 14}" class="${cls}">${escapeHtml(ln)}</text>`,
            )
            .join('') +
          `</g>`;
    s +=
      `<g${bp(`tasks.${i}`)}>` +
      label +
      `<rect x="${bx + 4}" y="${y + (rowH - barH) / 2}" width="${bw}" height="${barH}" rx="2" ${BAR_ATTRS[kind]}/>` +
      `</g>`;
  }
  s += `</g>`;
  s += `</svg>`;
  const items = (['planned', 'done', 'active', 'milestone'] as const)
    .filter((k) => kinds.has(k))
    .map((k) => KIND_LEGEND[k]);
  const legendHtml = renderLegend(items);
  return diagramFrame(
    {
      tag: 'GANTT',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
