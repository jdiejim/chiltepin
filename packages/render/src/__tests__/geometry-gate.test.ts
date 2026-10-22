/**
 * The geometry gate: every catalog example of a grid diagram type, and every
 * grid diagram in `docs/examples/*.md`, lays out with no edge forced through
 * a node and no edge label covering a node — the two failures a reader cannot
 * work around. (Crossings and label fallbacks are reported as `W_GEOMETRY`
 * warnings, not gated here.)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_TEMPLATES, parseDocument, type BlockType } from 'chiltepin-core';
import { GEOMETRY_TYPES, geometryReport, type GeometryReport } from '../geometryReport.js';
import { htmlRenderers } from '../registry.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/examples');

/** Lays out one block through the public report. */
const report = (type: BlockType, data: unknown): GeometryReport =>
  (geometryReport as (t: BlockType, d: unknown) => GeometryReport)(type, data);

/** The typed grid-diagram segments of a markdown source. */
function gridBlocks(
  source: string,
  slug: string,
): Array<{ type: BlockType; data: unknown; line: number }> {
  const doc = parseDocument(source, slug);
  return doc.segments.flatMap((s) =>
    s.kind !== 'markdown' &&
    GEOMETRY_TYPES.includes(s.kind) &&
    s.data !== undefined &&
    s.parseError === undefined
      ? [{ type: s.kind, data: s.data, line: s.line }]
      : [],
  );
}

function expectClean(where: string, r: GeometryReport): void {
  const through = r.issues.filter((i) => i.kind === 'edge-through-node').map((i) => i.message);
  expect(through, `${where}: edges through nodes`).toEqual([]);
  expect(r.throughNode, `${where}: edges through nodes`).toBe(0);
  expect(r.labelOverlaps, `${where}: labels over nodes`).toBe(0);
}

describe('geometry gate: catalog examples', () => {
  for (const type of GEOMETRY_TYPES) {
    it(`${type}: no edge through a node, no label over a node`, () => {
      const blocks = gridBlocks(BLOCK_TEMPLATES[type], `catalog/${type}`);
      expect(blocks.length).toBe(1);
      for (const b of blocks) expectClean(`catalog ${type}`, report(b.type, b.data));
    });
  }
});

describe('geometry gate: docs/examples', () => {
  const files = readdirSync(EXAMPLES).filter((f) => f.endsWith('.md'));
  it('finds the example documents', () => {
    expect(files.length).toBeGreaterThan(10);
  });
  for (const file of files) {
    const blocks = gridBlocks(readFileSync(resolve(EXAMPLES, file), 'utf8'), `examples/${file}`);
    if (blocks.length === 0) continue;
    it(`${file}: no edge through a node, no label over a node`, () => {
      for (const b of blocks) expectClean(`${file}:${b.line} ${b.type}`, report(b.type, b.data));
    });
  }
});

describe('routing output', () => {
  const renderers = htmlRenderers as unknown as Record<string, (d: unknown) => string>;
  const files = readdirSync(EXAMPLES).filter((f) => f.endsWith('.md'));
  it('is byte-identical across renders and every edge path has whole coordinates', () => {
    for (const file of files) {
      for (const b of gridBlocks(
        readFileSync(resolve(EXAMPLES, file), 'utf8'),
        `examples/${file}`,
      )) {
        const render = renderers[b.type];
        if (render === undefined) continue;
        const once = render(b.data);
        expect(render(b.data), `${file}:${b.line}`).toBe(once);
        for (const m of once.matchAll(
          /<path d="([^"]+)"[^>]*data-bp="(?:edges|transitions|links|deps)\.\d+"/g,
        )) {
          expect(m[1], `${file}:${b.line}`).not.toMatch(/\d\.\d/);
        }
      }
    }
  });
});

describe('geometry report', () => {
  it('names two nodes that share a cell and says how to fix it in data terms', () => {
    const r = report('flow', {
      nodes: [
        { id: 'a', label: 'Alpha', col: 1, row: 1 },
        { id: 'b', label: 'Beta', col: 1, row: 1 },
      ],
      edges: [],
    });
    const issue = r.issues.find((i) => i.kind === 'cell-overlap');
    expect(issue?.message).toContain('"Alpha" and "Beta"');
    expect(issue?.hint).toMatch(/Move "Beta" to a free cell/);
    expect(issue?.hint).not.toMatch(/px|\d+,\s*\d+/);
    expect(r.sharedCells).toBe(1);
  });

  it('routes into a target ringed by eight nodes through the gaps, not through a node', () => {
    // A walled-in target: every way in passes another node.
    const nodes = [
      { id: 'src', label: 'Source', col: 1, row: 2 },
      { id: 'n', label: 'North', col: 3, row: 1 },
      { id: 's', label: 'South', col: 3, row: 3 },
      { id: 'w', label: 'West', col: 2, row: 2 },
      { id: 'e', label: 'East', col: 4, row: 2 },
      { id: 'nw', label: 'NW', col: 2, row: 1 },
      { id: 'ne', label: 'NE', col: 4, row: 1 },
      { id: 'sw', label: 'SW', col: 2, row: 3 },
      { id: 'se', label: 'SE', col: 4, row: 3 },
      { id: 't', label: 'Target', col: 3, row: 2 },
    ];
    const r = report('block', {
      nodes: nodes.map((n) => ({ id: n.id, name: n.label, col: n.col, row: n.row })),
      edges: [{ from: 'src', to: 't' }],
    });
    // The router finds the gap between the cells instead of crossing a node.
    expect(r.throughNode).toBe(0);
  });

  it('is empty for a block type without grid geometry', () => {
    expect(report('table', { columns: ['a'], rows: [['1']] }).issues).toEqual([]);
  });

  it('counts crossings and reports a tangle past the threshold', () => {
    // Every left node linked to every right node, in reverse order.
    const left = ['a', 'b', 'c', 'd', 'e'];
    const right = ['v', 'w', 'x', 'y', 'z'];
    const r = report('flow', {
      nodes: [
        ...left.map((id, i) => ({ id, label: id, col: 1, row: i + 1 })),
        ...right.map((id, i) => ({ id, label: id, col: 3, row: i + 1 })),
      ],
      edges: left.flatMap((a) => right.map((b) => ({ from: a, to: b }))),
    });
    expect(r.crossings).toBeGreaterThan(0);
    const tangle = r.issues.find((i) => i.kind === 'crossings');
    expect(tangle?.hint).toMatch(/neighbouring cells|auto-layout/);
  });
});
