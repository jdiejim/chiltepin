/**
 * W_LENS_REPEAT: a third block of the same structural type in one document
 * warns once, names an alternative, and leaves tables, code, and the cover
 * alone (they repeat by nature).
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const callout = (t: string) => '```callout\ntone: note\nbody: ' + t + '\n```\n';
const table = '```table\ncolumns: [A]\nrows:\n  - [x]\n```\n';

describe('W_LENS_REPEAT', () => {
  it('warns once on the third callout and names the alternatives', () => {
    const md = callout('a') + callout('b') + callout('c') + callout('d');
    const w = validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT');
    expect(w).toHaveLength(1);
    expect(w[0]?.level).toBe('warn');
    expect(w[0]?.hint).toContain('`list`');
  });

  it('never warns for tables or one-per-item blocks, and other lenses only on the fourth', () => {
    const ep = '```endpoint\nmethod: GET\npath: /a\n```\n';
    const md = table + table + table + table + callout('a') + callout('b') + ep + ep + ep + ep;
    expect(validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toEqual([]);
    const spec = '```spec\nitems:\n  - { label: a, value: b }\n```\n';
    const three = validateDocument(parseDocument(spec + spec + spec, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT');
    expect(three).toEqual([]);
    const four = validateDocument(parseDocument(spec + spec + spec + spec, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT');
    expect(four).toHaveLength(1);
    expect(four[0]?.message).toContain('fourth');
  });

  it('counts chart kinds and block presets as separate lenses', () => {
    const chart = (k: string) => '```chart\nkind: ' + k + '\nlabels: [a, b]\nseries:\n  - { label: s, values: [1, 2] }\n```\n';
    const md = chart('bar') + chart('line') + chart('area') + chart('stacked') + chart('bar');
    expect(validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toEqual([]);
  });

  it('counts each C4 level and the dynamic view as separate lenses', () => {
    const c4 = (level: string, step = false) =>
      '```c4\nlevel: ' + level + '\nnodes:\n  - { id: a, kind: system, name: A }\n  - { id: b, kind: external, name: B }\nedges:\n  - { from: a, to: b, label: calls' + (step ? ', step: 1' : '') + ' }\n```\n';
    const zoom = c4('context') + c4('container') + c4('component') + c4('component', true);
    expect(validateDocument(parseDocument(zoom, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toEqual([]);
    const same = c4('container').repeat(4);
    expect(validateDocument(parseDocument(same, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toHaveLength(1);
  });

  it('leaves one sequence per route alone in an API reference', () => {
    const ep = '```endpoint\nmethod: GET\npath: /a\n```\n';
    const seq = '```sequence\nactors:\n  - { id: A, name: A }\n  - { id: B, name: B }\nmessages:\n  - A -> B: hi\n```\n';
    const md = (ep + seq).repeat(4);
    expect(validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toEqual([]);
    const routeSeq = '```sequence\nendpoint: { method: GET, path: /a }\nactors:\n  - { id: A, name: A }\n  - { id: B, name: B }\nmessages:\n  - A -> B: hi\n```\n';
    expect(validateDocument(parseDocument(routeSeq.repeat(5), 't'), 't.md').filter((d) => d.code === 'W_LENS_REPEAT')).toEqual([]);
  });
});
