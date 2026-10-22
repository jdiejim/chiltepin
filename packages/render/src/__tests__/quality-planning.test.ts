/**
 * `audit`, `checklist`, `modelcard`, `chevrons`, `roadmap` renderers: the
 * catalog template renders, the derived numbers (severity counts, pass
 * rate) are right, the geometry follows the data (chip spans, lanes, one
 * polygon per step), and no renderer carries a hex colour.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument, type BlockDataMap, type BlockType } from 'chiltepin-core';
import { renderAudit } from '../blocks/audit.js';
import { renderChecklist, checklistTotals } from '../blocks/checklist.js';
import { renderModelcard } from '../blocks/modelcard.js';
import { renderChevrons } from '../blocks/chevrons.js';
import { renderRoadmap } from '../blocks/roadmap.js';

/** The parsed data of a block type's catalog template. */
function templateData<K extends BlockType>(type: K): BlockDataMap[K] {
  const doc = parseDocument(BLOCK_TEMPLATES[type], 'catalog');
  const seg = doc.segments.find((s) => s.kind === type);
  if (seg === undefined || !('data' in seg)) throw new Error(`no ${type} segment in the catalog template`);
  if ('parseError' in seg && seg.parseError !== undefined) throw new Error(`${type} template does not parse: ${String(seg.parseError)}`);
  return seg.data as BlockDataMap[K];
}

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

describe('audit', () => {
  const data = templateData('audit');

  it('renders the catalog template with a head, a count strip and one row per finding', () => {
    const html = renderAudit(data);
    const root = parse(html);
    expect(html).toContain('Security review — payments service');
    expect(root.querySelectorAll('tbody[data-bl="findings"] > tr')).toHaveLength(4);
    expect(html).not.toMatch(NO_HEX);
  });

  it('sorts critical first and keeps the authored index on each row', () => {
    const root = parse(renderAudit(data));
    const rows = root.querySelectorAll('tbody[data-bl="findings"] > tr');
    expect(rows.map((r) => r.querySelector('.rk-sev')?.text)).toEqual(['critical', 'high', 'medium', 'info']);
    // F2 is the critical one and was authored second.
    expect(rows[0]?.getAttribute('data-bp')).toBe('findings.1');
    expect(rows[0]?.querySelector('.au-id')?.text).toBe('F2');
  });

  it('counts findings per severity, in severity order, dropping empty buckets', () => {
    const root = parse(renderAudit(data));
    const chips = root.querySelectorAll('.au-count');
    expect(chips.map((c) => c.text.replace(/\s+/g, ' ').trim())).toEqual(['1 critical', '1 high', '1 medium', '1 info']);
    expect(root.querySelector('.au-total')?.text).toBe('4 findings');
  });

  it('keeps stable author order within one severity and tints the status chips', () => {
    const html = renderAudit({
      findings: [
        { title: 'b', severity: 'low', status: 'open' },
        { title: 'a', severity: 'low', status: 'fixed' },
        { title: 'c', severity: 'high', status: 'fixing' },
      ],
    });
    const root = parse(html);
    const rows = root.querySelectorAll('tbody > tr');
    expect(rows.map((r) => r.getAttribute('data-bp'))).toEqual(['findings.2', 'findings.0', 'findings.1']);
    expect(root.querySelector('.au-st-fixing')).not.toBeNull();
    expect(root.querySelector('.au-st-open')).not.toBeNull();
    // No finding carries an id / evidence / fix / owner: those columns are not drawn.
    expect(root.querySelectorAll('thead th').map((t) => t.text)).toEqual(['Severity', 'Finding', 'Status']);
  });
});

describe('checklist', () => {
  const data = templateData('checklist');

  it('renders the groups with one row per item and the verdict chips', () => {
    const html = renderChecklist(data);
    const root = parse(html);
    expect(root.querySelectorAll('.cl-group')).toHaveLength(2);
    expect(root.querySelectorAll('.cl-item')).toHaveLength(5);
    expect(root.querySelectorAll('.cl-v-pass')).toHaveLength(2);
    expect(root.querySelectorAll('.cl-v-fail')).toHaveLength(1);
    expect(root.querySelector('.cl-evidence')?.text).toBe('grafana/search-indexer');
    expect(html).not.toMatch(NO_HEX);
  });

  it('derives the pass rate for the catalog template: 2 pass, 1 partial, 1 fail, 1 n/a → 63%', () => {
    const items = (data.groups ?? []).flatMap((g) => g.items);
    const t = checklistTotals(items);
    expect(t).toMatchObject({ pass: 2, fail: 1, partial: 1, pending: 0, na: 1 });
    expect(t.rate).toBeCloseTo(62.5, 5);
    const foot = parse(renderChecklist(data)).querySelector('.cl-foot');
    expect(foot?.text).toContain('2 pass · 1 fail · 1 partial · 1 n/a');
    expect(foot?.querySelector('.cl-rate')?.text).toBe('pass rate 63%');
  });

  it('shows a dash for the rate when nothing applies', () => {
    const html = renderChecklist({ items: [{ item: 'x', status: 'na' }] });
    expect(parse(html).querySelector('.cl-rate')?.text).toBe('pass rate —');
  });
});

describe('modelcard', () => {
  const data = templateData('modelcard');

  it('renders the head, the spec strip and the sections in order', () => {
    const html = renderModelcard(data);
    const root = parse(html);
    expect(root.querySelector('.evc-name')?.text).toBe('support-intent-v3');
    expect(html).toContain('3.2.0');
    expect(root.querySelectorAll('.mc-cell')).toHaveLength(4);
    expect(root.querySelectorAll('.evc-section').map((s) => s.text)).toEqual([
      'Intended use',
      'Out of scope',
      'Training data',
      'Metrics',
      'Limitations',
    ]);
    expect(html).not.toMatch(NO_HEX);
  });

  it('renders the metrics table with 2 rows, values right-aligned', () => {
    const root = parse(renderModelcard(data));
    const rows = root.querySelectorAll('tbody[data-bl="metrics"] > tr');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.querySelector('td.mc-value')?.text)).toEqual(['0.91', '38 ms']);
    expect(rows[1]?.querySelectorAll('td').map((c) => c.text)).toEqual(['Latency p95', '38 ms', 'prod', 'CPU, batch 1']);
  });
});

describe('chevrons', () => {
  const data = templateData('chevrons');

  it('draws one polygon per step and marks the current one with the accent', () => {
    const html = renderChevrons(data);
    const root = parse(html);
    const steps = root.querySelectorAll('g[data-bl="steps"] > g');
    expect(steps).toHaveLength(5);
    expect(root.querySelectorAll('polygon')).toHaveLength(5);
    const current = root.querySelectorAll('g.ch-current');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('data-bp')).toBe('steps.2');
    expect(current[0]?.querySelector('polygon')?.getAttribute('fill')).toBe('var(--accent)');
    expect(root.querySelectorAll('g.ch-done')).toHaveLength(2);
    expect(root.querySelectorAll('g.ch-todo')).toHaveLength(2);
    expect(html).toContain('>postmortem in 5 days<');
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toContain('NaN');
  });

  it('steps rightward with the point nesting into the next notch, in one row up to eight', () => {
    const root = parse(renderChevrons(data));
    const xs = root.querySelectorAll('polygon').map((p) => Number(p.getAttribute('points')?.split(' ')[0]?.split(',')[0]));
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1] ?? 0);
    const ys = root.querySelectorAll('polygon').map((p) => Number(p.getAttribute('points')?.split(' ')[0]?.split(',')[1]));
    expect(new Set(ys).size).toBe(1);
  });

  it('wraps to a second row past eight steps and keeps the viewBox at eight widths', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({ label: `Step ${i + 1}` }));
    const html = renderChevrons({ steps });
    const root = parse(html);
    const ys = root.querySelectorAll('polygon').map((p) => Number(p.getAttribute('points')?.split(' ')[0]?.split(',')[1]));
    expect(new Set(ys).size).toBe(2);
    const vb = root.querySelector('svg')?.getAttribute('viewBox')?.split(' ').map(Number) ?? [];
    expect(vb[2]).toBeLessThan(1600);
    // No current: everything is outlined, no accent spent.
    expect(html).not.toContain('var(--accent)');
  });

  it('cuts a long label with an ellipsis and keeps the full text in a title', () => {
    const long = 'A very long step label that cannot possibly fit in the three lines a chevron of this width can hold, however wide';
    const html = renderChevrons({ steps: [{ label: long }, { label: 'Short' }] });
    expect(html).toContain('…');
    expect(html).toContain(`<title>${long}</title>`);
  });
});

describe('roadmap', () => {
  const data = templateData('roadmap');

  it('renders the catalog template: one column per period, one row per theme, one chip per item', () => {
    const html = renderRoadmap(data);
    const root = parse(html);
    expect(root.querySelectorAll('g[data-bl="periods"] text').map((t) => t.text)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(root.querySelectorAll('text.rm-theme').map((t) => t.text)).toEqual(['Reliability', 'Developer experience', 'Cost']);
    expect(root.querySelectorAll('g.rm-item')).toHaveLength(6);
    expect(root.querySelector('g.rm-now')).not.toBeNull();
    expect(root.querySelectorAll('.lg-item').map((l) => l.text)).toEqual(['done', 'current — in progress', 'next / planned', 'risk', 'now']);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toContain('NaN');
  });

  it('spans a Q1–Q2 item across two columns', () => {
    const root = parse(renderRoadmap(data));
    const w = (bp: string): number => Number(root.querySelector(`g[data-bp="${bp}"] rect`)?.getAttribute('width'));
    // items.0 spans Q1–Q2; items.1 sits in Q3 only.
    expect(w('items.0') / w('items.1')).toBeCloseTo(2, 0);
    expect(w('items.0')).toBeGreaterThan(w('items.1') * 1.9);
  });

  it('stacks two overlapping items of one theme into different lanes', () => {
    const html = renderRoadmap({
      periods: ['Q1', 'Q2', 'Q3'],
      items: [
        { label: 'A', theme: 'T', from: 'Q1', to: 'Q2' },
        { label: 'B', theme: 'T', from: 'Q2', to: 'Q3' },
        { label: 'C', theme: 'T', from: 'Q3' },
      ],
    });
    const root = parse(html);
    const y = (bp: string): number => Number(root.querySelector(`g[data-bp="${bp}"] rect`)?.getAttribute('y'));
    expect(y('items.1')).toBeGreaterThan(y('items.0'));
    // C overlaps B but not A — it takes A's lane back.
    expect(y('items.2')).toBe(y('items.0'));
  });

  it('skips an item whose theme or period is not in the lists', () => {
    const html = renderRoadmap({
      periods: ['Q1', 'Q2'],
      themes: ['T'],
      items: [
        { label: 'ok', theme: 'T', from: 'Q1' },
        { label: 'bad theme', theme: 'X', from: 'Q1' },
        { label: 'bad period', theme: 'T', from: 'Q9' },
      ],
    });
    expect(parse(html).querySelectorAll('g.rm-item')).toHaveLength(1);
    expect(html).not.toContain('bad theme');
  });
});
