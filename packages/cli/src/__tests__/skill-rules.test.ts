/**
 * Pins the skill rules that make a doc great, not merely valid. Each test
 * guards a failure seen in the eval corpus:
 *
 * - every doc ended on a "What we assumed" list — the skill asked for it;
 * - the hub grew past what an agent reads on every task;
 * - the routing table sent part-of to `composition` and topology to `graph`;
 * - the worked derivations shared one skeleton, invented company names, and
 *   taught topic-label headings, so every generated doc copied them;
 * - authors painted every item with `accent`, because nothing said it marks
 *   one focus.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_TYPES, describeBlockSchema, type FieldNode } from 'chiltepin-core';
import { skillDir } from '../commands/init.js';

const SKILL_DIR = skillDir();
const read = (rel: string): string => readFileSync(join(SKILL_DIR, rel), 'utf8');

function walkMd(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkMd(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

const words = (md: string): number => md.split(/\s+/).filter((w) => w.length > 0).length;

describe('the hub (SKILL.md)', () => {
  const skill = read('SKILL.md');

  it('opens with the target a great doc meets', () => {
    expect(skill).toContain('## What a great doc looks like');
    expect(skill).toContain('the answer,\nthen the number or limit that forces it');
    expect(skill).toContain('The doc ends on what happens next');
  });

  it('step 6 runs `chiltepin review` and checks the ending', () => {
    const step6 = skill.slice(skill.indexOf('6. **REVIEW'), skill.indexOf('7. **HANDOFF'));
    expect(step6).toContain('chiltepin review <file>');
    expect(step6).toContain('The last section says what to do or decide next');
    expect(step6).toContain('The opening gives the answer');
  });

  it('stays a fast path: the hub is at most 2,200 words', () => {
    // Measured 2,673 before the 2026-10 rewrite; the routing table is now
    // question → family file → trap, and the detail lives in the references.
    expect(words(skill)).toBeLessThanOrEqual(2200);
  });

  it('every reference path the hub names exists', () => {
    for (const m of skill.matchAll(/`(reference\/[a-z/-]+\.md)`/g)) {
      expect(existsSync(join(SKILL_DIR, m[1] ?? '')), `${m[1]}`).toBe(true);
    }
  });

  it('routes part-of to tree, proportions to treemap, and topology away from graph', () => {
    const row = (q: string): string => skill.split('\n').find((l) => l.startsWith(`| ${q}`)) ?? '';
    expect(row('What is it made of?')).toContain('part-of → `tree`');
    expect(row('What is it made of?')).toContain('`treemap` (more than 6 parts)');
    expect(row('What is it made of?')).toContain('an AND of access checks → `composition`');
    expect(row('What runs where')).toContain('topology → `block`');
    expect(row('What runs where')).toContain('Not `graph`');
  });

  it('routes design systems, strategy, and branching', () => {
    for (const t of ['palette', 'typescale', 'dodont', 'inventory', 'swot', 'wardley', 'scenarios', 'okr', 'persona', 'venn', 'gitgraph']) {
      expect(skill, t).toContain(`\`${t}\``);
    }
  });

  it('states the same paragraph caps as the prose lint (6 descriptive, 3 procedural)', () => {
    expect(skill).toContain('paragraph holds 6 sentences at most and a procedure 3');
    expect(read('reference/style-ste.md')).toContain('6 sentences at most; procedural paragraphs, 3');
  });
});

describe('the ending rule', () => {
  it('no skill file asks for a closing assumptions list', () => {
    for (const f of walkMd(SKILL_DIR)) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/What we assumed/i);
    }
  });

  it('every recipe names how its doc ends', () => {
    const recipes = read('reference/recipes.md');
    const sections = recipes.split(/^## /m).slice(1);
    expect(sections.length).toBeGreaterThanOrEqual(11);
    for (const s of sections) expect(s, s.split('\n')[0]).toContain('Ends on:');
  });
});

describe('worked derivations', () => {
  const dir = join(SKILL_DIR, 'reference/derivations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const headings = (f: string): string[] =>
    [...readFileSync(join(dir, f), 'utf8').matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '');

  it('do not share one skeleton', () => {
    const skeletons = new Set(files.map((f) => headings(f).join(' | ')));
    expect(skeletons.size, 'distinct section sequences').toBe(files.length);
    const endings = new Set(files.map((f) => headings(f).at(-1)));
    expect(endings.size, 'distinct last sections').toBeGreaterThanOrEqual(4);
  });

  it('name no invented company or product', () => {
    const invented = ['Harlow', 'Caravel', 'Plotline', 'Skerry', 'Fenwick', 'Marram', 'Vaultic', 'Loxley', 'Terrastride', 'Quillfeed', 'Hollybank', 'Nocturne', 'Loamly'];
    for (const f of files) {
      const md = readFileSync(join(dir, f), 'utf8');
      for (const name of invented) expect(md, `${f} names ${name}`).not.toContain(name);
    }
  });

  it('each names its reader and writes its opening before the blocks', () => {
    for (const f of files) {
      const md = readFileSync(join(dir, f), 'utf8');
      expect(md, `${f} reader`).toMatch(/\bread(er|ers|s)\b/i);
      expect(md, `${f} opening`).toMatch(/[Oo]pening/);
    }
  });
});

describe('the Focus table (kit.md)', () => {
  /** True when the schema has an `accent` enum of the legacy colour names, anywhere. */
  function hasAccentEnum(node: FieldNode, name = ''): boolean {
    if (node.kind === 'enum') return name === 'accent' && node.options.includes('red') && node.options.includes('navy');
    if (node.kind === 'object') return node.fields.some((f) => hasAccentEnum(f.node, f.name));
    if (node.kind === 'array') return hasAccentEnum(node.element, name);
    if (node.kind === 'union') return node.arms.some((a) => hasAccentEnum(a, name));
    return false;
  }

  it('names every block that takes an accent, and says it marks one focus', () => {
    const kit = read('reference/kit.md');
    const table = kit.slice(kit.indexOf('## Focus'), kit.indexOf('## Composing AI systems'));
    expect(table).toContain('`accent` is not a colour');
    for (const t of BLOCK_TYPES) {
      if (!hasAccentEnum(describeBlockSchema(t))) continue;
      expect(table, `Focus table row for ${t}`).toContain(`\`${t}\``);
    }
  });

  it('keeps a `no` on the normal path as a plain edge', () => {
    expect(read('reference/kit.md')).toContain('A `no` on the normal path stays `->`');
  });

  it('splits at a hand-off, never inside a loop', () => {
    expect(read('reference/kit.md')).toContain('Split a flow at a hand-off, never inside a loop');
  });
});
