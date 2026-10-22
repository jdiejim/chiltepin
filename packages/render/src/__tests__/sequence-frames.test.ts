/**
 * Sequence frames, activation bars, self-loops and note boxes — geometry
 * pinned against the row model (message 36 · frame open 28 · else 24 ·
 * end 14 · note 36 + 13/extra line; first row 84). Lane x positions come
 * from the data: 150px lanes with a 46px minimum gap that widens to fit the
 * widest label between two adjacent lanes (see `laneGaps`).
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { laneGaps, renderSequence } from '../blocks/sequence.js';

const ACTORS = [
  { id: 'A', name: 'A' },
  { id: 'B', name: 'B' },
  { id: 'C', name: 'C' },
];

type Msgs = NonNullable<Parameters<typeof renderSequence>[0]['messages']>;

const LEFT_PAD = 24;
const LANE_W = 150;

/** Lane centre x for each actor, from the same rule the renderer uses. */
function laneXs(messages: Msgs, actors = ACTORS): number[] {
  const gaps = laneGaps(actors, messages);
  const xs: number[] = [];
  let x = LEFT_PAD + LANE_W / 2;
  actors.forEach((_, i) => {
    xs.push(x);
    x += LANE_W + (gaps[i] ?? 0);
  });
  return xs;
}

/** The svg width for the lanes: pads + lanes + gaps. */
function svgWidth(messages: Msgs, actors = ACTORS): number {
  return LEFT_PAD * 2 + actors.length * LANE_W + laneGaps(actors, messages).reduce((a, g) => a + g, 0);
}

function rects(html: string, cls: string): Array<{ x: number; y: number; w: number; h: number }> {
  const root = parse(html);
  return root.querySelectorAll(`rect.${cls}`).map((r) => ({
    x: Number(r.getAttribute('x')),
    y: Number(r.getAttribute('y')),
    w: Number(r.getAttribute('width')),
    h: Number(r.getAttribute('height')),
  }));
}

function lineYs(html: string): number[] {
  return parse(html)
    .querySelectorAll('line.msg-line')
    .map((l) => Number(l.getAttribute('y1')));
}

describe('sequence frames', () => {
  const messages: Msgs = [
    { from: 'A', to: 'B', label: 'call', activate: true }, // y 84
    { frame: 'alt', label: 'ok' }, // top edge 98
    { from: 'B', to: 'C', label: 'q', activate: true }, // y 148
    { from: 'C', to: 'B', label: 'r', kind: 'response', deactivate: true }, // y 184
    { else: 'fail' }, // divider 192
    { from: 'B', to: 'A', label: 'err', kind: 'error', deactivate: true }, // y 244
    { end: true }, // bottom edge 254
  ];
  const html = renderSequence({ actors: ACTORS, messages });
  const [xA, xB, xC] = laneXs(messages) as [number, number, number];

  it('rows take their own heights; message numbers skip the markers', () => {
    expect(lineYs(html)).toEqual([84, 148, 184, 244]);
    const badges = parse(html).querySelectorAll('.step-badge-text').map((t) => t.text);
    expect(badges).toEqual(['1', '2', '3', '4']);
  });

  it('the frame spans the lifelines its messages touch (± 18) from the open row to the end row', () => {
    const [frame] = rects(html, 'seq-frame');
    // A … C, ± 18; open edge 98, end edge 254.
    expect(frame).toEqual({ x: xA - 18, y: 98, w: xC - xA + 36, h: 156 });
  });

  it('draws the tab, the guard, and a dashed else divider with its guard', () => {
    const root = parse(html);
    expect(root.querySelector('.seq-frame-tab-text')?.text).toBe('ALT');
    const guards = root.querySelectorAll('.seq-frame-guard').map((g) => g.text);
    expect(guards).toEqual(['[ok]', '[fail]']);
    const div = root.querySelector('line.seq-frame-else');
    expect(div?.getAttribute('x1')).toBe(String(xA - 18));
    expect(div?.getAttribute('x2')).toBe(String(xC + 18));
    expect(div?.getAttribute('y1')).toBe('192');
  });

  it('frame bodies are drawn before the lifelines, tabs after', () => {
    const body = html.indexOf('class="seq-frame"');
    const lifeline = html.indexOf('class="lifeline"');
    const tab = html.indexOf('class="seq-frame-tab"');
    const msgs = html.indexOf('data-bl="messages"');
    expect(body).toBeLessThan(lifeline);
    expect(lifeline).toBeLessThan(tab);
    expect(tab).toBeLessThan(msgs);
  });

  it('explicit activation opens on `to` at the message row and closes on `from` at the deactivate row', () => {
    const bars = rects(html, 'activation');
    // B: opened at 84 (call), closed at 244 (err) — padded 6 each side; 6px wide.
    expect(bars).toContainEqual({ x: xB - 3, y: 78, w: 6, h: 172 });
    // C: opened at 148 (q), closed at 184 (r).
    expect(bars).toContainEqual({ x: xC - 3, y: 142, w: 6, h: 48 });
    expect(bars).toHaveLength(2);
  });

  it('frame markers carry data paths and the step list mirrors the frame', () => {
    const withSummaries = renderSequence({
      actors: ACTORS,
      messages: messages.map((m) => ('from' in m ? { ...m, summary: `step ${m.label}` } : m)),
    });
    const root = parse(withSummaries);
    expect(withSummaries).toContain('<g data-bp="messages.1" data-reveal="1">');
    expect(withSummaries).toContain('<g data-bp="messages.4" data-reveal="4">');
    const lis = root.querySelectorAll('.seq-steps li');
    expect(lis.map((li) => li.classNames)).toEqual(['', 'step-frame', '', '', 'step-frame else', 'err']);
    expect(lis[1]?.text).toBe('ALTok');
    expect(lis[4]?.text).toBe('elsefail');
    expect(lis.map((li) => li.querySelector('.step-n')?.text ?? '')).toEqual(['1', '', '2', '3', '', '4']);
  });
});

describe('nested and unclosed frames', () => {
  it('a nested frame is inset 12px inside its parent and the parent grows around it', () => {
    const messages: Msgs = [
        { from: 'A', to: 'B', label: 'a' }, // 84
        { frame: 'alt', label: 'outer' }, // 98
        { frame: 'loop', label: 'inner' }, // 126
        { from: 'B', to: 'C', label: 'b' }, // 176
        { end: true }, // 186
        { from: 'A', to: 'B', label: 'c' }, // 226
        { end: true }, // 236
      ];
    const html = renderSequence({ actors: ACTORS, messages });
    const [xA, xB, xC] = laneXs(messages) as [number, number, number];
    const [outer, inner] = rects(html, 'seq-frame');
    expect(inner).toEqual({ x: xB - 18, y: 126, w: xC - xB + 36, h: 60 });
    // Outer: A…C padded, then the inner's right edge + 12.
    expect(outer).toEqual({ x: xA - 18, y: 98, w: xC + 18 + 12 - (xA - 18), h: 138 });
    if (outer === undefined || inner === undefined) throw new Error('two frames expected');
    expect(inner.x).toBeGreaterThanOrEqual(outer.x + 12);
    expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w - 12);
  });

  it('an unclosed frame runs to the last row; a stray else/end draws nothing', () => {
    const messages: Msgs = [
      { end: true }, // stray: draws nothing, still a 14px row
      { else: 'stray' }, // stray: 24px row
      { frame: 'opt', label: 'open' }, // top 86 + 14 = 100
      { from: 'A', to: 'B', label: 'x' }, // 150
    ];
    const html = renderSequence({ actors: ACTORS, messages });
    const [xA, xB] = laneXs(messages) as [number, number];
    const frames = rects(html, 'seq-frame');
    expect(frames).toHaveLength(1);
    // Last row ends at cursor 150; bottom edge = cursor + 6.
    expect(frames[0]).toEqual({ x: xA - 18, y: 100, w: xB - xA + 36, h: 56 });
    expect(parse(html).querySelectorAll('.seq-frame-else')).toHaveLength(0);
  });
});

describe('auto activation', () => {
  it('a bar opens on an incoming sync call and closes at the reply to the caller; reply-only actors get none', () => {
    const messages: Msgs = [
      { from: 'A', to: 'B', label: 'call' }, // 84
      { from: 'B', to: 'C', label: 'q' }, // 120
      { from: 'C', to: 'B', label: 'r', kind: 'response' }, // 156
      { from: 'B', to: 'A', label: 'done', kind: 'response' }, // 192
    ];
    const html = renderSequence({ actors: ACTORS, messages });
    const [, xB, xC] = laneXs(messages) as [number, number, number];
    const bars = rects(html, 'activation');
    expect(bars).toEqual([
      { x: xB - 3, y: 78, w: 6, h: 120 },
      { x: xC - 3, y: 114, w: 6, h: 48 },
    ]);
  });

  it('with no reply, the bar closes at the actor\'s last outgoing message; the first actor can have a bar', () => {
    const messages: Msgs = [
      { from: 'B', to: 'A', label: 'notify', kind: 'async' }, // 84 → bar on A
      { from: 'A', to: 'C', label: 'forward' }, // 120 → A's last outgoing; bar on C
      { from: 'A', to: 'B', label: 'ack', kind: 'response' }, // 156 → closes A
    ];
    const html = renderSequence({ actors: ACTORS, messages });
    const [xA, , xC] = laneXs(messages) as [number, number, number];
    const bars = rects(html, 'activation');
    expect(bars).toContainEqual({ x: xA - 3, y: 78, w: 6, h: 84 });
    // C never replies or sends: nothing extends its bar, so no empty box is drawn.
    expect(bars.some((b) => b.x === xC - 3)).toBe(false);
  });

  it('a frame-less list renders the same rows as before', () => {
    const messages: Msgs = [
      { from: 'A', to: 'B', label: 'one' },
      { from: 'B', to: 'C', label: 'two' },
      { from: 'C', to: 'A', label: 'three', kind: 'response' },
    ];
    const html = renderSequence({ actors: ACTORS, messages });
    expect(lineYs(html)).toEqual([84, 120, 156]);
    // 84 + 2 × 36 + 36 + 12 = 204 bottom, + 6; short labels keep the 46px gaps.
    expect(laneGaps(ACTORS, messages)).toEqual([46, 46]);
    expect(html).toContain(`viewBox="0 0 ${svgWidth(messages)} 210"`);
    expect(html).toContain('<g data-bp="messages.0" data-reveal="0">');
    expect(html).toContain('<g data-bp="messages.2" data-reveal="2">');
  });
});

describe('self-messages and notes', () => {
  it('a self-message is a loop path out 28 and down 14 with an arrowhead, its label to the right', () => {
    const messages: Msgs = [{ from: 'B', to: 'B', label: 'tick' }];
    const html = renderSequence({ actors: ACTORS, messages });
    const [, xB] = laneXs(messages) as [number, number];
    const root = parse(html);
    const path = root.querySelector('path.msg-line');
    expect(path?.getAttribute('d')).toBe(`M${xB},70 H${xB + 28} V84 H${xB + 3}`);
    expect(path?.classNames).toContain('self');
    expect(path?.getAttribute('marker-end')).toBe('url(#sqArrow)');
    const label = root.querySelector('text.msg-text');
    expect(label?.getAttribute('x')).toBe(String(xB + 36));
    expect(label?.text).toBe('tick');
    expect(root.querySelector('circle.step-badge')?.getAttribute('cy')).toBe('58');
  });

  it('a note over two actors spans both lifelines; a one-actor note sits beside its lifeline', () => {
    const overMsgs: Msgs = [{ from: 'A', to: 'B', kind: 'note', label: 'hello' }];
    const over = renderSequence({ actors: ACTORS, messages: overMsgs });
    const [xA, xB] = laneXs(overMsgs) as [number, number];
    // Spans both lifelines + 60, centred between them.
    const w = xB - xA + 60;
    expect(rects(over, 'seq-note')).toEqual([{ x: Math.round((xA + xB) / 2 - w / 2), y: 62, w, h: 18 }]);
    expect(parse(over).querySelector('.seq-note-text')?.text).toBe('hello');
    expect(parse(over).querySelector('.step-badge')).toBeNull();

    const beside = renderSequence({
      actors: ACTORS,
      messages: [{ from: 'A', to: 'A', kind: 'note', label: 'hi', summary: 'a note with a step' }],
    });
    expect(rects(beside, 'seq-note')).toEqual([{ x: xA + 12, y: 62, w: 72, h: 18 }]);
    // A summary keeps the badge so the step list can reference it; a note is
    // never numbered, so both show the note mark.
    expect(parse(beside).querySelector('.step-badge-text')?.text).toBe('i');
    expect(parse(beside).querySelector('.seq-steps .step-n')?.text).toBe('i');
  });

  it('a long note wraps to at most 3 lines and grows its row', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'A', to: 'B', kind: 'note', label: 'a note long enough to wrap onto a second and even a third line of text' },
        { from: 'A', to: 'B', label: 'after' },
      ],
    });
    expect(parse(html).querySelectorAll('.seq-note-text')).toHaveLength(3);
    // 36 + 2×13 = 62 for the note row, then the 36px message row.
    expect(lineYs(html)).toEqual([146]);
  });

  it('a note on the last lane moves to the left of its lifeline instead of running off the canvas', () => {
    const messages: Msgs = [{ from: 'C', to: 'C', kind: 'note', label: 'a note too wide to sit right of the last lane' }];
    const html = renderSequence({ actors: ACTORS, messages });
    const [, , xC] = laneXs(messages) as [number, number, number];
    const [box] = rects(html, 'seq-note');
    if (box === undefined) throw new Error('note box expected');
    expect(box.x + box.w).toBeLessThanOrEqual(xC - 12);
    // A short one still sits to the right.
    const short = rects(renderSequence({ actors: ACTORS, messages: [{ from: 'C', to: 'C', kind: 'note', label: 'ok' }] }), 'seq-note');
    expect(short[0]?.x).toBe(xC + 12);
  });
});

describe('lane spacing adapts to labels', () => {
  it('a long label between two adjacent lanes widens only that gap; a multi-lane message uses the sum', () => {
    const long = '401 invalid_grant (reuse) — the family was revoked';
    const messages: Msgs = [
      { from: 'A', to: 'B', label: 'call' },
      { from: 'C', to: 'B', label: long, kind: 'error' },
      { from: 'C', to: 'A', label: 'a label longer than the A–B gap alone could hold', kind: 'response' },
    ];
    const gaps = laneGaps(ACTORS, messages);
    // A–B keeps the minimum; B–C fits `chars × 6.2 + 40` inside lane + gap.
    expect(gaps[0]).toBe(46);
    expect(gaps[1]).toBe(Math.ceil(long.length * 6.2 + 40) - 150);
    const html = renderSequence({ actors: ACTORS, messages });
    const [xA, xB, xC] = laneXs(messages) as [number, number, number];
    expect(xB - xA).toBe(196);
    expect(xC - xB).toBe(150 + (gaps[1] ?? 0));
    expect(html).toContain(`viewBox="0 0 ${svgWidth(messages)} `);
    // The label, anchored 34px inside the sender's lane, ends short of the receiver's lifeline.
    const label = parse(html).querySelectorAll('text.msg-text')[1];
    const end = Number(label?.getAttribute('x')) - long.length * 6.2;
    expect(end).toBeGreaterThan(xB + 3);
  });
});
