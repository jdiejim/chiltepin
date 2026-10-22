/**
 * The inline styling grammar (`inline.ts`): highlights, styled spans, and
 * icons — what each matcher accepts and refuses, how a whole text scans, and
 * how the plain-text outputs strip the syntax to words.
 */

import { describe, expect, it } from 'vitest';
import {
  CHIP_STATUSES,
  ICON_NAMES,
  ICON_SYNONYMS,
  SPAN_CLASSES,
  SPAN_HUES,
  headingSlug,
  iconLabel,
  iconText,
  inlineMdStrings,
  inlineStart,
  isIconName,
  matchIcon,
  matchIconLike,
  matchMark,
  matchSpan,
  readSpanClasses,
  scanInline,
  stringsAt,
  stripInlineStyling,
} from '../index.js';

describe('matchMark (==text==)', () => {
  it('reads a highlight and the text inside it', () => {
    expect(matchMark('==plain highlight== rest')).toEqual({
      raw: '==plain highlight==',
      text: 'plain highlight',
    });
    expect(matchMark('==**bold** and *em*== x')?.text).toBe('**bold** and *em*');
  });

  it('skips a code span inside, even one that holds ==', () => {
    expect(matchMark('==`code` inside== x')?.text).toBe('`code` inside');
    expect(matchMark('==x`==`y== z')?.text).toBe('x`==`y');
  });

  it('refuses a comparison, a triple mark, an open mark, and an empty one', () => {
    expect(matchMark('== b')).toBeUndefined();
    expect(matchMark('=== b')).toBeUndefined();
    expect(matchMark('==open only')).toBeUndefined();
    expect(matchMark('====')).toBeUndefined();
    expect(matchMark('==a ==')).toBeUndefined();
  });

  it('refuses a highlight inside a word, so code-ish text stays text', () => {
    expect(matchMark('==b==c', 'a')).toBeUndefined();
    expect(matchMark('==y==z', ' ')).toBeUndefined();
    expect(matchMark('==x==', '=')).toBeUndefined();
  });

  it('pairs a closing mark with the nearest opening one', () => {
    expect(matchMark('==open.\nwraps: ==the answer==.')).toBeUndefined();
    expect(matchMark('==the answer==.')?.text).toBe('the answer');
    expect(matchMark('==a == b== x')?.text).toBe('a == b');
  });

  it('an escaped closing mark does not close', () => {
    expect(matchMark('==text\\==')).toBeUndefined();
  });
});

describe('matchSpan ([text]{.class})', () => {
  it('reads the text and the class names', () => {
    expect(matchSpan('[Beta]{.pill} ready')).toEqual({
      raw: '[Beta]{.pill}',
      text: 'Beta',
      classes: ['pill'],
    });
    expect(matchSpan('[Done]{ .pill  .done }')?.classes).toEqual(['pill', 'done']);
  });

  it('keeps nested brackets and links inside', () => {
    expect(matchSpan('[see [docs](https://x.dev)]{.green}')?.text).toBe(
      'see [docs](https://x.dev)',
    );
    expect(matchSpan('[`a]b`]{.blue}')?.text).toBe('`a]b`');
  });

  it('leaves links, reference links, and look-alikes alone', () => {
    for (const src of [
      '[a link](https://x.dev)',
      '[ref][r]',
      '[x] {.blue}',
      '[x]{y}',
      '[x]{#id}',
      '[x]{.blue onclick=alert(1)}',
      '[x]{.blue',
      '[ ]{.pill}',
      '[x]{.blue\n.green}',
    ]) {
      expect(matchSpan(src), src).toBeUndefined();
    }
  });
});

describe('readSpanClasses', () => {
  it('allows one hue, .kbd, or .pill with at most one status', () => {
    for (const h of SPAN_HUES)
      expect(readSpanClasses([h])).toEqual({ ok: true, style: { kind: 'hue', hue: h } });
    expect(readSpanClasses(['kbd'])).toEqual({ ok: true, style: { kind: 'kbd' } });
    expect(readSpanClasses(['pill'])).toEqual({ ok: true, style: { kind: 'chip' } });
    for (const s of CHIP_STATUSES)
      expect(readSpanClasses(['pill', s])).toEqual({
        ok: true,
        style: { kind: 'chip', status: s },
      });
    expect(readSpanClasses(['done', 'pill'])).toEqual({
      ok: true,
      style: { kind: 'chip', status: 'done' },
    });
  });

  it('names the problem with anything else', () => {
    expect(readSpanClasses(['purple'])).toEqual({ ok: false, problem: 'unknown', bad: 'purple' });
    expect(readSpanClasses(['Blue'])).toEqual({ ok: false, problem: 'unknown', bad: 'Blue' });
    expect(readSpanClasses(['done'])).toEqual({
      ok: false,
      problem: 'status-needs-pill',
      bad: 'done',
    });
    expect(readSpanClasses(['pill', 'green'])).toEqual({
      ok: false,
      problem: 'chip-hue',
      bad: 'green',
    });
    expect(readSpanClasses(['blue', 'green'])).toMatchObject({ ok: false, problem: 'mixed' });
    expect(readSpanClasses(['pill', 'done', 'todo'])).toMatchObject({
      ok: false,
      problem: 'mixed',
    });
    expect(readSpanClasses(['pill', 'kbd'])).toMatchObject({ ok: false, problem: 'mixed' });
  });

  it('the class list is the hues, kbd, pill, and the statuses', () => {
    expect([...SPAN_CLASSES].sort()).toEqual(
      [...SPAN_HUES, 'kbd', 'pill', ...CHIP_STATUSES].sort(),
    );
  });
});

describe('matchIcon (:name:)', () => {
  it('reads a known icon with no letter, digit, or colon beside it', () => {
    expect(matchIcon(':check: passed')).toEqual({ raw: ':check:', name: 'check' });
    expect(matchIcon(':git-branch:.', '(')?.name).toBe('git-branch');
  });

  it('leaves times, ratios, scopes, and unknown names alone', () => {
    expect(matchIcon(':30:00', '0')).toBeUndefined();
    expect(matchIcon(':check:b', ' ')).toBeUndefined();
    expect(matchIcon(':check:', 'a')).toBeUndefined();
    expect(matchIcon(':check::x', ':')).toBeUndefined();
    expect(matchIcon(':nope:')).toBeUndefined();
    expect(matchIcon(':Check:')).toBeUndefined();
  });

  it('matchIconLike also reads unknown icon-shaped names, for the lint', () => {
    expect(matchIconLike(':white_check_mark: x')?.name).toBe('white_check_mark');
    expect(matchIconLike(':nope:')?.name).toBe('nope');
    expect(matchIconLike(':10:')).toBeUndefined();
  });

  it('inlineStart stops a text run only where a form can start, never inside a URL', () => {
    expect(inlineStart('see https://x.dev:8080/a')).toBe(-1);
    expect(inlineStart('at 10:30:00 sharp')).toBe(-1);
    expect(inlineStart('ok :check: done')).toBe(3);
    expect(inlineStart('a ==b== c')).toBe(2);
  });
});

describe('scanInline', () => {
  it('finds every form, with nested ones and offsets', () => {
    const found = scanInline('A ==b :check:== and [c]{.blue} :nope:');
    expect(found.map((f) => [f.kind, f.start, f.raw])).toEqual([
      ['mark', 2, '==b :check:=='],
      ['icon', 6, ':check:'],
      ['span', 20, '[c]{.blue}'],
      ['icon', 31, ':nope:'],
    ]);
  });

  it('skips code spans, escapes, link destinations, autolinks, and bare URLs', () => {
    const text =
      '`==x==` \\==y== [a](http://h/:check:) <http://h/:x:> https://h/:nope: ``[x]{.purple}``';
    expect(scanInline(text)).toEqual([]);
  });
});

describe('stripInlineStyling', () => {
  it('keeps the words of highlights and spans', () => {
    expect(stripInlineStyling('A ==key fact== and [Beta]{.pill .current}')).toBe(
      'A key fact and Beta',
    );
    expect(stripInlineStyling('[unknown]{.purple} stays words')).toBe('unknown stays words');
  });

  it('turns a state or direction icon into its text symbol and drops the rest', () => {
    expect(stripInlineStyling(':check: Passed')).toBe('✓ Passed');
    expect(stripInlineStyling(':rocket: Launch plan')).toBe('Launch plan');
    expect(stripInlineStyling('Fast :bolt: path')).toBe('Fast path');
  });

  it('leaves code, unknown icons, and plain Markdown as written', () => {
    expect(stripInlineStyling('`==x==` and :nope: and **bold**')).toBe(
      '`==x==` and :nope: and **bold**',
    );
    expect(stripInlineStyling('no styling at all')).toBe('no styling at all');
  });

  it('heading anchors ignore the styling', () => {
    expect(headingSlug(':rocket: Launch [Beta]{.pill}')).toBe('launch-beta');
    expect(headingSlug('The ==80 ms== budget')).toBe('the-80-ms-budget');
    expect(headingSlug('Plain heading')).toBe('plain-heading');
  });
});

describe('icon names', () => {
  it('has the shared set: 21 house icons plus the inline set, no duplicates', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(55);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    for (const n of ICON_NAMES) expect(n, n).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });

  it('every synonym points at a real icon and is not itself an icon', () => {
    for (const [from, to] of Object.entries(ICON_SYNONYMS)) {
      expect(isIconName(to), `${from} → ${to}`).toBe(true);
      expect(isIconName(from), from).toBe(false);
    }
  });

  it('every icon has a spoken label; a few have a text symbol', () => {
    expect(iconLabel('x')).toBe('cross');
    expect(iconLabel('trend-up')).toBe('trend up');
    expect(iconText('check')).toBe('✓');
    expect(iconText('database')).toBe('');
    for (const n of ICON_NAMES) expect(iconLabel(n).length).toBeGreaterThan(0);
  });
});

describe('inline-Markdown fields', () => {
  it('stringsAt walks list wildcards and object keys', () => {
    const data = { rows: [['a', { v: 'b' }, 3], ['c']], columns: ['x', { label: 'y' }] };
    expect(stringsAt(data, 'rows[][]').map((s) => s.text)).toEqual(['a', 'c']);
    expect(stringsAt(data, 'rows[][].v')).toEqual([{ path: ['rows', 0, 1, 'v'], text: 'b' }]);
    expect(inlineMdStrings('table', data).map((s) => s.text)).toEqual(['x', 'y', 'a', 'c', 'b']);
  });

  it('a block with no inline field has none', () => {
    expect(inlineMdStrings('flow', { nodes: [{ id: 'a', label: ':nope:' }] })).toEqual([]);
  });
});
