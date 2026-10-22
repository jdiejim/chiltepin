/**
 * Renders a `statustable` block — a task table whose free cells render under
 * `columns` headers (default: Task · Update) and whose final **Status** column
 * renders each row's `status` as a colored pill.
 *
 * The label → color vocabulary is user-defined via `statuses` (accent names);
 * rows may also use the built-in defaults (in progress · blocked · completed ·
 * todo · done), matched case-insensitively. A row may nest one level of
 * `subtasks` — rendered directly under their parent, indented with a tree
 * glyph and slightly muted, each with its own pill (no roll-up: the parent's
 * status is the author's call). Each parent + its subtasks form one `<tbody>`
 * group, so zebra striping alternates per group and the group is the
 * `data-bl` container for "+ add subtask". A subtle legend row appears below
 * the table when the user defines more than three labels of their own. Short
 * rows pad with empty cells; a status outside the vocabulary falls back to a
 * gray pill (and `chiltepin check` flags it).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { STATUSTABLE_DEFAULT_STATUSES, normalizeStatusColor } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type StatustableData = BlockDataMap['statustable'];
type StatusDef = NonNullable<StatustableData['statuses']>[number];
type Row = NonNullable<StatustableData['rows']>[number];
type Subtask = NonNullable<Row['subtasks']>[number];

/** Headers used when the block defines no `columns` of its own. */
const DEFAULT_COLUMNS: readonly string[] = ['Task', 'Update'];

/** How many user-defined labels it takes before a legend adds information. */
const LEGEND_MIN_LABELS = 2;

/**
 * Resolves a row's status to its palette accent — user vocabulary first, then
 * defaults. Semantic colors (`success`, `error`, …) normalize to their accent.
 */
function accentFor(status: string, statuses: readonly StatusDef[]): string {
  const key = status.toLowerCase();
  for (const s of statuses) if (s.label.toLowerCase() === key) return normalizeStatusColor(s.color);
  for (const s of STATUSTABLE_DEFAULT_STATUSES) if (s.label.toLowerCase() === key) return s.color;
  return 'gray';
}

/** The colored status pill for one row or subtask. */
function pill(status: string, statuses: readonly StatusDef[]): string {
  return `<span class="stt-pill stt-${accentFor(status, statuses)}">${escapeHtml(status)}</span>`;
}

/** One `<tr>` — free cells padded to `width`, then the status pill cell. */
function rowTr(
  row: Row | Subtask,
  path: string,
  width: number,
  statuses: readonly StatusDef[],
  sub: { readonly last: boolean } | null,
): string {
  const cells = Array.from({ length: width }, (_, i) => {
    const c = row.cells[i];
    const lead = i === 0 && sub === null ? ' class="stt-lead"' : '';
    // The tree glyph marks a subtask's first cell — ├ mid-list, └ for the last.
    const tree =
      i === 0 && sub !== null
        ? `<span class="stt-tree" aria-hidden="true">${sub.last ? '└' : '├'}</span>`
        : '';
    if (c === undefined) return `<td${lead}>${tree}</td>`; // ragged row — pad
    return `<td${lead}${bp(`${path}.cells.${i}`)}>${tree}${escapeHtml(c)}</td>`;
  }).join('');
  const hasKids =
    sub === null && 'subtasks' in row && row.subtasks !== undefined && row.subtasks.length > 0;
  const cls = sub !== null ? ' class="stt-sub"' : hasKids ? ' class="stt-haskids"' : '';
  return `<tr${cls}${bp(path)}>${cells}<td class="stt-status"${bp(`${path}.status`)}>${pill(row.status, statuses)}</td></tr>`;
}

// ─── legacy tracker rows (the former `tracker` type) ─────────────────────────
// A task list with a closed status / priority vocabulary in `items` — status
// pills, optional priority, owner, and due date columns. Done rows get a
// strikethrough via `.trk tr.done .trk-task`.

function renderTrackerBody(data: StatustableData): string {
  const items = data.items ?? [];
  const hasOwner = items.some((i) => i.owner !== undefined);
  const hasDue = items.some((i) => i.due !== undefined);

  const headCells = ['<th>Task</th>', '<th>Status</th>', '<th>Priority</th>'];
  if (hasOwner) headCells.push('<th>Owner</th>');
  if (hasDue) headCells.push('<th>Due</th>');

  let h = `<table class="trk"><thead><tr>${headCells.join('')}</tr></thead><tbody${bl('items')}>`;
  for (const [i, it] of items.entries()) {
    const st = it.status ?? 'todo';
    const pr = it.priority;
    const prCell =
      pr !== undefined ? `<span class="pri ${pr}">${escapeHtml(pr)}</span>` : '';
    const rowCls = st === 'done' ? ' class="done"' : '';
    const cells = [
      `<td class="trk-task"${bp(`items.${i}.task`)}>${escapeHtml(it.task)}</td>`,
      `<td${bp(`items.${i}.status`)}><span class="st ${st}">${escapeHtml(st)}</span></td>`,
      `<td${bp(`items.${i}.priority`)}>${prCell}</td>`,
    ];
    if (hasOwner) cells.push(`<td${bp(`items.${i}.owner`)}>${escapeHtml(it.owner ?? '')}</td>`);
    if (hasDue) cells.push(`<td${bp(`items.${i}.due`)}>${escapeHtml(it.due ?? '')}</td>`);
    h += `<tr${rowCls}${bp(`items.${i}`)}>${cells.join('')}</tr>`;
  }
  return `<div class="stt-scroll">${h}</tbody></table></div>`;
}

export function renderStatustable(data: StatustableData): string {
  // Legacy tracker-era bodies carry `items` instead of `rows` (the schema
  // requires one of the two) — they keep the former tracker presentation.
  if (data.rows === undefined) return renderTrackerBody(data);
  const rows = data.rows;
  const statuses = data.statuses ?? [];
  const cols = data.columns ?? DEFAULT_COLUMNS;
  const width = Math.max(
    cols.length,
    ...rows.flatMap((r) => [r.cells.length, ...(r.subtasks ?? []).map((s) => s.cells.length)]),
  );

  const head =
    Array.from({ length: width }, (_, i) => {
      const label = cols[i] !== undefined ? escapeHtml(cols[i] ?? '') : '';
      // Only user-supplied headers are addressable — default headers have no
      // YAML to point at.
      const path = data.columns !== undefined && i < data.columns.length ? bp(`columns.${i}`) : '';
      return `<th${path}>${label}</th>`;
    }).join('') + `<th class="stt-status-h">Status</th>`;

  // One <tbody> per parent row (parent + its subtasks): zebra alternates per
  // group, and the group is the subtasks' data-bl container.
  const groups = rows
    .map((row, ri) => {
      const subs = row.subtasks ?? [];
      const trs =
        rowTr(row, `rows.${ri}`, width, statuses, null) +
        subs
          .map((sub, si) =>
            rowTr(sub, `rows.${ri}.subtasks.${si}`, width, statuses, {
              last: si === subs.length - 1,
            }),
          )
          .join('');
      return `<tbody class="stt-group"${bl(`rows.${ri}.subtasks`)}>${trs}</tbody>`;
    })
    .join('');

  const desc =
    data.description !== undefined
      ? `<p class="stt-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';

  // Legend (the shared strip, inside the frame): the user's vocabulary in its
  // declared order — each entry addressable by its `statuses.i` paths — then
  // any status the rows use from the default vocabulary (e.g. `done`), so
  // every status the table shows is in the key.
  const entries: Array<{ readonly label: string; readonly index: number }> = statuses.map((s, i) => ({
    label: s.label,
    index: i,
  }));
  const known = new Set(statuses.map((s) => s.label.toLowerCase()));
  const note = (status: string): void => {
    const key = status.toLowerCase();
    if (!known.has(key)) {
      known.add(key);
      entries.push({ label: status, index: -1 });
    }
  };
  for (const row of rows) {
    note(row.status);
    for (const sub of row.subtasks ?? []) note(sub.status);
  }
  const legend =
    entries.length >= LEGEND_MIN_LABELS
      ? `<div class="diagram-legend stt-legend"${bl('statuses')}><span class="lg-title t-eyebrow">Legend</span>` +
        entries
          .map(({ label, index }) => {
            const own = index >= 0;
            return (
              `<span class="lg-item stt-key"${own ? bp(`statuses.${index}`) : ''}>` +
              `<i class="lg-sw stt-dot stt-${accentFor(label, statuses)}"${own ? bp(`statuses.${index}.color`) : ''}></i>` +
              `<span class="lg-label"${own ? bp(`statuses.${index}.label`) : ''}>${escapeHtml(label)}</span>` +
              `</span>`
            );
          })
          .join('') +
        `</div>`
      : '';

  return (
    `<div class="stt">${desc}` +
    `<div class="stt-wrap"><div class="stt-scroll"><table class="stt-table"${bl('rows')}>` +
    `<thead><tr>${head}</tr></thead>` +
    `${groups}` +
    `</table></div>${legend}</div></div>`
  );
}
