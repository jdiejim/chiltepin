import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from 'chiltepin-core';
import {
  addColumnSets,
  columnIndexFromPath,
  columnSpecFor,
  deleteColumnSets,
} from './columnOps.js';
import { setPathsInSegment } from './host.js';
import type { PathSet } from './drag.js';

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

/** One fence per column-family kind, all with 2 columns × 2 rows. */
const FENCES: Readonly<Record<string, string>> = {
  table: [
    '```table',
    'columns: [Name, Role]',
    'rows:',
    '  - [Ada, Engineer]',
    '  - [Grace, PM]',
    '```',
  ].join('\n'),
  statustable: [
    '```statustable',
    'columns: [Task, Owner]',
    'rows:',
    '  - { cells: [Ship it, ada], status: in progress, subtasks: [{ cells: [Write docs, ada], status: todo }] }',
    '  - { cells: [Review, grace], status: todo }',
    '```',
  ].join('\n'),
  matrix: [
    '```matrix',
    'cols: [Read, Write]',
    'rows:',
    '  - { label: Admin, cells: [yes, yes] }',
    '  - { label: Viewer, cells: [yes, no] }',
    '```',
  ].join('\n'),
  journey: [
    '```journey',
    'stages:',
    '  - { label: Discover }',
    '  - { label: Buy }',
    'rows:',
    '  - { label: Actions, cells: [Search, Checkout] }',
    'emotion: [3, 4]',
    '```',
  ].join('\n'),
  heatmap: [
    '```heatmap',
    'xLabels: [Mon, Tue]',
    'rows:',
    '  - { label: API, values: [1, 2] }',
    '  - { label: Web, values: [3, 4] }',
    '```',
  ].join('\n'),
};

function fixture(kind: string): {
  data: unknown;
  apply: (sets: readonly PathSet[]) => string;
} {
  const source = `# T\n\n${must(FENCES[kind])}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { data: seg.data, apply: (sets) => setPathsInSegment(source, doc, idx, sets) };
}

function errorsOf(source: string): string[] {
  return validateDocument(parseDocument(source, 't'), 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

describe('columnSpecFor / columnIndexFromPath', () => {
  it('covers exactly the aligned-column kinds, through their own field names', () => {
    expect(must(columnSpecFor('table')).colsPath).toBe('columns');
    expect(must(columnSpecFor('statustable')).colsPath).toBe('columns');
    expect(must(columnSpecFor('matrix')).colsPath).toBe('cols');
    expect(must(columnSpecFor('journey')).colsPath).toBe('stages');
    expect(must(columnSpecFor('heatmap')).colsPath).toBe('xLabels');
    expect(columnSpecFor('kanban')).toBeNull(); // kanban columns are independent
    expect(columnSpecFor('scorecard')).toBeNull();
  });

  it('maps column-header paths to indices (whole header only)', () => {
    expect(columnIndexFromPath('table', 'columns.1')).toBe(1);
    expect(columnIndexFromPath('matrix', 'cols.0')).toBe(0);
    expect(columnIndexFromPath('table', 'rows.1')).toBeNull();
    expect(columnIndexFromPath('table', 'columns.1.x')).toBeNull();
    expect(columnIndexFromPath('glossary', 'terms.0')).toBeNull();
  });
});

describe('addColumnSets — header + one cell per aligned row, one commit', () => {
  for (const kind of Object.keys(FENCES)) {
    it(`${kind}: appends everywhere and stays schema-valid`, () => {
      const f = fixture(kind);
      const r = must(addColumnSets(kind, f.data));
      const spec = must(columnSpecFor(kind));
      expect(r.headerPath).toBe(`${spec.colsPath}.2`);
      const edited = f.apply(r.sets);
      expect(errorsOf(edited), kind).toEqual([]);
      // Every aligned cell array grew to the new width.
      const reparsed = parseDocument(edited, 't');
      const seg = reparsed.segments.find((s) => s.kind !== 'markdown');
      if (seg === undefined) throw new Error('segment missing');
      for (const arr of spec.cellArrays(seg.data)) {
        expect(arr.cells.length, `${kind} ${arr.path.join('.')}`).toBe(3);
      }
    });
  }

  it('table: a full-width row gains ONE cell, addressed by index', () => {
    const f = fixture('table');
    const r = must(addColumnSets('table', f.data));
    expect(r.sets).toEqual([
      { path: ['columns', 2], value: 'New column' },
      { path: ['rows', 0, 2], value: '' },
      { path: ['rows', 1, 2], value: '' },
    ]);
  });

  it('table: a RAGGED short row is rewritten whole (padded to the new width)', () => {
    const r = must(addColumnSets('table', { columns: ['A', 'B'], rows: [['1']] }));
    expect(r.sets).toEqual([
      { path: ['columns', 2], value: 'New column' },
      { path: ['rows', 0], value: ['1', '', ''] },
    ]);
  });

  it('table: the foot row grows and shrinks with the columns; a group row keeps its one label cell', () => {
    const data = { columns: ['A', 'B'], rows: [[{ v: 'S', group: true }], ['1', '2']], foot: ['Total', 3] };
    const add = must(addColumnSets('table', data));
    expect(add.sets).toEqual([
      { path: ['columns', 2], value: 'New column' },
      { path: ['rows', 1, 2], value: '' },
      { path: ['foot', 2], value: '' },
    ]);
    expect(deleteColumnSets('table', data, 0)).toEqual([
      { path: ['columns'], value: ['B'] },
      { path: ['rows', 1], value: ['2'] },
      { path: ['foot'], value: [3] },
    ]);
  });

  it('statustable: subtask cell rows grow too', () => {
    const f = fixture('statustable');
    const r = must(addColumnSets('statustable', f.data));
    expect(r.sets.some((s) => s.path.join('.').startsWith('rows.0.subtasks.0.cells'))).toBe(true);
  });

  it('journey: the emotion curve stays one value per stage', () => {
    const f = fixture('journey');
    const r = must(addColumnSets('journey', f.data));
    const emotion = r.sets.find((s) => s.path.join('.') === 'emotion.2');
    expect(emotion?.value).toBe(3);
  });
});

describe('deleteColumnSets — header + that cell in every aligned row', () => {
  for (const kind of Object.keys(FENCES)) {
    it(`${kind}: removes the column everywhere and stays schema-valid`, () => {
      const f = fixture(kind);
      const sets = must(deleteColumnSets(kind, f.data, 1));
      const edited = f.apply(sets);
      expect(errorsOf(edited), kind).toEqual([]);
      const reparsed = parseDocument(edited, 't');
      const seg = reparsed.segments.find((s) => s.kind !== 'markdown');
      if (seg === undefined) throw new Error('segment missing');
      const spec = must(columnSpecFor(kind));
      for (const arr of spec.cellArrays(seg.data)) {
        expect(arr.cells.length, `${kind} ${arr.path.join('.')}`).toBe(1);
      }
    });
  }

  it('refuses to drop below the minimum and rejects bad indices', () => {
    expect(deleteColumnSets('table', { columns: ['Only'], rows: [['x']] }, 0)).toBeNull();
    expect(deleteColumnSets('matrix', { cols: ['One'], rows: [] }, 0)).toBeNull();
    expect(deleteColumnSets('table', { columns: ['A', 'B'], rows: [] }, 5)).toBeNull();
    expect(deleteColumnSets('table', { columns: ['A', 'B'], rows: [] }, -1)).toBeNull();
  });

  it('tolerates ragged short rows (they stay untouched)', () => {
    const sets = must(
      deleteColumnSets('table', { columns: ['A', 'B', 'C'], rows: [['1'], ['1', '2', '3']] }, 2),
    );
    expect(sets).toEqual([
      { path: ['columns'], value: ['A', 'B'] },
      { path: ['rows', 1], value: ['1', '2'] },
    ]);
  });
});
