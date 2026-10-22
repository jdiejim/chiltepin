/**
 * Pure rules for COLUMN-shaped compound edits: several block kinds keep a
 * list of column labels plus per-row cell arrays that must stay aligned
 * (table `columns` ↔ `rows.N`, statustable `columns` ↔ `rows.N.cells` and
 * every subtask's cells, matrix `cols` ↔ `rows.N.cells`, journey `stages` ↔
 * `rows.N.cells` + the `emotion` curve, heatmap `xLabels` ↔ `rows.N.values`).
 *
 * Adding or deleting a column must touch ALL of those lists in ONE commit
 * (one applyOp → one undo step), mirroring the compound table-column reorder
 * in `drag.ts`. No React, no DOM — the glue lives in `DirectLayer.tsx`.
 */

import type { PathSet } from './drag.js';
import type { PathSeg } from './paths.js';

/** How one block kind spells its aligned column structure. */
interface ColumnSpec {
  /** The column-label list (`columns`, `cols`, `stages`, `xLabels`). */
  readonly colsPath: string;
  /** The value a NEW header cell gets (journey stages are `{label}`). */
  readonly newHeader: (index: number) => unknown;
  /**
   * Every cell array that must stay aligned with the columns, resolved
   * against the block data, each with the value a NEW cell gets (the
   * journey emotion curve pads with a neutral number, not a string).
   */
  readonly cellArrays: (data: unknown) => ReadonlyArray<{
    readonly path: ReadonlyArray<PathSeg>;
    readonly cells: readonly unknown[];
    readonly pad: unknown;
  }>;
  /** Deleting below this many columns is refused (schema `min(1)` etc.). */
  readonly minCols: number;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function arrayAt(v: unknown, key: string): unknown[] {
  const a = asRecord(v)?.[key];
  return Array.isArray(a) ? a : [];
}

/** A table section label: a row whose cell carries `group: true`. */
function isGroupRow(row: readonly unknown[]): boolean {
  return row.some((c) => asRecord(c)?.['group'] === true);
}

/** `rows.N.cells`-style pairs (statustable/matrix/journey; heatmap `values`). */
function rowCellArrays(
  data: unknown,
  cellsKey: string,
  pad: unknown,
): Array<{ path: PathSeg[]; cells: unknown[]; pad: unknown }> {
  const out: Array<{ path: PathSeg[]; cells: unknown[]; pad: unknown }> = [];
  arrayAt(data, 'rows').forEach((row, ri) => {
    const rec = asRecord(row);
    if (rec === null || !Array.isArray(rec[cellsKey])) return;
    out.push({ path: ['rows', ri, cellsKey], cells: rec[cellsKey] as unknown[], pad });
  });
  return out;
}

const SPECS: Readonly<Record<string, ColumnSpec>> = {
  table: {
    colsPath: 'columns',
    newHeader: () => 'New column',
    minCols: 1,
    // A table row IS its cells array; the `foot` (totals) row aligns too. A
    // group row (`[{ v, group: true }]`) is one label cell: it never gains or
    // loses a column.
    cellArrays: (data) => [
      ...arrayAt(data, 'rows').flatMap((row, ri) =>
        Array.isArray(row) && !isGroupRow(row) ? [{ path: ['rows', ri] as PathSeg[], cells: row, pad: '' as unknown }] : [],
      ),
      ...(Array.isArray(asRecord(data)?.['foot'])
        ? [{ path: ['foot'] as PathSeg[], cells: arrayAt(data, 'foot'), pad: '' as unknown }]
        : []),
    ],
  },
  statustable: {
    colsPath: 'columns',
    newHeader: () => 'New column',
    minCols: 1,
    cellArrays: (data) => {
      const out = rowCellArrays(data, 'cells', '');
      arrayAt(data, 'rows').forEach((row, ri) => {
        arrayAt(row, 'subtasks').forEach((sub, si) => {
          const rec = asRecord(sub);
          if (rec === null || !Array.isArray(rec['cells'])) return;
          out.push({
            path: ['rows', ri, 'subtasks', si, 'cells'],
            cells: rec['cells'] as unknown[],
            pad: '',
          });
        });
      });
      return out;
    },
  },
  matrix: {
    colsPath: 'cols',
    newHeader: () => 'New column',
    minCols: 1, // schema: cols.min(1)
    cellArrays: (data) => rowCellArrays(data, 'cells', ''),
  },
  journey: {
    colsPath: 'stages',
    newHeader: () => ({ label: 'New stage' }),
    minCols: 1,
    cellArrays: (data) => {
      const out = rowCellArrays(data, 'cells', '');
      // The emotion curve is one NUMBER per stage — pad with the neutral 3.
      const emotion = arrayAt(data, 'emotion');
      if (emotion.length > 0) out.push({ path: ['emotion'], cells: emotion, pad: 3 });
      return out;
    },
  },
  heatmap: {
    colsPath: 'xLabels',
    newHeader: () => 'New',
    minCols: 1, // schema: xLabels.min(1)
    cellArrays: (data) => rowCellArrays(data, 'values', 0),
  },
  storymap: {
    colsPath: 'backbone',
    newHeader: () => ({ label: 'New step' }),
    minCols: 1, // schema: backbone.min(1)
    // Every slice's `cells` must stay one-per-backbone-step (the schema
    // validates the alignment) — a new step pads each slice with an empty cell.
    cellArrays: (data) =>
      arrayAt(data, 'slices').flatMap((slice, si) => {
        const rec = asRecord(slice);
        return rec !== null && Array.isArray(rec['cells'])
          ? [{ path: ['slices', si, 'cells'] as PathSeg[], cells: rec['cells'] as unknown[], pad: [] as unknown }]
          : [];
      }),
  },
};

/** The column spec for a block kind, or null when it has no aligned columns. */
export function columnSpecFor(kind: string): ColumnSpec | null {
  return SPECS[kind] ?? null;
}

/** The column index a `data-bp`/victim path addresses (`columns.2` → 2). */
export function columnIndexFromPath(kind: string, path: string): number | null {
  const spec = SPECS[kind];
  if (spec === undefined) return null;
  const m = new RegExp(`^${spec.colsPath}\\.(\\d+)$`).exec(path);
  return m !== null ? Number(m[1]) : null;
}

/**
 * The writes that ADD a column: append the header AND one default cell to
 * every aligned row (one applyOp → one undo step). Returns the new header's
 * `data-bp` path so the caller can select it and open the micro-editor.
 * Null when the kind has no column structure.
 */
export function addColumnSets(
  kind: string,
  data: unknown,
): { sets: PathSet[]; headerPath: string } | null {
  const spec = SPECS[kind];
  if (spec === undefined) return null;
  const cols = arrayAt(data, spec.colsPath);
  const sets: PathSet[] = [
    { path: [spec.colsPath, cols.length], value: spec.newHeader(cols.length) },
  ];
  for (const arr of spec.cellArrays(data)) {
    // A full-width row only gains ONE cell — address it directly, so the row's
    // existing cells keep their exact source text.
    if (arr.cells.length === cols.length) {
      sets.push({ path: [...arr.path, cols.length], value: arr.pad });
      continue;
    }
    // Pad short rows up to the NEW width so the fresh column always exists.
    const padded = arr.cells.slice();
    while (padded.length < cols.length + 1) padded.push(arr.pad);
    sets.push({ path: arr.path, value: padded });
  }
  return { sets, headerPath: `${spec.colsPath}.${cols.length}` };
}

/**
 * The writes that DELETE column `index`: the header AND that cell in every
 * aligned row (cells beyond the column count keep their tail positions —
 * the same ragged-row tolerance as the compound reorder). Null when the kind
 * has no column structure, the index is out of range, or the deletion would
 * drop below the schema's minimum.
 *
 * These stay whole-list sets: a column deletion is one splice per aligned
 * array, and the caller commits {@link PathSet}s (which have no `remove`
 * form) as ONE undo step. Splitting them into per-index removes would be one
 * commit per array, and the arrays would fall out of alignment in between.
 */
export function deleteColumnSets(kind: string, data: unknown, index: number): PathSet[] | null {
  const spec = SPECS[kind];
  if (spec === undefined) return null;
  const cols = arrayAt(data, spec.colsPath);
  if (!Number.isInteger(index) || index < 0 || index >= cols.length) return null;
  if (cols.length - 1 < spec.minCols) return null;
  const sets: PathSet[] = [
    { path: [spec.colsPath], value: cols.filter((_, i) => i !== index) },
  ];
  for (const arr of spec.cellArrays(data)) {
    if (index >= arr.cells.length) continue; // ragged short row — untouched
    sets.push({ path: arr.path, value: arr.cells.filter((_, i) => i !== index) });
  }
  return sets;
}
