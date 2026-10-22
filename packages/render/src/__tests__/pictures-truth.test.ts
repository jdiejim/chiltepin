/**
 * The "pictures" quality pass: every diagram states only what the author
 * wrote. No boundary encloses an element that is not in it, no line implies
 * a link that is not there, no colour calls the normal path an error, and no
 * label is cut. One describe per block; each test asserts markup or geometry.
 */
import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { parseDocument, swimlanePlacements, type BlockDataMap, type BlockType } from 'chiltepin-core';
import { renderFlow } from '../blocks/flow.js';
import { boundaryCells, c4Geometry, renderC4 } from '../blocks/c4.js';
import { renderUsecase, segmentHitsEllipse } from '../blocks/usecase.js';
import { renderGitgraph } from '../blocks/gitgraph.js';
import { renderSwimlane, swimlaneGeometry } from '../blocks/swimlane.js';
import { renderSequence } from '../blocks/sequence.js';
import { renderState, transitionLabel } from '../blocks/state.js';
import { renderSpans } from '../blocks/spans.js';
import { renderTiming, timingMarks } from '../blocks/timing.js';
import { renderSaga } from '../blocks/saga.js';
import { renderErd } from '../blocks/erd.js';
import { areaHue, renderArchmap } from '../blocks/archmap.js';
import { pathWithBreaks, renderEndpoint } from '../blocks/endpoint.js';
import { wrapAll } from '../blocks/wrapAll.js';
import { FONT, textWidth } from '../svg/wrapText.js';
import { houseCss } from '../css.js';

/** The parsed data of the first `type` block in a Markdown snippet (terse forms expanded). */
function block<K extends BlockType>(type: K, yaml: string): BlockDataMap[K] {
  const doc = parseDocument(`\`\`\`${type}\n${yaml.trim()}\n\`\`\`\n`, 't');
  const seg = doc.segments.find((s) => s.kind === type) as { data?: unknown } | undefined;
  if (seg?.data === undefined || seg.data === null) throw new Error(`no ${type} block`);
  return seg.data as BlockDataMap[K];
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const viewBox = (html: string): { w: number; h: number } => {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html);
  return { w: Number(m?.[1]), h: Number(m?.[2]) };
};

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Corner points of a path made of M / L / Q commands (a Q's control point is the corner). */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i] as number, y: nums[i + 1] as number });
  return out;
}

/** The vertices of a path of M / L / H / V commands (absolute). */
function polyPoints(d: string): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  for (const m of d.matchAll(/([MLHV])\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?/g)) {
    const c = m[1];
    const a = Number(m[2]);
    if (c === 'H') x = a;
    else if (c === 'V') y = a;
    else {
      x = a;
      y = Number(m[3]);
    }
    out.push({ x, y });
  }
  return out;
}

/** Ray-casting point-in-polygon. */
function inside(p: { x: number; y: number }, poly: ReadonlyArray<{ x: number; y: number }>): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as { x: number; y: number };
    const b = poly[j] as { x: number; y: number };
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

describe('flow: only an edge marked as an error is an error', () => {
  const data = block(
    'flow',
    `
dir: TB
nodes:
  - { id: gaps, kind: decision, label: Gaps in the evidence? }
  - { id: budget, kind: decision, label: Under the caps? }
  - { id: slack, label: Post to Slack }
  - { id: posted, kind: end, label: Diagnosis posted }
  - { id: handoff, kind: end, label: Hand off }
edges:
  - "gaps -> slack: no"
  - "gaps -> budget: yes"
  - "budget -x-> handoff: no"
  - slack -> posted
`,
  );
  const root = parse(renderFlow(data));
  const edge = (i: number) => root.querySelector(`path[data-bp="edges.${i}"]`);

  it('a "no" label on a normal edge keeps the normal stroke', () => {
    expect(edge(0)?.getAttribute('stroke')).toBe('var(--muted)');
    expect(edge(0)?.getAttribute('marker-end')).toBe('url(#skArrow)');
  });

  it('an edge written `-x->` is still the error stroke', () => {
    expect(edge(2)?.getAttribute('stroke')).toBe('var(--negative)');
  });

  it('the end the normal "no" path reaches keeps the success accent', () => {
    const posted = root.querySelector('g[data-bp="nodes.3"] rect');
    expect(posted?.getAttribute('stroke')).toBe('var(--accent)');
    expect(edge(3)?.getAttribute('stroke')).toBe('var(--accent)');
    const handoff = root.querySelector('g[data-bp="nodes.4"] rect');
    expect(handoff?.getAttribute('stroke')).not.toBe('var(--accent)');
  });
});

describe('c4: a boundary never encloses an element that is not in it', () => {
  const grid = block(
    'c4',
    `
level: container
boundary: { label: Banking system }
nodes:
  - { id: api, col: 1, row: 1, kind: container, name: API application }
  - { id: mf, col: 2, row: 1, kind: external, name: Mainframe }
  - { id: db, col: 2, row: 2, kind: store, name: Accounts DB }
edges: [api -> mf: calls, api -> db: reads]
`,
  );

  it('the hull leaves out the cell another element takes (an L, not the bounding box)', () => {
    const { parts } = boundaryCells(
      [
        { col: 1, row: 1 },
        { col: 2, row: 2 },
      ],
      [{ col: 2, row: 1 }],
    );
    expect(parts).toHaveLength(1);
    const keys = (parts[0] ?? []).map((c) => `${c.c},${c.r}`).sort();
    expect(keys).toEqual(['1,1', '1,2', '2,2']);
  });

  it('the drawn panel does not cover the external element', () => {
    const root = parse(renderC4(grid));
    const panel = root.querySelector('g[data-bp="boundary"] path');
    expect(panel).not.toBeNull();
    const poly = pathPoints(panel?.getAttribute('d') ?? '');
    const ext = root.querySelector('g[data-bp="nodes.1"] rect');
    const x = Number(ext?.getAttribute('x'));
    const y = Number(ext?.getAttribute('y'));
    const w = Number(ext?.getAttribute('width'));
    const h = Number(ext?.getAttribute('height'));
    for (const p of [
      { x: x + w / 2, y: y + h / 2 },
      { x: x + 4, y: y + 4 },
      { x: x + w - 4, y: y + h - 4 },
    ]) {
      expect(inside(p, poly)).toBe(false);
    }
    // The members stay inside.
    const api = root.querySelector('g[data-bp="nodes.0"] rect');
    expect(inside({ x: Number(api?.getAttribute('x')) + 10, y: Number(api?.getAttribute('y')) + 10 }, poly)).toBe(true);
  });

  it('a grid that splits the boundary reports which element to move to an outer column', () => {
    const split = block(
      'c4',
      `
boundary: { label: Core system }
nodes:
  - { id: a, col: 1, row: 1, kind: container, name: Web app }
  - { id: x, col: 2, row: 1, kind: external, name: Identity provider }
  - { id: b, col: 3, row: 1, kind: container, name: Worker }
edges: [a -> x: signs in, a -> b: queues jobs]
`,
    );
    const issue = c4Geometry(split).issues.find((i) => i.kind === 'boundary-encloses');
    expect(issue?.message).toContain('Identity provider');
    expect(issue?.hint).toContain('outer column');
    // Two panels, neither covering the external.
    expect(parse(renderC4(split)).querySelectorAll('g[data-bp="boundary"]')).toHaveLength(2);
    expect(c4Geometry(grid).issues.some((i) => i.kind === 'boundary-encloses')).toBe(false);
  });

  it('auto-layout keeps every external out of the boundary', () => {
    const quick = block(
      'c4',
      `
level: container
boundary: { label: Payments platform }
nodes:
  - { id: user, kind: person, name: Shopper }
  - { id: web, kind: container, name: Checkout web app }
  - { id: api, kind: container, name: Payments API }
  - { id: psp, kind: external, name: Card processor }
  - { id: db, kind: store, name: Ledger DB }
edges: [user -> web: pays, web -> api: calls, api -> psp: authorises, api -> db: writes]
`,
    );
    const root = parse(renderC4(quick));
    const poly = pathPoints(root.querySelector('g[data-bp="boundary"] path')?.getAttribute('d') ?? '');
    for (const ni of [0, 3]) {
      const r = root.querySelector(`g[data-bp="nodes.${ni}"] rect`);
      const c = { x: Number(r?.getAttribute('x')) + 20, y: Number(r?.getAttribute('y')) + 20 };
      expect(inside(c, poly)).toBe(false);
    }
  });
});

describe('usecase: lines are never false links', () => {
  const data = block(
    'usecase',
    `
system: Library
actors:
  - { id: m, name: Member }
  - { id: l, name: Librarian }
  - { id: c, name: Catalogue service, kind: system, side: right }
  - { id: t, name: Nightly job, kind: time, side: right }
cases:
  - { id: a, name: Search catalogue }
  - { id: b, name: Borrow book }
  - { id: c1, name: Return book }
  - { id: d, name: Renew loan }
  - { id: e, name: Pay fine }
  - { id: f, name: Reserve book }
  - { id: g, name: Add new title }
  - { id: h, name: Send overdue reminders }
  - { id: i, name: Check membership }
links: [m -> a, m -> b, m -> c1, m -> d, m -> e, m -> f, l -> g, l -> b, c -> a, t -> h]
relations:
  - { from: b, to: i, kind: include }
  - { from: d, to: i, kind: include }
  - { from: e, to: b, kind: extend }
`,
  );
  const html = renderUsecase(data);
  const root = parse(html);
  const ellipses = root.querySelectorAll('g[data-bl="cases"] ellipse').map((e) => ({
    cx: Number(e.getAttribute('cx')),
    cy: Number(e.getAttribute('cy')),
    rx: Number(e.getAttribute('rx')),
    ry: Number(e.getAttribute('ry')),
  }));
  const caseIdx = new Map(data.cases.map((c, i) => [c.id, i]));

  it('a case linked only from the left sits in the left column; only from the right, the right', () => {
    const xs = ellipses.map((e) => e.cx);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    expect(xs[caseIdx.get('h') ?? -1]).toBe(right);
    for (const id of ['c1', 'd', 'e', 'f', 'g']) expect(xs[caseIdx.get(id) ?? -1]).toBe(left);
  });

  it('no association or relation segment crosses a case it does not end on', () => {
    const segs = (pts: Array<{ x: number; y: number }>) => pts.slice(1).map((q, k) => [pts[k], q] as const);
    const lines: Array<{ ends: number[]; pts: Array<{ x: number; y: number }> }> = [];
    root.querySelectorAll('g[data-bl="links"] > *').forEach((el, li) => {
      const link = data.links?.[li];
      const end = caseIdx.get(link?.to ?? '') ?? -1;
      const pts =
        el.tagName === 'LINE'
          ? [
              { x: Number(el.getAttribute('x1')), y: Number(el.getAttribute('y1')) },
              { x: Number(el.getAttribute('x2')), y: Number(el.getAttribute('y2')) },
            ]
          : pathPoints(el.getAttribute('d') ?? '');
      lines.push({ ends: [end], pts });
    });
    root.querySelectorAll('g[data-bl="relations"] > path').forEach((el, ri) => {
      const rel = data.relations?.[ri];
      lines.push({ ends: [caseIdx.get(rel?.from ?? '') ?? -1, caseIdx.get(rel?.to ?? '') ?? -1], pts: pathPoints(el.getAttribute('d') ?? '') });
    });
    expect(lines.length).toBe(13);
    for (const ln of lines) {
      for (const [p, q] of segs(ln.pts)) {
        ellipses.forEach((e, ci) => {
          if (ln.ends.includes(ci) || p === undefined) return;
          expect(segmentHitsEllipse(p, q, e.cx, e.cy, 0, e.rx, e.ry)).toBe(false);
        });
      }
    }
  });

  it('include and extend stereotypes sit on their own edge (no numbered legend)', () => {
    expect(html).not.toContain('class="edge-steps"');
    expect(root.querySelectorAll('[data-bp^="relations."] text').map((t) => t.text)).toEqual(
      expect.arrayContaining(['«include»', '«extend»']),
    );
  });

  it('a long case name wraps whole: the ellipse grows instead of dropping words', () => {
    const name = 'Reconcile the monthly settlement statement against the ledger';
    const one = parse(renderUsecase({ actors: [{ id: 'a', name: 'Clerk' }], cases: [{ id: 'x', name }] }));
    expect(one.querySelectorAll('[data-bp="cases.0.name"] text').map((t) => t.text).join(' ')).toBe(name);
  });
});

describe('gitgraph: merges and branch names', () => {
  const data = block(
    'gitgraph',
    `
branches: [{ name: main }, { name: develop }, { name: feature/checkout-redesign-with-wallets }, { name: hotfix/1.4.1 }]
commits:
  - { label: v1.4.0 }
  - { branch: develop, label: sprint work }
  - { branch: feature/checkout-redesign-with-wallets, label: new form }
  - { branch: hotfix/1.4.1, from: main, label: fix VAT, kind: hotfix }
  - { merge: hotfix/1.4.1, label: ship hotfix, tag: v1.4.1 }
  - { branch: develop, merge: hotfix/1.4.1, label: back-merge hotfix }
`,
  );
  const html = renderGitgraph(data);

  it('a branch merged twice draws both merge curves', () => {
    const merges = parse(html).querySelectorAll('path[stroke-dasharray="5 4"]');
    expect(merges).toHaveLength(2);
  });

  it('the name gutter fits the longest branch name', () => {
    const names = parse(html).querySelectorAll('text.gg-branch');
    for (const t of names) {
      const x = Number(t.getAttribute('x'));
      expect(x - textWidth(t.text, { size: 11, mono: true, weight: 700 })).toBeGreaterThanOrEqual(0);
    }
  });

  it('two commits on one lane sit far enough apart that their labels never touch', () => {
    const lane = parse(
      renderGitgraph({
        commits: [
          { label: 'a very long commit message one' },
          { label: 'another very long commit message' },
        ],
      }),
    );
    const xs = lane.querySelectorAll('text.gg-msg').map((t) => Number(t.getAttribute('x')));
    const w = (t: string) => textWidth(t, FONT.small);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeGreaterThanOrEqual((w('a very long commit message one') + w('another very long commit message')) / 2);
  });
});

describe('swimlane: phases, bands and labels', () => {
  const ocg = block(
    'swimlane',
    `
lanes: [Guard, Orchestrator, Worker, Critic, Reviewer]
phases:
  - { label: Admit, from: 1 }
  - { label: Produce, from: 2, to: 3 }
  - { label: Judge, from: 4, to: 5 }
  - { label: Release, from: 6 }
steps:
  - screen: Screen the request · Guard · start
  - plan: Plan and delegate · Orchestrator
  - draft: Produce the draft · Worker
  - score: Score against sources and policy · Critic · decision
  - repair: Return notes for repair · Critic
  - scan: Scan the output · Guard
  - approve: Approve if over threshold · Reviewer · end
links: [screen -> plan, plan -> draft, draft -> score, "score -x-> repair: fail", "repair --> draft: notes", "score -> scan: pass", "scan --> approve: over $200"]
`,
  );
  const html = renderSwimlane(ocg);
  const root = parse(html);

  it('a phase with no `to` ends where the next phase starts', () => {
    const rects = root.querySelectorAll('g[data-bl="phases"] > g[data-bp] > rect').map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
    }));
    expect(rects).toHaveLength(4);
    for (let i = 0; i + 1 < rects.length; i++) {
      const a = rects[i] as Box;
      const b = rects[i + 1] as Box;
      expect(a.x + a.w).toBeLessThanOrEqual(b.x + 0.5);
    }
    expect(bands(ocg)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 3 },
      { from: 4, to: 5 },
      { from: 6, to: 6 },
    ]);
  });

  it('every phase label is drawn after every band, so no band hides one', () => {
    const lastRect = html.lastIndexOf('fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>', html.indexOf('ADMIT'));
    expect(html.indexOf('ADMIT')).toBeGreaterThan(lastRect);
    const labels = root.querySelectorAll('g[data-bl="phases"] text.t-eyebrow').map((t) => t.text);
    expect(labels).toEqual(['ADMIT', 'PRODUCE', 'JUDGE', 'RELEASE']);
    const firstLabel = html.indexOf('class="t-eyebrow" text-anchor="middle" data-bp="phases.0.label"');
    const rectsEnd = html.lastIndexOf('<g data-bp="phases.3">');
    expect(firstLabel).toBeGreaterThan(rectsEnd);
  });

  it('with derived columns, a step that names its phase sits under that band', () => {
    const data = block(
      'swimlane',
      `
lanes: [Ops, Lead]
phases:
  - { label: Detect, from: 1 }
  - { label: Mitigate, from: 1 }
  - { label: Learn, from: 1 }
steps:
  - { id: page, label: Ack the page, lane: Ops, phase: Detect }
  - { id: sev, label: Severity?, lane: Lead, kind: decision, phase: Mitigate }
  - { id: fix, label: Roll back, lane: Ops, phase: Mitigate }
  - { id: verify, label: Fixed?, lane: Lead, kind: decision, phase: Mitigate }
  - { id: macro, label: Support macro, lane: Lead, phase: Mitigate }
  - { id: pm, label: Postmortem, lane: Lead, phase: Learn }
links: [page -> sev, sev -> fix, fix -> verify, sev -> macro, verify -> pm]
`,
    );
    const { placements, bands: bs } = swimlanePlacements(data);
    const phaseOf = ['Detect', 'Mitigate', 'Mitigate', 'Mitigate', 'Mitigate', 'Learn'];
    const names = ['Detect', 'Mitigate', 'Learn'];
    placements.forEach((p, i) => {
      const band = bs[names.indexOf(phaseOf[i] as string)];
      expect(p.col).toBeGreaterThanOrEqual(band?.from ?? 0);
      expect(p.col).toBeLessThanOrEqual(band?.to ?? 0);
    });
    // An unknown phase name is reported, not silently ignored.
    const bad = { ...data, steps: [...(data.steps ?? []), { id: 'x', label: 'Lost', lane: 'Ops', phase: 'Recover' }] };
    const issue = swimlaneGeometry(bad).issues.find((i) => i.kind === 'phase-unknown');
    expect(issue?.message).toContain('Recover');
  });

  it('a long step label and a long note are drawn whole', () => {
    const label = 'Is the refund amount above the 500 EUR approval threshold?';
    const note = 'settles in 5 to 10 business days depending on issuer';
    const out = parse(
      renderSwimlane({
        lanes: [{ label: 'Support' }, { label: 'Finance' }],
        steps: [
          { id: 'c', lane: 'Finance', kind: 'decision', label },
          { id: 'd', lane: 'Support', label: 'Issue refund', note },
        ],
        links: [{ from: 'c', to: 'd' }],
      }),
    );
    const words = (si: number, cls: string) =>
      out.querySelectorAll(`g[data-bp="steps.${si}"] text.${cls}`).map((t) => t.text).join(' ');
    expect(words(0, 't-name')).toBe(label);
    expect(words(1, 't-sub')).toBe(note);
  });
});

/** The bands core computes for a swimlane. */
function bands(data: BlockDataMap['swimlane']) {
  return swimlanePlacements(data).bands;
}

describe('sequence: heads, numbering, activation, frames', () => {
  it('a long actor subtitle wraps inside its head', () => {
    const root = parse(
      renderSequence({
        actors: [
          { id: 'a', name: 'Fraud scoring service', sub: 'Python · XGBoost model v14 · 6 pods' },
          { id: 'b', name: 'B' },
        ],
        messages: [{ from: 'a', to: 'b', label: 'x' }],
      }),
    );
    const subs = root.querySelectorAll('g[data-bp="actors.0"] text.lane-head-sub').map((t) => t.text);
    expect(subs.length).toBeGreaterThan(1);
    expect(subs.join(' ')).toBe('Python · XGBoost model v14 · 6 pods');
    for (const s of subs) expect(s.length).toBeLessThanOrEqual(22);
    const head = root.querySelector('g[data-bp="actors.0"] rect');
    const lastY = Math.max(...root.querySelectorAll('g[data-bp="actors.0"] text').map((t) => Number(t.getAttribute('y'))));
    expect(lastY).toBeLessThan(Number(head?.getAttribute('y')) + Number(head?.getAttribute('height')));
  });

  it('a note does not take a message number', () => {
    const root = parse(
      renderSequence({
        actors: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'one' },
          { from: 'a', to: 'a', kind: 'note', label: 'a note' },
          { from: 'b', to: 'a', label: 'two', kind: 'response' },
        ],
      }),
    );
    expect(root.querySelectorAll('.step-badge-text').map((t) => t.text)).toEqual(['1', '2']);
  });

  it('no empty activation box after the last message of an alt branch', () => {
    const data = block(
      'sequence',
      `
actors:
  - { id: orch, name: Orchestrator }
  - { id: guard, name: Policy guard }
  - { id: slack, name: Slack, external: true }
  - { id: oncall, name: On-call engineer }
messages:
  - orch -> slack: posts diagnosis
  - orch -> guard: calls the tool
  - guard -> slack: posts approval request
  - "guard -x-> orch: holds the call"
  - slack -> oncall: pings
  - "alt: approves"
  - oncall -> slack: approves
  - slack --> guard: sends approval
  - guard --> orch: returns result
  - orch -> slack: posts action result
  - "else: rejects"
  - oncall -> slack: rejects
  - slack --> guard: sends rejection
  - "guard -x-> orch: denies the call"
  - orch -> slack: posts rejection and ends run
  - end
`,
    );
    const root = parse(renderSequence(data));
    const bars = root.querySelectorAll('rect.activation').map((r) => Number(r.getAttribute('height')));
    expect(bars.length).toBeGreaterThan(0);
    // An empty bar is the 12px pad alone; every drawn bar spans at least one row.
    for (const h of bars) expect(h).toBeGreaterThan(12);
  });

  it('frame tabs paint above the activation bars', () => {
    const html = renderSequence(
      block(
        'sequence',
        `
actors: [{ id: a, name: App }, { id: b, name: Auth }]
messages:
  - a -> +b: refresh
  - "par: rotate and audit"
  - b -> b: rotate
  - end
  - b --> -a: tokens
`,
      ),
    );
    expect(html.indexOf('class="seq-frame-tab"')).toBeGreaterThan(html.lastIndexOf('class="activation"'));
  });
});

describe('state: labels, names, loops, table', () => {
  const data = block(
    'state',
    `
states:
  - { id: s0, kind: start }
  - { id: a, name: PAST_DUE_AWAITING_PAYMENT_RETRY, kind: wait }
  - { id: e, kind: terminal }
transitions:
  - s0 -> a: invoice_failed
  - { from: a, to: a, event: retry_scheduled, guard: attempts < 4 }
  - a -> e: dunning_exhausted
`,
  );
  const html = renderState(data);
  const root = parse(html);

  it('prints a guard in UML brackets', () => {
    expect(transitionLabel({ event: 'retry', guard: 'attempts < 4' })).toBe('retry [attempts < 4]');
    expect(root.querySelectorAll('[data-bp="transitions.1"] text').map((t) => t.text).join(' ')).toContain('[attempts < 4]');
  });

  it('a SNAKE_CASE name breaks after `_` and the pill grows to hold it', () => {
    const lines = root.querySelectorAll('g[data-bp="states.1.name"] text').map((t) => t.text);
    expect(lines.length).toBe(2);
    expect(lines.join('')).toBe('PAST_DUE_AWAITING_PAYMENT_RETRY');
    expect(lines[0]?.endsWith('_')).toBe(true);
    const pill = root.querySelector('g[data-bp="states.1"] rect');
    expect(Number(pill?.getAttribute('height'))).toBe(61);
    expect(wrapAll('CANCELLED_AT_PERIOD_END', 20)).toEqual(['CANCELLED_AT_', 'PERIOD_END']);
  });

  it("a self-loop's label sits above the apex of its arc", () => {
    const arc = root.querySelector('path[data-bp="transitions.1"]')?.getAttribute('d') ?? '';
    const ys = pathPoints(arc).map((p) => p.y);
    const top = ys[0] as number; // the pill top
    const apex = top - (top - Math.min(...ys)) * 0.75;
    const mask = root.querySelector('g[data-bp="transitions.1"] rect');
    const maskBottom = Number(mask?.getAttribute('y')) + Number(mask?.getAttribute('height'));
    expect(maskBottom).toBeLessThanOrEqual(apex);
  });

  it('the table names an unnamed start and end, and starts closed', () => {
    const details = root.querySelector('details.st-transitions');
    expect(details).not.toBeNull();
    expect(details?.getAttribute('open')).toBeUndefined();
    expect(details?.querySelector('summary')?.text).toBe('Transition table (3)');
    const cells = root.querySelectorAll('.transition-table td .pill').map((p) => p.text);
    expect(cells).toContain('● start');
    expect(cells).toContain('◉ end');
    expect(cells).not.toContain('s0');
  });
});

describe('spans: connectors never strike through another row', () => {
  const html = renderSpans({
    unit: 'ms',
    spans: [
      { id: 'root', service: 'gateway', name: 'POST /checkout', start: 0, duration: 800 },
      { id: 'auth', service: 'auth', name: 'validate session token', start: 6, duration: 21, parent: 'root' },
      { id: 'price', service: 'pricing', name: 'compute promotions and tax', start: 130, duration: 140, parent: 'root' },
      { id: 'tax', service: 'tax', name: 'POST /v1/tax', start: 140, duration: 118, parent: 'price' },
      { id: 'pay', service: 'payments', name: 'authorise card', start: 370, duration: 380, parent: 'root' },
    ],
  });
  const links = parse(html).querySelectorAll('path.sp-link').map((p) => p.getAttribute('d') ?? '');

  it('siblings hang off one spine at their parent’s start', () => {
    // Links in row order: auth (starts under the spine: meets it at its top),
    // price, tax, pay.
    const spines = links.map((d) => polyPoints(d)[0]?.x);
    expect(spines[1]).toBe(spines[3]);
    expect(spines[2]).not.toBe(spines[1]);
    // A stub ends at its child's start, at the bar's middle.
    const price = polyPoints(links[1] ?? '');
    expect(price).toHaveLength(3);
    expect(price[1]?.x).toBe(spines[1]);
  });

  it("no connector passes over another row's trailing text", () => {
    const root = parse(html);
    const texts = root.querySelectorAll('g[data-bl="spans"] text').map((t) => ({
      x: Number(t.getAttribute('x')),
      y: Number(t.getAttribute('y')),
      w: t.text.length * 6,
    }));
    for (const d of links) {
      const pts = polyPoints(d);
      const spine = pts[0] as { x: number; y: number };
      const end = pts[1] as { x: number; y: number };
      for (const t of texts) {
        const crossesX = spine.x >= t.x && spine.x <= t.x + t.w;
        const crossesY = t.y - 8 > spine.y && t.y < end.y - 4;
        expect(crossesX && crossesY).toBe(false);
      }
    }
  });
});

describe('timing: two marks never cancel each other', () => {
  it('the first non-red mark takes the accent, a later one draws plain', () => {
    expect(timingMarks([undefined, 'amber', 'red', 'blue'])).toEqual([undefined, 'focal', 'negative', undefined]);
    const root = parse(
      renderTiming({
        lanes: [
          {
            label: 'node-b',
            states: [
              { state: 'follower', from: 0, to: 450 },
              { state: 'candidate', from: 450, to: 470, accent: 'amber' },
              { state: 'leader', from: 470, to: 1200, accent: 'blue' },
            ],
          },
        ],
      }),
    );
    const strokes = root.querySelectorAll('g[data-bl="lanes.0.states"] line').map((l) => l.getAttribute('stroke'));
    expect(strokes).toEqual(['var(--accent)']);
  });
});

describe('saga: six steps fit the page column', () => {
  const steps = [
    { id: 'flight', name: 'Reserve outbound and return flights', service: 'flight-booking-service', action: 'hold seats for 15 minutes', compensate: 'release the held seats with the airline' },
    { id: 'hotel', name: 'Reserve hotel room', service: 'hotel-inventory', compensate: 'cancel the hotel reservation' },
    { id: 'car', name: 'Reserve rental car', service: 'car-rental-partner-api', compensate: 'cancel the car booking' },
    { id: 'pay', name: 'Charge the customer card', service: 'payments', compensate: 'refund the card in full' },
    { id: 'ticket', name: 'Issue e-tickets', service: 'ticketing', compensate: 'void the e-tickets' },
    { id: 'email', name: 'Send itinerary email', service: 'notifications' },
  ];
  const html = renderSaga({ title: 'Book a trip', steps, failAt: 'ticket' });

  it('narrows its cards instead of scrolling', () => {
    expect(viewBox(html).w).toBeLessThanOrEqual(1000);
    expect(html).not.toContain('diagram-stage--wide');
  });

  it('keeps every word of every name, service and compensation', () => {
    const root = parse(html);
    const names = root.querySelectorAll('g[data-bl="steps"] > g').map((g) =>
      g.querySelectorAll('text.t-name').filter((t) => !t.closest('[data-bp$=".compensate"]')).map((t) => t.text).join(' '),
    );
    expect(names).toEqual(steps.map((s) => s.name));
    const services = root.querySelectorAll('g[data-bl="steps"] > g').map((g) =>
      g.querySelectorAll('text.t-eyebrow').filter((t) => !t.closest('[data-bp$=".compensate"]') && !/^(COMPENSATED|FAILED|SKIPPED)$/.test(t.text)).map((t) => t.text).join(''),
    );
    expect(services).toEqual(steps.map((s) => s.service));
  });

  it('four steps keep the full-size cards', () => {
    const card = parse(renderSaga({ steps: steps.slice(0, 4) })).querySelector('g[data-bl="steps"] > g > rect');
    expect(Number(card?.getAttribute('width'))).toBeGreaterThanOrEqual(176);
  });
});

describe('erd: eight tables read at full size', () => {
  const data = block(
    'erd',
    `
entities:
  - { name: customers, columns: [id uuid pk, email citext unique] }
  - { name: addresses, columns: [id uuid pk, customer_id uuid fk -> customers.id, line1 text] }
  - { name: orders, columns: [id uuid pk, customer_id uuid fk -> customers.id, shipping_address_id uuid fk -> addresses.id] }
  - { name: order_lines, columns: [id uuid pk, order_id uuid fk -> orders.id, product_variant_id uuid fk -> product_variants.id] }
  - { name: products, columns: [id uuid pk, seller_id uuid fk -> sellers.id, title text] }
  - { name: product_variants, columns: [id uuid pk, product_id uuid fk -> products.id, sku text unique] }
  - { name: sellers, columns: [id uuid pk, legal_entity_name text] }
  - { name: payments, columns: [id uuid pk, order_id uuid fk -> orders.id] }
relations:
  - customers ||--o{ addresses: has
  - customers ||--o{ orders: places
  - addresses ||--o{ orders: ships to
  - orders ||--o{ order_lines: contains
  - product_variants ||--o{ order_lines: sold as
  - products ||--o{ product_variants: has
  - sellers ||--o{ products: lists
  - orders ||--o{ payments: paid by
`,
  );
  const html = renderErd(data);
  const root = parse(html);

  it('a strip wider than the column switches to top-to-bottom', () => {
    expect(viewBox(html).w).toBeLessThanOrEqual(1100);
    expect(viewBox(renderErd({ ...data, dir: 'LR' })).w).toBeGreaterThan(1100);
  });

  it('relation labels sit clear of every card and of each other', () => {
    const cards = root.querySelectorAll('g[data-bl="entities"] > g > rect').map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
    }));
    const masks = root.querySelectorAll('svg > g[data-bp^="relations."] > rect').map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
    }));
    expect(masks).toHaveLength(8);
    for (const m of masks) for (const c of cards) expect(overlaps(m, c)).toBe(false);
    masks.forEach((a, i) => masks.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
  });

  it('two relations leaving one row of a card fan out instead of sharing a line', () => {
    const lr = parse(renderErd({ ...data, dir: 'LR' }));
    const start = (i: number) => pathPoints(lr.querySelector(`g[data-bp="relations.${i}"] path`)?.getAttribute('d') ?? '')[0];
    // customers.id → addresses and customers.id → orders: one row, two ends.
    const a = start(0);
    const b = start(1);
    expect(a?.x).toBe(b?.x);
    expect(a?.y).not.toBe(b?.y);
  });
});

describe('archmap: area hues and retiring tiles', () => {
  const html = renderArchmap({
    areas: [
      { label: 'Checkout', accent: 'blue', items: [{ name: 'One-click pay', status: 'target' }, { name: 'Legacy checkout', status: 'deprecated' }] },
      { label: 'Ledger', accent: 'purple', items: ['Double entry'] },
      { label: 'Reporting', accent: 'gray', items: ['Exports'] },
    ],
  });
  const root = parse(html);

  it('an area accent takes its category hue panel, as group panels do', () => {
    expect(areaHue('purple')).toBe('violet');
    expect(areaHue('red')).toBe('rose');
    expect(areaHue('gray')).toBeUndefined();
    expect(root.querySelector('[data-bp="areas.0"]')?.classNames).toContain('am-hue-blue');
    expect(root.querySelector('[data-bp="areas.1"]')?.classNames).toContain('am-hue-violet');
    expect(root.querySelector('[data-bp="areas.2"]')?.getAttribute('class')).toBe('am-area');
    expect(houseCss).toContain('.docskin .am-area.am-hue-blue{background:var(--hue-blue-tint);}');
  });

  it('a deprecated tile says RETIRING and is struck through; a target tile does not', () => {
    const target = root.querySelector('[data-bp="areas.0.items.0"]');
    const old = root.querySelector('[data-bp="areas.0.items.1"]');
    expect(old?.querySelector('.am-chip')?.text).toBe('Retiring');
    expect(target?.querySelector('.am-chip')).toBeNull();
    expect(houseCss).toMatch(/\.am-t-deprecated \.am-name\{text-decoration:line-through/);
  });
});

describe('endpoint: paths and scopes', () => {
  it('a long path breaks only after a slash', () => {
    const path = '/v2/organisations/{organisationId}/projects/{projectId}';
    const html = pathWithBreaks('/v2/feature-flags/{flagKey}');
    expect(html).toBe('/<wbr><span class="seg">v2</span>/<wbr><span class="seg">feature-flags</span>/<wbr><span class="seg">{flagKey}</span>');
    expect(parse(renderEndpoint({ method: 'GET', path })).querySelector('.ep-path')?.text).toBe(path);
    expect(houseCss).toContain('.docskin .ep-path .seg');
  });

  it('an auth scope keeps its case', () => {
    const rule = /\.docskin \.ep-auth\{[^}]*\}/.exec(houseCss)?.[0] ?? '';
    expect(rule).not.toBe('');
    expect(rule).not.toContain('text-transform');
  });
});

describe('text that does not fit is grown, or cut and marked', () => {
  it('a long c4 name wraps to two lines and the card grows; the type line and description shift down', () => {
    const root = parse(
      renderC4({
        nodes: [
          { id: 'a', col: 1, row: 1, kind: 'container', name: 'Order orchestration and fulfilment service', tech: 'Go 1.23', desc: 'Runs the saga' },
          { id: 'b', col: 2, row: 1, kind: 'store', name: 'Orders', tech: 'Postgres' },
        ],
      }),
    );
    const names = root.querySelectorAll('g[data-bp="nodes.0"] text.t-name').map((t) => t.text);
    expect(names).toHaveLength(2);
    expect(names.join(' ')).toBe('Order orchestration and fulfilment service');
    const y = (sel: string) => Number(root.querySelector(sel)?.getAttribute('y'));
    const nameYs = root.querySelectorAll('g[data-bp="nodes.0"] text.t-name').map((t) => Number(t.getAttribute('y')));
    const tech = root.querySelectorAll('g[data-bp="nodes.0"] text.t-sub').map((t) => Number(t.getAttribute('y')));
    expect(Math.min(...tech)).toBeGreaterThan(Math.max(...nameYs) + 8);
    // A store's name sits under the cylinder's front rim (rim bottom: top + 20).
    const store = root.querySelector('g[data-bp="nodes.1"] path');
    const top = Number(/M[\d.]+ ([\d.]+)/.exec(store?.getAttribute('d') ?? '')?.[1]) - 10;
    expect(y('g[data-bp="nodes.1"] text.t-name') - 12).toBeGreaterThan(top + 20);
  });

  it('a timing state too long for its segment ends with "…" and keeps its name as the title', () => {
    const root = parse(
      renderTiming({
        lanes: [
          {
            label: 'clients',
            states: [
              { state: 'writes ok', from: 0, to: 300 },
              { state: 'writes rejected by the leader', from: 300, to: 420 },
              { state: 'writes ok', from: 420, to: 1200 },
            ],
          },
        ],
      }),
    );
    const seg = root.querySelector('[data-bp="lanes.0.states.1"] text');
    expect(seg?.text.endsWith('…')).toBe(true);
    expect(seg?.querySelector('title')?.text).toBe('writes rejected by the leader');
  });
});
