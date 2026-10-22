import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseDocument } from 'chiltepin-core';
import { lintGeometry, runCheck } from '../commands/check.js';

async function tempProject(files: Record<string, string>): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = join(tmpdir(), `chiltepin-geometry-${randomBytes(6).toString('hex')}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** Two flow nodes on one cell: the layout cannot keep them apart. */
const sharedCell = `\`\`\`flow
nodes:
  - { id: a, label: Receive, col: 1, row: 1 }
  - { id: b, label: Charge, col: 1, row: 1 }
  - { id: c, label: Ship, col: 2, row: 1 }
edges:
  - a -> c
\`\`\`
`;

/** A clean flow: nothing to report. */
const clean = `\`\`\`flow
nodes:
  - { id: a, label: Receive, col: 1, row: 1 }
  - { id: b, label: Ship, col: 2, row: 1 }
edges:
  - a -> b: paid
\`\`\`
`;

describe('W_GEOMETRY', () => {
  it('reports two nodes in one cell on the fence line, with a fix in data terms', () => {
    const diags = lintGeometry(parseDocument(sharedCell, 'flow'), 'docs/flow.md', []);
    expect(diags).toHaveLength(1);
    const d = diags[0];
    expect(d?.code).toBe('W_GEOMETRY');
    expect(d?.level).toBe('warn');
    expect(d?.line).toBe(1);
    expect(d?.message).toContain('"Receive" and "Charge"');
    expect(d?.value).toBe('nodes.1');
    expect(d?.hint).toContain('Move "Charge" to a free cell');
    // Never a pixel coordinate.
    expect(d?.hint).not.toMatch(/\bpx\b/);
  });

  it('is silent for a clean diagram and skips a block that failed validation', () => {
    expect(lintGeometry(parseDocument(clean, 'flow'), 'docs/flow.md', [])).toEqual([]);
    const failed = lintGeometry(parseDocument(sharedCell, 'flow'), 'docs/flow.md', [
      { file: 'docs/flow.md', line: 3, level: 'error', code: 'E_SCHEMA', message: 'bad' },
    ]);
    expect(failed).toEqual([]);
  });

  it('runCheck surfaces it as a warning that never fails the check', async () => {
    const { root, cleanup } = await tempProject({ 'docs/flow.md': sharedCell });
    try {
      const result = await runCheck({
        patterns: ['docs/**/*.md'],
        cwd: root,
        docsRoot: 'docs',
        strictProse: true,
      });
      const geo = result.diagnostics.find((d) => d.code === 'W_GEOMETRY');
      expect(geo?.level).toBe('warn');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });
});
