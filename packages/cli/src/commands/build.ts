/**
 * `chiltepin build` — render every doc into a static HTML site on disk.
 *
 * Loads config (docsDir/outDir) and docs, builds the site via
 * {@link buildSite}, and writes `index.html` plus one page and one slide
 * deck (`<slug>.slides.html`) per doc under the out directory (nested slugs
 * keep their directories).
 *
 * The build then **prunes**: a file the previous build recorded in its manifest
 * (`.chiltepin-build.json`) and this build did not generate is deleted, so a doc
 * removed from `docs/` stops being served. Only manifest-listed files are
 * removed — anything else in the output directory (a `CNAME`, an `assets/`
 * folder) is never touched, and an output directory with no manifest is left
 * entirely alone.
 *
 * Besides the pages it writes `search.json`, the shared stylesheet and script
 * (`assets/chiltepin.css`, `assets/chiltepin.js`, linked from every page), and
 * a copy of every local image a page shows (`meta.logo` included), so the
 * site works from any folder or host. All of them are in the manifest.
 *
 * Diagnostics are returned for the CLI to print, each at its own level.
 * Schema and reference errors do not fail the build — `chiltepin check`
 * remains the CI gate. A renderer that throws is an `E_RENDER` error: that
 * document gets a placeholder page, the rest of the build finishes, and the
 * exit code is 1.
 */

import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseDocument, type Diagnostic } from 'chiltepin-core';
import { loadConfig } from '../io/config.js';
import { encodingDiagnostics, loadDocs } from '../io/files.js';
import { readManifest, writeManifest, pruneStale, MANIFEST_FILE } from '../io/manifest.js';
import { cliVersion } from '../io/version.js';
import { buildSite, type SiteDoc } from './site.js';

/** Inputs to {@link runBuild}. */
interface BuildOptions {
  /** Project root. */
  readonly cwd: string;
  /** Output directory override (defaults to config `outDir`). */
  readonly out?: string;
  /** Build the rich index page. On by default; `--no-rich-index` (or config
   * `richIndex: false`) switches to the plain card grid. Unset falls back to
   * the config value. */
  readonly richIndex?: boolean;
}

/** Result of {@link runBuild}. */
interface BuildResult {
  /** Absolute output directory. */
  readonly outDir: string;
  /** Output directory relative to cwd (for display). */
  readonly outDirRel: string;
  /** Written pages with byte sizes. */
  readonly pages: readonly { readonly path: string; readonly bytes: number }[];
  /** Output-relative paths of stale files this build removed. */
  readonly removed: readonly string[];
  /**
   * True when the output directory held files but no manifest, so this build
   * pruned nothing. The next build has a manifest and prunes normally.
   */
  readonly pruneDeferred: boolean;
  /** Schema, ref, encoding, and render diagnostics. */
  readonly diagnostics: readonly Diagnostic[];
  /** Local images a page links to that do not exist (project-relative). */
  readonly missingAssets: readonly string[];
  /** Images copied next to the pages (output-relative). */
  readonly assets: readonly string[];
  /** 0, or 1 when a document failed to render. */
  readonly exitCode: number;
}

/** Builds the docs site and writes it under the out directory. */
export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const config = await loadConfig(opts.cwd);
  const outDir = resolve(opts.cwd, opts.out ?? config.outDir);
  const files = await loadDocs([`${config.docsDir}/**/*.md`], opts.cwd, config.docsDir);
  const docs: SiteDoc[] = files
    .filter((f) => f.encodingError === undefined)
    .map((f) => ({
      slug: f.slug,
      file: f.file,
      doc: parseDocument(f.source, f.slug),
    }));

  const site = buildSite(docs, {
    richIndex: opts.richIndex ?? config.richIndex,
    colorScheme: config.colorScheme,
    sharedAssets: true,
  });
  const diagnostics: Diagnostic[] = [...encodingDiagnostics(files), ...site.diagnostics];

  // Read the previous manifest before writing, so a page this build also
  // generates is never a prune candidate.
  const previous = await readManifest(outDir);

  const pages: { path: string; bytes: number }[] = [];
  for (const page of site.pages) {
    const abs = join(outDir, page.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, page.html, 'utf8');
    pages.push({ path: page.path, bytes: Buffer.byteLength(page.html, 'utf8') });
  }
  // The search index and the shared stylesheet and script.
  for (const file of site.files) {
    const abs = join(outDir, file.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.content, 'utf8');
  }
  // Local images next to the pages that show them. A missing image is
  // reported, not fatal: the page still builds, and its `<img>` shows the
  // alt text.
  const copied: string[] = [];
  const missing: string[] = [];
  for (const asset of site.assets) {
    const from = resolve(opts.cwd, asset.from);
    const to = join(outDir, asset.to);
    try {
      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);
      copied.push(asset.to);
    } catch {
      missing.push(asset.from);
    }
  }

  const generated = [...site.pages.map((p) => p.path), ...site.files.map((f) => f.path), ...copied];
  const removed =
    previous === undefined ? [] : await pruneStale(outDir, previous.files, new Set(generated));
  await writeManifest(outDir, generated, `chiltepin ${cliVersion()}`);

  return {
    outDir,
    outDirRel: relative(opts.cwd, outDir) || '.',
    pages,
    removed,
    pruneDeferred: previous === undefined && (await hadContent(outDir, generated)),
    diagnostics,
    missingAssets: missing,
    assets: copied,
    exitCode: diagnostics.some((d) => d.code === 'E_RENDER') ? 1 : 0,
  };
}

/**
 * True when the output directory already held files this build did not
 * generate — the only case where a missing manifest is worth mentioning.
 * Called after the write, so the just-written pages are excluded by name.
 */
async function hadContent(outDir: string, generated: readonly string[]): Promise<boolean> {
  const own = new Set<string | undefined>([
    ...generated.map((p) => p.split('/')[0]),
    MANIFEST_FILE,
  ]);
  try {
    const entries = await readdir(outDir);
    return entries.some((e) => !own.has(e));
  } catch {
    return false;
  }
}
