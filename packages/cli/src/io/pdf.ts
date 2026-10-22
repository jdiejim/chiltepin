/**
 * PDF export via headless Chromium (Playwright).
 *
 * Playwright is an optional dependency — importing it lazily means consumers
 * who never touch `chiltepin pdf` aren't forced to download Chromium. Callers who
 * use {@link toPdf} can pass `autoInstallBrowser: true` to download the matching
 * Chromium on first use; otherwise a missing browser throws a clear error.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Document } from 'chiltepin-core';
import { renderDocument } from 'chiltepin-render';
import type * as Playwright from 'playwright';

type PlaywrightModule = typeof Playwright;

const require = createRequire(import.meta.url);

/** Page format for the generated PDF. */
type PdfFormat = 'A4' | 'Letter';

/** Options for {@link toPdf}. */
interface PdfOptions {
  /** Page format. Defaults to `A4`. */
  readonly format?: PdfFormat;
  /**
   * Custom page width in CSS pixels. When set, it wins over `format`: the page
   * becomes `pageWidthPx` wide with portrait A-series proportions
   * (height = width × √2). Used by the CLI `--size` presets.
   */
  readonly pageWidthPx?: number;
  /** Optional page margins (CSS length strings). */
  readonly margin?: {
    readonly top?: string;
    readonly right?: string;
    readonly bottom?: string;
    readonly left?: string;
  };
  /**
   * If Chromium isn't installed, download it (via the bundled Playwright, so the
   * version always matches) and retry once, instead of throwing. Default `false`.
   */
  readonly autoInstallBrowser?: boolean;
  /** Progress logger for the one-time browser download. */
  readonly log?: (message: string) => void;
}

/** True if the error is Playwright complaining the browser binary is missing. */
function isMissingBrowserError(message: string): boolean {
  return /Executable doesn't exist|playwright install|just installed or updated/i.test(message);
}

/** Resolves the bundled Playwright CLI entry (`cli.js`), or `undefined`. */
function playwrightCliPath(): string | undefined {
  try {
    return join(dirname(require.resolve('playwright/package.json')), 'cli.js');
  } catch {
    return undefined;
  }
}

/**
 * Downloads the Chromium build the *installed* Playwright needs, by running its
 * own bundled CLI (`node …/playwright/cli.js install chromium`). Using the
 * bundled CLI guarantees the browser build matches the library version — the
 * usual cause of "Executable doesn't exist at …chromium-XXXX" errors.
 */
async function installChromium(log: (message: string) => void = () => {}): Promise<void> {
  const cli = playwrightCliPath();
  if (cli === undefined) {
    throw new Error('Could not locate the Playwright CLI. Run `npx playwright install chromium`.');
  }
  log('Downloading Chromium for PDF export (one-time, ~100 MB)…');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : rejectPromise(new Error(`playwright install exited with code ${String(code)}`)),
    );
  });
}

/**
 * Returns `true` if `playwright` is installed AND the Chromium binary is
 * available on disk.
 *
 * Use this to gate PDF tests in CI and to give callers a clear error before
 * launching a browser that doesn't exist.
 */
export async function isChromiumAvailable(): Promise<boolean> {
  try {
    const pw: PlaywrightModule = await import('playwright');
    const exe = pw.chromium.executablePath();
    if (typeof exe !== 'string' || exe.length === 0) return false;
    const { existsSync } = await import('node:fs');
    return existsSync(exe);
  } catch {
    return false;
  }
}

/**
 * Renders a document (or pre-rendered HTML string) to a PDF byte buffer.
 *
 * @param input - A {@link Document} or an HTML string. A Document is rendered
 *   to HTML first via the renderer.
 * @param opts - Optional page format and margins.
 * @returns The PDF bytes.
 *
 * @example
 * ```ts
 * const bytes = await toPdf(doc, { format: 'A4' });
 * await writeFile('out.pdf', bytes);
 * ```
 *
 * @throws If Playwright is not installed or its Chromium binary is missing.
 */
export async function toPdf(input: Document | string, opts: PdfOptions = {}): Promise<Uint8Array> {
  const html = typeof input === 'string' ? input : renderDocument(input);
  const title = typeof input === 'string' ? titleOf(input) : (input.meta?.title ?? 'Untitled');
  const pw = await loadPlaywright();
  const browser = await launchChromium(pw, opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    // The page's own `@page` rule (A4, with margins for the running header and
    // footer) sets the sheet. A custom pixel width or another named format
    // overrides it here, so the CSS size never fights the option.
    const size = sheetSize(opts);
    if (size !== undefined) await page.addStyleTag({ content: `@page{size:${size};}` });
    const buffer = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      // Running header and footer: the doc title, and "page X / Y".
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(title),
      footerTemplate: FOOTER_TEMPLATE,
      // PDF bookmarks from the headings, and a tagged (accessible) PDF.
      outline: true,
      tagged: true,
      ...(opts.margin !== undefined ? { margin: opts.margin } : {}),
    });
    return new Uint8Array(buffer);
  } finally {
    await browser.close();
  }
}

/**
 * The CSS `@page` size an option asks for, or `undefined` to keep the page's
 * own A4. A custom pixel width keeps portrait A-series proportions.
 */
export function sheetSize(opts: Pick<PdfOptions, 'format' | 'pageWidthPx'>): string | undefined {
  if (opts.pageWidthPx !== undefined) {
    return `${String(opts.pageWidthPx)}px ${String(Math.round(opts.pageWidthPx * Math.SQRT2))}px`;
  }
  if (opts.format !== undefined && opts.format !== 'A4') return opts.format;
  return undefined;
}

/** The `<title>` of a rendered page (for the running header of a pre-rendered input). */
function titleOf(html: string): string {
  const m = /<title>([^<]*)<\/title>/.exec(html);
  return m?.[1] !== undefined ? decodeEntities(m[1]) : '';
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Chromium draws the header and footer outside the page's CSS, so they carry
 * their own small inline styles: 8px muted type inside the `@page` margins.
 */
const RUNNING_STYLE =
  "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:8.5px;" +
  'letter-spacing:.02em;color:rgb(95,104,118);width:100%;margin:0 14mm;display:flex;justify-content:space-between;';

/** The running header: the document title, left. */
export function headerTemplate(title: string): string {
  return `<div style="${RUNNING_STYLE}"><span>${escapeText(title)}</span><span></span></div>`;
}

/** The running footer: "page X / Y", right. */
export const FOOTER_TEMPLATE =
  `<div style="${RUNNING_STYLE}"><span></span>` +
  `<span>page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

/**
 * Launches headless Chromium. If the browser binary is missing, either
 * auto-installs it (when `opts.autoInstallBrowser`) and retries, or throws a
 * clear, actionable error with the exact command to run.
 *
 * Exported for the other Chromium-backed exporter (`shots.ts`); not part of
 * the public CLI surface.
 */
export async function launchChromium(
  pw: PlaywrightModule,
  opts: Pick<PdfOptions, 'autoInstallBrowser' | 'log'>,
): Promise<Playwright.Browser> {
  // `CHILTEPIN_CHROME` points at a Chromium binary already on the machine
  // (CI images, agent sandboxes) and skips the managed download.
  const executablePath = process.env.CHILTEPIN_CHROME;
  if (executablePath !== undefined && executablePath.length > 0) {
    return await pw.chromium.launch({ headless: true, executablePath });
  }
  try {
    return await pw.chromium.launch({ headless: true });
  } catch (err) {
    const message = (err as Error).message;
    if (!isMissingBrowserError(message)) throw err;
    if (opts.autoInstallBrowser === true) {
      await installChromium(opts.log);
      return await pw.chromium.launch({ headless: true });
    }
    const cli = playwrightCliPath();
    const cmd = cli !== undefined ? `node "${cli}" install chromium` : 'npx playwright install chromium';
    throw new Error(
      `Chromium isn't installed for PDF export. Install it once with:\n  ${cmd}\nOriginal error: ${message}`,
    );
  }
}

/** Lazy Playwright import shared by the PDF exporter and diagram snapshots. */
export async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import('playwright');
  } catch (err) {
    throw new Error(
      `Playwright is required for PDF export. Run: pnpm add playwright && npx playwright install chromium\n` +
        `Original error: ${(err as Error).message}`,
    );
  }
}
