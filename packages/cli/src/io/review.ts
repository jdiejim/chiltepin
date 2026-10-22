/**
 * The browser half of `chiltepin review`: one headless Chromium session that
 * renders a document the way a reader sees it and measures every block.
 *
 * Passes, all on one page:
 *
 * 1. **Reader** (1280 px window): per `section.section-block` — the stage's
 *    fit (does it scroll, how far does it shrink), text that sits on other
 *    text, node text that runs outside its node's shape, edge labels that sit
 *    far from their own line, text the renderer cut short (`…`), and HTML
 *    text clipped by its box. Then one PNG per block in light and in dark.
 * 2. **Phone** (400 px window): text that renders under 8 px, blocks wider
 *    than the screen, and one full-page PNG.
 * 3. **Print** (A4 width, print media): containers that clip their content.
 *
 * The page code runs inside Chromium (`page.evaluate`), so each measuring
 * function is self-contained: no imports, no closures over this module.
 * Geometry stays code: the measurements are for review, never an input.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type * as Playwright from 'playwright';
import { launchChromium, loadPlaywright } from './pdf.js';

/** What the reader pass finds in one block, before it is named in data terms. */
export type RawFinding =
  | {
      readonly kind: 'overlap';
      /** Data path of the first text's part (`nodes.3`, `edges.1.label`), when one. */
      readonly a: TextRef;
      readonly b: TextRef;
      /** Overlap in px (at full size), each axis. */
      readonly x: number;
      readonly y: number;
    }
  | { readonly kind: 'outside'; readonly text: TextRef; readonly px: number }
  | { readonly kind: 'far-label'; readonly text: TextRef; readonly px: number }
  | { readonly kind: 'ellipsis'; readonly text: TextRef }
  | { readonly kind: 'clipped'; readonly text: TextRef; readonly px: number }
  /** All the text one node or edge drew, to compare with the data it came from. */
  | { readonly kind: 'drawn'; readonly bp: string; readonly text: string };

/** One drawn text: what it says and which part of the data drew it. */
export interface TextRef {
  readonly text: string;
  /** Nearest `data-bp` path (`nodes.3`, `edges.2`, `steps.1.label`), when one. */
  readonly bp?: string;
  /** The text's class list (`blk-name t-name`, …), a hint at the field. */
  readonly cls?: string;
}

/** The measurements of one block. */
export interface MeasuredBlock {
  /** 1-based position among the page's sections. */
  readonly index: number;
  /** The section's DOM id (`section-03`). */
  readonly section: string;
  /** The block's `id:`, when it has one. */
  readonly blockId?: string;
  /** The section label (`Flowchart`), the frame tag (`FLOW`), the figure number. */
  readonly label: string;
  readonly tag?: string;
  readonly fig?: string;
  /** The block's title, else the heading above it. */
  readonly title?: string;
  /** Staged drawing: viewBox width, scroll, and scale at the reader's width. */
  readonly width?: number;
  readonly scrolls: boolean;
  readonly scale: number;
  readonly findings: readonly RawFinding[];
  /** Phone pass: texts under 8 px (count, smallest size, one sample). */
  readonly tiny?: { readonly count: number; readonly min: number; readonly sample: string };
  /** Phone pass: px the block runs past a 400 px screen. */
  readonly phoneOverflow?: number;
  /** Print pass: clipped containers (class and px clipped). */
  readonly print?: readonly { readonly cls: string; readonly px: number }[];
  /** PNG paths. `full` exists when the drawing scrolls (the whole drawing). */
  readonly shots: { readonly light: string; readonly dark: string; readonly full?: string };
}

/** Result of {@link reviewPage}. */
export interface PageReview {
  readonly blocks: readonly MeasuredBlock[];
  /** The whole page at 400 px. */
  readonly phone: string;
}

/** Options for {@link reviewPage}. */
export interface ReviewPageOptions {
  readonly autoInstallBrowser?: boolean;
  readonly log?: (message: string) => void;
  /** File name prefix for the block PNGs. */
  readonly prefix: string;
}

/** Reader width, phone width, and A4 print width (96 dpi), in px. */
const READER = 1280;
const PHONE = 400;
const PRINT = 794;
/** Device scale for every PNG: sharp enough to read a 9 px label. */
const DPR = 1.5;

/* ── Page code (runs in Chromium) ──────────────────────────────────────── */

interface ReaderArgs {
  readonly nodeRe: string;
  readonly edgeRe: string;
}

type ReaderBlock = Omit<MeasuredBlock, 'shots' | 'tiny' | 'phoneOverflow' | 'print'>;

/** Reader pass, in the page: one record per section. */
function measureReader(args: ReaderArgs): ReaderBlock[] {
  const NODE = new RegExp(args.nodeRe);
  const EDGE = new RegExp(args.edgeRe);
  const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const bpOf = (el: Element): string | undefined => el.closest('[data-bp]')?.getAttribute('data-bp') ?? undefined;
  const ref = (el: Element): TextRef => {
    const bp = bpOf(el);
    const cls = el.getAttribute('class') ?? undefined;
    return { text: clean(el.textContent).slice(0, 80), ...(bp !== undefined ? { bp } : {}), ...(cls ? { cls } : {}) };
  };
  const out: ReaderBlock[] = [];
  const sections = Array.from(document.querySelectorAll('section.section-block'));
  sections.forEach((sec, i) => {
    const findings: RawFinding[] = [];
    // The section eyebrow (`SECTION 01 · Flowchart`), when the page draws one.
    const numText = clean(sec.querySelector('.section-num')?.textContent);
    const label = numText.includes('·') ? numText.slice(numText.indexOf('·') + 1).trim() : numText;
    const tag = clean(sec.querySelector('.diagram-tag')?.textContent) || undefined;
    // The figure caption, "Fig. N · title" (`.fig-num` / `.fig-title`), in the
    // frame's head row or in `p.fig-caption` above a frameless block.
    const fig =
      clean(sec.querySelector('.fig-num')?.textContent) || clean(sec.querySelector('.diagram-fignum')?.textContent) || undefined;
    let title =
      clean(sec.querySelector('.fig-title')?.textContent) ||
      clean(sec.querySelector('.section-title')?.textContent) ||
      clean(sec.querySelector('.diagram-title')?.textContent).replace(/^Fig\.\s*\d+\s*·?\s*/, '');
    if (title === '') {
      // The heading directly above titles the block.
      let prev = sec.previousElementSibling;
      while (prev !== null && title === '') {
        const heads = prev.matches('h2,h3') ? [prev] : Array.from(prev.querySelectorAll('h2,h3'));
        const last = heads[heads.length - 1];
        if (last !== undefined) title = clean(last.textContent);
        if (prev.matches('section.section-block')) break;
        prev = prev.previousElementSibling;
      }
    }

    // Fit, as the reader sees it.
    const stage = sec.querySelector('.diagram-stage');
    // An inline icon in text (`.ic`, from `:name:`) is a glyph, not the drawing.
    const svg = stage?.querySelector(':scope > svg') ?? sec.querySelector('svg[viewBox]:not(.ic)');
    const vb = svg instanceof SVGSVGElement ? svg.viewBox.baseVal : null;
    const width = vb !== null && vb.width > 0 ? vb.width : undefined;
    const shown = svg?.getBoundingClientRect().width ?? 0;
    const scale = width !== undefined && shown > 0 ? shown / width : 1;
    const scrolls = stage !== null && stage !== undefined && stage.scrollWidth > stage.clientWidth + 1;

    // Every drawing in the block (a block may draw more than one svg).
    for (const root of Array.from(sec.querySelectorAll('svg'))) {
      if (root.parentElement?.closest('svg') !== null && root.parentElement?.closest('svg') !== undefined) continue;
      const rootBox = root.getBoundingClientRect();
      const rvb = root instanceof SVGSVGElement ? root.viewBox.baseVal : null;
      const k = rvb !== null && rvb.width > 0 && rootBox.width > 0 ? rootBox.width / rvb.width : 1;
      // Boxes in drawing units (independent of how far the page shrank it).
      const box = (el: Element): { x: number; y: number; w: number; h: number } => {
        const r = el.getBoundingClientRect();
        return { x: (r.left - rootBox.left) / k, y: (r.top - rootBox.top) / k, w: r.width / k, h: r.height / k };
      };
      const texts = Array.from(root.querySelectorAll('text'))
        .filter((t) => clean(t.textContent) !== '')
        .map((t) => ({ el: t, b: box(t), s: clean(t.textContent) }))
        .filter((t) => t.b.w > 0 && t.b.h > 0);

      // (a) Two different strings whose boxes overlap by more than 2 px on both axes.
      for (let p = 0; p < texts.length; p++) {
        const A = texts[p];
        if (A === undefined) continue;
        for (let q = p + 1; q < texts.length; q++) {
          const B = texts[q];
          // A one-character text is a glyph (ƒ, ×, a step number), not a label.
          if (B === undefined || A.s === B.s || A.s.length < 2 || B.s.length < 2) continue;
          const ix = Math.min(A.b.x + A.b.w, B.b.x + B.b.w) - Math.max(A.b.x, B.b.x);
          const iy = Math.min(A.b.y + A.b.h, B.b.y + B.b.h) - Math.max(A.b.y, B.b.y);
          if (ix > 2 && iy > 2) {
            findings.push({ kind: 'overlap', a: ref(A.el), b: ref(B.el), x: Math.round(ix), y: Math.round(iy) });
          }
        }
      }

      // (b) Node text that runs more than 1.5 px outside its node's main shape.
      for (const g of Array.from(root.querySelectorAll('[data-bp]'))) {
        const bp = g.getAttribute('data-bp') ?? '';
        if (!NODE.test(bp) || g.tagName.toLowerCase() === 'path') continue;
        // The main shape is the largest; the node's box is the main shape
        // plus every shape that touches it (stacked replica cards, a badge).
        // Text whose centre sits outside the main shape is a caption drawn
        // there on purpose (a person glyph's name, a compensation box).
        const shapes = Array.from(g.querySelectorAll('rect,polygon,ellipse,circle,path'))
          .map((s) => box(s))
          .filter((b) => b.w > 0 && b.h > 0);
        let best: { x: number; y: number; w: number; h: number } | undefined;
        for (const b of shapes) if (best === undefined || b.w * b.h > best.w * best.h) best = b;
        if (best === undefined || best.w < 8 || best.h < 8) continue;
        const main = best;
        const touch = (b: { x: number; y: number; w: number; h: number }): boolean =>
          b.x <= main.x + main.w && main.x <= b.x + b.w && b.y <= main.y + main.h && main.y <= b.y + b.h;
        let x0 = main.x;
        let y0 = main.y;
        let x1 = main.x + main.w;
        let y1 = main.y + main.h;
        for (const b of shapes) {
          if (!touch(b)) continue;
          x0 = Math.min(x0, b.x);
          y0 = Math.min(y0, b.y);
          x1 = Math.max(x1, b.x + b.w);
          y1 = Math.max(y1, b.y + b.h);
        }
        for (const t of Array.from(g.querySelectorAll('text'))) {
          if (clean(t.textContent) === '') continue;
          // Text of a nested part (a port, a badge) is not the node's own.
          const own = t.closest('[data-bp]');
          if (own !== g && own !== null && !(own.getAttribute('data-bp') ?? '').startsWith(`${bp}.`)) continue;
          const b = box(t);
          if (b.w === 0) continue;
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          if (cx < main.x || cx > main.x + main.w || cy < main.y || cy > main.y + main.h) continue;
          const over = Math.max(x0 - b.x, b.x + b.w - x1, y0 - b.y, b.y + b.h - y1);
          if (over > 1.5) findings.push({ kind: 'outside', text: ref(t), px: Math.round(over) });
        }
      }

      // (c) An edge label whose centre sits more than 12 px from its own line.
      const lines = new Map<string, SVGGeometryElement>();
      for (const el of Array.from(root.querySelectorAll('path[data-bp],line[data-bp],polyline[data-bp]'))) {
        const bp = el.getAttribute('data-bp') ?? '';
        if (EDGE.test(bp) && el instanceof SVGGeometryElement && !lines.has(bp)) lines.set(bp, el);
      }
      for (const g of Array.from(root.querySelectorAll('g[data-bp]'))) {
        const bp = g.getAttribute('data-bp') ?? '';
        const line = lines.get(bp);
        const t = g.querySelector('text');
        if (line === undefined || t === null || clean(t.textContent) === '') continue;
        const b = box(t);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const m = line.getScreenCTM();
        if (m === null) continue;
        const len = line.getTotalLength();
        let dist = Infinity;
        for (let s = 0; s <= len; s += 4) {
          const p = line.getPointAtLength(Math.min(s, len));
          const sx = (m.a * p.x + m.c * p.y + m.e - rootBox.left) / k;
          const sy = (m.b * p.x + m.d * p.y + m.f - rootBox.top) / k;
          dist = Math.min(dist, Math.hypot(sx - cx, sy - cy));
        }
        if (dist > 12 && Number.isFinite(dist)) findings.push({ kind: 'far-label', text: ref(t), px: Math.round(dist) });
      }

      // What each node and edge drew: the review compares it with the data
      // (a word that never reached the page was cut, with or without "…").
      const drawn = new Map<string, string[]>();
      for (const t of Array.from(root.querySelectorAll('text'))) {
        const bp = t.closest('[data-bp]')?.getAttribute('data-bp') ?? '';
        const m = /^([A-Za-z]+\.\d+)/.exec(bp);
        if (m === null || m[1] === undefined || !(NODE.test(m[1]) || EDGE.test(m[1]))) continue;
        const list = drawn.get(m[1]) ?? [];
        list.push(clean(t.textContent));
        drawn.set(m[1], list);
      }
      for (const [bp, list] of drawn) findings.push({ kind: 'drawn', bp, text: list.join(' ') });

      // A label the renderer cut short ends in "…" (the doc never wrote it).
      for (const t of texts) {
        if (t.s.includes('…') && t.s !== '…') findings.push({ kind: 'ellipsis', text: ref(t.el) });
      }
    }

    // HTML text clipped by its own box (`text-overflow: ellipsis`, a line clamp).
    for (const el of Array.from(sec.querySelectorAll('*'))) {
      if (el.closest('svg') !== null || !(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      const clampX = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      const clamp = cs.getPropertyValue('-webkit-line-clamp');
      const clampY = clamp !== '' && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1;
      if ((clampX || clampY) && clean(el.textContent) !== '') {
        findings.push({
          kind: 'clipped',
          text: ref(el),
          px: Math.round(clampX ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight),
        });
      }
    }

    const blockId = sec.getAttribute('data-block-id') ?? undefined;
    out.push({
      index: i + 1,
      section: sec.id,
      ...(blockId !== undefined ? { blockId } : {}),
      label,
      ...(tag !== undefined ? { tag } : {}),
      ...(fig !== undefined ? { fig } : {}),
      ...(title !== '' ? { title } : {}),
      ...(width !== undefined ? { width: Math.round(width) } : {}),
      scrolls,
      scale: Math.round(scale * 1000) / 1000,
      findings,
    });
  });
  return out;
}

/**
 * Phone pass, in the page: per section, the texts under `min` px — reported
 * only when the block's main text is among them (the upper quartile of its
 * text sizes is under `min`), so a drawing whose names read while its small
 * chips do not stays quiet — and how far the block runs past the screen.
 */
function measurePhone(min: number): { tiny?: { count: number; min: number; sample: string }; overflow?: number }[] {
  const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const screen = document.documentElement.clientWidth;
  return Array.from(document.querySelectorAll('section.section-block')).map((sec) => {
    const sizes: { size: number; text: string }[] = [];
    for (const t of Array.from(sec.querySelectorAll('text'))) {
      const s = clean(t.textContent);
      if (s === '') continue;
      const root = t.ownerSVGElement;
      const vb = root?.viewBox.baseVal;
      const k = root !== null && root !== undefined && vb !== undefined && vb.width > 0 ? root.getBoundingClientRect().width / vb.width : 1;
      const size = parseFloat(getComputedStyle(t).fontSize) * k;
      if (size > 0) sizes.push({ size, text: s });
    }
    for (const el of Array.from(sec.querySelectorAll('*'))) {
      if (el.closest('svg') !== null || !(el instanceof HTMLElement)) continue;
      if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && clean(n.textContent) !== '')) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0) sizes.push({ size, text: clean(el.textContent) });
    }
    const sorted = sizes.map((x) => x.size).sort((a, b) => a - b);
    const main = sorted.length > 0 ? (sorted[Math.floor(sorted.length * 0.75)] ?? 0) : Infinity;
    const small = sizes.filter((x) => x.size < min);
    const least = small.reduce<{ size: number; text: string } | undefined>((a, b) => (a === undefined || b.size < a.size ? b : a), undefined);
    const right = sec.getBoundingClientRect().right;
    const overflow = Math.max(right - screen, sec.scrollWidth - sec.clientWidth);
    return {
      ...(main < min && least !== undefined
        ? { tiny: { count: small.length, min: Math.round(least.size * 10) / 10, sample: least.text.slice(0, 40) } }
        : {}),
      ...(overflow > 1 ? { overflow: Math.round(overflow) } : {}),
    };
  });
}

/** Print pass, in the page: containers that clip their content, per section. */
function measurePrint(): { cls: string; px: number }[][] {
  return Array.from(document.querySelectorAll('section.section-block')).map((sec) => {
    const out: { cls: string; px: number }[] = [];
    for (const el of [sec, ...Array.from(sec.querySelectorAll('*'))]) {
      if (!(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      if (!/(auto|scroll|hidden|clip)/.test(cs.overflowX)) continue;
      const over = el.scrollWidth - el.clientWidth;
      if (over > 2 && el.clientWidth > 0) {
        out.push({ cls: (el.getAttribute('class') ?? el.tagName.toLowerCase()).split(' ')[0] ?? '', px: over });
      }
    }
    return out;
  });
}

function setTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/* ── Node side ─────────────────────────────────────────────────────────── */

/** The list fields that hold a diagram's nodes and its edges (for `data-bp`). */
export const NODE_PATH = /^(nodes|states|steps|classes|packages|cases|actors|services|entities|tables)\.\d+$/;
export const EDGE_PATH = /^(edges|links|transitions|relations|rels|deps|flows|messages)\.\d+$/;

/** A file-safe slug of a block's tag (`C4 · CONTAINER` → `c4`). */
function fileSlug(s: string): string {
  return (s.split('·')[0] ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block';
}

/**
 * Renders `html` in headless Chromium, measures every block, and writes the
 * block PNGs (light, dark, and the whole drawing when it scrolls) and the
 * 400 px page to `dir`.
 */
export async function reviewPage(html: string, dir: string, opts: ReviewPageOptions): Promise<PageReview> {
  await mkdir(dir, { recursive: true });
  const pw = await loadPlaywright();
  const browser = await launchChromium(pw, opts);
  try {
    const page = await browser.newPage({ viewport: { width: READER, height: 900 }, deviceScaleFactor: DPR });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(setTheme, 'light');
    const reader = await page.evaluate(measureReader, { nodeRe: NODE_PATH.source, edgeRe: EDGE_PATH.source });

    // Block PNGs at the reader's width, light then dark.
    const sections = await page.$$('section.section-block');
    const names = reader.map((b) => `${opts.prefix}-${String(b.index).padStart(2, '0')}-${fileSlug(b.tag ?? b.label)}`);
    const light: string[] = [];
    const dark: string[] = [];
    await shootAll(sections, names, 'light', light, dir);
    await page.evaluate(setTheme, 'dark');
    await shootAll(sections, names, 'dark', dark, dir);

    // The whole drawing of a block whose stage scrolls: widen the page once.
    const full = new Map<number, string>();
    const widest = Math.max(0, ...reader.filter((b) => b.scrolls).map((b) => b.width ?? 0));
    if (widest > 0) {
      await page.evaluate(setTheme, 'light');
      const pageMax = Math.ceil(widest + 240);
      await page.setViewportSize({ width: pageMax + 80, height: 900 });
      await page.evaluate((w) => {
        document.documentElement.style.setProperty('--page-max', `${String(w)}px`);
      }, pageMax);
      const wide = await page.$$('section.section-block');
      for (const b of reader) {
        const el = wide[b.index - 1];
        if (!b.scrolls || el === undefined) continue;
        const path = join(dir, `${names[b.index - 1] ?? 'block'}-full.png`);
        await el.screenshot({ path });
        full.set(b.index, path);
      }
      await page.evaluate(() => document.documentElement.style.removeProperty('--page-max'));
    }

    // Phone: the page at 400 px, light.
    await page.evaluate(setTheme, 'light');
    await page.setViewportSize({ width: PHONE, height: 900 });
    const phone = await page.evaluate(measurePhone, 8);
    const phonePath = join(dir, `${opts.prefix}-page-400.png`);
    await page.screenshot({ path: phonePath, fullPage: true });

    // Print: A4 width, print media.
    await page.setViewportSize({ width: PRINT, height: 1123 });
    await page.emulateMedia({ media: 'print' });
    const print = await page.evaluate(measurePrint);
    await page.emulateMedia({ media: 'screen' });

    const blocks: MeasuredBlock[] = reader.map((b, i) => {
      const ph = phone[i];
      const pr = print[i] ?? [];
      const fullPath = full.get(b.index);
      return {
        ...b,
        ...(ph?.tiny !== undefined ? { tiny: ph.tiny } : {}),
        ...(ph?.overflow !== undefined ? { phoneOverflow: ph.overflow } : {}),
        ...(pr.length > 0 ? { print: pr } : {}),
        shots: {
          light: light[i] ?? '',
          dark: dark[i] ?? '',
          ...(fullPath !== undefined ? { full: fullPath } : {}),
        },
      };
    });
    return { blocks, phone: phonePath };
  } finally {
    await browser.close();
  }
}

async function shootAll(
  sections: readonly Playwright.ElementHandle[],
  names: readonly string[],
  theme: 'light' | 'dark',
  into: string[],
  dir: string,
): Promise<void> {
  for (let i = 0; i < sections.length; i++) {
    const el = sections[i];
    if (el === undefined) continue;
    const path = join(dir, `${names[i] ?? `block-${String(i + 1)}`}-${theme}.png`);
    await el.screenshot({ path });
    into.push(path);
  }
}

/* ── Contact sheet ─────────────────────────────────────────────────────── */

/** One tile of the contact sheet. */
export interface SheetTile {
  readonly index: number;
  /** `Fig. 1 · FLOW · The RAG answer path`. */
  readonly caption: string;
  readonly light: string;
  readonly dark: string;
  /** Issue counts by level, and the kinds, for the badge. */
  readonly errors: number;
  readonly warnings: number;
  readonly kinds: readonly string[];
  /** The first issues, one line each (`cut — node \`pg\` …`). */
  readonly notes: readonly { readonly level: 'error' | 'warn'; readonly text: string }[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** How many issue lines a tile prints before "and N more". */
const TILE_NOTES = 3;

/**
 * The contact sheet page: a numbered grid of every block, the light capture
 * above the dark one, a red frame and badge on a block with an error (amber
 * for warnings only), and its first issues written under the caption.
 */
export function contactSheetHtml(title: string, summary: string, tiles: readonly SheetTile[], images: ReadonlyMap<string, string>): string {
  const img = (p: string): string => images.get(p) ?? '';
  const cards = tiles
    .map((t) => {
      const total = t.errors + t.warnings;
      const state = t.errors > 0 ? ' bad' : t.warnings > 0 ? ' warn' : '';
      const badge =
        total > 0
          ? `<span class="badge${t.errors > 0 ? ' err' : ''}">${String(total)}</span><span class="kinds${t.errors > 0 ? '' : ' warn'}">${esc(t.kinds.join(' · '))}</span>`
          : `<span class="ok">clean</span>`;
      const shown = t.notes.slice(0, TILE_NOTES);
      const more = t.notes.length - shown.length;
      const notes =
        shown.length > 0
          ? `<ul class="notes">${shown.map((n) => `<li class="${n.level}">${esc(n.text)}</li>`).join('')}` +
            `${more > 0 ? `<li class="more">and ${String(more)} more in review.json</li>` : ''}</ul>`
          : '';
      return (
        `<figure class="tile${state}">` +
        `<figcaption><span class="num">${String(t.index).padStart(2, '0')}</span>` +
        `<span class="cap">${esc(t.caption)}</span>${badge}</figcaption>${notes}` +
        `<div class="shot light"><img src="${img(t.light)}"></div>` +
        `<div class="shot dark"><img src="${img(t.dark)}"></div>` +
        `</figure>`
      );
    })
    .join('');
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
    `*{box-sizing:border-box}body{margin:0;padding:28px 32px 36px;background:#f1efea;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#1d1b18}` +
    `header{display:flex;align-items:baseline;gap:16px;margin:0 0 20px}h1{font-size:22px;margin:0;font-weight:650}header p{margin:0;color:#5f5a52;font-size:14px}` +
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}` +
    `.tile{margin:0;background:#fff;border:1px solid #d8d2c8;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px}` +
    `.tile.bad{border:3px solid #c7302a;padding:12px}.tile.warn{border:2px solid #d0901a;padding:13px}` +
    `figcaption{display:flex;align-items:center;gap:10px;min-width:0}` +
    `.num{font:700 15px ui-monospace,Menlo,monospace;background:#1d1b18;color:#fff;border-radius:4px;padding:2px 8px}` +
    `.cap{flex:1 1 auto;min-width:35%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:650;font-size:15px}` +
    `.badge{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:14px;background:#d0901a;color:#fff;font-weight:800;font-size:15px;padding:0 8px}` +
    `.badge.err{background:#c7302a}.kinds{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 12px ui-monospace,Menlo,monospace;color:#c7302a;text-transform:uppercase;letter-spacing:.04em}.kinds.warn{color:#a8700f}` +
    `.ok{font:700 12px ui-monospace,Menlo,monospace;color:#2f7d4f;text-transform:uppercase;letter-spacing:.04em}` +
    `.notes{margin:0;padding:0;list-style:none;display:grid;gap:3px;font:12.5px/1.4 ui-monospace,Menlo,monospace}` +
    `.notes li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:10px;border-left:3px solid #d0901a;color:#4a443c}` +
    `.notes li.error{border-left-color:#c7302a;color:#8c1f1a}.notes li.more{border-left-color:transparent;color:#8a847a}` +
    `.shot{border-radius:5px;overflow:hidden;display:flex;justify-content:center;max-height:380px}` +
    `.shot.light{background:#fbfaf7;border:1px solid #e3ded4}.shot.dark{background:#15140f;border:1px solid #2c2a25;max-height:220px}` +
    `.shot img{display:block;max-width:100%;max-height:380px;object-fit:contain;object-position:top}.shot.dark img{max-height:220px}` +
    `</style></head><body><header><h1>${esc(title)}</h1><p>${esc(summary)}</p></header>` +
    `<main class="grid">${cards}</main></body></html>`
  );
}

/** Writes the contact sheet PNG for `tiles` to `path`. */
export async function writeContactSheet(
  path: string,
  title: string,
  summary: string,
  tiles: readonly SheetTile[],
  opts: Pick<ReviewPageOptions, 'autoInstallBrowser' | 'log'> = {},
): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const images = new Map<string, string>();
  for (const t of tiles) {
    for (const p of [t.light, t.dark]) {
      if (p === '' || images.has(p)) continue;
      images.set(p, `data:image/png;base64,${(await readFile(p)).toString('base64')}`);
    }
  }
  const pw = await loadPlaywright();
  const browser = await launchChromium(pw, opts);
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.setContent(contactSheetHtml(title, summary, tiles, images), { waitUntil: 'load' });
    await page.screenshot({ path, fullPage: true });
  } finally {
    await browser.close();
  }
}

/** Writes `review.json`. */
export async function writeReviewJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
