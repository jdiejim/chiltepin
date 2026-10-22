/**
 * The category hues — the skin's second colour channel (`DESIGN.md` › Two
 * channels). Hue says what kind of thing a mark is (a node family, a group's
 * zone) and is picked by the renderer from `kind` / group; accent keeps the
 * one focal answer. These tests pin the family table, the AI kit, the panel
 * hue assignment, the legend, the tokens and their contrast, and that the
 * schema's field notes name the same vocabulary the renderer draws.
 */

import { describe, expect, it } from 'vitest';
import { blockContract, formatBlockContract } from 'chiltepin-core';
import { renderBlock } from '../blocks/blockGraph.js';
import { renderC4 } from '../blocks/c4.js';
import { renderThreatmodel } from '../blocks/threatmodel.js';
import { AI_KIT, AI_KIT_KINDS, KNOWN_NODE_KINDS, nodeGlyph, nodeSkin } from '../svg/blockStyle.js';
import { gridGroupsSvg, groupHues } from '../svg/gridGroups.js';
import { assignPanelHues, HUES, type Hue } from '../svg/hues.js';
import { DARK_SET, LIGHT_SET } from '../css.js';

const FAMILY: Readonly<Record<Hue | 'neutral', readonly string[]>> = {
  blue: ['service', 'worker', 'function', 'host', 'pod', 'deployment', 'cron', 'tool'],
  green: ['gateway', 'lb', 'cdn', 'dns', 'waf', 'auth', 'ingress', 'guard', 'guardrail', 'policy'],
  amber: ['db', 'postgres', 'cache', 'bucket', 'warehouse', 'search', 'registry', 'secrets', 'config', 'memory', 'vector', 'embeddings'],
  teal: ['queue', 'topic', 'stream', 'kafka', 'producer', 'consumer', 'webhook', 'email'],
  violet: ['agent', 'llm', 'model', 'eval', 'judge', 'grader', 'prompt', 'ml', 'ai'],
  rose: ['client', 'user', 'users', 'browser', 'mobile', 'human', 'reviewer'],
  neutral: ['external', 'namespace', 'billing', ''],
};

describe('node families', () => {
  for (const [hue, kinds] of Object.entries(FAMILY)) {
    it(`${hue}: ${kinds.filter(Boolean).join(', ')}`, () => {
      for (const k of kinds) expect(nodeSkin(k).hue, k || '(none)').toBe(hue === 'neutral' ? undefined : hue);
    });
  }

  it('every documented kind is either in a family or deliberately neutral', () => {
    const neutral = KNOWN_NODE_KINDS.filter((k) => nodeSkin(k).hue === undefined);
    expect(neutral.sort()).toEqual(['external', 'namespace']);
  });
});

describe('the AI kit', () => {
  const CHIP: Readonly<Record<string, string>> = {
    agent: 'AGENT',
    llm: 'LLM',
    tool: 'TOOL',
    memory: 'MEMORY',
    vector: 'VECTOR',
    human: 'HUMAN',
    guard: 'GUARD',
    eval: 'EVAL',
    prompt: 'PROMPT',
  };

  it('every kit kind and alias is a documented kind with its own chip and a glyph', () => {
    for (const [kind, aliases] of Object.entries(AI_KIT)) {
      for (const k of [kind, ...aliases]) {
        expect(KNOWN_NODE_KINDS, k).toContain(k);
        expect(nodeSkin(k).chip, k).toBe(CHIP[kind]);
        expect(nodeGlyph(k, 0, 0, 'var(--ink)'), k).not.toBe('');
      }
    }
    expect(new Set(Object.values(CHIP)).size).toBe(Object.keys(CHIP).length);
  });

  it('draws each kit kind in a block with its chip in the family hue', () => {
    const nodes = AI_KIT_KINDS.map((k, i) => ({ id: `n${i}`, kind: k, name: k, col: (i % 5) + 1, row: Math.floor(i / 5) + 1 }));
    const html = renderBlock({ nodes });
    for (const k of AI_KIT_KINDS) {
      const sk = nodeSkin(k);
      expect(html, k).toContain(`class="blk-chip t-eyebrow c-${sk.hue}"`);
      expect(html, k).toContain(`>${sk.chip}</text>`);
    }
    expect(html).toContain('stroke-dasharray="4 3"'); // the human gate is dashed
  });

  it('draws agent and llm as the agent card: `tech` becomes the mono model chip', () => {
    const html = renderBlock({
      nodes: [
        { id: 'a', kind: 'agent', name: 'Orchestrator', tech: 'claude-sonnet-4-6', col: 1, row: 1 },
        { id: 'b', kind: 'model', name: 'Model API', tech: 'claude-haiku-4-5', col: 2, row: 1 },
        { id: 'c', kind: 'tool', name: 'Billing tools', tech: 'invoices', col: 3, row: 1 },
      ],
    });
    expect(html).toContain('class="al-chip">claude-sonnet-4-6</text>');
    expect(html).toContain('class="al-chip">claude-haiku-4-5</text>');
    expect(html).not.toContain('class="al-chip">invoices</text>'); // a tool keeps the plain sublabel
    expect(html).toContain('class="blk-tech t-sub">invoices</text>');
  });

  it('the legend lists each used kind as a chip in its hue', () => {
    const html = renderBlock({
      nodes: [
        { id: 'a', kind: 'agent', name: 'A', col: 1, row: 1 },
        { id: 'v', kind: 'vector', name: 'V', col: 2, row: 1 },
        { id: 'h', kind: 'human', name: 'H', col: 3, row: 1 },
      ],
    });
    expect(html).toContain('<span class="lg-chip t-eyebrow c-violet">AGENT</span>');
    expect(html).toContain('<span class="lg-chip t-eyebrow c-amber">VECTOR</span>');
    expect(html).toContain('<span class="lg-chip t-eyebrow c-rose lg-dashed">HUMAN</span>');
  });
});

describe('the accent keeps its job', () => {
  it('the focal node takes the accent, not its family hue', () => {
    const html = renderBlock({
      nodes: [
        { id: 'gw', kind: 'gateway', name: 'Gateway', col: 1, row: 1 },
        { id: 'api', kind: 'service', name: 'API', col: 2, row: 1 },
      ],
      edges: [{ from: 'gw', to: 'api' }],
    });
    const gw = html.slice(html.indexOf('data-bp="nodes.0"'), html.indexOf('data-bp="nodes.1"'));
    expect(gw).toContain('fill="var(--accent-tint)"');
    expect(gw).toContain('class="blk-chip t-eyebrow c-accent"');
    expect(gw).not.toContain('--hue-green');
    const api = html.slice(html.indexOf('data-bp="nodes.1"'));
    expect(api).toContain('fill="var(--hue-blue-tint)"');
  });
});

describe('panel hues (groups and layers)', () => {
  const GEO = { xOf: (c: number) => 100 + (c - 1) * 200, yOf: (r: number) => 100 + (r - 1) * 120, cellW: 160, cellH: 80, gapX: 40, gapY: 40, skin: true };

  it('unnamed panels take distinct hues in a fixed order, and the result is deterministic', () => {
    const colors = [undefined, undefined, undefined, undefined];
    const a = assignPanelHues(colors);
    expect(a).toEqual(['blue', 'amber', 'violet', 'teal']);
    expect(assignPanelHues(colors)).toEqual(a);
    // Seven panels: six distinct hues, then the rotation repeats.
    const seven = assignPanelHues(Array.from({ length: 7 }, () => undefined));
    expect(new Set(seven.slice(0, 6)).size).toBe(6);
  });

  it('a named hue is kept, a hex gets none, and auto picks skip the named ones', () => {
    expect(assignPanelHues(['blue', undefined, '#0e54a1'])).toEqual(['blue', 'amber', undefined]);
    expect(assignPanelHues(['Teal', undefined], [], false)).toEqual(['teal', undefined]);
  });

  it('a group prefers the family most of its nodes share', () => {
    const groups = [
      { col: 1, row: 1, label: 'Data' },
      { col: 2, row: 1, label: 'Edge' },
    ];
    const members = [
      { col: 1, row: 1, hue: 'amber' as const },
      { col: 2, row: 1, hue: 'green' as const },
    ];
    expect(groupHues(groups, members)).toEqual(['amber', 'green']);
    // Two groups that want the same hue: the second takes the next free one.
    expect(groupHues(groups, [{ col: 1, row: 1, hue: 'amber' }, { col: 2, row: 1, hue: 'amber' }])).toEqual(['amber', 'blue']);
  });

  it('a nested group repeats its outermost group’s hue unless it names its own', () => {
    const groups = [
      { id: 'region', col: 1, row: 1, cols: 4, rows: 2, label: 'Region' },
      { id: 'zone', parent: 'region', col: 1, row: 1, cols: 2, rows: 2, label: 'Zone' },
      { id: 'subnet', parent: 'zone', col: 1, row: 1, label: 'Subnet' },
      { id: 'own', parent: 'region', col: 3, row: 1, label: 'Own', color: 'rose' },
      { col: 6, row: 1, label: 'Beside' },
    ];
    expect(groupHues(groups, [])).toEqual(['blue', 'blue', 'blue', 'rose', 'amber']);
    // Geometric nesting (no `parent`) follows the same rule.
    expect(groupHues([{ col: 1, row: 1, cols: 3, rows: 2, label: 'VPC' }, { col: 1, row: 1, cols: 3, rows: 1, label: 'Public' }], [])).toEqual(['blue', 'blue']);
  });

  it('draws the panel in the hue tint with the tab in the hue', () => {
    const svg = gridGroupsSvg([{ col: 1, row: 1, label: 'Zone', color: 'teal' }], GEO);
    expect(svg).toContain('fill="var(--hue-teal-tint)"');
    expect(svg).toContain('class="t-eyebrow c-teal">Zone</text>');
  });

  it('threat-model trust boundaries stay neutral (no auto hue)', () => {
    const html = renderThreatmodel({
      boundaries: [{ col: 1, row: 1, cols: 2, label: 'Internet' }],
      nodes: [
        { id: 'a', name: 'User', col: 1, row: 1 },
        { id: 'b', name: 'API', col: 2, row: 1 },
      ],
    });
    expect(html).not.toContain('--hue-');
  });

  it('block layers take a hue from their nodes, else the rotation', () => {
    const html = renderBlock({
      layers: [{ label: 'Clients' }, { label: 'Data' }, { label: 'Misc', color: 'violet' }],
      nodes: [
        { id: 'a', kind: 'browser', name: 'Web', layer: 0 },
        { id: 'b', kind: 'db', name: 'DB', layer: 1 },
        { id: 'c', kind: 'thing', name: 'X', layer: 2 },
      ],
    });
    expect(html).toContain('class="layer-label t-eyebrow c-rose">Clients</text>');
    expect(html).toContain('class="layer-label t-eyebrow c-amber">Data</text>');
    expect(html).toContain('class="layer-label t-eyebrow c-violet">Misc</text>');
  });
});

describe('c4 elements', () => {
  it('a person is rose, a system blue, a store amber, an external neutral', () => {
    const html = renderC4({
      nodes: [
        { id: 'p', kind: 'person', name: 'Shopper', col: 1, row: 1 },
        { id: 's', kind: 'system', name: 'Shop', col: 2, row: 1 },
        { id: 'x', kind: 'external', name: 'Bank', col: 3, row: 1 },
        { id: 'd', kind: 'store', name: 'DB', col: 4, row: 1 },
        { id: 't', kind: 'system', name: 'Other', col: 5, row: 1 },
      ],
    });
    const node = (i: number): string => html.slice(html.indexOf(`data-bp="nodes.${i}"`), html.indexOf(`data-bp="nodes.${i + 1}"`) === -1 ? undefined : html.indexOf(`data-bp="nodes.${i + 1}"`));
    expect(node(0)).toContain('fill="var(--hue-rose-tint)"');
    expect(node(0)).toContain('c-rose');
    expect(node(1)).toContain('fill="var(--hue-blue-tint)"');
    expect(node(2)).not.toContain('--hue-');
    expect(node(3)).toContain('fill="var(--hue-amber-tint)"');
  });
});

/* ── tokens ────────────────────────────────────────────────────────────── */

function tokens(set: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of set.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1] ?? '', (m[2] ?? '').trim());
  return out;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('hue tokens', () => {
  for (const [name, set] of [
    ['dark', DARK_SET],
    ['light', LIGHT_SET],
  ] as const) {
    it(`${name}: every hue and its tint are defined as opaque hex`, () => {
      const t = tokens(set);
      for (const h of HUES) {
        expect(t.get(`hue-${h}`), h).toMatch(/^#[0-9a-f]{6}$/);
        expect(t.get(`hue-${h}-tint`), h).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it(`${name}: a hue clears 4.5:1 as small text on paper, paper-2 and its own tint; ink and muted clear the tint`, () => {
      const t = tokens(set);
      const paper = t.get('paper') ?? '';
      const paper2 = t.get('paper-2') ?? '';
      for (const h of HUES) {
        const ink = t.get(`hue-${h}`) ?? '';
        const tint = t.get(`hue-${h}-tint`) ?? '';
        expect(ratio(ink, paper), `${h} on paper`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ink, paper2), `${h} on paper-2`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ink, tint), `${h} on its tint`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(t.get('ink') ?? '', tint), `ink on ${h} tint`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(t.get('muted') ?? '', tint), `muted on ${h} tint`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

/* ── the schema says what the renderer draws ───────────────────────────── */

describe('field notes in `chiltepin block`', () => {
  it('the block kind note names every AI-kit kind and alias', () => {
    const note = blockContract('block').notes.find((n) => n.fields.includes('nodes[].kind'))?.note ?? '';
    for (const k of AI_KIT_KINDS) expect(note, k).toMatch(new RegExp(`\\b${k}\\b`));
  });

  it('the group and layer colour note names every hue', () => {
    const text = formatBlockContract('block');
    expect(text).toContain('Field notes');
    const note = blockContract('block').notes.find((n) => n.fields.includes('groups[].color'))?.note ?? '';
    expect(blockContract('block').notes.find((n) => n.fields.includes('layers[].color'))?.note).toBe(note);
    for (const h of HUES) expect(note, h).toContain(h);
    expect(blockContract('flow').notes.some((n) => n.fields === 'groups[].color')).toBe(true);
  });

  it('flow names its AI kinds, guard and eval included', () => {
    const note = blockContract('flow').notes.find((n) => n.fields === 'nodes[].kind')?.note ?? '';
    for (const k of ['agent', 'llm', 'tool', 'memory', 'human', 'guard', 'eval']) expect(note, k).toContain(k);
  });
});
