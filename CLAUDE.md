<!-- Repo location: CLAUDE.md at the repository root. Claude Code reads this automatically. -->

# Chiltepin — agent guide

This repo is **Chiltepin**: documentation-as-code where a doc is Markdown with typed,
fenced YAML blocks, and the files on disk are the single source of truth.

## Writing or editing documentation

When creating or changing any document under `docs/**/*.md`, **follow the authoring
skill at `skills/chiltepin/SKILL.md`**. It defines the block grammar and the `doc#id`
reference scheme. The field contract for any block comes from the CLI, generated from
the schema: run `node packages/cli/dist/bin.js block <type>` (or `chiltepin block <type>`)
before writing a block; never look for a hand-written contract file.
In short:

- Prose is plain Markdown; structure goes in typed blocks (e.g. `sequence`, `erd`,
  `table`, `callout`, `c4`, `flow`, `timeline`, `userstory`). Never paste raw HTML
  or inline SVG.
- Use only the documented block types (107 of them, plus 12 permanent aliases for
  merged old names) and their documented fields —
  the schemas are strict. Bodies are YAML.
- Give a block an `id:` when it needs to be referenced; reference it as `doc#id`.
- Edit the specific block surgically — don't regenerate whole files.
- **Run `chiltepin check` and fix all diagnostics before finishing.** A change isn't done
  until it passes.

## Working on the codebase itself

- Read `ARCHITECTURE.md` before changing structure.
- Dependency direction points inward to `chiltepin-core`; `core` is pure (no I/O, no DOM).
- Block types are defined once in the **block registry**; adding one means adding a
  schema in `core` plus a renderer in each target. Registries are compile-time
  exhaustive — don't bypass them with ad-hoc switches.
- Libraries return diagnostics/typed results; only the CLI throws and sets exit codes.
- `chiltepin-studio` BUNDLES `core`/`render` (devDependencies, baked in by Vite at
  publish). A changeset that changes anything Studio renders must also patch
  `chiltepin-studio`, or the published Studio canvas keeps the old renderer.
- Keep `pnpm lint`, `pnpm typecheck`, and `pnpm test` green. Conventional commits.

## Chiltepin — what this repo is

Documentation-as-code. A doc is plain Markdown; every visual thing is a **typed
block** — a fenced section with a type and a YAML body. 107 block types across 13
families (narrative, tables/code, API, architecture, flows/state, data model,
charts, planning, business/decisions, design system, algorithms, AI/agents).
`.md` files on disk are the only source of truth. Nothing else holds state.

### Packages

- `chiltepin-core` — pure library. Parsing, block registry, schemas, diagnostics.
  No I/O, no DOM. Everything depends inward on core. If a change here is not
  additive, it is a breaking change to every other package — say so.
- `chiltepin-render` — deterministic renderers. One block type → one renderer →
  consistent HTML/SVG. **The LLM never draws.** It writes ~1KB of YAML; the
  renderer owns 100% of layout and geometry.
- `chiltepin` (CLI, `chiltepin` binary) — validation, static sites, HTML, slides, PDF,
  Studio, block references, and the built-in demo. Run `chiltepin --help` for commands.
- `chiltepin-studio` — web canvas/editor bundling core + render.
- Authoring skill (`skills/chiltepin/SKILL.md` + reference files, one
  copy in the repo) — teaches an agent to author docs. It installs into any agent
  with `npx skills add jdiejim/chiltepin -y`; the CLI build copies it into the package
  for `chiltepin skill`.

### The invariant that matters most

Geometry is code, never prompt. If a task tempts you to teach the model pixel
coordinates, inline SVG, or layout rules, you have misdiagnosed the task: the
fix belongs in `chiltepin-render`, not in the skill. The skill teaches
_selection, composition, and content_. The renderer owns _appearance_.

### Definition of done

`pnpm -w typecheck && pnpm -w test && pnpm -w lint && chiltepin check` all green, plus
a rendered example of anything visual you touched. Schema changes ship with:
the schema, the renderer, a reference entry in the skill, a catalog example, and
a test. Five things. A block type missing any of them does not exist.

### House style for anything a user reads

Short, technical, synthesized. No filler openers ("In this section we will…"),
no restating the block below in prose, no adjective stacking. Explain to a smart
non-specialist: simple words, precise claims. If a sentence carries no fact,
delete it.

Technical text in this repo follows **STE discipline** — the writing rules of
ASD-STE100 Simplified Technical English, adapted for software docs. The rules
live in `skills/chiltepin/reference/style-ste.md`. Read that file before you write
any prose block, CLI help string, diagnostic message, or skill instruction.

Two hard constraints on how we use it:

- ASD-STE100 is free to obtain but **not free to redistribute**. Never copy the
  specification text or its ~900-word approved dictionary into this repo. We
  apply the rules and keep our own term list.
- Never claim Chiltepin output "is STE" or "is STE-compliant". The wording is
  "STE-informed" or "follows STE writing discipline". Certified compliance
  requires the real dictionary, which we do not ship.
