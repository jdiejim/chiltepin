import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseDocument, validateDocument, type Diagnostic } from 'chiltepin-core';
import {
  runInit,
  skillDir,
  stitchSkill,
  DERIVATIONS_NOTE,
  templatesDir,
  SKILL_REFERENCE_FILES,
} from '../commands/init.js';

async function tempDir(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `chiltepin-init-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** Alias warnings are informational and never fail a check. */
const failing = (diags: readonly Diagnostic[]): readonly Diagnostic[] =>
  diags.filter((d) => !(d.code === 'W_ALIAS_TYPE' && d.level === 'warn'));

describe('runInit', () => {
  it('scaffolds exactly the config and the two starter docs', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root });
      expect(result.created).toEqual([
        'chiltepin.config.json',
        'docs/getting-started.md',
        'docs/tutorial.md',
      ]);
      expect(result.skipped).toEqual([]);
      // No skill copy, no adapters — the skill installs through `npx skills add`.
      expect(existsSync(join(root, '.chiltepin'))).toBe(false);
      expect(existsSync(join(root, '.claude'))).toBe(false);
      expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false);
      const config = await readFile(join(root, 'chiltepin.config.json'), 'utf8');
      expect(JSON.parse(config)).toMatchObject({ docsDir: 'docs', outDir: 'dist' });
    } finally {
      await cleanup();
    }
  });

  it('scaffolded docs validate clean', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root });
      for (const f of ['docs/getting-started.md', 'docs/tutorial.md']) {
        const md = await readFile(join(root, f), 'utf8');
        const doc = parseDocument(md, f.replace(/^docs\//, '').replace(/\.md$/, ''));
        expect(failing(validateDocument(doc, f)), `${f} should validate`).toEqual([]);
      }
    } finally {
      await cleanup();
    }
  });

  it('skips existing files unless --force', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'chiltepin.config.json'), '{ "docsDir": "d" }\n');
      const first = await runInit({ cwd: root });
      expect(first.skipped).toEqual(['chiltepin.config.json']);
      expect(first.created).toHaveLength(2);
      expect(await readFile(join(root, 'chiltepin.config.json'), 'utf8')).toContain('"d"');
      const forced = await runInit({ cwd: root, force: true });
      expect(forced.created).toHaveLength(3);
      expect(await readFile(join(root, 'chiltepin.config.json'), 'utf8')).toContain('"docs"');
    } finally {
      await cleanup();
    }
  });
});

describe('the skill folder', () => {
  it('resolves to one folder holding the hub and every reference file', () => {
    const dir = skillDir();
    expect(existsSync(join(dir, 'SKILL.md'))).toBe(true);
    for (const f of SKILL_REFERENCE_FILES) {
      expect(existsSync(join(dir, f)), `missing ${f}`).toBe(true);
    }
    // No hand-written contract: the CLI (`chiltepin block`) is the reference.
    expect(existsSync(join(dir, 'reference/blocks/contract.md'))).toBe(false);
  });

  it('templatesDir carries no skill copy in the repo (it is synced at build time)', () => {
    // The packaged copy is gitignored; from source, skillDir() falls back to
    // skills/chiltepin. Either way the resolver must land on a SKILL.md.
    expect(existsSync(join(skillDir(), 'SKILL.md'))).toBe(true);
    expect(existsSync(templatesDir())).toBe(true);
  });

  it('stitchSkill() joins the hub and the references, without the derivations', async () => {
    const md = await stitchSkill();
    expect(md.startsWith('---\nname: chiltepin')).toBe(true);
    expect(md).toContain('are included in full below — read them on demand');
    expect(md).not.toContain('live beside this file — read them on demand');
    for (const f of SKILL_REFERENCE_FILES) {
      const head = (await readFile(join(skillDir(), f), 'utf8')).split('\n')[0] ?? '';
      expect(md, `${f} should be stitched in`).toContain(head);
    }
    // Worked derivations stay out of the single-file form, and the form says so.
    const derivation = await readFile(join(skillDir(), 'reference/derivations/adr.md'), 'utf8');
    const longest = derivation.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
    expect(md).not.toContain(longest);
    expect(md.endsWith(DERIVATIONS_NOTE)).toBe(true);
    expect(DERIVATIONS_NOTE).toContain('are repo-only');
  });
});
