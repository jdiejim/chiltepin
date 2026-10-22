/**
 * The page lane's block and stylesheet fixes: phone-safe containers, honest
 * specimens and swatches, the aligned journey curve, gallery rows, the colour
 * roles (crimson negative, the amber warn role), the error edge's cross head,
 * and the print and phone rules.
 */

import { describe, expect, it } from 'vitest';
import { DARK_SET, houseCss, LIGHT_SET } from '../css.js';
import { bignumberSize, renderBignumber } from '../blocks/bignumber.js';
import { needsFullRow, renderGallery } from '../blocks/gallery.js';
import { renderJourney } from '../blocks/journey.js';
import { hasAlpha, renderPalette } from '../blocks/palette.js';
import { renderStatustable } from '../blocks/statustable.js';
import { renderTable } from '../blocks/table.js';
import { MAX_SPECIMEN, renderTypescale } from '../blocks/typescale.js';
import { globalDefsSvg } from '../svg/defs.js';
import { SKIN_EDGE } from '../svg/blockStyle.js';

/** A token's value from a token block. */
function token(set: string, name: string): string {
  const m = new RegExp(`--${name}:([^;]+);`).exec(set);
  return (m?.[1] ?? '').trim();
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = rgb(hex).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

describe('colour roles', () => {
  for (const [name, set] of [
    ['light', LIGHT_SET],
    ['dark', DARK_SET],
  ] as const) {
    it(`${name}: negative is a crimson far from the accent, and clears 4.5:1 on paper and paper-2`, () => {
      const neg = token(set, 'negative');
      const acc = token(set, 'accent');
      const gap = Math.abs(hue(neg) - hue(acc));
      expect(Math.min(gap, 360 - gap), `${neg} vs ${acc}`).toBeGreaterThanOrEqual(25);
      expect(hue(neg)).toBeGreaterThan(330);
      expect(contrast(neg, token(set, 'paper'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(neg, token(set, 'paper-2'))).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: the warn role is the amber hue`, () => {
      expect(token(set, 'warn')).toBe('var(--hue-amber)');
      expect(token(set, 'warn-tint')).toBe('var(--hue-amber-tint)');
    });
  }

  it('warn and danger callouts differ; success is green', () => {
    expect(houseCss).toContain('.docskin .callout.warn{border-left:3px solid var(--warn);');
    expect(houseCss).toContain('.docskin .callout.danger{border-left:3px solid var(--negative);');
    expect(houseCss).toContain('.docskin .callout.success{border-left:3px solid var(--hue-green);');
    expect(houseCss).toContain('.docskin .callout.warn .callout-title{color:var(--warn);}');
  });

  it('warn options, warn cells and the slo warn tier use the warn role', () => {
    expect(houseCss).toContain('.docskin .op-v-warn{border-color:var(--warn);');
    expect(houseCss).toContain('.docskin .cell-warn{color:var(--warn);');
    expect(houseCss).toContain('.docskin .slo-fill.slo-b-warn{background:var(--warn);}');
  });

  it('agenda owners and a mitigating risk are muted chips, not the accent', () => {
    expect(houseCss).toMatch(/\.docskin \.agenda-owner\{[^}]*color:var\(--muted\)[^}]*border:1px solid var\(--rule-solid\)/);
    expect(houseCss).toContain('.docskin .rk-st-mitigating{border-color:var(--rule-solid);color:var(--muted);}');
  });

  it('statustable colour names map onto the hue and warn tokens', () => {
    for (const [cls, tok] of [
      ['green', 'hue-green'],
      ['blue', 'hue-blue'],
      ['teal', 'hue-teal'],
      ['purple', 'hue-violet'],
      ['amber', 'warn'],
      ['red', 'negative'],
    ]) {
      expect(houseCss, cls).toContain(`.docskin .stt-pill.stt-${cls}{background:var(--${tok}-tint);border-color:var(--${tok});color:var(--${tok});}`);
    }
  });

  it('an error edge carries a cross before its head, so it survives greyscale', () => {
    const defs = globalDefsSvg();
    const marker = /<marker id="skErr"[^>]*>([\s\S]*?)<\/marker>/.exec(defs)?.[1] ?? '';
    expect(marker).toContain('M-13,1.5 L-6,8.5 M-13,8.5 L-6,1.5');
    expect(SKIN_EDGE.error?.marker).toBe('skErr');
    expect(SKIN_EDGE.forbidden?.marker).toBe('skErr');
  });
});

describe('print and phone rules', () => {
  const print = houseCss.slice(houseCss.indexOf('@media print{\n  html{scroll-behavior:auto;}'));

  it('sets an A4 page with margins for the running header and footer', () => {
    expect(houseCss).toContain('@page{size:A4;margin:16mm 14mm 18mm;}');
  });

  it('prints every scroll box in full, wraps code, and drops the screen floor', () => {
    expect(print).toContain('.docskin [class$="-scroll"],.docskin .diagram-stage,.docskin .ro-strip,.docskin .kanban,.docskin .ep-ex,.docskin .a-string{overflow:visible!important;');
    expect(print).toContain('.docskin .ro-strip,.docskin .kanban{flex-wrap:wrap!important;');
    expect(print).toContain('.docskin pre,.docskin .ep-ex{white-space:pre-wrap!important;');
    expect(print).toContain('.docskin .diagram-stage svg{min-width:0!important;');
    expect(print).toContain('.docskin .hv-sr{overflow:visible!important;clip-path:inset(50%);}');
  });

  it('keeps figures together, keeps headings with what follows, and turns the halo off', () => {
    expect(print).toMatch(/\.docskin \.section-block\.is-figure,\.docskin \.diagram,\.docskin \.callout,\.docskin pre,\.docskin table,[^{]*\{break-inside:avoid;\}/);
    expect(print).toContain('.docskin h2,.docskin h3,.docskin h4,.docskin .fig-caption,.docskin .section-lede{break-after:avoid;}');
    expect(print).toContain('.docskin svg text{paint-order:normal!important;stroke:none!important;}');
  });

  it('phones get 16px gutters, a lighter frame, and wrapping prose', () => {
    expect(houseCss).toContain('@media(max-width:640px){\n  .docskin{padding:0 16px 96px;');
    expect(houseCss).toContain('  .docskin .diagram{padding:12px 10px 12px;}');
    expect(houseCss).toMatch(/\.docskin \.prose p\{[^}]*overflow-wrap:anywhere;/);
    expect(houseCss).toMatch(/\.docskin \.prose li\{[^}]*overflow-wrap:anywhere;/);
    expect(houseCss).toContain('.docskin .diagram-stage{position:relative;overflow-x:auto;');
  });

  it('stacks label above value at phone width for layers, risk, stories, pattern and typescale', () => {
    for (const rule of [
      '.docskin .layer{grid-template-columns:40px minmax(0,1fr);}',
      '.docskin .rk-risk{order:3;flex-basis:100%;}',
      '.docskin .st-summary{flex-wrap:wrap;',
      '.docskin .pt-row{grid-template-columns:minmax(0,1fr);',
      '.docskin .ts-row{flex-direction:column;',
    ]) {
      expect(houseCss, rule).toContain(rule);
    }
  });
});

describe('phone-safe containers', () => {
  it('a table scrolls inside its own box', () => {
    expect(renderTable({ columns: ['A'], rows: [['x']] })).toMatch(/^<div class="tbl-scroll"><table class="pres-table">/);
  });

  it('the statustable and the legacy tracker scroll inside the frame', () => {
    const rows = renderStatustable({ rows: [{ cells: ['Task'], status: 'done' }] });
    expect(rows).toContain('<div class="stt-wrap"><div class="stt-scroll"><table class="stt-table"');
    const tracker = renderStatustable({ items: [{ task: 'T', status: 'todo' }] } as never);
    expect(tracker).toMatch(/^<div class="stt-scroll"><table class="trk">/);
  });
});

describe('bignumber', () => {
  it('steps the size down by value length so a long figure fits a phone', () => {
    expect(bignumberSize('42%')).toBe('');
    expect(bignumberSize('$12.4M')).toBe('');
    expect(bignumberSize('1,250,000')).toBe(' bn-len-m');
    expect(bignumberSize('$1,250,000,000')).toBe(' bn-len-l');
    expect(bignumberSize('$1,250,000,000,000 / yr')).toBe(' bn-len-xl');
    expect(renderBignumber({ value: '$1,250,000,000', label: 'Volume' })).toContain('<div class="bn bn-len-l">');
  });
});

describe('typescale', () => {
  it('draws a specimen at its true size', () => {
    const html = renderTypescale({ items: [{ name: 'Display', size: 72, weight: 700 }] });
    expect(html).toContain('font-size:72px');
    expect(html).toContain('72px / weight 700</div>');
    expect(html).not.toContain('shown at');
  });

  it('says so when a style is larger than the specimen cap', () => {
    const html = renderTypescale({ items: [{ name: 'Poster', size: 140 }] });
    expect(html).toContain(`font-size:${MAX_SPECIMEN}px`);
    expect(html).toContain(`140px / weight 400 · shown at ${MAX_SPECIMEN}px`);
  });
});

describe('palette', () => {
  it('detects alpha in every colour form', () => {
    for (const v of ['#0008', '#11223380', 'rgba(1,2,3,.4)', 'rgb(1 2 3 / 50%)', 'hsla(10,20%,30%,0.2)', 'transparent']) {
      expect(hasAlpha(v), v).toBe(true);
    }
    for (const v of ['#000f', '#112233ff', '#123', 'rgb(1,2,3)', 'rgba(1,2,3,1)', 'red']) expect(hasAlpha(v), v).toBe(false);
  });

  it('lays an alpha colour over a checkerboard', () => {
    const html = renderPalette({ colors: [{ name: 'Scrim', value: 'rgba(31,36,48,.4)' }] });
    expect(html).toContain('class="pl-swatch pl-alpha"');
    expect(html).toContain('repeating-conic-gradient(var(--paper-2) 0 25%,var(--paper) 0 50%)');
  });

  it('hatches a value it cannot draw and says why, never a stand-in grey', () => {
    const html = renderPalette({
      colors: [
        { name: 'Brand', value: 'var(--brand-500)' },
        { name: 'Bad', value: 'url(x)' },
      ],
    });
    expect(html).toContain('class="pl-swatch pl-unresolved"');
    expect(html).toContain('<div class="pl-why">token — not resolved here</div>');
    expect(html).toContain('<div class="pl-why">not a colour</div>');
    expect(html).not.toContain('style="background:');
  });

  it('every swatch has a hairline ring', () => {
    expect(houseCss).toMatch(/\.docskin \.pl-swatch\{[^}]*box-shadow:inset 0 0 0 1px var\(--rule\);/);
  });
});

describe('journey', () => {
  const data = {
    stages: [{ label: 'Discover' }, { label: 'Sign up' }, { label: 'Verify' }],
    rows: [{ label: 'Touchpoint', cells: ['Landing', 'Form', 'KYC'] }],
    emotion: [0.5, -1, 1],
  };

  it('draws the curve in a table row whose cell spans the stage columns', () => {
    const html = renderJourney(data);
    expect(html).toContain('<colgroup><col class="jr-col-label"><col><col><col></colgroup>');
    expect(html).toContain('<td class="jr-emo-cell" colspan="3">');
    expect(html).toContain('<svg viewBox="0 0 450 96" role="img">');
    // Each dot sits at the centre of its stage column.
    expect([...html.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]))).toEqual([75, 225, 375]);
    expect(html).toMatch(/^<div class="jr"><div class="jr-scroll"><table class="pres-table jr-table"/);
  });

  it('reads −1…1 around a dashed midline when a value is negative', () => {
    const html = renderJourney(data);
    const cy = [...html.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    // 0.5 sits above the midline (48), −1 at the bottom, 1 at the top.
    expect(cy[0]).toBeLessThan(48);
    expect(cy[1]).toBe(82);
    expect(cy[2]).toBe(14);
    expect(html).toContain('<line x1="0" y1="48" x2="450" y2="48" class="jr-mid"');
    expect(html).toContain('fill="var(--negative)"');
  });

  it('keeps the 0…1 scale when every value is non-negative', () => {
    const html = renderJourney({ ...data, emotion: [0.5, 0, 1] });
    const cy = [...html.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(cy).toEqual([48, 82, 14]);
  });
});

describe('gallery', () => {
  it('a nested drawing too wide for its cell spans the row', () => {
    expect(needsFullRow(1100, 2)).toBe(true);
    expect(needsFullRow(500, 2)).toBe(false);
    expect(needsFullRow(1100, 1)).toBe(false);
    const wide = {
      type: 'block',
      nodes: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, name: `N${i}`, col: i + 1, row: 1 })),
    };
    const small = { type: 'block', nodes: [{ id: 'a', name: 'A', col: 1, row: 1 }] };
    const html = renderGallery({ cols: 2, items: [{ title: 'Wide', block: wide }, { title: 'Small', block: small }] } as never);
    expect(html).toContain('<div class="gl-cell gl-span" data-bp="items.0">');
    expect(html).toContain('<div class="gl-cell" data-bp="items.1">');
  });

  it('cells stretch so captions in one row line up', () => {
    expect(houseCss).toContain('.docskin .gl-cell{min-width:0;display:flex;flex-direction:column;}');
    expect(houseCss).toContain('.docskin .gl-cell.gl-span{grid-column:1/-1;}');
  });
});

describe('dodont and anatomy wrap long text', () => {
  it('a long example or segment wraps instead of overflowing', () => {
    expect(houseCss).toMatch(/\.docskin \.dd-ex\{[^}]*max-width:100%;[^}]*overflow-wrap:anywhere;/);
    expect(houseCss).toMatch(/\.docskin \.a-string\{[^}]*overflow-wrap:anywhere;/);
    expect(houseCss).not.toMatch(/\.docskin \.a-string\{[^}]*white-space:nowrap/);
  });
});
