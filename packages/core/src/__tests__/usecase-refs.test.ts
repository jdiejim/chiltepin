/**
 * `usecase` in-block references: the renderer drops a link or relation whose
 * end names nothing, so the schema reports it. A generalisation may join two
 * actors; `focus` must name a case.
 */

import { describe, expect, it } from 'vitest';
import { formatBlockContract } from '../blocks/contract.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const fence = (body: string): string => `\`\`\`usecase\n${body}\n\`\`\`\n`;
const check = (body: string): ReturnType<typeof validateDocument> => validateDocument(parseDocument(fence(body), 'doc'), 'doc.md');

const BASE = `system: Shop
actors:
  - { id: user, name: User }
  - { id: admin, name: Admin }
cases:
  - { id: buy, name: Buy }
  - { id: pay, name: Pay }`;

describe('usecase references', () => {
  it('a valid diagram, with an actor generalisation and a focus, has no diagnostics', () => {
    expect(
      check(`${BASE}\nfocus: buy\nlinks: [user -> buy, pay -> admin]\nrelations:\n  - { from: buy, to: pay, kind: include }\n  - { from: admin, to: user, kind: generalize }`),
    ).toEqual([]);
  });

  it('a link end that names no actor or case', () => {
    const diags = check(`${BASE}\nlinks: [user -> ghost]`);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('E_SCHEMA');
    expect(diags[0]?.message).toContain('"ghost" is not an actor or case id');
  });

  it('a relation end that names no case, and an include between two actors', () => {
    expect(check(`${BASE}\nrelations:\n  - { from: buy, to: ghost, kind: extend }`)[0]?.message).toContain('"ghost" is not a case id');
    expect(check(`${BASE}\nrelations:\n  - { from: admin, to: user, kind: include }`).length).toBeGreaterThan(0);
  });

  it('a focus that names no case', () => {
    expect(check(`${BASE}\nfocus: nope`)[0]?.message).toContain('focus "nope" is not a case id');
  });

  it('the block contract shows `focus` and the notes on side, kind and direction', () => {
    const text = formatBlockContract('usecase');
    expect(text).toContain('focus');
    expect(text).toContain('supporting');
    expect(text).toContain('extension → base');
  });
});
