/**
 * `chiltepin shots <file>` — one PNG per diagram, so the author can look at
 * what the renderer drew before handing the doc off. Each line names the
 * diagram, the image, and a fit problem in data terms when the drawing
 * scrolls or shrinks hard on the page. The fit thresholds are the ones
 * `check` (`W_FIT`) and `review` use (`fit.ts`); `chiltepin review` is the
 * full pass (every block, both themes, phone, print, and a contact sheet).
 */

import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse as parsePath, relative, resolve } from 'node:path';
import { parseDocument } from 'chiltepin-core';
import { renderDocument } from 'chiltepin-render';
import { loadConfig } from '../io/config.js';
import { toShots, type DiagramShot } from '../io/shots.js';
import { renderFailure } from './renderGuard.js';
// Below this share of its natural size a drawing's labels read too small
// (shared with `check` and `review`).
import { SMALL_SCALE } from './fit.js';

/** A captured diagram plus the fit advice for it, if any. */
export interface ShotReport extends DiagramShot {
  readonly advice?: string;
}

/** Fit advice for one shot, in terms of the block's data. */
export function shotAdvice(s: DiagramShot): string | undefined {
  if (s.scrolls) {
    return `scrolls sideways (${String(s.width)} wide): set \`dir: TB\`, remove \`col\`/\`row\` so auto-layout can fit the page, or split the diagram`;
  }
  if (s.scale < SMALL_SCALE) {
    return `shrinks to ${String(Math.round(s.scale * 100))}% on the page, so its labels read small: set \`dir: TB\` or split the diagram`;
  }
  return undefined;
}

/** Renders `opts.input` and writes its diagram snapshots. */
export async function runShots(opts: {
  readonly cwd: string;
  readonly input: string;
  /** Output folder; defaults to `<tmp>/chiltepin-shots/<slug>`. */
  readonly output?: string;
}): Promise<{ readonly dir: string; readonly shots: readonly ShotReport[] }> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const doc = parseDocument(source, slug);
  const config = await loadConfig(opts.cwd);
  let html: string;
  try {
    html = renderDocument(doc, { colorScheme: config.colorScheme });
  } catch (err) {
    const d = renderFailure(doc, relative(opts.cwd, inputAbs) || opts.input, 'page', err);
    const where = d.line !== undefined ? `${d.file}:${String(d.line)}` : d.file;
    throw new Error(`${where}  ${d.message}`, { cause: err });
  }
  const dir = opts.output !== undefined ? resolve(opts.cwd, opts.output) : join(tmpdir(), 'chiltepin-shots', slug);
  const shots = await toShots(html, dir, slug, { autoInstallBrowser: true, log: (m) => console.error(m) });
  return {
    dir,
    shots: shots.map((s) => {
      const advice = shotAdvice(s);
      return advice !== undefined ? { ...s, advice } : s;
    }),
  };
}
