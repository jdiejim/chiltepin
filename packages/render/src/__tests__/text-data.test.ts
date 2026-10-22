/**
 * Text in the data-structure blocks (packet, array, linkedlist, hashmap,
 * treemap) is never dropped without a mark: a cell grows to its text before
 * it cuts, a name too long for a narrow cell moves to a key, and every cut
 * ends with "…", keeps the full text in a `<title>`, and reaches the
 * geometry report as `label-truncated`.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderPacket } from '../blocks/packet.js';
import { renderArray } from '../blocks/array.js';
import { renderLinkedlist } from '../blocks/linkedlist.js';
import { renderHashmap } from '../blocks/hashmap.js';
import { renderTreemap } from '../blocks/treemap.js';
import { geometryReport, type GeometryReport } from '../geometryReport.js';
import { FONT, textWidth, type Font } from '../svg/wrapText.js';

const report = (type: string, data: unknown): GeometryReport =>
  (geometryReport as (t: string, d: unknown) => GeometryReport)(type, data);

const NAME_FONT: Font = { size: 11.5, weight: 700 };
const MONO10: Font = { size: 10, mono: true };
const MONO13: Font = { size: 13, mono: true, weight: 600 };

const TCP_FLAGS = ['NS', 'CWR', 'ECE', 'URG', 'ACK', 'PSH', 'RST', 'SYN', 'FIN'];
const TCP = {
  width: 32,
  fields: [
    { label: 'Data offset', bits: 4 },
    { label: 'Reserved', bits: 3 },
    ...TCP_FLAGS.map((label) => ({ label, bits: 1 })),
    { label: 'Receive window size in bytes', bits: 16 },
  ],
};

/** Every field cell: its rect width and the texts drawn in it. */
function packetCells(html: string): Array<{ path: string; w: number; texts: Array<{ cls: string; text: string }> }> {
  return parse(html)
    .querySelectorAll('g[data-bl="fields"] > g')
    .map((g) => ({
      path: g.getAttribute('data-bp') ?? '',
      w: Number(g.querySelector('rect')?.getAttribute('width')),
      texts: g.querySelectorAll('text').map((t) => ({ cls: t.getAttribute('class') ?? '', text: t.text })),
    }));
}

describe('packet: names on narrow cells (F2)', () => {
  it('shows every one-bit TCP flag by name, not just its bit count', () => {
    const html = renderPacket(TCP);
    const cells = packetCells(html);
    for (const flag of TCP_FLAGS) {
      const cell = cells.find((c) => c.texts.some((t) => t.text === flag));
      expect(cell, flag).toBeDefined();
    }
    // No key is needed: every name fits its cell.
    expect(html).not.toContain('pk-key');
  });

  it('never draws a name wider than its cell', () => {
    for (const c of packetCells(renderPacket(TCP))) {
      for (const t of c.texts) {
        if (t.cls.includes('pk-bits')) continue;
        const font = t.cls.includes('pk-name') ? NAME_FONT : MONO10;
        expect(textWidth(t.text, font), `${c.path} "${t.text}"`).toBeLessThanOrEqual(c.w);
      }
    }
  });

  it('gives a name that fits nowhere a key letter, and the key names the field in full', () => {
    const html = renderPacket({
      width: 32,
      fields: [
        { label: 'Version', bits: 4 },
        { label: 'Explicit congestion notification', bits: 2 },
        { label: 'Rest', bits: 26 },
      ],
    });
    const ecn = packetCells(html).find((c) => c.path === 'fields.1');
    expect(ecn?.texts.map((t) => t.text)).toContain('A');
    const key = parse(html).querySelector('g.pk-key');
    expect(key?.text).toContain('Explicit congestion notification · 2 bits');
    // A field named in full in the key is not a cut.
    const r = report('packet', {
      width: 32,
      fields: [
        { label: 'Version', bits: 4 },
        { label: 'Explicit congestion notification', bits: 2 },
        { label: 'Rest', bits: 26 },
      ],
    });
    expect(r.issues.filter((i) => i.kind === 'label-truncated')).toEqual([]);
  });

  it('wraps a long name to two lines in a cell with no value line', () => {
    const html = renderPacket({
      width: 32,
      fields: [
        { label: 'Differentiated services code point', bits: 6 },
        { label: 'Rest', bits: 26 },
      ],
    });
    const dscp = packetCells(html).find((c) => c.path === 'fields.0');
    const names = dscp?.texts.filter((t) => t.cls === 'pk-name').map((t) => t.text) ?? [];
    expect(names).toHaveLength(2);
    expect(names.join(' ')).toBe('Differentiated services code point');
  });

  it('cuts a name too long for a wide cell with "…", a title, and a label-truncated report', () => {
    const data = {
      width: 32,
      fields: [
        { label: 'Version', bits: 4, value: '4' },
        { label: 'Internet header length in thirty-two bit words', bits: 4, value: '5' },
        { label: 'Rest', bits: 24 },
      ],
    };
    const html = renderPacket(data);
    const ihl = packetCells(html).find((c) => c.path === 'fields.1');
    const name = ihl?.texts.find((t) => t.cls === 'pk-name')?.text ?? '';
    expect(name.endsWith('…')).toBe(true);
    expect(textWidth(name, NAME_FONT)).toBeLessThanOrEqual((ihl?.w ?? 0) - 6);
    expect(html).toContain('<title>Internet header length in thirty-two bit words = 5 — 4 bits at offset 4</title>');
    const cut = report('packet', data).issues.find((i) => i.kind === 'label-truncated');
    expect(cut?.path).toBe('fields.1.label');
  });

  it('shows a value whenever it fits its cell (no width gate)', () => {
    const html = renderPacket({ width: 32, fields: [{ label: 'V', bits: 1, value: '0' }, { label: 'Rest', bits: 31 }] });
    const v = packetCells(html).find((c) => c.path === 'fields.0');
    expect(v?.texts.some((t) => t.cls === 'pk-value' && t.text === '0')).toBe(true);
  });
});

/** The value cells of an array or list, as drawn. */
function valueTexts(html: string): Array<{ text: string; title: string | undefined }> {
  return parse(html)
    .querySelectorAll('text.ds-val')
    .map((t) => ({ text: t.childNodes.filter((n) => n.nodeType === 3).map((n) => n.text).join(''), title: t.querySelector('title')?.text }));
}

describe('array: values and pointer labels (R16)', () => {
  const KEYS = {
    items: [
      { value: 'user:1042', label: 'head' },
      { value: 'user:2087', label: 'i' },
      { value: 'session:9f3a', label: 'j' },
      { value: 'cart:77' },
    ],
  };

  it('shows `user:1042` whole and sizes every cell from the widest value', () => {
    const html = renderArray(KEYS);
    expect(valueTexts(html).map((v) => v.text)).toEqual(['user:1042', 'user:2087', 'session:9f3a', 'cart:77']);
    const widths = new Set(parse(html).querySelectorAll('g[data-bl="items"] rect').map((r) => r.getAttribute('width')));
    expect(widths.size).toBe(1);
    const w = Number([...widths][0]);
    expect(w).toBeGreaterThanOrEqual(textWidth('session:9f3a', MONO13));
  });

  it('keeps short values in the 44px square', () => {
    const html = renderArray({ items: [{ value: '3' }, { value: '17' }] });
    expect(parse(html).querySelector('g[data-bl="items"] rect')?.getAttribute('width')).toBe('44');
  });

  it('puts crowded neighbour labels on alternate rows so they never overlap', () => {
    const html = renderArray({
      items: [{ value: '1', label: 'left' }, { value: '4', label: 'slow pointer' }, { value: '9', label: 'fast pointer' }, { value: '16' }],
    });
    const labels = parse(html)
      .querySelectorAll('g[data-bp$=".label"] text')
      .map((t) => {
        const x = Number(t.getAttribute('x'));
        const w = textWidth(t.text, FONT.badge);
        return { y: Number(t.getAttribute('y')), lo: x - w / 2, hi: x + w / 2 };
      });
    expect(new Set(labels.map((l) => l.y)).size).toBeGreaterThan(1);
    for (let a = 0; a < labels.length; a++) {
      for (let b = a + 1; b < labels.length; b++) {
        const p = labels[a];
        const q = labels[b];
        if (p === undefined || q === undefined || p.y !== q.y) continue;
        expect(p.hi <= q.lo || q.hi <= p.lo, 'labels on one row overlap').toBe(true);
      }
    }
  });

  it('cuts a value past the cap with "…", a title, and a label-truncated report', () => {
    const data = { items: [{ value: 'req_01HZX4T9W8M2Q7Y5B3N6K0J1PA' }, { value: 'req_02' }] };
    const [first] = valueTexts(renderArray(data));
    expect(first?.text.endsWith('…')).toBe(true);
    expect(first?.title).toBe('req_01HZX4T9W8M2Q7Y5B3N6K0J1PA');
    expect(report('array', data).issues.find((i) => i.kind === 'label-truncated')?.path).toBe('items.0.value');
  });

  it('keeps a long window label inside the drawing', () => {
    const html = renderArray({ items: [{ value: '1' }, { value: '4' }], window: { from: 0, to: 0, label: 'prefix whose sum is below the target' } });
    const vb = /viewBox="0 0 (\d+) \d+"/.exec(html);
    const t = parse(html).querySelector('text[data-bp="window.label"]');
    const x = Number(t?.getAttribute('x'));
    const w = textWidth(t?.text ?? '', FONT.eyebrow);
    const start = t?.getAttribute('text-anchor') === 'end' ? x - w : x;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start + w).toBeLessThanOrEqual(Number(vb?.[1]));
  });
});

describe('linkedlist: values and markers (R16)', () => {
  it('shows every value whole in one shared box width', () => {
    const html = renderLinkedlist({ nodes: [{ value: 'user:1042' }, { value: 'session:9f3a' }, { value: '7' }] });
    expect(valueTexts(html).map((v) => v.text)).toEqual(['user:1042', 'session:9f3a', '7']);
    const widths = new Set(parse(html).querySelectorAll('g[data-bl="nodes"] rect').map((r) => r.getAttribute('width')));
    expect(widths.size).toBe(1);
  });

  it('staggers crowded markers and keeps the first one inside the drawing', () => {
    const html = renderLinkedlist({
      nodes: [{ value: '3', label: 'head of the list' }, { value: '5', label: 'tortoise (slow)' }, { value: '8', label: 'hare (fast)' }],
    });
    const ys = parse(html).querySelectorAll('g[data-bp$=".label"] text').map((t) => t.getAttribute('y'));
    expect(new Set(ys).size).toBe(2);
    // The left-hanging first label shifts the drawing right instead of clipping.
    expect(html).toMatch(/<g transform="translate\(\d+ 0\)">/);
  });

  it('cuts a value past the cap with "…", a title and a report', () => {
    const data = { nodes: [{ value: 'idempotency-key:7c1e9a0b4f2d4e6c8a10' }] };
    const [v] = valueTexts(renderLinkedlist(data));
    expect(v?.text.endsWith('…')).toBe(true);
    expect(v?.title).toBe('idempotency-key:7c1e9a0b4f2d4e6c8a10');
    expect(report('linkedlist', data).issues.find((i) => i.kind === 'label-truncated')?.path).toBe('nodes.0.value');
  });
});

describe('hashmap: pills', () => {
  it('grows a pill to its whole `key: value` (past the old 24-character cut)', () => {
    const html = renderHashmap({ buckets: 2, entries: [{ key: 'session:9f3a2c', value: 'user_1042_checkout', bucket: 0 }] });
    expect(html).toContain('>session:9f3a2c: user_1042_checkout<');
  });

  it('cuts a pill past the cap with "…", a title, and a report on the value', () => {
    const data = {
      buckets: 1,
      entries: [{ key: 'order:500121', value: 'pending_payment_awaiting_3ds_challenge_from_issuer_bank', bucket: 0 }],
    };
    const t = parse(renderHashmap(data)).querySelector('text.hsh-key');
    expect(t?.querySelector('title')?.text).toBe('order:500121: pending_payment_awaiting_3ds_challenge_from_issuer_bank');
    expect(t?.text.endsWith('…')).toBe(true);
    const cut = report('hashmap', data).issues.find((i) => i.kind === 'label-truncated');
    expect(cut?.path).toBe('entries.0.value');
    expect(cut?.message).toContain('order:500121');
  });

  it('names the entries it cannot draw instead of dropping them', () => {
    const html = renderHashmap({
      buckets: 14,
      entries: [
        { key: 'a', bucket: 0 },
        { key: 'late', bucket: 13 },
        { key: 'stray', bucket: 20 },
      ],
    });
    expect(html).toContain('+2 more buckets (1 entry not drawn)');
    expect(html).toContain('1 entry outside buckets 0–13 not drawn');
  });
});

describe('treemap: tile labels', () => {
  const SUITES = {
    unit: 's',
    items: [
      { label: 'end-to-end checkout', value: 610 },
      { label: 'payments integration', value: 240 },
      { label: 'catalog unit', value: 90 },
      { label: 'search unit', value: 44 },
      { label: 'auth unit', value: 30 },
      { label: 'i18n snapshots', value: 12 },
      { label: 'feature flags', value: 6 },
      { label: 'config schema', value: 2 },
    ],
  };

  it('numbers the tiles too small for their name and lists them in full under the drawing', () => {
    const html = renderTreemap(SUITES);
    const key = parse(html).querySelector('g.tm-key');
    expect(key?.text).toContain('i18n snapshots · 12s · 1%');
    expect(key?.text).toContain('config schema · 2s · <1%'); // a sliver never reads 0%
    // Every item's name is on the page: in its tile or in the key.
    for (const it of SUITES.items) expect(parse(html).querySelector('svg')?.text).toContain(it.label);
  });

  it('wraps a long name inside a tall tile instead of cutting it', () => {
    const html = renderTreemap({
      unit: 'k$',
      items: [
        { label: 'Kubernetes compute', value: 420 },
        { label: 'Aurora PostgreSQL clusters', value: 260 },
        { label: 'S3 storage and data transfer', value: 90 },
        { label: 'CloudWatch logs and metrics ingestion', value: 40 },
      ],
    });
    expect(html).not.toContain('…');
    expect(parse(html).querySelector('svg')?.text.replace(/\s+/g, ' ')).toContain('metrics');
  });

  it('lists an item with no area in the key rather than dropping it', () => {
    const html = renderTreemap({ items: [{ label: 'Compute', value: 10 }, { label: 'Free tier', value: 0 }] });
    expect(parse(html).querySelector('g.tm-key')?.text).toContain('Free tier · 0 · not drawn (no area)');
  });

  it('cuts a description that does not fit with "…" and reports it', () => {
    const data = {
      items: [
        { label: 'Compute', value: 60, desc: 'three node pools across two regions with spot instances for batch work, reserved instances for the public API tier, '.repeat(4) },
        { label: 'Storage', value: 40 },
      ],
    };
    const r = report('treemap', data);
    const cut = r.issues.find((i) => i.kind === 'label-truncated');
    expect(cut?.path).toBe('items.0.desc');
    expect(renderTreemap(data)).toContain('…');
  });
});
