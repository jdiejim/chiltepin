/**
 * Single-document export shortcuts behind `chiltepin html` / `chiltepin slides` / `chiltepin pdf`.
 * Each renders one doc, applying the project theme (`chiltepin.theme.json`), and
 * writes a single output file (defaulting next to the input).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, parse as parsePath, relative, resolve } from 'node:path';
import open from 'open';
import { parseDocument } from 'chiltepin-core';
import { renderDocument, toSlides } from 'chiltepin-render';
import { toPdf } from '../io/pdf.js';
import { assertWritable } from '../io/write.js';
import { loadConfig } from '../io/config.js';
import { renderFailure } from './renderGuard.js';

export type SingleFormat = 'html' | 'slides' | 'pdf';

/** Page-width preset for the page-shaped exports (`html`, `pdf`). */
export type ExportSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Page width in CSS pixels for each `--size` preset. The unflagged default
 * stays the house content width (1180 px) and, for PDF, the A4 page.
 */
export const SIZE_WIDTHS: Readonly<Record<ExportSize, number>> = {
  sm: 720,
  md: 960,
  lg: 1280,
  xl: 1600,
};

/** Parses a `--size` value; returns `undefined` for an unknown preset. */
export function parseExportSize(value: string): ExportSize | undefined {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'xl'
    ? value
    : undefined;
}

const EXT: Readonly<Record<SingleFormat, string>> = {
  html: 'html',
  slides: 'slides.html',
  pdf: 'pdf',
};

/**
 * Path suffixes each format is allowed to replace in place. Re-exporting over
 * the last export is the normal loop; writing a rendered file over a source
 * file (`-o notes.md`) is data loss and refuses without `--force`.
 */
const REGENERATES: Readonly<Record<SingleFormat, readonly string[]>> = {
  html: ['.html', '.htm'],
  slides: ['.html', '.htm'],
  pdf: ['.pdf'],
};

export interface SingleResult {
  readonly output: string;
  readonly bytes: number;
  readonly opened: boolean;
}

/** Renders `opts.input` to `opts.format` and writes it (or previews it). */
export async function runSingle(opts: {
  readonly cwd: string;
  readonly input: string;
  readonly output?: string;
  readonly format: SingleFormat;
  readonly preview?: boolean;
  /**
   * With `preview`, whether to actually open the browser (default true).
   * `false` keeps the temp-file rendering but stays script-safe (non-TTY
   * `chiltepin <file.md>`).
   */
  readonly open?: boolean;
  /**
   * `html` and `pdf` only: page-width preset. Sets the content width
   * (`--page-max`) and, for PDF, the page width. Unset keeps the defaults
   * (1180 px content width; A4 page).
   */
  readonly size?: ExportSize;
  /**
   * Replace an existing file at `output`. Without it, a path that does not
   * already carry this format's extension is refused rather than overwritten.
   */
  readonly force?: boolean;
}): Promise<SingleResult> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const doc = parseDocument(source, slug);

  // A size preset widens (or narrows) the page: the content column follows the
  // `--page-max` CSS variable the house stylesheet reads. Slides/PPTX keep
  // their fixed 16:9 stage, so the preset only applies to html and pdf.
  const sizePx =
    opts.size !== undefined && (opts.format === 'html' || opts.format === 'pdf')
      ? SIZE_WIDTHS[opts.size]
      : undefined;
  const config = await loadConfig(opts.cwd);
  const themeOpts = {
    colorScheme: config.colorScheme,
    ...(sizePx !== undefined ? { themeVars: { '--page-max': `${String(sizePx)}px` } } : {}),
  };

  // Preview → a temp file keyed by the *content* (source + format + size), so an
  // edit produces a new filename and the browser opens a fresh tab instead of
  // showing the previously-cached one. Unchanged content reuses the same file.
  let outputAbs: string;
  if (opts.preview === true) {
    const hash = createHash('sha1')
      .update(`${source}\u0000${opts.format}\u0000${JSON.stringify(themeOpts)}`)
      .digest('hex')
      .slice(0, 10);
    const dir = join(tmpdir(), 'chiltepin-preview');
    await mkdir(dir, { recursive: true });
    outputAbs = join(dir, `${slug}-${hash}.${EXT[opts.format]}`);
  } else {
    outputAbs =
      opts.output !== undefined
        ? resolve(opts.cwd, opts.output)
        : inputAbs.replace(/\.md$/i, `.${EXT[opts.format]}`);
    // Only a path the user named is guarded: the derived sibling
    // (`doc.md` → `doc.html`) is this command's own artifact by construction.
    if (opts.output !== undefined) {
      assertWritable(outputAbs, {
        ...(opts.force === true ? { force: true } : {}),
        regenerates: REGENERATES[opts.format],
      });
    }
    await mkdir(dirname(outputAbs), { recursive: true });
  }

  // A renderer that throws must say which document and which block — the bare
  // V8 message ("Invalid string length") names neither.
  const named = async <T>(what: string, produce: () => T | Promise<T>): Promise<T> => {
    try {
      return await produce();
    } catch (err) {
      const d = renderFailure(doc, relative(opts.cwd, inputAbs) || opts.input, what, err);
      const where = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
      throw new Error(`${where}  ${d.message}`, { cause: err });
    }
  };

  let bytes: number;
  if (opts.format === 'pdf') {
    // Auto-download the matching Chromium on first use, so `chiltepin pdf` just works.
    const page = await named('PDF', () => renderDocument(doc, themeOpts));
    const pdf = await toPdf(page, {
      autoInstallBrowser: true,
      log: (m) => console.error(m),
      // With a size preset the PDF page itself takes the preset width (portrait
      // A-series proportions); without one the page stays A4.
      ...(sizePx !== undefined ? { pageWidthPx: sizePx } : {}),
    });
    await writeFile(outputAbs, pdf);
    bytes = pdf.byteLength;
  } else {
    const html = await named(opts.format === 'slides' ? 'slide deck' : 'page', () =>
      opts.format === 'slides' ? toSlides(doc, themeOpts) : renderDocument(doc, themeOpts),
    );
    await writeFile(outputAbs, html, 'utf8');
    bytes = Buffer.byteLength(html, 'utf8');
  }

  const doOpen = opts.preview === true && opts.open !== false;
  if (doOpen) await open(outputAbs);
  return { output: outputAbs, bytes, opened: doOpen };
}
