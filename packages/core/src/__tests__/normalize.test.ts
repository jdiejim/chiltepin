/**
 * YAML sugar + scalar coercion (`blocks/normalize.ts`), wired into
 * `parseDocument`: terse strings expand to canonical objects, unquoted
 * single-pair mappings are rescued when the key carries a grammar signature,
 * non-matching strings pass through to a schema error, and number/boolean
 * scalars become strings at (and only at) bare-string schema positions.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { normalizeBlockData } from '../blocks/normalize.js';
import { stringOnlyAt } from '../blocks/schema-walk.js';

function dataOf(md: string): Record<string, unknown> {
  const seg = parseDocument(md, 't').segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
  return seg.data as Record<string, unknown>;
}

function diagsFor(md: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument(md, 't'), 't.md');
}

describe('sequence.messages sugar', () => {
  it('expands the quoted string form with all three arrows', () => {
    const d = dataOf(
      '```sequence\nmessages:\n  - "Client -> Server: request"\n  - "Server --> Client: response"\n  - "Server -x-> Client: timeout"\n  - "Client -> Server"\n```\n',
    );
    expect(d.messages).toEqual([
      { from: 'Client', to: 'Server', label: 'request' },
      { from: 'Server', to: 'Client', label: 'response', kind: 'response' },
      { from: 'Server', to: 'Client', label: 'timeout', kind: 'error' },
      { from: 'Client', to: 'Server' },
    ]);
  });

  it('rescues the unquoted form (YAML parses it as a single-pair mapping)', () => {
    const d = dataOf('```sequence\nmessages:\n  - Client -> Server: request\n```\n');
    expect(d.messages).toEqual([{ from: 'Client', to: 'Server', label: 'request' }]);
  });

  it('splits on the FIRST colon — the label keeps later colons', () => {
    const d = dataOf('```sequence\nmessages:\n  - "a -> b: retry: 3x max"\n```\n');
    expect(d.messages).toEqual([{ from: 'a', to: 'b', label: 'retry: 3x max' }]);
  });

  it('a label may contain an arrow', () => {
    const d = dataOf('```sequence\nmessages:\n  - "a -> b: go -> stop"\n```\n');
    expect(d.messages).toEqual([{ from: 'a', to: 'b', label: 'go -> stop' }]);
  });

  it('object items pass through untouched (the escape hatch)', () => {
    const d = dataOf(
      '```sequence\nmessages:\n  - { from: a, to: b, kind: async, summary: long }\n```\n',
    );
    expect(d.messages).toEqual([{ from: 'a', to: 'b', kind: 'async', summary: 'long' }]);
  });

  it('a single-pair object with a known field name is NOT mangled', () => {
    // `{ label: hi }` has no arrow in the key — passes through, then errors
    // on the missing from/to like any incomplete object form.
    const d = dataOf('```sequence\nmessages:\n  - { label: hi }\n```\n');
    expect(d.messages).toEqual([{ label: 'hi' }]);
    expect(diagsFor('```sequence\nmessages:\n  - { label: hi }\n```\n').length).toBeGreaterThan(0);
  });

  it('a non-matching string falls through to a schema error', () => {
    const diags = diagsFor('```sequence\nmessages:\n  - "just some prose"\n```\n');
    expect(diags.some((d) => d.code === 'E_SCHEMA')).toBe(true);
  });

  it('never parses `a-->b` as from `a-` (longest arrow wins)', () => {
    const d = dataOf('```sequence\nmessages:\n  - "a-->b"\n```\n');
    expect(d.messages).toEqual([{ from: 'a', to: 'b', kind: 'response' }]);
  });
});

describe('edge sugar (flow / graph / block — covers dag and the block presets)', () => {
  it('flow: plain and error arrows expand; validates clean', () => {
    const md =
      '```flow\nnodes:\n  - { id: a, col: 1, row: 1, label: A }\n  - { id: b, col: 2, row: 1, label: B }\nedges:\n  - a -> b: ok\n  - "a -x-> b: fail"\n```\n';
    expect(dataOf(md).edges).toEqual([
      { from: 'a', to: 'b', label: 'ok' },
      { from: 'a', to: 'b', label: 'fail', kind: 'error' },
    ]);
    expect(diagsFor(md)).toEqual([]);
  });

  it('flow: `-->` expands to a valid dashed edge (the terse grammar and the schema agree)', () => {
    const md =
      '```flow\nnodes:\n  - { id: a, col: 1, row: 1, label: A }\n  - { id: b, col: 2, row: 1, label: B }\nedges:\n  - "a --> b"\n```\n';
    expect(dataOf(md).edges).toEqual([{ from: 'a', to: 'b', kind: 'dashed' }]);
    expect(diagsFor(md)).toEqual([]);
  });

  it('block: `-->` expands to a valid dashed edge', () => {
    const md =
      '```block\nnodes:\n  - { id: q, col: 1, row: 1, name: Q }\n  - { id: w, col: 2, row: 1, name: W }\nedges:\n  - q --> w\n```\n';
    expect(dataOf(md).edges).toEqual([{ from: 'q', to: 'w', kind: 'dashed' }]);
    expect(diagsFor(md)).toEqual([]);
  });

  it('graph: plain arrows expand; graph edges have no kind, so `-x->` errors', () => {
    const ok =
      '```graph\nnodes:\n  - { id: a, col: 1, row: 1, label: A }\n  - { id: b, col: 2, row: 1, label: B }\nedges:\n  - a -> b: uses\n```\n';
    expect(dataOf(ok).edges).toEqual([{ from: 'a', to: 'b', label: 'uses' }]);
    expect(diagsFor(ok)).toEqual([]);
    const bad =
      '```graph\nnodes:\n  - { id: a, col: 1, row: 1, label: A }\nedges:\n  - "a -x-> b"\n```\n';
    expect(diagsFor(bad).some((d) => d.code === 'E_SCHEMA')).toBe(true);
  });

  it('a whole line quoted for YAML keeps no quote marks in its label', () => {
    const d = dataOf(
      "```flow\nnodes:\n  - { id: ok, kind: decision, label: Valid? }\n  - a: Go\n  - b: Stop\nedges:\n  - 'ok -> a: \"yes\"'\n  - \"ok -x-> b: 'no'\"\n  - 'a -> b: \"half'\n```\n",
    );
    expect(d.edges).toEqual([
      { from: 'ok', to: 'a', label: 'yes' },
      { from: 'ok', to: 'b', label: 'no', kind: 'error' },
      { from: 'a', to: 'b', label: '"half' },
    ]);
  });

  it('node ids containing dashes still parse', () => {
    const d = dataOf('```flow\nedges:\n  - "order-item -> order-total"\n```\n');
    expect(d.edges).toEqual([{ from: 'order-item', to: 'order-total' }]);
  });
});

describe('erd.relations sugar', () => {
  it('expands every crow’s-foot operator to its cardinality', () => {
    const d = dataOf(
      '```erd\nrelations:\n  - "a ||--|| b: one"\n  - "a ||--o{ b: many"\n  - "a }o--|| b: back"\n  - "a }o--o{ b: nm"\n  - "a -> b: plain"\n```\n',
    );
    expect(d.relations).toEqual([
      { from: 'a', to: 'b', label: 'one', card: '1:1' },
      { from: 'a', to: 'b', label: 'many', card: '1:N' },
      { from: 'a', to: 'b', label: 'back', card: 'N:1' },
      { from: 'a', to: 'b', label: 'nm', card: 'N:M' },
      { from: 'a', to: 'b', label: 'plain' },
    ]);
  });

  it('rescues the unquoted form and validates clean', () => {
    const md =
      '```erd\nentities:\n  - { name: users }\n  - { name: orders }\nrelations:\n  - users ||--o{ orders: places\n```\n';
    expect(dataOf(md).relations).toEqual([
      { from: 'users', to: 'orders', label: 'places', card: '1:N' },
    ]);
    expect(diagsFor(md)).toEqual([]);
  });

  it('object relations pass through', () => {
    const d = dataOf('```erd\nrelations:\n  - { from: a, to: b, card: "N:M" }\n```\n');
    expect(d.relations).toEqual([{ from: 'a', to: 'b', card: 'N:M' }]);
  });
});

describe('timeline.items sugar', () => {
  it('expands 1 / 2 / 3 ·-separated parts, with an optional status bracket', () => {
    const d = dataOf(
      '```timeline\nitems:\n  - "Just a label"\n  - "2026-07 · Ship"\n  - "[done] 2026-07 · Ship · Everything shipped"\n  - "[current] Now"\n```\n',
    );
    expect(d.items).toEqual([
      { label: 'Just a label' },
      { date: '2026-07', label: 'Ship' },
      { date: '2026-07', label: 'Ship', desc: 'Everything shipped', status: 'done' },
      { label: 'Now', status: 'current' },
    ]);
  });

  it('extra · parts join into desc', () => {
    const d = dataOf('```timeline\nitems:\n  - "a · b · c · d"\n```\n');
    expect(d.items).toEqual([{ date: 'a', label: 'b', desc: 'c · d' }]);
  });

  it('an unknown bracket status expands and then fails the enum — a teaching error', () => {
    const diags = diagsFor('```timeline\nitems:\n  - "[wip] Now · Thing"\n```\n');
    expect(diags.some((d) => d.code === 'E_SCHEMA' && d.message.includes('wip'))).toBe(true);
  });

  it('rescues the unquoted form when the label carries a colon', () => {
    const d = dataOf('```timeline\nitems:\n  - 2026-07 · Launch: EU\n```\n');
    expect(d.items).toEqual([{ date: '2026-07', label: 'Launch: EU' }]);
  });

  it('object items pass through, including single-pair objects with known keys', () => {
    const d = dataOf('```timeline\nitems:\n  - { label: Phase 1 }\n```\n');
    expect(d.items).toEqual([{ label: 'Phase 1' }]);
  });
});

describe('scalar coercion', () => {
  it('stringOnlyAt is true only for bare string positions', () => {
    expect(stringOnlyAt('block', ['nodes', 0, 'tech'])).toBe(true);
    expect(stringOnlyAt('meta', ['tag'])).toBe(true);
    // Unions with number stay protected.
    expect(stringOnlyAt('table', ['rows', 0, 0])).toBe(false);
    expect(stringOnlyAt('stats', ['stats', 0, 'value'])).toBe(false);
    expect(stringOnlyAt('endpoint', ['responses', 0, 'status'])).toBe(false);
    expect(stringOnlyAt('dfd', ['nodes', 0, 'num'])).toBe(false);
    // Numbers, enums, and unknown paths are not string-only.
    expect(stringOnlyAt('chart', ['budget'])).toBe(false);
    expect(stringOnlyAt('callout', ['tone'])).toBe(false);
    expect(stringOnlyAt('callout', ['nope'])).toBe(false);
  });

  it('coerces numbers and booleans at string-only positions (tech: 16 just works)', () => {
    const md =
      '```block\nnodes:\n  - { id: pg, col: 1, row: 1, name: Postgres, tech: 16 }\n```\n';
    const d = dataOf(md);
    expect((d.nodes as Array<Record<string, unknown>>)[0]?.tech).toBe('16');
    expect(diagsFor(md)).toEqual([]);
    const b = normalizeBlockData('callout', { title: true }) as Record<string, unknown>;
    expect(b.title).toBe('true');
  });

  it('coerces array walkthrough values (bare string schema)', () => {
    const md = '```array\nitems:\n  - { value: 3 }\n  - { value: 7, tone: active }\n```\n';
    const d = dataOf(md);
    expect(d.items).toEqual([{ value: '3' }, { value: '7', tone: 'active' }]);
    expect(diagsFor(md)).toEqual([]);
  });

  it('does NOT coerce union positions — table cells, stats values, statuses keep numbers', () => {
    const table = normalizeBlockData('table', { rows: [['a', 42]] }) as Record<string, unknown>;
    expect(table.rows).toEqual([['a', 42]]);
    const stats = normalizeBlockData('stats', {
      stats: [{ value: 99.95, label: 'uptime' }],
    }) as Record<string, unknown>;
    expect((stats.stats as Array<Record<string, unknown>>)[0]?.value).toBe(99.95);
    const endpoint = normalizeBlockData('endpoint', {
      method: 'GET',
      path: '/x',
      responses: [{ status: 200 }],
    }) as Record<string, unknown>;
    expect((endpoint.responses as Array<Record<string, unknown>>)[0]?.status).toBe(200);
    const st = normalizeBlockData('statustable', {
      rows: [{ cells: ['Task', 3], status: 'done' }],
    }) as Record<string, unknown>;
    expect((st.rows as Array<Record<string, unknown>>)[0]?.cells).toEqual(['Task', 3]);
  });

  it('does NOT coerce numbers at number positions or unknown fields', () => {
    const chart = normalizeBlockData('chart', {
      budget: 250,
      unknown: 1,
      items: [{ label: 'a', value: 2 }],
    }) as Record<string, unknown>;
    expect(chart.budget).toBe(250);
    expect(chart.unknown).toBe(1);
    expect((chart.items as Array<Record<string, unknown>>)[0]?.value).toBe(2);
  });

  it('passes non-object bodies through untouched', () => {
    expect(normalizeBlockData('callout', null)).toBeNull();
    expect(normalizeBlockData('callout', 'text')).toBe('text');
    expect(normalizeBlockData('callout', [1, 2])).toEqual([1, 2]);
  });
});
