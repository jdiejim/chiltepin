/**
 * Text in the AI blocks (`agentloop`, `neuralnet`, `cycle`, `context`): no
 * text is dropped without a mark. Boxes grow to hold their text; long
 * identifiers break at their joints; what still does not fit ends with "…",
 * keeps its full text in a `<title>`, and reaches the geometry report as a
 * `label-truncated` issue.
 */

import { describe, expect, it } from 'vitest';
import { HTMLElement, parse } from 'node-html-parser';
import { renderAgentloop } from '../blocks/agentloop.js';
import { renderContext } from '../blocks/context.js';
import { renderCycle } from '../blocks/cycle.js';
import { renderNeuralnet, unitGlyph } from '../blocks/neuralnet.js';
import { geometryReport, type GeometryReport } from '../geometryReport.js';
import { textWidth, type Font } from '../svg/wrapText.js';

const report = (type: string, data: unknown): GeometryReport =>
  (geometryReport as (t: string, d: unknown) => GeometryReport)(type, data);

const cuts = (type: string, data: unknown): Array<{ path?: string | undefined; message: string }> =>
  report(type, data).issues.filter((i) => i.kind === 'label-truncated');

/** The text of a data-path element: a `<text>`, or the lines of a `<g>` joined. */
const textAt = (root: HTMLElement, path: string): string[] => {
  const el = root.querySelector(`[data-bp="${path}"]`);
  if (el === null) return [];
  if (el.rawTagName === 'text') return [el.childNodes.filter((n) => !(n instanceof HTMLElement)).map((n) => n.text).join('')];
  return el.querySelectorAll('text').map((t) => t.childNodes.filter((n) => !(n instanceof HTMLElement)).map((n) => n.text).join(''));
};

const CLAIMS = {
  title: 'Claims triage agent',
  agent: {
    name: 'Insurance claims triage and routing agent',
    model: 'claude-sonnet-4-6',
    note: 'Reads the claim, the policy and the photos, then routes the claim to straight-through payment, an adjuster, or the special investigations unit for suspected fraud.',
  },
  env: 'Claims intake portal and adjuster workbench',
  tools: [
    { name: 'fetch_policy_document', desc: 'Load the policy wording, endorsements and the coverage limits for the policy holder' },
    { name: 'score_fraud_risk', desc: 'Call the fraud model with claim features and return a calibrated probability' },
    { name: 'create_adjuster_task', desc: 'Open a task in the adjuster queue with a summary and the evidence links' },
    { name: 'crm.lookup_customer_history', desc: 'Prior claims and contact notes' },
    { name: 'payments.issue_straight_through_payment', desc: 'Pay a low-risk claim now' },
    { name: 'siu.refer_case', desc: 'Refer to special investigations' },
    { name: 'notify_policy_holder' },
  ],
  memory: ['Claim history for the policy holder over the last five years', 'case history · last five tickets'],
  stop: 'Claim routed, or 12 tool calls without a decision',
};

describe('agentloop (F8, F14)', () => {
  const html = renderAgentloop(CLAIMS);
  const root = parse(html);

  it('shows every tool — two columns past five, no "+N more"', () => {
    for (let i = 0; i < CLAIMS.tools.length; i++) expect(html, `tools.${i}`).toContain(`<g data-bp="tools.${i}">`);
    expect(html).not.toMatch(/\+\d+ more/);
    expect(html).not.toContain('al-more');
    const xs = new Set(root.querySelectorAll('g[data-bl="tools"] > g > rect').map((r) => r.getAttribute('x')));
    expect(xs.size).toBe(2);
  });

  it('wraps the agent name and the env inside their boxes', () => {
    const nameFont: Font = { size: 13, weight: 600 };
    const envFont: Font = { size: 12, weight: 600 };
    const agent = root.querySelector('rect[stroke="var(--accent)"]');
    const agentW = Number(agent?.getAttribute('width'));
    const names = textAt(root, 'agent.name');
    expect(names.length).toBeGreaterThan(1);
    expect(names.join(' ')).toBe(CLAIMS.agent.name);
    for (const ln of names) expect(textWidth(ln, nameFont) + 36 + 12).toBeLessThanOrEqual(agentW);
    const envs = textAt(root, 'env');
    expect(envs.join(' ')).toBe(CLAIMS.env);
    for (const ln of envs) expect(textWidth(ln, envFont)).toBeLessThanOrEqual(118 - 16);
  });

  it('breaks tool names at their `_` and `.` joints', () => {
    expect(textAt(root, 'tools.0.name')).toEqual(['fetch_policy_', 'document']);
    expect(textAt(root, 'tools.3.name')).toEqual(['crm.lookup_', 'customer_history']);
  });

  it('wraps tool descriptions and memory items instead of cutting them', () => {
    expect(html).toContain('case history · last five tickets');
    const desc = root.querySelectorAll('g[data-bp="tools.0"] text.al-tool-desc').map((t) => t.text);
    expect(desc.join(' ')).toBe(CLAIMS.tools[0]?.desc);
    expect(html).not.toContain('…');
    expect(cuts('agentloop', CLAIMS)).toEqual([]);
  });

  it('cuts only past the cap, with "…", the full text in a <title>, and a report', () => {
    const long = 'Load the policy wording and every endorsement, '.repeat(4).trim();
    const data = { ...CLAIMS, tools: [{ name: 'fetch_policy_document', desc: long }] };
    const out = renderAgentloop(data);
    expect(out).toContain(`<title>${long}</title>`);
    expect(out).toContain('…');
    const found = cuts('agentloop', data);
    expect(found.map((c) => c.path)).toEqual(['tools.0.desc']);
    expect(found[0]?.message).toContain('fetch_policy_document');
  });

  it('keeps the default loop at 660 wide when nothing is long', () => {
    const plain = renderAgentloop({ agent: { name: 'Triage agent', model: 'claude-sonnet-4-6' }, tools: [{ name: 'search_docs', desc: 'Top-8 chunks' }], env: 'Ticket queue' });
    expect(plain).toMatch(/viewBox="0 0 660 /);
  });
});

describe('neuralnet legend (F22) and labels', () => {
  const KINDS = ['input', 'dense', 'embedding', 'recurrent', 'conv', 'pool', 'attention', 'norm', 'dropout', 'output'] as const;
  const data = { layers: KINDS.map((kind) => ({ label: kind, units: 3, kind })) };
  const nnHtml = renderNeuralnet(data);
  const root = parse(nnHtml);

  it('draws each legend swatch with the same glyph as the units it names', () => {
    const items = root.querySelectorAll('.diagram-legend .lg-item');
    expect(items.map((i) => i.querySelector('.lg-label')?.text)).toEqual([...KINDS]);
    items.forEach((item, i) => {
      const kind = KINDS[i] as (typeof KINDS)[number];
      const sw = item.querySelector('svg.lg-sw');
      expect(nnHtml).toContain(`aria-hidden="true">${unitGlyph(kind, 15, 7, 5.5)}</svg><span class="lg-label">${kind}</span>`);
      // The drawn unit: same element(s), same paint.
      const unit = parse(unitGlyph(kind, 0, 0));
      const swEls = sw?.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement) ?? [];
      const unitEls = unit.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
      expect(swEls.map((e) => e.rawTagName)).toEqual(unitEls.map((e) => e.rawTagName));
      for (const attr of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray']) {
        expect(swEls.map((e) => e.getAttribute(attr))).toEqual(unitEls.map((e) => e.getAttribute(attr)));
      }
    });
    // The drawn columns use the glyph too (attention is a diamond, conv a square).
    expect(root.querySelector('[data-bp="layers.6"] > path')).not.toBeNull();
    expect(root.querySelector('[data-bp="layers.4"] > rect')).not.toBeNull();
  });

  it('widens columns so a long label and note show whole', () => {
    const long = {
      layers: [
        { label: 'Token embedding layer with rotary positions', units: 4096, kind: 'embedding' as const, note: 'vocabulary of 128k byte-pair tokens' },
        { label: 'Grouped-query self-attention', units: 4096, kind: 'attention' as const, note: '32 query heads sharing 8 key-value heads' },
      ],
    };
    const r = parse(renderNeuralnet(long));
    expect(textAt(r, 'layers.0.label').join(' ')).toBe(long.layers[0]?.label);
    expect(textAt(r, 'layers.1.note').join(' ')).toBe(long.layers[1]?.note);
    expect(cuts('neuralnet', long)).toEqual([]);
  });

  it('cuts a label past the cap with "…", a <title> and a report', () => {
    const label = 'An extraordinarily long layer label that describes every detail of the projection in words';
    const d = { layers: [{ label, units: 4 }, { label: 'Out', units: 2 }] };
    const out = renderNeuralnet(d);
    expect(out).toContain(`<title>${label}</title>`);
    expect(cuts('neuralnet', d).map((c) => c.path)).toEqual(['layers.0.label']);
  });
});

describe('cycle labels', () => {
  const STEPS = [
    'Detect and page the on-call engineer',
    'Triage severity and open an incident channel',
    'Mitigate customer impact with rollback or feature flag',
    'Resolve the root cause in code or configuration',
    'Write the blameless postmortem within five days',
    'Track action items to completion in the backlog',
  ];

  it('grows the pills so every long label shows whole', () => {
    const root = parse(renderCycle({ steps: STEPS }));
    STEPS.forEach((label, i) => {
      const lines = root.querySelectorAll(`g[data-bp="steps.${i}"] text.t-name`).map((t) => t.text);
      expect(lines.join(' ')).toBe(label);
    });
    expect(cuts('cycle', { steps: STEPS })).toEqual([]);
  });

  it('keeps short labels on one line in the old 96-wide pill', () => {
    const html = renderCycle({ steps: ['Build', 'Measure', 'Learn'] });
    expect(html).toContain('width="96" height="34"');
  });

  it('cuts only past four lines, with "…", a <title> and a report', () => {
    const label = 'Write a very long postmortem that covers the timeline, the impact, the root cause, the contributing factors and every follow-up action in detail';
    const html = renderCycle({ steps: [{ label }, { label: 'Done' }] });
    expect(html).toContain(`<title>${label}</title>`);
    expect(html).toContain('…');
    expect(cuts('cycle', { steps: [{ label }, { label: 'Done' }] }).map((c) => c.path)).toEqual(['steps.0.label']);
  });
});

describe('context (F20)', () => {
  const OVER = {
    window: 32000,
    segments: [
      { label: 'system prompt and safety policy', tokens: 4000 },
      { label: 'tool schemas', tokens: 6000 },
      { label: 'case history', tokens: 12000 },
      { label: 'retrieved documentation chunks', tokens: 24000 },
      { label: 'q', tokens: 800 },
      { label: 'question + draft answer', tokens: 3000 },
    ],
  };
  const html = renderContext(OVER);
  const root = parse(html);

  it('keeps drawing every segment past the window, under an overflow hatch', () => {
    for (let i = 0; i < OVER.segments.length; i++) expect(html, `segments.${i}`).toContain(`data-bp="segments.${i}"`);
    const segs = root.querySelectorAll('g[data-bl="segments"] > path');
    expect(segs).toHaveLength(6);
    // The last two segments lie past the window (32,000 of 49,800).
    const pattern = root.querySelector('pattern');
    expect(pattern?.getAttribute('id')).toMatch(/^ctx-over-/);
    expect(html).toContain(`fill="url(#${pattern?.getAttribute('id') ?? ''})"`);
    // No solid block hides the overflow; the chip says by how much.
    expect(html).not.toMatch(/<path [^>]*fill="var\(--negative\)"/);
    expect(root.querySelector('text.ctx-chip')?.text).toBe('over budget · +17,800');
  });

  it('cuts an in-bar label to its segment with a <title>, else shows its index', () => {
    const labels = root.querySelectorAll('text.ctx-seg-label');
    const shown = labels.map((t) => t.childNodes.filter((n) => !(n instanceof HTMLElement)).map((n) => n.text).join(''));
    expect(shown).toContain('tool schemas');
    const cut = labels.find((t) => t.querySelector('title')?.text === 'system prompt and safety policy');
    expect(cut?.text.endsWith('…')).toBe(true);
    // The legend row keeps the whole label, so the cut drops no text.
    expect(root.querySelector('[data-bp="segments.0.label"]')?.text).toBe('system prompt and safety policy');
    const narrow = parse(renderContext({ window: 100000, segments: [{ label: 'a long label in a sliver', tokens: 3000 }, { label: 'rest', tokens: 90000 }] }));
    const idx = narrow.querySelectorAll('text.ctx-seg-label').find((t) => t.querySelector('title') !== null);
    expect(idx?.childNodes.filter((n) => !(n instanceof HTMLElement)).map((n) => n.text).join('')).toBe('1');
  });

  it('never gives two neighbouring segments the same colour', () => {
    const fills = (d: Parameters<typeof renderContext>[0]): string[] =>
      parse(renderContext(d)).querySelectorAll('g[data-bl="segments"] > path').map((p) => p.getAttribute('fill') ?? '');
    const accented = fills({
      window: 100,
      segments: [
        { label: 'a', tokens: 10, accent: 'teal' },
        { label: 'b', tokens: 10, accent: 'green' },
        { label: 'c', tokens: 10 },
        { label: 'd', tokens: 10, accent: 'teal' },
      ],
    });
    for (let i = 1; i < accented.length; i++) expect(accented[i]).not.toBe(accented[i - 1]);
    const many = fills({ window: 1000, segments: Array.from({ length: 12 }, (_, i) => ({ label: `s${i}`, tokens: 50 })) });
    for (let i = 1; i < many.length; i++) expect(many[i]).not.toBe(many[i - 1]);
    // A red accent is a hue, not the error colour.
    expect(fills({ window: 100, segments: [{ label: 'x', tokens: 10, accent: 'red' }] })).toEqual(['var(--hue-rose)']);
  });

  it('marks a window at 90% or more in amber, not the negative', () => {
    const near = renderContext({ window: 1000, segments: [{ label: 'history', tokens: 950 }] });
    expect(near).toContain('near limit');
    expect(near).toContain('var(--hue-amber)');
    expect(near).not.toContain('var(--negative)');
  });
});
