/**
 * W_INLINE_UNKNOWN and W_HIGHLIGHT_OVERUSE: the inline-styling lint reads
 * prose (never fenced code) and the block fields that render inline
 * Markdown, through the same `lintDocument` that `check` and Studio run.
 * Also: an edit tool writes styled text back without changing it.
 */

import { describe, expect, it } from 'vitest';
import { lintDocument } from '../lintDocument.js';
import { lintInline } from '../inlineLint.js';
import { parseDocument } from '../parser.js';
import { replaceProse, setYamlPath } from '../edit.js';
import { parseBlockBody } from '../yaml.js';

const lint = (md: string) => lintInline(parseDocument(md, 't'), 't.md');
const codes = (md: string) => lint(md).map((d) => d.code);

describe('W_INLINE_UNKNOWN in prose', () => {
  it('flags an unknown icon with its position and a did-you-mean', () => {
    const [d] = lint('# T\n\nRuns fine :warning: here.\n');
    expect(d).toMatchObject({
      code: 'W_INLINE_UNKNOWN',
      level: 'warn',
      line: 3,
      column: 11,
      value: ':warning:',
    });
    expect(d?.suggestions?.[0]).toBe(':warn:');
    expect(d?.message).toContain('Unknown icon `:warning:`');
  });

  it('suggests the icon an emoji shortcode means', () => {
    expect(lint('Done :white_check_mark:\n')[0]?.suggestions).toEqual([':check:']);
  });

  it('reads headings and table rows, never fenced code or code spans', () => {
    const md = [
      '## Launch :rokcet:',
      '',
      '| a | b |',
      '|---|---|',
      '| :nope-icon: | x |',
      '',
      '```md',
      'An example: :smile: [x]{.purple}',
      '```',
      '',
      'Inline `:smile:` code and 10:30:00 and a:b:c.',
    ].join('\n');
    const found = lint(md);
    expect(found.map((d) => [d.line, d.value])).toEqual([
      [1, ':rokcet:'],
      [5, ':nope-icon:'],
    ]);
    expect(found[0]?.suggestions).toEqual([':rocket:']);
  });

  it('names the span problem: unknown class, status without .pill, a hue on a chip, two styles', () => {
    const found = lint(
      '[a]{.purple} [b]{.done} [c]{.pill .green} [d]{.blue .teal} [ok]{.pill .done} [k]{.kbd}\n',
    );
    expect(found.map((d) => d.message)).toEqual([
      'Unknown span class `.purple` in `[a]{.purple}`. The text shows without a style.',
      '`.done` is a chip status. It needs `.pill`.',
      'A chip does not take a hue (`.green` in `[c]{.pill .green}`). The status word carries the meaning.',
      '`[d]{.blue .teal}` names two styles. A span takes one.',
    ]);
    expect(found[1]?.suggestions).toEqual(['{.pill .done}']);
  });

  it('is silent for valid styling and for text that only looks like it', () => {
    const md =
      'A ==fact==, [Beta]{.pill}, [teal]{.teal}, [Esc]{.kbd}, :check:, [x] {y}, [a](https://h/:x:), std::vector::x.\n';
    expect(lint(md)).toEqual([]);
  });
});

describe('W_INLINE_UNKNOWN in block fields', () => {
  it('reads every inline-Markdown field: callout body, prose items, scqa, table cells', () => {
    const md = [
      '```callout',
      'tone: tip',
      'body: "Use :nope-a: here."',
      '```',
      '',
      '```prose',
      'blocks:',
      '  - { type: ul, items: ["[x]{.purple}"] }',
      '```',
      '',
      '```scqa',
      'answer: "Yes :nope-b:"',
      '```',
      '',
      '```table',
      'columns: [A, B]',
      'rows:',
      '  - [ok, ":nope-c:"]',
      '  - [ok, { v: "[y]{.done}", tone: pos }]',
      '```',
    ].join('\n');
    const found = lint(md);
    expect(found.map((d) => d.value)).toEqual([
      ':nope-a:',
      '[x]{.purple}',
      ':nope-b:',
      ':nope-c:',
      '[y]{.done}',
    ]);
    expect(found[0]?.line).toBe(3);
    expect(found[3]?.line).toBe(18);
  });

  it('leaves plain labels alone: a node label is not inline Markdown', () => {
    const md =
      '```flow\nnodes:\n  - { id: a, label: ":nope:" }\n  - { id: b, label: "[x]{.purple}" }\nedges:\n  - a -> b\n```\n';
    expect(codes(md)).toEqual([]);
  });

  it('flags an unknown list or drivers icon, with the nearest name', () => {
    const md =
      '```list\nstyle: icon\nitems:\n  - { lead: Ship, icon: rockett }\n  - { lead: Fine, icon: rocket }\n```\n';
    const found = lint(md);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      code: 'W_INLINE_UNKNOWN',
      value: 'rockett',
      line: 4,
      suggestions: ['rocket'],
    });
    expect(found[0]?.message).toBe(
      'Unknown icon `rockett`. The list draws an empty ring in its place.',
    );
  });
});

describe('W_HIGHLIGHT_OVERUSE', () => {
  it('warns once at the third highlight of a section', () => {
    const md = '## One\n\n==a== and ==b==.\n\nThen ==c== and ==d==.\n';
    const found = lint(md);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      code: 'W_HIGHLIGHT_OVERUSE',
      line: 5,
      column: 6,
      value: '==c==',
    });
    expect(found[0]?.message).toBe(
      '4 highlights in one section. A highlight marks the one fact the reader must not miss.',
    );
  });

  it('counts per section, and counts the highlights in block fields too', () => {
    expect(codes('## One\n\n==a== ==b==\n\n## Two\n\n==c== ==d==\n')).toEqual([]);
    const md = '## One\n\n==a== ==b==\n\n```callout\nbody: "==c=="\n```\n';
    expect(codes(md)).toEqual(['W_HIGHLIGHT_OVERUSE']);
  });

  it('does not count a highlight in code', () => {
    expect(codes('==a== ==b== `==c==`\n\n```\n==d==\n```\n')).toEqual([]);
  });
});

describe('wiring and round trips', () => {
  it('lintDocument carries both codes, so check and Studio report them', () => {
    const doc = parseDocument('## S\n\n:nope: ==a== ==b== ==c==\n', 't');
    const found = lintDocument(doc, 't.md').map((d) => d.code);
    expect(found).toContain('W_INLINE_UNKNOWN');
    expect(found).toContain('W_HIGHLIGHT_OVERUSE');
  });

  it('a structured edit writes styled text back unchanged (the YAML quoting is the writer’s job)', () => {
    const value = ':check: [Beta]{.pill .current} ==now== [Esc]{.kbd}';
    const raw = setYamlPath('tone: tip\nbody: old', ['body'], value);
    const back = parseBlockBody(raw);
    expect(back.ok && (back.data as { body: string }).body).toBe(value);
    const rows = setYamlPath('rows:\n  - [a, b]', ['rows', 0, 1], ':x:');
    const parsed = parseBlockBody(rows);
    expect(parsed.ok && (parsed.data as { rows: string[][] }).rows[0]?.[1]).toBe(':x:');
  });

  it('a prose edit keeps the text byte for byte', () => {
    const src = 'Intro.\n\n```callout\nbody: x\n```\n';
    const doc = parseDocument(src, 't');
    const text = 'Now ==this== and [Beta]{.pill} :rocket:\n\\==not== `:x:`';
    const out = replaceProse(src, doc, 0, text);
    expect(out.startsWith(text)).toBe(true);
  });
});
