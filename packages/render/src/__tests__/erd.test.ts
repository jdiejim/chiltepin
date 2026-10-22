/**
 * The erd renderer: every column marker lands as a chip, the kind chips and
 * panels appear, relations are routed with cardinality letters (dashed when
 * non-identifying), enum cards sit in the side column, the accent lands on
 * the aggregate root, the legend lists exactly the encodings used, and
 * nothing is truncated. `dir: TB` transposes.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { parseDocument, validateDocument } from 'chiltepin-core';
import { renderErd } from '../blocks/erd.js';
import { renderDocument } from '../document.js';

const DATA = {
  entities: [
    {
      name: 'users',
      schema: 'auth',
      note: 'People who sign in',
      columns: [
        { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
        { name: 'email', type: 'citext', unique: true, nullable: false },
        { name: 'nick', type: 'text', nullable: true, index: true },
      ],
    },
    {
      name: 'orders',
      schema: 'shop',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', fk: true, ref: 'users.id' },
        { name: 'status', type: 'enum', enum: ['open', 'paid'] },
      ],
    },
    {
      name: 'order_items',
      schema: 'shop',
      columns: [
        { name: 'order_id', type: 'uuid', fk: true, pk: true },
        { name: 'product_id', type: 'uuid', fk: true, pk: true },
      ],
    },
    { name: 'products', schema: 'shop', columns: [{ name: 'id', type: 'uuid', pk: true }] },
    { name: 'order_totals', kind: 'view' as const, columns: [{ name: 'order_id' }, { name: 'total' }] },
    { name: 'stripe_customers', kind: 'external' as const },
  ],
  relations: [
    { from: 'users', to: 'orders', card: '1:N' as const, label: 'places' },
    { from: 'orders', to: 'order_items', card: '1:N' as const },
    { from: 'products', to: 'order_items', card: '1:N' as const },
    { from: 'orders', to: 'order_totals', card: '0..1' as const, identifying: false },
    { from: 'users', to: 'stripe_customers', card: '1:N' as const },
    { from: 'users', to: 'products', card: '1:N' as const, label: 'sells' },
  ],
  enums: [{ name: 'order_status', values: ['open', 'paid'] }],
};

describe('erd renderer', () => {
  const html = renderErd(DATA);
  const root = parse(html);

  it('draws every entity with its eyebrow kind chip and every column row', () => {
    expect(root.querySelectorAll('.er-head-text').length).toBe(6 + 1); // + the enum card
    const eyebrows = root.querySelectorAll('.er-eyebrow').map((n) => n.text);
    expect(eyebrows).toContain('AGGREGATE ROOT');
    expect(eyebrows).toContain('JOIN');
    expect(eyebrows).toContain('VIEW');
    expect(eyebrows).toContain('EXT');
    expect(eyebrows.filter((e) => e === 'ENUM')).toHaveLength(1);
    // Column rows carry data paths; nothing is truncated.
    expect(root.querySelectorAll('[data-bp^="entities."][data-bp*=".columns."]').length).toBe(3 + 3 + 2 + 1 + 2);
    expect(html).not.toContain('more');
  });

  it('renders the key markers as chips: # → U ? ⌘', () => {
    const keys = root.querySelectorAll('.er-key').map((n) => n.text);
    expect(keys).toContain('#');
    expect(keys).toContain('→');
    expect(keys).toContain('U');
    expect(keys).toContain('?');
    expect(keys).toContain('⌘');
    // The FK target and the default ride the type cluster; the enum values a sub-row.
    expect(html).toContain('uuid  → users.id');
    expect(html).toContain('uuid  = gen_random_uuid()');
    expect(html).toContain('open · paid');
  });

  it('routes every relation with letters at both ends; non-identifying dashed; label on a mask', () => {
    // The relation groups (each label twins with its route and sits outside).
    const rels = root.querySelectorAll('g[data-bl="relations"] > [data-bp^="relations."]');
    expect(rels.length).toBe(6);
    // A letter at each end; ends fanned out of one anchor share one letter.
    for (const r of rels) expect(r.querySelectorAll('.er-card').length).toBeGreaterThanOrEqual(1);
    const letters = root.querySelectorAll('.er-card').map((n) => n.text);
    expect(letters).toContain('1');
    expect(letters).toContain('N');
    expect(letters).toContain('0..1');
    expect(root.querySelectorAll('[data-bp^="relations."] path[stroke-dasharray]').length).toBe(1);
    expect(root.querySelector('.er-rel')?.text).toBe('PLACES');
  });

  it('draws schema panels from `schema` and the enum card in the side column', () => {
    const tabs = root.querySelectorAll('.er-panel-tab').map((n) => n.text);
    expect(tabs).toEqual(['AUTH', 'SHOP']);
    expect(root.querySelectorAll('.er-panel').length).toBe(2);
    expect(root.querySelector('[data-bp="enums.0"]')).toBeTruthy();
  });

  it('spends the accent on the aggregate root only, and the accent is a token', () => {
    const accent = root.querySelector('svg[role="img"]')?.querySelectorAll('rect[stroke="var(--accent)"]') ?? [];
    expect(accent.length).toBe(1);
    expect(accent[0]?.parentNode.getAttribute('data-bp')).toBe('entities.0');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('lists exactly the encodings used in the legend', () => {
    const labels = root.querySelectorAll('.lg-label').map((n) => n.text);
    expect(labels).toEqual([
      'primary key',
      'foreign key',
      'unique',
      'nullable',
      'indexed',
      'cardinality',
      'identifying',
      'non-identifying',
      'join table',
      'view',
      'enum',
      'external',
      'schema group',
      'aggregate root',
    ]);
  });

  it('a bare schema (no markers, no relations) has no legend and no chips it did not use', () => {
    const bare = renderErd({ entities: [{ name: 'a', columns: [{ name: 'x', type: 'int' }] }, { name: 'b' }] });
    expect(bare).not.toContain('diagram-legend');
    expect(bare).not.toContain('er-key');
  });

  it('dir: TB lays the layers out as rows (the root above its children)', () => {
    const tb = parse(renderErd({ ...DATA, dir: 'TB' }));
    const y = (path: string) => Number(tb.querySelector(`[data-bp="${path}"] rect`)?.getAttribute('y'));
    expect(y('entities.1')).toBeGreaterThan(y('entities.0')); // orders below users
    expect(y('entities.2')).toBeGreaterThan(y('entities.1')); // order_items below orders
  });

  it('a self-reference and a relation across three columns still route', () => {
    const html2 = renderErd({
      entities: [
        { name: 'categories', columns: [{ name: 'id', type: 'int', pk: true }, { name: 'parent_id', type: 'int', fk: true, ref: 'categories.id' }] },
        { name: 'products', columns: [{ name: 'id', type: 'int', pk: true }, { name: 'category_id', type: 'int', fk: true }] },
        { name: 'reviews', columns: [{ name: 'id', type: 'int', pk: true }, { name: 'product_id', type: 'int', fk: true }, { name: 'category_id', type: 'int', fk: true }] },
      ],
      relations: [
        { from: 'categories', to: 'categories', card: '1:N', label: 'parent' },
        { from: 'categories', to: 'products', card: '1:N' },
        { from: 'products', to: 'reviews', card: '1:N' },
        { from: 'categories', to: 'reviews', card: '1:N' },
      ],
    });
    expect(parse(html2).querySelectorAll('[data-bp^="relations."] path').length).toBe(4);
  });

  it('the old shape (pre-overhaul docs) still renders with PK/FK markers', () => {
    const md =
      '```erd\nentities:\n  - name: docs\n    columns:\n      - { name: slug, type: text, pk: true }\n  - name: blocks\n    columns:\n      - { name: id, type: text, pk: true }\n      - { name: doc_slug, type: text, fk: true }\nrelations:\n  - docs ||--o{ blocks: contains\n```\n';
    const doc = parseDocument(md, 'old');
    expect(validateDocument(doc, 'old.md')).toEqual([]);
    const out = renderDocument(doc);
    expect(out).toContain('er-key pk');
    expect(out).toContain('er-key fk');
    expect(out).toContain('CONTAINS');
  });
});
