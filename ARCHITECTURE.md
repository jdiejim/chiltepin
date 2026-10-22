# Architecture

Chiltepin is a documentation-as-code system. A pnpm monorepo of four published packages — `chiltepin-core`, `chiltepin-render`, `chiltepin-studio`, and `chiltepin` — where dependencies always point inward toward a pure `chiltepin-core`. **107 canonical block types** (plus 12 permanent aliases for merged old names), each with a zod schema, a typed renderer entry, and (where applicable) shared layout / SVG utilities.

## Guiding principle

**The files on disk are the only source of truth.** The CLI, agents, and any future UI are editors and consumers of those files; none owns state. The core library turns files into a validated in-memory model with a reference graph; everything else consumes that model.

## Layering

```
chiltepin-core   ← pure: parse, schemas (107 + aliases), validate, resolve, edit ops. No I/O.
chiltepin-render ← chiltepin-core. HTML + slide decks out. No DOM, no browser. One look; dark by default.
chiltepin-studio ← @chiltepin/{core, render}. Browser SPA (Vite/React), ships built static assets.
chiltepin (CLI)   ← @chiltepin/{core, render, studio}. Ink TUI. PDF (Playwright) + sync I/O (OpenAPI, CSV). Owns process.exit.
```

The marketing + docs site (chiltepin.dev) lives in its own repository and consumes `@chiltepin/*` from npm like any other user, so nothing in this monorepo depends on it.

Rules:

- `chiltepin-core` does **no I/O**: no file system, no network, no `process`, no DOM. It reads strings and returns models and diagnostics.
- All I/O lives in the **outer ring** (`cli`) — including PDF export (Playwright, an optional dependency imported lazily) and the file reads/writes behind `chiltepin sync openapi` / `chiltepin sync csv`. The importers themselves (OpenAPI → markdown, CSV → block fences, `core/src/import/`) are pure and live in `core`, so Studio shares them with the CLI.
- Libraries **return diagnostics** as values. They don't `throw` for expected conditions (parse errors, schema violations, dangling refs). The CLI is the only layer that maps diagnostics to console output and exit codes.
- `chiltepin-studio` is an outermost consumer of `core` + `render` only (never the CLI's Node/Playwright-bound PDF code). The whole parse → validate → render pipeline runs client-side in the browser; the published package contains only built static assets plus a tiny Node entry (`assetsPath()`) the CLI uses to serve them. The `chiltepin studio` server is a **file bridge** — JSON read/write API + SSE change events, bound to `127.0.0.1` — and never renders. Editing goes through core's surgical edit ops (`replaceBlockBody`, `insertBlock`, `setYamlPath`, …) — including direct on-diagram interactions (click to select a part, Enter to edit it, arrow keys or drag to move it), which compile down to the same ops — so a studio session rewrites individual fenced blocks in place and the files on disk stay the single source of truth. Storage itself sits behind one interface — `StudioBackend` in `studio/src/api/backend.ts`, five methods — with two implementations: the file bridge above, and an in-tab vault with no server behind it. The package builds both (`dist/app` for the CLI, `dist/web` for a static host), so a hosted studio is a choice of backend at boot rather than a second application; the hosted build hides what needs a server (PDF, PowerPoint, the built site, change events) and shares documents by putting the source in a URL fragment instead.

## The block registry

The block registry in `chiltepin-core` is the architectural backbone:

```ts
export const blockSchemas = {
  meta, callout, table, sequence, erd, userstory, timeline, kanban, statustable,
  // … one entry per block type — 107 in total, across 13 families.
  // The full list is `BLOCK_TYPES` in `core/src/types.ts`.
} as const satisfies Record<BlockType, ZodTypeAny>;

export type BlockDataMap = { [K in BlockType]: z.infer<(typeof blockSchemas)[K]> };

export interface BlockDef<K extends BlockType> {
  readonly type: K;
  readonly schema: (typeof blockSchemas)[K];
  readonly extractRefs?: (data: BlockDataMap[K]) => readonly string[];
}

export type BlockRegistry = { readonly [K in BlockType]: BlockDef<K> };
```

The same `Record<BlockType, …>` pattern propagates to every rendering target — for instance, `chiltepin-render` defines `HtmlRendererRegistry = { [K in BlockType]: (data: BlockDataMap[K]) => string }`. Adding a new block type in `core` is a one-line change to `BLOCK_TYPES`, and `tsc` then immediately surfaces every registry that hasn't been extended.

This is intentional: there's exactly one place to add a block (its schema), and the type system makes us update every consumer. No scattered switch statements, no runtime `default: throw new Error('unknown block')` clauses to keep in sync.

## Block aliases

Twelve former block types merged into canonical ones (`infra`/`event`/`ddd`/`network` → `block` + `preset`, `belogic` → `felogic` + `variant: be`, `dag` → `flow` + `variant: dag`, `waterfall`/`funnel` → `chart` + `kind`, `diff`/`terminal` → `code` + `kind`, `mece` → `tree` + `variant: issue`, `tracker` → `statustable` + `variant: tracker`). The old spellings are **permanent aliases**, defined once in `core/src/blocks/aliases.ts` (`BLOCK_ALIASES`, with the derived `BLOCK_SYNONYMS` for search/insert UIs):

- The **splitter** recognises an alias fence and records the tag as written in the segment's `sourceType`; the segment's `kind` is always canonical.
- The **parser** shallow-merges the alias `patch` (e.g. `{ kind: 'waterfall' }`) into the parsed body — only for keys the body doesn't set, so the body always wins.
- **Rendering** is byte-identical to the pre-merge output (pinned parity fixtures); the SECTION eyebrow uses the alias's historical label via `sourceType`.
- **Validation** surfaces the mapping as a `W_ALIAS_TYPE` warning — informational; warnings never fail `chiltepin check`.
- **Editing stays faithful**: edit ops never rewrite fence lines, so aliased fences survive studio editing byte-for-byte; new insertions always write canonical names.

## Mermaid input dialect

A ```` ```mermaid ```` fence is a second input syntax for five block types, not a block type of its own. The splitter reads the body's first meaningful line: `sequenceDiagram` → `sequence`, `flowchart` / `graph` → `flow`, `erDiagram` → `erd`, `stateDiagram` / `stateDiagram-v2` → `state`, `pie` → `chart`; the segment carries `sourceType: 'mermaid'`. Any other Mermaid grammar stays prose (rendered as a plain code block). The parser converts the body through `core/src/mermaid/` (one file per grammar, `convertMermaid` as the entry) into exactly the data the block schema accepts, then normalizes it like a YAML body — validation and rendering never see the dialect. A line outside the subset is `E_PARSE_MERMAID`, positioned like `E_PARSE_YAML`. The one exception to "edit ops never rewrite fences": `replaceBlockBody` on a Mermaid segment writes the canonical tag, because YAML is the canonical form on disk and the new body is YAML (`editableBodyYaml(seg)` gives an editor the YAML to start from). The supported subset is documented for authors in the skill's `reference/mermaid.md`.

## Block families

Block types are grouped into 13 families (`BLOCK_FAMILIES` / `BLOCK_FAMILY` in the core catalog), but the runtime treats them all uniformly through the registry:

| Family | Blocks |
| --- | --- |
| Narrative & prose (11) | `meta` `callout` `prose` `glossary` `pullquote` `layers` `figure` `faq` `divider` `bignumber` `takeaways` |
| Tables & code (5) | `table` `stats` `code` `slo` `benchmark` |
| API (3) | `endpoint` `packet` `eventcontract` |
| Architecture (9) | `c4` `uml` `frontend` `cluster` `block` `felogic` `archmap` `usecase` `pkg` |
| Flows & state (11) | `sequence` `flow` `state` `dfd` `swimlane` `steps` `cycle` `gitgraph` `saga` `spans` `timing` |
| Data model (1) | `erd` |
| Charts & overviews (14) | `tree` `pyramid` `journey` `gantt` `graph` `quadrant` `chart` `heatmap` `sankey` `treemap` `venn` `fishbone` `slopegraph` `mindmap` |
| Planning & backlogs (17) | `userstory` `timeline` `kanban` `proscons` `cvt` `agenda` `list` `stories` `pattern` `gallery` `changelog` `risk` `statustable` `storymap` `rollout` `chevrons` `roadmap` |
| Business & decisions (16) | `matrix` `anatomy` `composition` `drivers` `options` `spec` `envelope` `swot` `okr` `persona` `team` `scorecard` `wardley` `harvey` `scqa` `scenarios` |
| Design system (5) | `wireframe` `palette` `typescale` `dodont` `inventory` |
| Algorithms (4) | `array` `linkedlist` `bintree` `hashmap` |
| AI & agents (6) | `agentloop` `trace` `prompt` `context` `neuralnet` `modelcard` |
| Quality & audits (5) | `audit` `checklist` `perfbudget` `percentiles` `threatmodel` |

## Renderer fidelity

`chiltepin-render` owns the HTML/SVG output and the shared editorial skin:

- The house CSS (`packages/render/src/css.ts`) is namespaced under `.docskin`.
- Each block renderer maps schema data to HTML or SVG with shared layout utilities.
- SVG diagrams use integer-only coordinates so snapshots are byte-deterministic.
- Diagrams are wrapped in a `<div class="diagram">` frame with a colour-coded tag pill (e.g. `POST`, `C4`, `SEQUENCE`) and optional title / description / figure number.
- Each typed block is wrapped in a `.section-block` with a `SECTION NN · LABEL` eyebrow.

Shared SVG utilities live under `packages/render/src/svg/`:

| Utility | Purpose |
| --- | --- |
| `globalDefsSvg()` | Emits the shared `<defs>` (markers + drop-shadow filter) once at the top of every document |
| `routeEdges(nodes, edges, opts)` | Obstacle-aware orthogonal router for the grid diagrams (`router.ts`): routes never cross a node, edges that share a side spread their ports, back edges loop around their row, parallel runs keep a track apart. Deterministic, integer output |
| `layoutEdges(…)` | Routes a diagram's edges, sets each label ON its own edge (`edgeLabelLayer`), and moves other routes off the placed labels (`edgeLayout.ts`) |
| `gapsForLabels(…)` | One uniform column / row gap per grid, wide enough for every edge label (Studio's grid metadata stays valid) |
| `geometryReport(type, data)` | Public: what a grid diagram's layout could not avoid (feeds `W_GEOMETRY`) |
| `ortho(A, B)` | Single-edge Manhattan routing between two boxes (public helper; knows nothing about other nodes) |
| `wrapText(t, max, lines)` | Word-aware line wrapping for diagram labels |
| `edgePill(p, label, err?)` | Rounded edge-label background |
| `nodeSkin(kind)` | Maps a node `kind` → its skin: chip, primary / secondary stroke, fill, dash, and family hue (`svg/blockStyle.ts`, with the AI kit) |
| `nodeGlyph(kind, x, y, c)` | Returns small SVG glyph (database cylinder, queue bars, function ƒ, wrench, gauge, …) |
| `groupHues(groups, members)` | Picks each group panel's hue: named, else its nodes' family, else the next free hue (`svg/gridGroups.ts`, `svg/hues.ts`) |
| `GEDGE` | Per-kind edge stroke style table (`solid`/`dashed`/`forbidden`/`error`) |

## Look and dark mode

There is one look: the editorial skin in `packages/render/src/css.ts` (see `packages/render/DESIGN.md`). Every colour is a role token on `:root` (`--paper`, `--ink`, `--accent`, …); dark is the default. Colour has two channels: six category hues (`--hue-blue` … `--hue-rose`, each with an opaque `-tint`) say what kind of thing a mark is, picked by the renderer from a node's `kind` or a group; the one `--accent` marks the focal answer. `colorScheme: "light"` stamps `data-theme="light"` on the rendered page; `"system"` adds an OS preference rule.

There is no theme choice anywhere — no `chiltepin theme`, no `--theme`, no Studio panel. `packages/render/src/themes.ts` keeps the single-entry shape (`ThemeName = 'textbook'`, label `Editorial`, `themeStyle()` returns `''`) so presets can return without an API change, and `RenderPartsOptions.themeVars` stays as an internal `:root` override with no user surface (the CLI uses it for `--size`).

## Reference scheme

- Any block may carry an `id` (a human-readable slug). Ids are **repo-global unique**.
- A reference is `doc#id` (absolute) or `#id` (within the current document). `doc` is the slug — the path under the docs root, stripped of `.md`.
- Two block types carry references today: `userstory` (`links[].ref`) and `stories` (`items[].links[].ref`). The `extractRefs` function in each block's registry entry is the single place wiring this. Extending another block to carry references is a small addition to its `BlockDef`.
- The resolver builds `{ id → { doc, block } }` and `{ from, to }` edges across all docs and emits diagnostics for **duplicate ids** and **dangling refs**, each with file + line + offending value.

## Diagnostic taxonomy

Stable codes that the CLI can sort, filter, and format:

| Code | Level | When |
| --- | --- | --- |
| `E_PARSE_YAML` | error | YAML body failed to parse |
| `E_PARSE_MERMAID` | error | A ```` ```mermaid ```` body has a line outside the dialect subset (`core/src/mermaid/`) |
| `E_SCHEMA` | error | Zod validation issue |
| `E_DUP_ID` | error | Same id used twice |
| `E_DANGLING_REF` | error | Ref target not found |
| `E_SWIMLANE_LANE` | error | A `swimlane` step's `lane` names no lane (unknown label/id, or an index past the last lane) |
| `E_BAD_REF_FORMAT` | error | Ref doesn't match `doc#id` or `#id` |
| `E_UNKNOWN_BLOCK` | error | Defensive (splitter should prevent) |
| `E_ENCODING` | error | The file on disk is not UTF-8 (CLI-only — it is the layer that reads files) |
| `E_RENDER` | error | A renderer threw while drawing a block; names the document and the block (CLI-only, around `chiltepin-render`) |
| `W_EMPTY_BLOCK` | warn | Typed block with empty body |
| `W_SUSPECT_BLOCK` | warn | Fence tag looks like a typo of a real block type (rendered as plain text; carries a did-you-mean suggestion) |
| `W_ALIAS_TYPE` | warn | Fence uses one of the 12 permanent alias names (e.g. `waterfall`) — parsed and rendered as its canonical type; informational only |
| `W_EDGE_LABEL` | warn | A `c4` relationship has no `label` (the C4 notation asks every line to name its intent) |
| `W_GENERIC_LABEL` | warn | A diagram node, actor, or step carries a placeholder name (`Service A`, `Database`, `API` alone, `Step 1`, `TODO`) instead of the real component's name. `lintGenericLabels` (`core/src/genericLabels.ts`) runs beside `validateDocument` in `chiltepin check`, like the density lint, so the catalog's grammar examples stay validate-clean |
| `W_GEOMETRY` | warn | A diagram's layout could not avoid a problem: two nodes in one cell, an edge forced through a node, a label with no clear place on its edge, many crossings, a label the renderer had to cut (`label-truncated`), a boundary that would enclose an outsider, or a step whose `phase` names no band. Computed by `chiltepin-render`'s `geometryReport` for every block type, reported by the CLI; the hint names the fix in the block's data |
| `W_FIT` | warn | A drawing is wider than the stage (it scrolls) or would shrink below about 0.65 of the page column. Computed from the SVG viewBox in the CLI (`commands/fit.ts`), no browser; the hint is per block type |
| `E_DANGLING_LINK` | error | A Markdown link in prose (`[text](#id)`, `[text](doc#id)`, `[text](./x.md#id)`) names a doc, block id, or heading id that does not exist. Heading ids follow `core/src/slug.ts`, shared with the renderer |
| `W_ORPHAN_NODE` · `W_EMPTY_GROUP` · `W_DUP_EDGE` | warn | Graph hygiene: a node with no edges in a block that has edges; a group whose cells hold no node; the same edge written twice (`core/src/graphLints.ts`) |
| `W_DECISION_LABEL` · `W_ERROR_INTO_SUCCESS` · `W_IDLE_ACTOR` | warn | Graph meaning: a `flow` decision with an unlabelled branch; an exit whose edges say the opposite of its name (a success end reached only by `-x->`, a failure end that draws as the happy path); a `sequence` actor in no message |
| `W_TEMPLATE_ECHO` | warn | A doc keeps a real share of a `chiltepin new` template's example text (`core/src/templateEcho.ts`). Silent when `meta.status` is `example` |
| `W_INLINE_UNKNOWN` | warn | Inline styling the renderer cannot draw: an icon-shaped `:name:` that names no icon, a `[text]{.class}` class outside the allowlist or a class list that mixes two styles, or an unknown `list` / `drivers` `icon`. Reads prose and every field in `INLINE_MD_FIELDS` (`core/src/inline.ts`, `inlineLint.ts`); carries did-you-mean suggestions |
| `W_HIGHLIGHT_OVERUSE` | warn | More than two `==highlights==` in one section (prose plus the inline-Markdown fields of its blocks) |

The lints that are not schema checks (`lintGenericLabels`, the prose, inline-styling, density, graph, link, and template-echo lints) run through one `lintDocument()` in core, which both `chiltepin check` and Studio call. `chiltepin review <file>` runs every check, renders each block in light, dark, phone, and print, measures cut and overlapping text, and writes a contact sheet.

Uniform shape: `{ file, line?, level, code, message, value? }`.

## TTY-awareness in the CLI

Pure functions do the work and return `{ diagnostics, exitCode }`. The UI layer just formats:

- **TTY interactive** → Ink renders a colored diagnostics table.
- **Non-TTY / CI / `CHILTEPIN_PLAIN=1`** → plain `file:line  level  code  message — value` lines.
- **`--json` on `check`** → JSON to stdout; Ink is bypassed entirely.

The top-level always `process.exit(code)` after `waitUntilExit()`.

## Shipped seams and remaining extension points

The renderer covers all canonical block types. Several of the original post-v1 seams have since shipped as workspace packages:

- **The authoring skill** — one copy, at `skills/chiltepin/` (SKILL.md + reference/), laid out so `npx skills add jdiejim/chiltepin` installs it into any agent. The CLI build copies it to `packages/cli/templates/skill/` (gitignored) for `chiltepin skill`. The block field contract is not written by hand: `chiltepin block <type>` prints it from the zod schema (`core/src/blocks/contract.ts`) — including the "Field notes" a schema carries with `.describe()` for a free-string field whose vocabulary the renderer owns (a block node `kind`, a group `color`) — plus one hand-kept table of terse-form hints that a test pins to the grammar table in `normalize.ts`.
- **`chiltepin-studio`** — the visual editor served by `chiltepin studio` (see the layering rules above).
- **Importers** — `packages/core/src/import/`: pure external-source importers (OpenAPI → whole docs, CSV → `table`/`statustable`/`chart` fences) plus the small importer registry (`IMPORTERS` / `importerForFile`). Exposed as `chiltepin sync openapi` / `chiltepin sync csv` and the studio’s drag-drop / “Import…” flow.

Still clean extension points, not "TODO" stubs:

- **`@chiltepin/react`** — React component wrapping the HTML renderer. Dropped from v1 per design choice. To add: a new workspace package depending on `core` + `render`, exporting a single `<ChiltepinDocument>` that uses `dangerouslySetInnerHTML`.
- **Node-level references** — refs into a block's internals (e.g. `doc#id::field`). The current resolver targets whole blocks only; the `REF_RE` regex and `RefGraph` shape would extend cleanly.
- **Visual diff in CI** — snapshot rendered HTML on PRs and surface changes. SVG geometry is already deterministic, so this is a build-then-compare step.

## Tooling

| | |
| --- | --- |
| Workspace | pnpm |
| Build | tsup (ESM) |
| Tests | Vitest across core, render, studio, and the CLI |
| Lint | ESLint flat config + typescript-eslint |
| Format | Prettier |
| Release | Changesets |
| CI | GitHub Actions (`pnpm verify`, package exports, and published types; release repeats these checks before publishing) |

Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. No `any` in public APIs.
