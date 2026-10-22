/**
 * The `table` schema: column types (`num`, `check`, `bar`) with a `unit`,
 * boolean cells, group rows (`[{ v, group: true }]`), the `foot` row, and the
 * structural errors the renderer cannot draw honestly.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

function diagsFor(body: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument('```table\n' + body.trim() + '\n```\n', 'tmp'), 'tmp.md');
}

function messages(body: string): string[] {
  return diagsFor(body).map((d) => d.message);
}

describe('table schema', () => {
  it('validates column types, units, booleans, group rows and a foot', () => {
    const body = [
      'columns:',
      '  - Region',
      '  - { label: p95, type: num, unit: ms }',
      '  - { label: Requests, type: bar }',
      '  - { label: Cached, type: check }',
      'rows:',
      '  - [{ v: Europe, group: true }]',
      '  - [eu-west-1, 44, 18000000, true]',
      '  - [eu-central-1, "1,204.5", 0, partial]',
      'foot: [Total, "", 18000000]',
    ].join('\n');
    expect(diagsFor(body)).toEqual([]);
  });

  it('a group row may carry empty padding cells (Studio pads rows on a column op)', () => {
    expect(diagsFor('columns: [A, B]\nrows:\n  - [{ v: S, group: true }, ""]')).toEqual([]);
  });

  it('a row with more cells than columns is an error that names the comma trap', () => {
    const m = messages('columns: [Weight, Alignment]\nrows:\n  - [Light (one block, little prose), Centered]');
    expect(m).toHaveLength(1);
    expect(m[0]).toContain('this row has 3 cells, but the table has 2 columns');
    expect(m[0]).toContain('quote a cell that holds a comma');
  });

  it('the foot is held to the column count too', () => {
    expect(messages('columns: [A]\nrows:\n  - [x]\nfoot: [a, b]')[0]).toContain('this row has 2 cells');
  });

  it('a table without columns takes rows of any length', () => {
    expect(diagsFor('rows:\n  - [a, b, c]\n  - [d]')).toEqual([]);
  });

  it('a group row with data beside its label is an error', () => {
    const m = messages('columns: [A, B]\nrows:\n  - [{ v: S, group: true }, data]');
    expect(m[0]).toContain('a group row holds only its label');
  });

  it('a unit needs a num or bar column', () => {
    const m = messages('columns:\n  - { label: Cost, unit: $ }\nrows:\n  - ["1"]');
    expect(m[0]).toContain('`unit` needs `type: num` or `type: bar`');
    expect(diagsFor('columns:\n  - { label: Cost, type: num, unit: $ }\nrows:\n  - [1]')).toEqual([]);
  });

  it('a bar column rejects a negative value', () => {
    const m = messages('columns:\n  - { label: Share, type: bar }\nrows:\n  - [-3]');
    expect(m[0]).toContain('a bar column takes values of 0 or more');
    // A num column takes signed values.
    expect(diagsFor('columns:\n  - { label: Delta, type: num }\nrows:\n  - [-3]')).toEqual([]);
  });

  it('a foot cell cannot be a group label, and an unknown column type fails', () => {
    expect(diagsFor('columns: [A]\nfoot: [{ v: x, group: true }]').some((d) => d.code === 'E_SCHEMA')).toBe(true);
    expect(diagsFor('columns:\n  - { label: A, type: status }').some((d) => d.code === 'E_SCHEMA')).toBe(true);
  });
});
