import { describe, expect, it } from 'vitest';
import { resolveSwimlanePhase, swimlanePlacements } from '../blocks/swimlaneLayout.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const lanes = [{ label: 'Ops' }, { label: 'Lead' }];

describe('swimlane phase bands', () => {
  it('a phase with no `to` ends the column before the next phase starts', () => {
    const { bands } = swimlanePlacements({
      lanes,
      phases: [
        { label: 'Admit', from: 1 },
        { label: 'Produce', from: 2, to: 3 },
        { label: 'Release', from: 4 },
      ],
      steps: [
        { id: 'a', lane: 0, col: 1 },
        { id: 'b', lane: 1, col: 5 },
      ],
    });
    expect(bands).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 3 },
      { from: 4, to: 5 },
    ]);
  });

  it('with derived columns, a step naming its phase stays under that band, and bands never overlap', () => {
    const phases = [
      { label: 'Detect', from: 1 },
      { label: 'Mitigate', from: 1 },
      { label: 'Learn', from: 1 },
    ];
    const steps = [
      { id: 'page', lane: 'Ops', phase: 'Detect' },
      { id: 'triage', lane: 'Ops', phase: 'detect' },
      { id: 'sev', lane: 'Lead', phase: 'Mitigate' },
      { id: 'fix', lane: 'Ops', phase: 'Mitigate' },
      { id: 'verify', lane: 'Lead', phase: 'Mitigate' },
      { id: 'macro', lane: 'Lead', phase: 'Mitigate' },
      { id: 'pm', lane: 'Lead', phase: 'Learn' },
    ];
    const links = [
      { from: 'page', to: 'triage' },
      { from: 'triage', to: 'sev' },
      { from: 'sev', to: 'fix' },
      { from: 'fix', to: 'verify' },
      { from: 'sev', to: 'macro' },
      { from: 'verify', to: 'pm' },
    ];
    const { placements, bands, derived } = swimlanePlacements({ lanes, phases, steps, links });
    expect(derived).toBe(true);
    steps.forEach((st, i) => {
      const band = bands[resolveSwimlanePhase(st.phase, phases) ?? -1];
      expect(placements[i]?.col).toBeGreaterThanOrEqual(band?.from ?? Infinity);
      expect(placements[i]?.col).toBeLessThanOrEqual(band?.to ?? -Infinity);
    });
    for (let k = 1; k < bands.length; k++) expect(bands[k]?.from).toBe((bands[k - 1]?.to ?? 0) + 1);
  });

  it('the schema accepts `phase` on a step', () => {
    const md =
      '```swimlane\nlanes: [Ops]\nphases:\n  - { label: Detect, from: 1 }\nsteps:\n  - { id: a, lane: Ops, label: Page, phase: Detect }\n```\n';
    const errors = validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.level === 'error');
    expect(errors).toEqual([]);
  });
});
