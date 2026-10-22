/**
 * The table block's rich cells: inline Markdown in cells and headers (with
 * raw HTML still escaped), the `num` / `check` / `bar` column types, group
 * rows, the `foot` row, the Studio data paths of each, and the stylesheet
 * rules that keep the colours on tokens.
 */

import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { DARK_SET, houseCss, LIGHT_SET } from '../css.js';
import { renderTable } from '../blocks/table.js';

type TableData = Parameters<typeof renderTable>[0];

const root = (data: TableData): ReturnType<typeof parse> => parse(renderTable(data));
/** The inner HTML of body cell (r, c). */
const cell = (data: TableData, r: number, c: number): string =>
  root(data).querySelector(`[data-bp="rows.${String(r)}.${String(c)}"]`)?.innerHTML ?? '';
/** The visible text of body cell (r, c), screen-reader words included. */
const text = (data: TableData, r: number, c: number): string =>
  root(data).querySelector(`[data-bp="rows.${String(r)}.${String(c)}"]`)?.text ?? '';

describe('inline Markdown in cells and headers', () => {
  it('renders bold, emphasis, code and links in cells, headers and the note', () => {
    const html = renderTable({
      columns: ['**Code**', 'Meaning'],
      rows: [['`card_declined`', 'The *issuer* said **no**; see [docs](https://example.com/x)']],
      note: 'Codes follow `RFC 9110`.',
    });
    expect(html).toContain('<th scope="col" data-bp="columns.0"><strong>Code</strong></th>');
    expect(html).toContain('<code>card_declined</code>');
    expect(html).toContain('The <em>issuer</em> said <strong>no</strong>; see <a href="https://example.com/x">docs</a>');
    expect(html).toContain('<p class="tbl-note" data-bp="note">Codes follow <code>RFC 9110</code>.</p>');
  });

  it('keeps raw HTML escaped in cells, headers, group labels and the note', () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const html = renderTable({
      columns: [evil, { label: evil, type: 'check' }],
      rows: [[{ v: evil, group: true }], [evil, evil]],
      foot: [evil],
      note: evil,
    });
    expect(html).not.toMatch(/<img|<script|onerror="/);
    expect(html).toContain('&lt;img src=x onerror=');
    const r = root({ columns: ['A'], rows: [[evil]] });
    expect(r.querySelectorAll('img, script')).toHaveLength(0);
  });

  it('a javascript: link loses its href, and a link title cannot break out of its attribute', () => {
    const html = renderTable({
      columns: ['A'],
      rows: [['[x](javascript:alert(1))'], ['[y](https://a.example "t\\" onmouseover=\\"alert(1)")']],
    });
    expect(html).toContain('<a href="#">x</a>');
    const links = parse(html).querySelectorAll('a');
    expect(links.map((a) => Object.keys(a.attributes).sort())).toEqual([['href'], ['href', 'title']]);
    expect(html).toContain('title="t&quot; onmouseover=&quot;alert(1)"');
  });

  it('a unit cannot inject markup or attributes', () => {
    const html = renderTable({
      columns: [{ label: 'A', type: 'num', unit: '"><img src=x onerror=alert(1)>' }],
      rows: [[1]],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&quot;&gt;&lt;img');
  });

  it('a number cell prints as a number, never as Markdown', () => {
    expect(cell({ columns: ['A', 'B'], rows: [['x', 1]] }, 0, 1)).toBe('1');
    expect(cell({ columns: ['A'], rows: [[true]] }, 0, 0)).toBe('true');
  });
});

describe('num columns', () => {
  const lat: TableData = {
    columns: ['Region', { label: 'p99', type: 'num', unit: 'ms' }, { label: 'Cost', type: 'num', unit: '$' }],
    rows: [
      ['a', 91.5, 4210],
      ['b', 120, 2100.5],
      ['c', '1,204', -880],
    ],
  };

  it('right-aligns with thousands separators and the decimals of the most precise value', () => {
    expect(text(lat, 0, 1)).toBe('91.5 ms');
    expect(text(lat, 1, 1)).toBe('120.0 ms');
    expect(text(lat, 2, 1)).toBe('1,204.0 ms');
    expect(root(lat).querySelector('[data-bp="columns.1"]')?.classNames).toBe('r num');
    expect(root(lat).querySelector('[data-bp="rows.0.1"]')?.classNames).toBe('r num');
  });

  it('puts a currency before the number, rounds money to cents, and signs with a true minus', () => {
    expect(text(lat, 0, 2)).toBe('$4,210.00');
    expect(text(lat, 1, 2)).toBe('$2,100.50');
    expect(text(lat, 2, 2)).toBe('−$880.00');
  });

  it('a suffix unit is a quiet span; % sits on the number', () => {
    expect(cell(lat, 0, 1)).toBe('91.5<span class="t-u">&nbsp;ms</span>');
    const pct = { columns: [{ label: 'Δ', type: 'num' as const, unit: '%' }], rows: [[3.25], [-0.001]] };
    expect(cell(pct, 0, 0)).toBe('3.250<span class="t-u">%</span>');
    // A value that rounds to zero carries no sign.
    expect(text({ columns: [{ label: 'Δ', type: 'num' }], rows: [[1.5], [-0.0000001]] }, 1, 0)).toBe('0.0');
  });

  it('an explicit + in text is kept (a delta column)', () => {
    const d = { columns: [{ label: 'Δ', type: 'num' as const, unit: '%' }], rows: [['+3.5'], ['-1.25'], ['+0.001']] };
    expect(text(d, 0, 0)).toBe('+3.500%');
    expect(text(d, 1, 0)).toBe('−1.250%');
    expect(text(d, 2, 0)).toBe('+0.001%');
  });

  it('text in a num column stays inline Markdown', () => {
    expect(cell({ columns: [{ label: 'A', type: 'num' }], rows: [['**n/a**']] }, 0, 0)).toBe('<strong>n/a</strong>');
  });

  it('an explicit align wins over the type default', () => {
    const r = root({ columns: [{ label: 'A', type: 'num', align: 'c' }], rows: [[1]] });
    expect(r.querySelector('[data-bp="rows.0.0"]')?.classNames).toBe('c num');
  });
});

describe('check columns', () => {
  const plans: TableData = {
    columns: ['Feature', { label: 'Pro', type: 'check' }],
    rows: [['SSO', 'yes'], ['Audit', 'No'], ['Domains', 'partial'], ['API', true], ['Seats', false], ['Log', '30 days']],
  };

  it('draws ✓ ✗ – from the shared icons and keeps the word for screen readers and copy', () => {
    for (const [r, state, word, icon] of [
      [0, 'yes', 'Yes', 'M20 6L9 17l-5-5'],
      [1, 'no', 'No', 'M18 6L6 18M6 6l12 12'],
      [2, 'partial', 'Partial', 'M5 12h14'],
      [3, 'yes', 'Yes', 'M20 6L9 17l-5-5'],
      [4, 'no', 'No', 'M18 6L6 18M6 6l12 12'],
    ] as const) {
      const html = cell(plans, r, 1);
      expect(html).toContain(`<span class="t-chk t-${state}">`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(icon);
      expect(html).toContain(`<span class="t-sr">${word}</span>`);
      expect(text(plans, r, 1)).toBe(word);
    }
  });

  it('other text stays text, and the column centres by default', () => {
    expect(cell(plans, 5, 1)).toBe('30 days');
    expect(root(plans).querySelector('[data-bp="rows.0.1"]')?.classNames).toBe('c chk');
  });

  it('a check word in an untyped column stays a word', () => {
    expect(cell({ columns: ['A'], rows: [['yes']] }, 0, 0)).toBe('yes');
  });
});

describe('bar columns', () => {
  const traffic: TableData = {
    columns: ['Region', { label: 'Requests', type: 'bar' }],
    rows: [['a', 40000], ['b', 10000], ['c', 0], ['d', 'n/a']],
    foot: ['Total', 50000],
  };
  const width = (r: number): string | undefined =>
    /width:([\d.]+)%/.exec(cell(traffic, r, 1))?.[1];

  it('scales each bar to the largest value in the column', () => {
    expect(width(0)).toBe('100');
    expect(width(1)).toBe('25');
    expect(width(2)).toBe('0');
  });

  it('prints the number beside the bar, in a box as wide as the widest value', () => {
    expect(cell(traffic, 1, 1)).toContain('<span class="t-v" style="min-width:6ch">10,000</span>');
    expect(cell(traffic, 1, 1)).toContain('<span class="t-bar" aria-hidden="true">');
  });

  it('text gets no bar, and the foot total prints without one (it would dwarf the rows)', () => {
    expect(cell(traffic, 3, 1)).toBe('n/a');
    const foot = root(traffic).querySelector('[data-bp="foot.1"]');
    expect(foot?.innerHTML).toBe('50,000');
    expect(foot?.classNames).toBe('r num bar');
  });
});

describe('group rows and the foot', () => {
  const flags: TableData = {
    columns: ['Flag', { label: 'On', type: 'check' }, 'Notes'],
    rows: [[{ v: 'Checkout', group: true }], ['apple_pay', true, ''], [{ v: 'Search', group: true }, '', ''], ['typo', 'yes']],
    foot: ['2 flags', 2],
  };

  it('a group row is one header cell across the table, with Studio paths on the row and the label', () => {
    const r = root(flags);
    const groups = r.querySelectorAll('tr.t-grp');
    expect(groups).toHaveLength(2);
    expect(renderTable(flags)).toContain(
      '<tr class="t-grp" data-bp="rows.0"><th colspan="3" scope="rowgroup" data-bp="rows.0.0"><span>Checkout</span></th></tr>',
    );
    // Padding cells beside the label (a Studio column op) keep it a group row.
    expect(groups[1]?.getAttribute('data-bp')).toBe('rows.2');
  });

  it('a short data row is padded to the table width; the padding takes no data path', () => {
    const row = root(flags).querySelector('[data-bp="rows.3"]');
    expect(row?.querySelectorAll('td')).toHaveLength(3);
    expect(row?.querySelectorAll('td[data-bp]')).toHaveLength(2);
  });

  it('the foot is a tfoot row with paths on the row and each cell, formatted by the column types', () => {
    const html = renderTable(flags);
    expect(html).toMatch(/<\/tbody><tfoot><tr data-bp="foot">/);
    const r = root(flags);
    expect(r.querySelector('[data-bp="foot.0"]')?.text).toBe('2 flags');
    expect(r.querySelector('tfoot tr')?.querySelectorAll('td')).toHaveLength(3);
  });

  it('the rows container and every header keep their Studio paths', () => {
    const html = renderTable(flags);
    expect(html).toContain('<tbody data-bl="rows">');
    for (const p of ['columns.0', 'columns.1', 'columns.2', 'rows.1', 'rows.1.0', 'rows.1.1']) {
      expect(html).toContain(`data-bp="${p}"`);
    }
  });
});

describe('phone width', () => {
  it('holds a hyphenated word whole: its header gets a min-width', () => {
    const r = root({ columns: ['Region', 'Due'], rows: [['ap-southeast-2', '2026-10-02'], ['`code-span-is-not-counted-here`', 'x']] });
    expect(r.querySelector('[data-bp="columns.0"]')?.getAttribute('style')).toBe('min-width:calc(11.76em + 24px)');
    expect(r.querySelector('[data-bp="columns.1"]')?.getAttribute('style')).toBe('min-width:calc(8.40em + 24px)');
  });

  it('a hyphenated header word counts too', () => {
    const r = root({ columns: ['Multi-AZ'], rows: [['yes']] });
    expect(r.querySelector('[data-bp="columns.0"]')?.getAttribute('style')).toBe('min-width:calc(6.72em + 24px)');
  });

  it('plain words and long URLs set no min-width', () => {
    const r = root({ columns: ['A'], rows: [['plain words only'], ['https://example.com/a/very/long/path/that/may/break']] });
    expect(r.querySelector('[data-bp="columns.0"]')?.getAttribute('style')).toBeUndefined();
  });
});

describe('table stylesheet', () => {
  it('keeps colours on tokens: units and no / partial marks are muted, a yes is ink', () => {
    expect(houseCss).toContain('.docskin .pres-table .t-u{color:var(--muted);}');
    expect(houseCss).toContain('.docskin .pres-table .t-yes{color:var(--ink);}');
    expect(houseCss).toContain('.docskin .pres-table .t-no,.docskin .pres-table .t-partial{color:var(--muted);}');
  });

  it('muted text (units, no marks) clears 4.5:1 on paper in both themes', () => {
    const tok = (set: string, name: string): string => (new RegExp(`--${name}:([^;]+);`).exec(set)?.[1] ?? '').trim();
    const lum = (hex: string): number => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((s) =>
        s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4,
      ) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const set of [LIGHT_SET, DARK_SET]) {
      const [hi, lo] = [lum(tok(set, 'muted')), lum(tok(set, 'paper'))].sort((a, b) => b - a) as [number, number];
      expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tabular figures for numbers, a rule above the foot, and rules (not stripes) between rows', () => {
    expect(houseCss).toContain('.docskin .pres-table :is(th,td).num,.docskin .pres-table td.r,.docskin .pres-table tfoot td{font-variant-numeric:tabular-nums;}');
    expect(houseCss).toContain('.docskin .pres-table tfoot td{font-weight:600;color:var(--ink);border-top:1px solid var(--rule-solid);');
    expect(houseCss).toContain('.docskin .tbl-scroll>.pres-table tbody tr:nth-child(even){background:none;}');
  });

  it('print: the foot does not repeat on each page, and the sticky column lies flat', () => {
    expect(houseCss).toContain('@media print{.docskin .pres-table tfoot{display:table-row-group;}');
    expect(houseCss).toContain('.docskin .tbl-scroll>.pres-table :is(th,td){position:static;animation:none;}');
  });

  it('the sticky first column is phone-only and scroll-driven, so a table that fits draws plain', () => {
    expect(houseCss).toMatch(/@supports \(animation-timeline:scroll\(\)\)\{@media\(max-width:640px\)\{\.docskin \.tbl-scroll>\.pres-table :is\(th,td\):first-child:not\(\[colspan\]\)\{position:sticky;/);
  });
});
