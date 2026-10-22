/**
 * Renders a table block.
 *
 * - Header labels and text cells are inline Markdown (`renderInlineMd`): bold,
 *   `code`, links, and whatever inline syntax the prose pipeline knows. Raw
 *   HTML stays escaped. A number cell prints as a number, never as Markdown.
 * - Column objects take `align` ('l'|'c'|'r'), `highlight`, and a `type`:
 *   `num` (formatted figures, an optional `unit`), `check` (yes / no /
 *   partial as ✓ ✗ – with the word kept for screen readers and copy), or
 *   `bar` (a num column plus a quiet bar scaled to the column's largest value).
 * - Cell objects take `tone` ('pos'|'neg'|'warn'|'muted'), `lead`, `highlight`.
 * - A one-cell row `[{ v: Name, group: true }]` is a section label across the table.
 * - `foot` is one closing row (totals) under a rule.
 *
 * Every element an author can click carries its `data-bp` path: `columns.i`,
 * `rows.r`, `rows.r.c` (a group label is `rows.r.0`), `foot`, `foot.c`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { renderInlineMd } from '../markdown.js';
import { bl, bp } from '../paths.js';
import { iconSvg } from '../svg/icons.js';

type TableData = BlockDataMap['table'];
type Col = NonNullable<TableData['columns']>[number];
type Cell = NonNullable<TableData['rows']>[number][number];
type ColType = 'num' | 'check' | 'bar';

/** What one column needs to format its cells. */
interface ColSpec {
  readonly type: ColType | undefined;
  readonly unit: string | undefined;
  /** Class list shared by the header and every cell of the column. */
  readonly cls: string;
  /** Decimals every number in the column prints with. */
  readonly decimals: number;
  /** The largest body value (bar columns): the 100% bar. */
  readonly max: number;
  /** The widest printed value, in `ch` (bar columns): every bar starts at one x. */
  readonly chars: number;
  /** The longest hyphenated or slashed word (`ap-southeast-2`), in characters: the column never breaks it. */
  readonly word: number;
}

/** Units printed before the number; every other unit goes after it. */
const PREFIX_UNITS: ReadonlySet<string> = new Set(['$', '€', '£', '¥']);
/** A plain number written as text: `1200`, `1,200`, `-3.5`. */
const NUM_TEXT = /^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
/** More decimals than this is noise in a table. */
const MAX_DECIMALS = 6;
/** Past this magnitude `toFixed` switches to exponent form; print the raw value. */
const MAX_GROUPED = 1e15;

const CHECK_WORDS: Readonly<Record<string, 'yes' | 'no' | 'partial'>> = {
  yes: 'yes',
  true: 'yes',
  no: 'no',
  false: 'no',
  partial: 'partial',
};
const CHECK_DRAW = {
  yes: { icon: 'check', word: 'Yes' },
  no: { icon: 'x', word: 'No' },
  partial: { icon: 'minus', word: 'Partial' },
} as const;

/**
 * A group row's label, or `undefined` for a data row. Empty cells beside the
 * label are padding (Studio pads every row when it adds or moves a column).
 */
function groupLabel(row: readonly Cell[]): string | undefined {
  const label = row.find((c) => typeof c === 'object' && c.group === true);
  if (label === undefined || typeof label !== 'object') return undefined;
  return row.every((c) => c === label || c === '') ? String(label.v) : undefined;
}

/** The value a cell holds (`v` of a detailed cell). */
function valueOf(c: Cell | undefined): string | number | boolean | undefined {
  return c !== undefined && typeof c === 'object' ? c.v : c;
}

/**
 * A cell value read as a number, with the decimals it was written with.
 * `plus` keeps an explicit `+` the author wrote in text (`"+3.5"`, a delta).
 */
function parseNum(v: unknown): { n: number; dec: number; plus: boolean } | undefined {
  let text: string;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    text = String(v);
    if (/e/i.test(text)) return { n: v, dec: 0, plus: false };
  } else if (typeof v === 'string' && NUM_TEXT.test(v.trim())) {
    text = v.trim().replace(/,/g, '').replace('−', '-');
  } else {
    return undefined;
  }
  const dot = text.indexOf('.');
  return { n: Number(text), dec: dot < 0 ? 0 : Math.min(MAX_DECIMALS, text.length - dot - 1), plus: text.startsWith('+') };
}

/** `1234567.5` → `1,234,567.50` with a true minus sign and the unit (HTML). */
function formatNum(n: number, decimals: number, unit?: string, plus = false): string {
  if (Math.abs(n) >= MAX_GROUPED) return escapeHtml(String(n));
  const fixed = Math.abs(n).toFixed(decimals);
  const zero = Number(fixed) === 0;
  const sign = n < 0 && !zero ? '−' : plus && !zero ? '+' : '';
  const [int = '0', frac] = fixed.split('.');
  const body = `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac !== undefined ? `.${frac}` : ''}`;
  if (unit === undefined || unit === '') return `${sign}${body}`;
  if (PREFIX_UNITS.has(unit)) return `${sign}${escapeHtml(unit)}${body}`;
  // `%` sits on the number; a word unit keeps a no-break space.
  const gap = unit === '%' ? '' : '&nbsp;';
  return `${sign}${body}<span class="t-u">${gap}${escapeHtml(unit)}</span>`;
}

function columnSpecs(cols: readonly Col[], rows: ReadonlyArray<readonly Cell[]>, foot: readonly Cell[]): ColSpec[] {
  return cols.map((c, i) => {
    const word = longestJoinedWord([colLabel(c), ...rows.map((r) => r[i]), foot[i]]);
    if (typeof c === 'string') return { type: undefined, unit: undefined, cls: '', decimals: 0, max: 0, chars: 0, word };
    const type = c.type;
    const align = c.align ?? (type === 'num' || type === 'bar' ? 'r' : type === 'check' ? 'c' : 'l');
    const cls = [
      align === 'r' ? 'r' : align === 'c' ? 'c' : '',
      type === 'num' ? 'num' : type === 'bar' ? 'num bar' : type === 'check' ? 'chk' : '',
      c.highlight === true ? 'hi' : '',
    ]
      .filter(Boolean)
      .join(' ');
    let decimals = 0;
    let max = 0;
    if (type === 'num' || type === 'bar') {
      const body = rows.filter((r) => groupLabel(r) === undefined).map((r) => r[i]);
      for (const cell of [...body, foot[i]]) {
        const p = parseNum(valueOf(cell));
        if (p !== undefined) decimals = Math.max(decimals, p.dec);
      }
      for (const cell of body) {
        const p = parseNum(valueOf(cell));
        if (p !== undefined) max = Math.max(max, p.n);
      }
      // Money reads in cents or whole units, never in tenths.
      if (c.unit !== undefined && PREFIX_UNITS.has(c.unit) && decimals === 1) decimals = 2;
    }
    let chars = 0;
    if (type === 'bar') {
      for (const cell of [...rows.filter((r) => groupLabel(r) === undefined).map((r) => r[i]), foot[i]]) {
        const p = parseNum(valueOf(cell));
        if (p !== undefined) chars = Math.max(chars, plainLength(formatNum(p.n, decimals, c.unit, p.plus)));
      }
    }
    return { type, unit: c.unit, cls, decimals, max, chars, word };
  });
}

/** A word longer than this may break: holding it whole would widen the column too far. */
const MAX_HELD_WORD = 18;

/**
 * The longest word in a column that a browser would break at a `-` or `/`
 * (`ap-southeast-2` → `ap-` / `southeast-` / `2` on a phone). Code spans
 * never wrap and a link target is not shown, so neither counts.
 */
function longestJoinedWord(cells: ReadonlyArray<Cell | undefined>): number {
  let n = 0;
  for (const c of cells) {
    const v = valueOf(c);
    if (typeof v !== 'string') continue;
    const shown = v.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ' ').replace(/[*_[\]()]/g, ' ');
    for (const w of shown.split(/\s+/)) {
      if (/[-/]/.test(w) && w.length <= MAX_HELD_WORD) n = Math.max(n, w.length);
    }
  }
  return n;
}

/** The visible length of a formatted value (tags dropped, an entity is one character). */
function plainLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').length;
}

function colLabel(c: Col): string {
  return typeof c === 'string' ? c : c.label;
}

function cellClass(c: Cell): string {
  if (typeof c !== 'object') return '';
  const parts: string[] = [];
  if (c.tone) parts.push(`cell-${c.tone}`);
  if (c.lead === true) parts.push('lead');
  if (c.highlight === true) parts.push('hi');
  return parts.join(' ');
}

/** Plain cell content: a number as a number, text as inline Markdown. */
function plainValue(v: string | number | boolean | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return renderInlineMd(v);
  return escapeHtml(String(v));
}

/** One cell's inner HTML under its column's type. `inFoot` drops the bar. */
function cellContent(c: Cell, spec: ColSpec | undefined, inFoot: boolean): string {
  const v = valueOf(c);
  if (spec?.type === 'check') {
    const state = typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'string' ? CHECK_WORDS[v.trim().toLowerCase()] : undefined;
    if (state === undefined) return plainValue(v);
    const d = CHECK_DRAW[state];
    return `<span class="t-chk t-${state}">${iconSvg(d.icon, 'ic')}<span class="t-sr">${d.word}</span></span>`;
  }
  if (spec?.type === 'num' || spec?.type === 'bar') {
    const p = parseNum(v);
    if (p === undefined) return plainValue(v);
    const text = formatNum(p.n, spec.decimals, spec.unit, p.plus);
    if (spec.type === 'num' || inFoot) return text;
    const pct = spec.max > 0 ? Math.round((Math.max(0, p.n) / spec.max) * 1000) / 10 : 0;
    return `<div class="t-bc"><span class="t-bar" aria-hidden="true"><span class="t-fill" style="width:${String(pct)}%"></span></span><span class="t-v" style="min-width:${String(spec.chars)}ch">${text}</span></div>`;
  }
  return plainValue(v);
}

/** One row of `<td>`s, padded to the table's width so every rule runs across. */
function cellsHtml(cells: readonly Cell[], specs: readonly ColSpec[], width: number, path: string, inFoot: boolean): string {
  const tds = cells.map((c, i) => {
    const spec = specs[i];
    const cls = [spec?.cls ?? '', cellClass(c)].filter(Boolean).join(' ');
    return `<td${cls ? ` class="${cls}"` : ''}${bp(`${path}.${String(i)}`)}>${cellContent(c, spec, inFoot)}</td>`;
  });
  for (let i = cells.length; i < width; i++) {
    const cls = specs[i]?.cls ?? '';
    tds.push(`<td${cls ? ` class="${cls}"` : ''}></td>`);
  }
  return tds.join('');
}

export function renderTable(data: BlockDataMap['table']): string {
  const cols = data.columns ?? [];
  const rows = data.rows ?? [];
  const foot = data.foot ?? [];
  const specs = columnSpecs(cols, rows, foot);
  const width = Math.max(
    cols.length,
    foot.length,
    ...rows.map((r) => (groupLabel(r) === undefined ? r.length : 1)),
    1,
  );
  const head =
    cols.length > 0
      ? `<thead><tr>${cols
          .map((c, i) => {
            const cls = specs[i]?.cls ?? '';
            // The header holds the column at its longest joined word: 0.84em of
            // the header type is about one character of the cell type, plus the
            // cell's side padding.
            const word = specs[i]?.word ?? 0;
            const style = word > 0 ? ` style="min-width:calc(${(word * 0.84).toFixed(2)}em + 24px)"` : '';
            return `<th scope="col"${cls ? ` class="${cls}"` : ''}${style}${bp(`columns.${String(i)}`)}>${renderInlineMd(colLabel(c))}</th>`;
          })
          .join('')}</tr></thead>`
      : '';
  const body = rows
    .map((r, ri) => {
      const group = groupLabel(r);
      if (group !== undefined) {
        // The label sits in a span that stays in view while the table scrolls sideways.
        return `<tr class="t-grp"${bp(`rows.${String(ri)}`)}><th colspan="${String(width)}" scope="rowgroup"${bp(`rows.${String(ri)}.0`)}><span>${renderInlineMd(group)}</span></th></tr>`;
      }
      return `<tr${bp(`rows.${String(ri)}`)}>${cellsHtml(r, specs, width, `rows.${String(ri)}`, false)}</tr>`;
    })
    .join('');
  const tfoot =
    data.foot !== undefined ? `<tfoot><tr${bp('foot')}>${cellsHtml(foot, specs, width, 'foot', true)}</tr></tfoot>` : '';
  const note =
    data.note !== undefined ? `<p class="tbl-note"${bp('note')}>${renderInlineMd(data.note)}</p>` : '';
  // The scroll box lets a wide table scroll sideways on a phone instead of
  // pushing the page wider than the screen.
  return `<div class="tbl-scroll"><table class="pres-table">${head}<tbody${bl('rows')}>${body}</tbody>${tfoot}</table></div>${note}`;
}
