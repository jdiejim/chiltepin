/**
 * Drag-to-move rules: the drag-intent classifier, per-kind target mapping,
 * axis/insertion math, reorder computations (including the compound table-
 * column and cross-column kanban moves), grid snapping, and the quick-mode
 * materialization op builder.
 */

import { describe, expect, it } from 'vitest';
import {
  applyReorder,
  blockSupportsDrag,
  cellAtPoint,
  cellBox,
  centersAlong,
  dominantAxis,
  dragTargetFor,
  gapPosition,
  gridMoveSets,
  insertionIndex,
  isDragGesture,
  kanbanCardMoveSets,
  permutationFor,
  ringCenter,
  ringGap,
  ringGapPoint,
  tableColumnReorderSets,
  type Box,
  type GridGeom,
} from './drag.js';
import { specFor } from './connect.js';
import { classifyPart, deletablePathFor } from './partSelect.js';

describe('drag-intent classifier', () => {
  it('stays a click at or below the 6px threshold', () => {
    expect(isDragGesture(0, 0)).toBe(false);
    expect(isDragGesture(6, 0)).toBe(false);
    expect(isDragGesture(0, -6)).toBe(false);
    expect(isDragGesture(4, 4)).toBe(false); // hypot ≈ 5.66
  });

  it('becomes a drag past the threshold, in any direction', () => {
    expect(isDragGesture(7, 0)).toBe(true);
    expect(isDragGesture(0, 7)).toBe(true);
    expect(isDragGesture(-5, -4)).toBe(true); // hypot ≈ 6.4
    expect(isDragGesture(5, 4)).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(isDragGesture(8, 0, 10)).toBe(false);
    expect(isDragGesture(11, 0, 10)).toBe(true);
  });
});

describe('dragTargetFor — grabbed path → draggable thing', () => {
  it('sequence: actor headers drag, messages do not', () => {
    expect(dragTargetFor('sequence', 'actors.2')).toEqual({
      mode: 'reorder',
      listPath: 'actors',
      index: 2,
    });
    expect(dragTargetFor('sequence', 'messages.0')).toBeNull();
    expect(dragTargetFor('sequence', 'actors.2.name')).toBeNull(); // not tagged anyway
  });

  it('table: header cells drag columns; rows AND their cells drag the row', () => {
    expect(dragTargetFor('table', 'columns.1')).toEqual({ mode: 'table-cols', index: 1 });
    expect(dragTargetFor('table', 'rows.3')).toEqual({ mode: 'reorder', listPath: 'rows', index: 3 });
    expect(dragTargetFor('table', 'rows.3.2')).toEqual({
      mode: 'reorder',
      listPath: 'rows',
      index: 3,
    });
    expect(dragTargetFor('table', 'note')).toBeNull();
  });

  it('kanban: cards, column labels, and column bodies', () => {
    expect(dragTargetFor('kanban', 'columns.1.cards.0')).toEqual({
      mode: 'kanban-card',
      col: 1,
      index: 0,
    });
    expect(dragTargetFor('kanban', 'columns.2')).toEqual({
      mode: 'reorder',
      listPath: 'columns',
      index: 2,
    });
    expect(dragTargetFor('kanban', 'columns.2.label')).toEqual({
      mode: 'reorder',
      listPath: 'columns',
      index: 2,
    });
  });

  it('timeline: items and their sub-fields drag the item', () => {
    expect(dragTargetFor('timeline', 'items.4')).toEqual({
      mode: 'reorder',
      listPath: 'items',
      index: 4,
    });
    expect(dragTargetFor('timeline', 'items.4.desc')).toEqual({
      mode: 'reorder',
      listPath: 'items',
      index: 4,
    });
  });

  it('block-graph: nodes and groups drag; edges do not', () => {
    // Alias fences (infra/event/ddd/network) parse to canonical `block` —
    // only the canonical kind ever reaches the drag layer.
    expect(dragTargetFor('block', 'nodes.1')).toEqual({ mode: 'grid-node', listPath: 'nodes', index: 1 });
    expect(dragTargetFor('block', 'edges.0')).toBeNull();
    expect(dragTargetFor('block', 'groups.0')).toEqual({ mode: 'grid-group', index: 0 });
    expect(dragTargetFor('infra', 'nodes.1')).toBeNull();
  });

  it('grid nodes drag on EVERY grid kind, through its own node-list field', () => {
    for (const k of ['flow', 'dfd', 'c4', 'block', 'graph']) {
      expect(dragTargetFor(k, 'nodes.2'), k).toEqual({ mode: 'grid-node', listPath: 'nodes', index: 2 });
    }
    expect(dragTargetFor('state', 'states.1')).toEqual({ mode: 'grid-node', listPath: 'states', index: 1 });
    expect(dragTargetFor('state', 'nodes.1')).toBeNull(); // not its field
    expect(dragTargetFor('swimlane', 'steps.0')).toEqual({ mode: 'grid-node', listPath: 'steps', index: 0 });
    expect(dragTargetFor('swimlane', 'lanes.0')).toBeNull();
    expect(dragTargetFor('flow', 'nodes.2.label')).toBeNull(); // whole node only
  });

  it('cycle stages drag as ring reorders (pill group or its label)', () => {
    expect(dragTargetFor('cycle', 'steps.3')).toEqual({ mode: 'ring', listPath: 'steps', index: 3 });
    expect(dragTargetFor('cycle', 'steps.3.label')).toEqual({ mode: 'ring', listPath: 'steps', index: 3 });
    expect(dragTargetFor('cycle', 'steps.3.desc')).toBeNull();
    expect(dragTargetFor('cycle', 'center')).toBeNull();
  });

  it('group wrappers drag on every groups-capable grid kind (whole item only)', () => {
    for (const k of ['flow', 'dfd', 'state', 'c4', 'block']) {
      expect(dragTargetFor(k, 'groups.2'), k).toEqual({ mode: 'grid-group', index: 2 });
    }
    expect(dragTargetFor('flow', 'groups.2.label')).toBeNull();
    expect(dragTargetFor('sequence', 'groups.0')).toBeNull();
    expect(dragTargetFor('graph', 'groups.0')).toBeNull(); // per-node `group` ≠ ranges
    expect(dragTargetFor('swimlane', 'groups.0')).toBeNull();
  });

  it('unknown kinds and unmapped paths are not draggable', () => {
    expect(dragTargetFor('erd', 'entities.0')).toBeNull();
    expect(dragTargetFor('quadrant', 'items.0')).toBeNull();
  });
});

describe('blockSupportsDrag', () => {
  it('covers the order-based, ring, and grid kinds', () => {
    const kinds = [
      'sequence', 'table', 'kanban', 'timeline', 'cycle',
      'block', 'flow', 'dfd', 'state', 'c4', 'graph', 'swimlane',
    ];
    for (const k of kinds) expect(blockSupportsDrag(k), k).toBe(true);
    expect(blockSupportsDrag('callout')).toBe(false);
    expect(blockSupportsDrag('erd')).toBe(false);
  });

  it('a block-graph in LAYERED mode has no draggable grid', () => {
    expect(blockSupportsDrag('block', { layers: [{ label: 'Edge' }] })).toBe(false);
    expect(blockSupportsDrag('block', { nodes: [] })).toBe(true);
  });
});

const box = (left: number, top: number, width = 10, height = 10): Box => ({
  left,
  top,
  width,
  height,
});

describe('axis + insertion math', () => {
  it('dominantAxis picks the larger spread of centers', () => {
    expect(dominantAxis([box(0, 0), box(100, 2), box(200, 4)])).toBe('x');
    expect(dominantAxis([box(0, 0), box(2, 60), box(4, 120)])).toBe('y');
    expect(dominantAxis([])).toBe('y');
  });

  it('insertionIndex counts centers before the pointer', () => {
    const centers = centersAlong([box(0, 0, 20), box(30, 0, 20), box(60, 0, 20)], 'x'); // 10, 40, 70
    expect(insertionIndex(centers, 5)).toBe(0);
    expect(insertionIndex(centers, 25)).toBe(1);
    expect(insertionIndex(centers, 55)).toBe(2);
    expect(insertionIndex(centers, 99)).toBe(3);
  });

  it('gapPosition sits mid-seam, or just outside the ends', () => {
    const boxes = [box(0, 0, 20), box(30, 0, 20)];
    expect(gapPosition(boxes, 'x', 0)).toBe(-3);
    expect(gapPosition(boxes, 'x', 1)).toBe(25); // between 20 and 30
    expect(gapPosition(boxes, 'x', 2)).toBe(53);
  });
});

describe('applyReorder', () => {
  const arr = ['a', 'b', 'c', 'd'];

  it('moves an item into a gap (insert-before semantics)', () => {
    expect(applyReorder(arr, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(applyReorder(arr, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(applyReorder(arr, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns null for no-op gaps and out-of-range moves', () => {
    expect(applyReorder(arr, 1, 1)).toBeNull();
    expect(applyReorder(arr, 1, 2)).toBeNull();
    expect(applyReorder(arr, -1, 0)).toBeNull();
    expect(applyReorder(arr, 4, 0)).toBeNull();
    expect(applyReorder(arr, 0, 5)).toBeNull();
  });

  it('permutationFor mirrors it on indices', () => {
    expect(permutationFor(3, 2, 0)).toEqual([2, 0, 1]);
    expect(permutationFor(3, 0, 1)).toBeNull();
  });
});

describe('tableColumnReorderSets — compound column reorder', () => {
  const data = {
    columns: ['Name', 'Role', 'Team'],
    rows: [
      ['Ada', 'Eng', 'Core'],
      ['Grace', 'PM', 'Growth'],
    ],
  };

  it('reorders columns AND every row consistently', () => {
    const sets = tableColumnReorderSets(data, 2, 0);
    expect(sets).not.toBeNull();
    expect(sets).toEqual([
      { path: ['columns'], value: ['Team', 'Name', 'Role'] },
      { path: ['rows', 0], value: ['Core', 'Ada', 'Eng'] },
      { path: ['rows', 1], value: ['Growth', 'Grace', 'PM'] },
    ]);
  });

  it('pads short rows and keeps long-row tails in place', () => {
    const ragged = {
      columns: ['A', 'B', 'C'],
      rows: [
        ['1', '2'], // short — pads a '' for column C
        ['1', '2', '3', 'extra'], // long — 'extra' stays a tail cell
      ],
    };
    const sets = tableColumnReorderSets(ragged, 0, 3);
    expect(sets?.[0]).toEqual({ path: ['columns'], value: ['B', 'C', 'A'] });
    expect(sets?.[1]).toEqual({ path: ['rows', 0], value: ['2', '', '1'] });
    expect(sets?.[2]).toEqual({ path: ['rows', 1], value: ['2', '3', '1', 'extra'] });
  });

  it('moves the foot (totals) row with the columns and leaves a group row alone', () => {
    const grouped = {
      columns: ['A', 'B'],
      rows: [[{ v: 'Section', group: true }], ['1', '2']],
      foot: ['Total', 3],
    };
    expect(tableColumnReorderSets(grouped, 1, 0)).toEqual([
      { path: ['columns'], value: ['B', 'A'] },
      { path: ['rows', 1], value: ['2', '1'] },
      { path: ['foot'], value: [3, 'Total'] },
    ]);
  });

  it('returns null for no-op moves and missing columns', () => {
    expect(tableColumnReorderSets(data, 1, 1)).toBeNull();
    expect(tableColumnReorderSets(data, 1, 2)).toBeNull();
    expect(tableColumnReorderSets({ rows: [] }, 0, 1)).toBeNull();
  });
});

describe('kanbanCardMoveSets', () => {
  const data = {
    columns: [
      { label: 'Todo', cards: [{ title: 'a' }, { title: 'b' }] },
      { label: 'Doing', cards: [{ title: 'c' }] },
      { label: 'Done' }, // no cards key at all
    ],
  };

  it('reorders within one column as a single set', () => {
    const sets = kanbanCardMoveSets(data, 0, 0, 0, 2);
    expect(sets).toEqual([
      { path: ['columns', 0, 'cards'], value: [{ title: 'b' }, { title: 'a' }] },
    ]);
    expect(kanbanCardMoveSets(data, 0, 0, 0, 1)).toBeNull(); // no-op
  });

  it('moves across columns: remove + insert, two sets', () => {
    const sets = kanbanCardMoveSets(data, 0, 1, 1, 0);
    expect(sets).toEqual([
      { path: ['columns', 0, 'cards'], value: [{ title: 'a' }] },
      { path: ['columns', 1, 'cards'], value: [{ title: 'b' }, { title: 'c' }] },
    ]);
  });

  it('clamps the insertion gap and tolerates a column without cards', () => {
    // A drop at the END of the target column is an append — one index.
    const sets = kanbanCardMoveSets(data, 0, 0, 2, 99);
    expect(sets).toEqual([
      { path: ['columns', 0, 'cards'], value: [{ title: 'b' }] },
      { path: ['columns', 2, 'cards', 0], value: { title: 'a' } },
    ]);
  });

  it('returns null for a missing card or bad columns', () => {
    expect(kanbanCardMoveSets(data, 0, 9, 1, 0)).toBeNull();
    expect(kanbanCardMoveSets({}, 0, 0, 1, 0)).toBeNull();
  });
});

describe('grid snapping (pointer → cell, with scale)', () => {
  // The block-graph constants at half rendered size (a shrunk-to-fit SVG).
  const geom: GridGeom = {
    cellW: 178,
    cellH: 88,
    gapX: 64,
    gapY: 64,
    padX: 38,
    padTop: 52,
    cols: 3,
    rows: 2,
    scale: 0.5,
  };

  it('maps a pointer inside a cell to that cell', () => {
    // Cell (2,1) spans viewBox x 280–458; its center is 369 → CSS 184.5.
    expect(cellAtPoint(geom, 184.5, 48)).toEqual({ col: 2, row: 1 });
    // Top-left corner region snaps to (1,1) — never below 1.
    expect(cellAtPoint(geom, 0, 0)).toEqual({ col: 1, row: 1 });
  });

  it('snaps by nearest center across the gaps', () => {
    // viewBox x 250 sits in the gap between col 1 (ends 216) and col 2
    // (starts 280) — nearer col 2's center.
    expect(cellAtPoint(geom, 250 * geom.scale, 96 * geom.scale).col).toBe(2);
  });

  it('allows exactly one cell beyond the current extent (grid can grow)', () => {
    expect(cellAtPoint(geom, 9999, 9999)).toEqual({ col: 4, row: 3 });
  });

  it('cellBox returns the cell rect in CSS px, honouring node width spans', () => {
    expect(cellBox(geom, 1, 1)).toEqual({ left: 19, top: 26, width: 89, height: 44 });
    expect(cellBox(geom, 2, 2)).toEqual({ left: 140, top: 102, width: 89, height: 44 });
    // w=2 spans two cells plus the gap between them.
    expect(cellBox(geom, 1, 1, 2).width).toBe((178 * 2 + 64) * 0.5);
  });

  it('cellAtPoint(center of cellBox) round-trips', () => {
    for (const [c, r] of [[1, 1], [3, 2], [2, 1]] as const) {
      const b = cellBox(geom, c, r);
      expect(cellAtPoint(geom, b.left + b.width / 2, b.top + b.height / 2)).toEqual({
        col: c,
        row: r,
      });
    }
  });
});

describe('gridMoveSets', () => {
  const placements = [
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 2 },
  ];

  it('a normal move writes only the dragged node', () => {
    const r = gridMoveSets({ placements, index: 0, target: { col: 1, row: 2 }, quick: false });
    expect(r).toEqual({
      sets: [
        { path: ['nodes', 0, 'col'], value: 1 },
        { path: ['nodes', 0, 'row'], value: 2 },
      ],
      swapped: null,
      materialized: false,
    });
  });

  it('dropping on an occupied cell SWAPS the two nodes (renderer stacks overlaps)', () => {
    const r = gridMoveSets({ placements, index: 0, target: { col: 2, row: 1 }, quick: false });
    expect(r?.swapped).toBe(1);
    expect(r?.sets).toEqual([
      { path: ['nodes', 0, 'col'], value: 2 },
      { path: ['nodes', 0, 'row'], value: 1 },
      { path: ['nodes', 1, 'col'], value: 1 },
      { path: ['nodes', 1, 'row'], value: 1 },
    ]);
  });

  it('quick mode materializes EVERY node plus the dragged target, one op', () => {
    const r = gridMoveSets({ placements, index: 2, target: { col: 4, row: 2 }, quick: true });
    expect(r?.materialized).toBe(true);
    expect(r?.sets).toEqual([
      { path: ['nodes', 0, 'col'], value: 1 },
      { path: ['nodes', 0, 'row'], value: 1 },
      { path: ['nodes', 1, 'col'], value: 2 },
      { path: ['nodes', 1, 'row'], value: 1 },
      { path: ['nodes', 2, 'col'], value: 4 },
      { path: ['nodes', 2, 'row'], value: 2 },
    ]);
  });

  it('quick mode + occupied target: materializes with the swap applied', () => {
    const r = gridMoveSets({ placements, index: 0, target: { col: 2, row: 1 }, quick: true });
    expect(r?.swapped).toBe(1);
    expect(r?.sets).toEqual([
      { path: ['nodes', 0, 'col'], value: 2 },
      { path: ['nodes', 0, 'row'], value: 1 },
      { path: ['nodes', 1, 'col'], value: 1 },
      { path: ['nodes', 1, 'row'], value: 1 },
      { path: ['nodes', 2, 'col'], value: 3 },
      { path: ['nodes', 2, 'row'], value: 2 },
    ]);
  });

  it('dropping on the node\'s own cell is a no-op', () => {
    expect(gridMoveSets({ placements, index: 1, target: { col: 2, row: 1 }, quick: false })).toBeNull();
    expect(gridMoveSets({ placements, index: 9, target: { col: 1, row: 1 }, quick: false })).toBeNull();
  });
});

describe('gridMoveSets — spec-driven field + cell writer (state / swimlane)', () => {
  const placements = [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ];

  it('writes through the given node-list field (states)', () => {
    const r = gridMoveSets({
      placements,
      index: 0,
      target: { col: 3, row: 1 },
      quick: false,
      field: 'states',
    });
    expect(r?.sets).toEqual([
      { path: ['states', 0, 'col'], value: 3 },
      { path: ['states', 0, 'row'], value: 1 },
    ]);
  });

  it('maps rows to 0-based lanes through writeCell (swimlane), swaps included', () => {
    const writeCell = (c: { col: number; row: number }): Record<string, number> => ({
      col: c.col,
      lane: c.row - 1,
    });
    const r = gridMoveSets({
      placements,
      index: 0,
      target: { col: 2, row: 2 }, // occupied → swap
      quick: false,
      field: 'steps',
      writeCell,
    });
    expect(r?.swapped).toBe(1);
    expect(r?.sets).toEqual([
      { path: ['steps', 0, 'col'], value: 2 },
      { path: ['steps', 0, 'lane'], value: 1 },
      { path: ['steps', 1, 'col'], value: 1 },
      { path: ['steps', 1, 'lane'], value: 0 },
    ]);
  });
});

describe('ring reorder math (cycle stages on a circle)', () => {
  /** n stage centers on a unit circle, clockwise from 12 o'clock (screen y down). */
  const ringOf = (n: number, r = 100, cx = 200, cy = 200): { x: number; y: number }[] =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });

  it('ringCenter is the centroid of the stage centers', () => {
    const c = ringCenter(ringOf(4));
    expect(c.x).toBeCloseTo(200);
    expect(c.y).toBeCloseTo(200);
  });

  it('the pointer between two stages picks the seam between them', () => {
    const centers = ringOf(4); // stages at 12, 3, 6, 9 o'clock
    // Between stage 0 (12h) and stage 1 (3h) — the 1:30 direction → gap 1.
    expect(ringGap(centers, 200 + 80, 200 - 80)).toBe(1);
    // Between stage 1 (3h) and stage 2 (6h) — 4:30 → gap 2.
    expect(ringGap(centers, 200 + 80, 200 + 80)).toBe(2);
    // Between stage 3 (9h) and stage 0 (12h) — 10:30 → gap 4 (insert at end).
    expect(ringGap(centers, 200 - 80, 200 - 80)).toBe(4);
  });

  it('needs at least two stages', () => {
    expect(ringGap(ringOf(1), 0, 0)).toBeNull();
    expect(ringGap([], 0, 0)).toBeNull();
  });

  it('ringGapPoint sits on the ring at the seam angle', () => {
    const centers = ringOf(4);
    const p = ringGapPoint(centers, 1); // the 1:30 seam
    expect(Math.hypot(p.x - 200, p.y - 200)).toBeCloseTo(100, 0);
    expect(p.x).toBeGreaterThan(200);
    expect(p.y).toBeLessThan(200);
  });
});

describe('cycle stage reorder — through the real pipeline', () => {
  it('a ring drop commits a reordered steps array that stays schema-valid', async () => {
    const { parseDocument, validateDocument } = await import('chiltepin-core');
    const { setPathsInSegment } = await import('./host.js');
    const source = [
      '# T',
      '',
      '```cycle',
      'steps:',
      '  - Plan',
      '  - { label: Build, desc: Ship it }',
      '  - Review',
      '```',
      '',
    ].join('\n');
    const doc = parseDocument(source, 't');
    const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
    const seg = doc.segments[idx];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
    const steps = (seg.data as { steps: unknown[] }).steps;
    const next = applyReorder(steps, 0, 3); // Plan → after Review
    expect(next).not.toBeNull();
    const edited = setPathsInSegment(source, doc, idx, [{ path: ['steps'], value: next }]);
    const errors = validateDocument(parseDocument(edited, 't'), 't.md').filter(
      (d) => d.level === 'error',
    );
    expect(errors).toEqual([]);
    const reparsed = parseDocument(edited, 't').segments[idx];
    if (reparsed === undefined || reparsed.kind === 'markdown') throw new Error('segment missing');
    expect((reparsed.data as { steps: unknown[] }).steps[2]).toBe('Plan');
  });
});

describe('dragTargetFor — ordered HTML lists reorder by drag (the sweep set)', () => {
  it('one entry per kind, leaves resolve to the item (timeline-style)', () => {
    expect(dragTargetFor('glossary', 'terms.2')).toEqual({ mode: 'reorder', listPath: 'terms', index: 2 });
    expect(dragTargetFor('glossary', 'terms.2.def')).toEqual({ mode: 'reorder', listPath: 'terms', index: 2 });
    expect(dragTargetFor('faq', 'items.0.question')).toEqual({ mode: 'reorder', listPath: 'items', index: 0 });
    expect(dragTargetFor('steps', 'items.1')).toEqual({ mode: 'reorder', listPath: 'items', index: 1 });
    expect(dragTargetFor('list', 'items.3')).toEqual({ mode: 'reorder', listPath: 'items', index: 3 });
    expect(dragTargetFor('takeaways', 'items.0')).toEqual({ mode: 'reorder', listPath: 'items', index: 0 });
    expect(dragTargetFor('agenda', 'items.2')).toEqual({ mode: 'reorder', listPath: 'items', index: 2 });
    expect(dragTargetFor('team', 'members.1')).toEqual({ mode: 'reorder', listPath: 'members', index: 1 });
    expect(dragTargetFor('stats', 'stats.0.value')).toEqual({ mode: 'reorder', listPath: 'stats', index: 0 });
    // Other parts of those kinds stay non-draggable.
    expect(dragTargetFor('glossary', 'title')).toBeNull();
    expect(dragTargetFor('faq', 'note')).toBeNull();
  });

  it('the sweep kinds report drag support (footer hint)', () => {
    for (const k of ['glossary', 'faq', 'steps', 'list', 'takeaways', 'agenda', 'team', 'stats']) {
      expect(blockSupportsDrag(k), k).toBe(true);
    }
  });
});

describe('saga steps drag-reorder (position IS the array index)', () => {
  it('a step — or a leaf inside it — grabs the step for a reorder', () => {
    expect(dragTargetFor('saga', 'steps.0')).toEqual({ mode: 'reorder', listPath: 'steps', index: 0 });
    expect(dragTargetFor('saga', 'steps.2.compensate')).toEqual({ mode: 'reorder', listPath: 'steps', index: 2 });
    expect(dragTargetFor('saga', 'steps.1.service')).toEqual({ mode: 'reorder', listPath: 'steps', index: 1 });
    expect(dragTargetFor('saga', 'coordinator')).toBeNull();
    expect(dragTargetFor('saga', 'failAt')).toBeNull();
  });

  it('is NOT a grid kind — a saga step has no col/row to write', () => {
    expect(specFor('saga')).toBeNull();
    expect(dragTargetFor('saga', 'groups.0')).toBeNull();
    expect(blockSupportsDrag('saga')).toBe(true);
  });

  it('the selected part classifies as a reorderable list item, not a grid node', () => {
    expect(classifyPart('saga', 'steps.2')).toEqual({ kind: 'item', listPath: 'steps', index: 2 });
    expect(deletablePathFor('saga', 'steps.2.compensate')).toBe('steps.2');
  });

  it('a horizontal drag splices the step to its new index and stays schema-valid', async () => {
    const { parseDocument, validateDocument } = await import('chiltepin-core');
    const { setPathsInSegment } = await import('./host.js');
    const source = [
      '# T',
      '',
      '```saga',
      'title: Place order',
      'steps:',
      '  - reserve: Reserve stock · inventory · release stock',
      '  - charge: Charge card · payments · refund card',
      '  - ship: Book shipment · shipping · cancel shipment',
      'failAt: ship',
      '```',
      '',
    ].join('\n');
    const doc = parseDocument(source, 't');
    const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
    const seg = doc.segments[idx];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
    const steps = (seg.data as { steps: Array<{ id: string }> }).steps;
    expect(steps.map((s) => s.id)).toEqual(['reserve', 'charge', 'ship']);

    // The steps sit left to right, so the drag axis is x and the drop gap
    // comes from the measured centres — exactly the sequence-actor path.
    const boxes = [box(20, 40, 160, 90), box(224, 40, 160, 90), box(428, 40, 160, 90)];
    expect(dominantAxis(boxes)).toBe('x');
    const gap = insertionIndex(centersAlong(boxes, 'x'), 560); // dropped past `ship`
    expect(gap).toBe(3);
    const next = applyReorder(steps, 0, gap); // `reserve` → last
    expect(next).not.toBeNull();

    const edited = setPathsInSegment(source, doc, idx, [{ path: ['steps'], value: next }]);
    const errors = validateDocument(parseDocument(edited, 't'), 't.md').filter(
      (d) => d.level === 'error',
    );
    expect(errors).toEqual([]);
    const reparsed = parseDocument(edited, 't').segments[idx];
    if (reparsed === undefined || reparsed.kind === 'markdown') throw new Error('segment missing');
    expect((reparsed.data as { steps: Array<{ id: string }> }).steps.map((s) => s.id)).toEqual([
      'charge',
      'ship',
      'reserve',
    ]);
  });
});
