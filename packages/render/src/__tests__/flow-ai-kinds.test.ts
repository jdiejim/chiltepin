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
\`\`\`
`;

describe('flow: AI workflow kinds', () => {
  const doc = parseDocument(SRC, 'flow-ai');
  it('validates with the new kinds', () => {
    expect(validateDocument(doc, 'flow-ai.md').filter((d) => d.level === 'error')).toEqual([]);
  });
  it('draws a chip per AI kind and lists each in the legend', () => {
    const html = renderDocument(doc);
    for (const chip of ['AGENT', 'LLM', 'TOOL', 'HUMAN', 'MEMORY']) {
      expect(html).toContain(`class="blk-chip t-sub">${chip}</text>`);
      expect(html).toContain(`${chip} ·`);
    }
    expect(html).toContain('stroke-dasharray="4 3"'); // the human gate is a dashed boundary
  });
  it('rejects a kind outside the vocabulary', () => {
    const bad = parseDocument(SRC.replace('kind: llm', 'kind: robot'), 'flow-bad');
    expect(validateDocument(bad, 'flow-bad.md').some((d) => d.level === 'error')).toBe(true);
  });
});
