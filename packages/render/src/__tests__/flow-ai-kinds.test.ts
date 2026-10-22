import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from 'chiltepin-core';
import { renderDocument } from '../index.js';

const SRC = `\`\`\`flow
title: Support answer workflow
nodes:
  - { id: q, col: 1, row: 1, kind: start, label: Question }
  - { id: kb, col: 2, row: 1, kind: tool, label: Search docs }
  - { id: draft, col: 3, row: 1, kind: llm, label: Draft answer }
  - { id: check, col: 4, row: 1, kind: decision, label: Grounded? }
  - { id: review, col: 5, row: 1, kind: human, label: Agent review }
  - { id: mem, col: 3, row: 2, kind: memory, label: Case history }
  - { id: bot, col: 2, row: 2, kind: agent, label: Triage agent }
  - { id: guard, col: 4, row: 2, kind: guard, label: "Output guard\\nclaude-haiku-4-5" }
  - { id: judge, col: 5, row: 2, kind: eval, label: "Grounding judge\\nrubric v3" }
  - { id: sent, col: 6, row: 1, kind: end, label: Sent }
edges:
  - q -> bot
  - bot -> kb
  - kb -> draft
  - mem --> draft
  - draft -> check
  - check -> review: "yes"
  - check -x-> draft: "no"
  - review -> sent
  - draft -> guard
  - guard -> judge
\`\`\`
`;

/** Each AI kind, its chip, and the family hue it draws in (`blockStyle.ts`). */
const KINDS: ReadonlyArray<readonly [string, string]> = [
  ['AGENT', 'violet'],
  ['LLM', 'violet'],
  ['TOOL', 'blue'],
  ['HUMAN', 'rose'],
  ['MEMORY', 'amber'],
  ['GUARD', 'green'],
  ['EVAL', 'violet'],
];

describe('flow: AI workflow kinds', () => {
  const doc = parseDocument(SRC, 'flow-ai');
  it('validates with the AI kinds, guard and eval included', () => {
    expect(validateDocument(doc, 'flow-ai.md').filter((d) => d.level === 'error')).toEqual([]);
  });
  it('draws a chip per AI kind in its family hue, and lists each in the legend with that hue', () => {
    const html = renderDocument(doc);
    for (const [chip, hue] of KINDS) {
      expect(html, chip).toContain(`class="blk-chip t-sub c-${hue}">${chip}</text>`);
      expect(html, chip).toMatch(new RegExp(`<span class="lg-chip t-eyebrow c-${hue}( lg-dashed)?">${chip}</span>`));
    }
    expect(html).toContain('stroke-dasharray="4 3"'); // the human gate is a dashed boundary
    expect(html).toContain('lg-chip t-eyebrow c-rose lg-dashed">HUMAN'); // …and its legend chip says so
  });
  it('fills an AI step with its hue tint; plain steps stay paper', () => {
    const html = renderDocument(doc);
    const node = (id: number): string => html.slice(html.indexOf(`data-bp="nodes.${id}"`), html.indexOf(`data-bp="nodes.${id + 1}"`));
    expect(node(1)).toContain('fill="var(--hue-blue-tint)"'); // tool
    expect(node(2)).toContain('fill="var(--hue-violet-tint)"'); // llm
    expect(node(5)).toContain('fill="var(--hue-amber-tint)"'); // memory
    expect(node(3)).not.toContain('--hue-'); // decision
  });
  it('draws guard and eval as the agent card: their glyph, the name, the model chip', () => {
    const html = renderDocument(doc);
    const guard = html.slice(html.indexOf('data-bp="nodes.7"'), html.indexOf('data-bp="nodes.8"'));
    expect(guard).toContain('class="al-name">Output guard</text>');
    expect(guard).toContain('class="al-chip">claude-haiku-4-5</text>');
    expect(guard).toContain('stroke="var(--hue-green)"'); // the shield
    const judge = html.slice(html.indexOf('data-bp="nodes.8"'), html.indexOf('data-bp="nodes.9"'));
    expect(judge).toContain('class="al-name">Grounding judge</text>');
    expect(judge).toContain('class="al-chip">rubric v3</text>');
    expect(judge).toContain('stroke="var(--hue-violet)"'); // the gauge
  });
  it('rejects a kind outside the vocabulary', () => {
    const bad = parseDocument(SRC.replace('kind: llm', 'kind: robot'), 'flow-bad');
    expect(validateDocument(bad, 'flow-bad.md').some((d) => d.level === 'error')).toBe(true);
  });
});
