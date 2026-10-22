/**
 * Diagram snapshots via headless Chromium (Playwright): one PNG per diagram,
 * so an author — or an agent — can look at the drawing it wrote before it
 * hands the doc off. Geometry stays code: the snapshot is for review, never
 * an input.
 *
 * Each diagram is measured at the reader's default page width first (does the
 * stage scroll sideways, how far does the drawing shrink to fit the column),
 * then captured whole on a page wide enough for the widest drawing.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchChromium, loadPlaywright } from './pdf.js';

/** One captured diagram. */
export interface DiagramShot {
  /** 1-based position among the document's diagrams. */
  readonly index: number;
  /** The frame's eyebrow tag (`FLOW`, `INFRA`, `C4 · CONTAINER`, …). */
  readonly tag: string;
  /** The diagram title, when it has one. */
  readonly title?: string;
  /** Absolute path of the PNG. */
  readonly path: string;
  /** Drawing width in viewBox units. */
  readonly width: number;
  /** True when the drawing is wider than the page and the reader must scroll. */
  readonly scrolls: boolean;
  /** Rendered size ÷ natural size at the default page width (1 = full size). */
  readonly scale: number;
}

/** Options for {@link toShots}. */
interface ShotOptions {
  /** Download Chromium on first use instead of failing. */
  readonly autoInstallBrowser?: boolean;
  /** Progress logger for the one-time browser download. */
  readonly log?: (message: string) => void;
}

/** The measurements the page reports for each `.diagram`. */
interface Measured {
  readonly tag: string;
  readonly title: string;
  readonly width: number;
  readonly scrolls: boolean;
  readonly scale: number;
}

/**
 * Writes one PNG per `.diagram` in `html` to `dir` as `<prefix>-NN-<tag>.png`
 * and returns what each one shows.
 */
export async function toShots(
  html: string,
  dir: string,
  prefix: string,
  opts: ShotOptions = {},
): Promise<DiagramShot[]> {
  await mkdir(dir, { recursive: true });
  const pw = await loadPlaywright();
  const browser = await launchChromium(pw, opts);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const measured: Measured[] = await page.$$eval('.diagram', (frames) =>
      frames.map((frame) => {
        const stage = frame.querySelector('.diagram-stage');
        const svg = stage?.querySelector('svg') ?? null;
        const vb = svg?.viewBox.baseVal;
        const width = vb !== undefined && vb !== null ? vb.width : 0;
        const shown = svg?.getBoundingClientRect().width ?? 0;
        // The block's own title, else the `##` heading above its section.
        let title = frame.querySelector('.diagram-title')?.textContent ?? '';
        if (title.trim() === '') {
          const heads = frame.closest('section')?.previousElementSibling?.querySelectorAll('h2, h3');
          title = heads !== undefined && heads.length > 0 ? (heads[heads.length - 1]?.textContent ?? '') : '';
        }
        return {
          tag: (frame.querySelector('.diagram-eyebrow')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          title: title.trim(),
          width,
          scrolls: stage !== null && stage.scrollWidth > stage.clientWidth + 1,
          scale: width > 0 ? Math.round((shown / width) * 100) / 100 : 1,
        };
      }),
    );
    // Widen the page so a drawing that scrolls is captured whole.
    const widest = Math.max(0, ...measured.map((m) => m.width));
    if (measured.some((m) => m.scrolls)) {
      const pageMax = Math.ceil(widest + 240);
      await page.setViewportSize({ width: pageMax + 80, height: 900 });
      await page.evaluate((w) => {
        document.documentElement.style.setProperty('--page-max', `${String(w)}px`);
      }, pageMax);
    }
    const frames = await page.$$('.diagram');
    const shots: DiagramShot[] = [];
    for (let i = 0; i < frames.length; i++) {
      const m = measured[i];
      const frame = frames[i];
      if (m === undefined || frame === undefined) continue;
      const slug = (m.tag.split('·')[0] ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'diagram';
      const path = join(dir, `${prefix}-${String(i + 1).padStart(2, '0')}-${slug}.png`);
      await frame.screenshot({ path });
      shots.push({
        index: i + 1,
        tag: m.tag,
        ...(m.title.length > 0 ? { title: m.title } : {}),
        path,
        width: Math.round(m.width),
        scrolls: m.scrolls,
        scale: m.scale,
      });
    }
    return shots;
  } finally {
    await browser.close();
  }
}
