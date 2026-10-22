/**
 * The review dialog's change-summary engine: exact-content pairing, the
 * edited/added/removed leftover rules, reorder reporting, and labels.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument, templateBody } from 'chiltepin-core';
import { changesSummary, segmentLabel } from './changes.js';

const META = '```meta\ntitle: T\n```\n';
const ALPHA = '```callout\ntone: note\ntitle: Alpha\n```\n';
const BETA = '```callout\ntone: tip\ntitle: Beta\n```\n';
const BASE = `${META}\nIntro prose.\n\n${ALPHA}\n${BETA}`;

describe('changesSummary', () => {
  it('identical sources → no changes', () => {
    expect(changesSummary(BASE, BASE, 'd')).toEqual([]);
  });

  it('formatting-only difference (trailing whitespace) → empty summary', () => {
    expect(changesSummary(BASE, `${BASE}\n\n`, 'd')).toEqual([]);
  });

  it('pure edit pairs the leftover same-kind segments in order', () => {
    const cur = BASE.replace('title: Alpha', 'title: Alpha v2');
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'callout', label: 'Alpha v2', change: 'edited' },
    ]);
  });

  it('pure add reports the new segment only', () => {
    const cur = `${BASE}\n\`\`\`divider\ntitle: Part two\n\`\`\`\n`;
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'divider', label: 'Part two', change: 'added' },
    ]);
  });

  it('pure remove reports the missing segment with its baseline label', () => {
    const cur = BASE.replace(`\n${BETA}`, '');
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'callout', label: 'Beta', change: 'removed' },
    ]);
  });

  it('mixed edit + add + remove, ordered by position with removed last', () => {
    const cur = `${META}\nIntro prose, revised.\n\n${ALPHA}\n\`\`\`divider\ntitle: New part\n\`\`\`\n`;
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'markdown', label: 'Intro prose, revised.', change: 'edited' },
      { kind: 'divider', label: 'New part', change: 'added' },
      { kind: 'callout', label: 'Beta', change: 'removed' },
    ]);
  });

  it('a pure reorder yields ZERO edited items and ONE reordered item', () => {
    const cur = `${META}\nIntro prose.\n\n${BETA}\n${ALPHA}`;
    const items = changesSummary(BASE, cur, 'd');
    expect(items.filter((i) => i.change !== 'reordered')).toEqual([]);
    // One item per displaced segment (not a minimal move set): Alpha's exact
    // match sits before Beta's already-consumed baseline slot.
    expect(items).toEqual([{ kind: 'callout', label: 'Alpha', change: 'reordered' }]);
  });

  it('duplicate content pairs greedily — adding a copy is one added item', () => {
    const cur = `${BASE}\n${ALPHA}`;
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'callout', label: 'Alpha', change: 'added' },
    ]);
  });

  it('an edit does not cross kinds — a swapped type reads as add + remove', () => {
    const cur = BASE.replace(BETA, '```divider\ntitle: Beta\n```\n');
    expect(changesSummary(BASE, cur, 'd')).toEqual([
      { kind: 'divider', label: 'Beta', change: 'added' },
      { kind: 'callout', label: 'Beta', change: 'removed' },
    ]);
  });
});

describe('segmentLabel', () => {
  const seg = (src: string): ReturnType<typeof parseDocument>['segments'][number] =>
    parseDocument(src, 'd').segments[0] as ReturnType<typeof parseDocument>['segments'][number];

  it('uses the block title from data', () => {
    expect(segmentLabel(seg(ALPHA))).toBe('Alpha');
  });

  it('falls back to the BLOCK_LABELS type name when untitled', () => {
    expect(segmentLabel(seg('```divider\nid: x\n```\n'))).toBe('Section divider');
  });

  it('falls back to the type name when the body fails to parse', () => {
    expect(segmentLabel(seg('```callout\n: broken [\n```\n'))).toBe('Callout');
  });

  it('prose shows a ~40-char snippet with collapsed whitespace', () => {
    const long = 'word '.repeat(20).trim();
    const label = segmentLabel(seg(`${long}\n`));
    expect(label.endsWith('…')).toBe(true);
    expect(label.length).toBe(41);
    expect(segmentLabel(seg('Short  line.\n'))).toBe('Short line.');
  });

  it('template bodies parse and label like any block', () => {
    expect(segmentLabel(seg('```callout\n' + templateBody('callout') + '\n```\n'))).toBe(
      'Replays past 48 hours bill twice',
    );
  });
});
