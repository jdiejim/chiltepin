/**
 * `skills/chiltepin/reference/check.md` documents every diagnostic code that
 * `diagnostics.ts` declares, and every `review` issue kind — an agent reads
 * the code in the output and looks it up there.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve(import.meta.dirname, '../../../..');
const doc = readFileSync(resolve(repo, 'skills/chiltepin/reference/check.md'), 'utf8');
const source = readFileSync(resolve(repo, 'packages/core/src/diagnostics.ts'), 'utf8');

describe('check.md', () => {
  const codes = [...new Set([...source.matchAll(/\| '([EW]_[A-Z_]+)'/g)].map((m) => m[1] as string))];

  it('reads the codes from diagnostics.ts', () => {
    expect(codes.length).toBeGreaterThan(30);
    expect(codes).toContain('W_FIT');
  });

  it.each(codes)('documents %s', (code) => {
    const documented = code.startsWith('W_PROSE_') ? doc.includes('`W_PROSE_*`') : doc.includes(`\`${code}\``);
    expect(documented).toBe(true);
  });

  it.each(['fit', 'cut', 'overlap', 'tiny', 'print'])('documents the review kind %s', (kind) => {
    expect(doc).toContain(`| \`${kind}\` |`);
  });
});
