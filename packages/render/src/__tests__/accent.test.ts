/**
 * The one-accent rule (`DESIGN.md`): a diagram spends `accent` on one focal
 * thing. This test is the enforcement.
 *
 * **What counts as a mark.** An element is accent-carrying when it has an
 * inline `fill` / `stroke` / `style` naming `var(--accent…)`, or when it
 * matches a `css.ts` rule that paints `color` / `fill` / `stroke` / `border` /
 * `background` / `box-shadow` with the accent. Three things are excluded, so a
 * mark means one *visual* element:
 *
 * - an element inside another accent-carrying element (a chip inside an
 *   accented card is part of that card);
 * - `<text>` — a label is part of the shape it names, and the shape is the
 *   mark;
 * - legend swatches and shared `<defs>` — they describe the encoding or
 *   define the marker, they do not spend it.
 *
 * **What the test asserts.** `ACCENT` below carries one row per block type, so
 * a new block type cannot be added without saying where its accent comes from.
 * Every row is checked against the shipped catalog template, and the blocks
 * whose accent could grow with the data are checked again at twelve items:
 *
 * - `renderer` — the renderer picks the focal thing from the data. The count
 *   must not grow with the data.
 * - `author` — the accent tracks a value the author wrote per item
 *   (`tone: active`, `status: current`). Strip the value and the block must
 *   render zero accent marks: the renderer adds none of its own.
 * - `none` — this renderer never spends accent.
 *
 * A focal thing may be drawn as several marks when the thing itself is
 * several marks — `spans` accents the critical path (a connected chain),
 * `flow` accents each arrival that ends well (a node plus the edge into it).
 * Those two are checked structurally, not counted: every accented mark must
 * belong to the one thing.
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { BLOCK_TEMPLATES, BLOCK_TYPES, parseDocument, type BlockType } from 'chiltepin-core';
import { houseCss } from '../css.js';
import { renderDocument } from '../document.js';

/* ── counting ───────────────────────────────────────────────────────────── */

const PAINTS_ACCENT =
  /^\s*(color|fill|stroke|background|background-color|border|border-color|border-left|border-right|border-top|border-bottom|box-shadow|outline)\s*:/;

/** Every selector in `css.ts` whose rule paints something with the accent. */
function accentSelectors(css: string): string[] {
  const out = new Set<string>();
  const rules = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rules.exec(css)) !== null) {
    const selector = (m[1] ?? '').trim();
    const decls = m[2] ?? '';
    if (selector.startsWith('@') || selector.startsWith(':root')) continue;
    if (!decls.split(';').some((d) => PAINTS_ACCENT.test(d) && /var\(--accent/.test(d))) continue;
    for (const one of selector.split(',')) {
      // Pseudo-classes and pseudo-elements are dropped: the test is about
      // which elements carry the paint, not about which state they are in.
      const clean = one
        .replace(/::?[a-z-]+(\([^)]*\))?/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean.length > 0) out.add(clean);
    }
  }
  return [...out];
}

const SELECTORS = accentSelectors(houseCss);

function ancestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentNode; p != null; p = p.parentNode) out.push(p);
  return out;
}

/** Chrome that describes or defines the accent rather than spending it. */
function isFurniture(el: HTMLElement): boolean {
  for (const node of [el, ...ancestors(el)]) {
    if ((node.rawTagName ?? '').toLowerCase() === 'defs') return true;
    if ((node.getAttribute('class') ?? '').split(/\s+/).includes('lg-sw')) return true;
  }
  return false;
}

/** The accent-carrying elements of the first block on the page. */
function accentMarks(html: string): HTMLElement[] {
  // `<pre>` is parsed like any element (the parser keeps it raw by default,
  // and it is the presence of the key that keeps it raw): a `code` block's
  // highlighted lines live inside one.
  const page = parse(html, { blockTextElements: { script: true, noscript: true, style: true } });
  const box = page.querySelector('.section-block');
  const inScope = (el: HTMLElement): boolean => box === null || el === box || ancestors(el).includes(box);

  const hits = new Set<HTMLElement>();
  for (const selector of SELECTORS) {
    let found: HTMLElement[] = [];
    try {
      found = page.querySelectorAll(selector);
    } catch {
      continue; // a selector this parser cannot read matches nothing
    }
    for (const el of found) if (inScope(el)) hits.add(el);
  }
  for (const el of page.querySelectorAll('[fill],[stroke],[style]')) {
    const painted = `${el.getAttribute('fill') ?? ''} ${el.getAttribute('stroke') ?? ''} ${el.getAttribute('style') ?? ''}`;
    if (/var\(--accent/.test(painted) && inScope(el)) hits.add(el);
  }
  for (const el of [...hits]) {
    const tag = (el.rawTagName ?? '').toLowerCase();
    if (tag === 'text' || tag === 'tspan' || isFurniture(el)) hits.delete(el);
  }
  return [...hits].filter((el) => !ancestors(el).some((p) => hits.has(p)));
}

function render(type: string, body: string): string {
  const fence = '```' + type + '\n' + body.replace(/^```[a-z]*\n/, '').replace(/\n?```\n?$/, '') + '\n```\n';
  return renderDocument(parseDocument(fence, 'accent'));
}

const markCount = (type: string, body: string): number => accentMarks(render(type, body)).length;

/** The `data-bp` path of the nearest ancestor that carries one. */
function bpOf(el: HTMLElement): string | undefined {
  for (const node of [el, ...ancestors(el)]) {
    const bp = node.getAttribute('data-bp');
    if (bp !== undefined && bp !== null) return bp;
  }
  return undefined;
}

/* ── the rule, one row per block type ───────────────────────────────────── */

interface AccentRule {
  /** Where the accent comes from. */
  readonly source: 'none' | 'renderer' | 'author';
  /** Marks the shipped catalog template may carry. */
  readonly catalogMax: number;
  /**
   * Set when the one focal thing is *drawn* as several marks — a path, a
   * column, a node plus the edge into it. Required above two marks, and it
   * exempts the block from the "does not grow" check, which is replaced by a
   * structural one: every mark must belong to the same thing.
   */
  readonly oneThingManyMarks?: true;
  /** The one focal thing the accent names. */
  readonly why: string;
}

const NONE: AccentRule = { source: 'none', catalogMax: 0, why: 'spends no accent' };

const ACCENT: Record<BlockType, AccentRule> = {
  // ── narrative & prose
  meta: NONE,
  callout: { source: 'author', catalogMax: 0, why: 'a `tip` callout takes the accent rule; the author picks the tone' },
  prose: NONE,
  glossary: NONE,
  figure: NONE,
  faq: NONE,
  divider: NONE,
  bignumber: NONE,
  takeaways: NONE,
  pullquote: { source: 'renderer', catalogMax: 1, why: 'the quote is the focal thing — one rule down its edge' },
  // ── tables & code
  table: NONE,
  stats: NONE,
  code: { source: 'author', catalogMax: 1, why: 'the lines the author named in `highlight` — one band per line, none without it' },
  slo: NONE,
  // ── API
  endpoint: { source: 'renderer', catalogMax: 1, why: 'the method pill — the diagram chrome DESIGN.md names' },
  layers: NONE,
  // ── architecture
  c4: { source: 'renderer', catalogMax: 1, why: 'the one system in scope of a context diagram; none at the deeper levels' },
  uml: NONE,
  frontend: { source: 'renderer', catalogMax: 1, why: 'the entry node' },
  cluster: NONE,
  block: { source: 'renderer', catalogMax: 1, why: 'the gateway / entry node' },
  felogic: NONE,
  archmap: NONE,
  // ── flows & state
  sequence: { source: 'renderer', catalogMax: 1, why: 'the last response back to the caller — the answer' },
  flow: { source: 'renderer', catalogMax: 2, oneThingManyMarks: true, why: 'each arrival that ends well: an `end` node and the edge into it' },
  state: { source: 'renderer', catalogMax: 4, oneThingManyMarks: true, why: 'the final state and the edge into it (a ringed terminal is three marks)' },
  dfd: { source: 'renderer', catalogMax: 1, why: 'the entry process' },
  swimlane: { source: 'author', catalogMax: 1, why: 'the step the author marked `accent: true` — the focal handoff' },
  steps: NONE,
  cycle: NONE,
  saga: { source: 'renderer', catalogMax: 3, oneThingManyMarks: true, why: 'the step that fails — one card, drawn as body, badge and chip' },
  agentloop: { source: 'renderer', catalogMax: 2, oneThingManyMarks: true, why: 'the model step, and the edge that closes the loop' },
  // ── data model
  erd: { source: 'renderer', catalogMax: 1, why: 'the aggregate root' },
  // ── charts & overviews
  tree: NONE,
  pyramid: NONE,
  journey: NONE,
  gantt: { source: 'renderer', catalogMax: 1, why: 'the critical milestone bar' },
  graph: NONE,
  quadrant: NONE,
  chart: NONE,
  heatmap: NONE,
  sankey: { source: 'author', catalogMax: 0, why: 'the flows out of the node the author flagged; unflagged flows take their source hue' },
  treemap: { source: 'renderer', catalogMax: 1, why: 'the largest tile' },
  slopegraph: { source: 'renderer', catalogMax: 3, oneThingManyMarks: true, why: 'the series that moves most — line plus its two end dots' },
  gitgraph: { source: 'renderer', catalogMax: 3, oneThingManyMarks: true, why: 'the head commit — dot, ring and the edge into it' },
  venn: NONE,
  wardley: NONE,
  storymap: NONE,
  fishbone: { source: 'renderer', catalogMax: 1, why: 'the spine head — the effect the bones explain' },
  // ── planning & backlogs
  userstory: NONE,
  timeline: { source: 'author', catalogMax: 2, why: 'the item the author marked `status: current`' },
  kanban: NONE,
  proscons: NONE,
  cvt: NONE,
  agenda: NONE,
  list: NONE,
  stories: NONE,
  pattern: NONE,
  gallery: NONE,
  changelog: NONE,
  risk: { source: 'author', catalogMax: 1, why: 'the status the author wrote (`mitigating`)' },
  statustable: { source: 'author', catalogMax: 0, why: 'the `amber` status the author wrote' },
  rollout: { source: 'author', catalogMax: 1, why: 'the stage the author marked `status: current`' },
  // A near-budget row is a warning (`hue-amber`), a miss is `negative`: no accent.
  perfbudget: NONE,
  percentiles: { source: 'renderer', catalogMax: 1, why: 'the p99 dot of a row inside its SLO — the tail is the answer; rows over the SLO take negative' },
  timing: { source: 'author', catalogMax: 1, why: 'the state the author marked with a non-red accent (`half-open: amber`)' },
  threatmodel: NONE,
  neuralnet: NONE,
  mindmap: { source: 'author', catalogMax: 6, oneThingManyMarks: true, why: 'one flagged branch — its node, its sub-branches, and the links between them — takes the accent; several take the category hues' },
  usecase: { source: 'author', catalogMax: 1, why: 'the case the author named in `focus` — the one the doc is about' },
  pkg: NONE,
  modelcard: NONE,
  audit: { source: 'author', catalogMax: 1, why: 'the finding the author marked `status: fixing` — the one being worked' },
  checklist: { source: 'author', catalogMax: 1, why: 'the item the author marked `partial` — neither pass nor fail, the one to look at' },
  chevrons: { source: 'author', catalogMax: 1, why: 'the step the author named as `current`' },
  roadmap: { source: 'author', catalogMax: 2, oneThingManyMarks: true, why: 'the items the author marked `status: current` — the outline and the bold label of each' },
  // ── business & decisions
  matrix: NONE,
  anatomy: NONE,
  composition: { source: 'renderer', catalogMax: 1, why: 'the result card — what the composition adds up to' },
  drivers: NONE,
  options: { source: 'author', catalogMax: 1, why: 'the option the author marked chosen' },
  spec: NONE,
  envelope: { source: 'renderer', catalogMax: 1, why: 'the result line' },
  swot: NONE,
  // `at risk` is a warning (`hue-amber`), `off track` is `negative`: no accent.
  okr: NONE,
  persona: NONE,
  team: NONE,
  scorecard: { source: 'renderer', catalogMax: 4, oneThingManyMarks: true, why: 'the winning column — one column, drawn as its cells' },
  scqa: { source: 'renderer', catalogMax: 1, why: 'the answer' },
  benchmark: { source: 'author', catalogMax: 4, oneThingManyMarks: true, why: 'the subject the author featured — one column' },
  harvey: { source: 'author', catalogMax: 5, oneThingManyMarks: true, why: 'the option the author recommended — one column' },
  scenarios: { source: 'author', catalogMax: 5, oneThingManyMarks: true, why: 'the scenario the author made the base case — one column' },
  eventcontract: { source: 'author', catalogMax: 2, why: 'the fields the author marked key' },
  // ── design system
  wireframe: NONE,
  palette: NONE,
  typescale: NONE,
  dodont: NONE,
  inventory: NONE,
  // ── algorithms
  array: { source: 'author', catalogMax: 2, why: 'the cells the author toned `active` / `target`' },
  linkedlist: { source: 'author', catalogMax: 3, oneThingManyMarks: true, why: 'the nodes the author toned `active` / `target`' },
  bintree: { source: 'author', catalogMax: 2, why: 'the nodes the author toned `active` / `target`' },
  hashmap: { source: 'renderer', catalogMax: 1, why: 'the bucket the walkthrough lands in' },
  packet: { source: 'renderer', catalogMax: 1, why: 'the field the block is about' },
  // ── AI & agents
  trace: { source: 'author', catalogMax: 2, why: 'the assistant turns the author wrote' },
  prompt: { source: 'author', catalogMax: 0, why: 'the assistant block and its variables' },
  context: NONE,
  spans: { source: 'renderer', catalogMax: 2, oneThingManyMarks: true, why: 'the critical path — one chain through the trace' },
};

/* ── samples that grow ──────────────────────────────────────────────────── */

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Blocks whose accent could grow with the data, at 1 item and at 12. */
const GROWERS: Record<string, (n: number, marked: boolean) => string> = {
  code: (n, marked) => 'code: |\n' + range(n).map((i) => `  line ${i}`).join('\n') + (marked ? `\nhighlight: "1-${n}"` : ''),
  spans: (n) =>
    'spans:\n' +
    range(n)
      .map((i) => `  - { id: s${i}, service: svc${i % 3}, name: step ${i}, start: ${i * 10}, duration: ${30 - i}${i > 0 ? `, parent: s${i - 1}` : ''} }`)
      .join('\n'),
  array: (n, marked) => 'items:\n' + range(n).map((i) => `  - { value: ${i}${marked ? ', tone: active' : ''} }`).join('\n'),
  linkedlist: (n, marked) => 'nodes:\n' + range(n).map((i) => `  - { value: n${i}${marked ? ', tone: active' : ''} }`).join('\n'),
  bintree: (n, marked) =>
    'nodes:\n' +
    range(n)
      .map(
        (i) =>
          `  - { id: b${i}, value: ${i}${marked ? ', tone: active' : ''}` +
          (i > 0 ? `, parent: b${Math.floor((i - 1) / 2)}, side: ${i % 2 === 1 ? 'left' : 'right'}` : '') +
          ' }',
      )
      .join('\n'),
  swimlane: (n, marked) =>
    'lanes: [Sales, Ops]\nsteps:\n' +
    range(n).map((i) => `  - { id: s${i}, lane: ${i % 2 === 0 ? 'Sales' : 'Ops'}, label: Step ${i}${marked ? ', accent: true' : ''} }`).join('\n') +
    '\nlinks:\n' + range(n).slice(1).map((i) => `  - s${i - 1} -> s${i}`).join('\n'),
  timeline: (n, marked) => 'items:\n' + range(n).map((i) => `  - { label: Q${i}, desc: item ${i}, status: ${marked ? 'current' : 'done'} }`).join('\n'),
  rollout: (n, marked) => 'stages:\n' + range(n).map((i) => `  - { name: stage ${i}, status: ${marked ? 'current' : 'done'}, traffic: ${i} }`).join('\n'),
  erd: (n) => 'entities:\n' + range(n).map((i) => `  - { name: e${i}, columns: [id uuid pk] }`).join('\n') + '\nrelations:\n' + range(n).slice(1).map((i) => `  - { from: e${i}, to: e0, card: "N:1" }`).join('\n'),
  sequence: (n) =>
    'actors:\n' + range(3).map((i) => `  - { id: a${i}, name: A${i} }`).join('\n') +
    '\nmessages:\n' + range(n).map((i) => `  - { from: a${i % 3}, to: a${(i + 1) % 3}, text: m${i}${i % 2 === 1 ? ', kind: response' : ''} }`).join('\n'),
  c4: (n) => 'nodes:\n' + range(n).map((i) => `  - { id: n${i}, col: ${(i % 4) + 1}, row: ${Math.floor(i / 4) + 1}, kind: ${i === 0 ? 'gateway' : 'system'}, name: N${i} }`).join('\n'),
  block: (n) => 'nodes:\n' + range(n).map((i) => `  - { id: n${i}, col: ${(i % 4) + 1}, row: ${Math.floor(i / 4) + 1}, kind: ${i === 0 ? 'gateway' : 'service'}, name: N${i} }`).join('\n'),
};

/** `flow` grows in exits, which is where its accent lives. */
const flowBody = (exits: number): string =>
  'nodes:\n  - { id: s, kind: start, label: Start }\n' +
  range(exits).map((i) => `  - { id: e${i}, kind: end, label: Done ${i} }`).join('\n') +
  '\nedges:\n' +
  range(exits).map((i) => `  - { from: s, to: e${i} }`).join('\n');

/* ── tests ──────────────────────────────────────────────────────────────── */

describe('the one-accent rule', () => {
  it('css.ts still paints with the accent (the counter is looking at something)', () => {
    expect(SELECTORS.length).toBeGreaterThan(20);
  });

  it('every block type declares where its accent comes from', () => {
    expect(Object.keys(ACCENT).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it('a mark count above two says which one thing the marks compose', () => {
    for (const [type, rule] of Object.entries(ACCENT)) {
      if (rule.catalogMax > 2) expect(rule.oneThingManyMarks, `${type} spends ${rule.catalogMax} marks`).toBe(true);
      expect(rule.why.length, type).toBeGreaterThan(0);
    }
  });

  for (const type of BLOCK_TYPES) {
    const rule = ACCENT[type];
    const template = BLOCK_TEMPLATES[type];
    if (template === undefined) continue;
    it(`${type}: the catalog example spends at most ${rule.catalogMax} accent mark(s) — ${rule.why}`, () => {
      expect(markCount(type, template)).toBeLessThanOrEqual(rule.catalogMax);
    });
  }
});

describe('the accent does not grow with the data', () => {
  for (const [type, make] of Object.entries(GROWERS)) {
    const rule = ACCENT[type as BlockType];
    if (rule.source !== 'renderer' || rule.oneThingManyMarks === true) continue;
    it(`${type}: twelve items spend no more accent than one`, () => {
      expect(markCount(type, make(12, true))).toBeLessThanOrEqual(Math.max(rule.catalogMax, markCount(type, make(1, true))));
    });
  }
});

describe('an author-marked accent is the author’s count, and only the author’s', () => {
  for (const [type, make] of Object.entries(GROWERS)) {
    if (ACCENT[type as BlockType].source !== 'author') continue;
    it(`${type}: no marks in the data, no accent on the page`, () => {
      expect(markCount(type, make(12, false))).toBe(0);
    });
    it(`${type}: the count follows the marked items, one for one`, () => {
      const one = markCount(type, make(1, true));
      expect(one).toBeGreaterThan(0);
      expect(markCount(type, make(4, true))).toBe(one * 4);
    });
  }
});

describe('a focal thing drawn as several marks is still one thing', () => {
  it('spans: the accented bars are one connected chain, never two branches', () => {
    // A trace that is one chain: every span is on the critical path, and each
    // accented bar follows another accented bar.
    const chain = 'spans:\n' + range(12).map((i) => `  - { id: s${i}, service: svc, name: step ${i}, start: ${i * 10}, duration: 5${i > 0 ? `, parent: s${i - 1}` : ''} }`).join('\n');
    const onChain = accentMarks(render('spans', chain)).map((m) => Number(/^spans\.(\d+)$/.exec(bpOf(m) ?? '')?.[1] ?? -1));
    expect(onChain).not.toContain(-1);
    expect(onChain.length).toBe(12);
    for (const i of [...onChain].sort((a, b) => a - b).slice(1)) expect(onChain).toContain(i - 1);

    // A trace that fans out: eleven siblings under one root. Only the root and
    // the slowest child are the critical path — the siblings are not accented,
    // because a fork is two things and the accent names one.
    const fan =
      'spans:\n  - { id: r, service: svc, name: root, start: 0, duration: 100 }\n' +
      range(11).map((i) => `  - { id: c${i}, service: svc, name: child ${i}, start: 1, duration: ${10 + i}, parent: r }`).join('\n');
    const onFan = accentMarks(render('spans', fan)).map((m) => bpOf(m));
    expect(onFan).toHaveLength(2);
    expect(onFan).toContain('spans.0'); // the root
    expect(onFan).toContain('spans.11'); // the slowest child, and nothing else
  });

  it('flow: every accented mark is an arrival — an `end` node, or an edge into one', () => {
    const marks = accentMarks(render('flow', flowBody(3)));
    const paths = marks.map((m) => bpOf(m) ?? '');
    expect(paths.length).toBeGreaterThan(1);
    const nodes = new Set(paths.filter((p) => p.startsWith('nodes.')).map((p) => Number(p.slice(6))));
    const edges = paths.filter((p) => p.startsWith('edges.')).map((p) => Number(p.slice(6)));
    expect(paths.every((p) => p.startsWith('nodes.') || p.startsWith('edges.'))).toBe(true);
    // Node 0 is the start; every accented node must be one of the exits.
    for (const n of nodes) expect(n).toBeGreaterThan(0);
    // Every accented edge lands on an accented node — nothing unrelated.
    for (const e of edges) expect(nodes.has(e + 1)).toBe(true);
  });
});
