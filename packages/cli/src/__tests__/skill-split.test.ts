/**
 * Guards the skill's reference/blocks/ split: every canonical block type in
 * chiltepin-core's BLOCK_TYPES is documented in exactly one family file (its
 * `#### \`name\`` heading), that file is the one its catalog family names,
 * alias spellings appear in no family heading, and the block-count strings
 * cannot drift from BLOCK_TYPES.length. `chiltepin block` prints the family
 * list and the aliases, so no hand-written index exists to drift.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_ALIASES, BLOCK_FAMILY, BLOCK_TYPES } from 'chiltepin-core';
import { SKILL_REFERENCE_FILES, skillDir } from '../commands/init.js';

const SKILL_DIR = skillDir();
const BLOCKS_DIR = join(SKILL_DIR, 'reference/blocks');

/** Block names claimed by a family file = every `name` in its #### headings. */
function headingNames(md: string): string[] {
  const names: string[] = [];
  for (const heading of md.matchAll(/^####\s+(.+)$/gm)) {
    for (const name of (heading[1] ?? '').matchAll(/`([a-z0-9]+)`/g)) {
      if (name[1] !== undefined) names.push(name[1]);
    }
  }
  return names;
}

describe('reference/blocks family files', () => {
  const familyFiles = readdirSync(BLOCKS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  it('every BLOCK_TYPES name appears in exactly one family file — canonical only', () => {
    const owners = new Map<string, string[]>();
    for (const file of familyFiles) {
      const md = readFileSync(join(BLOCKS_DIR, file), 'utf8');
      for (const name of headingNames(md)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    const missing = BLOCK_TYPES.filter((t) => !owners.has(t));
    const duplicated = BLOCK_TYPES.filter((t) => (owners.get(t)?.length ?? 0) > 1);
    const unknown = [...owners.keys()].filter(
      (n) => !(BLOCK_TYPES as readonly string[]).includes(n),
    );
    expect(missing, 'block types with no family file').toEqual([]);
    expect(duplicated, 'block types documented in two family files').toEqual([]);
    expect(unknown, 'family-file headings not in BLOCK_TYPES').toEqual([]);
  });

  it('family files are selection sheets, not field references', () => {
    // The CLI prints the contract; the files stay short enough to read whole.
    for (const file of familyFiles) {
      const lines = readFileSync(join(BLOCKS_DIR, file), 'utf8').split('\n').length;
      const cap = file === 'architecture.md' ? 95 : 75;
      expect(lines, `${file} is ${lines} lines; cap ${cap}`).toBeLessThanOrEqual(cap);
    }
  });

  it('each block sits in the family file its catalog family names', () => {
    // The catalog family `charts` is the `charts-overviews.md` sheet.
    const fileOf = (family: string): string =>
      family === 'charts' ? 'charts-overviews.md' : `${family}.md`;
    for (const t of BLOCK_TYPES) {
      const file = fileOf(BLOCK_FAMILY[t]);
      expect(familyFiles, `family file for ${t}`).toContain(file);
      const md = readFileSync(join(BLOCKS_DIR, file), 'utf8');
      expect(headingNames(md), `${file} documents \`${t}\``).toContain(t);
    }
  });

  it('no family heading names an alias', () => {
    for (const file of familyFiles) {
      const names = headingNames(readFileSync(join(BLOCKS_DIR, file), 'utf8'));
      for (const alias of Object.keys(BLOCK_ALIASES)) {
        expect(names, `${file} heading names alias \`${alias}\``).not.toContain(alias);
      }
    }
  });

  it('the hand-written block index is gone', () => {
    // `chiltepin block` prints the families and the aliases from the registry.
    expect(existsSync(join(BLOCKS_DIR, 'INDEX.md'))).toBe(false);
  });

  it('skill count strings match BLOCK_TYPES.length (drift guard)', () => {
    const n = BLOCK_TYPES.length;
    const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    expect(skill).toContain(`${n} block types`);
    expect(skill).toContain(`lists all ${n}`);
  });

  it('no skill file points at the deleted contract.md or the old install paths', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : e.name.endsWith('.md')
            ? [join(dir, e.name)]
            : [],
      );
    for (const f of walk(SKILL_DIR)) {
      const md = readFileSync(f, 'utf8');
      expect(md, `${f} mentions contract.md`).not.toContain('contract.md');
      expect(md, `${f} mentions .chiltepin/skill`).not.toContain('.chiltepin/skill');
      expect(md, `${f} mentions chiltepin install`).not.toContain('chiltepin install');
      expect(md, `${f} mentions chiltepin template`).not.toContain('chiltepin template');
    }
  });

  it('every family file is in the canonical stitch list', () => {
    const listed = SKILL_REFERENCE_FILES.filter((f) => f.includes('reference/blocks/')).map((f) =>
      f.slice(f.lastIndexOf('/') + 1),
    );
    expect([...listed].sort()).toEqual([...familyFiles].sort());
  });

  it('recipes.md and style-ste.md sit in the stitch list, in order', () => {
    const lastFamily = Math.max(
      ...SKILL_REFERENCE_FILES.flatMap((f, i) => (f.includes('reference/blocks/') ? [i] : [])),
    );
    expect(SKILL_REFERENCE_FILES[lastFamily + 1]).toBe('reference/recipes.md');
    const idx = (f: string): number => SKILL_REFERENCE_FILES.indexOf(`reference/${f}`);
    expect(idx('style-ste.md')).toBeGreaterThan(idx('intake.md'));
    expect(idx('style-ste.md')).toBe(idx('organizing.md') + 1);
  });

  it('worked derivations carry reasoning only — no typed block to copy', () => {
    // The derivations replaced ten finished YAML documents that agents filled
    // in as templates. A fenced block here would bring that failure back.
    const dir = join(SKILL_DIR, 'reference/derivations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) {
      const md = readFileSync(join(dir, f), 'utf8');
      expect(md, `${f} holds a fenced block`).not.toMatch(/^\s*(```|~~~)/m);
    }
  });

  it('every listed reference file exists', () => {
    for (const f of SKILL_REFERENCE_FILES) {
      expect(existsSync(join(SKILL_DIR, f)), `missing ${f}`).toBe(true);
    }
  });
});
