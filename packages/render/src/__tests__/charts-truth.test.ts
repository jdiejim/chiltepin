/**
 * The charts lane: every chart and numeric block shows the true numbers, and
 * its labels never collide. Each `describe` pins one audit finding with
 * markup or geometry assertions on realistic data — negatives, big numbers,
 * 18 categories, 8 series, long tails, tiny funnel stages.
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { parseDocument, validateDocument } from 'chiltepin-core';
import { renderChart } from '../blocks/chart.js';
import { axisFormat, compactNum, exactNum, groupNum, textW, valueFormat, zeroScale } from '../blocks/chartScale.js';
import { renderOkr, okrPct } from '../blocks/okr.js';
import { renderBintree, bintreeRadius } from '../blocks/bintree.js';
import { renderPercentiles, dodgeDots } from '../blocks/percentiles.js';
import { renderStats, deltaDirection, deltaTone } from '../blocks/stats.js';
import { renderPerfbudget } from '../blocks/perfbudget.js';
import { renderMindmap, branchTones } from '../blocks/mindmap.js';
import { renderSankey } from '../blocks/sankey.js';
import { renderPyramid } from '../blocks/pyramid.js';
import { renderRoadmap, quarterRuns } from '../blocks/roadmap.js';
import { renderChevrons, chevronWidth } from '../blocks/chevrons.js';
import { renderHeatmap, heatBins } from '../blocks/heatmap.js';
import { seriesStyle } from '../svg/dsTone.js';
import { houseCss } from '../css.js';
import { collectCuts, textWidth } from '../svg/wrapText.js';
import { renderDocument } from '../document.js';

const num = (el: HTMLElement | null | undefined, attr: string): number => Number(el?.getAttribute(attr));
const NO_HEX = /#[0-9a-f]{3,6}\b/i;

const NET_INCOME = {
  kind: 'bar' as const,
  unit: ' USD',
  labels: ['Q1 FY24', 'Q2 FY24', 'Q3 FY24', 'Q4 FY24', 'Q1 FY25', 'Q2 FY25', 'Q3 FY25', 'Q4 FY25'],
  series: [
    { label: 'Net income', values: [1250000, -340000, -1820000, 410000, 2750000, -95000, 3100000, 4200000] },
    { label: 'Forecast', values: [1000000, 200000, -900000, 600000, 2000000, 500000, 2500000, 3900000] },
  ],
};

/** The zero line: the one solid gridline of a cartesian chart. */
function zeroY(root: HTMLElement): number {
  return num(root.querySelector('line[stroke="var(--rule-solid)"]'), 'y1');
}

// ─── number formatting ──────────────────────────────────────────────────────

describe('number format (R3): compact, grouped, unit kept', () => {
  it('groups thousands and keeps exact values exact', () => {
    expect(groupNum(12480331)).toBe('12,480,331');
    expect(exactNum(2055000, ' USD')).toBe('2,055,000 USD');
    expect(groupNum(-0.25)).toBe('−0.25');
  });

  it('compacts large values to three significant digits with a true minus', () => {
    expect(compactNum(1250000)).toBe('1.25M');
    expect(compactNum(340000)).toBe('340k');
    expect(compactNum(-340000, ' USD')).toBe('−340k USD');
    expect(compactNum(999600)).toBe('1M');
    expect(compactNum(1234)).toBe('1,234');
    // A word unit after a suffix gets a space, so `12.5k ms` never reads as `12.5kms`.
    expect(compactNum(12480, 'ms')).toBe('12.5k ms');
  });

  it('scales a byte unit by 1000', () => {
    expect(compactNum(3200000000, 'B')).toBe('3.2 GB');
    expect(compactNum(999600, 'B')).toBe('1 MB');
    expect(compactNum(512, 'B')).toBe('512 B');
  });

  it('gives every tick on an axis one suffix, and value labels the same units', () => {
    const s = zeroScale(-1820000, 4200000);
    expect(s.ticks).toContain(0);
    expect(s.ticks.map(axisFormat(s.ticks, ' USD'))).toEqual(['−2M USD', '0 USD', '2M USD', '4M USD', '6M USD']);
    const k = zeroScale(0, 128000);
    // An axis in k: a 9,000 value label reads 9k, like its ticks.
    expect(valueFormat(k.ticks)(9000)).toBe('9k');
    expect(valueFormat(zeroScale(0, 900).ticks)(900)).toBe('900');
  });
});

// ─── R1: signed domain ──────────────────────────────────────────────────────

describe('R1: negative values are drawn below zero, never as 0', () => {
  it('bar: a negative bar hangs from the zero line, as long as its value', () => {
    const root = parse(renderChart(NET_INCOME));
    const z = zeroY(root);
    const bar = (s: number, c: number): HTMLElement | null => root.querySelector(`g[data-bp="series.${s}.values.${c}"] rect`);
    const neg = bar(0, 2); // −1,820,000
    const pos = bar(0, 4); // +2,750,000
    expect(num(neg, 'y')).toBeCloseTo(z, 0);
    expect(num(neg, 'height')).toBeGreaterThan(20);
    expect(num(pos, 'y') + num(pos, 'height')).toBeCloseTo(z, 0);
    // Length is proportional to the magnitude.
    expect(num(neg, 'height') / num(pos, 'height')).toBeCloseTo(1820000 / 2750000, 1);
    expect(root.text).toContain('−2M USD');
  });

  it('line: a negative point sits under the zero line', () => {
    const root = parse(
      renderChart({ kind: 'line', unit: '°C', labels: ['Jan', 'Feb', 'Mar', 'Apr'], series: [{ label: 'Anomaly', values: [-2.4, -1.1, 0.6, 1.8] }] }),
    );
    const z = zeroY(root);
    const ys = root.querySelectorAll('g[data-bl="series"] circle').map((c) => num(c, 'cy'));
    expect(ys[0]).toBeGreaterThan(z);
    expect(ys[3]).toBeLessThan(z);
  });

  it('area: the fill closes on the zero line, not the plot floor', () => {
    const root = parse(renderChart({ kind: 'area', labels: ['a', 'b', 'c'], series: [{ label: 'NPS', values: [-12, 3, 19] }] }));
    const z = zeroY(root);
    const pts = (root.querySelector('polygon')?.getAttribute('points') ?? '').split(' ');
    expect(Number(pts[0]?.split(',')[1])).toBeCloseTo(z, 0);
    expect(Number(pts[pts.length - 1]?.split(',')[1])).toBeCloseTo(z, 0);
  });

  it('stacked: outflows stack down from zero, the net total prints', () => {
    const html = renderChart({
      kind: 'stacked',
      unit: 'k',
      labels: ['Q1'],
      series: [
        { label: 'Operating', values: [420] },
        { label: 'Investing', values: [-300] },
        { label: 'Financing', values: [100] },
      ],
    });
    const root = parse(html);
    const z = zeroY(root);
    const inv = root.querySelector('rect[data-bp="series.1.values.0"]');
    expect(num(inv, 'y')).toBeCloseTo(z, 0);
    expect(html).toContain('>220k<'); // 420 − 300 + 100
  });

  it('waterfall: a negative step goes down and the total is the signed sum', () => {
    const html = renderChart({
      kind: 'waterfall',
      unit: ' USD',
      budget: 2000000,
      items: [
        { label: 'FY24 baseline', value: 1250000 },
        { label: 'Reserved-instance savings', value: -320000 },
        { label: 'New region', value: 410000 },
        { label: 'Egress optimisation', value: -95000 },
        { label: 'GPU training cluster', value: 870000 },
        { label: 'Storage tiering', value: -60000 },
      ],
    });
    const root = parse(html);
    expect(html).toContain('2,055,000 USD');
    expect(html).not.toContain('2,530,000');
    expect(html).toContain('55,000 USD over');
    const rect = (i: number): HTMLElement | null => root.querySelector(`g[data-bp="items.${i}"] rect[data-dir]`);
    expect(rect(1)?.getAttribute('data-dir')).toBe('down');
    // The savings bar runs left from where the baseline ended.
    expect(num(rect(1), 'x') + num(rect(1), 'width')).toBeCloseTo(num(rect(0), 'x') + num(rect(0), 'width'), 0);
    expect(root.text).toContain('−320,000 USD');
    expect(root.querySelector('.diagram-legend')?.text).not.toContain('darker');
  });

  it('waterfall: a cascade that dips under zero draws the zero line and a signed total', () => {
    const html = renderChart({
      kind: 'waterfall',
      unit: ' k$',
      items: [
        { label: 'Opening', value: 120 },
        { label: 'Price cut', value: -180 },
        { label: 'Recovery', value: 150 },
      ],
    });
    const root = parse(html);
    expect(root.querySelectorAll('line[stroke="var(--rule-solid)"][data-decorative]').length).toBeGreaterThan(0);
    expect(html).toContain('>90 k$<');
  });

  it('radar: a negative score sits inside the zero ring', () => {
    const root = parse(
      renderChart({ kind: 'radar', labels: ['a', 'b', 'c', 'd'], series: [{ label: 's', values: [-5, 0, 5, 10] }] }),
    );
    const pts = (root.querySelector('g[data-bl="series"] polygon')?.getAttribute('points') ?? '').split(' ').map((p) => p.split(',').map(Number));
    const svg = root.querySelector('svg');
    const vb = (svg?.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const cx = (vb[2] ?? 0) / 2;
    const cy = (vb[3] ?? 0) / 2;
    const r = (p: number[] | undefined): number => Math.hypot((p?.[0] ?? 0) - cx, (p?.[1] ?? 0) - cy);
    expect(r(pts[0])).toBeLessThan(r(pts[1]));
    expect(r(pts[1])).toBeGreaterThan(0);
  });

  it('bullet: a negative measure prints its true value, not 0', () => {
    const html = renderChart({ kind: 'bullet', bullets: [{ label: 'Error rate', value: -2, target: 1, ranges: [1, 2, 5] }] });
    expect(parse(html).querySelector('g[data-bp="bullets.0"] text.t-arrow')?.text).toBe('-2');
  });

  it('gauge: the arc is clamped, the number is not, and an over-ceiling chevron shows', () => {
    const html = renderChart({ kind: 'gauge', unit: '%', items: [{ label: 'Build minutes', value: 132 }] });
    expect(html).toContain('>132%<');
    expect(parse(html).querySelector('.chart-over')).not.toBeNull();
  });
});

// ─── R2: funnel ─────────────────────────────────────────────────────────────

describe('R2: funnel bands are truly proportional', () => {
  const FUNNEL = {
    kind: 'funnel' as const,
    items: [
      { label: 'Visited pricing page from any campaign or organic source', value: 250000 },
      { label: 'Started 14-day trial', value: 18000 },
      { label: 'Invited a teammate', value: 7200 },
      { label: 'Converted to paid', value: 1400 },
      { label: 'Renewed after year one', value: 1100 },
    ],
  };
  const root = parse(renderChart(FUNNEL));
  const topW = (i: number): number => {
    const pts = (root.querySelector(`g[data-bp="items.${i}"] polygon`)?.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[0]));
    return (pts[1] ?? 0) - (pts[0] ?? 0);
  };

  it('scales every band by value / max, with a floor of a few px', () => {
    expect(topW(1) / topW(0)).toBeCloseTo(18000 / 250000, 2);
    expect(topW(2) / topW(0)).toBeCloseTo(7200 / 250000, 2);
    // 1,400 and 1,100 of 250,000 are under 3px at full scale: floored to a
    // sliver, never to 28% of the top.
    expect(topW(3)).toBeGreaterThanOrEqual(3);
    expect(topW(4)).toBeLessThan(6);
    expect(topW(3)).toBeLessThan(topW(2));
    expect(topW(2)).toBeLessThan(topW(1));
  });

  it('puts a label beside a band too narrow for it, inside a wide one', () => {
    const band = (i: number): HTMLElement | null => root.querySelector(`g[data-bp="items.${i}"] polygon`);
    expect(band(4)?.getAttribute('data-label')).toBe('beside');
    const label = root.querySelector('text[data-bp="items.4.label"]');
    const right = Math.max(...(band(4)?.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[0])));
    expect(num(label, 'x')).toBeGreaterThan(right);
    expect(label?.getAttribute('text-anchor')).toBe('start');
    const wide = parse(renderChart({ kind: 'funnel', items: [{ label: 'Visits', value: 100 }, { label: 'Signups', value: 90 }] }));
    expect(wide.querySelector('g[data-bp="items.0"] polygon')?.getAttribute('data-label')).toBe('inside');
  });

  it('prints each stage share of the top and an honest small conversion', () => {
    expect(root.text).toContain('0.44% of top');
    expect(root.text).toContain('↓ 7.2%');
    expect(root.querySelector('.diagram-legend')?.text).not.toContain('darker');
  });
});

// ─── R3: axes and labels ────────────────────────────────────────────────────

describe('R3: axes size to their labels, labels never collide', () => {
  it('sizes the y gutter from the widest tick label', () => {
    const root = parse(renderChart(NET_INCOME));
    const grid = root.querySelector('line[stroke="var(--rule-solid)"]');
    const ticks = root.querySelectorAll('text.c-soft').map((t) => t.text);
    const widest = Math.max(...ticks.map((t) => textW(t)));
    expect(num(grid, 'x1') - 8).toBeGreaterThanOrEqual(widest);
  });

  it('turns an 18-category bar chart into horizontal bars', () => {
    const labels = Array.from({ length: 18 }, (_, i) => `Acquisition channel number ${i + 1}`);
    const html = renderChart({ kind: 'bar', labels, series: [{ label: 'MAU', values: labels.map((_, i) => (i + 1) * 7000) }] });
    const root = parse(html);
    const bars = root.querySelectorAll('g[data-bl="series"] rect');
    expect(bars).toHaveLength(18);
    // One height, varying widths: horizontal bars.
    expect(new Set(bars.map((b) => b.getAttribute('height'))).size).toBe(1);
    expect(new Set(bars.map((b) => b.getAttribute('width'))).size).toBeGreaterThan(10);
    const cats = root.querySelectorAll('g[data-bl="labels"] text');
    expect(cats.every((t) => t.getAttribute('text-anchor') === 'end')).toBe(true);
    // Category labels sit in their own rows: no two share a baseline.
    expect(new Set(cats.map((t) => t.getAttribute('y'))).size).toBe(18);
    expect(html).toContain('>126k<');
  });

  it('thins the labels of a 24-point line instead of overprinting them', () => {
    const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
    const root = parse(renderChart({ kind: 'line', labels, series: [{ label: 'rps', values: labels.map((_, i) => i * 500) }] }));
    const shown = root.querySelectorAll('g[data-bl="labels"] text');
    expect(shown.length).toBeLessThan(24);
    expect(shown.length).toBeGreaterThan(5);
    const xs = shown.map((t) => num(t, 'x'));
    for (let i = 1; i < xs.length; i++) expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThan(textW('00:00'));
  });

  it('drops a value label wider than its bar', () => {
    const root = parse(renderChart(NET_INCOME));
    // Two series × eight quarters: bars are ~20px, "1.25M USD" is not.
    for (const t of root.querySelectorAll('g[data-bl="series"] text')) {
      const rect = t.parentNode?.querySelector('rect');
      expect(textW(t.text, 6.1)).toBeLessThanOrEqual(num(rect, 'width') + 5);
    }
  });
});

// ─── R4: okr ────────────────────────────────────────────────────────────────

describe('R4: okr prints the true progress', () => {
  const html = renderOkr({
    items: [
      {
        objective: 'Grow activation',
        krs: [
          { kr: 'Activation rate from 45% to 60%', progress: 1.35, status: 'done' },
          { kr: 'NPS above 40', progress: 0.4, status: 'at-risk' },
          { kr: 'Pen test', progress: 0.9 },
        ],
      },
    ],
  });
  const root = parse(html);

  it('clamps only the bar: 1.35 prints 135% on a full bar with a target tick', () => {
    expect(root.querySelector('[data-bp="items.0.krs.0.progress"]')?.text).toBe('135%');
    expect(root.querySelector('[data-bp="items.0.krs.0"] .okr-fill')?.getAttribute('style')).toBe('width:100%');
    expect(root.querySelector('[data-bp="items.0.krs.0"] .okr-tick')).not.toBeNull();
    expect(root.querySelector('[data-bp="items.0.krs.1"] .okr-tick')).toBeNull();
    expect(okrPct(-0.1)).toBe('−10%');
  });

  it('aligns every track on one grid, status chip or not', () => {
    expect(houseCss).toContain('.docskin .okr-kr-bar{display:grid;grid-template-columns:minmax(0,1fr) 40px 84px;');
    // At risk is a warning: amber, not the accent.
    expect(houseCss).toContain('.docskin .okr-status.okr-s-at-risk{border-color:var(--hue-amber)');
    expect(html).not.toContain('var(--accent)');
  });
});

// ─── R5 / R16: bintree ──────────────────────────────────────────────────────

/** Every node centre, by id. */
function centres(html: string): { x: number; y: number }[] {
  return parse(html)
    .querySelectorAll('g[data-bl="nodes"] > g')
    .map((g) => {
      const c = g.querySelectorAll('circle')[1];
      return { x: num(c, 'cx'), y: num(c, 'cy') };
    });
}

describe('R5: bintree nodes never overlap', () => {
  it('a lone child does not land on its parent sibling (12, 6, 18, 3)', () => {
    const html = renderBintree({
      nodes: [
        { id: 'a', value: '12' },
        { id: 'b', value: '6', parent: 'a', side: 'left' },
        { id: 'c', value: '18', parent: 'a', side: 'right' },
        { id: 'd', value: '3', parent: 'b', side: 'left' },
      ],
    });
    const [, six, eighteen] = centres(html);
    expect(six?.y).toBe(eighteen?.y);
    expect(Math.abs((eighteen?.x ?? 0) - (six?.x ?? 0))).toBeGreaterThanOrEqual(2 * 18 + 4);
  });

  it('holds for inward-leaning subtrees and wide values on every level', () => {
    const shapes = [
      // Left child with a left child, right child with a right child.
      [
        { id: 'r', value: '50' },
        { id: 'x', value: '25', parent: 'r', side: 'left' },
        { id: 'l', value: '12', parent: 'x', side: 'left' },
        { id: 'y', value: '75', parent: 'r', side: 'right' },
        { id: 'm', value: '99', parent: 'y', side: 'right' },
      ],
      // Inward chains: left subtree leans right, right subtree leans left.
      [
        { id: 'r', value: '1234567' },
        { id: 'x', value: 'key:customer-42', parent: 'r', side: 'left' },
        { id: 'xr', value: '30', parent: 'x', side: 'right' },
        { id: 'xrr', value: '40', parent: 'xr', side: 'right' },
        { id: 'y', value: '80', parent: 'r', side: 'right' },
        { id: 'yl', value: '70', parent: 'y', side: 'left' },
        { id: 'yll', value: '60', parent: 'yl', side: 'left' },
      ],
    ] as const;
    for (const nodes of shapes) {
      const html = renderBintree({ nodes: nodes.map((n) => ({ ...n })) });
      const R = bintreeRadius(nodes.map((n) => n.value));
      const cs = centres(html);
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          const a = cs[i];
          const b = cs[j];
          expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThanOrEqual(2 * R + 4);
        }
      }
    }
  });

  it('sizes the node from the widest value and cuts only past eight characters, with a title', () => {
    expect(bintreeRadius(['3', '12'])).toBe(18);
    expect(bintreeRadius(['1234567'])).toBeGreaterThan(18);
    const html = renderBintree({ nodes: [{ id: 'a', value: 'key:customer-42' }] });
    expect(html).toContain('<title>key:customer-42</title>');
    expect(html).toContain('>1234567<'.replace('1234567', 'key:cus…'));
  });

  it('draws every node over an opaque paper base', () => {
    const root = parse(renderBintree({ nodes: [{ id: 'a', value: '1', tone: 'target' }, { id: 'b', value: '0', parent: 'a', side: 'left' }] }));
    expect(root.querySelectorAll('circle.bt-base').every((c) => c.getAttribute('fill') === 'var(--paper)')).toBe(true);
    expect(root.querySelectorAll('circle.bt-base')).toHaveLength(2);
  });
});

// ─── R6: percentiles ────────────────────────────────────────────────────────

const TAIL_ROWS = [
  { label: 'POST /checkout', p50: 120, p90: 210, p95: 260, p99: 420, max: 1900 },
  { label: 'GET /cart', p50: 18, p90: 35, p95: 48, p99: 90, max: 410 },
  { label: 'GET /catalog/search', p50: 60, p90: 140, p95: 180, p99: 290, max: 45000 },
  { label: 'GET /health', p50: 1, p90: 2, p95: 2, p99: 4, max: 15 },
];

describe('R6: one long tail does not squeeze every row', () => {
  it('turns the axis log when the tail dwarfs the smallest median, and says so', () => {
    const root = parse(renderPercentiles({ unit: 'ms', rows: TAIL_ROWS }));
    expect(root.querySelector('.pc-scale')?.text).toBe('log scale');
    // Every row keeps a readable whisker: p50 and p99 stand apart.
    for (let i = 0; i < TAIL_ROWS.length; i++) {
      const d = num(root.querySelector(`[data-bp="rows.${i}.p99"]`), 'cx') - num(root.querySelector(`[data-bp="rows.${i}.p50"]`), 'cx');
      expect(d).toBeGreaterThan(15);
    }
  });

  it('on a linear axis, cuts the far tail and draws it as an arrow with its true value', () => {
    const rows = TAIL_ROWS.filter((r) => r.p50 >= 18);
    const html = renderPercentiles({ unit: 'ms', scale: 'linear', rows });
    const root = parse(html);
    const cut = root.querySelectorAll('g[data-bl="rows"] > g[data-cut="1"]');
    expect(cut.map((g) => g.getAttribute('data-bp'))).toContain('rows.2');
    expect(root.querySelector('g[data-bp="rows.2"] .pc-cut text')?.text).toBe('45,000ms');
    // The arrow stops at the plot edge: no dot is drawn past it.
    expect(root.querySelector('g[data-bp="rows.2.max"]')).toBeNull();
    // The domain ends near 1.5 × the largest p99, so the cart row is not a dot.
    const d = num(root.querySelector('[data-bp="rows.1.p99"]'), 'cx') - num(root.querySelector('[data-bp="rows.1.p50"]'), 'cx');
    expect(d).toBeGreaterThan(30);
  });

  it('moves a dot that would sit on another, keeping its x', () => {
    const small = [
      { key: 'p90' as const, x: 100, dy: 0 },
      { key: 'p95' as const, x: 101, dy: 0 },
    ];
    dodgeDots(small, [100, 200]);
    expect(small[0]?.dy).not.toBe(0);
    expect(small[1]?.dy).not.toBe(0);
    expect(small[0]?.dy).not.toBe(small[1]?.dy);
    expect(small.map((d) => d.x)).toEqual([100, 101]);
  });

  it('draws p90 / p95 rings in ink on a rule-solid whisker, so the ring stands off the line', () => {
    const root = parse(renderPercentiles({ unit: 'ms', rows: [TAIL_ROWS[0] ?? { label: 'x', p50: 1, p99: 2 }] }));
    expect(root.querySelector('[data-bp="rows.0.p90"]')?.getAttribute('stroke')).toBe('var(--ink)');
    expect(root.querySelector('line[stroke-width="1.5"][stroke="var(--rule-solid)"]')).not.toBeNull();
  });
});

// ─── R11: series palette ────────────────────────────────────────────────────

describe('R11: series take the category hues and never repeat silently', () => {
  it('maps series to the six hues, then adds a dash and a marker shape', () => {
    const styles = Array.from({ length: 8 }, (_, i) => seriesStyle(i, 8));
    expect(styles.slice(0, 6).map((s) => s.color)).toEqual([
      'var(--hue-blue)',
      'var(--hue-amber)',
      'var(--hue-violet)',
      'var(--hue-teal)',
      'var(--hue-green)',
      'var(--hue-rose)',
    ]);
    const keys = styles.map((s) => `${s.color}|${s.dash}|${s.marker}`);
    expect(new Set(keys).size).toBe(8);
    expect(styles[6]?.dash).not.toBe('');
    expect(styles[6]?.marker).toBe('square');
  });

  it('an 8-series line chart dashes series 7 and 8, and its legend shows it', () => {
    const series = Array.from({ length: 8 }, (_, i) => ({ label: `s${i}`, values: [i, i + 1, i + 2] }));
    const html = renderChart({ kind: 'line', labels: ['a', 'b', 'c'], series });
    const lines = parse(html).querySelectorAll('polyline');
    expect(lines.slice(0, 6).every((l) => l.getAttribute('stroke-dasharray') === undefined)).toBe(true);
    expect(lines.slice(6).every((l) => (l.getAttribute('stroke-dasharray') ?? '') !== '')).toBe(true);
    expect(html).not.toContain('--series-');
    expect(html).not.toMatch(NO_HEX);
  });

  it('folds donut slices past six into one "Other"', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ label: `Line ${i + 1}`, value: 20 - i }));
    const root = parse(renderChart({ kind: 'donut', items }));
    expect(root.querySelectorAll('g[data-bl="items"] > path')).toHaveLength(7);
    expect(root.querySelector('[data-folded="1"] title')?.text).toContain('Line 7');
    expect(root.querySelector('.diagram-legend')?.text).toContain('Other (4)');
    const fills = root.querySelectorAll('g[data-bl="items"] > path').map((p) => p.getAttribute('stroke'));
    expect(new Set(fills).size).toBe(7);
  });

  it('mindmap: tones are keyed by branch, so every flagged branch gets its hue', () => {
    // Roots interleaved with their children: branch numbers ≠ node indices.
    const html = renderMindmap({
      center: 'Strategy',
      nodes: [
        { id: 'a', label: 'Reliability', accent: 'blue' },
        { id: 'a1', parent: 'a', label: 'Error budgets' },
        { id: 'b', label: 'Developer experience', accent: 'teal' },
        { id: 'b1', parent: 'b', label: 'Fast CI' },
        { id: 'c', label: 'Data', accent: 'purple' },
      ],
    });
    const fill = (i: number): string | undefined => parse(html).querySelector(`[data-bp="nodes.${i}"] text`)?.getAttribute('style');
    expect(fill(2)).toBe('fill:var(--hue-teal)');
    expect(fill(3)).toBe('fill:var(--hue-teal)');
    expect(fill(4)).toBe('fill:var(--hue-violet)');
    expect(branchTones(['blue', 'blue', undefined, 'red', 'gray'])).toEqual([
      'var(--hue-blue)',
      'var(--hue-amber)',
      'var(--muted)',
      'var(--negative)',
      'var(--muted)',
    ]);
  });
});

// ─── R13: stats ─────────────────────────────────────────────────────────────

describe('R13: the arrow is the sign, the colour is `better`', () => {
  it('reads the direction from the delta sign', () => {
    expect(deltaDirection('+18%')).toBe('up');
    expect(deltaDirection('-22 ms')).toBe('down');
    expect(deltaDirection('−1.1M')).toBe('down');
    expect(deltaDirection('0')).toBe('flat');
    expect(deltaDirection('0.0 pp')).toBe('flat');
    expect(deltaDirection('slipped')).toBeUndefined();
  });

  it('a latency drop with better: down is good, never red; no better is neutral', () => {
    expect(deltaTone({ delta: '-22 ms', better: 'down' })).toEqual({ dir: 'down', tone: 'good' });
    expect(deltaTone({ delta: '-0.03pp', better: 'up' })).toEqual({ dir: 'down', tone: 'bad' });
    expect(deltaTone({ delta: '-22 ms', trend: 'up' })).toEqual({ dir: 'down', tone: 'neutral' });
    expect(deltaTone({ delta: 'slipped', trend: 'down' })).toEqual({ dir: 'down', tone: 'neutral' });
    const html = renderStats({ stats: [{ value: '142 ms', label: 'p95 latency', delta: '-22 ms', better: 'down' }] });
    expect(html).toContain('class="stat-delta down good"');
    expect(html).toContain('▼ -22 ms');
    expect(houseCss).toContain('.docskin .stat-delta.good{color:var(--hue-green);}');
  });

  it('`better` is a schema field: up / down validate, anything else does not', () => {
    const ok = parseDocument('```stats\nstats:\n  - { value: 142ms, label: p95, delta: "-22ms", better: down }\n```\n', 's');
    const seg = ok.segments.find((s) => s.kind === 'stats');
    expect(seg?.parseError).toBeUndefined();
    const html = renderDocument(ok);
    expect(html).toContain('stat-delta down good');
    const bad = validateDocument(parseDocument('```stats\nstats:\n  - { value: 1, label: x, better: sideways }\n```\n', 's'), 's.md');
    expect(bad[0]?.code).toBe('E_SCHEMA');
    expect(bad[0]?.message).toContain('better');
    expect(validateDocument(ok, 's.md')).toEqual([]);
  });
});

// ─── R14: perfbudget ────────────────────────────────────────────────────────

describe('R14: perfbudget says what a miss is', () => {
  const html = renderPerfbudget({
    metrics: [
      { metric: 'INP', budget: 200, measured: 1000, unit: 'ms' },
      { metric: 'Lighthouse perf', budget: 90, measured: 84, lowerIsBetter: false },
      { metric: 'JS', budget: 300, measured: 285, unit: 'KB' },
    ],
  });
  const root = parse(html);
  const chip = (i: number): string | undefined => root.querySelectorAll('g[data-bl="metrics"] > g')[i]?.querySelector('text.t-eyebrow')?.text;

  it('a missed floor reads "below", a missed ceiling "over"', () => {
    expect(chip(0)).toBe('over');
    expect(chip(1)).toBe('below');
    expect(root.querySelector('.diagram-legend')?.text).toContain('below target');
  });

  it('prints the true ratio at the break of a cut bar', () => {
    expect(root.querySelector('g[data-bp="metrics.0"] .pb-ratio')?.text).toBe('5×');
  });

  it('near is amber, over is negative, and the accent is never spent', () => {
    expect(root.querySelector('[data-bp="metrics.2.measured"]')?.getAttribute('fill')).toBe('var(--hue-amber)');
    expect(root.querySelector('[data-bp="metrics.0.measured"]')?.getAttribute('fill')).toBe('var(--negative)');
    expect(html).not.toContain('var(--accent)');
  });
});

// ─── R19: sankey ────────────────────────────────────────────────────────────

describe('R19: sankey ribbons are source-hue tints and their values dodge labels', () => {
  const html = renderSankey({
    unit: 'k req/s',
    links: [
      { from: 'Internet', to: 'CDN edge', value: 480 },
      { from: 'Internet', to: 'WAF', value: 120 },
      { from: 'CDN edge', to: 'Cache hit', value: 390 },
      { from: 'CDN edge', to: 'Origin shield', value: 90 },
      { from: 'WAF', to: 'Blocked', value: 15 },
      { from: 'WAF', to: 'API gateway', value: 105 },
      { from: 'Origin shield', to: 'API gateway', value: 90 },
      { from: 'API gateway', to: 'search', value: 110 },
    ],
  });
  const root = parse(html);

  it('fills a ribbon with a translucent tint of its source hue, no outline', () => {
    const ribbons = root.querySelectorAll('g[data-bl="links"] > path');
    expect(ribbons.every((p) => p.getAttribute('stroke') === undefined)).toBe(true);
    expect(ribbons.every((p) => Number(p.getAttribute('fill-opacity')) < 0.5)).toBe(true);
    // Both flows out of Internet share its hue; CDN edge has another.
    expect(ribbons[0]?.getAttribute('fill')).toBe(ribbons[1]?.getAttribute('fill'));
    expect(ribbons[2]?.getAttribute('fill')).not.toBe(ribbons[0]?.getAttribute('fill'));
    expect(ribbons[0]?.getAttribute('fill')).toMatch(/^var\(--hue-/);
  });

  it('places no ribbon value on a stage label or a stage bar', () => {
    const boxes = root.querySelectorAll('g[data-bl="nodes"] > g').flatMap((g) =>
      g.querySelectorAll('rect').map((r) => ({ x0: num(r, 'x'), y0: num(r, 'y'), x1: num(r, 'x') + num(r, 'width'), y1: num(r, 'y') + num(r, 'height') })),
    );
    const values = root.querySelectorAll('g[data-bl="links"] > text');
    expect(values.length).toBeGreaterThan(2);
    for (const t of values) {
      const w = textW(t.text, 6.1);
      const b = { x0: num(t, 'x') - w / 2, x1: num(t, 'x') + w / 2, y0: num(t, 'y') - 8, y1: num(t, 'y') + 2 };
      for (const o of boxes) expect(b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1).toBe(false);
    }
  });
});

// ─── R20: pyramid ───────────────────────────────────────────────────────────

describe('R20: pyramid is one hue, framed, its desc wrapped', () => {
  const html = renderPyramid({
    levels: [
      { label: 'Manual exploratory testing', desc: 'a few per release, focused on new flows and accessibility' },
      { label: 'End-to-end', desc: 'Playwright across Chromium, WebKit and Firefox' },
      { label: 'Unit tests' },
    ],
  });
  const root = parse(html);

  it('drops the legacy positional palette for one hue ramp, and spends no accent', () => {
    expect(html).not.toMatch(/var\(--(navy|blue|teal|positive|purple|highlight)\)/);
    const fills = root.querySelectorAll('polygon').map((p) => p.getAttribute('style') ?? '');
    expect(fills.every((f) => f.includes('var(--hue-blue)'))).toBe(true);
    expect(new Set(fills).size).toBe(3);
    expect(html).not.toContain('var(--accent)');
  });

  it('sits in the diagram frame like its siblings', () => {
    expect(root.querySelector('.diagram .diagram-stage svg')).not.toBeNull();
  });

  it('wraps a long desc to the band narrow edge instead of running past it', () => {
    const desc = root.querySelector('[data-bp="levels.0.desc"]');
    expect(desc?.querySelectorAll('tspan').length).toBeGreaterThan(0);
    const narrow = 250 + (480 - 250) * 0;
    const lines = [desc?.childNodes[0]?.text ?? '', ...(desc?.querySelectorAll('tspan').map((t) => t.text) ?? [])];
    for (const ln of lines) expect(textWidth(ln, { size: 10 })).toBeLessThanOrEqual(narrow - 28);
  });
});

// ─── R21: roadmap, storymap, chevrons ───────────────────────────────────────

describe('R21: planning strips fit the page', () => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const roadmap = renderRoadmap({
    periods: MONTHS,
    themes: ['Reliability and incident response'],
    now: 'Jun',
    items: [
      { label: 'Chaos game days', theme: 'Reliability and incident response', from: 'Mar', to: 'Jul', status: 'current' },
      { label: 'Monorepo build cache', theme: 'Reliability and incident response', from: 'Sep', status: 'risk' },
    ],
  });
  const root = parse(roadmap);

  it('computes the column width from the page, never under 56px', () => {
    const vb = (root.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(vb[2]).toBeLessThanOrEqual(1000);
    const xs = root.querySelectorAll('g[data-bl="periods"] line').map((l) => num(l, 'x1'));
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeGreaterThanOrEqual(56);
  });

  it('groups months under quarters past eight periods', () => {
    expect(root.querySelectorAll('.rm-quarters text').map((t) => t.text)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(quarterRuns(['Nov 26', 'Dec 26', 'Jan 27'])?.map((q) => q.label)).toEqual(['Q4 ’26', 'Q1 ’27']);
    expect(quarterRuns(['Q1', 'Q2'])).toBeUndefined();
  });

  it('draws the now line under the chips', () => {
    expect(roadmap.indexOf('class="rm-now"')).toBeLessThan(roadmap.indexOf('class="rm-item'));
  });

  it('runs a one-period label on beside its chip when the lane is free', () => {
    const label = root.querySelector('[data-bp="items.1.label"]');
    expect(label?.text).toBe('Monorepo build cache');
    expect(label?.getAttribute('class')).toContain('rm-beside');
  });

  it('storymap columns flex between a floor and the row width', () => {
    expect(houseCss).toContain('.docskin .sm-colcell{flex:1 1 0;padding:4px 5px;min-width:132px;}');
  });

  it('chevrons take their width, and their label budget, from the page', () => {
    expect(chevronWidth(3)).toBeGreaterThan(chevronWidth(8));
    expect(chevronWidth(8)).toBeGreaterThanOrEqual(130);
    const label = 'Detect and page the on-call engineer';
    const html = renderChevrons({ steps: [{ label }, { label: 'Triage' }, { label: 'Fix' }, { label: 'Review' }, { label: 'Close' }, { label: 'Learn' }, { label: 'Done' }] });
    expect(html).not.toContain('…');
    expect(parse(html).querySelectorAll('g[data-bp="steps.0"] text').map((t) => t.text).join(' ')).toBe(label);
  });
});

// ─── heatmap ────────────────────────────────────────────────────────────────

describe('heatmap: one outlier does not flatten the rest', () => {
  const rows = [
    { label: 'checkout', values: [0.1, 0.2, 0.4, 0.9, 1.2, 1.4] },
    { label: 'search', values: [0.2, 0.3, 0.5, 0.6, 0.8, 0.9] },
    { label: 'billing', values: [0.1, 0.1, 12.5, 0.1, 0.1, 0.1] },
  ];

  it('switches to quartile steps when equal widths crowd one step', () => {
    const values = rows.flatMap((r) => r.values);
    const { quantile, bounds } = heatBins(values, Math.min(...values), Math.max(...values), false);
    expect(quantile).toBe(true);
    expect(bounds[0]).toBe(0.1);
    expect(bounds[bounds.length - 1]).toBe(12.5);
    expect(bounds.length).toBeGreaterThanOrEqual(4);
  });

  it('spreads the ordinary cells over the ramp and labels each step range', () => {
    const html = renderHeatmap({ xLabels: ['a', 'b', 'c', 'd', 'e', 'f'], rows });
    const backgrounds = new Set(
      parse(html)
        .querySelectorAll('.hm-cell')
        .map((c) => /background:([^;]+)/.exec(c.getAttribute('style') ?? '')?.[1]),
    );
    // Equal widths over 0.1–12.5 would paint every ordinary cell one tone;
    // quartile steps give them three.
    expect(backgrounds.size).toBeGreaterThanOrEqual(3);
    expect(parse(html).querySelector('.diagram-legend')?.text).toContain('12.5');
  });

  it('keeps equal-width steps when the author fixes min and max', () => {
    const values = rows.flatMap((r) => r.values);
    expect(heatBins(values, 0, 20, true).quantile).toBe(false);
  });
});

// ─── cuts are never silent ──────────────────────────────────────────────────

describe('a cut label keeps its text and reports the cut', () => {
  it('reports each cut with its data path, and keeps the whole text in a title', () => {
    const long = 'A level label so long that no band of this pyramid could ever hold it on two lines of text';
    const { value, cuts } = collectCuts(() => renderPyramid({ levels: [{ label: long }, { label: 'Base' }] }));
    expect(cuts.map((c) => c.path)).toContain('levels.0.label');
    expect(value).toContain(`<title>${long}</title>`);
    const roadmap = collectCuts(() =>
      renderRoadmap({ periods: ['Q1', 'Q2'], items: [{ label: 'A chip label far too long for one quarter column of a roadmap that fills the page', theme: 'T', from: 'Q1' }, { label: 'B', theme: 'T', from: 'Q2' }] }),
    );
    expect(roadmap.cuts.map((c) => c.path)).toContain('items.0.label');
  });
});
