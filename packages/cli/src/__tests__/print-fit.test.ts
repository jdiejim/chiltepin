/**
 * The page is lossless in print and readable on a phone. Renders the
 * showcase (one example of every block) in headless Chromium:
 *
 * - print media: no element clips its content (`scrollWidth > clientWidth`
 *   on an element that scrolls or hides overflow), and no SVG text keeps the
 *   paint-order halo that doubles every label in the PDF text layer;
 * - 400px: the page never scrolls sideways, and no diagram draws a node name
 *   under 8px.
 *
 * Also pins the PDF options the export sends: the CSS page size, the running
 * header and footer.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'chiltepin-core';
import { renderDocument } from 'chiltepin-render';
import {
  FOOTER_TEMPLATE,
  headerTemplate,
  isChromiumAvailable,
  launchChromium,
  loadPlaywright,
  sheetSize,
} from '../io/pdf.js';

const SHOWCASE = resolve(import.meta.dirname, '../../../../docs/reference/showcase.md');

describe('PDF options', () => {
  it('keeps the page’s own A4, unless a preset or another format asks for a size', () => {
    expect(sheetSize({})).toBeUndefined();
    expect(sheetSize({ format: 'A4' })).toBeUndefined();
    expect(sheetSize({ format: 'Letter' })).toBe('Letter');
    expect(sheetSize({ pageWidthPx: 1000 })).toBe('1000px 1414px');
  });

  it('the running header names the doc; the footer says page X / Y', () => {
    expect(headerTemplate('Orders <v2> & more')).toContain('<span>Orders &lt;v2&gt; &amp; more</span>');
    expect(headerTemplate('T')).not.toMatch(/style="[^"]*"[^>]*"/); // one well-formed style attribute
    expect(FOOTER_TEMPLATE).toContain('page <span class="pageNumber"></span> / <span class="totalPages"></span>');
  });
});

const chromiumAvailable = await isChromiumAvailable();

describe.skipIf(!chromiumAvailable)('the showcase in a browser', () => {
  const html = renderDocument(parseDocument(readFileSync(SHOWCASE, 'utf8'), 'showcase'), { colorScheme: 'light' });

  it('clips nothing in print, and prints no SVG text halo', async () => {
    const pw = await loadPlaywright();
    const browser = await launchChromium(pw, {});
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
      await page.setContent(html, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      const result = await page.evaluate(() => {
        const clipped: string[] = [];
        for (const el of Array.from(document.querySelectorAll('.docskin *'))) {
          const cs = getComputedStyle(el);
          if (!/(auto|scroll|hidden)/.test(cs.overflowX)) continue;
          if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
            const cls = el.getAttribute('class') ?? el.tagName;
            clipped.push(`${el.closest('section')?.id ?? '?'} ${cls}`);
          }
        }
        let halo = 0;
        for (const t of Array.from(document.querySelectorAll('.docskin svg text'))) {
          const cs = getComputedStyle(t);
          if (cs.paintOrder.startsWith('stroke') && cs.stroke !== 'none') halo++;
        }
        return { clipped, halo };
      });
      expect(result.clipped).toEqual([]);
      expect(result.halo).toBe(0);
    } finally {
      await browser.close();
    }
  }, 120_000);

  it('never scrolls sideways at 400px, and keeps node names at 8px or more', async () => {
    const pw = await loadPlaywright();
    const browser = await launchChromium(pw, {});
    try {
      const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
      await page.setContent(html, { waitUntil: 'load' });
      const result = await page.evaluate(() => {
        const tiny: string[] = [];
        for (const svg of Array.from(document.querySelectorAll<SVGSVGElement>('.diagram-stage > svg'))) {
          const vb = svg.viewBox.baseVal;
          if (vb.width < 50) continue;
          const scale = svg.getBoundingClientRect().width / vb.width;
          for (const t of Array.from(svg.querySelectorAll('text.t-name'))) {
            if (parseFloat(getComputedStyle(t).fontSize) * scale < 7.95) {
              tiny.push(svg.closest('section')?.id ?? '?');
              break;
            }
          }
        }
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, tiny };
      });
      expect(result.overflow).toBe(0);
      expect(result.tiny).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 120_000);
});
