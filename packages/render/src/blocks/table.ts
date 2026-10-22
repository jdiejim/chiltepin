/**
 * Renders a table block. Doc-studio variant supports:
 * - Column objects with `align` ('l'|'c'|'r') and `highlight`
 * - Cell objects with `tone` ('pos'|'neg'|'warn'|'muted'), `lead`, `highlight`
 * - Optional `title`, `description`, `note`
 *
 * Plain string columns / cells still work.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type TableData = BlockDataMap['table'];
type Col = NonNullable<TableData['columns']>[number];
type Cell = NonNullable<NonNullable<TableData['rows']>[number]>[number];

function colClass(c: Col): string {
  if (typeof c === 'string') return '';
  const parts: string[] = [];
  if (c.align === 'r') parts.push('r');
  if (c.align === 'c') parts.push('c');
  if (c.highlight === true) parts.push('hi');
  return parts.join(' ');
}

function colLabel(c: Col): string {
  return typeof c === 'string' ? c : c.label;
}

function cellClass(c: Cell): string {
  if (typeof c === 'string' || typeof c === 'number') return '';
  const parts: string[] = [];
  if (c.tone) parts.push(`cell-${c.tone}`);
  if (c.lead === true) parts.push('lead');
  if (c.highlight === true) parts.push('hi');
  return parts.join(' ');
}

function cellValue(c: Cell): string {
  if (typeof c === 'string' || typeof c === 'number') return escapeHtml(c);
  return escapeHtml(c.v);
}

export function renderTable(data: BlockDataMap['table']): string {
  const cols = data.columns ?? [];
  const rows = data.rows ?? [];
  const head = cols
    .map((c, i) => {
      const cls = colClass(c);
      return `<th${cls ? ` class="${cls}"` : ''}${bp(`columns.${i}`)}>${escapeHtml(colLabel(c))}</th>`;
    })
    .join('');
  const body = rows
    .map((r, ri) => {
      const cells = (r ?? [])
        .map((c, i) => {
          const col = cols[i];
          const cls = [col !== undefined ? colClass(col) : '', cellClass(c)]
            .filter(Boolean)
            .join(' ');
          return `<td${cls ? ` class="${cls}"` : ''}${bp(`rows.${ri}.${i}`)}>${cellValue(c)}</td>`;
        })
        .join('');
      return `<tr${bp(`rows.${ri}`)}>${cells}</tr>`;
    })
    .join('');
  const note =
    data.note !== undefined ? `<p class="tbl-note"${bp('note')}>${escapeHtml(data.note)}</p>` : '';
  // The scroll box lets a wide table scroll sideways on a phone instead of
  // pushing the page wider than the screen.
  return `<div class="tbl-scroll"><table class="pres-table"><thead><tr>${head}</tr></thead><tbody${bl('rows')}>${body}</tbody></table></div>${note}`;
}
