/**
 * `block` request steps and named paths: the edge fields `step` (a circled
 * numeral, 1–99) and `path` (a request path name), and the terse
 * `3. from -> to: label` spelling that sets `step` on a `block` edge only.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { blockGraphSchema } from '../blocks/schemas.js';
import { contractTerseItems, terseSpelling } from '../blocks/normalize.js';
import { blockContract } from '../blocks/contract.js';

function edgesOf(md: string): unknown {
  const seg = parseDocument(md, 't').segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
  return (seg.data as { edges?: unknown }).edges;
}

const NODES = 'nodes:\n  - { id: api, name: orders-api }\n  - { id: cache, kind: cache, name: order cache }\n  - { id: q, kind: queue, name: order-events }\n';

describe('block edge `step` and `path` (schema)', () => {
  const edge = (extra: Record<string, unknown>): boolean =>
    blockGraphSchema.safeParse({
      nodes: [
        { id: 'a', name: 'orders-api' },
        { id: 'b', name: 'orders-db' },
      ],
      edges: [{ from: 'a', to: 'b', ...extra }],
    }).success;

  it('takes a positive whole step from 1 to 99', () => {
    expect(edge({ step: 1 })).toBe(true);
    expect(edge({ step: 12 })).toBe(true);
    expect(edge({ step: 99 })).toBe(true);
  });

  it('rejects a step of 0, a negative, a fraction, past 99, or a string', () => {
    expect(edge({ step: 0 })).toBe(false);
    expect(edge({ step: -2 })).toBe(false);
    expect(edge({ step: 1.5 })).toBe(false);
    expect(edge({ step: 100 })).toBe(false);
    expect(edge({ step: 'three' })).toBe(false);
  });

  it('takes a path name; an empty one is an error', () => {
    expect(edge({ path: 'read' })).toBe(true);
    expect(edge({ step: 2, path: 'write path' })).toBe(true);
    expect(edge({ path: '' })).toBe(false);
  });

  it('check names the field and the rule for a bad step', () => {
    const diags = validateDocument(
      parseDocument(`\`\`\`block\n${NODES}edges:\n  - { from: api, to: cache, step: 0 }\n\`\`\`\n`, 't'),
      't.md',
    );
    expect(diags.some((d) => d.level === 'error' && /steps count from 1/.test(d.message))).toBe(true);
  });

  it('`chiltepin block block` lists both fields with their notes', () => {
    const c = blockContract('block');
    const notes = c.notes.map((n) => `${n.fields}: ${n.note}`).join('\n');
    expect(notes).toMatch(/edges\[\]\.step: the request step/);
    expect(notes).toMatch(/edges\[\]\.path: names the request path/);
    expect(notes).toMatch(/cache a memory card/);
  });
});

describe('block edge terse step form `3. a -> b: label`', () => {
  it('expands the quoted and the unquoted form, with every arrow', () => {
    const edges = edgesOf(
      `\`\`\`block\n${NODES}edges:\n  - "1. api -> cache: read order"\n  - 2. api --> q: publish\n  - 3. api -x-> cache\n  - api -> q: plain\n\`\`\`\n`,
    );
    expect(edges).toEqual([
      { from: 'api', to: 'cache', label: 'read order', step: 1 },
      { from: 'api', to: 'q', label: 'publish', kind: 'dashed', step: 2 },
      { from: 'api', to: 'cache', kind: 'error', step: 3 },
      { from: 'api', to: 'q', label: 'plain' },
    ]);
  });

  it('a stepped terse edge validates clean', () => {
    const diags = validateDocument(
      parseDocument(`\`\`\`block\n${NODES}edges:\n  - 1. api -> cache: read order\n  - 2. api --> q: publish\n\`\`\`\n`, 't'),
      't.md',
    );
    expect(diags.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('keeps the old readings: a node named `3.` and a label that starts with a number', () => {
    const edges = edgesOf(
      '```block\nnodes:\n  - { id: "3.", name: stage three }\n  - { id: api, name: orders-api }\nedges:\n  - "3. -> api"\n  - "api -> 3.: 2. retry"\n```\n',
    );
    expect(edges).toEqual([
      { from: '3.', to: 'api' },
      { from: 'api', to: '3.', label: '2. retry' },
    ]);
  });

  it('is a block grammar only: a flow edge with a step prefix stays a string', () => {
    const seg = parseDocument('```flow\nnodes:\n  - { id: a, label: Receive order }\n  - { id: b, label: Ship order }\nedges:\n  - "1. a -> b"\n```\n', 't').segments[0];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
    expect((seg.data as { edges: unknown[] }).edges[0]).toBe('1. a -> b');
  });

  it('contracts a stepped edge back to the terse line, and keeps a path edge as an object', () => {
    const items = contractTerseItems('block', 'edges', [
      { from: 'api', to: 'cache', label: 'read order', step: 4 },
      { from: 'api', to: 'q', kind: 'dashed', step: 5 },
      { from: 'api', to: 'cache', label: 'read order', step: 6, path: 'read' },
      { from: 'api', to: 'q', label: 'plain' },
    ]);
    expect(items).toEqual([
      '4. api -> cache: read order',
      '5. api --> q',
      { from: 'api', to: 'cache', label: 'read order', step: 6, path: 'read' },
      'api -> q: plain',
    ]);
    // Written unquoted, the line is the single-pair mapping the sugar reads back.
    expect(terseSpelling('block', ['edges'], '4. api -> cache: read order')).toEqual({ key: '4. api -> cache', value: 'read order' });
  });
});
