import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { houseCss } from '../css.js';
import { renderGitgraph } from '../blocks/gitgraph.js';
import { renderTreemap } from '../blocks/treemap.js';
import { renderPacket } from '../blocks/packet.js';
import { renderVenn } from '../blocks/venn.js';
import { renderWardley } from '../blocks/wardley.js';
import { renderChart } from '../blocks/chart.js';
import { renderFishbone } from '../blocks/fishbone.js';
import { renderStorymap } from '../blocks/storymap.js';
import { renderSlopegraph } from '../blocks/slopegraph.js';
import { renderTree } from '../blocks/tree.js';
import { FONT, textWidth } from '../svg/wrapText.js';

describe('gitgraph', () => {
  const RELEASE = {
    branches: [{ name: 'main' as const }, { name: 'release' as const }],
    commits: [
      { label: 'baseline' },
      { branch: 'release', label: 'cut' },
      { merge: 'release', label: 'ship', tag: 'v1.2.0', kind: 'release' as const },
    ],
  };

  it('gives every branch a lane and every commit a dot', () => {
    const root = parse(renderGitgraph(RELEASE));
    expect(root.querySelectorAll('.gg-branch').map((t) => t.text)).toEqual(['main', 'release']);
    expect(root.querySelectorAll('g[data-bl="commits"] > g')).toHaveLength(3);
  });

  it('steps commits rightward and puts each on its own branch line', () => {
    const root = parse(renderGitgraph(RELEASE));
    const dots = root.querySelectorAll('g[data-bl="commits"] circle');
    const xs = dots.map((c) => Number(c.getAttribute('cx')));
    expect(xs[0]).toBeLessThan(xs[1] ?? 0);
    expect(xs[1]).toBeLessThan(xs[2] ?? 0);
    // The release commit sits one lane below main, and the merge returns.
    const ys = dots.map((c) => Number(c.getAttribute('cy')));
    expect(ys[1]).toBeGreaterThan(ys[0] ?? 0);
    expect(ys[2]).toBe(ys[0]);
  });

  it('draws a fork as a solid curve and a merge as a dashed one', () => {
    const html = renderGitgraph(RELEASE);
    const curves = parse(html).querySelectorAll('path[d^="M"]');
    expect(curves.length).toBeGreaterThanOrEqual(2);
    expect(curves.some((p) => p.getAttribute('stroke-dasharray') === undefined)).toBe(true);
    expect(curves.some((p) => p.getAttribute('stroke-dasharray') === '5 4')).toBe(true);
  });

  it('marks a release with its tag', () => {
    expect(renderGitgraph(RELEASE)).toContain('>v1.2.0<');
  });

  it('opens a lane for a branch that was never declared', () => {
    const html = renderGitgraph({
      commits: [{ label: 'a' }, { branch: 'spike', label: 'b' }],
    });
    expect(parse(html).querySelectorAll('.gg-branch').map((t) => t.text)).toEqual(['main', 'spike']);
  });
});

describe('treemap', () => {
  const SPEND = {
    unit: 'k',
    items: [
      { label: 'Compute', value: 60 },
      { label: 'Storage', value: 30 },
      { label: 'Network', value: 10 },
    ],
  };

  it('sizes every tile by value and fills the canvas', () => {
    const rects = parse(renderTreemap(SPEND)).querySelectorAll('g[data-bl="items"] rect[stroke]');
    expect(rects).toHaveLength(3);
    const areas = rects.map((r) => Number(r.getAttribute('width')) * Number(r.getAttribute('height')));
    // 60 / 30 / 10 — twice the value is twice the area (within the gutters).
    expect((areas[0] ?? 0) / (areas[1] ?? 1)).toBeGreaterThan(1.7);
    expect((areas[1] ?? 0) / (areas[2] ?? 1)).toBeGreaterThan(2.2);
  });

  it('labels tiles with their value and share of the total', () => {
    const html = renderTreemap(SPEND);
    expect(html).toContain('60k · 60%');
    expect(html).toContain('>Compute<');
  });

  it('keeps the authored index for click-to-edit after sorting by size', () => {
    // Smallest first in the source — the biggest tile must still address item 2.
    const html = renderTreemap({
      items: [
        { label: 'Small', value: 5 },
        { label: 'Mid', value: 20 },
        { label: 'Big', value: 75 },
      ],
    });
    const first = parse(html).querySelector('g[data-bl="items"] > g');
    expect(first?.getAttribute('data-bp')).toBe('items.2');
  });
});

describe('packet', () => {
  it('makes cell width the bit count', () => {
    const root = parse(
      renderPacket({
        width: 32,
        fields: [
          { label: 'A', bits: 8 },
          { label: 'B', bits: 24 },
        ],
      }),
    );
    const w = root.querySelectorAll('g[data-bl="fields"] rect').map((r) => Number(r.getAttribute('width')));
    expect((w[1] ?? 0) / (w[0] ?? 1)).toBeCloseTo(3, 0);
  });

  it('wraps a field that overflows its row and marks both halves', () => {
    const html = renderPacket({
      width: 32,
      fields: [
        { label: 'Head', bits: 24 },
        { label: 'Wide', bits: 40 },
      ],
    });
    // Wide spans 8 bits of row 1, all 32 of row 2 — three cells in total.
    expect(parse(html).querySelectorAll('g[data-bl="fields"] rect')).toHaveLength(3);
    expect(html).toContain('(cont.)');
    expect(html).toContain('64 bits · 8 bytes');
  });

  it('flags a partial last row', () => {
    const html = renderPacket({ width: 32, fields: [{ label: 'Only', bits: 12 }] });
    expect(html).toContain('last row is 12 of 32 bits');
  });
});

describe('venn', () => {
  it('draws one circle per set and names each in its own lobe', () => {
    const html = renderVenn({
      sets: [{ label: 'Platform' }, { label: 'Product' }],
      shared: [{ sets: ['Platform', 'Product'], label: 'Release process' }],
    });
    expect(parse(html).querySelectorAll('circle')).toHaveLength(2);
    expect(html).toContain('>Platform<');
    expect(html).toContain('>Release process<');
  });

  it('places a three-set overlap in the middle, matching labels case-insensitively', () => {
    const html = renderVenn({
      sets: [{ label: 'Backend' }, { label: 'Frontend' }, { label: 'Data' }],
      shared: [{ sets: ['backend', 'FRONTEND', 'data'], label: 'Event taxonomy' }],
    });
    expect(parse(html).querySelectorAll('circle')).toHaveLength(3);
    const centre = parse(html)
      .querySelectorAll('g[data-bl="shared"] text')
      .find((t) => t.text.includes('Event'));
    expect(centre?.getAttribute('x')).toBe('310'); // the middle region
  });

  it('ignores a shared region naming a set that does not exist', () => {
    const html = renderVenn({
      sets: [{ label: 'A' }, { label: 'B' }],
      shared: [{ sets: ['A', 'Nope'], label: 'ghost' }],
    });
    expect(html).not.toContain('ghost');
  });
});

describe('wardley', () => {
  const MAP = {
    components: [
      { id: 'user', label: 'Analyst', x: 0.7, y: 0.95, kind: 'user' as const },
      { id: 'db', label: 'Warehouse', x: 0.8, y: 0.3, kind: 'commodity' as const, movement: 0.1 },
    ],
    links: [{ from: 'user', to: 'db' }],
  };

  it('plots visibility up and evolution right', () => {
    const root = parse(renderWardley(MAP));
    const dots = root.querySelectorAll('g[data-bl="components"] circle');
    expect(dots).toHaveLength(2);
    const [analyst, warehouse] = dots.map((c) => ({
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy')),
    }));
    expect(analyst?.y).toBeLessThan(warehouse?.y ?? 0); // more visible → higher
    expect(analyst?.x).toBeLessThan(warehouse?.x ?? 0); // less evolved → left
  });

  it('names the four evolution bands and joins the value chain', () => {
    const html = renderWardley(MAP);
    for (const band of ['GENESIS', 'CUSTOM-BUILT', 'PRODUCT', 'COMMODITY']) {
      expect(html).toContain(`>${band}<`);
    }
    expect(parse(html).querySelectorAll('g[data-bl="links"] line')).toHaveLength(1);
  });

  it('draws movement as a dashed arrow along the evolution axis', () => {
    const html = renderWardley(MAP);
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('marker-end="url(#skOpen)"');
  });

  it('clamps positions outside 0–1 instead of drawing off-canvas', () => {
    const html = renderWardley({
      components: [{ label: 'Out', x: 3, y: -2 }],
    });
    const dot = parse(html).querySelector('g[data-bl="components"] circle');
    expect(Number(dot?.getAttribute('cx'))).toBeLessThanOrEqual(880);
    expect(Number(dot?.getAttribute('cy'))).toBeLessThanOrEqual(420);
  });
});

describe('chart kinds: stacked and scatter', () => {
  const SPEND = {
    labels: ['Q1', 'Q2'],
    series: [
      { label: 'Platform', values: [40, 50] },
      { label: 'Product', values: [20, 30] },
    ],
  };

  it('stacks columns and scales the axis to the totals, not the tallest bar', () => {
    const html = renderChart({ kind: 'stacked', unit: 'k', ...SPEND });
    // Column totals are labelled…
    expect(html).toContain('>60k<');
    expect(html).toContain('>80k<');
    // …and the top gridline is the biggest total, so the stack fits.
    expect(html).toContain('>80k</text>');
  });

  it('scatter plots points without joining them', () => {
    const html = renderChart({ kind: 'scatter', ...SPEND });
    expect(parse(html).querySelectorAll('g[data-bl="series"] circle')).toHaveLength(4);
    expect(html).not.toContain('<polyline');
  });
});

describe('fishbone', () => {
  const CHECKOUT = {
    effect: 'p95 checkout over 2s',
    causes: [
      { label: 'Code', items: ['Sync capture call', 'N+1 cart query'] },
      { label: 'Infrastructure', items: ['Undersized DB pool'] },
      { label: 'Traffic', items: ['Flash-sale spikes'] },
    ],
  };

  it('draws a spine into the head, one bone per cause, one tick label per item', () => {
    const root = parse(renderFishbone(CHECKOUT));
    expect(root.querySelectorAll('g[data-bp^="causes."][data-bp$="label"]')).toHaveLength(3);
    expect(root.querySelectorAll('g[data-bl$=".items"] text')).toHaveLength(4);
    expect(root.querySelector('rect')).toBeTruthy(); // the effect head box
    const html = renderFishbone(CHECKOUT);
    expect(html).toContain('stroke="var(--ink)" stroke-width="1.5"'); // the spine
    // The effect wraps inside the head box, no clipping.
    expect(parse(html).querySelectorAll('g[data-bp="effect"] text').map((t) => t.text).join(' ')).toBe(
      'p95 checkout over 2s',
    );
    // Natural-size attributes match the viewBox, so the frame's max-width:100%
    // only ever shrinks the diagram — a small fishbone must not stretch.
    const svg = parse(html).querySelector('svg');
    const [, , vw, vh] = (svg?.getAttribute('viewBox') ?? '').split(' ');
    expect(svg?.getAttribute('width')).toBe(vw);
    expect(svg?.getAttribute('height')).toBe(vh);
  });

  it('alternates bones above and below the spine', () => {
    const html = renderFishbone({
      effect: 'E',
      causes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
    });
    const root = parse(html);
    const svg = root.querySelector('svg');
    const viewBox = (svg?.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
    const spineY = Number(
      (html.match(/M 26 ([\d.]+) L/) ?? [])[1] ?? NaN,
    );
    const labelYs = root
      .querySelectorAll('g[data-bp$=".label"] > text')
      .map((t) => Number(t.getAttribute('y')));
    expect(labelYs.filter((y) => y < spineY)).toHaveLength(2); // A, C above
    expect(labelYs.filter((y) => y > spineY)).toHaveLength(2); // B, D below
    for (const y of labelYs) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(viewBox[3] ?? 0);
    }
  });

  it('grows the viewBox with cause count instead of squeezing bones', () => {
    const wide = renderFishbone({
      effect: 'E',
      causes: Array.from({ length: 8 }, (_, i) => ({
        label: `Cause ${i + 1}`,
        items: ['one specific cause', 'another specific cause'],
      })),
    });
    const narrow = renderFishbone({ effect: 'E', causes: [{ label: 'Only' }] });
    const w = (html: string): number =>
      Number((parse(html).querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ')[2]);
    expect(w(wide)).toBeGreaterThan(w(narrow) * 2);
  });

  it('clamps a very long label with an ellipsis instead of clipping', () => {
    const long = Array.from({ length: 60 }, () => 'word').join(' '); // 299 chars
    const html = renderFishbone({ effect: long, causes: [{ label: long }] });
    // Both the head and the bone label wrap, then end in an ellipsis.
    expect((html.match(/…</g) ?? []).length).toBe(2);
    // No visible line exceeds the wrap budget by more than one glued word.
    for (const m of html.matchAll(/<text[^>]*>([^<]+)</g)) {
      expect((m[1] ?? '').length).toBeLessThan(30);
    }
  });

  it('carries the full text in a <title> exactly where truncation happened', () => {
    const long = Array.from({ length: 60 }, () => 'word').join(' ');
    // Items wrap to three lines before they cut: 24 words (119 chars) do not fit.
    const longItem = Array.from({ length: 24 }, () => 'item').join(' ');
    const clamped = renderFishbone({
      effect: long,
      causes: [{ label: long, items: [longItem, 'short item'] }],
    });
    // Root SVG title + effect + cause label + one item — the short item gets none.
    expect((clamped.match(/<title>/g) ?? []).length).toBe(4);
    expect(clamped).toContain(`<g data-bp="effect"><title>${long}</title>`);
    expect(clamped).toContain(`<g data-bp="causes.0.label"><title>${long}</title>`);
    expect(clamped).toContain(`<g data-bp="causes.0.items.0"><title>${longItem}</title>`);
    expect(clamped).not.toContain('<title>short item</title>');
    // Nothing truncated → only the root <title>Fishbone</title> remains.
    const fits = renderFishbone({
      effect: 'Slow builds',
      causes: [{ label: 'CI', items: ['Cold caches'] }],
    });
    expect((fits.match(/<title>/g) ?? []).length).toBe(1);
    expect(fits).toContain('<title>Fishbone</title>');
  });
});

describe('storymap', () => {
  const CHECKOUT = {
    backbone: [{ label: 'Browse', note: 'Find the product' }, { label: 'Pay' }],
    slices: [
      { label: 'MVP', cells: [['Search box'], [{ title: 'Card payment', tag: 'risky' }]] },
      { label: 'Later', cells: [['Filters', 'Saved carts'], []] },
    ],
  };

  it('renders one step per backbone entry and one band per slice', () => {
    const root = parse(renderStorymap(CHECKOUT));
    expect(root.querySelectorAll('.sm-step')).toHaveLength(2);
    expect(root.querySelectorAll('.sm-band')).toHaveLength(2);
    // Every band carries backbone-many cells — the refine guarantees the data,
    // the renderer must not drop empties.
    for (const band of parse(renderStorymap(CHECKOUT)).querySelectorAll('.sm-band')) {
      expect(band.querySelectorAll('.sm-cell')).toHaveLength(2);
    }
    expect(root.querySelector('.sm-step-note')?.text).toBe('Find the product');
  });

  it('normalizes string cards and object cards; tags render as pills', () => {
    const root = parse(renderStorymap(CHECKOUT));
    const titles = root.querySelectorAll('.sm-card-title').map((t) => t.text);
    expect(titles).toEqual(['Search box', 'Card payment', 'Filters', 'Saved carts']);
    expect(root.querySelectorAll('.sm-card-tag').map((t) => t.text)).toEqual(['risky']);
  });

  it('leaves an empty cell empty — no placeholder chrome', () => {
    const root = parse(renderStorymap(CHECKOUT));
    const cells = root.querySelectorAll('.sm-band')[1]?.querySelectorAll('.sm-cell') ?? [];
    expect(cells[1]?.querySelectorAll('.sm-card')).toHaveLength(0);
    expect((cells[1]?.innerHTML ?? 'x').trim()).toBe('');
  });

  it('tags data paths on steps, labels, cell containers, and cards', () => {
    const html = renderStorymap(CHECKOUT);
    expect(html).toContain('data-bl="backbone"');
    expect(html).toContain('data-bp="backbone.1.label"');
    expect(html).toContain('data-bl="slices"');
    expect(html).toContain('data-bp="slices.0.label"');
    expect(html).toContain('data-bl="slices.1.cells.1"');
    expect(html).toContain('data-bp="slices.1.cells.0.1"');
  });

  it('shares the row between flexible columns, down to a floor at 10 backbone steps (rows align, no squeeze)', () => {
    const one = renderStorymap({
      backbone: [{ label: 'Only' }],
      slices: [{ label: 'MVP', cells: [['A']] }],
    });
    expect(parse(one).querySelectorAll('.sm-step')).toHaveLength(1);
    const ten = renderStorymap({
      backbone: Array.from({ length: 10 }, (_, i) => ({ label: `Step ${i + 1}` })),
      slices: [
        { label: 'MVP', cells: Array.from({ length: 10 }, () => ['One card']) },
      ],
    });
    // Columns flex to fill the row; the row's min-width (the column floor ×
    // count) is what makes a long map scroll instead of squeezing columns.
    expect(ten).toContain(`min-width:${128 + 10 * 132}px`);
    expect(houseCss).toContain('.docskin .sm-colcell{flex:1 1 0;padding:4px 5px;min-width:132px;}');
    expect(parse(ten).querySelectorAll('.sm-card')).toHaveLength(10);
  });

  it('stacks six cards in one cell vertically and clamps a 400-char title with a full-text tooltip', () => {
    const long = Array.from({ length: 66 }, () => 'phrase').join(' '); // 461 chars
    const boundary = 'Configure the tax engine for cross-border B2B quotes'; // 52 chars — 2-line-clamp territory
    const html = renderStorymap({
      backbone: [{ label: 'Build' }],
      slices: [
        {
          label: 'MVP',
          cells: [[...Array.from({ length: 4 }, (_, i) => `Card ${i + 1}`), boundary, long]],
        },
      ],
    });
    const root = parse(html);
    expect(root.querySelectorAll('.sm-card')).toHaveLength(6);
    // Any card that can hit the 2-line clamp carries its full text as a hover
    // title — the 461-char card AND the boundary-length card; short ones don't.
    expect(html).toContain(`title="${long}"`);
    expect(html).toContain(`title="${boundary}"`);
    expect((html.match(/ title="/g) ?? []).length).toBe(2);
  });

  it('keeps context on horizontal scrolls: sticky-left gutters (pure CSS)', () => {
    const root = parse(renderStorymap(CHECKOUT));
    // Structure the sticky class attaches to: a gutter on the head AND on
    // every band. (A sticky-top head is NOT claimed: inside the overflow-x
    // scroll container, sticky top:0 can never stick against page scroll.)
    expect(root.querySelectorAll('.sm-head')).toHaveLength(1);
    expect(root.querySelectorAll('.sm-gutter')).toHaveLength(3); // head corner + 2 bands
    // The doc skin pins the gutter with an opaque background — no JS involved.
    expect(houseCss).toMatch(/\.sm-gutter\{[^}]*position:sticky;left:0[^}]*background:/);
    expect(houseCss).not.toMatch(/\.sm-head\{[^}]*position:sticky/);
  });
});

describe('slopegraph', () => {
  const CHANNELS = {
    left: '2023',
    right: '2025',
    unit: '%',
    items: [
      { label: 'Email', from: 48, to: 22 },
      { label: 'Chat', from: 20, to: 45, accent: 'teal' as const },
      { label: 'Phone', from: 32, to: 33 },
    ],
  };

  const textYs = (html: string, cls: string): number[] =>
    parse(html)
      .querySelectorAll(cls)
      .map((t) => Number(t.getAttribute('y')));

  it('draws two baselines, headers, and one line + two labels per item', () => {
    const html = renderSlopegraph(CHANNELS);
    const root = parse(html);
    expect(root.querySelectorAll('svg > line')).toHaveLength(2); // the baselines
    expect(root.querySelectorAll('g[data-bl="items"] > g')).toHaveLength(3);
    expect(root.querySelectorAll('text.t-eyebrow').map((t) => t.text)).toEqual(['2023', '2025']);
    expect(root.querySelectorAll('text[data-bp$=".from"]').map((t) => t.text)).toEqual([
      'Email 48%',
      'Chat 20%',
      'Phone 32%',
    ]);
    expect(root.querySelectorAll('text[data-bp$=".to"]')[0]?.text).toBe('22% Email');
  });

  it('positions by value: higher values sit higher on both sides', () => {
    const html = renderSlopegraph(CHANNELS);
    const [email, chat, phone] = textYs(html, 'text[data-bp$=".from"]');
    expect(email).toBeLessThan(phone ?? 0); // 48 above 32
    expect(phone).toBeLessThan(chat ?? 0); // 32 above 20
  });

  it('draws every endpoint at its true scaled value — slopes are facts (±0.5px)', () => {
    const items = [
      { label: 'Anchor low', from: 0, to: 100 },
      { label: 'Anchor high', from: 100, to: 0 },
      { label: 'Mid', from: 25, to: 60 },
      { label: 'Mid cluster', from: 25.5, to: 60.5 }, // labels dodge; endpoints must not
      { label: 'Tiny rise', from: 6, to: 9 }, // the critic's regression: must ASCEND
      { label: 'Steep', from: 2, to: 14 },
    ];
    const html = renderSlopegraph({ left: 'L', right: 'R', items });
    const lines = parse(html).querySelectorAll('g[data-bl="items"] > g > line:not([stroke="var(--rule-solid)"])');
    expect(lines).toHaveLength(6);
    const y1 = lines.map((l) => Number(l.getAttribute('y1')));
    const y2 = lines.map((l) => Number(l.getAttribute('y2')));
    // Recover the shared px/unit scale from the two anchors on the left column.
    const s = ((y1[0] ?? 0) - (y1[1] ?? 0)) / (100 - 0); // px per unit (y grows downward)
    expect(s).toBeGreaterThan(0);
    items.forEach((it, i) => {
      expect(Math.abs((y1[i] ?? 0) - ((y1[0] ?? 0) - it.from * s)), `y1 of ${it.label}`).toBeLessThan(0.5);
      expect(Math.abs((y2[i] ?? 0) - ((y1[0] ?? 0) - it.to * s)), `y2 of ${it.label}`).toBeLessThan(0.5);
    });
    // 6 → 9 rises: right endpoint strictly above the left one.
    expect(y2[4]).toBeLessThan(y1[4] ?? 0);
  });

  it('breaks right-side ties by left position: tied lines land on ONE y, labels stack in arrival order', () => {
    const items = [
      { label: 'a', from: 50.0, to: 12 },
      { label: 'b', from: 50.1, to: 12 },
      { label: 'c', from: 50.2, to: 12 },
    ];
    const html = renderSlopegraph({ left: 'Q1', right: 'Q4', items });
    const root = parse(html);
    const lines = root.querySelectorAll('g[data-bl="items"] > g > line:not([stroke="var(--rule-solid)"])');
    // All tied endpoints share the exact same y — no fabricated crossings possible.
    const y2s = new Set(lines.map((l) => l.getAttribute('y2')));
    expect(y2s.size).toBe(1);
    // Right labels stack in left order: c (highest from, topmost line) first.
    const rights = root
      .querySelectorAll('text[data-bp$=".to"]')
      .map((t) => ({ label: t.text, y: Number(t.getAttribute('y')) }))
      .sort((p, q) => p.y - q.y)
      .map((p) => p.label);
    expect(rights).toEqual(['12 c', '12 b', '12 a']);
  });

  it('draws a muted leader only where a label was displaced from its endpoint', () => {
    // Well-spread values: no dodging, no leaders.
    const spread = renderSlopegraph({
      left: 'L',
      right: 'R',
      items: [
        { label: 'A', from: 0, to: 100 },
        { label: 'B', from: 100, to: 0 },
      ],
    });
    expect(parse(spread).querySelectorAll('g[data-bl="items"] line[stroke="var(--rule-solid)"]')).toHaveLength(0);
    // A tight cluster forces dodged labels — each displaced one gets a leader
    // whose endpoint-side y equals the true endpoint y.
    const cluster = renderSlopegraph({
      left: 'L',
      right: 'R',
      items: [
        { label: 'A', from: 0, to: 50 },
        { label: 'B', from: 100, to: 50.1 },
        { label: 'C', from: 50, to: 50.2 },
        { label: 'D', from: 50.1, to: 49.9 },
      ],
    });
    const root = parse(cluster);
    const leaders = root.querySelectorAll('g[data-bl="items"] line[stroke="var(--rule-solid)"]');
    expect(leaders.length).toBeGreaterThan(0);
    // The two baselines give the column x positions.
    const axes = root
      .querySelectorAll('svg > line')
      .map((l) => Number(l.getAttribute('x1')))
      .sort((a, b) => a - b);
    const [leftX, rightX] = axes;
    const slopes = root.querySelectorAll('g[data-bl="items"] > g > line:not([stroke="var(--rule-solid)"])');
    const trueLeft = new Set(slopes.map((l) => l.getAttribute('y1')));
    const trueRight = new Set(slopes.map((l) => l.getAttribute('y2')));
    for (const ld of leaders) {
      const x2 = Number(ld.getAttribute('x2'));
      if (x2 > (rightX ?? 0)) {
        // Right-side leader: starts (y1) at a true endpoint y.
        expect(trueRight.has(ld.getAttribute('y1') ?? '')).toBe(true);
      } else {
        // Left-side leader: ends (y2) at a true endpoint y.
        expect(Number(ld.getAttribute('x1'))).toBeLessThan(leftX ?? 0);
        expect(trueLeft.has(ld.getAttribute('y2') ?? '')).toBe(true);
      }
    }
  });

  it('tags data paths and carries a per-item title "label: from → to unit"', () => {
    const html = renderSlopegraph(CHANNELS);
    expect(html).toContain('data-bl="items"');
    expect(html).toContain('data-bp="items.1"');
    expect(html).toContain('data-bp="items.0.from"');
    expect(html).toContain('data-bp="items.2.to"');
    expect(html).toContain('data-bp="left"');
    expect(html).toContain('<title>Email: 48% → 22%</title>');
  });

  it('colors an accented item and leaves the rest neutral', () => {
    const html = renderSlopegraph(CHANNELS);
    // The flagged item takes the skin's accent (whatever accent name it wrote);
    // the other two lines stay `muted`.
    expect(html).toContain('stroke="var(--accent)" stroke-width="1.75"');
    expect(html).toContain('class="t-sub c-accent"');
    expect((html.match(/stroke="var\(--muted\)" stroke-width="1\.25"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('renders a flat line when from equals to, and survives an all-equal domain', () => {
    const html = renderSlopegraph({
      left: 'Before',
      right: 'After',
      items: [
        { label: 'A', from: 5, to: 5 },
        { label: 'B', from: 5, to: 5 },
      ],
    });
    const lines = parse(html).querySelectorAll('g[data-bl="items"] > g > line:not([stroke="var(--rule-solid)"])');
    expect(lines).toHaveLength(2);
    for (const ln of lines) {
      expect(ln.getAttribute('y1')).toBe(ln.getAttribute('y2'));
    }
  });

  it('nudges clustered labels to at least 14px apart, preserving value order, and grows the viewBox', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      label: `Item ${i + 1}`,
      from: 50 + i * 0.1, // clustered within one pixel band
      to: 10 + (i % 3),
    }));
    const html = renderSlopegraph({ left: 'Q1', right: 'Q4', items });
    for (const side of ['text[data-bp$=".from"]', 'text[data-bp$=".to"]']) {
      const ys = textYs(html, side).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(14);
      }
    }
    // Value order preserved on the left: item 20 (highest from) sits on top.
    const left = textYs(html, 'text[data-bp$=".from"]');
    expect(Math.min(...left)).toBe(left[19]);
    // Every label fits inside the grown viewBox.
    const vb = (parse(html).querySelector('svg')?.getAttribute('viewBox') ?? '0 0 0 0')
      .split(' ')
      .map(Number);
    for (const y of [...textYs(html, 'text[data-bp$=".from"]'), ...textYs(html, 'text[data-bp$=".to"]')]) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(vb[3] ?? 0);
    }
  });

  it('handles negative values and truncates a long label with the full text in the title', () => {
    const longLabel = 'A very long channel label that keeps going well past the cut';
    const html = renderSlopegraph({
      left: 'Before',
      right: 'After',
      unit: 'ms',
      items: [
        { label: longLabel, from: -12, to: 4 },
        { label: 'Short', from: 3, to: -8 },
      ],
    });
    expect(html).toContain('…');
    expect(html).toContain(`<title>${longLabel}: -12 ms → 4 ms</title>`);
    const [a, b] = textYs(html, 'text[data-bp$=".from"]'); // -12 below 3
    expect(a).toBeGreaterThan(b ?? 0);
  });
});

describe('chart scatter with points (numeric axes)', () => {
  const QUAD = {
    kind: 'scatter' as const,
    xLabel: 'Effort',
    yLabel: 'Impact',
    points: [
      { x: 1, y: 8, size: 20, label: 'Quick win' },
      { x: 8, y: 9, size: 60, label: 'Big bet' },
      { x: 2, y: 2, label: 'Fill-in' },
      { x: 9, y: 1, size: 5, label: 'Time sink' },
    ],
    guides: {
      x: 5,
      y: 5,
      quadrants: ['Do first', 'Plan well', 'Fill in', 'Avoid'] as [string, string, string, string],
    },
  };

  it('draws one bubble per point with data paths and axis titles', () => {
    const root = parse(renderChart(QUAD));
    expect(root.querySelectorAll('g[data-bl="points"] circle')).toHaveLength(4);
    expect(root.querySelector('circle[data-bp="points.0"]')).toBeTruthy();
    expect(root.querySelector('text[data-bp="xLabel"]')?.text).toBe('Effort');
    expect(root.querySelector('text[data-bp="yLabel"]')?.text).toBe('Impact');
  });

  it('scales bubble radius from size on a sqrt scale within 4–18', () => {
    const root = parse(renderChart(QUAD));
    const rOf = (i: number): number =>
      Number(root.querySelector(`circle[data-bp="points.${i}"]`)?.getAttribute('r'));
    expect(rOf(2)).toBe(5); // no size → default
    expect(rOf(3)).toBe(4); // smallest size → r floor
    expect(rOf(1)).toBe(18); // largest size → r ceiling
    expect(rOf(0)).toBeGreaterThan(4);
    expect(rOf(0)).toBeLessThan(18);
  });

  it('draws dashed guides and all four quadrant labels (TL, TR, BL, BR)', () => {
    const html = renderChart(QUAD);
    const root = parse(html);
    expect(root.querySelector('line[data-bp="guides.x"]')?.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(root.querySelector('line[data-bp="guides.y"]')).toBeTruthy();
    const corners = [0, 1, 2, 3].map(
      (i) => root.querySelector(`text[data-bp="guides.quadrants.${i}"]`),
    );
    expect(corners.map((c) => c?.text)).toEqual(['Do first', 'Plan well', 'Fill in', 'Avoid']);
    // TL/BL anchor left of TR/BR, and TL/TR sit above BL/BR.
    const xOf = (c: (typeof corners)[number] | undefined): number => Number(c?.getAttribute('x'));
    const yOf = (c: (typeof corners)[number] | undefined): number => Number(c?.getAttribute('y'));
    expect(xOf(corners[0])).toBeLessThan(xOf(corners[1]));
    expect(yOf(corners[0])).toBeLessThan(yOf(corners[2]));
  });

  it('extends the domain to include a guide outside the data', () => {
    const html = renderChart({
      kind: 'scatter',
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      guides: { x: 10 },
    });
    const root = parse(html);
    const gx = Number(root.querySelector('line[data-bp="guides.x"]')?.getAttribute('x1'));
    const dots = root
      .querySelectorAll('g[data-bl="points"] circle')
      .map((c) => Number(c.getAttribute('cx')));
    // The guide sits inside the plot, to the right of every dot.
    expect(gx).toBeLessThanOrEqual(540);
    for (const cx of dots) expect(cx).toBeLessThan(gx);
  });

  it('keeps coincident dots in place, displaces their labels, and draws leaders', () => {
    const root = parse(
      renderChart({
        kind: 'scatter',
        points: [
          { x: 3, y: 3, size: 30, label: 'First' },
          { x: 3, y: 3, size: 30, label: 'Second' },
          { x: 3, y: 3, size: 70, label: 'Third' },
          { x: 6, y: 6 },
        ],
      }),
    );
    const dots = [0, 1, 2].map((i) => root.querySelector(`circle[data-bp="points.${i}"]`));
    expect(dots[0]?.getAttribute('cx')).toBe(dots[1]?.getAttribute('cx'));
    expect(dots[0]?.getAttribute('cy')).toBe(dots[2]?.getAttribute('cy'));
    // All three labels render, at three distinct positions.
    const spots = [0, 1, 2].map((i) => {
      const t = root.querySelector(`text[data-bp="points.${i}.label"]`);
      expect(t).toBeTruthy();
      return `${t?.getAttribute('x')},${t?.getAttribute('y')},${t?.getAttribute('style')}`;
    });
    expect(new Set(spots).size).toBe(3);
    // The displaced labels of the trio point back to their bubble via leaders.
    expect(root.querySelectorAll('line[stroke-width="0.75"]').length).toBeGreaterThanOrEqual(2);
  });

  it('40-point stress: no label box crosses any bubble or another label; leaders mark displaced labels', () => {
    // The same deterministic fixture the proof page uses.
    let seed = 42;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const points: Array<{ x: number; y: number; size?: number; label?: string }> = [];
    for (let i = 0; i < 36; i++) {
      const x = Math.round(rnd() * 200 - 50);
      const y = Math.round(rnd() * 900) / 10;
      const size = Math.round(rnd() * 100);
      points.push({ x, y, size, ...(i % 3 === 0 ? { label: `svc-${i}` } : {}) });
    }
    points.push({ x: 60, y: 45, size: 30, label: 'orders-api' });
    points.push({ x: 60, y: 45, size: 30, label: 'orders-worker' });
    points.push({ x: 60, y: 45, size: 12 });
    points.push({ x: 60, y: 45, size: 70, label: 'orders-cron' });
    const root = parse(renderChart({ kind: 'scatter', points, guides: { y: 50 } }));
    const circles = root.querySelectorAll('g[data-bl="points"] circle').map((c) => ({
      px: Number(c.getAttribute('cx')),
      py: Number(c.getAttribute('cy')),
      r: Number(c.getAttribute('r')),
    }));
    expect(circles).toHaveLength(40);
    const boxes = root.querySelectorAll('text[data-bp$=".label"]').map((t) => {
      const x = Number(t.getAttribute('x'));
      const y = Number(t.getAttribute('y'));
      const anchor = /text-anchor:(\w+)/.exec(t.getAttribute('style') ?? '')?.[1] ?? 'start';
      const w = t.text.length * 5.6;
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      return { txt: t.text, x0, x1: x0 + w, y0: y - 9, y1: y + 2 };
    });
    expect(boxes.length).toBeGreaterThan(0);
    // Zero label-box / circle intersections (closest-point test)…
    for (const b of boxes) {
      for (const c of circles) {
        const nx = Math.max(b.x0, Math.min(c.px, b.x1));
        const ny = Math.max(b.y0, Math.min(c.py, b.y1));
        const d2 = (c.px - nx) ** 2 + (c.py - ny) ** 2;
        expect(d2, `label "${b.txt}" crosses bubble at ${c.px},${c.py}`).toBeGreaterThanOrEqual(
          c.r * c.r,
        );
      }
    }
    // …and zero label-box / label-box intersections.
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a === undefined || b === undefined) continue;
        const hit = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(hit, `labels "${a.txt}" and "${b.txt}" overlap`).toBe(false);
      }
    }
  });

  it('truncates a 400-char label to ~40 chars and keeps the full text in <title>', () => {
    const long = 'A'.repeat(200) + ' ' + 'B'.repeat(199);
    const root = parse(
      renderChart({ kind: 'scatter', points: [{ x: 1, y: 1, label: long }, { x: 2, y: 2 }] }),
    );
    const label = root.querySelector('text[data-bp="points.0.label"]');
    expect(label?.querySelector('title')?.text).toBe(long);
    // The visible run is the 39-char head plus an ellipsis.
    expect(label?.text.startsWith('A'.repeat(39) + '…')).toBe(true);
  });

  it('handles negative values and a single point without clipping', () => {
    const one = parse(renderChart({ kind: 'scatter', points: [{ x: 0, y: 0 }] }));
    const dot = one.querySelector('g[data-bl="points"] circle');
    expect(Number(dot?.getAttribute('cx'))).toBeGreaterThan(0);
    expect(Number(dot?.getAttribute('cy'))).toBeGreaterThan(0);
    const neg = parse(
      renderChart({ kind: 'scatter', points: [{ x: -10, y: -5 }, { x: 10, y: 5 }] }),
    );
    for (const c of neg.querySelectorAll('g[data-bl="points"] circle')) {
      expect(Number(c.getAttribute('cx'))).toBeGreaterThanOrEqual(0);
      expect(Number(c.getAttribute('cy'))).toBeGreaterThanOrEqual(0);
      expect(Number(c.getAttribute('cx'))).toBeLessThanOrEqual(560);
      expect(Number(c.getAttribute('cy'))).toBeLessThanOrEqual(320);
    }
  });

  it('leaves the ordinal labels+series scatter path untouched', () => {
    const html = renderChart({
      kind: 'scatter',
      labels: ['Q1', 'Q2'],
      series: [
        { label: 'Platform', values: [40, 50] },
        { label: 'Product', values: [20, 30] },
      ],
    });
    expect(html).not.toContain('data-bl="points"');
    expect(parse(html).querySelectorAll('g[data-bl="series"] circle')).toHaveLength(4);
  });
});

describe('tree variant: org', () => {
  const TEAM = {
    variant: 'org' as const,
    nodes: [
      { id: 'ceo', label: 'Dana Reyes', role: 'CEO' },
      { id: 'eng', parent: 'ceo', label: 'Sam Ortiz', role: 'VP Engineering' },
      { id: 'ops', parent: 'ceo', label: 'Kim Lau', role: 'VP Operations' },
      { id: 'fe', parent: 'eng', label: 'Ada Boone', role: 'Frontend lead' },
      { id: 'be', parent: 'eng', label: 'Raj Patel', role: 'Backend lead' },
    ],
  };

  it('renders cards with roles inside the ORG diagram frame', () => {
    const html = renderTree(TEAM);
    expect(html).toContain('>ORG</span>');
    const root = parse(html);
    expect(root.querySelectorAll('g[data-bl="nodes"] > g')).toHaveLength(5);
    expect(root.querySelector('text[data-bp="nodes.0.role"]')?.text).toBe('CEO');
    expect(root.querySelector('text[data-bp="nodes.1.label"]')?.text).toBe('Sam Ortiz');
  });

  it('centers every parent over its children (tidy top-down layout)', () => {
    const root = parse(renderTree(TEAM));
    const xOf = (i: number): number =>
      Number(root.querySelector(`g[data-bp="nodes.${i}"] rect`)?.getAttribute('x'));
    // eng centered over fe + be…
    expect(xOf(1)).toBeCloseTo((xOf(3) + xOf(4)) / 2, 5);
    // …and the root centered over eng + ops.
    expect(xOf(0)).toBeCloseTo((xOf(1) + xOf(2)) / 2, 5);
  });

  it('stacks more than 6 leaf children into two bounded columns with no overlap', () => {
    const wide = {
      variant: 'org' as const,
      nodes: [
        { id: 'root', label: 'Root' },
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `c${i}`,
          parent: 'root',
          label: `Child ${i}`,
        })),
      ],
    };
    const root = parse(renderTree(wide));
    const cards = root.querySelectorAll('g[data-bl="nodes"] rect').map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
    }));
    expect(cards).toHaveLength(13);
    // The 12 leaves stack in two columns of six rows — width stays bounded.
    const vb = root.querySelector('svg')?.getAttribute('viewBox')?.split(' ') ?? [];
    expect(Number(vb[2])).toBeLessThan(700);
    const leafXs = new Set(cards.slice(1).map((c) => c.x));
    expect(leafXs.size).toBe(2);
    expect(new Set(cards.slice(1).map((c) => c.y)).size).toBe(6);
    // No two cards overlap.
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];
        if (a === undefined || b === undefined) continue;
        const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(hit, `cards ${i} and ${j} overlap`).toBe(false);
      }
    }
    // Trunk-and-stub connectors: one stub reaches each stacked card.
    expect(root.querySelectorAll('path[stroke="var(--muted)"]').length).toBeGreaterThanOrEqual(13);
  });

  it('does not stack when no parent exceeds 6 leaf children (one row per level)', () => {
    const root = parse(renderTree(TEAM));
    const ys = new Set(
      root.querySelectorAll('g[data-bl="nodes"] rect').map((r) => r.getAttribute('y')),
    );
    // Three depths → exactly three ranks, all cards on level rows.
    expect(ys.size).toBe(3);
    expect([...ys]).toEqual(['16', '108', '200']);
  });

  it('renders an orphan parent ref as a root instead of throwing', () => {
    const root = parse(
      renderTree({
        variant: 'org' as const,
        nodes: [
          { id: 'a', label: 'A', parent: 'ghost' },
          { id: 'b', label: 'B', parent: 'a' },
        ],
      }),
    );
    expect(root.querySelectorAll('g[data-bl="nodes"] > g')).toHaveLength(2);
    expect(root.querySelectorAll('path[stroke="var(--muted)"]')).toHaveLength(1);
  });

  it('wraps a 400-char label to at most three lines inside the card, ends the cut with "…", and keeps the full text in <title>', () => {
    const long = Array.from({ length: 50 }, () => 'verylong').join(' ');
    const root = parse(
      renderTree({ variant: 'org' as const, nodes: [{ id: 'a', label: long, role: 'R'.repeat(60) }] }),
    );
    const g = root.querySelector('g[data-bp="nodes.0"]');
    const lines = g?.querySelectorAll('text.t-name') ?? [];
    expect(lines).toHaveLength(3);
    for (const ln of lines) expect(textWidth(ln.text, FONT.name)).toBeLessThanOrEqual(148 - 12);
    expect(lines[2]?.text.endsWith('…')).toBe(true);
    expect(g?.querySelector('title')?.text).toContain(long);
    // The role wraps to two lines at most; the second ends in "…".
    const roles = g?.querySelectorAll('text.t-sub') ?? [];
    expect(roles).toHaveLength(2);
    expect(roles[1]?.text.endsWith('…')).toBe(true);
  });

  it('renders a single node and leaves the default + issue variants untouched', () => {
    const solo = parse(renderTree({ variant: 'org' as const, nodes: [{ id: 'a', label: 'A' }] }));
    expect(solo.querySelectorAll('g[data-bl="nodes"] > g')).toHaveLength(1);
    const plain = renderTree({ nodes: [{ id: 'a', label: 'A' }] });
    expect(plain).toContain('class="tree-list"');
    expect(plain).not.toContain('<svg');
    const issue = renderTree({ variant: 'issue' as const, nodes: [{ id: 'a', label: 'A' }] });
    expect(issue).toContain('>MECE</span>');
  });
});
