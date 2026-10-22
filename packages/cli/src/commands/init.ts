/**
 * `chiltepin init` — scaffold a new Chiltepin project in the current directory:
 * the config file and two starter docs. Nothing else.
 *
 * The authoring skill is not copied here. It installs into any agent with one
 * command — `npx skills add jdiejim/chiltepin` — and lives once, in the
 * repository's `skills/chiltepin/` folder. This module still knows where that
 * folder is (packaged as `templates/skill/`, or the repo copy when running
 * from source) for the two consumers that need the whole skill as one
 * document: `chiltepin skill` and the MCP server's embed.
 */

import { cp, mkdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The skill's reference files, in stitch order (hub first, then the block
 * families, recipes, and the authoring guidance). `chiltepin skill`
 * and the MCP embed concatenate exactly this list; the on-disk folder may
 * carry more (the worked derivations), which stay out of the single-file form.
 *
 * This is the one list of skill reference files the CLI stitches for `chiltepin skill`.
 */
export const SKILL_REFERENCE_FILES: readonly string[] = [
  'reference/blocks/narrative.md',
  'reference/blocks/tables-data.md',
  'reference/blocks/api.md',
  'reference/blocks/architecture.md',
  'reference/blocks/flows.md',
  'reference/blocks/data-model.md',
  'reference/blocks/charts-overviews.md',
  'reference/blocks/planning.md',
  'reference/blocks/business.md',
  'reference/blocks/design-system.md',
  'reference/blocks/algorithms.md',
  'reference/blocks/agentic.md',
  'reference/blocks/quality.md',
  'reference/recipes.md',
  'reference/kit.md',
  'reference/patterns.md',
  'reference/patterns-design.md',
  'reference/mermaid.md',
  'reference/writing.md',
  'reference/check.md',
  'reference/system-design.md',
  'reference/c4.md',
  'reference/decks.md',
  'reference/intake.md',
  'reference/organizing.md',
  'reference/style-ste.md',
];

/** The hub + its references, in stitch order. */
const SKILL_FILES: readonly string[] = ['SKILL.md', ...SKILL_REFERENCE_FILES];

/** Files `chiltepin init` writes, template-relative = repo-relative. */
const BASE_FILES: readonly string[] = [
  'chiltepin.config.json',
  'docs/getting-started.md',
  'docs/tutorial.md',
];

/**
 * Resolves the templates directory packaged with the CLI.
 *
 * Walks up from this module's location looking for a `templates` sibling.
 * Works for both `dist/bin.js` (one level up) and source layout
 * (`src/commands/init.ts`, two levels up).
 */
export function templatesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'templates');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate chiltepin/cli templates directory near ${import.meta.url}`);
}

/**
 * Resolves the authoring skill folder: the packaged copy (`templates/skill`,
 * written by `scripts/sync-skill.mjs` at build time) or, when running from the
 * repository, the single source at `skills/chiltepin/`.
 */
export function skillDir(): string {
  // Inside this monorepo (a `pnpm-workspace.yaml` beside `skills/`) the repo
  // copy wins, so an edited skill never hides behind a stale build-time copy.
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'skills', 'chiltepin');
    if (existsSync(join(candidate, 'SKILL.md')) && existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const packaged = join(templatesDir(), 'skill');
  if (existsSync(join(packaged, 'SKILL.md'))) return packaged;
  throw new Error('Could not locate the Chiltepin skill (templates/skill or skills/chiltepin)');
}

/**
 * Stitches the skill hub + every reference file (in {@link SKILL_REFERENCE_FILES}
 * order) into one self-contained markdown document, for consumers with no
 * filesystem beside the skill: `chiltepin skill` and the MCP server's embed. The
 * hub's "live beside this file" pointer language is rewritten since the
 * references follow inline.
 */
export async function stitchSkill(srcRoot: string = skillDir()): Promise<string> {
  const parts = await Promise.all(SKILL_FILES.map((f) => readFile(resolve(srcRoot, f), 'utf8')));
  return (
    (parts.map((p) => p.trimEnd()).join('\n\n---\n\n') + '\n').replaceAll(
      'live beside this file — read them on demand',
      'are included in full below — read them on demand',
    ) + DERIVATIONS_NOTE
  );
}

/**
 * The single-file form leaves out the worked derivations (reasoning examples,
 * kept out on purpose so the prompt stays small). The hub's table still names
 * `reference/derivations/*.md`, so the stitched form says where they are.
 */
export const DERIVATIONS_NOTE =
  '\n---\n\n## Not in this file: the worked derivations\n\n' +
  'The worked derivations (`reference/derivations/*.md`) are repo-only. This single file does not include them. ' +
  'Read them at https://github.com/jdiejim/chiltepin/tree/main/skills/chiltepin/reference/derivations, ' +
  'or install the full skill with `npx skills add jdiejim/chiltepin -y`.\n';

interface InitOptions {
  readonly cwd: string;
  /** Overwrite files that already exist. Default: false (skip with a notice). */
  readonly force?: boolean;
}

export interface InitResult {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * Scaffolds a Chiltepin project into `cwd`: the config and the two starter
 * docs. Existing files are skipped unless `force: true`. Returns the
 * created/skipped relative paths for reporting.
 */
export async function runInit(opts: InitOptions): Promise<InitResult> {
  const srcRoot = templatesDir();
  const created: string[] = [];
  const skipped: string[] = [];
  for (const rel of BASE_FILES) {
    const dst = join(opts.cwd, rel);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(rel);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await cp(resolve(srcRoot, rel), dst);
    created.push(rel);
  }
  return { created, skipped };
}
