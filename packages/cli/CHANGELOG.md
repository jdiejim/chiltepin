# chiltepin

## 0.47.8

### Patch Changes

- Updated dependencies [4ddfd9a]
  - chiltepin-core@0.25.0
  - chiltepin-render@0.34.0
  - chiltepin-studio@0.16.4

## 0.47.7

### Patch Changes

- a2a58b4: The skill install hint drops `-g`; the skills CLI rejects it with `-y`.

## 0.47.6

### Patch Changes

- 0e20b4a: Every `npx chiltepin` hint in the CLI, README, and skill pins `@latest`, so a stale npx cache never runs an old renderer.

## 0.47.5

### Patch Changes

- Updated dependencies [eea0f64]
  - chiltepin-render@0.33.3
  - chiltepin-studio@0.16.3

## 0.47.4

### Patch Changes

- Updated dependencies [8dc104c]
- Updated dependencies [487b111]
- Updated dependencies [c0b7e3e]
  - chiltepin-render@0.33.2
  - chiltepin-studio@0.16.2

## 0.47.3

### Patch Changes

- 7b9b6b2: The skill renders the HTML page after every clean check and hands back both the `.md` and the `.html` path.
- Updated dependencies [d712087]
- Updated dependencies [82cb733]
  - chiltepin-render@0.33.1
  - chiltepin-studio@0.16.1

## 0.47.2

### Patch Changes

- a4370ef: The install hint reads `npx skills add jdiejim/chiltepin -g -y`: no prompts, every detected agent.

## 0.47.1

### Patch Changes

- 7d6e6ac: npm keywords name the product category: documentation generator, AI documentation generator, AI docs.

## 0.47.0

### Minor Changes

- 32b6304: Avodado is now **Chiltepin**. New package names: `chiltepin` (CLI, binary `chiltepin`), `chiltepin-core`, `chiltepin-render`, `chiltepin-studio`. The skill installs with `npx skills add jdiejim/chiltepin`. The config file is `chiltepin.config.*`; the old `avodado.config.*` still loads with a warning for now, and an existing `.avodado-build.json` manifest is read once and replaced. The `avo` binary and the `@avodado/*` packages are deprecated on npm with a pointer here. New logo and favicon.

### Patch Changes

- ab59b91: Clarify skill scope, prefer the project's CLI version, and report actual validation results.
  Refresh the CLI README with example screenshots and fix npm image and documentation links.
- Updated dependencies [32b6304]
  - chiltepin-core@0.24.0
  - chiltepin-render@0.33.0
  - chiltepin-studio@0.16.0

## 0.46.0

### Minor Changes

- e70ec5b: `avo mcp` and the `@avodado/mcp` package are removed. Agents get everything through the skill (`npx skills add jdiejim/avodado`) and the CLI; tools with only a system-prompt box use `avo skill`.

## 0.45.2

### Patch Changes

- 9429a67: The npm page shows the repo README (with the animated demo and the eval numbers) instead of the old install notes, and releases carry npm provenance.

## 0.45.1

### Patch Changes

- Updated dependencies [ee53ca2]
  - @avodado/studio@0.15.1

## 0.45.0

### Minor Changes

- 45e3ff8: Thirteen new block types and a new family. **Quality & audits**: `audit` (severity-ranked findings with evidence, fix, owner, status and a count strip), `checklist` (pass / fail with evidence, `"[pass] item — evidence"` terse form, pass rate derived), `perfbudget` (budgets vs measured, over / near / ok derived), `percentiles` (p50 … p99 · max per row on one axis with the SLO rule), `threatmodel` (dfd shapes inside dashed trust boundaries plus a STRIDE threats table). **UML**: `usecase` (actors, system boundary, include / extend / generalize), `pkg` (package diagram with dashed dependencies), `timing` (lifelines stepping through states over time). **ML**: `neuralnet` (layered network with unit counts and activations), `modelcard`. **Deck shapes**: `chevrons` (process strip with the current phase), `roadmap` (themes × periods with status chips and a now rule), and `mindmap`. `chart` gains six kinds: `pie`, `histogram`, `bell` (normal curve with σ bands and z-scored markers), `boxplot`, `pareto` (80% rule), `bullet`. The skill gains `reference/blocks/quality.md`, entries for every new block, and `reference/patterns-design.md` (the 23 GoF and the common architectural patterns mapped to block stacks); the generation eval gains 15 scenarios for them. 107 block types across 13 families.
- 45e3ff8: Dark is the look.
  - The render skin's bare `:root` now carries the dark set — deeper surfaces (`paper #15171d`, `paper-2 #1d2028`), the rust accent lifted, and a new drawing **well**: every diagram stage paints a step below its frame with the dot grid and a faint centre glow inside a hairline inset. Light is the explicit choice (`data-theme="light"`) and the print look, always.
  - New `colorScheme` in `avodado.config.json`: `dark` (default), `light`, or `system` (the reader's OS chooses). `avo html`, `avo slides`, `avo build`, `avo serve`, and Studio's site mount honour it; `renderDocument`, `toSlides`, and `buildSite` take a `colorScheme` option.
  - Studio's chrome is dark-first too and follows the same setting, so the canvas and the app never disagree. `/api/meta` reports the scheme.
  - `LIGHT_SET`, `DARK_SET`, and `systemSchemeCss` are exported from `@avodado/render` for hosts that compose their own page.

- 45e3ff8: One-command install and a schema-derived block reference.
  - The authoring skill lives once, at `skills/avodado/`, laid out so `npx skills add jdiejim/avodado` installs it into Claude Code, Cursor, Codex, OpenCode, and 70+ agents. The skill runs the CLI through `npx -y avodado`, so nothing has to be installed in a project.
  - New `avo block [type]`: every block on one line (no argument), or one block's fields, enums, terse one-line forms, and a validating example — generated from the zod schema (`blockContract` / `formatBlockContract` in `@avodado/core`), so the reference can never drift. `--json` for the structured form. The hand-written `reference/blocks/contract.md` is gone; family files are short selection sheets.
  - `SKILL.md` is a 120-line fast path: pick, `avo block`, write, `avo check --json`, fix by code, two rounds maximum, handoff receipt.
  - Removed: `avo explore` (tour, design patterns, compare, catalog), `avo install <tool>` and the per-tool adapter templates, `avo pptx` and Studio's PowerPoint export, the `avo init` wizard and `--scope`. `avo init` now writes only `avodado.config.json` and the two starter docs. `avo demo` stays.
  - The MCP server embeds the skill from `skills/avodado/`.

- 45e3ff8: Vary the lens. A new `W_LENS_REPEAT` warning fires on the third `callout` in one document and on the fourth block of any other structural type (tables, code, and one-per-item blocks such as `endpoint` and `userstory` are exempt), naming the block that usually fits instead. The skill gains the matching rule. `swimlane` takes lane labels instead of indices, derives columns from the links when `col` is omitted, draws `phases` bands, accepts dashed and error links, a `note` and one `accent` step, and a terse step line `id: Label · Lane`. `code` gains `highlight` line ranges, `lines` with `start`, `caption`, `cols` for a snippet grid, `kind: compare` for before / after, and `wrap`. The README is rewritten around what the tool does today, with the eval numbers and a rendered hero.

### Patch Changes

- 45e3ff8: Repair the unquoted-comma trap instead of reporting it. A single-line `{ … }` map whose cell has no key of its own (`label: Hold as BACKORDERED, email ETA`, `value: 1,000,000 followers`) is folded back into the field before it on the source line, before YAML parses it, so the text survives exactly. `E_PARSE_YAML` now says what to do for a `[ ]` inside a row cell and for an inline map that does not close on its line. A terse line whose text holds a colon (`name type required — Sum: lines plus tax`) is rescued from the single-pair map YAML makes of it. The skill gains `reference/patterns.md`: twelve messaging and event patterns (pub/sub, competing consumers, partitioned streams, backbone, outbox, dead-letter and retry, CQRS, event sourcing, saga, scatter-gather, backpressure and circuit breaker, CDC and webhooks, idempotency), each as a block stack with its trap; the generation eval adds seven scenarios for them.
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
  - @avodado/core@0.23.0
  - @avodado/studio@0.15.0
  - @avodado/render@0.32.0

## 0.44.0

### Minor Changes

- 430ba0b: CLI safety: no silent data loss, no stale site, no unreadable document called clean, no anonymous render crash.

  **A command never destroys a file you wrote.** `avo sync openapi|csv|sql|dbml|prisma --out` used to overwrite the target and print a checkmark; it now refuses, names the file, and names `--force`. The same rule covers every command that writes to a path you named: `avo new -o`, `avo block -o`, `avo template -o`, `avo design <slug> -o`, and `avo skill -o` never replace an existing file, while the export commands (`avo html|slides|pdf|pptx`, and the gallery writers `demo` / `catalog` / `compare` / `design -p -o`) replace a file only when the path already carries the extension they produce — re-exporting `report.html` is the normal loop, writing HTML over `notes.md` is not. Each of those commands gained a `--force` flag. `avo init` already skipped existing files and is unchanged; `avo build` owns its output directory and is covered by the manifest below.

  **`avo build` prunes.** It records what it generated in `dist/.avodado-build.json` and, on the next build, removes exactly the files that manifest lists and this build no longer generates — so a doc deleted from `docs/` stops being served. Nothing else is touched: a `CNAME`, an `assets/` folder, or any other file you placed in the output directory was never in the manifest. An output directory with no manifest (built by an older Avodado) is left completely alone, with a one-line note; pruning starts from the next build.

  **A file that is not UTF-8 is reported, not validated.** `avo check` used to pass invalid bytes and UTF-16 files clean, silently validating replacement characters. It now emits `E_ENCODING` naming the file and the line. A UTF-8 byte order mark is stripped instead of pushing the first fence off line 1. Symlinks under the docs root are no longer followed, and the same file reached by two paths loads once — a `docs/loop -> .` cycle used to invent dozens of duplicate-id errors.

  **A renderer crash names its document.** `avo build` reported a renderer throw as a bare `Invalid string length` with no file, line, or block type. Every render is now guarded per document: the failure becomes an `E_RENDER` error that names the file, the line, and the block (found by re-rendering each block on its own), the failed document gets a placeholder page so its URL keeps working, every other document still builds, and the build exits 1. `avo html|slides|pdf|pptx` prefix the same attribution onto their error. `@avodado/core` adds the `E_ENCODING` and `E_RENDER` codes to the diagnostic taxonomy.

- 02bc78b: One look. Theme presets are gone: the editorial skin is the single look for every export, and it follows the reader's OS light/dark setting. Removed: `avo theme` (and `avodado.theme.json`, `.avodado/themes/`, `~/.avodado/themes/`), the theme step in `avo init`, the `theme` line in the bare `avo` status, the Studio theme panel with its `/api/theme` route and `/api/meta` theme fields, and the `theme` parameter of the MCP `render_document` tool. A leftover `theme` key in `avodado.config.json` is ignored silently. `@avodado/render` keeps `ThemeName` as the single name `textbook` (label `Editorial`), `themeStyle()` returns `''`, rendered pages no longer stamp `data-theme` on `<html>` (the `[data-theme="dark"]` CSS stays so a host page can force dark), and `themeVars` remains an internal `:root` override with no user surface.

### Patch Changes

- 2b88a17: Step-through builds for decks. Diagrams with a natural order now mark it: `sequence` (messages and frame `open` / `else` markers in document order; an activation bar arrives with the message that opened it; the step list follows the diagram), `flow` (a topological walk from `start`, each edge with the node it leads to), `state` (transitions in document order, label and table row with the arrow), `saga` (steps left to right, then the compensations from the failure point back), `spans` (bars by `start` across lanes), `steps` and `timeline` (items). The renderer emits `data-reveal="n"` on the group that appears at step n (`svg/reveal.ts` › `revealAttr`); the attribute is inert everywhere except the deck. In `avo slides` output, → / Space / PageDown / the Next button reveal one step at a time before the deck advances, earlier steps stay, and the step just revealed takes the accent for that moment (the presentation-time exception to the one-accent rule); ← / Backspace / PageUp walk back one step, then one slide. A slide reached backwards, by the jump menu or by URL hash shows its build complete in its normal rendering; the hash keeps the slide index only. Builds are announced through an `aria-live` region ("Step 3 of 18"); `prefers-reduced-motion` drops the fade. Nothing is hidden by the markup: without JS, in print, and on a page the diagram is whole. Opt a slide out with the `{nobuild}` heading marker (`## Title {nobuild}`), stripped from the title like `{top}` / `{split}` — `@avodado/core` gains `readBuildMarker` beside the other marker readers. Studio bundles the renderer, so Present mode gets the same builds.
- 6498446: Two cloud & microservices blocks. **`spans`** draws a distributed-trace waterfall: one lane per service (first-appearance order, with a chip for its dominant span kind), a nice-number time axis in `unit` (`ms` · `s` · `us`), and one bar per span placed by `start` and sized by `duration` on that shared scale — bars lighten with nesting depth (ink → muted → paper-2), a thin connector joins each child to its parent, the critical path (root, then the longest child at every hop) takes the accent, and `error: true` draws a negative outline plus an `ERR` chip. `attrs` and `note` list under the drawing; a name that cannot fit its bar follows the duration label instead of being cut. Terse item: `service/id: name · start · duration [· parent]`. Density warns past 40 spans. **`rollout`** draws a progressive-delivery strip: one paper card per stage with a `STAGE n` eyebrow, the name, the status chip (done = paper-2 fill · current = accent outline · next = dashed · blocked = negative), an ink traffic bar, the hold `duration`, and the note; each stage's `gate` rides as a chip on the connector to the next card; `rollback` is the footer line; `strategy` (`canary` · `blue-green` · `rolling` · `feature-flag`) shows in the eyebrow. Terse stage: `"[status] traffic% · name · duration — gate"`.
- b81194c: Pilot of the editorial skin (`packages/render/DESIGN.md`) on four blocks: `sequence`, `flow`, `block` (grid and layered, all presets) and `erd`. Meaning now travels through shape, stroke weight, dash and eyebrow chips (`SVC`, `DB`, `EXT`, `ENTITY`, `AGGREGATE ROOT`, …); each diagram spends colour on one accent the renderer picks from the data (the caller's final response, the happy-path exit, the entry gateway, the aggregate root) and on `negative` for real errors. Every figure gets a legend strip listing only the encodings it used. Shared chrome moves with it: role tokens (`--paper`, `--ink`, `--muted`, `--accent`, …) with a dark set on `[data-theme="dark"]` and `prefers-color-scheme`, the legacy token names kept as aliases, five type-role classes (`.t-name` … `.t-badge`), a quiet frame (dot-grid `paper-2` ground, hairline border, plain eyebrow instead of the family pill), and figures that never upscale (`--scale` lets decks enlarge them). The other 86 renderers are not restyled yet and keep rendering through the aliases. Studio bundles the renderer, so it ships the same skin.
- 6498446: `block` learns deployment topology. Groups nest by declaration: `groups[].parent: <id>` places a zone inside a region and a subnet inside the zone; the renderer draws parents first and steps each child in 8px with its own eyebrow tab (three levels read), and `avo check` warns (`W_GROUP_NESTING`) when a child's cells fall outside its parent or the `parent` id resolves to nothing. Nodes take `replicas: N` — from 2 up the node draws as a stacked card (two offset paper cards behind) with a `×N` chip, and the legend names it. `preset: k8s` frames a Kubernetes namespace map: `ingress` (the entry, so the accent), `service`, `deployment`, `pod`, `configmap`, `secret`, `job` / `cronjob`, `node` and `namespace` get chips, shapes and glyphs. A new cloud glyph set (`svg/glyphs.ts`) draws one 14px single-stroke `muted` path per kind — function, bucket, queue, topic, cache, db, cdn, lb, gateway, pod, cluster, user, browser, mobile, cron, ml, secret, config — with a generic box for everything else. `cluster` follows the family's accent rule: the single `gateway`-kind service, when exactly one exists. Documents without `parent` or `replicas` render byte-for-byte as before.
- 6498446: Two async-contract blocks. `eventcontract` is the twin of `endpoint` for events: `name`, `version`, `channel`, `summary`, `producers` / `consumers`, `delivery` (at-least-once · at-most-once · exactly-once), `ordering` (none · per-key · global), `key`, `retention`, payload `schema` and `headers` (terse `name type [required] — desc`), an `example`, `errors` (terse `Name — when`), and a `note`. It renders as a card in the skin: an `EVENT · v2` eyebrow, a channel chip, a PRODUCERS → CONSUMERS strip of mono chips, the delivery facts as outlined word chips, the payload table with the partition-key row marked `#` (the card's one accent) and optional fields `?`, and the example on the code surface. `saga` draws a distributed transaction: `steps` (terse `id: Name · service · compensate`, or `· service · action · compensate`) as paper cards left to right with the owning service as a chip, the compensation under each as a dashed card, and `failAt` naming the step that fails — it takes the one accent and a `FAILED` chip, earlier steps read `COMPENSATED`, later ones `SKIPPED` on the inactive fill, the forward arrows past it turn dashed, and a `negative` dashed compensating flow runs right to left back to step 1; `mode: orchestration` adds a coordinator band on top fanning out to every step. Both blocks carry data paths for Studio, a legend (saga), a density budget of 12 saga steps, catalog templates, and skill reference entries.
- 5dfac44: Accessibility and editing gaps: named diagrams, non-text contrast, nested group
  padding, and a draggable `saga`.

  **Diagram SVGs announce what they contain.** Every diagram carried a generic
  `<title>` ("Sequence diagram"), which tells a screen-reader user only what kind
  of picture they cannot see. Each now builds its name from its own data —
  `Sequence diagram: /orders, 3 messages between 3 actors`,
  `Flowchart: Checkout, 3 steps`, `Entity relationship diagram: 2 entities` — and
  carries it on both `<title>` and a matching `aria-label`, with `role="img"`.
  Wired through `sequence`, `flow`, `erd`, `block` (grid and layered), `c4`,
  `spans`, `saga`, `state`, and `dfd`.

  **Meaningful lines reach 3:1.** `contrast-audit.mjs` gained a `--nontext` mode
  for WCAG 1.4.11: it measures every stroked SVG shape that carries meaning — a
  node outline, a chip outline, an arrow, a border that encodes state — against
  the surface behind it, and skips decoration (`data-decorative`, plus strokes
  that paint exactly what is already behind them or their own fill). The showcase
  went from 96 failures to 3. `--rule-solid` darkens to `#807b70` (light) /
  `#787f95` (dark) so a secondary node, a group panel and a chip outline are
  visible; `--series-1` and `--series-3` darken a step so every chart series
  clears 3:1. Gridlines, row separators, glyph silhouette detail and knockout
  gaps are marked `data-decorative` instead of darkened. Wireframe input and card
  outlines move from the decorative hairline to `--rule-solid`. Text contrast is
  unchanged at zero failures.

  **Nested groups no longer clip.** `flow`, `dfd`, `state`, `c4` and `felogic`
  accept a group `parent` but did not grow their diagram padding for it, so a
  nested group flush against the top edge lost its tab. All five now wire
  `nestingPads`; `felogic` also draws declared nesting (it previously ignored
  `parent`). Documents with no `parent` render byte-identically.

  **A saga can be reordered in Studio.** A saga step's position IS its array
  index — the schema has no `col`/`row` — so `saga` joins the order-based drag
  set: dragging a step (or its compensation card) along the row splices it to a
  new index in one undo step, and the arrow keys do the same one step at a time.

- 6498446: feat(erd): the ERD overhaul — a full relational model in, a layered auto-layout out; DBML / Prisma fences and `avo sync sql | dbml | prisma`
  - **Schema (additive; every existing `erd` doc is unchanged).** Columns gain `unique`, `nullable`, `default`, `index`, `enum: [..]`, `ref: table.column`, `note`; entities gain `kind` (`table` · `view` · `enum` · `external`), `schema`, `note`, `indexes: [{ columns, unique?, name? }]`; relations gain `identifying`, `fromCol`, `toCol` and the cards `0..1` / `0..N`; the block gains `groups` (schema panels), `enums` (value cards) and `dir: LR | TB`. The terse column string grows: `email text unique !null default=now()`, `user_id uuid fk -> users.id`, `status enum(open,closed)`; the terse relation reads every Mermaid crow's-foot end and a `..` body for non-identifying (`users ||..o{ sessions: opens`, `orders ||--o| payments`).
  - **Renderer.** Layered auto-layout ranked by relation adjacency: the aggregate root centred, its neighbours fanned out by depth on both sides, a join table between its parents; `groups` / shared `schema` as non-overlapping `paper-2` panels with an eyebrow tab; `enums` as cards in a side column; orthogonal field-level routes with one gutter slot per relation, `1` / `N` / `0..1` letters at each end, identifying solid, non-identifying dashed, labels on a paper mask. Rows carry `#` `→` `U` `?` `⌘` markers, the FK target and default after the type, enum values as a sub-row; kind chips `VIEW` / `ENUM` / `EXT` (dashed). Nothing is truncated any more — cards grow. The legend lists exactly the markers used. Density budget: 20 entities / 60 columns.
  - **Input dialects.** A ` ```dbml ` fence and a ` ```prisma ` fence parse into an `erd` (`sourceType: 'dbml' | 'prisma'`), with `E_PARSE_DBML` / `E_PARSE_PRISMA` on a bad line; an edit rewrites the fence to ` ```erd `. The Mermaid `erDiagram` converter keeps `UK` (→ `unique`), column comments (→ `note`) and `..` (→ `identifying: false`). New `dialects.ts` is the one place that knows the dialect tags (`isDialectSource`, `convertDialect`, `dialectBodyYaml`).
  - **`avo sync sql | dbml | prisma <file> [--out doc.md] [--title] [--id]`** converts a schema file to an `erd` fence (stdout) or a minimal doc validated by `avo check`. SQL DDL reads `CREATE TABLE` (inline and table constraints, Postgres / MySQL / SQL Server quoting), `CREATE INDEX`, `ALTER TABLE ADD`, `CREATE TYPE … AS ENUM`, `CREATE VIEW`, `COMMENT ON`. The importer registry claims `.sql` / `.ddl` / `.dbml` / `.prisma`; Studio's drop-to-import inserts them as an `erd`.
  - Skill: `blocks/data-model.md` documents the full grammar; `reference/mermaid.md` becomes "Input dialects" (Mermaid, DBML, Prisma). New example `docs/examples/data-model.md`.

- d1a5570: feat(core): Mermaid input dialect — a ` ```mermaid ` fence parses into a typed block
  - A ` ```mermaid ` fence whose first line is `sequenceDiagram`, `flowchart` / `graph`, `erDiagram`, `stateDiagram` / `stateDiagram-v2`, or `pie` parses into the matching `sequence`, `flow`, `erd`, `state`, or `chart` (donut) block with `sourceType: 'mermaid'`. The converter (`core/src/mermaid/`, `convertMermaid`) emits exactly the data the block schema accepts, so validation and rendering are identical to a YAML block. Any other Mermaid grammar (gantt, classDiagram, mindmap, …) stays prose, exactly as before, and is never flagged as a suspect fence.
  - New diagnostic code `E_PARSE_MERMAID` (error, same shape as `E_PARSE_YAML`, positioned at the offending body line) for a line outside the supported subset. A Mermaid fence never emits `W_ALIAS_TYPE`.
  - `replaceBlockBody` on a Mermaid segment rewrites the opening fence to the canonical block tag, so an edit from Studio or the MCP writes YAML under ` ```sequence ` (etc.), never YAML under ` ```mermaid `. New `editableBodyYaml(seg)` returns the YAML an editor starts a structured edit from (bare-text and Mermaid bodies canonicalized). Studio uses it for its sheet and direct edits.
  - New skill reference `reference/mermaid.md` (installed by `avo init` / `avo install`, embedded in the MCP skill) documents the exact subset, what is ignored, and what is lost; `SKILL.md` gains the `E_PARSE_MERMAID` row. New catalog example `docs/examples/mermaid-dialect.md`.
  - Exports: `MERMAID_SOURCE`, `MERMAID_KEYWORDS`, `detectMermaidKind`, `convertMermaid`, `mermaidBodyYaml`, `editableBodyYaml`.

- 3a8d480: `sequence` is now a complete sequence diagram. Core: `messages[]` items are a union of a message (now with `activate` / `deactivate`), a frame open (`{ frame: alt | opt | loop | par | break | critical, label? }`), a frame else (`{ else: label }`) and a frame end (`{ end: true }`); terse forms `- alt: token valid`, `- else: expired`, `- end`, and `A -> +B` / `B --> -A` activation signs; a new `W_SEQ_FRAME` warning for a stray `else`/`end` or an unclosed frame; the density budget counts messages only; the Mermaid dialect keeps `alt`/`opt`/`loop`/`par`/`critical`/`break` … `else`/`and`/`option` … `end` and the `+`/`-` activation suffixes instead of dropping them. Render: variable row heights, UML frames (tab, `[guard]`, dashed else divider, nested insets) drawn under the lifelines, explicit or inferred activation bars (a bar opens on an incoming call and closes on its reply), real self-message loops, note boxes beside one lifeline or over two, and frame dividers in the step list. Studio: the message form and inline editor pick the union arm that matches the item, and step numbers skip frame markers.
- 5dfac44: Stamp the real CLI version into installed skills, and complete the showcase.

  `avo init` / `avo claude` matched the package name `@avodado/cli` when reading
  the CLI's own version, but the package is named `avodado`. Every installed
  `SKILL.md` therefore carried `version: 0.0.0`. The version now comes from the
  same resolver as `avo --version` and the studio's `/api/meta`, which accepts
  both spellings. The studio fallback page also told the reader to reinstall
  `@avodado/cli`; it now names `avodado`.

  The showcase (`docs/reference/showcase.md` and the `avo demo` template) claims
  one example of every block type but had none for `spans`, `saga`,
  `eventcontract`, or `rollout`. All four are added beside their family
  neighbours.

- d5e8928: Skill: `SKILL.md` is now the decision path only (procedure, question table, design and prose rules, file map) at 18 KB, down from 29 KB. The mechanics moved to two reference files read at the step that needs them: `reference/writing.md` (block anatomy, terse items, YAML traps, `doc#id`, naming) for step 6 and `reference/check.md` (commands, every error and warning code with its fix) for step 7. Both install with `avo init` / `avo install` and embed in the MCP skill. Adds `evals/selection` and `evals/write`, the two agent evals used to measure the change.
- f8df705: Editorial skin, group D — everything around the rendered document. The `avo build` site chrome (sidebar, index page with its groups, cards and TLDR, the Doc | Slides toggle, the deck's back-link) and the slide deck (stage, header, tracker, footer, cover, bottom nav) now draw only from the skin's role tokens (`--paper`, `--ink`, `--muted`, `--soft`, `--rule`, `--accent`, `--link`): Inter body, mono eyebrow labels, hairlines, no shadows, no filled pills; index tags and the deck tracker are outlined mono chips. Both stamp `data-theme` on `<html>` when a theme is chosen explicitly, so it never mixes with the reader's system dark mode. Studio's `--stu-*` token values align with the skin (paper `#f7f6f2`, ink `#1f2430`, muted `#4f5868`, hairline `rgba(31,36,48,.14)`, accent `#b04a25`; navy stays for controls) in both its light and dark sets, and the canvas now knows when the document follows the system dark scheme so selection and hover outlines read on either surface. `avo theme` files map onto the skin: colors emit the role names first (`paper`, `ink`, `muted`, `soft`, `rule`, `accent`, `link`, `negative`) with the legacy names (`--navy`, `--charcoal`, `--highlight`, `--blue`, …) as aliases of those roles; `primary`/`secondary` keep working. The contrast audit script takes `--root <selector>` to audit a whole page.
- Updated dependencies [430ba0b]
- Updated dependencies [2b88a17]
- Updated dependencies [6498446]
- Updated dependencies [b81194c]
- Updated dependencies [6498446]
- Updated dependencies [6498446]
- Updated dependencies [5dfac44]
- Updated dependencies [6498446]
- Updated dependencies [430ba0b]
- Updated dependencies [9528f0c]
- Updated dependencies [d1a5570]
- Updated dependencies [02bc78b]
- Updated dependencies [430ba0b]
- Updated dependencies [3a8d480]
- Updated dependencies [d5e8928]
- Updated dependencies [f8df705]
- Updated dependencies [f8df705]
- Updated dependencies [f8df705]
- Updated dependencies [f8df705]
- Updated dependencies [2b88a17]
- Updated dependencies [76ec7dd]
- Updated dependencies [430ba0b]
  - @avodado/core@0.22.0
  - @avodado/render@0.31.0
  - @avodado/studio@0.14.0

## 0.43.0

### Minor Changes

- e1f3a0e: feat(cli): avo audit (evidence-based doc recommendations, graphify adapter) + /avo Claude Code command
  - `avo audit [path]` scans the codebase (graphify graph when present, built-in extraction otherwise) and emits an evidence report with rule-derived doc recommendations — human table and `--json` (contract version 1). It never writes docs.
  - New `/avo` slash command for Claude Code, installed by `avo init` (claude tool) and `avo install claude` at `.claude/commands/avo.md`. Subcommands: `audit [path] [--full]` (run the audit, pick recommendations from a multi-select menu, author the selected docs via the avodado-docs skill with the audit's citations as the reading list, then `avo check`), `doc <target>` (author one doc about a path, module, or feature), and `check` (validate and fix).

- e1f3a0e: feat(core,cli): per-type density budgets — `avo check` now warns when a diagram should be split
  - New core lint `lintDensity(doc, file)` and exported `DENSITY_BUDGETS` map: conservative per-type complexity caps (sequence >8 actors or >24 messages; flow/dfd >24 nodes; state >16 states; c4/block/felogic/frontend >20 nodes; erd >12 entities; tree >40 nodes; graph >30 nodes; cluster >16 services; archmap >8 areas; kanban >8 columns; timeline >20 items; journey >10 stages). Pure counts, no heuristics; a block at exactly the cap passes.
  - New diagnostic code `W_DENSE_BLOCK`, wired into `avo check` beside the prose lint. Always a warning with a per-type split suggestion — it never affects the exit code, and `--strict-prose` does not escalate it.

- e1f3a0e: `avo check` now enforces the on-disk convention with `W_DOC_CONVENTION` warnings: doc filenames under the docs root must be kebab-case slugs, and docs may sit at most one group level deep (`docs/<area>/<doc>.md`). Files outside the docs root are not checked. The warnings never gate the exit code and no flag escalates them. `avo init` documents the layout in its config template, its summary line, and the skill's `reference/organizing.md` ("Where files live"). `@avodado/core` adds the `W_DOC_CONVENTION` code to the diagnostic union.
- 65ec84b: Export size presets and accessibility fixes.

  `avo html` and `avo pdf` accept `--size sm|md|lg|xl` (720 / 960 / 1280 / 1600 px page width). Without the option, output keeps the default width (1180 px content column; A4 PDF page). For PDF, the preset sets the page width with portrait A-series proportions.

  Accessibility: harvey rating balls now carry `role="img"` and an `aria-label` ("N of 4"). Theme tokens that failed WCAG AA text contrast were darkened: the muted-text gray in the base palette (`#8a8475` → `#6f695b`), `minimal` (`#888888` → `#6e6e6e`), and `soft` (`#8b93a7` → `#646c7e`); the accent in `teal`/`soft` (`#f59e0b` → `#b45309`) and `slate` (`#0d9488` → `#0d6d66`).

- e1f3a0e: feat: new `fishbone` block type (88 total) — cause & effect (Ishikawa) analysis. One `effect` at the head of a horizontal spine, 1–8 `causes` as bones alternating above and below, up to 8 `items` (specific causes) ticked along each bone. The renderer spaces bones by label width, so long labels grow the diagram instead of overlapping; text stays horizontal and wraps with an ellipsis past four lines. Studio and MCP pick up the new type via the bundled core/render and the regenerated embedded skill.
- e1f3a0e: feat(core,cli): STE-informed prose linter — `lintProse` in core, wired into `avo check` with `--strict-prose`
  - `@avodado/core` exports `lintProse(doc, file, opts?)` and `PROSE_CHECK_CODES`. Six checks, all level `warn`: `W_PROSE_LONG_SENTENCE`, `W_PROSE_LONG_PARAGRAPH`, `W_PROSE_PASSIVE_STEP`, `W_PROSE_TENSE`, `W_PROSE_FILLER_OPENER`, `W_PROSE_TERM_DRIFT`. Glossary terms gain an optional `avoid` list; a listed word in the doc's prose reports term drift.
  - `avo check` runs the prose lint on every doc, next to schema validation and reference resolution. Findings surface as ordinary diagnostics (table, `--json`, code frames) and stay warnings — exit 0. The new `--strict-prose` flag escalates `W_PROSE_*` to errors and exit 1. `avo build` is unchanged: prose warnings never fail a build.
  - `@avodado/render` renders the glossary `avoid` field as "not:" chips; `@avodado/studio` bundles core/render and is patched to pick both up. `@avodado/mcp` embeds the updated skill reference.
  - Block text fields (`description`, `lede`, `body`, `note`, `subtitle`, `summary`) are exempt from `W_PROSE_LONG_PARAGRAPH` — fields carry complete information, and a sentence-count cap pressures fact deletion; markdown paragraphs, `prose` texts, and `steps` item text keep the cap, and fields keep every form check.

- 65ec84b: The rich site index is now on by default: `avo build`, `avo serve`, and the studio Site mode group the doc map by tag, prepend the TLDR digest, and render the cross-reference graph without a flag. When most tags are unique the index falls back to the flat card grid. Pass `--no-rich-index` (or set `richIndex: false` in the config) to keep the plain index.
- e1f3a0e: `avo build --rich-index` (also on `avo serve`, or `richIndex: true` in the config) upgrades the generated site index: a project TLDR built from doc meta and counts, the doc map grouped by tag with the top folder as fallback, and the doc-to-doc cross-reference graph rendered as a real `graph` block with a link legend. Off by default — without the flag the index does not change.

### Patch Changes

- e1f3a0e: chart `kind: scatter` gains numeric-axis `points` (x/y, `size` bubbles, per-point labels with collision nudging) plus `guides` (dashed x/y reference lines and TL/TR/BL/BR quadrant labels) and `xLabel`/`yLabel` axis titles; `tree` gains `variant: org` (top-down tidy org chart, node `role` under the label). Both additive — existing `labels`+`series` scatter and default/issue trees render byte-identically.
- e1f3a0e: docs(skill): rewrite authoring skill as toolkit (question→primitive table, selection procedure, recipes, STE style guide); rewrite demo/template prose
  - The skill gains two reference files: `reference/recipes.md` (composition recipes) and `reference/style-ste.md` (STE-informed writing rules). Both join `SKILL_REFERENCE_FILES`, the `avo skill` stitch, and the MCP embedded skill.
  - SKILL.md is rewritten around a question→primitive table and a 7-step selection procedure; the trigger-word playbooks and the flat glossary table are gone.
  - Demo, template, and prefilled doc-template prose (`@avodado/core` docTemplates) follow the new prose rules: no restating the block, short factual sentences.
  - `@avodado/studio` bundles core/render, so it is patched to pick up the rewritten doc templates.

- e1f3a0e: feat: two new block types (90 total) — `storymap` and `slopegraph`. `storymap` (planning) is a user story map: a `backbone` of 1–10 ordered activities across the top, 1–6 release `slices` as horizontal bands whose cards stack under the step they belong to; each slice must give exactly one cell per backbone step (validated), cards are strings or `{ title, tag }`. `slopegraph` (charts & overviews) is a ranked before/after comparison: `left`/`right` column headers, 2–20 items each drawn as one straight line between the two baselines, positioned by value on a shared linear scale; colliding labels are nudged apart deterministically and an `accent` highlights the lines that carry the story. Both types ship density budgets (backbone > 10 steps, items > 20 warn `W_DENSE_BLOCK`). Studio and MCP pick up the new types via the bundled core/render and the regenerated embedded skill.
- 2a7e00d: feat(studio): shell rebuild — rail navigation, one top bar, unified insert picker, surfaced validation, one theme panel, narrow layout
  - **Rail navigation**: a persistent left rail replaces the doc switcher and the
    Home "mode" — brand, doc search (⌘K), New doc, an "All documents" root view,
    docs grouped by folder with per-doc error dots, and a footer with Site ↗ and
    Settings (autosave lives there now). Narrow windows collapse it to a 52px
    icon strip; search opens the full rail as a drawer.
  - **Doc table**: "All documents" is a table (name · folder · edited · check
    status), most recently edited first, with a template-picker empty state.
  - **One top bar**: crumb · check chip · Library · Share ▾ (link, exports,
    site) · Theme · Present · one Save button with a plain status text.
  - **One insert picker**: the `/` command, the gap `+`, and the Library button
    open the same component (compact ↔ browse faces, one search, one footer).
  - **Docked block inspector**: the Edit Sheet presents as a right-docked panel
    at wide widths — the canvas stays visible and scrolls beside it, the
    selected card keeps its ring, and the in-panel preview is a toggle (the
    live document is the preview; the block updates on Done). All sheet
    semantics (draft, tabs, Cancel/Done, ⌘⏎, Esc) are unchanged.
  - **Validation surfaced**: per-block error badges + red rings on the canvas,
    the check chip opens a results popover whose rows deep-link to the block and
    field ("checked live" — diagnostics re-run on every edit), the review dialog
    shows an error-count line, the doc list / rail show per-doc status from the
    server's `errorCount`, and the All-documents view gets an aggregate chip
    whose popover lists the failing docs.
  - **One theme panel**: the Theme button opens a right-docked panel — theme
    cards (apply instantly) plus the customize form (the old generator), ending
    in one "Save theme" write.
  - **Narrow layout (≤820px)**: icon-strip rail with a drawer, a ⋯ overflow
    menu folding Library / Share / Theme / Present (check chip and Save stay on
    the bar), and the Edit Sheet presented as a bottom sheet (full width,
    rounded top, drag-handle affordance — same component and behavior).
  - **Kill list applied**: DocSwitcher, HomeView-as-mode, Site mode chrome, the
    HintBar and the one-time direct-edit hint (the contextual keybar + `?`
    overlay are THE hint surface, one dismissal key, legacy keys migrated), the
    gap-drop "new block" DnD branch, and stale `?`-overlay content (Site-mode
    claims removed; the `n` annotate chord and the current shell documented).

  `avodado` (the studio server) is patched for the shell: `/api/docs` now
  carries a per-doc `errorCount` (mtime-cached), which the doc table and rail
  status read.

- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [65ec84b]
- Updated dependencies [e1f3a0e]
- Updated dependencies [65ec84b]
- Updated dependencies [65ec84b]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [2a7e00d]
  - @avodado/core@0.21.0
  - @avodado/studio@0.13.0
  - @avodado/render@0.30.0

## 0.42.2

### Patch Changes

- Updated dependencies [4eceaec]
  - @avodado/core@0.20.2
  - @avodado/render@0.29.3
  - @avodado/studio@0.12.1

## 0.42.1

### Patch Changes

- Updated dependencies [6837e18]
  - @avodado/core@0.20.1
  - @avodado/render@0.29.2
  - @avodado/studio@0.12.0

## 0.42.0

### Minor Changes

- 61a3371: Templates are finished documents now, and there are eighteen of them.

  `avo template adr` used to hand you a form — `ADR-NNN`, `YYYY-MM-DD`, "what
  forces a decision here?". It now hands you a real decision record about
  idempotency keys on a payments API, with the forces that drove it, the sequence
  that shows the mechanism, three options weighed, the architecture, consequences,
  risks and a rollout. You edit a document instead of filling in a shape.

  **Seven new templates**, all written the same way: `migration-plan` (before/after,
  phases, the cutover runbook, rollback, risks), `threat-model` (scope, the data
  flow across the trust boundary, STRIDE threats, controls, tests),
  `service-overview` (the page you want at 3am — owner, architecture, SLOs,
  dependencies, common operations), `release-notes` (highlights, changelog,
  breaking changes, upgrade steps, deprecations), `test-plan` (scope, the case
  matrix, environments, suite status, exit criteria), `onboarding` (local setup,
  the code map, how a request flows, who to ask) and `status-update` (an SCQA
  summary, the numbers, workstreams, the decisions being asked for).

  Studio's picker gained a filter — searchable by name, description and the block
  types a template uses — and the hosted studio understands `?template=<name>`, so
  a link opens straight into a prefilled document with no picker in between.

### Patch Changes

- Updated dependencies [61a3371]
  - @avodado/core@0.20.0
  - @avodado/studio@0.12.0
  - @avodado/render@0.29.1

## 0.41.1

### Patch Changes

- Updated dependencies [ca204e7]
  - @avodado/studio@0.11.0

## 0.41.0

### Minor Changes

- 7f969a3: Two blocks a consulting deck opens and closes with, and three fixes to how a
  slide handles text. 84 → 86 types.
  - **`harvey`** — the rated comparison grid: options across the top, criteria
    down the side, a Harvey ball (0–4) for each judgement. The WEIGHTED footer is
    computed from the balls, so the column marked `recommend` and the arithmetic
    can be seen to agree. A row shorter than `columns` reads as _not assessed_
    rather than as a zero — different claims. Use `benchmark` for measured
    numbers, `harvey` for judgements.
  - **`scqa`** — the executive summary in Minto order: situation, complication,
    question, answer. Every field is optional but the order is fixed, which is
    the block's job; `answer` takes the filled card and `because` hangs the
    support beneath it.

  **Slides:** a block's `lede` used to vanish on a slide — it lives in the
  section head, which the stage hides. It now pins under the slide title as the
  supporting line of an action title, at a fixed size so the fitter can't shrink
  it with the exhibit. Body copy also moves to presentation sizes (19px prose,
  17.5px list items, 19.5px in a `{split}` message column) with the measure still
  capped, because long lines are harder to follow on a screen, not easier.

- f56bbac: The four pieces a consulting deck still needed. 86 → 87 types.
  - **`scenarios`** — base, upside and downside against the same drivers. Cases
    in columns, so reading across a driver row shows how much of the outcome
    hangs on that assumption; the base case is badged because every other column
    is read relative to it, and `outcome` gets its own emphasised row. A case
    that omits a driver renders `·` — silent about it, which is not the same as
    claiming no change.
  - **`tree` becomes a driver tree** when its nodes carry `value`. Each node
    shows its number and **its share of its parent** — p95 = capture (74%) +
    order write (16%) + the rest. No new block: values turn the hierarchy into
    arithmetic, the way `gauge` went into `chart`.
  - **`## Title {source: production traces, 14 Oct 2026}`** puts a source line in
    the slide footer, where every consulting exhibit carries one. It lives in the
    footer rather than under the block on purpose: the fitter scales the exhibit,
    and provenance that shrinks with it stops being readable.
  - **A deck tracker.** Two or more `divider` bands and the slide header grows a
    "you are here" strip — the parts of the deck with the current one lit. One
    divider draws nothing; a strip of one says nothing.

- 4f4811e: Five new block types and two new chart kinds — the shapes a technical doc still
  had to draw somewhere else. The library goes 79 → 84.
  - **`gitgraph`** — the branching and release model. Lanes for branches, dots
    for commits, a solid curve where one forks and a dashed one where it merges
    back, tags for releases. Commits are a plain sequence, so the YAML reads in
    the order the history happened; the first commit on an unseen branch opens
    its lane.
  - **`treemap`** — proportional composition where a donut gives up. Squarified
    layout (near-square tiles, biggest first) makes areas comparable by eye, so
    thirty services by spend stay readable.
  - **`packet`** — a wire format bit by bit, the diagram an RFC draws in ASCII.
    Cell width IS the bit count, and a field that overruns its row wraps and
    continues on the next, marked `→` / `(cont.)`.
  - **`venn`** — two or three overlapping sets with the shared regions labelled,
    for scope, ownership and responsibility.
  - **`wardley`** — components placed by visibility to the user and by evolution
    (genesis → commodity), joined into a value chain, with `movement` for where
    one is heading.
  - **`chart` `kind: stacked`** — columns that sum instead of standing side by
    side; the axis scales to the totals and each column is labelled with its own.
  - **`chart` `kind: scatter`** — the same series as unjoined points, for when x
    order carries no meaning.

  Also: schema introspection now reports an array's declared `.min(n)`, and the
  Studio form seeds that many items when it adds one. A form that produced fewer
  was building a value its own schema would reject — `venn.shared.sets` (min 2)
  is the first field to require it.

- 35059ea: Two additions from a pass over the whole library, looking for what a technical
  doc still can't draw.

  **New `sankey` block — how much moves between stages.** `flow` and `dfd` show
  that a path exists; nothing showed how heavy it is. Node height and ribbon
  thickness are the same scale, so the widest ribbon leaving a stage IS where the
  volume goes: cloud spend by service, traffic by route, a funnel with its
  drop-off. Nodes are inferred from the links, so the minimum body is a list of
  `from -> to: value`; declare `nodes` only to relabel, colour, or pin a column.
  A node's column is the longest link chain reaching it, so a stage always sits
  right of everything feeding it.

  **New `chart` kind: `gauge` — radial progress against a ceiling.** A donut says
  how a whole splits up; a gauge says how far along one number is, which is the
  shape an SLO, a quota, a migration or a rollout actually has. `max` is the full
  sweep (default 100, the percentage case). One item draws a single dial with the
  value in the middle; several become concentric rings with a legend.

  The block count goes 78 → 79.

### Patch Changes

- a9213cf: `{source: …}` no longer leaks into a page heading. The deck stripped it; the
  document renderer only knew the alignment markers, so `## Title {source: …}`
  rendered the marker verbatim on the page.

  The three places that had to agree about what a heading says now share one
  definition in `@avodado/core` (`stripHeadingMarkers`, `readSourceMarker`,
  `readAlignMarker`) — the page renderer, the deck, and `trailingHeading`, which
  feeds block titles and the sections nav and stripped nothing at all.

  On a page the source isn't dropped, it's printed: a small provenance line under
  the heading, matching what the deck puts in the slide footer.

- Updated dependencies [7f969a3]
- Updated dependencies [f56bbac]
- Updated dependencies [4f4811e]
- Updated dependencies [a9213cf]
- Updated dependencies [35059ea]
  - @avodado/core@0.19.0
  - @avodado/render@0.29.0
  - @avodado/studio@0.10.5

## 0.40.1

### Patch Changes

- b418ed2: A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
  The navigation writes the slide number to the URL hash, and `replaceState`
  raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
  `avo compare` and any site embedding a deck logged one error per slide. The
  hash is a convenience, not the navigation itself, so an embedded deck now
  simply goes without it.
- Updated dependencies [b418ed2]
  - @avodado/render@0.28.1
  - @avodado/studio@0.10.4

## 0.40.0

### Minor Changes

- 6294435: New **`benchmark`** block — measured results side by side, in the shape model
  cards and vendor comparisons use: subject columns × metric rows, each metric
  carrying the benchmark's own name under its label.

  The winner in each row is **derived, not authored**: the numbers are read out of
  the cells (`$0.14`, `310 ms`, `1861` and `43.3%` all compare), then bolded and
  tinted. `better: low` flips it for latency and cost, `better: none` turns it
  off, and `best: true` forces a tie or a non-numeric winner. `featured: true`
  outlines one subject's whole column; `tone: muted` tints a rival's win gray so
  it doesn't read as your win. A row measured under several conditions names them
  in `variants` and gives each subject one value per condition — they stack in
  the cell, captioned, and each condition is compared on its own line.

- 3c1df17: Card and list blocks stop presenting at page width on a slide. Shrink-wrapped
  to their natural width, they sat where the fitter's text ceiling (1.06×) left
  them: a checklist covered 30% of the stage, a status board 52%, a set of KPI
  cards 64%. They now take the stage the way tables do — 20 blocks move to full
  width, including `list`, `cvt`, `kanban`, `stories`, `spec`, `anatomy`,
  `changelog`, `prompt`, `team`, `stats`, `proscons`, `dodont` and `userstory`.

  Stacked cards go **across** the stage rather than down it: `slo`, `okr`,
  `stories`, `envelope` and `trace` lay their cards out with `auto-fit`, so as
  many fit as stay readable and the rest wrap — the same mechanism `drivers` and
  `options` already used. Three SLOs side by side instead of a column took that
  block from 24% of the stage to 98%, and its labels from 7.2px to 12.3px.

  `pullquote` and `bignumber` are deliberately excluded: they are hero text, not
  card stacks, so they keep the shrink-wrap that lets the fitter enlarge them —
  and a pull quote now reads at statement size (22px) on the stage.

  Across the library this takes blocks that land clean on a slide from 34 of 77
  to 59, with no slide clipping at 1120×630. What remains is diagram labels
  (their wrap widths are baked into the viewBox) and four blocks that need a
  different drawing on a slide rather than a bigger one.

- 31ba7dc: Slides stop being a scaled-down page. Two changes, measured across a deck of
  one block per type:

  **Tabular exhibits take the stage width.** Every table in the library is
  already `width:100%`, but the slide's content box shrink-wraps (so the fitter
  can enlarge a lone small block), which meant 100% resolved against the table's
  own intrinsic width: a three-row `table` covered 27% of the stage and the
  fitter's 1.47× ceiling could not rescue it. Tables now get the whole stage and
  their size from type rather than transform — 18px rows instead of 13px scaled
  up, so hairlines and shadows stay crisp. `table` 27% → 98% of the stage width,
  `matrix` 49% → 98%, `heatmap` 43% → 98%, `glossary` 55% → 98%, `scorecard`
  58% → 98%. Their page-card borders and shadows drop on the stage, the way the
  diagrams' already did.

  **A legibility floor for small labels.** The library sets eyebrows, chips,
  captions and secondary values at 9–11px because a page is read at 40cm; on a
  stage, after the fitter scales an exhibit down, those were reaching the room at
  5–8px. Every non-SVG label that measured under 12px is now 12.5px on slides.
  Across the library, labels landing under 12px on a slide drop from 641 to 452,
  and 14 blocks lose their sub-10px type entirely — `risk`, `drivers`,
  `options`, `persona`, `changelog`, `spec`, `kanban` and others.

  SVG diagram labels are deliberately untouched: their wrap widths are computed
  against the current size and baked into the viewBox, so they move per diagram.
  `journey`'s emotion label moves from an inline style to a themed class.

### Patch Changes

- Updated dependencies [6294435]
- Updated dependencies [3c1df17]
- Updated dependencies [31ba7dc]
  - @avodado/core@0.18.0
  - @avodado/render@0.28.0
  - @avodado/studio@0.10.3

## 0.39.0

### Minor Changes

- 2cde519: Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
  `c4` written as just nodes + edges used to come back as a tall column of ranks
  that outgrew the page and shrank to a thin strip on a slide; it now runs across
  the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

  New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
  for the other direction — it steers the auto-layout only, so diagrams with
  `col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.

### Patch Changes

- Updated dependencies [2cde519]
  - @avodado/core@0.17.0
  - @avodado/render@0.27.0
  - @avodado/studio@0.10.2

## 0.38.0

### Minor Changes

- 231e807: `avo compare [family]` (also `avo explore compare`): one page showing every
  block type rendered BOTH ways — the document card beside a live one-slide
  deck (real slide CSS + fitter in an iframe) — with a Doc / Slide / Both
  toggle and per-family navigation. Examples come from the built-in showcase;
  pass a family id to narrow the page.

## 0.37.2

### Patch Changes

- a911135: Rebuild Studio's browser bundle with @avodado/render 0.26.1 so the Studio
  canvas highlights `lang: markdown` snippets like the CLI exports do. (Studio
  bundles the renderer at its own publish time — the previous release shipped
  the new renderer to the CLI but not to the Studio canvas.)
- Updated dependencies [a911135]
  - @avodado/studio@0.10.1

## 0.37.1

### Patch Changes

- aba44c3: Markdown-aware snippet highlighting: a `code` block (or steps/gallery snippet)
  with `lang: markdown` (or `md`/`mdx`) now colors headings, **bold**, _italic_,
  inline code, links, list markers and blockquotes in the dark code card — and
  fenced code inside the sample still gets generic token highlighting. Any other
  `lang` value keeps the existing universal tokenizer.
- Updated dependencies [aba44c3]
  - @avodado/render@0.26.1
  - @avodado/studio@0.10.0

## 0.37.0

### Minor Changes

- efe9172: Editable PowerPoint: `avo pptx --editable` emits native PowerPoint elements —
  text boxes with real bullets, tables, dark code boxes, stat cards, callouts,
  quotes, and actual PowerPoint charts for `chart` blocks — so the deck's words
  are editable in PowerPoint. Only diagram blocks (sequence, flow, ERD, C4, …)
  are placed as crisp screenshots, and Chromium only launches when a document
  actually contains one. The render package now exposes each slide's structured
  `parts` (prose text / block type + data) on the slide model for
  structure-aware exporters.

### Patch Changes

- Updated dependencies [efe9172]
  - @avodado/render@0.26.0
  - @avodado/studio@0.10.0

## 0.36.0

### Minor Changes

- 4c95ee6: PowerPoint export: `avo pptx doc.md` (and a PowerPoint entry in Studio's
  Export menu) turns any doc into a real `.pptx`. Each deck slide is driven in
  headless Chromium exactly as it presents — themes, diagrams, the slide fitter —
  and photographed at 2× into a full-bleed 16:9 image slide, with slide titles
  as speaker notes. Uses the same auto-installed Chromium as `avo pdf`.

### Patch Changes

- Updated dependencies [4c95ee6]
  - @avodado/studio@0.10.0

## 0.35.19

### Patch Changes

- 808891d: Code presents at presentation scale on slides: 16px type (the doc page keeps
  12.5px), and a lone tall snippet (18+ lines) splits into a two-column spread —
  left column first, like a printed listing — so it fills the stage at full size
  instead of shrinking to half scale. Long lines wrap inside the columns, and
  the split only happens when the syntax-highlight markup divides cleanly. The
  "Structure your prompts"-style template went from an effective 10px strip to
  15.5px across 98% of the stage.
- Updated dependencies [808891d]
  - @avodado/render@0.25.11
  - @avodado/studio@0.9.0

## 0.35.18

### Patch Changes

- 460ef16: Slides: title cards center properly and title themselves.
  - The cover's title + subtitle sit at the true vertical center (trailing doc
    margins no longer skew the flex centering).
  - A slide that is only a `divider` is its own title card: no stale section
    heading above the PART band, and the jump menu lists it by the band's title.
  - Untitled leading-prose slides drop the meaningless "Slide" header.

- Updated dependencies [460ef16]
  - @avodado/render@0.25.10
  - @avodado/studio@0.9.0

## 0.35.17

### Patch Changes

- 23228b7: Slide layout audit fixes (found by measuring a real 27-slide deck):
  - **Flat code blocks weigh in** — a top-level `code:` snippet counted as 2.0
    regardless of height, so two 24-line terminals piled onto one slide at 0.5×.
    Both spellings now count lines; tall snippets get their own slide.
  - **Code takes the stage width** — `<pre>` slides no longer shrink-wrap to a
    narrow strip; height is the only fit axis (0.54× → ~0.8× on real content).
  - **Short intros ride with their exhibit** — the kicker threshold rises from
    ~180 to ~400 chars, so a two-sentence lede shares the slide with its hero
    block instead of stranding a near-empty prose slide.
  - **Statement slides** — prose-only fragments that still end up alone render
    as a deliberate centered statement (larger, measured type) instead of a
    small lost paragraph.

- Updated dependencies [23228b7]
  - @avodado/render@0.25.9
  - @avodado/studio@0.9.0

## 0.35.16

### Patch Changes

- 0451174: Slides: the stage-column treatment now covers every stacked text block —
  `agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
  steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
  are already grids (team, persona, drivers, gallery) or whose vertical order is
  the point (layers, changelog) are untouched. Also fixes the terse OKR
  key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
  progress bars show the real percentage instead of clamping to 100%.
- Updated dependencies [0451174]
  - @avodado/render@0.25.8
  - @avodado/core@0.16.1
  - @avodado/studio@0.9.0

## 0.35.15

### Patch Changes

- 77e1003: Slides: tall text lists break into stage columns, and the cover centers.
  - `list`, `takeaways`, `steps`, `faq`, `glossary`, and long prose lists flow
    into 2 columns at 4+ items and 3 at 8+ — horizontal space instead of one
    skinny centered strip the fitter would shrink. Short lists keep their single
    column.
  - The cover slide's subtitle (and the whole title column) is properly centered
    on the stage.

- Updated dependencies [77e1003]
  - @avodado/render@0.25.7
  - @avodado/studio@0.9.0

## 0.35.14

### Patch Changes

- 8462fab: `avo -v` prints the version (lowercase, what fingers type) — `-V` and
  `--version` still work.

## 0.35.13

### Patch Changes

- 75a0648: `avo --version` (and the studio's version reporting) works again after the
  package rename — the version lookup accepted only the old `@avodado/cli` name
  and fell back to `0.0.0`.

## 0.35.12

### Patch Changes

- af9bae9: **Annotate sequence steps from the canvas.** Select a message in a sequence
  diagram and a "＋ add note ②" button (and an `n` shortcut, taught in the hint
  chip) opens the editor focused on that message's `summary` — the annotation
  appears automatically in the Step-by-step list under the diagram with the SAME
  reference number as the diagram badge (the list now shows real message numbers,
  so a note on step 4 reads ④ even when steps 1–3 have none). Structured edits on
  terse sugar items (arrow messages, string cards…) now materialize the item to
  its object form first instead of failing silently — annotating a one-liner
  message just works, and untouched siblings keep their terse spelling.
- Updated dependencies [af9bae9]
  - @avodado/studio@0.9.0
  - @avodado/render@0.25.6

## 0.35.11

### Patch Changes

- 1dd0752: **Studio doc view now reads like the site.** A left sidebar lists the
  project's documents (the open one highlighted) with a "‹ Home" link and a
  New-doc entry — pick on the left, the doc displays and edits on the right
  (collapses on narrow windows, where the top-bar switcher takes over). And the
  cover is its own edit surface: hover the rendered cover for an "✎ Edit cover"
  chip and click to open the cover editor — the detached gray placeholder strip
  is gone. Keyboard block-roving starts at the first real block.
- Updated dependencies [1dd0752]
  - @avodado/studio@0.8.0

## 0.35.10

### Patch Changes

- f8b303a: **Streamlined Studio navigation — no modes to learn.** The Home | Edit | Site |
  Present segmented switch is gone. Studio is now just pages and actions, like a
  website: **Home** (the doc grid — click the wordmark to return) → click a card
  and you're **in the doc**, viewing and editing the same rendered surface.
  **▶ Present** is a button (⇧⌘P, Esc returns), and **Site ↗** opens the built
  docs site in its own browser tab — pointed at the current doc when you're in
  one. The top bar stays contextual: editing chrome only appears inside a doc.
- Updated dependencies [f8b303a]
  - @avodado/studio@0.7.0

## 0.35.9

### Patch Changes

- c56f620: **Studio opens on a Home page** — a front page for your docs, like a site
  landing. A searchable card grid (most recently edited first) with each doc's
  title, slug, and last-edited time; click a card to edit, hover for a one-click
  Present; a dashed "New doc" card opens the template picker; "Browse the site"
  jumps to Site mode. The wordmark is now a Home button, the mode switch gains
  Home | Edit | Site | Present, and the top bar hides doc-editing chrome (save
  state, autosave, export, undo) while on Home.
- Updated dependencies [c56f620]
  - @avodado/studio@0.6.0

## 0.35.8

### Patch Changes

- ed6dde6: Edge-step numerals (① ② ③) dodge node boxes — a long edge's midpoint can land
  on a node in tight layouts, which printed the badge over the node's label.
  Badges now nudge off any node box along the edge's axis, and keep clear of
  each other when two edges share a corridor. Diagrams without collisions render
  byte-identically.
- Updated dependencies [ed6dde6]
  - @avodado/render@0.25.5
  - @avodado/studio@0.5.1

## 0.35.7

### Patch Changes

- b55ae7e: Decks show diagrams complete on slide entry — the progressive ① ② ③ step
  reveal is removed; navigation is one press per slide again.
- Updated dependencies [b55ae7e]
  - @avodado/render@0.25.4
  - @avodado/studio@0.5.1

## 0.35.6

### Patch Changes

- 402174b: **Terse sugar everywhere.** Eleven more fields accept one-line string items:
  - **Diagrams:** `dfd.edges`, `swimlane.links` + `lanes`, `c4.edges`,
    `cluster.links` take `a -> b: label`; `state.transitions` take
    `idle -> active: submit` (the label is the event); `flow`/`graph`/`block`/
    `dfd`/`state` **nodes** take `rx: Receive` — or just `Receive` (a bare name
    is both id and label, so a whole sketch is `nodes: [Receive, Check]` +
    `edges: [Receive -> Check]`); `erd` columns take `id uuid pk` /
    `org_id: uuid fk`.
  - **Cards:** `stats` take `p95 · 120ms · -30%` (trend inferred from the delta
    sign); `team.members` take `Ana · Backend · payments`; `agenda.items` take
    `09:00 · 20m · Standup — round robin` (time/duration detected by shape);
    `okr` key results take `[on-track] Signups · 60%`.

  Object forms are untouched and mix freely; the skill's terse-grammar table
  documents every form.

- Updated dependencies [402174b]
  - @avodado/core@0.16.0
  - @avodado/render@0.25.3
  - @avodado/studio@0.5.1

## 0.35.5

### Patch Changes

- 3aca7b1: **Block audit: simpler authoring across the list-shaped blocks.** Six more
  blocks now take terse string items (the callout bare-text philosophy):
  - `glossary` — `SLO — the target` or unquoted `SLO: the target`
  - `faq` — `Why is it fast? — The cache is warm.`
  - `takeaways` — `Ship small — five beats one.`
  - `list` — `Lead` or `Lead — text`
  - `steps` — `Title` or `Title — body`
  - `kanban` cards — `Core parser` or `Validation · priority`

  Object forms are untouched; unquoted `Key: value` items (the YAML wrinkle) are
  rescued when the key isn't a real field. Also refiles `pullquote` and `layers`
  from the `api` family to `narrative` where they belong, and the skill's
  contract + examples teach the terse forms.

- Updated dependencies [3aca7b1]
  - @avodado/core@0.15.0
  - @avodado/render@0.25.2
  - @avodado/studio@0.5.1

## 0.35.4

### Patch Changes

- c7de193: Diagrams shed their page-card chrome on slides: no border box, tag pill, fig
  number, or dashed rule inside a slide — the slide itself is the card, so
  sequence/flow/architecture diagrams now sit directly on the stage at full
  presentation scale.
- Updated dependencies [c7de193]
  - @avodado/render@0.25.1
  - @avodado/studio@0.5.1

## 0.35.3

### Patch Changes

- 1b44c6c: **Smarter slides — less shrinking, more presenting.**
  - **Auto-split layout:** substantial prose + a medium exhibit that would
    overflow stacked now lays out side by side automatically (prose as the left
    message column, the exhibit right) — the layout `{split}` forces, chosen for
    you. Write the section naturally; the deck picks the layout instead of
    scaling the stack down.
  - **Numbered diagrams build step by step:** in the deck, a sequence diagram (or
    any edge-steps diagram with the ① ② ③ legend — flow, c4, cycle…) reveals one
    step per advance — arrow, numeral, and legend row together. Back un-reveals,
    jump/Home/End show the finished slide, print shows everything.

- Updated dependencies [1b44c6c]
  - @avodado/render@0.25.0
  - @avodado/studio@0.5.1

## 0.35.2

### Patch Changes

- 0d9c992: **Callouts (and pullquotes) are now just text.** A text-first block's body can
  be plain prose — no YAML at all, so colons, quotes and dashes never need
  escaping:

      ```callout
      Heads up: the rate limit is 100 req/min — use `retry()` with **backoff**.
      ```

  The whole body becomes the block's text field (callout `body`, pullquote
  `text`), and it renders as inline Markdown (bold/italic/code/links, blank lines
  as paragraph breaks — hardened, no raw HTML). Leading with a known field
  (`tone:`, `title:`, `id:`…) still parses as YAML exactly as before. Studio's
  structured edits canonicalize a bare-text body to explicit fields instead of
  failing.

  **Typography: reading text is bigger.** Body prose 14 → 15.5px, list items
  13.5 → 15px, callout body 13 → 14.5px, glossary/diagram descriptions 13 → 14px,
  section ledes 15.5 → 16px.

- Updated dependencies [0d9c992]
  - @avodado/core@0.14.0
  - @avodado/render@0.24.0
  - @avodado/studio@0.5.1

## 0.35.1

### Patch Changes

- 43a45ea: **The heading titles the block.** A `##` heading directly above a block now
  titles it: a near-duplicate block `title` is suppressed at render (no more two
  stacked headings saying the same thing — healed in HTML, slides, Studio, and
  PDF), and a title-less block inherits the heading into the sections nav. The
  Markdown-native way to write docs is now simply: put the title in the heading
  and skip `title:` in the YAML.

  The `W_DUP_HEADING` warning is removed (the condition is auto-healed), and core
  exports `trailingHeading` alongside `isNearDuplicateTitle`. The authoring skill
  teaches the new rule.

- Updated dependencies [43a45ea]
  - @avodado/core@0.13.0
  - @avodado/render@0.23.0
  - @avodado/studio@0.5.0

## 0.35.0

### Minor Changes

- d143316: Add a **Theme Generator** to Avodado Studio. A "Theme" button in the toolbar
  opens a right-docked panel where you pick a base theme and tune the 11 friendly
  colors + 3 font slots, with the canvas re-tinting live as you edit. **Install**
  writes a `*.theme.json` into the project's `.avodado/themes` (or `~/.avodado/themes`
  for a global theme) via a new `POST /api/theme` route on the file bridge, and
  activates it — so it immediately appears in the theme picker and in `avo theme`.

### Patch Changes

- Updated dependencies [d143316]
  - @avodado/studio@0.5.0

## 0.34.1

### Patch Changes

- Fix the npm README title — the heading now reads `avodado` instead of the old
  `@avodado/cli` package name.

## 0.34.0

### Minor Changes

- 7052a5d: Rename the CLI package `@avodado/cli` → **`avodado`** (unscoped) for
  discoverability: `npm i -g avodado`, `npx avodado`, and the command is available
  as both `avo` and `avodado`. `@avodado/cli` is deprecated and points here.

  Also improve the npm READMEs: the CLI README opens with a worked example (a
  Markdown doc with a `sequence` block → `avo check` / `avo html` / `avo studio`)
  in plainer language; the core README lists the real block-type set (77 across 12
  families) instead of a stale short list.

### Patch Changes

- Updated dependencies [7052a5d]
  - @avodado/core@0.12.1
  - @avodado/render@0.22.1
  - @avodado/studio@0.4.0

## 0.33.0

### Minor Changes

- ebdf605: Studio, rendering, and package metadata.

  **Studio**
  - Toolbar **Export** menu: download the current doc as a standalone HTML page,
    a self-contained slide deck, or a PDF. PDF is produced by a new
    `POST /api/export/pdf` route on the file-bridge server (headless Chromium).
  - **ERD drag-to-connect:** selecting an entity shows connector dots; dragging
    to another entity opens a cardinality picker (1:1 / 1:N / N:1 / N:M) that
    appends the relation. Committed as a single undo step.
  - Direct-manipulation editing for grid groups (marquee select + resize) and
    column-family blocks.

  **Rendering**
  - New `cycle` block and grid-group / orthogonal-lane / label-wrap improvements
    across the diagram renderers.

  **Metadata**
  - SEO-focused `description` + `keywords` across all packages, framed around the
    real use cases: API docs, architecture & system design, ERDs, ADRs, and
    slide/PDF presentations.

### Patch Changes

- Updated dependencies [ebdf605]
  - @avodado/core@0.12.0
  - @avodado/render@0.22.0
  - @avodado/studio@0.4.0

## 0.32.1

### Patch Changes

- Custom themes become first-class, and the wordmark goes full avocado.
  - Fixed: installing or referencing a custom theme no longer fails with
    "theme must be one of:" — `avodado.theme.json` accepts built-in names,
    installed theme names, and self-titled theme files; unresolvable names get
    an error listing your installed themes alongside the built-ins.
  - Fixed: the studio theme picker now lists every installed theme (project and
    global) next to the six built-ins, with the on-disk theme selected on load.
  - Fixed: changing the theme while studio is open (including `avo theme
--global`, which previously emitted no change event) repaints live, with a
    "Theme changed on disk — applied" note. In-studio picks are session
    previews; the file on disk stays the source of truth.
  - The `avo init` wordmark is now chunky block letters in the avocado-green
    gradient, matching the per-command action banners.

- Updated dependencies
  - @avodado/studio@0.3.1

## 0.32.0

### Minor Changes

- Consolidate the workspace from 7 published packages to 5.
  - `@avodado/cli` absorbs `@avodado/sync` (the OpenAPI importer behind `avo sync openapi`, now at `src/sync/`) and PDF export (`toPdf` / `installChromium` / `isChromiumAvailable`, now at `src/io/pdf.ts`); `playwright` is now a direct (optional) dependency of the CLI instead of arriving transitively via `@avodado/export`.
  - `@avodado/render` gains `toSlides` — the self-contained slide-deck assembly formerly in `@avodado/export`. All rendering (HTML pages, embeddable parts, slide decks) now lives in one package, and it stays browser-safe.
  - `@avodado/mcp` no longer depends on `@avodado/sync`; it vendors the OpenAPI generator (a test pins the copy byte-identical to the CLI's). Behavior of the `sync_openapi` tool is unchanged.

  `@avodado/export` and `@avodado/sync` are discontinued: their final versions remain on npm (deprecation notices to be run manually), and `toHtml` — a thin alias of `renderDocument` — is gone; call `renderDocument` from `@avodado/render` directly.

- Simplification: 76 block types, terser YAML, a smaller CLI, and a sharper story — with zero breaking changes.

  **88 → 76 block types, 12 permanent aliases.** Twelve blocks that were variants of another block merged into their canonical type: `infra`/`event`/`ddd`/`network` → `block` (`preset:`), `belogic` → `felogic` (`variant: be`), `dag` → `flow` (`variant: dag`), `waterfall`/`funnel` → `chart` (`kind:`), `diff`/`terminal` → `code` (`kind:`), `mece` → `tree` (`variant: issue`), `tracker` → `statustable` (`variant: tracker`). **The old spellings stay valid forever**: an aliased fence parses to its canonical type with the variant fields injected (your body always wins on conflict), renders byte-identically to before (pinned parity fixtures), keeps its historical section eyebrow, and survives studio editing untouched. `avo check` surfaces a `W_ALIAS_TYPE` warning — informational only, never a failure — telling you where the type lives now. No file needs to change. (Further merges the audits suggested — matrix→table, heatmap→chart, gantt→timeline, and friends — were rejected: their data shapes are structurally different, and forcing them would have bolted second grammars onto flagship blocks.)

  **YAML sugar.** The chattiest blocks now take one-line string forms alongside the object form: sequence messages and flow/graph/block edges (`Client -> Server: request`, `-->` for response/dashed, `-x->` for error), ERD relations in crow's-foot (`users ||--o{ orders: places`), and timeline items (`[done] 2026-07 · Phase 1 · What shipped`). Input-only — files keep whatever form you wrote.

  **Scalar coercion.** Bare numbers and booleans in string-only positions coerce automatically — "expected string, received number" is gone where the intent was unambiguous, and positions that legitimately take numbers (table cells, stats values) are protected.

  **CLI redesign.** Twenty commands became ~13 in four groups — Work (`avo`, `init`, `new`, `check`, `studio`, `serve`), Output (`html`, `slides`, `pdf`, `build`), Discover (`explore`), Setup (`install`, `theme`, `mcp`, `sync`). Bare `avo` is now smart: outside a project it points you at `avo init`; inside one it shows a mini status and your next actions. `avo <file.md>` renders and opens the file. `avo new` unifies doc templates and block scaffolds (`avo new adr`, `avo new sequence` — old names resolve with an alias note). `avo explore` fronts demo/catalog/design/tour. Old command names keep working as hidden compat. `avo init` writes ~30 files instead of 104: the authoring skill installs once at `.avodado/skill/` and each AI tool gets a small pointer stub instead of a full copy.

  **Studio.** "+ New doc" opens a template picker — Blank plus the 11 doc templates (ADR, design doc, runbook, API spec, …) as cards; picking one creates the doc and opens the first content block's Edit Sheet so Tab/Enter walks you through filling it in. Insert search understands the old spellings: typing "waterfall" surfaces "Data chart — matches waterfall (kind: waterfall)" and inserts a chart with the variant pre-filled.

  **Positioning.** The lede everywhere is now the point: _your documentation has a schema_ — typed, fenced YAML blocks in plain Markdown, validated like code, with the `.md` files on disk as the only source of truth.

  `@avodado/mcp` picks up the regenerated skill embed and `list_block_types` now returns the canonical 76 plus the alias map.

- Studio becomes the single local surface, imports arrive, and the official mark
  ships everywhere.
  - studio: **Edit · Site · Present modes** — Site browses the real built docs
    site (live-reloading, cross-doc nav) inside studio; Present (⇧⌘P) shows the
    current doc as slides, unsaved edits included. **Block Library** — browse all
    blocks as cards with rendered previews, filter by family/search (old block
    spellings resolve), click through to a full preview + template and insert in
    one step. **Import by drag-drop**: a `.csv` becomes a filled table /
    status table / chart at the drop point (smart suggestion with reasoning); an
    OpenAPI `.yaml`/`.json` scaffolds a whole validated doc. Forms-first editing
    (spreadsheet-style table grid, Simple|Detailed union fields) and an
    interactive 9-step tour.
  - core: new `import/` module — dependency-free RFC-4180 CSV engine
    (`csvToTable` / `csvToStatustable` / `csvToChart` / `suggestCsvImport`), the
    OpenAPI generator relocated from the CLI (one source for cli, mcp, studio),
    and an importer registry.
  - cli: `avo sync csv <file>` (smart block pick, `--block/--delimiter/--title`);
    `avo serve` is now a hidden alias — `avo studio` (Site mode) is the one local
    surface.
  - render: every rendered page, deck, and site now carries the official avodado
    mark as its favicon.
  - mcp: imports the OpenAPI generator from core (vendored copy removed).

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @avodado/render@0.21.0
  - @avodado/core@0.11.0
  - @avodado/studio@0.3.0

## 0.31.1

### Patch Changes

- Brand favicon + studio review-before-write mode.
  - render: new brand exports (`FAVICON_SVG`, `FAVICON_DATA_URI`, `FAVICON_LINK`)
    — a clean avocado favicon, now on every rendered page (`avo html`/`preview`).
  - cli: `avo serve`/`avo build` pages and slide decks carry the favicon.
  - studio: the tab icon matches; **review mode** — with autosave off, the save
    chip reads "Unsaved · N changes" and saving opens a review dialog listing
    edited / added / removed / reordered blocks with Apply / Cancel, so nothing
    touches the file until approved. Deleting a block or diagram part asks first
    (double-⌫ confirms; pristine just-inserted scaffolding deletes silently).

- Updated dependencies
  - @avodado/render@0.20.0
  - @avodado/studio@0.2.0
  - @avodado/export@0.3.2

## 0.31.0

### Minor Changes

- `avo studio` — the visual doc editor. A full-screen local web app served by the
  CLI: insert blocks from the searchable palette into a live-rendered canvas, edit them
  via schema-generated forms or raw YAML, reorder with drag handles, and watch AI
  edits to the same files repaint live over SSE. Files on disk stay the single
  source of truth — studio surgically rewrites individual fenced blocks.
  - core: new surgical edit ops (`replaceBlockBody`, `insertBlock`, `removeSegment`,
    `moveSegment`, `setYamlPath`, …), schema introspection (`describeBlockSchema`),
    and the block catalog data (`BLOCK_TEMPLATES`, `BLOCK_DESCRIPTIONS`,
    `BLOCK_FAMILY`) relocated from the CLI as public API.
  - render: `renderDocumentSegments` — per-segment HTML index-aligned with
    `doc.segments`, for editors that need DOM↔segment mapping.
  - cli: new `avo studio` command — a localhost-only file-bridge server (JSON API +
    SSE + static app assets); shared fs-watch helpers extracted into `io/watch.ts`.
  - studio: first release of the web app (published as static assets consumed by
    the CLI).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.10.0
  - @avodado/render@0.19.0
  - @avodado/studio@0.1.0
  - @avodado/export@0.3.1
  - @avodado/sync@0.0.12

## 0.30.3

### Patch Changes

- The Copilot adapter installs a real Agent Skill. GitHub Copilot now supports Agent Skills (the same SKILL.md folder format) in `.github/skills/` — `avo init` / `avo install copilot` install the canonical skill folder there (hub + `reference/` spokes, progressive disclosure intact) instead of the old stitched `.github/prompts/avodado-docs.prompt.md` single file. The stitched form remains behind `avo skill` and the MCP embed for surfaces without skill support.

## 0.30.2

### Patch Changes

- Piped `avo --help` output is now genuinely ANSI-free even when a `CI` environment variable is set (picocolors treats CI as color-friendly, which colored the grouped help epilogue on runners and broke pipe-cleanliness); e2e assertions are environment-deterministic.

## 0.30.1

### Patch Changes

- avo tour v2: step back/forward (arrows, b, 1-7 jump), memoized chapters that never re-run side effects, prominent command cards showing the exact avo command per step, progress dots, key legend, and o to re-open the browser.

## 0.30.0

### Minor Changes

- Agentic blocks, 106-pattern library, the full shape language, and a restructured skill. **AI & agents family** (79 → 83 blocks): `agentloop` (agent + tools + memory with numbered loop arrows and a stop-condition pill), `trace` (execution transcript with thinking and tool calls), `prompt` (prompt anatomy with highlighted `{{variables}}`), `context` (context-window token budget bar with overflow) + an Agent-system-doc playbook. **Design library 80 → 106**: interpreter (the 23rd GoF), architecture classics (mvc, mvvm, dependency-injection, unit-of-work, active-record, data-mapper, event-bus, specification, null-object), resilience/concurrency/messaging (retry-backoff, bulkhead, timeout, cache-aside, throttling, actor-model, producer-consumer, thread-pool, competing-consumers, splitter-aggregator), and agentic patterns (plan-and-execute, human-in-the-loop, agentic-rag, swarm-handoff, chain-of-thought, context-compaction). **Diagram elegance**: labeled C4 edges (and dense block-family diagrams) render as circled step numerals with a legend below; C4 tech renders as a chip; all node cards drop the left accent bar for the clean rounded agent-card look. **Shape language, 21 silhouettes by kind**: cylinder, tiered cylinder (warehouse), pail (S3), sharded trio, replica set, pipe, cloud, hexagon (gateway), octagon (lb), instance stack (cache + worker pools), server rack, shield (waf), actor figure, crowd, browser window, phone, ƒ circle (lambda), clock (cron), vault dial (secrets), globe (region), clean card — plus new kinds shard/replica/users/crowd/region/geo. **Skill restructured** for progressive disclosure: a 598-line hub (down from 2,373) + `reference/` spokes (blocks contract, system design, decks, and new per-document intake checklists with a batched ask-back protocol); `avo skill`, the Copilot adapter, and the MCP embed stitch everything into one prompt; `avo init` installs the full folder. **Plus**: a new `archmap` block (83 → 84) — the target-architecture capability mosaic with status-coded tiles (current/target/new/gap/deprecated) and an auto-legend; the shape language extends into `belogic`/`felogic` (db → cylinder, queue → pipe, cache → stack, external → cloud), `c4` (`store` → true database cylinder), and `cluster`; secrets render as a padlock and schedulers as the industry-standard calendar-with-clock; the ERD is restyled (tinted header band, content-sized entities, zebra rows, PK/FK chips); and block titles no longer render twice (the section head owns the title; the block body's duplicate header is suppressed at top level).
- The documentation-tool release. **New commands**: `avo serve` (zero-dep live-reload dev server — watch, SSE reload, in-page diagnostics banner), `avo build` (docs/ → a static site: index cards, sidebar nav with per-doc sections, cross-doc `doc#id` refs rewritten to real links), `avo mcp` (setup snippets + `--stdio` server), `avo install <tool>` (claude/cursor/copilot/windsurf — replaces the old per-tool commands, Copilot correctly named), `avo tour` (interactive 7-chapter terminal onboarding with a live-caught planted bug), `avo demo [family]` (filtered showcases with an interactive picker). **Removed**: the duplicate `render` command (use `html`). **Render**: blocks with an `id:` emit real anchors + `data-block-id`; userstory/stories ref chips are real links; C4 goes professional (level-aware `C4 · CONTAINER` tag, centered structurizr-style typography, dashed externals, legend derived from the kinds present, taller cards) and the layered architecture drops its solid label slabs for tinted zone bands with optional per-layer `color`. **Catalog** groups all blocks by family. **Skill**: `reference/blocks/` per-family split with INDEX + whole contract table (coverage-tested), trimmed trigger frontmatter, new "Organizing a documentation set" + "Reviewing an existing doc" + "C4 done right" guides. **Slides** gain an automated gate (full-demo deck + split-layout tests). New professional cfonts wordmark + one-line banner (ANSI-free when piped) and purpose-grouped help.
- Twelve more blocks (67 → 79) plus consulting-style decks. **Engineering & decisions**: `waterfall` (latency/cost budget cascade with a dashed budget line and over/under chip), `heatmap` (numeric grid with intensity ramp + legend), `scorecard` (weighted decision matrix with computed totals and winner highlight), `risk` (register with likelihood × impact severity chips), and `chart` gains a `radar` kind. **Design system** (new family): `palette` (color-token swatches with auto-contrast labels), `typescale` (live type specimen), `dodont` (Do/Don't guideline cards), `inventory` (component status board) + a Design-system doc playbook in the skill. **Algorithms & data structures** (new family): `array` (cells, indices, pointer labels, window highlight), `linkedlist` (singly/doubly with head/curr markers), `bintree` (binary tree with per-node walkthrough states), `hashmap` (buckets + collision chains); `graph` gains node `state` (visited/current/frontier/target) and edge `weight` for BFS/Dijkstra walkthroughs. **Decks**: `{split}` heading marker renders the consulting layout (message left, exhibit right), every slide gets a footer (deck title · page number), and the skill gains a Consulting-style decks section (action titles → one exhibit → takeaway). Also fixes `avo <cmd> | head` leaving an unsettled flush await.
- Fourteen new block types — the catalog grows from 53 to 67. **Everyday primitives**: `chart` (bar / line / area / donut, pure SVG), `figure` (image + caption), `diff` (unified +/− code diff on the dark editor surface), `steps` (numbered runbook stepper with per-step commands), `faq` (Q&A accordions). **System design**: `envelope` (back-of-envelope capacity math — assumptions → derivation rows → highlighted result), `slo` (service objectives with error-budget burn bars), `terminal` (shell session, distinct from code). **Business & strategy**: `swot`, `funnel` (conversion trapezoids with stage-to-stage %), `okr` (objectives + key-result progress bars), `persona` (user persona cards), `changelog` (release rail with typed change chips), `team` (people cards). All fully registered: strict schemas, renderers + CSS in the house style, `avo block` scaffolds, catalog descriptions, demo showcase sections, and skill documentation (glossary, contract table, examples, new Business & strategy family).
- Presentation text blocks + a full template set. **Three new blocks (84 → 87)**: `divider` (deck part-break interstitial — kicker, big title, accent wash), `bignumber` (the hero-stat slide: one huge figure + claim + context), `takeaways` (numbered presentation-scale closing statements). Dividers render full-width on slides; blocks whose title _is_ the visual no longer have it lifted into the section head; `{split}`/`{top}` heading markers no longer leak into HTML doc headings. **`avo template` grows from 1 to 11**: adr, design-doc, runbook, roadmap, api-spec, system-design, agent-system, design-system, postmortem, data-model, and a `deck` template demonstrating the consulting formula (divider → `{split}` argument slides → bignumber → takeaways) — every template schema-validated by tests and namespaced so several scaffold cleanly into one repo. The skill's deck guide covers when to use each, and the playbooks table maps each playbook to its template.
- System-design diagram overhaul. **Quick mode**: `col`/`row` are now optional on the block family, `graph`, and `felogic`/`belogic` — omit coordinates and the layout is computed from the edges. **Canonical shapes by kind**: db/store/warehouse render as cylinders, queue/topic/stream as horizontal-cylinder pipes, cdn/external as clouds, gateway/lb/proxy as hexagons, cache/redis as stacked-instance cards. **~40 new node kinds** with glyphs (dns, waf, auth/idp, monitor, scheduler, stream, warehouse, search, ml/llm/agent, vm, secrets, notification, email, ci, git, registry, device, analytics, config, …) plus vendor aliases (postgres/mysql/mongo→db, kafka/kinesis→stream, s3, sqs, redis, elasticsearch). **C4**: edge `tech:` labels, multiple named `boundaries[]`, and a fix for edge labels never rendering. **Cluster**: namespaces now sit side by side, self-sized, in the refined zone style. **UML**: content-sized class cards with tinted header compartments. **Polish**: nested infra zone labels no longer overlap, off-palette ink normalized to theme vars, graph label clamping, slide decks render text at presentation scale with a proper measure (text-only slides no longer over-scale). Skill updated throughout.

### Patch Changes

- Rework the authoring skill around a think-first method instead of fill-in templates: understand the ask and ask 2-4 clarifying questions back when the answer changes the outline, outline the story as headings before any YAML, cast blocks dynamically from the catalog (one lens per beat, varied lenses), keep one consistent cast of names across all blocks, then validate and skim. Adds a "Designing a system — reason it, don't template it" section (requirements → envelope math → contract → high-level shape → bottleneck deep-dive → trade-offs → failure modes → plan) plus rules for editing existing docs without breaking their story. Removes the duplicated block decision tables and quick index, and rewrites a dozen repetitive same-domain examples with varied system-design ones (circuit-breaker state machine, telemetry pub/sub, search platform, clickstream DFD, notifications ERD, admission-control flow, incident swimlane, payment-strategy UML, clip-platform C4).
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @avodado/core@0.9.0
  - @avodado/render@0.18.0
  - @avodado/export@0.3.0
  - @avodado/sync@0.0.11

## 0.29.0

### Minor Changes

- CLI cleanup:
  - **Removed `avo export` and `avo new`** (batch export and the old scaffolder).
    Use the one-doc `avo html|slides|pdf` for output, and `avo block`/`avo template`
    to scaffold.
  - **`avo demo`** now opens the showcase directly; pass `-s` for a slide deck
    (no more positional format).
  - **`avo catalog`** prints the block catalog (name + description) in the terminal;
    `-p` opens an HTML gallery of live samples, `-s` a slide deck.
  - **`avo design`** follows the same shape: list in the terminal, `<slug>` prints a
    template, `-p` opens the gallery and `-s` a deck (replacing `--all`); filters
    `--system`/`--ai`/`--code` still apply.
  - Skill: comparing things ("adapter vs command") routes to a `gallery` of nested
    blocks; gallery docs show text / code / diagram grids.

## 0.28.3

### Patch Changes

- Skill + showcase now document the `gallery` grid with a labelled example of each
  cell kind — grid with text (notes), grid with code, and grid with diagrams
  (nested blocks, e.g. comparing architectures side by side). `avo demo` gains a
  diagram-comparison gallery.

## 0.28.2

### Patch Changes

- Refine block styling across the board: softer two-layer shadows, larger and more
  consistent corner radii on card surfaces (drivers, options, spec, list, gallery,
  pattern, composition, code, …), roomier callouts, and a subtle elevation on
  diagram frames — a more polished, cohesive look. Skill notes that code renders on
  a dark editor surface (shared by `gallery` cells and `sequence` snippets).
- Updated dependencies
  - @avodado/render@0.17.2
  - @avodado/export@0.2.15

## 0.28.1

### Patch Changes

- Updated dependencies
  - @avodado/render@0.17.1
  - @avodado/export@0.2.14

## 0.28.0

### Minor Changes

- New `gallery` block (now 53): a real grid (2 columns by default; set `cols` for
  3–4) of cells. Each cell is a syntax-highlighted code snippet, a note, or a
  **nested block** (`block: { type: c4, …data }`) — so you can lay out a bug gallery
  of code or compare several architectures/diagrams side by side. Nested blocks are
  validated against their own schema. Skill, `avo block`/`avo catalog`, and the
  showcase updated.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.8.0
  - @avodado/render@0.17.0
  - @avodado/export@0.2.13
  - @avodado/sync@0.0.10

## 0.27.2

### Patch Changes

- Updated dependencies
  - @avodado/render@0.16.0
  - @avodado/export@0.2.12

## 0.27.1

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.11

## 0.27.0

### Minor Changes

- Themes are now a global library. `avo theme install <path>` installs into
  `~/.avodado/themes/` by default, so a theme is usable in every project (use
  `--local` for project-only). `avo theme` / `theme list` show global + project
  themes together (marked), and `avo theme use <name> --global` sets a default that
  applies to every project (`~/.avodado/avodado.theme.json`) wherever a project has
  no theme of its own. `avo theme new <name> --global` scaffolds into the global
  library too.

## 0.26.3

### Patch Changes

- Make `avo design --all -s` decks readable: in slides mode each pattern is one
  clean slide — heading + one-line intent + its diagram — instead of cramming the
  full card and the diagram onto a single slide (which `fit()` shrank to nothing).
  The HTML gallery still shows the full card + diagram.

## 0.26.2

### Patch Changes

- Fix the `cdc` design pattern rendering as a thin, cramped strip: it now uses an
  `infra` banded diagram (Source → Capture → Consumers, multiple subscribers) — a
  balanced, richer shape consistent with the other system-design patterns.

## 0.26.1

### Patch Changes

- Render the `service-mesh` pattern as a `c4` container diagram (like
  `microservices`) instead of a cluster — control plane + sidecars with families,
  tech, and a boundary.

## 0.26.0

### Minor Changes

- Richer, demo-quality system-design diagrams (and fewer plain boxes): `caching`
  is now a `belogic` backend-logic chain; `microservices` a full `c4` container
  view (boundary, person, families, a datastore, an external, with tech + desc);
  `service-mesh` and `sidecar` are `cluster` diagrams with namespaces, replicas,
  and tech; `cdn` and `event-driven` use `infra` with nested zones / layered bands.
  Modeled on the `avo demo` showcase.

## 0.25.0

### Minor Changes

- Big expansion of the `avo design` library — now 80 patterns (46 system · 12 AI ·
  22 GoF) with even more diagram variety:
  - **Architecture & data**: `event-driven` (`infra` bands), `microservices`
    (`c4` containers — new shape), `event-streaming` (Kafka), `service-mesh`,
    `strangler-fig`, `bff`, `scatter-gather`, `dead-letter-queue`,
    `database-per-service`, `lambda-architecture`, `async-write`, `failover`
    (`state`), `indexing`.
  - **AI / agents** (from Anthropic's "Building Effective Agents"):
    `parallelization`, `augmented-llm`.

  The gallery now spans `uml · block (zoned) · flow · state · sequence · cluster ·
dfd · dag · c4 · infra`. README gains an at-a-glance command table; the tutorial
  gains a pattern-library slide.

## 0.24.0

### Minor Changes

- Ten more classic system-design patterns (ByteByteGo / interview style), now 33
  system patterns and 65 total — with two new diagram shapes in the gallery for
  more variety:
  - `feed-fanout` & `quorum` — zoned `block` fan-outs
  - `distributed-lock`, `webhooks`, `oauth2` (authorization-code flow),
    `two-phase-commit` — `sequence`s
  - `heartbeat` — a `state` machine (ALIVE → SUSPECT → DEAD)
  - `cdc` — a **`dfd`** data-flow diagram (new in the design gallery)
  - `cicd-pipeline` — a **`dag`** pipeline (new in the design gallery)
  - `geohashing` — a decision `flow`

  The library now spans uml · block (with zones) · flow · state · sequence ·
  cluster · dfd · dag — no two patterns look the same.

## 0.23.0

### Minor Changes

- More system-design patterns (now 23) and more elegant, varied diagrams:
  - New: `leader-election` (a `state` machine), `bloom-filter` & `backpressure`
    (decision `flow`s), `write-ahead-log` & `service-discovery` (`sequence`s),
    `sidecar` (a k8s `cluster`), `outbox` & `blue-green-deploy` (`block`s with
    labelled zone groups).
  - Existing fan-out diagrams (load-balancing, pub-sub, api-gateway, sharding) now
    use labelled zone groups, and CQRS is split into write/read zones — so the
    system diagrams no longer all look like the same boxes.

  The library is now 55 patterns (23 system · 10 AI · 22 GoF code).

## 0.22.0

### Minor Changes

- `avo design` is richer and more varied:
  - **Bespoke structure diagrams per pattern** (no more uniform graphs): GoF code
    patterns render proper **UML class diagrams** (inheritance / implementation /
    aggregation markers, interface stereotypes); system-design patterns use the
    shape that fits — `block` fan-outs, a `state` machine (circuit breaker), a
    `flow` decision (rate limiting), or a `sequence` (saga, idempotency).
  - **New AI / agent patterns** (10): `rag`, `react`, `tool-use`, `prompt-chaining`,
    `routing`, `reflection`, `multi-agent`, `guardrails`, `memory`,
    `evaluator-optimizer` — each with a fitting diagram. Filter with
    `avo design --ai` (and `--system` / `--code`).
  - The skill gains a **pattern-driven system-design playbook**: when asked to
    design a system ("a notification system, event-driven"), the agent infers
    requirements (`drivers`), presents `options` with a recommendation, grabs the
    building-block patterns via `avo design <slug>`, and assembles the architecture.

## 0.21.0

### Minor Changes

- `avo design` templates now include a **structure diagram**, not just the card:
  code patterns render a `belogic` graph (with interface/impl UML stereotypes
  inferred from the relationships) and system-design patterns render a `block`
  graph (with cache/queue/store/gateway glyphs), each with labelled edges. Applies
  to `avo design <slug>` templates and the `avo design --all` gallery.

## 0.20.0

### Minor Changes

- Add `avo design` — a library of common design patterns as ready, validated
  `pattern`-block templates. Covers 15 system-design building blocks (caching,
  sharding, replication, CQRS, event sourcing, circuit breaker, saga…) and the 22
  GoF code patterns (Strategy, Observer, Adapter, Decorator…), curated from
  common references (hellointerview "system design in a hurry" and
  refactoring.guru).
  - `avo design` lists them by category; `avo design <slug>` prints a ready
    template (copies to clipboard) or scaffolds it with `-o`.
  - `avo design --all [--system|--code] [-s]` renders the whole gallery to HTML or
    a slide deck.
  - The skill now tells agents to grab `avo design <slug>` templates instead of
    improvising a pattern from memory.

## 0.19.0

### Minor Changes

- Add `avo catalog` — render a living catalog of every block type: each block's
  identifier (the fenced type name an AI uses), a one-line description of what it
  does, and a live sample. `avo catalog -s` renders one block per slide (a handy
  reference deck); `-o <path>` writes to a file. Built from the block registry, so
  it always covers the full set.

## 0.18.1

### Patch Changes

- Don't bake the Avodado brand logo into scaffolded docs: removed the `meta.logo`
  line from the `getting-started.md` and `tutorial.md` templates that `avo init`
  generates. The optional `meta.logo` field stays available for users' own logos.

## 0.18.0

### Minor Changes

- Add three new block types (now 52):
  - **`list`** — a fancy bullet list with four marker styles (`accent` bar,
    `check`, `icon`, `number`); each item has a bold lead + optional supporting line.
  - **`stories`** — a collapsible backlog of user stories rendered as native
    `<details>` accordions (no JavaScript) in a single section; supports cross-doc
    `links[].ref`.
  - **`pattern`** — a GoF-style design-pattern reference card (intent · forces ·
    participants · consequences), for backend/architecture-pattern tutorials.

  Also: the `meta` block gains an optional **`logo`** field that renders in the
  document and slide cover. The getting-started doc gains the logo + an `avo skill`
  reference; a new `docs/tutorial.md` deck and a `docs/be-pattern-repository.md`
  tutorial show the new blocks. Skill, `avo block` templates, and `avo demo`
  showcase updated for all three.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.7.0
  - @avodado/render@0.15.0
  - @avodado/export@0.2.10
  - @avodado/sync@0.0.9

## 0.17.0

### Minor Changes

- Add `avo skill` — print the Avodado authoring grammar as a copy-paste **system
  prompt** for AI tools without a repo-file adapter (Microsoft 365 Copilot, custom
  GPTs, ChatGPT, Gemini). Prints to stdout (pipes cleanly), copies to the clipboard
  in a terminal, supports `-o <file>` and `--raw`. Also fixes large piped output
  being truncated at the 64 KiB pipe buffer on exit.

## 0.16.0

### Minor Changes

- CLI: `avo theme install` now offers to set the theme as the default after a
  successful install (interactive prompt; `--use` still forces it). `avo init` no
  longer silently skips a tool you only highlighted — pressing Enter with nothing
  toggled installs the highlighted adapter, with a clearer footer hint. Rewrote
  `docs/getting-started.md` into an 80/20 tour and added a new deck-first
  `docs/tutorial.md` (rendered with `avo slides`) covering the full block set;
  both ship with `avo init`.

## 0.15.10

### Patch Changes

- Add an `avo prompt slides` prompt for slide-specific formatting (heading-per-slide
  pagination, one idea per slide, `{top}`/`{center}`/`{bottom}` alignment markers, no
  `---` breaks), and mention the alignment markers in the `presentation` prompt.

## 0.15.9

### Patch Changes

- Per-slide alignment override. On top of the auto centering/top-align, a heading
  marker forces a slide's vertical alignment: `## Title {top}`, `## Title {center}`,
  or `## Title {bottom}` (the marker is stripped from the displayed title). Documented
  in the skill's "Slide decks" section.
- Updated dependencies
  - @avodado/render@0.14.0
  - @avodado/export@0.2.9

## 0.15.8

### Patch Changes

- Slides: split on headings only, with auto vertical alignment.
  - `avo slides` no longer treats `---` as a slide break — it renders as a normal
    horizontal rule. Slides split **only** at top-level `#`/`##` headings (a doc
    with no headings still falls back to one slide per block).
  - Slide content is auto-aligned: light slides (≤1 block, little prose) stay
    vertically centered; heavier slides (stacked blocks or lots of prose) top-align,
    so dense slides read top-to-bottom instead of floating in the middle.

- Updated dependencies
  - @avodado/render@0.13.0
  - @avodado/export@0.2.8

## 0.15.7

### Patch Changes

- Fix stale `-p` previews. `avo html|slides|pdf -p` named the temp file by the input
  path, so re-running after an edit overwrote the same file and the browser kept
  showing the cached tab. The preview file is now keyed by content (source + format
  - theme), so each edit opens a fresh tab with the new render; unchanged content
    reuses the same file.

## 0.15.6

### Patch Changes

- Slides split by heading. `avo slides` now starts a new slide at each top-level
  Markdown heading (`#`/`##`), using the heading as the slide title; everything
  until the next heading (prose + blocks) stays on that slide. A `---` thematic
  break still forces a split, and a doc with no headings falls back to one slide per
  block. This means ordinary section-structured docs present cleanly with no special
  markup. Skill "Slide decks" section, presentation playbook, and prompt updated.
- Updated dependencies
  - @avodado/render@0.12.0
  - @avodado/export@0.2.7

## 0.15.5

### Patch Changes

- Skill: add a **Presentation / deck** Document Playbook that points at the `---`
  slide model (one slide per `---`, `#` heading as title), tying the playbooks to
  the existing "Slide decks" section so agents pick it up.

## 0.15.4

### Patch Changes

- Author-controlled slide pagination with `---`.

  `avo slides` now splits the deck on Markdown thematic breaks (`---`): everything
  between two `---` is one slide and can hold several blocks plus prose, with the
  first `#`/`##` heading as the slide title. A document with no `---` keeps the
  previous one-slide-per-block behavior. Documented in the skill (new "Slide decks"
  section) and the `presentation` prompt.

- Updated dependencies
  - @avodado/render@0.11.0
  - @avodado/export@0.2.6

## 0.15.3

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.5

## 0.15.2

### Patch Changes

- Slide titles from Markdown headings, and stronger block routing in the skill.
  - **Slides:** a section's Markdown heading (`#`/`##`) is now the slide's title at
    the top (matching the source), instead of only the block's `title:` field — and
    it's no longer duplicated in the slide body.
  - **Skill:** every block now appears in the "which block when" decision tables, not
    just the glossary — `drivers`, `options`, `spec`, `matrix`, `anatomy`,
    `composition`, `endpoint`, `pullquote`, `layers` were being overlooked because
    they had no routing entry. Fixed the "options compared" signal (was routed to
    `table`, now `options`) and added a worked `belogic` example with UML stereotypes.

- Updated dependencies
  - @avodado/render@0.10.0
  - @avodado/export@0.2.4

## 0.15.1

### Patch Changes

- Updated dependencies
  - @avodado/render@0.9.1
  - @avodado/export@0.2.3

## 0.15.0

### Minor Changes

- Add presentation blocks, `avo prompt`, and diagram-quality fixes.
  - **New blocks (49 total):** `drivers` (factor cards with icon + accent + tag),
    `options` (approaches explored — pros/cons/verdict, chosen highlighted), and
    `spec` (labelled spec sheet with an inline step-flow row).
  - **`avo prompt`** — ready-to-paste authoring prompts wired to the Document
    Playbooks (adr · situation · roadmap · cloud · rbac · api · design · runbook ·
    presentation). `avo prompt list`, `avo prompt <name>`, and `avo prompt new <name>`
    for saved custom prompts. In a terminal it copies to the clipboard; piped, it
    just prints (so `avo prompt adr | pbcopy` works).
  - **Diagram quality:** `block`/`infra` and `felogic`/`belogic` node labels now wrap
    and centre (no overflow/overlap); `swimlane` lane labels wrap; `composition` gets
    coloured per-gate cards with optional `kicker`/`source`; `belogic` kinds render
    UML stereotypes («controller» «service» «repository» «adapter» «gateway»).
  - **Skill:** the three new blocks documented (glossary, field reference, family
    examples) and a **Document playbooks** section mapping a one-line ask to a block
    stack; counts updated to 49.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.6.0
  - @avodado/render@0.9.0
  - @avodado/export@0.2.2
  - @avodado/sync@0.0.8

## 0.14.1

### Patch Changes

- Show which theme is currently active. The `avo theme` picker now marks the active
  theme with `✓ current` and starts with it highlighted, and `avo theme list` marks
  it and prints a "Current default:" line. The active theme is detected from
  `avodado.theme.json` (a plain built-in, a matching saved custom, or an unmatched
  custom override).

## 0.14.0

### Minor Changes

- Remove the `plum` built-in theme. Six themes remain: textbook, minimal, soft,
  dark, teal, slate. `theme: 'plum'` (or `avo theme use plum`) is no longer valid —
  switch any document using it to another theme.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.8.0
  - @avodado/export@0.2.1

## 0.13.0

### Minor Changes

- Add `avo theme install <path>` and clarify `avo theme use`.
  - `avo theme install ./my.theme.json` validates any theme file (must be JSON with a
    valid base `theme` and/or recognized `colors`/`fonts`; unknown keys warn) and
    copies it into `.avodado/themes/` so it appears in the picker and `avo theme use`.
    `--use` activates it immediately; `--force` overwrites an existing saved theme.
  - `avo theme use <name>` (and the shorthand `avo theme <name>`) now confirm the
    theme is the project default.

## 0.12.0

### Minor Changes

- Add `avo demo` and cfonts banners across the rest of the commands.
  - **`avo demo [html|slides|pdf]`** renders the bundled showcase doc (every block
    type) to a temp file and opens it — a zero-setup way to see Avodado. `--no-open`
    writes without opening.
  - The interactive cfonts action banner + fun line now also show on `new`, `check`,
    `render`, `export`, `preview`, `demo`, and the `claude`/`cursor`/`github`/
    `windsurf` installers (previously only `html`/`slides`/`pdf`/`theme`). `init`
    keeps its full wordmark.

## 0.11.0

### Minor Changes

- Auto-provision Chromium for PDF, and teach the authoring skill to repurpose blocks
  and title intelligently.
  - **PDF "just works":** `avo pdf` and `avo export --format pdf` now download the
    matching Chromium on first use instead of failing with a cryptic Playwright
    error. The download uses the _bundled_ Playwright's own CLI, so the browser
    build always matches the library version (no more "Executable doesn't exist at
    …chromium-XXXX"). New `toPdf(doc, { autoInstallBrowser, log })` option and an
    exported `installChromium()` helper; a missing browser otherwise throws a clear,
    copy-pasteable command.
  - **Authoring skill:** new "Repurpose a block" guide (map the _shape of an idea_
    to a block — `quadrant` for any 2-axis 2×2, `anatomy` for any delimited string,
    `matrix` for any X×Y grid) and a "Titles, headings & voice" section (derive all
    titles from the user's own domain wording; never leave scaffold placeholders).
    Also refreshes the embedded MCP skill.

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.0

## 0.10.0

### Minor Changes

- Add saved custom themes and a noun-first `avo theme` surface.
  - `avo theme new <name>` scaffolds `.avodado/themes/<name>.theme.json` (pick a base
    theme, override any friendly color/font).
  - `avo theme list` shows built-in + saved themes; the interactive `avo theme`
    picker now lists your saved themes alongside the built-ins.
  - `avo theme use <name>` activates a built-in or saved theme (shorthand:
    `avo theme <name>`); selecting copies it to the active `avodado.theme.json`.

## 0.9.1

### Patch Changes

- Simplify the per-action CLI banner: drop the ASCII avocado art and the avocado
  emoji, keeping just the action word in avocado-green cfonts plus the status line.

## 0.9.0

### Minor Changes

- Add three access-control block types and give the CLI some flair.
  - **New blocks (46 total):** `matrix` (role × resource capability grid; cells tint
    by permission level), `anatomy` (the labelled parts of a delimited string such as
    `app:feature:action`), and `composition` (effective access as intersected gates,
    `gate₁ ∩ gate₂ ∩ … = result`). All three are theme-aware HTML/CSS.
  - **CLI:** interactive `avo html|slides|pdf|theme` (and `-p` preview) now show a
    per-action banner — an ASCII avocado next to the action word in avocado-green
    cfonts, plus a fun status line — instead of the generic wordmark.
  - **Slides:** `fit()` now measures with `getBoundingClientRect`, so diagrams
    (incl. inline SVG) scale to fit without being clipped.
  - **Docs:** SKILL.md catalog, family sections, strict field reference, and
    block-selection tables updated for all new blocks; counts corrected to 46.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.5.0
  - @avodado/render@0.7.0
  - @avodado/export@0.1.8
  - @avodado/sync@0.0.7

## 0.8.0

### Minor Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.4.0
  - @avodado/render@0.6.0
  - @avodado/export@0.1.7
  - @avodado/sync@0.0.6

## 0.7.0

### Minor Changes

- - **Per-tool skill install/update commands:** `avo claude`, `avo cursor`, `avo github`, `avo windsurf` install or refresh just that tool's adapter + the shared authoring skill (no full project scaffold).
  - **Versioned skills:** installed `SKILL.md` files now carry a `version:` stamped with the CLI version, so you can tell what's installed and re-run a command to update.
  - **`--preview` / `-p`** on `avo html` / `avo slides` / `avo pdf` — render to a temp file and open it in the browser.
  - **Slides:** the gradient rail is static again (derived from the theme accents, no animation), and slide content is now **scaled to fit** so there's no scrolling — diagrams shrink to the slide.
  - **`funnel` and `pyramid` fixed:** the pyramid apex is a flat band (top label fits), funnel stages are wide enough, labels wrap, and both follow the theme colors instead of a fixed palette.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.5.1
  - @avodado/export@0.1.6

## 0.6.0

### Minor Changes

- Gap-filling blocks (inspired by replicating a rich design doc), bringing the catalog to **44**:
  - **`pullquote`** — a standout pull-quote with optional attribution.
  - **`layers`** — a layered explanation: N numbered layers, each with a kicker / title / source / question + body (e.g. an L1/L2/L3 model).
  - **`callout` gains a `success` tone** (green).
  - **`userstory` is richer** — optional `title` and `tags`, shown as a header with the points pill.

  All wired through the schema, renderer, `avo new` templates, and the authoring skill.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.3.0
  - @avodado/render@0.5.0
  - @avodado/export@0.1.5
  - @avodado/sync@0.0.5

## 0.5.0

### Minor Changes

- - **Animated slide rail.** The slide deck's left gradient rail now gently animates (a moving multi-color gradient), respecting `prefers-reduced-motion`.
  - **Short slides center vertically** while taller ones still scroll from the top.
  - **New single-document CLI shortcuts:** `avo html <doc>`, `avo slides <doc>`, and `avo pdf <doc>` — each renders one document (applying the project theme) and writes a single file, defaulting next to the input. `avo export` remains for batch/glob, multi-format output.

### Patch Changes

- Updated dependencies
  - @avodado/export@0.1.4

## 0.4.3

### Patch Changes

- Fix diagrams rendering invisible on slides: the shared SVG `<defs>` (drop-shadow filter + arrow markers) were emitted inside the first slide, which is `display:none` when inactive — and a node referencing `filter="url(#gshadow)"` from a hidden subtree is not rendered, so most diagrams vanished on other slides. The defs are now placed once at the deck root (`renderSlides` returns them separately), so every slide's diagrams resolve their filters/markers and display.
- Updated dependencies
  - @avodado/render@0.4.1
  - @avodado/export@0.1.3

## 0.4.2

### Patch Changes

- Slides export refinements: each slide now has a header with the **title on the top-left and the section number/label on the top-right**; the left accent is a single shared **gradient rail** (same on every slide); the cover slide centers its title and drops the top bar; and the slide layout was fixed so **diagrams display and scale/scroll** correctly instead of being clipped by the fixed-height stage.
- Updated dependencies
  - @avodado/export@0.1.2

## 0.4.1

### Patch Changes

- Slides export polish: every slide is now the same fixed 16:9 size, sized to fit the viewport and centered, with content centered and diagrams scaled to fit (so wide blocks like `sequence` are no longer cut off — overflow scrolls). The colored accent edge moved from the right to the left.
- Updated dependencies
  - @avodado/export@0.1.1

## 0.4.0

### Minor Changes

- Add a **slides / presentation export**. `avo export <doc> --format slides` produces a self-contained HTML deck — one slide for the cover and one per section — with keyboard (←/→, Home/End), button, and jump-to-section navigation, and a coloured right edge per slide. New `renderSlides` in `@avodado/render` and `toSlides` in `@avodado/export` back it (static HTML + a tiny vanilla-JS controller, no runtime dependency). Also prints cleanly (one slide per page).

### Patch Changes

- Updated dependencies
  - @avodado/render@0.4.0
  - @avodado/export@0.1.0

## 0.3.2

### Patch Changes

- Fix `avo init` generating adapters for tools you didn't pick: the wizard's AI-tool list no longer starts with everything pre-selected. It now starts empty, so you toggle on only the tools you use (space to select, enter to continue) and get only those files. `avo init --yes` still scaffolds all adapters for non-interactive use.

## 0.3.1

### Patch Changes

- The `endpoint` block's request/response examples (and per-response examples) are now syntax-highlighted JSON — keys, strings, numbers, and `true`/`false`/`null` get theme-aware colors. Highlighting is done at render time (static colored spans, no runtime), and non-JSON snippets pass through safely uncolored.
- Updated dependencies
  - @avodado/render@0.3.1
  - @avodado/export@0.0.15

## 0.3.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.2.0
  - @avodado/render@0.3.0
  - @avodado/export@0.0.14
  - @avodado/sync@0.0.4

## 0.2.10

### Patch Changes

- Edge/relationship labels are now drawn in a final pass — on top of all lines and nodes — in **every** diagram block. The remaining ones that still drew labels inline (`felogic`/`belogic`, `graph`, `swimlane`, `cluster`, and the `erd` relation label) are fixed, so a connector line never crosses out a label anywhere.
- Updated dependencies
  - @avodado/render@0.2.7
  - @avodado/export@0.0.13

## 0.2.9

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.
- Updated dependencies
  - @avodado/render@0.2.6
  - @avodado/export@0.0.12

## 0.2.8

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.
- Updated dependencies
  - @avodado/render@0.2.5
  - @avodado/export@0.0.11

## 0.2.7

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.
- Updated dependencies
  - @avodado/render@0.2.4
  - @avodado/export@0.0.10

## 0.2.6

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.
- Updated dependencies
  - @avodado/render@0.2.3
  - @avodado/export@0.0.9

## 0.2.5

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.
- Updated dependencies
  - @avodado/render@0.2.2
  - @avodado/export@0.0.8

## 0.2.4

### Patch Changes

- Diagram rendering polish:
  - **Edge labels are never crossed out.** All diagram renderers (`flow`/`dag`, `c4`, `state`, `dfd`, `uml`, `block`/`infra`/`event`/`ddd`/`network`) now draw labels in a final pass, on top of the lines and nodes — fixing the "state lifecycle" labels being struck through by later transitions. Label pills are theme-aware.
  - **`dfd`** boxes are smaller with more separation so flow labels fit between them.
  - **`c4`** person nodes draw the persona glyph in the top-right corner, clear of the title/description text.
  - **`uml`** class boxes and fonts are smaller; the class boxes and compartment rules now follow the theme.
  - **`infra`/`block`/`network`/etc.** get more outer padding/margin and theme-aware layered-mode colors.
  - Left-accent blocks (`callout`, `userstory`, `toc`, kanban cards) have square accent (left) corners and rounded right corners.

- Updated dependencies
  - @avodado/render@0.2.1
  - @avodado/export@0.0.7

## 0.2.3

### Patch Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).
- Updated dependencies
  - @avodado/core@0.1.0
  - @avodado/render@0.2.0
  - @avodado/export@0.0.6
  - @avodado/sync@0.0.3

## 0.2.2

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.
- Updated dependencies
  - @avodado/render@0.1.2
  - @avodado/export@0.0.5

## 0.2.1

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).
- Updated dependencies
  - @avodado/render@0.1.1
  - @avodado/export@0.0.4

## 0.2.0

### Minor Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.1.0
  - @avodado/export@0.0.3

## 0.1.1

### Patch Changes

- Fix `avo --version` (and the help banner) reporting a hard-coded `0.0.1` — the CLI now reads its real version from its own package.json.

## 0.1.0

### Minor Changes

- Interactive `avo init`: a guided wizard (with a cfonts AVODADO banner) that asks which AI tools you use — Claude Code, Cursor, GitHub Copilot, Windsurf — and writes only those editor adapters, then lets you pick a theme (with a Custom option that scaffolds `avodado.theme.json`). Pass `--yes` to skip the wizard and scaffold with defaults (CI/non-interactive).

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2
  - @avodado/render@0.0.2
  - @avodado/export@0.0.2
  - @avodado/sync@0.0.2

## 0.0.1

### Patch Changes

- aaa2610: Initial public release (0.0.1).
  - **@avodado/core** — parser, Zod schemas for all 41 block types, the typed block
    registry, document validator with precise diagnostics (line/column, did-you-mean,
    hints), and the cross-document reference resolver.
  - **@avodado/render** — `renderDocument` (standalone styled HTML) and
    `renderDocumentParts` (embeddable parts: CSS + body + sections) with inline SVG
    diagrams and 6 themes.
  - **@avodado/export** — HTML + PDF export (PDF via Playwright, optional).
  - **@avodado/cli** — the `avo` CLI: `init / new / check / render / preview / export /
sync`, with a code-frame diagnostics UI and the authoring skill scaffolder.
  - **@avodado/sync** — generate Avodado docs from external sources (OpenAPI).
  - **@avodado/mcp** — Model Context Protocol server exposing the doc tooling to any
    MCP client.

- Updated dependencies [aaa2610]
  - @avodado/core@0.0.1
  - @avodado/render@0.0.1
  - @avodado/export@0.0.1
  - @avodado/sync@0.0.1
