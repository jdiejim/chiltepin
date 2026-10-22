import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument, type BlockDataMap } from 'chiltepin-core';
import { layoutUsecase, renderUsecase, segmentHitsEllipse } from '../blocks/usecase.js';
import { renderDocument } from '../document.js';
import type { Pt } from '../svg/router.js';
import { FONT, textWidth } from '../svg/wrapText.js';
import { caseBaselines, type UcCase, type UcLayout } from '../blocks/usecaseLayout.js';

type Data = BlockDataMap['usecase'];

function block(yaml: string): Data {
  const doc = parseDocument(`\`\`\`usecase\n${yaml.trim()}\n\`\`\`\n`, 't');
  const seg = doc.segments.find((s) => s.kind === 'usecase') as { data?: unknown } | undefined;
  if (seg?.data === undefined || seg.data === null) throw new Error('no usecase block');
  return seg.data as Data;
}

const STORE = block(`
system: Online store
focus: checkout
actors:
  - { id: shopper, name: Shopper }
  - { id: staff, name: Store staff }
  - { id: psp, name: Payment provider, kind: system }
  - { id: mail, name: Email service }
cases:
  - { id: browse, name: Browse catalogue }
  - { id: cart, name: Add to cart }
  - { id: checkout, name: Check out }
  - { id: pay, name: Pay for order }
  - { id: track, name: Track order }
  - { id: confirm, name: Send confirmation }
  - { id: refund, name: Issue refund }
  - { id: stock, name: Update stock }
links: [shopper -> browse, shopper -> cart, shopper -> checkout, shopper -> track, staff -> refund, staff -> stock, psp -> pay, psp -> refund, mail -> confirm]
relations:
  - { from: checkout, to: pay, kind: include }
  - { from: checkout, to: confirm, kind: include }
  - { from: refund, to: confirm, kind: include }
`);

const CLINIC = block(`
system: Clinic booking
actors:
  - { id: pat, name: Patient }
  - { id: rec, name: Receptionist }
  - { id: sms, name: SMS gateway }
cases:
  - { id: book, name: Book appointment }
  - { id: find, name: Find free slot }
  - { id: login, name: Verify identity }
  - { id: wait, name: Join waiting list }
  - { id: cancel, name: Cancel appointment }
  - { id: fee, name: Charge late-cancel fee }
  - { id: remind, name: Send reminder }
links: [pat -> book, pat -> cancel, rec -> book, rec -> cancel, sms -> remind]
relations:
  - { from: book, to: find, kind: include }
  - { from: book, to: login, kind: include }
  - { from: cancel, to: login, kind: include }
  - { from: wait, to: book, kind: extend, label: no free slot }
  - { from: fee, to: cancel, kind: extend, label: under 24 h }
  - { from: book, to: remind, kind: include }
`);

const LARGE = block(`
system: Hospital patient portal and records platform
actors:
  - { id: pat, name: Patient }
  - { id: doc, name: Attending physician }
  - { id: nurse, name: Ward nurse }
  - { id: ins, name: Insurance clearing house, kind: system, side: right }
  - { id: lab, name: Laboratory information system, kind: system, side: right }
cases:
  - { id: c1, name: Register a new patient account with identity check }
  - { id: c2, name: Book an outpatient appointment }
  - { id: c3, name: Reschedule or cancel an appointment }
  - { id: c4, name: View lab results and reference ranges }
  - { id: c5, name: Request a repeat prescription }
  - { id: c6, name: Approve repeat prescription }
  - { id: c7, name: Record vital signs during the ward round }
  - { id: c8, name: Write discharge summary }
  - { id: c9, name: Submit insurance pre-authorisation }
  - { id: c10, name: Check insurance eligibility }
  - { id: c11, name: Order laboratory tests }
  - { id: c12, name: Publish laboratory results }
  - { id: c13, name: Authenticate with two-factor code }
  - { id: c14, name: Message the care team securely }
  - { id: c15, name: Export the full medical record as PDF }
links: [pat -> c1, pat -> c2, pat -> c3, pat -> c4, pat -> c5, pat -> c14, pat -> c15, doc -> c6, doc -> c8, doc -> c11, doc -> c14, nurse -> c7, nurse -> c14, ins -> c9, ins -> c10, lab -> c11, lab -> c12]
relations:
  - { from: c2, to: c13, kind: include }
  - { from: c4, to: c13, kind: include }
  - { from: c5, to: c13, kind: include }
  - { from: c9, to: c10, kind: include }
  - { from: c12, to: c4, kind: extend }
  - { from: c6, to: c5, kind: extend }
`);

const PAYMENTS = block(`
system: Payments
actors:
  - { id: user, name: User }
  - { id: admin, name: Admin }
cases:
  - { id: pay, name: Pay invoice }
  - { id: card, name: Pay by card }
  - { id: bank, name: Pay by bank transfer }
  - { id: void, name: Void invoice }
links: [user -> pay, admin -> void]
relations:
  - { from: card, to: pay, kind: generalize }
  - { from: bank, to: pay, kind: generalize }
  - { from: admin, to: user, kind: generalize }
`);

const ALL: Array<[string, Data]> = [
  ['catalog', block(BLOCK_TEMPLATES.usecase?.replace(/^```usecase\n|```\n?$/g, '') ?? '')],
  ['store', STORE],
  ['clinic', CLINIC],
  ['large', LARGE],
  ['payments', PAYMENTS],
];

const NO_HEX = /#[0-9a-f]{3,6}\b/i;
const idx = (d: Data, id: string): number => d.cases.findIndex((c) => c.id === id);
const actorIdx = (d: Data, id: string): number => d.actors.findIndex((a) => a.id === id);

/** Distance from p to the outline of an ellipse, as a share of its size (0 = on the outline). */
function offOutline(p: Pt, c: UcCase): number {
  return Math.abs(Math.hypot((p.x - c.cx) / c.rx, (p.y - c.cy) / c.ry) - 1);
}

/** Proper crossings between the drawn lines that share no end. */
function crossings(L: UcLayout): number {
  const lines: Array<{ pts: readonly Pt[]; ends: string[] }> = [];
  L.links.forEach((l, i) => {
    const e = L.linkEnds[i];
    if (l !== undefined && e !== undefined) lines.push({ pts: l.pts, ends: [`a${e.actor}`, `c${e.case}`] });
  });
  L.rels.forEach((r) => {
    const l = L.relLines[r.index];
    const p = r.actors ? 'a' : 'c';
    if (l !== undefined) lines.push({ pts: l.pts, ends: [`${p}${r.from}`, `${p}${r.to}`] });
  });
  const cross = (a: Pt, b: Pt, c: Pt, e: Pt): boolean => {
    const o = (p: Pt, q: Pt, r: Pt): number => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) * o(a, b, e) < 0 && o(c, e, a) * o(c, e, b) < 0;
  };
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const s = lines[i];
      const t = lines[j];
      if (s === undefined || t === undefined || s.ends.some((e) => t.ends.includes(e))) continue;
      for (let a = 1; a < s.pts.length; a++) for (let b = 1; b < t.pts.length; b++) if (cross(s.pts[a - 1] as Pt, s.pts[a] as Pt, t.pts[b - 1] as Pt, t.pts[b] as Pt)) n++;
    }
  }
  return n;
}

describe('usecase: notation', () => {
  it('renders the catalog template: the subject, five associations, no NaN, no hex', () => {
    const html = renderDocument(parseDocument(BLOCK_TEMPLATES.usecase ?? '', 'uc'));
    expect(html).toContain('Ticketing');
    expect(parse(html).querySelectorAll('g[data-bl="links"] > *')).toHaveLength(5);
    expect(html).not.toContain('NaN');
    expect(renderUsecase(STORE)).not.toMatch(NO_HEX);
  });

  it('puts every case inside the subject and every actor outside it', () => {
    for (const [name, d] of ALL) {
      const L = layoutUsecase(d);
      const b = L.bound;
      for (const c of L.cases) {
        expect(c.cx - c.rx, name).toBeGreaterThan(b.x);
        expect(c.cx + c.rx, name).toBeLessThan(b.x + b.w);
        expect(c.cy - c.ry, name).toBeGreaterThan(b.y);
        expect(c.cy + c.ry, name).toBeLessThan(b.y + b.h);
      }
      for (const a of L.actors) expect(a.box.x + a.box.w < b.x || a.box.x > b.x + b.w, name).toBe(true);
    }
  });

  it('stands primary actors left of the subject and supporting actors right of it', () => {
    const L = layoutUsecase(STORE);
    const side = (id: string): string => (L.actors[actorIdx(STORE, id)]?.x ?? 0) < L.bound.x ? 'left' : 'right';
    expect(side('shopper')).toBe('left');
    expect(side('staff')).toBe('left');
    // A system that helps a person's case, and a service (by its name) that joins only an included case.
    expect(side('psp')).toBe('right');
    expect(side('mail')).toBe('right');
    // `side` wins over inference; a time actor starts its case, so it stands left.
    const own = layoutUsecase(
      block(`
actors:
  - { id: a, name: Clerk, side: right }
  - { id: t, name: Nightly job, kind: time }
  - { id: s, name: Billing system }
cases: [{ id: x, name: Close the day }]
links: [a -> x, t -> x, s -> x]
`),
    );
    expect(own.actors.map((a) => a.side)).toEqual(['right', 'left', 'right']);
    expect(own.actors.map((a) => a.kind)).toEqual(['person', 'time', 'system']);
  });

  it('draws a person as a stick figure in the people hue, a system as a «system» box, time as a clock', () => {
    const d = block(`
actors:
  - { id: p, name: Clerk }
  - { id: s, name: Ledger, kind: system }
  - { id: t, name: Month end, kind: time }
cases: [{ id: x, name: Close the books }]
links: [p -> x, s -> x, t -> x]
`);
    const actors = parse(renderUsecase(d)).querySelectorAll('g[data-bl="actors"] > g[data-bp]');
    expect(actors[0]?.querySelector('circle')?.getAttribute('stroke')).toBe('var(--hue-rose)');
    expect(actors[0]?.querySelectorAll('path')).toHaveLength(1);
    const box = actors[1]?.querySelector('rect');
    expect(box?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(actors[1]?.querySelectorAll('circle')).toHaveLength(0);
    expect(actors[1]?.querySelectorAll('text').map((t) => t.text)).toEqual(['«system»', 'Ledger']);
    // The name sits inside the box.
    const name = actors[1]?.querySelector('[data-bp="actors.1.name"] text');
    const y = Number(name?.getAttribute('y'));
    expect(y).toBeGreaterThan(Number(box?.getAttribute('y')));
    expect(y).toBeLessThan(Number(box?.getAttribute('y')) + Number(box?.getAttribute('height')));
    expect(actors[2]?.querySelector('circle')?.getAttribute('stroke')).toBe('var(--hue-blue)');
  });
});

describe('usecase: lines', () => {
  it('no line passes a case it does not end on, in any fixture', () => {
    for (const [name, d] of ALL) {
      const L = layoutUsecase(d);
      const check = (pts: readonly Pt[], ends: number[]): void => {
        for (let k = 1; k < pts.length; k++) {
          L.cases.forEach((c, ci) => {
            if (ends.includes(ci)) return;
            expect(segmentHitsEllipse(pts[k - 1] as Pt, pts[k] as Pt, c.cx, c.cy, 0, c.rx, c.ry), `${name}: line into ${String(ends)} crosses case ${ci}`).toBe(false);
          });
        }
      };
      L.links.forEach((l, i) => l !== undefined && check(l.pts, [L.linkEnds[i]?.case ?? -1]));
      L.rels.forEach((r) => {
        const l = L.relLines[r.index];
        if (l !== undefined) check(l.pts, r.actors ? [] : [r.from, r.to]);
      });
      expect(L.links.every((l) => l !== undefined && !l.routed), name).toBe(true);
    }
  });

  it('an association runs from its actor and ends on its ellipse outline', () => {
    const L = layoutUsecase(STORE);
    L.links.forEach((l, i) => {
      const e = L.linkEnds[i];
      if (l === undefined || e === undefined) throw new Error('missing link');
      const a = L.actors[e.actor];
      const first = l.pts[0] as Pt;
      expect(Math.abs(first.y - (a?.y ?? 0))).toBeLessThan(1);
      expect(offOutline(l.pts[l.pts.length - 1] as Pt, L.cases[e.case] as UcCase)).toBeLessThan(0.02);
    });
  });

  it('keeps crossings rare: none in the catalog and the store, few in the large diagram', () => {
    expect(crossings(layoutUsecase(ALL[0]?.[1] as Data))).toBe(0);
    expect(crossings(layoutUsecase(STORE))).toBeLessThanOrEqual(1);
    expect(crossings(layoutUsecase(LARGE))).toBeLessThanOrEqual(12);
  });

  it('«include» points at the included case and «extend» at the base, each with its stereotype on its own line', () => {
    const L = layoutUsecase(CLINIC);
    const html = renderUsecase(CLINIC);
    const root = parse(html);
    (CLINIC.relations ?? []).forEach((r, ri) => {
      const line = L.relLines[ri];
      if (line === undefined) throw new Error('missing relation');
      // The arrowhead end is on the `to` ellipse: the included case, or the base an extension extends.
      expect(offOutline(line.pts[line.pts.length - 1] as Pt, L.cases[idx(CLINIC, r.to)] as UcCase)).toBeLessThan(0.02);
      expect(offOutline(line.pts[0] as Pt, L.cases[idx(CLINIC, r.from)] as UcCase)).toBeLessThan(0.02);
      const path = root.querySelector(`g[data-bl="relations"] > [data-bp="relations.${ri}"]`);
      expect(path?.getAttribute('stroke-dasharray')).toBe('5 4');
      expect(path?.getAttribute('marker-end')).toBe('url(#skOpen)');
      // The label: the stereotype first, then the condition; its centre on its own line.
      const label = L.labels.find((lb) => lb.path === `relations.${ri}`);
      expect(label?.lines[0]).toBe(`«${r.kind}»`);
      if (r.label !== undefined) expect(label?.lines.slice(1).join(' ')).toBe(r.label);
      const onLine = line.pts.some((p, k) => {
        if (k === 0 || label === undefined) return false;
        const q = line.pts[k - 1] as Pt;
        const t = Math.max(0, Math.min(1, ((label.lx - q.x) * (p.x - q.x) + (label.ly - q.y) * (p.y - q.y)) / ((p.x - q.x) ** 2 + (p.y - q.y) ** 2)));
        return Math.hypot(label.lx - (q.x + t * (p.x - q.x)), label.ly - (q.y + t * (p.y - q.y))) < 2;
      });
      expect(onLine).toBe(true);
    });
    expect(L.unplaced).toHaveLength(0);
    expect(html).not.toContain('class="edge-steps"');
  });

  it('an included case sits one column right of its base; an extension of a base right of it too', () => {
    const L = layoutUsecase(CLINIC);
    const x = (id: string): number => L.cases[idx(CLINIC, id)]?.cx ?? 0;
    for (const inc of ['find', 'login', 'remind', 'wait', 'fee']) expect(x(inc)).toBeGreaterThan(x('book'));
    expect(x('book')).toBe(x('cancel'));
    // A base with one included case lines up with it: the arrow runs flat.
    const S = layoutUsecase(STORE);
    expect(Math.abs((S.cases[idx(STORE, 'checkout')]?.cy ?? 0) - (S.cases[idx(STORE, 'pay')]?.cy ?? 1))).toBeLessThan(60);
  });

  it('draws generalisation solid with a hollow triangle; specialisations share one trunk; a child actor stands under its parent', () => {
    const html = renderUsecase(PAYMENTS);
    expect(html).toContain('id="ucTri"');
    const paths = parse(html).querySelectorAll('g[data-bl="relations"] > path');
    expect(paths).toHaveLength(3);
    for (const p of paths) {
      expect(p.getAttribute('marker-end')).toBe('url(#ucTri)');
      expect(p.getAttribute('stroke-dasharray')).toBeUndefined();
    }
    const L = layoutUsecase(PAYMENTS);
    const [card, bank, actor] = [L.relLines[0], L.relLines[1], L.relLines[2]];
    const end = (l: typeof card): Pt => l?.pts[l.pts.length - 1] as Pt;
    // Both branches meet the parent at one point, through one shared vertical trunk.
    expect(end(card)).toEqual(end(bank));
    const trunkX = (l: typeof card): number[] => (l?.pts ?? []).filter((p, k, a) => k > 0 && a[k - 1]?.x === p.x).map((p) => p.x);
    expect(trunkX(card)[0]).toBe(trunkX(bank)[0]);
    // Admin stands right under User, the arrow straight up into User.
    const user = L.actors[actorIdx(PAYMENTS, 'user')];
    const admin = L.actors[actorIdx(PAYMENTS, 'admin')];
    expect(admin?.x).toBe(user?.x);
    expect(admin?.y ?? 0).toBeGreaterThan(user?.y ?? 0);
    expect(actor?.pts).toHaveLength(2);
    expect(end(actor).y).toBeGreaterThan((user?.box.y ?? 0) + (user?.box.h ?? 0));
  });
});

describe('usecase: text and colour', () => {
  it('a long case name wraps whole: its ellipse grows to hold every line', () => {
    const name = 'Reconcile the monthly settlement statement against the general ledger for every legal entity';
    const d: Data = { actors: [{ id: 'a', name: 'Clerk' }], cases: [{ id: 'x', name, note: 'once a month, after close' }, { id: 'y', name: 'Short' }], links: [{ from: 'a', to: 'x' }] };
    const html = renderUsecase(d);
    expect(html).not.toContain('…');
    const root = parse(html);
    expect(root.querySelectorAll('[data-bp="cases.0.name"] text').map((t) => t.text).join(' ')).toBe(name);
    const c = layoutUsecase(d).cases[0] as UcCase;
    const { name: base, note } = caseBaselines(c);
    const fits = (line: string, baseline: number, font: typeof FONT.name | typeof FONT.sub, up: number, down: number): void => {
      const hw = textWidth(line, font) / 2;
      for (const dy of [baseline - up, baseline + down]) expect((hw / c.rx) ** 2 + (dy / c.ry) ** 2).toBeLessThan(1);
    };
    c.name.forEach((l, k) => fits(l, base[k] ?? 0, FONT.name, 10, 3));
    c.note.forEach((l, k) => fits(l, note[k] ?? 0, FONT.sub, 7, 2));
    expect(c.ry).toBeGreaterThan(layoutUsecase(d).cases[1]?.ry ?? 0);
  });

  it('accents only the case in `focus`, and names it in the legend', () => {
    const root = parse(renderUsecase(STORE));
    const accented = root.querySelectorAll('g[data-bl="cases"] ellipse').filter((e) => e.getAttribute('stroke') === 'var(--accent)');
    expect(accented).toHaveLength(1);
    expect(accented[0]?.parentNode.getAttribute('data-bp')).toBe(`cases.${idx(STORE, 'checkout')}`);
    const plain = parse(renderUsecase({ ...STORE, focus: undefined } as Data));
    expect(plain.toString()).not.toContain('var(--accent)');
  });

  it('lists only the relation kinds in play in the legend', () => {
    const labels = (d: Data): string[] => parse(renderUsecase(d)).querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
    expect(labels(STORE)).toEqual(['in focus', 'association · takes part', '«include» · always runs']);
    expect(labels(CLINIC)).toEqual(['association · takes part', '«include» · always runs', '«extend» · runs on a condition']);
    expect(labels(PAYMENTS)).toEqual(['association · takes part', 'is a kind of']);
    // Associations alone need no key.
    expect(labels({ actors: [{ id: 'a', name: 'A' }], cases: [{ id: 'x', name: 'X' }], links: [{ from: 'a', to: 'x' }] })).toEqual([]);
  });

  it('keeps up to twelve unrelated cases in one clean column, and threads a split column through its own gaps', () => {
    const many = (n: number): Data => {
      const cases = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Case ${i}` }));
      return {
        actors: [{ id: 'a', name: 'Member' }, { id: 'b', name: 'Librarian' }],
        cases,
        links: cases.map((c, i) => ({ from: i < n / 2 ? 'a' : 'b', to: c.id })),
      };
    };
    const one = layoutUsecase(many(8));
    expect(new Set(one.cases.map((c) => c.cx)).size).toBe(1);
    expect(one.links.every((l) => l?.pts.length === 2)).toBe(true);
    const two = layoutUsecase(many(14));
    expect(new Set(two.cases.map((c) => c.cx)).size).toBe(2);
    // A thread bends once at most, never shares a run with another line, and nothing crosses.
    expect(two.links.every((l) => l !== undefined && !l.routed && l.pts.length <= 3)).toBe(true);
    const runs = two.links.flatMap((l) => (l?.pts ?? []).slice(1).map((p, k) => [l?.pts[k] as Pt, p] as const).filter(([p, q]) => p.y === q.y && p.x !== q.x));
    runs.forEach(([p, q], i) =>
      runs.slice(i + 1).forEach(([r, t]) => {
        if (p.y !== r.y) return;
        expect(Math.min(Math.max(p.x, q.x), Math.max(r.x, t.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, t.x))).toBeLessThan(4);
      }),
    );
    expect(crossings(two)).toBe(0);
  });

  it('is deterministic', () => {
    expect(renderUsecase(LARGE)).toBe(renderUsecase(LARGE));
  });
});
