/**
 * Inline styling in the renderer (`markdown.ts`): `==highlight==`,
 * `[text]{.class}` spans (hue, key cap, status chip), and `:icon:`.
 *
 * Pins the markup of every form and its edge cases, that nothing an author
 * writes reaches an attribute (the output is shown in hosted previews of
 * untrusted docs), that every field core's `INLINE_MD_FIELDS` lists really
 * renders inline Markdown (so the lint reads exactly what renders), the
 * plain-text outputs, the CSS each form needs, and the highlight's contrast.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseHtml } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  ICON_NAMES,
  INLINE_MD_FIELDS,
  inlineMdStrings,
  parseDocument,
  SPAN_HUES,
  type BlockType,
} from 'chiltepin-core';
import { renderList } from '../blocks/list.js';
import { DARK_SET, houseCss, LIGHT_SET } from '../css.js';
import { toSlides } from '../deck.js';
import { renderDocument } from '../document.js';
import { renderInlineMd, renderProse } from '../markdown.js';
import { htmlRenderers } from '../registry.js';
import { HUES } from '../svg/hues.js';
import { ICONS } from '../svg/icons.js';

const md = (s: string): string => renderInlineMd(s);

describe('==highlight==', () => {
  it('draws <mark>, with Markdown inside', () => {
    expect(md('A ==key fact== here.')).toBe('A <mark>key fact</mark> here.');
    expect(md('==**bold** and *em*==')).toBe('<mark><strong>bold</strong> and <em>em</em></mark>');
    expect(md('==`code` inside==')).toBe('<mark><code>code</code> inside</mark>');
    expect(md('[==link==](https://x.dev)')).toBe('<a href="https://x.dev"><mark>link</mark></a>');
  });

  it('leaves comparisons, code, escapes, and open marks as text', () => {
    expect(md('a == b, a === b')).toBe('a == b, a === b');
    expect(md('`==code==`')).toBe('<code>==code==</code>');
    expect(md('\\==escaped==')).toBe('==escaped==');
    expect(md('==open only')).toBe('==open only');
    expect(md('a==b==c')).toBe('a==b==c');
  });
});

describe('[text]{.class} spans', () => {
  it('a hue draws the hue span; .kbd a key cap; .pill the status chip', () => {
    for (const h of SPAN_HUES) expect(md(`[x]{.${h}}`)).toBe(`<span class="hl hl-${h}">x</span>`);
    expect(md('[Ctrl]{.kbd}')).toBe('<kbd>Ctrl</kbd>');
    expect(md('[Beta]{.pill}')).toBe('<span class="pill">Beta</span>');
    expect(md('[Todo]{.pill .todo}')).toBe('<span class="pill pill-init">Todo</span>');
    expect(md('[Done]{.pill .done}')).toBe('<span class="pill pill-wait">Done</span>');
    expect(md('[Now]{.pill .current}')).toBe('<span class="pill pill-end">Now</span>');
    expect(md('[Blocked]{.pill .blocked}')).toBe('<span class="pill pill-neg">Blocked</span>');
  });

  it('keeps Markdown and links inside a span', () => {
    expect(md('[**bold** `c`]{.blue}')).toBe(
      '<span class="hl hl-blue"><strong>bold</strong> <code>c</code></span>',
    );
    expect(md('[see [docs](https://x.dev)]{.green}')).toBe(
      '<span class="hl hl-green">see <a href="https://x.dev">docs</a></span>',
    );
  });

  it('an unknown or mixed class list shows the plain text', () => {
    expect(md('[falls back]{.purple}')).toBe('falls back');
    expect(md('[two]{.blue .green}')).toBe('two');
    expect(md('[Done]{.done}')).toBe('Done');
    expect(md('[Chip]{.pill .green}')).toBe('Chip');
  });

  it('never breaks links, reference links, or look-alikes', () => {
    expect(md('[a link](https://x.dev)')).toBe('<a href="https://x.dev">a link</a>');
    expect(renderProse('See [the guide][g].\n\n[g]: https://x.dev')).toContain(
      '<a href="https://x.dev">the guide</a>',
    );
    expect(md('[x] {.blue} and [x]{y} and [x]{#id}')).toBe('[x] {.blue} and [x]{y} and [x]{#id}');
    expect(renderProse('- [x] done\n- [ ] todo')).toContain('type="checkbox"');
  });
});

describe(':icon:', () => {
  it('draws a known icon at text size, named for a screen reader', () => {
    const html = md(':check: passed');
    expect(html).toMatch(
      /^<svg class="ic" viewBox="0 0 24 24" [^>]*role="img" aria-label="check">/,
    );
    expect(html).toContain(ICONS.check);
    expect(html.endsWith('</svg> passed')).toBe(true);
    expect(md(':x:')).toContain('aria-label="cross"');
  });

  it('leaves times, ratios, scopes, URLs, code, and unknown names as text', () => {
    expect(md('10:30:00 and a:b:c and std::check::x and :nope:')).toBe(
      '10:30:00 and a:b:c and std::check::x and :nope:',
    );
    expect(md('`:check:`')).toBe('<code>:check:</code>');
    expect(md('see https://x.dev:8080/a')).toBe(
      'see <a href="https://x.dev:8080/a">https://x.dev:8080/a</a>',
    );
    expect(md('https://x.dev/:check:x')).not.toContain('<svg');
  });

  it('works in a heading, with the slide markers still stripped', () => {
    expect(renderProse('## :rocket: Launch [Beta]{.pill} {split}')).toMatch(
      /^<div class="prose"><h2><svg class="ic"[^>]*aria-label="rocket">.*<\/svg> Launch <span class="pill">Beta<\/span><\/h2>/,
    );
  });

  it('every icon draws in a list block, the expanded set included', () => {
    const html = renderList({
      style: 'icon',
      items: ICON_NAMES.map((n) => ({ lead: n, icon: n })),
    });
    for (const n of ICON_NAMES) expect(html, n).toContain(ICONS[n]);
  });
});

describe('nothing an author writes reaches an attribute', () => {
  const ATTACKS = [
    '[x]{.blue"><script>alert(1)</script>}',
    '[x]{.blue onclick=alert(1)}',
    '[x]{.blue style=color:red}',
    '[x]{.blue} [y]{.pill .x"onmouseover="alert(1)}',
    '[<img src=x onerror=alert(1)>]{.blue}',
    '==<b onmouseover=alert(1)>bold</b>==',
    ':check:<script>alert(2)</script>',
    '[x]{.kbd}<svg onload=alert(3)>',
    '[a](javascript:alert(1)){.blue}',
    '[[a](javascript:alert(1))]{.pill}',
    '==[a](data:text/html,x)==',
  ];

  /** Every element and attribute the inline pipeline may emit. */
  const TAGS = new Set([
    'div',
    'p',
    'mark',
    'span',
    'kbd',
    'a',
    'strong',
    'em',
    'code',
    'svg',
    'path',
    'circle',
    'rect',
    'ellipse',
  ]);
  const ATTRS = new Set([
    'class',
    'href',
    'viewbox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'role',
    'aria-label',
    'd',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'width',
    'height',
  ]);
  const CLASS =
    /^(prose|ic|pill( pill-(init|wait|end|neg))?|hl hl-(blue|green|amber|violet|teal|rose))$/;

  it.each(ATTACKS)('%s', (attack) => {
    const root = parseHtml(renderProse(attack));
    for (const el of root.querySelectorAll('*')) {
      expect(TAGS, `<${el.rawTagName}> in ${attack}`).toContain(el.rawTagName.toLowerCase());
      for (const [name, value] of Object.entries(el.attributes)) {
        expect(ATTRS, `${name}= in ${attack}`).toContain(name.toLowerCase());
        if (name === 'class') expect(value, attack).toMatch(CLASS);
        if (name === 'href') expect(value, attack).not.toMatch(/^(javascript|data|vbscript):/i);
      }
    }
  });
});

/* ── the lint reads exactly the fields that render inline Markdown ─────── */

const BLOCKS_DIR = join(import.meta.dirname, '../blocks');
const callsInline = (type: string): boolean => {
  try {
    return readFileSync(join(BLOCKS_DIR, `${type}.ts`), 'utf8').includes('renderInlineMd(');
  } catch {
    return false;
  }
};

const P = '==probe==';
/** Data that fills every inline-Markdown field of a block with the probe. */
const PROBES: Readonly<Record<string, unknown>> = {
  callout: { tone: 'tip', body: P },
  pullquote: { text: P },
  prose: {
    blocks: [
      { type: 'p', text: P },
      { type: 'ul', items: [P] },
    ],
  },
  scqa: { situation: P, complication: P, question: P, answer: P, because: [P] },
  table: { columns: [P, { label: P }], rows: [[P, { v: P }]] },
};

describe('INLINE_MD_FIELDS matches the renderers', () => {
  const listed = Object.keys(INLINE_MD_FIELDS) as BlockType[];

  it('every block renderer that calls renderInlineMd is listed', () => {
    const files = readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.ts'));
    const calling = files
      .map((f) => f.replace(/\.ts$/, ''))
      .filter((t) => (BLOCK_TYPES as readonly string[]).includes(t) && callsInline(t));
    for (const t of calling)
      expect(listed, `${t} renders inline Markdown; add its fields to INLINE_MD_FIELDS`).toContain(
        t,
      );
  });

  for (const type of listed) {
    // A block whose renderer has not moved to inline Markdown yet is skipped,
    // and checked as soon as it does.
    it.runIf(callsInline(type))(`${type}: every listed field renders the highlight`, () => {
      const data = PROBES[type];
      expect(data, `add a probe for ${type}`).toBeDefined();
      const fields = inlineMdStrings(type, data);
      const html = (htmlRenderers[type] as (d: unknown) => string)(data);
      expect(html.split('<mark>probe</mark>').length - 1).toBe(fields.length);
    });
  }
});

/* ── plain-text outputs ─────────────────────────────────────────────────── */

const DOC = [
  '```meta',
  'title: Styled',
  'subtitle: ":check: Ready for ==review== [Beta]{.pill}"',
  '```',
  '',
  '## :rocket: Launch [Beta]{.pill}',
  '',
  'Text.',
  '',
  '## The ==80 ms== budget',
  '',
  'Text.',
  '',
  '## Third',
  '',
  'Text.',
  '',
  '## Fourth',
  '',
  'Text.',
].join('\n');

describe('plain-text outputs strip the syntax', () => {
  const html = renderDocument(parseDocument(DOC, 'styled'));

  it('the page description keeps the words (and a check as ✓)', () => {
    expect(html).toContain('<meta name="description" content="✓ Ready for review Beta">');
  });

  it('the contents list shows plain words; the heading keeps its styling and a plain anchor', () => {
    const toc = html.slice(html.indexOf('class="toc-inline"'), html.indexOf('</details>'));
    expect(toc).toContain('>Launch Beta</a>');
    expect(toc).toContain('>The 80 ms budget</a>');
    expect(toc).not.toContain('<mark>');
    expect(toc).not.toContain('<svg');
    expect(html).toMatch(/<h2 id="launch-beta"><svg class="ic"/);
    expect(html).toContain('<h2 id="the-80-ms-budget">The <mark>80 ms</mark> budget');
  });
});

/* ── other outputs, CSS, and contrast ──────────────────────────────────── */

describe('slides and print', () => {
  it('a deck draws the same forms', () => {
    const deck = toSlides(
      parseDocument('## Status\n\n[Done]{.pill .done} ==ship it== :check: [Esc]{.kbd}\n', 'd'),
    );
    expect(deck).toContain('<span class="pill pill-wait">Done</span>');
    expect(deck).toContain('<mark>ship it</mark>');
    expect(deck).toContain('aria-label="check"');
    expect(deck).toContain('<kbd>Esc</kbd>');
  });

  it('the stylesheet styles every class the renderer draws, and keeps fills in print', () => {
    for (const h of SPAN_HUES)
      expect(houseCss).toContain(
        `.docskin .hl-${h}{color:var(--hue-${h});background:var(--hue-${h}-tint);}`,
      );
    expect(houseCss).toContain('.docskin mark{background:var(--mark);color:inherit;');
    expect(houseCss).toContain('.docskin kbd{');
    expect(houseCss).toContain(
      '.docskin .pill-neg{border-color:var(--negative);color:var(--negative);}',
    );
    expect(houseCss).toMatch(
      /@media print\{[^@]*\.docskin :is\(mark,\.hl,\.pill,kbd\)\{-webkit-print-color-adjust:exact;print-color-adjust:exact;\}/,
    );
  });

  it('the span hues are the skin hues', () => {
    expect([...SPAN_HUES].sort()).toEqual([...HUES].sort());
  });
});

function token(set: string, name: string): string {
  return (new RegExp(`--${name}:([^;]+);`).exec(set)?.[1] ?? '').trim();
}

type Rgb = readonly [number, number, number];

function parse(c: string): { rgb: Rgb; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex !== null) {
    const h = hex[1] as string;
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb, a: 1 };
  }
  const m = /^rgba\(([^)]+)\)$/.exec(c);
  const [r = 0, g = 0, b = 0, a = 1] = (m?.[1] ?? '').split(',').map(Number);
  return { rgb: [r, g, b], a };
}

/** `fg` (maybe translucent) painted over the opaque `bg`. */
function over(fg: string, bg: Rgb): Rgb {
  const { rgb, a } = parse(fg);
  return [0, 1, 2].map(
    (i) => (rgb[i] as number) * a + (bg[i] as number) * (1 - a),
  ) as unknown as Rgb;
}

function contrast(x: Rgb, y: Rgb): number {
  const lum = (c: Rgb): number => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('the highlight token', () => {
  for (const [name, set] of [
    ['light', LIGHT_SET],
    ['dark', DARK_SET],
  ] as const) {
    it(`${name}: ink clears 4.5:1 on the highlight over paper and paper-2, and the highlight shows against the page`, () => {
      const ink = parse(token(set, 'ink')).rgb;
      for (const ground of ['paper', 'paper-2']) {
        const page = parse(token(set, ground)).rgb;
        const mark = over(token(set, 'mark'), page);
        expect(contrast(ink, mark), `ink on mark over ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(mark, page), `mark against ${ground}`).toBeGreaterThanOrEqual(1.15);
      }
    });
  }
});
