/**
 * `chart` kind `dumbbell`: one row per label, a dot per series on one shared
 * value axis, a connector from the lowest dot to the highest, and the values
 * as "first → last" with a signed change. These tests pin the geometry (dot x
 * follows the scale, the connector spans the extremes, coincident dots split),
 * the reading of a row that falls, the text rules (no silent cut), and the
 * skin (tokens only, the accent on the last series).
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { renderChart } from '../blocks/chart.js';
import { dumbbellPaints, dumbbellScale } from '../blocks/chartKinds.js';
import { geometryReport } from '../geometryReport.js';

const NO_HEX = /#[0-9a-f]{3,6}\b/i;
const MINUS = '−';
/** Dot radius: the connector runs from dot edge to dot edge. */
const R = 5;

type ChartData = Parameters<typeof renderChart>[0];

const num = (el: HTMLElement | null | undefined, attr: string): number =>
  Number(el?.getAttribute(attr));

/** The drawn dot of series `si` in row `ri`. */
function dot(root: HTMLElement, si: number, ri: number): HTMLElement | null {
  return root.querySelector(`g[data-bp="series.${si}.values.${ri}"] circle.chart-db-dot`);
}

/** The track ends: the solid axis line under the rows. */
function track(root: HTMLElement): { x0: number; x1: number } {
  const axis = root
    .querySelectorAll('line')
    .find(
      (l) =>
        l.getAttribute('stroke') === 'var(--rule-solid)' && l.getAttribute('class') === undefined,
    );
  return { x0: num(axis, 'x1'), x1: num(axis, 'x2') };
}

/** The row groups, in order. */
const rows = (root: HTMLElement): HTMLElement[] => root.querySelectorAll('g.chart-db-row');

const render = (data: Omit<ChartData, 'kind'>): HTMLElement =>
  parse(renderChart({ kind: 'dumbbell', ...data }));

describe('dumbbell: the value axis', () => {
  it('uses the author min and max as the ends, with a tick at each step', () => {
    expect(dumbbellScale([3.5, 1.3, 5], 1, 5)).toEqual({ lo: 1, hi: 5, ticks: [1, 2, 3, 4, 5] });
    expect(dumbbellScale([42, 71], -20, 60).ticks).toEqual([-20, 0, 20, 40, 60]);
  });

  it('labels an author end that is not on a nice step', () => {
    expect(dumbbellScale([1, 6], 0, 7).ticks).toEqual([0, 2, 4, 6, 7]);
  });

  it('without min and max, snaps a nice domain to the data and leaves 0 out when the data is far from it', () => {
    expect(dumbbellScale([240, 310, 420, 180, 205, 150, 230, 455])).toMatchObject({
      lo: 100,
      hi: 500,
    });
    expect(dumbbellScale([3.5, 1.3, 3.6, 5.0, 4.6])).toMatchObject({ lo: 1, hi: 5 });
  });

  it('takes 0 in when the data sits near it, on either side', () => {
    expect(dumbbellScale([2, 30]).lo).toBe(0);
    expect(dumbbellScale([-40, -5]).hi).toBe(0);
    expect(dumbbellScale([-12, 30])).toMatchObject({ lo: -20, hi: 30 });
  });

  it('opens a window around a single value, and honours a one-sided end', () => {
    const one = dumbbellScale([7]);
    expect(one.lo).toBeLessThan(7);
    expect(one.hi).toBeGreaterThan(7);
    expect(dumbbellScale([2.5, 4], undefined, 5).hi).toBe(5);
    expect(dumbbellScale([2.5, 4], 0).lo).toBe(0);
  });
});

describe('dumbbell: dot positions follow the scale', () => {
  it('with min and max, a value sits at its share of the track', () => {
    const root = render({
      min: 1,
      max: 5,
      labels: ['A', 'B'],
      series: [
        { label: 'Old', values: [1, 3] },
        { label: 'New', values: [5, 4] },
      ],
    });
    const { x0, x1 } = track(root);
    expect(num(dot(root, 0, 0), 'cx')).toBeCloseTo(x0, 1);
    expect(num(dot(root, 1, 0), 'cx')).toBeCloseTo(x1, 1);
    expect(num(dot(root, 0, 1), 'cx')).toBeCloseTo(x0 + (x1 - x0) * 0.5, 0);
    expect(num(dot(root, 1, 1), 'cx')).toBeCloseTo(x0 + (x1 - x0) * 0.75, 0);
  });

  it('with an auto domain, the same rule holds over the nice ends', () => {
    const values = { before: [240, 310, 420], after: [150, 230, 455] };
    const root = render({
      unit: 'ms',
      labels: ['GET /orders', 'GET /search', 'POST /checkout'],
      series: [
        { label: 'Before', values: values.before },
        { label: 'After', values: values.after },
      ],
    });
    const { x0, x1 } = track(root);
    const at = (v: number): number => x0 + ((x1 - x0) * (v - 100)) / 400;
    values.before.forEach((v, i) => expect(num(dot(root, 0, i), 'cx')).toBeCloseTo(at(v), 0));
    values.after.forEach((v, i) => expect(num(dot(root, 1, i), 'cx')).toBeCloseTo(at(v), 0));
    const ticks = root.querySelectorAll('text.c-soft').map((t) => t.text);
    expect(ticks).toContain('100ms');
    expect(ticks).toContain('500ms');
    expect(ticks).not.toContain('0ms');
  });
});

describe('dumbbell: the connector and the change', () => {
  it('spans the lowest dot to the highest, with three series', () => {
    const root = render({
      labels: ['us-east-1'],
      series: [
        { label: 'Q1', values: [40] },
        { label: 'Q2', values: [10] },
        { label: 'Q3', values: [70] },
      ],
    });
    const xs = [0, 1, 2].map((si) => num(dot(root, si, 0), 'cx'));
    const [lo, mid, hi] = [...xs].sort((p, q) => p - q);
    // Edge to edge between neighbouring dots: lowest → middle → highest, no gap a dot does not fill.
    const links = root.querySelectorAll('line.chart-db-link').map((l) => [num(l, 'x1'), num(l, 'x2')]);
    expect(links).toEqual([
      [(lo ?? 0) + R, (mid ?? 0) - R],
      [(mid ?? 0) + R, (hi ?? 0) - R],
    ]);
  });

  it('reads a row that falls: the accent dot sits left, the connector still spans both, the change is negative', () => {
    const root = render({
      labels: ['Falls', 'Rises', 'Holds'],
      series: [
        { label: 'Before', values: [4.2, 2.0, 3.0] },
        { label: 'After', values: [3.0, 3.5, 3.0] },
      ],
    });
    const [falls, rises, holds] = rows(root);
    const first = num(dot(root, 0, 0), 'cx');
    const last = num(dot(root, 1, 0), 'cx');
    expect(last).toBeLessThan(first);
    expect(dot(root, 1, 0)?.getAttribute('fill')).toBe('var(--accent)');
    const link = falls?.querySelector('line.chart-db-link');
    expect(num(link, 'x1')).toBe(last + R);
    expect(num(link, 'x2')).toBe(first - R);
    // The value column reads first → last, whatever the direction, and the sign says which way.
    expect(falls?.querySelector('text.chart-db-val')?.text).toBe(`4.2→3.0${MINUS}1.2`);
    expect(rises?.querySelector('text.chart-db-val')?.text).toBe('2.0→3.5+1.5');
    expect(holds?.querySelector('text.chart-db-val')?.text).toBe('3.0→3.0±0.0');
    // The last value is bold in the accent.
    const lastText = falls?.querySelectorAll('text.chart-db-val tspan')[2];
    expect(lastText?.getAttribute('class')).toBe('c-accent');
    expect(lastText?.getAttribute('font-weight')).toBe('600');
  });

  it('prints every value to the precision of the most precise one, the unit after the last', () => {
    const root = render({
      unit: '%',
      labels: ['Signup'],
      series: [
        { label: 'Q2', values: [61] },
        { label: 'Q3', values: [74.5] },
      ],
    });
    expect(root.querySelector('text.chart-db-val')?.text).toBe('61.0→74.5%+13.5');
  });
});

describe('dumbbell: dots that coincide stay visible', () => {
  it('splits equal and near-equal dots above and below the track, at their true x', () => {
    const root = render({
      min: 0,
      max: 100,
      labels: ['Same', 'Near', 'Apart'],
      series: [
        { label: 'A', values: [50, 50, 20] },
        { label: 'B', values: [50, 51, 80] },
      ],
    });
    for (const ri of [0, 1]) {
      const a = dot(root, 0, ri);
      const b = dot(root, 1, ri);
      expect(Math.abs(num(a, 'cy') - num(b, 'cy'))).toBeGreaterThanOrEqual(10);
      expect(num(a, 'cx')).toBeLessThanOrEqual(num(b, 'cx'));
    }
    expect(num(dot(root, 0, 2), 'cy')).toBe(num(dot(root, 1, 2), 'cy'));
  });

  it('grows the row for a run of three dots', () => {
    const root = render({
      min: 0,
      max: 100,
      labels: ['Three'],
      series: [
        { label: 'A', values: [50] },
        { label: 'B', values: [50] },
        { label: 'C', values: [51] },
      ],
    });
    const ys = [0, 1, 2].map((si) => num(dot(root, si, 0), 'cy')).sort((p, q) => p - q);
    expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeGreaterThanOrEqual(10);
    expect((ys[2] ?? 0) - (ys[1] ?? 0)).toBeGreaterThanOrEqual(10);
  });
});

describe('dumbbell: values past min or max', () => {
  const html = renderChart({
    kind: 'dumbbell',
    min: -20,
    max: 60,
    labels: ['Enterprise', 'SMB'],
    series: [
      { label: 'H1', values: [42, -31] },
      { label: 'H2', values: [71, -8] },
    ],
  });
  const root = parse(html);

  it('clamp to the track end, draw an outward chevron, and print the true value', () => {
    const { x0, x1 } = track(root);
    expect(num(dot(root, 1, 0), 'cx')).toBeCloseTo(x1, 1);
    expect(num(dot(root, 0, 1), 'cx')).toBeCloseTo(x0, 1);
    expect(root.querySelectorAll('path.chart-db-clamp')).toHaveLength(2);
    expect(root.querySelector('g[data-bp="series.1.values.0"] title')?.text).toContain(
      'past the axis max 60',
    );
    expect(rows(root)[0]?.querySelector('text.chart-db-val')?.text).toBe('42→71+29');
    expect(rows(root)[1]?.querySelector('text.chart-db-val')?.text).toBe(`${MINUS}31→${MINUS}8+23`);
  });

  it('say so in the legend', () => {
    expect(html).toContain('past the axis end');
  });
});

describe('dumbbell: text is never cut silently', () => {
  it('wraps a long row label whole, and the row grows to hold it', () => {
    const label = 'Account access and password resets for enterprise single sign-on tenants';
    const root = render({
      labels: ['Billing', label],
      series: [
        { label: 'Before', values: [9.5, 14.2] },
        { label: 'After', values: [4.1, 6.0] },
      ],
    });
    const text = root.querySelector('text[data-bp="labels.1"]');
    expect(text?.querySelectorAll('tspan').length).toBeGreaterThan(1);
    expect(text?.text.replace(/\s+/g, '')).toBe(label.replace(/\s+/g, ''));
    expect(text?.text).not.toContain('…');
    const [one, two] = rows(root).map((r) => num(r.querySelector('line'), 'y1'));
    expect((two ?? 0) - (one ?? 0)).toBeGreaterThan(28);
  });

  it('cuts only past four lines, with the full text in a <title> and a geometry report', () => {
    const label = `Queue ${'with a very long descriptive name '.repeat(8).trim()}`;
    const data = {
      kind: 'dumbbell' as const,
      labels: [label],
      series: [
        { label: 'Before', values: [1] },
        { label: 'After', values: [2] },
      ],
    };
    const text = parse(renderChart(data)).querySelector('text[data-bp="labels.0"]');
    expect(text?.text).toContain('…');
    expect(text?.querySelector('title')?.text).toBe(label);
    const cut = geometryReport('chart', data).issues.find((i) => i.kind === 'label-truncated');
    expect(cut?.path).toBe('labels.0');
  });
});

describe('dumbbell: skin and data paths', () => {
  const data: ChartData = {
    kind: 'dumbbell',
    title: 'Judge scores',
    min: 1,
    max: 5,
    labels: ['Opening', 'Ending', 'Structure fit'],
    series: [
      { label: 'Old skill', values: [3.5, 1.3, 3.6] },
      { label: 'New skill', values: [5.0, 4.6, 4.7] },
    ],
  };
  const html = renderChart(data);
  const root = parse(html);

  it('colours the first series neutral and the last in the accent; hues between; red is negative', () => {
    expect(dot(root, 0, 0)?.getAttribute('fill')).toBe('var(--soft)');
    expect(dot(root, 1, 0)?.getAttribute('fill')).toBe('var(--accent)');
    expect(dumbbellPaints([{}, {}, {}]).map((p) => p.color)).toEqual([
      'var(--soft)',
      'var(--hue-blue)',
      'var(--accent)',
    ]);
    expect(dumbbellPaints([{}, { accent: 'red' }]).map((p) => p.color)).toEqual([
      'var(--soft)',
      'var(--negative)',
    ]);
    // An author flag moves the focus: the flagged series takes the accent, the last a hue.
    expect(dumbbellPaints([{}, { accent: 'amber' }, {}]).map((p) => p.color)).toEqual([
      'var(--soft)',
      'var(--accent)',
      'var(--hue-blue)',
    ]);
    expect(dumbbellPaints([{}]).map((p) => p.color)).toEqual(['var(--ink)']);
  });

  it('uses tokens only', () => {
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toContain('NaN');
  });

  it('tags rows, labels, dots and the legend with data paths, and titles every row and dot', () => {
    expect(html).toContain('<g data-bl="labels">');
    expect(html).toContain('<div class="diagram-legend" data-bl="series">');
    expect(html).toContain('<span class="lg-item" data-bp="series.1">');
    for (let ri = 0; ri < 3; ri++) {
      expect(root.querySelector(`text[data-bp="labels.${ri}"]`)).not.toBeNull();
      for (let si = 0; si < 2; si++) {
        const g = root.querySelector(`g[data-bp="series.${si}.values.${ri}"]`);
        expect(g?.querySelector('title')?.text).toMatch(/^(Old|New) skill · /);
      }
    }
    expect(rows(root)[0]?.querySelector('title')?.text).toBe(
      'Opening — Old skill 3.5 · New skill 5.0 · change +1.5',
    );
    expect(html).toContain('aria-label="Dumbbell chart: Judge scores, 3 rows, 2 series"');
  });

  it('is deterministic', () => {
    expect(renderChart(data)).toBe(html);
  });
});

describe('dumbbell: row counts', () => {
  it('draws one row, and twenty', () => {
    const one = render({
      labels: ['Only'],
      series: [
        { label: 'A', values: [1] },
        { label: 'B', values: [2] },
      ],
    });
    expect(rows(one)).toHaveLength(1);
    const labels = Array.from({ length: 20 }, (_v, i) => `Queue ${i + 1}`);
    const twenty = render({
      labels,
      series: [
        { label: 'A', values: labels.map((_l, i) => i) },
        { label: 'B', values: labels.map((_l, i) => i * 1.5) },
      ],
    });
    expect(rows(twenty)).toHaveLength(20);
    expect(twenty.querySelectorAll('circle.chart-db-dot')).toHaveLength(40);
  });

  it('skips a missing value and prints a dash for it', () => {
    const root = render({
      labels: ['Web', 'Desktop'],
      series: [
        { label: '2024', values: [10, 12] },
        { label: '2025', values: [14] },
      ],
    });
    expect(dot(root, 1, 1)).toBeNull();
    expect(rows(root)[1]?.querySelector('line.chart-db-link')).toBeNull();
    expect(rows(root)[1]?.querySelector('text.chart-db-val')?.text).toBe('12→–');
  });
});
