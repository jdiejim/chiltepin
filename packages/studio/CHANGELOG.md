# chiltepin-studio

## 0.16.6

### Patch Changes

- 9713c5b: `lang: text` (also plain, plaintext, prompt) in a code block renders with no syntax highlighting; the generic keyword pass was colouring ordinary English in prompts and notes.

## 0.16.5

### Patch Changes

- eda853c: `flow` nodes of kind `agent` and `llm` draw as the agent card: the sparkle mark, the name, and the second label line as a mono model chip.

## 0.16.4

### Patch Changes

- 4ddfd9a: `flow` gains AI node kinds — `agent`, `llm`, `tool`, `human`, `memory` — drawn with a kind chip and listed in the legend, so an AI workflow (RAG, routing, multi-agent hand-off, generate → check → repair) is drawn from the request instead of the fixed `agentloop` frame. The skill routes workflow questions to `flow` / `swimlane` / `cycle` and keeps `agentloop` for one agent's loop.

## 0.16.3

### Patch Changes

- eea0f64: Republish: the 0.33.2 tarball predates the muted section rules and the prose table and link styles. This patch carries them.

## 0.16.2

### Patch Changes

- 8dc104c: Markdown pipe tables inside prose render like the table block (frame, header row, row rules, alternating rows) and prose links use the link colour; they were unstyled.
- 487b111: Section titles and the page footer use a 1px muted rule instead of a 2px ink line, so dark pages have no bright horizontal bars above blocks.
- c0b7e3e: Tables have a visible frame and row rules again: a new `--rule-table` token (32% ink in light, 28% in dark) replaces the 13% hairline on every table kind, and the plain `table` block gets a 1px rounded border.

## 0.16.1

### Patch Changes

- d712087: The 8px band above a document cover is gone: pages, Studio, and exports start at the cover meta line.
- 82cb733: The Studio home shows every document as a card with a rendered thumbnail of its first block, instead of a table row.

## 0.16.0

### Minor Changes

- 32b6304: Avodado is now **Chiltepin**. New package names: `chiltepin` (CLI, binary `chiltepin`), `chiltepin-core`, `chiltepin-render`, `chiltepin-studio`. The skill installs with `npx skills add jdiejim/chiltepin`. The config file is `chiltepin.config.*`; the old `avodado.config.*` still loads with a warning for now, and an existing `.avodado-build.json` manifest is read once and replaced. The `avo` binary and the `@avodado/*` packages are deprecated on npm with a pointer here. New logo and favicon.

## 0.15.1

### Patch Changes

- ee53ca2: The Studio tour no longer offers a PowerPoint export that was removed in 0.45.

## 0.15.0

### Minor Changes

- 45e3ff8: Thirteen new block types and a new family. **Quality & audits**: `audit` (severity-ranked findings with evidence, fix, owner, status and a count strip), `checklist` (pass / fail with evidence, `"[pass] item — evidence"` terse form, pass rate derived), `perfbudget` (budgets vs measured, over / near / ok derived), `percentiles` (p50 … p99 · max per row on one axis with the SLO rule), `threatmodel` (dfd shapes inside dashed trust boundaries plus a STRIDE threats table). **UML**: `usecase` (actors, system boundary, include / extend / generalize), `pkg` (package diagram with dashed dependencies), `timing` (lifelines stepping through states over time). **ML**: `neuralnet` (layered network with unit counts and activations), `modelcard`. **Deck shapes**: `chevrons` (process strip with the current phase), `roadmap` (themes × periods with status chips and a now rule), and `mindmap`. `chart` gains six kinds: `pie`, `histogram`, `bell` (normal curve with σ bands and z-scored markers), `boxplot`, `pareto` (80% rule), `bullet`. The skill gains `reference/blocks/quality.md`, entries for every new block, and `reference/patterns-design.md` (the 23 GoF and the common architectural patterns mapped to block stacks); the generation eval gains 15 scenarios for them. 107 block types across 13 families.
- 45e3ff8: Dark is the look.
  - The render skin's bare `:root` now carries the dark set — deeper surfaces (`paper #15171d`, `paper-2 #1d2028`), the rust accent lifted, and a new drawing **well**: every diagram stage paints a step below its frame with the dot grid and a faint centre glow inside a hairline inset. Light is the explicit choice (`data-theme="light"`) and the print look, always.
  - New `colorScheme` in `avodado.config.json`: `dark` (default), `light`, or `system` (the reader's OS chooses). `avo html`, `avo slides`, `avo build`, `avo serve`, and Studio's site mount honour it; `renderDocument`, `toSlides`, and `buildSite` take a `colorScheme` option.
  - Studio's chrome is dark-first too and follows the same setting, so the canvas and the app never disagree. `/api/meta` reports the scheme.
  - `LIGHT_SET`, `DARK_SET`, and `systemSchemeCss` are exported from `@avodado/render` for hosts that compose their own page.

### Patch Changes

- 45e3ff8: Repair the unquoted-comma trap instead of reporting it. A single-line `{ … }` map whose cell has no key of its own (`label: Hold as BACKORDERED, email ETA`, `value: 1,000,000 followers`) is folded back into the field before it on the source line, before YAML parses it, so the text survives exactly. `E_PARSE_YAML` now says what to do for a `[ ]` inside a row cell and for an inline map that does not close on its line. A terse line whose text holds a colon (`name type required — Sum: lines plus tax`) is rescued from the single-pair map YAML makes of it. The skill gains `reference/patterns.md`: twelve messaging and event patterns (pub/sub, competing consumers, partitioned streams, backbone, outbox, dead-letter and retry, CQRS, event sourcing, saga, scatter-gather, backpressure and circuit breaker, CDC and webhooks, idempotency), each as a block stack with its trap; the generation eval adds seven scenarios for them.
- 45e3ff8: Fixes from the first generation eval (16 fresh-agent scenarios, `evals/generate`).
  - Drawings wider than 1600 viewBox units (a 12-state machine, a 14-node data flow, an 8-participant sequence) no longer shrink to half size: the stage keeps the drawing at its natural width and scrolls sideways. Print and slides still fit to the page.
  - State-machine numerals dodge state boxes, as the other graph renderers already did.
  - Gantt period heads stagger onto two rows when they do not fit their column, and cut with a tooltip when even two columns are too narrow.
  - A long quadrant y-axis endpoint label widens the left gutter instead of clipping.
  - Slopegraph labels get two more pixels of separation.
  - `avo check` hints: an unknown field that looks like a value fragment now names the unquoted-comma trap and shows the quoted form; a string where a list expects an object lists the terse forms that exist for that list.
  - Studio bundles the renderer, so its canvas picks up the same fixes.

- 45e3ff8: Diagram conventions checked against practice.
  - `block` and `cluster`: `gateway`, `lb`, `proxy`, and `ingress` draw as the tall vertical bar of system-design diagrams instead of a hexagon or octagon. A bar spans the rows of the services it fans out to on its own, or the rows `h` names; arrows meet the bar, not the cell around it. `block` nodes accept `h` (row span) beside `w`.
  - New `W_EDGE_LABEL` warning: a `c4` relationship without a `label`. The C4 notation asks every line to name its intent and container lines their technology.
  - The skill's organizing guide adds the four document kinds (tutorial, how-to, reference, explanation) with the blocks each reaches for.

- 45e3ff8: One-command install and a schema-derived block reference.
  - The authoring skill lives once, at `skills/avodado/`, laid out so `npx skills add jdiejim/avodado` installs it into Claude Code, Cursor, Codex, OpenCode, and 70+ agents. The skill runs the CLI through `npx -y avodado`, so nothing has to be installed in a project.
  - New `avo block [type]`: every block on one line (no argument), or one block's fields, enums, terse one-line forms, and a validating example — generated from the zod schema (`blockContract` / `formatBlockContract` in `@avodado/core`), so the reference can never drift. `--json` for the structured form. The hand-written `reference/blocks/contract.md` is gone; family files are short selection sheets.
  - `SKILL.md` is a 120-line fast path: pick, `avo block`, write, `avo check --json`, fix by code, two rounds maximum, handoff receipt.
  - Removed: `avo explore` (tour, design patterns, compare, catalog), `avo install <tool>` and the per-tool adapter templates, `avo pptx` and Studio's PowerPoint export, the `avo init` wizard and `--scope`. `avo init` now writes only `avodado.config.json` and the two starter docs. `avo demo` stays.
  - The MCP server embeds the skill from `skills/avodado/`.

- 45e3ff8: `swimlane` is the block for "who does which step, in what order", and it is harder to get wrong.
  - A step names its lane by label or id (`lane: Sales`, case-insensitive) as well as by index; an unknown lane is `E_SWIMLANE_LANE`, listing the lanes.
  - `col` is optional. Columns derive from the links — a step sits one column after its predecessors; unlinked steps follow — through `swimlanePlacements` in core, so the renderer, the Studio canvas, and `avo check` agree.
  - `phases` bands the columns as a header row (BPMN milestones). Links take `kind: dashed | error` and the `-->` / `-x->` arrows. Steps take `note` and `accent: true`, and the terse form `id: Label · Lane · kind`.

- 45e3ff8: Vary the lens. A new `W_LENS_REPEAT` warning fires on the third `callout` in one document and on the fourth block of any other structural type (tables, code, and one-per-item blocks such as `endpoint` and `userstory` are exempt), naming the block that usually fits instead. The skill gains the matching rule. `swimlane` takes lane labels instead of indices, derives columns from the links when `col` is omitted, draws `phases` bands, accepts dashed and error links, a `note` and one `accent` step, and a terse step line `id: Label · Lane`. `code` gains `highlight` line ranges, `lines` with `start`, `caption`, `cols` for a snippet grid, `kind: compare` for before / after, and `wrap`. The README is rewritten around what the tool does today, with the eval numbers and a rendered hero.

## 0.14.0

### Minor Changes

- 9528f0c: Right-click menus for the list-ordered blocks. `glossary`, `faq`, `steps`, `list`, `takeaways`, `agenda`, `team`, `stats` and `saga` place their parts by array order, so they were draggable but had no menu. They now share one: on an item, `Move up` / `Move down` (`Move left` / `Move right` where the block lays out in a row — `saga`, `stats`, disabled at the ends), `Duplicate` (any `id` regenerated so ids stay unique), `Insert before` / `Insert after` (a blank, schema-valid item that opens for editing), and `Delete`; on the background, `Add <term|question|step|item|takeaway|member|stat>` and `Open YAML`. The move items commit the SAME array splice the drag and the ⌥-arrow nudge already commit, and the item-count bounds each schema declares disable `Delete` at the minimum and the inserts at the maximum (`takeaways`: 2–6). Two kinds add their own choices: a `saga` step gets `Set as failure point` / `Clear failure point` (the block's `failAt`), `Status ▸` (ok · failed · skipped · compensated, checkmark on the status the renderer derives) and `Remove compensation`; a `stats` card gets `Trend ▸` (up · down · flat · none). Deleting the step that `failAt` names clears the key in the same write, so the block never lands in a state the schema rejects.
- 02bc78b: One look. Theme presets are gone: the editorial skin is the single look for every export, and it follows the reader's OS light/dark setting. Removed: `avo theme` (and `avodado.theme.json`, `.avodado/themes/`, `~/.avodado/themes/`), the theme step in `avo init`, the `theme` line in the bare `avo` status, the Studio theme panel with its `/api/theme` route and `/api/meta` theme fields, and the `theme` parameter of the MCP `render_document` tool. A leftover `theme` key in `avodado.config.json` is ignored silently. `@avodado/render` keeps `ThemeName` as the single name `textbook` (label `Editorial`), `themeStyle()` returns `''`, rendered pages no longer stamp `data-theme` on `<html>` (the `[data-theme="dark"]` CSS stays so a host page can force dark), and `themeVars` remains an internal `:root` override with no user surface.
- 2b88a17: Studio: right-click menus and motion on the direct-edit layer.
  - **Context menus** (right-click, ⇧F10, the Menu key) on every diagram part — grid nodes (add a connected node in a direction with a kind picker, change kind, replicas, add to / remove from group, rename, delete with its edges), edges (kind, edit label, reverse, delete), empty cells (insert node / group), the block background (insert node, direction, open YAML), sequence actors and messages (connect mode, notes, kind, wrap a range in `alt`/`opt`/`loop`/…, activate/deactivate, delete), ERD entities and columns (add column, relation mode, pk/fk/unique/nullable/indexed toggles, delete). Every item is ≤ 2 clicks from the right-click and writes the same YAML ops the drag/connect layers emit — one undo step each.
  - **Motion**: commits play a FLIP (transform-only, 140 ms ease-out) across the re-render; new parts pop, re-routed edges crossfade, deletions fade out first. The connect ghost edge is dashed terra and the snap target gets a highlight ring. All skipped under `prefers-reduced-motion`.
  - `felogic` and `cluster` join the connect-spec table (drag-to-move, connect, menus); the felogic renderer now emits the grid metadata attrs the editor reads (no visual change).
  - core exports `SEQUENCE_FRAME_KINDS`.

- 76ec7dd: Pen mode — draw a rough shape on a diagram and get the right node. Press `D`
  on a selected diagram block (or hit the pen in its floating toolbar), and the
  block becomes a drawing surface: strokes leave an ink trail, and on release
  the stroke's bounding-box centre snaps to a grid cell, the cell flashes, and
  the node commits and pops. A rectangle is a process (flow) or a service
  (block, c4, dfd, felogic); a diamond is a decision or a gateway; a pill or an
  ellipse is the start of a flow, then its end; a cylinder is a database or a
  store; a hexagon is a gateway, then a queue; a triangle is an error exit, or a
  k8s ingress. A LINE between two nodes becomes an edge in the direction it was
  drawn; from a node into empty space it adds a node there and connects it. A
  scribble over a node deletes it. Esc leaves pen mode; touch and stylus work
  (`touch-action: none` while drawing), and `prefers-reduced-motion` skips the
  flash.

  Recognition is a $1 unistroke recognizer (`direct/sketch.ts`, pure) with
  programmatically generated templates. It is tuned for PRECISION over recall:
  a stroke is only committed when it beats the runner-up shape by a margin, so
  a genuinely ambiguous read (a stadium and an ellipse are close under hand
  noise) opens the existing kind picker at that cell with the near-miss kinds
  listed first, instead of inserting the wrong node. A shape with no meaning on
  the block — a cylinder on a state machine — opens the picker too. Studio
  still writes only DATA to the `.md`: node kind, `col`/`row`, and edges.

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

- 430ba0b: Schema importers keep two tables apart; the one-accent rule says what it means.

  **`auth.users` and `public.users` are two tables again.** Every schema importer
  — SQL DDL, DBML, Prisma — merged them into one entity: columns from both, the
  later `id` type overwriting the earlier, foreign keys re-pointed at the fusion,
  and `avo sync sql` printing "2 entities · 1 relations · avo check: clean". The
  resolver fell through to a bare-name match even when the reference carried a
  schema that did not match. An entity is now identified by its schema _and_ its
  name, where "no schema" is an identity of its own; a qualified reference
  matches only the same qualifier, an unqualified one still resolves when exactly
  one table carries the name, and a name two schemas share is reported —
  `"users" is ambiguous — 2 tables carry that name (auth.users, billing.users);
qualify it as \`schema.table\``— instead of guessed. Declaring the same table
twice (a second`CREATE TABLE users`, `Table users {`, or `model User {`) is
now an error with its line, rather than a silent merge; `IF NOT EXISTS`and`OR REPLACE` are respected.

  **Importing a large schema is linear.** Entity and column lookup went through
  up to three `Array.find` scans per declaration, which made every importer
  quadratic in table count: a 32 000-table schema took 5.9 s of scanning. Lookup
  is now a map — 147 ms for the same file, and resolution reads no element of the
  entity array at all.

  **The one-accent rule in `DESIGN.md` said "at most two elements", which was
  wrong.** A focal thing is not always one mark: `spans` accents the critical
  path, which is a chain, and `flow` accents each arrival that ends well, which
  is a node plus the edge into it. The rule now reads "one focal thing, drawn at
  whatever size it is — and never two unrelated things", states that a per-item
  `tone` / `status` accent is the author's count and not the renderer's, and is
  enforced by a new test that carries one declared row per block type, checks
  every catalog example against it, checks that a renderer-chosen accent does not
  grow with the data, checks that an author-marked accent is zero without the
  marks, and checks structurally that the marks of a path or an arrival belong to
  the same thing. No renderer changed; no rendered output changed.

  The no-hex test now sweeps every file under `packages/render/src`, not only
  `blocks/` and `svg/`, so a colour literal in `deck.ts` or any other renderer
  file is caught.

- d1a5570: feat(core): Mermaid input dialect — a ` ```mermaid ` fence parses into a typed block
  - A ` ```mermaid ` fence whose first line is `sequenceDiagram`, `flowchart` / `graph`, `erDiagram`, `stateDiagram` / `stateDiagram-v2`, or `pie` parses into the matching `sequence`, `flow`, `erd`, `state`, or `chart` (donut) block with `sourceType: 'mermaid'`. The converter (`core/src/mermaid/`, `convertMermaid`) emits exactly the data the block schema accepts, so validation and rendering are identical to a YAML block. Any other Mermaid grammar (gantt, classDiagram, mindmap, …) stays prose, exactly as before, and is never flagged as a suspect fence.
  - New diagnostic code `E_PARSE_MERMAID` (error, same shape as `E_PARSE_YAML`, positioned at the offending body line) for a line outside the supported subset. A Mermaid fence never emits `W_ALIAS_TYPE`.
  - `replaceBlockBody` on a Mermaid segment rewrites the opening fence to the canonical block tag, so an edit from Studio or the MCP writes YAML under ` ```sequence ` (etc.), never YAML under ` ```mermaid `. New `editableBodyYaml(seg)` returns the YAML an editor starts a structured edit from (bare-text and Mermaid bodies canonicalized). Studio uses it for its sheet and direct edits.
  - New skill reference `reference/mermaid.md` (installed by `avo init` / `avo install`, embedded in the MCP skill) documents the exact subset, what is ignored, and what is lost; `SKILL.md` gains the `E_PARSE_MERMAID` row. New catalog example `docs/examples/mermaid-dialect.md`.
  - Exports: `MERMAID_SOURCE`, `MERMAID_KEYWORDS`, `detectMermaidKind`, `convertMermaid`, `mermaidBodyYaml`, `editableBodyYaml`.

- 3a8d480: `sequence` is now a complete sequence diagram. Core: `messages[]` items are a union of a message (now with `activate` / `deactivate`), a frame open (`{ frame: alt | opt | loop | par | break | critical, label? }`), a frame else (`{ else: label }`) and a frame end (`{ end: true }`); terse forms `- alt: token valid`, `- else: expired`, `- end`, and `A -> +B` / `B --> -A` activation signs; a new `W_SEQ_FRAME` warning for a stray `else`/`end` or an unclosed frame; the density budget counts messages only; the Mermaid dialect keeps `alt`/`opt`/`loop`/`par`/`critical`/`break` … `else`/`and`/`option` … `end` and the `+`/`-` activation suffixes instead of dropping them. Render: variable row heights, UML frames (tab, `[guard]`, dashed else divider, nested insets) drawn under the lifelines, explicit or inferred activation bars (a bar opens on an incoming call and closes on its reply), real self-message loops, note boxes beside one lifeline or over two, and frame dividers in the step list. Studio: the message form and inline editor pick the union arm that matches the item, and step numbers skip frame markers.
- d5e8928: Sequence polish found by the write eval: message labels get a paint-order halo so text stays legible where it crosses a lifeline; `foot` items render as spaced pills instead of running together; step-list error rows no longer inherit the generic `.err` block style. Core: an unquoted numeric or boolean label in a terse arrow item (`A -> B: 200`) now expands to a string label instead of failing schema validation.
- f8df705: Editorial skin (`packages/render/DESIGN.md`) on the graph-family SVG renderers: `state`, `dfd`, `swimlane`, `cycle`, `gitgraph`, `graph`, `cluster`, `felogic`, `frontend`, `uml` and `c4`. Kinds now travel through stroke weight, dash, fill and eyebrow chips (`EXT`, `DB`, `DECISION`, `WAIT`, `INTERFACE`, `CONTROLLER`, `ROOT`, `VISITED`, `PERSON`, `SYSTEM`, `CONTAINER`, …) instead of a hue per kind; each diagram spends colour on one accent the renderer derives from the data (the success exit of a state machine, the single external entity of a DFD, the trunk of a branch graph, the target of a graph walk, the entry module of a logic graph, the root of a component tree, the single interface of a class model, the system in scope of a top-level C4 diagram) and on `negative` for real error exits. Every figure gets a legend strip listing only the encodings it used. The legacy hex palette (`svg/legacyPalette.ts`) is gone; `cluster` draws its services with the block family's shaped nodes. Studio bundles the renderer, so it ships the same skin.
- f8df705: Editorial skin, group B — charts and data-structure renderers move to the role tokens (`DESIGN.md`): `chart` (every kind), `heatmap`, `treemap`, `sankey`, `slopegraph`, `quadrant`, `venn`, `wardley`, `gantt`, `journey`, `stats`, `palette`, `fishbone`, `tree` (issue / org), `array`, `linkedlist`, `bintree`, `hashmap`. Charts spend colour on series only: one series is `ink`, 2–5 series take the desaturated `--series-1…5` ramp in order, `accent: red` is `negative`; donut / gauge / waterfall / funnel step down the ink ramp. Heatmaps ramp `paper-2` → `ink` in five steps. Every diagram emits a legend strip naming the encodings it used; algorithm tones (`active` / `target` / `visited` / `muted`) are told apart by outline, fill and dash. No hex in any of these renderers; `svg/dsTone.ts` is the one file that carries the series fallbacks.
- f8df705: Editorial skin, rollout C: every HTML-rendered block now follows `DESIGN.md`.
  - `css.ts` carries hex only inside the `:root` / dark token blocks; every rule names a role. New tokens: `--series-1…5` (chart series ramp, light + dark), `--ink-2` / `--ink-3` (tone steps for the heatmap ramp), and `--code-*` for the one deliberate dark surface (code, diff, terminal, gallery cards).
  - Tables (`table`, `matrix`, `statustable`, `tracker`, `scorecard`, `harvey`, `scenarios`, `benchmark`, state transition tables): a `paper-2` header band with eyebrow text in `muted`, hairline rows, 50 % `paper-2` zebra, 6 px radius, no shadows. The featured / winning / base column is the one accent (accent underline in the header, `accent-tint` down the column).
  - One status-chip encoding for every status, priority, tone and kind pill (statustable, kanban, tracker, changelog, okr, risk, inventory, endpoint status, trace roles, options verdicts): a word plus ink outline · `paper-2` fill (done) · accent outline (current / recommended) · negative outline (blocked / error) · dashed outline (todo / future). No hue per status.
  - Callouts: tone by left rule only (note hairline, tip accent, warn / danger negative, info link, success ink on paper-2); text is always ink.
  - Cards (options, drivers, composition, spec, list, stories, pattern, gallery, figure, envelope, slo, okr, persona, team, dodont, trace, prompt, changelog, risk, faq, palette, swot): paper surface, `rule-solid` hairline, 6 px radius, no shadow, no coloured top bars. Avatars are `paper-2` with ink initials; ✓ is ink, ✗ is negative; bignumber, pullquote, scqa and the envelope result are ink with at most one accent rule.
  - Diagram-like HTML (layers, archmap, storymap, composition, anatomy, agentloop, context, packet, wireframe): paper / paper-2 fills, ink strokes, `.t-eyebrow` chips for kinds. Storymap: the slice label column no longer clips, activity headers are paper cards with a `STEP n` eyebrow and `.t-name`, and only the first release slice carries the 3 px accent rule. Agentloop: the agent card is the one accent; tools and memory are paper-2. Context: segments use the series ramp and labels sit on a paper mask. Packet: fields alternate paper / paper-2 with ink strokes. Wireframe: ink / negative / paper-2 buttons, no drop shadow.
  - `okr` renders each key result's status as a word chip next to the bar, so the bar tone never carries the status alone.
  - Contrast: every text element in these blocks clears WCAG AA (4.5:1). `--soft` moves to `#5f6876` (4.8:1 on paper-2). The contrast audit script now scrolls instantly so elements below the fold are measured against their real background.

- f8df705: Editorial skin, group D — everything around the rendered document. The `avo build` site chrome (sidebar, index page with its groups, cards and TLDR, the Doc | Slides toggle, the deck's back-link) and the slide deck (stage, header, tracker, footer, cover, bottom nav) now draw only from the skin's role tokens (`--paper`, `--ink`, `--muted`, `--soft`, `--rule`, `--accent`, `--link`): Inter body, mono eyebrow labels, hairlines, no shadows, no filled pills; index tags and the deck tracker are outlined mono chips. Both stamp `data-theme` on `<html>` when a theme is chosen explicitly, so it never mixes with the reader's system dark mode. Studio's `--stu-*` token values align with the skin (paper `#f7f6f2`, ink `#1f2430`, muted `#4f5868`, hairline `rgba(31,36,48,.14)`, accent `#b04a25`; navy stays for controls) in both its light and dark sets, and the canvas now knows when the document follows the system dark scheme so selection and hover outlines read on either surface. `avo theme` files map onto the skin: colors emit the role names first (`paper`, `ink`, `muted`, `soft`, `rule`, `accent`, `link`, `negative`) with the legacy names (`--navy`, `--charcoal`, `--highlight`, `--blue`, …) as aliases of those roles; `primary`/`secondary` keep working. The contrast audit script takes `--root <selector>` to audit a whole page.
- 430ba0b: Keep terse list forms when a whole list is rewritten.

  A list written in terse sugar (`- App -> Auth: POST /token`) used to survive
  only until something wrote the whole array back: `setYamlPath` handed the value
  to the `yaml` library's `setIn`, which reserialises from plain data, so deleting
  one message rewrote every other one as three lines of `from:`/`to:`/`label:`.
  One deleted line became a rewrite of the block, and the `.md` diff — the review
  surface — stopped showing what actually changed.
  - **`contract`, the inverse of `expand`.** Every terse grammar in
    `blocks/normalize.ts` now has a `contract(value)` that writes the canonical
    object back as its terse string. A contraction is used only when
    `expand(contract(v))` deep-equals `v`, so an item carrying anything the
    grammar cannot say — a `summary`, a `note`, a `kind` no arrow spells, an id
    the grammar would re-split — falls back to the object form on its own.
  - **New exports:** `contractTerseItems(kind, field, items)`,
    `contractTerseValue`, `canonicalTerseItem`, `hasTerseGrammar`, and
    `contractTerseAt(raw, path, kind)` — the way back after a deep edit had to
    expand an item, so renaming one field on a terse line keeps it one line.
  - **`setYamlPath(raw, path, value, kind?)`** takes an optional block kind. With
    it, an unchanged item keeps the author's own YAML node (byte-identical, with
    its comments and quoting), a new item is contracted where that is faithful,
    and a list the author wrote entirely in field form stays in field form.
    Without it the behaviour is unchanged.
  - The terse grammars now live in one registry that both parsing and editing
    read, so the two cannot drift. That registry fix also makes the arrow sugar
    (`- web -> pg: writes`) work for `cluster` edges, where it was registered
    against a field name no cluster body has.
  - **Studio** commits through the kind-aware write, and the menu ops that could
    address one index now do: a leaf-node / actor / entity delete, an append, and
    a duplicate or insert at the end of a list. A reorder still rewrites its list
    — that is what the preservation above is for.

## 0.13.0

### Minor Changes

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

### Patch Changes

- e1f3a0e: feat(core,cli): per-type density budgets — `avo check` now warns when a diagram should be split
  - New core lint `lintDensity(doc, file)` and exported `DENSITY_BUDGETS` map: conservative per-type complexity caps (sequence >8 actors or >24 messages; flow/dfd >24 nodes; state >16 states; c4/block/felogic/frontend >20 nodes; erd >12 entities; tree >40 nodes; graph >30 nodes; cluster >16 services; archmap >8 areas; kanban >8 columns; timeline >20 items; journey >10 stages). Pure counts, no heuristics; a block at exactly the cap passes.
  - New diagnostic code `W_DENSE_BLOCK`, wired into `avo check` beside the prose lint. Always a warning with a per-type split suggestion — it never affects the exit code, and `--strict-prose` does not escalate it.

- e1f3a0e: `avo check` now enforces the on-disk convention with `W_DOC_CONVENTION` warnings: doc filenames under the docs root must be kebab-case slugs, and docs may sit at most one group level deep (`docs/<area>/<doc>.md`). Files outside the docs root are not checked. The warnings never gate the exit code and no flag escalates them. `avo init` documents the layout in its config template, its summary line, and the skill's `reference/organizing.md` ("Where files live"). `@avodado/core` adds the `W_DOC_CONVENTION` code to the diagnostic union.
- 65ec84b: Export size presets and accessibility fixes.

  `avo html` and `avo pdf` accept `--size sm|md|lg|xl` (720 / 960 / 1280 / 1600 px page width). Without the option, output keeps the default width (1180 px content column; A4 PDF page). For PDF, the preset sets the page width with portrait A-series proportions.

  Accessibility: harvey rating balls now carry `role="img"` and an `aria-label` ("N of 4"). Theme tokens that failed WCAG AA text contrast were darkened: the muted-text gray in the base palette (`#8a8475` → `#6f695b`), `minimal` (`#888888` → `#6e6e6e`), and `soft` (`#8b93a7` → `#646c7e`); the accent in `teal`/`soft` (`#f59e0b` → `#b45309`) and `slate` (`#0d9488` → `#0d6d66`).

- e1f3a0e: feat: new `fishbone` block type (88 total) — cause & effect (Ishikawa) analysis. One `effect` at the head of a horizontal spine, 1–8 `causes` as bones alternating above and below, up to 8 `items` (specific causes) ticked along each bone. The renderer spaces bones by label width, so long labels grow the diagram instead of overlapping; text stays horizontal and wraps with an ellipsis past four lines. Studio and MCP pick up the new type via the bundled core/render and the regenerated embedded skill.
- 65ec84b: Fan-in entry ports in the shared `ortho` edge router: when two or more edges terminate on the same side of the same node, each gets its own entry port along that side (centered spread, 8px apart, capped to the side's length, ordered by source node id), so their final segments and arrowheads no longer stack. A side with a single incoming edge keeps the previous geometry byte-for-byte. Applies to every block-diagram renderer that routes with `ortho` (block, flow, graph, dfd, state, c4, cluster, swimlane, felogic and their aliases). Studio and MCP are patched because they bundle the renderer.
- 65ec84b: fix(render): the typed `prose` block now renders inline Markdown (bold, `code`, links) in headings, paragraphs, list items, and quotes through the same hardened pipeline as `callout` and `pullquote`. Literal HTML stays escaped; block structure is unchanged.
- e1f3a0e: feat(core,cli): STE-informed prose linter — `lintProse` in core, wired into `avo check` with `--strict-prose`
  - `@avodado/core` exports `lintProse(doc, file, opts?)` and `PROSE_CHECK_CODES`. Six checks, all level `warn`: `W_PROSE_LONG_SENTENCE`, `W_PROSE_LONG_PARAGRAPH`, `W_PROSE_PASSIVE_STEP`, `W_PROSE_TENSE`, `W_PROSE_FILLER_OPENER`, `W_PROSE_TERM_DRIFT`. Glossary terms gain an optional `avoid` list; a listed word in the doc's prose reports term drift.
  - `avo check` runs the prose lint on every doc, next to schema validation and reference resolution. Findings surface as ordinary diagnostics (table, `--json`, code frames) and stay warnings — exit 0. The new `--strict-prose` flag escalates `W_PROSE_*` to errors and exit 1. `avo build` is unchanged: prose warnings never fail a build.
  - `@avodado/render` renders the glossary `avoid` field as "not:" chips; `@avodado/studio` bundles core/render and is patched to pick both up. `@avodado/mcp` embeds the updated skill reference.
  - Block text fields (`description`, `lede`, `body`, `note`, `subtitle`, `summary`) are exempt from `W_PROSE_LONG_PARAGRAPH` — fields carry complete information, and a sentence-count cap pressures fact deletion; markdown paragraphs, `prose` texts, and `steps` item text keep the cap, and fields keep every form check.

- e1f3a0e: chart `kind: scatter` gains numeric-axis `points` (x/y, `size` bubbles, per-point labels with collision nudging) plus `guides` (dashed x/y reference lines and TL/TR/BL/BR quadrant labels) and `xLabel`/`yLabel` axis titles; `tree` gains `variant: org` (top-down tidy org chart, node `role` under the label). Both additive — existing `labels`+`series` scatter and default/issue trees render byte-identically.
- e1f3a0e: docs(skill): rewrite authoring skill as toolkit (question→primitive table, selection procedure, recipes, STE style guide); rewrite demo/template prose
  - The skill gains two reference files: `reference/recipes.md` (composition recipes) and `reference/style-ste.md` (STE-informed writing rules). Both join `SKILL_REFERENCE_FILES`, the `avo skill` stitch, and the MCP embedded skill.
  - SKILL.md is rewritten around a question→primitive table and a 7-step selection procedure; the trigger-word playbooks and the flat glossary table are gone.
  - Demo, template, and prefilled doc-template prose (`@avodado/core` docTemplates) follow the new prose rules: no restating the block, short factual sentences.
  - `@avodado/studio` bundles core/render, so it is patched to pick up the rewritten doc templates.

- e1f3a0e: feat: two new block types (90 total) — `storymap` and `slopegraph`. `storymap` (planning) is a user story map: a `backbone` of 1–10 ordered activities across the top, 1–6 release `slices` as horizontal bands whose cards stack under the step they belong to; each slice must give exactly one cell per backbone step (validated), cards are strings or `{ title, tag }`. `slopegraph` (charts & overviews) is a ranked before/after comparison: `left`/`right` column headers, 2–20 items each drawn as one straight line between the two baselines, positioned by value on a shared linear scale; colliding labels are nudged apart deterministically and an `accent` highlights the lines that carry the story. Both types ship density budgets (backbone > 10 steps, items > 20 warn `W_DENSE_BLOCK`). Studio and MCP pick up the new types via the bundled core/render and the regenerated embedded skill.

## 0.12.1

### Patch Changes

- 4eceaec: Each package now exports its own `package.json`.

  An `exports` map that omits `./package.json` makes
  `require.resolve('@avodado/core/package.json')` throw, which is the ordinary way
  a consumer reads a dependency's version. The website hit exactly this: its
  version badge fell back to a hard-coded string and advertised v0.41.0 for a
  0.42.0 release. Adding the subpath costs nothing and removes the trap.

## 0.12.0

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

## 0.11.0

### Minor Changes

- ca204e7: Studio can now run with no server behind it, and every document is shareable as a link.

  Storage sits behind one interface (`StudioBackend`) with two implementations: the
  file bridge `avo studio` already used, and an in-tab vault for a hosted studio.
  The package ships both builds — `dist/app` for the CLI and `dist/web` for a
  static host — so `avo studio` is unchanged: same file bridge, same `docs/*.md`
  as the source of truth, same PDF and PowerPoint export.

  The hosted build hides what needs a server (PDF, PowerPoint, the built site,
  file-change events) rather than offering buttons that fail, and keeps everything
  the browser does on its own: editing, validation, rendering and presenting.

  **Share** copies a link that carries the whole document, deflated into the URL
  fragment — nothing is uploaded and nothing expires. Hold ⇧ for a link that opens
  straight into the deck.

## 0.10.5

### Patch Changes

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

- a9213cf: `{source: …}` no longer leaks into a page heading. The deck stripped it; the
  document renderer only knew the alignment markers, so `## Title {source: …}`
  rendered the marker verbatim on the page.

  The three places that had to agree about what a heading says now share one
  definition in `@avodado/core` (`stripHeadingMarkers`, `readSourceMarker`,
  `readAlignMarker`) — the page renderer, the deck, and `trailingHeading`, which
  feeds block titles and the sections nav and stripped nothing at all.

  On a page the source isn't dropped, it's printed: a small provenance line under
  the heading, matching what the deck puts in the slide footer.

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

## 0.10.4

### Patch Changes

- b418ed2: A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
  The navigation writes the slide number to the URL hash, and `replaceState`
  raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
  `avo compare` and any site embedding a deck logged one error per slide. The
  hash is a convenience, not the navigation itself, so an embedded deck now
  simply goes without it.

## 0.10.3

### Patch Changes

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

## 0.10.2

### Patch Changes

- 2cde519: Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
  `c4` written as just nodes + edges used to come back as a tall column of ranks
  that outgrew the page and shrank to a thin strip on a slide; it now runs across
  the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

  New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
  for the other direction — it steers the auto-layout only, so diagrams with
  `col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.

## 0.10.1

### Patch Changes

- a911135: Rebuild Studio's browser bundle with @avodado/render 0.26.1 so the Studio
  canvas highlights `lang: markdown` snippets like the CLI exports do. (Studio
  bundles the renderer at its own publish time — the previous release shipped
  the new renderer to the CLI but not to the Studio canvas.)

## 0.10.0

### Minor Changes

- 4c95ee6: PowerPoint export: `avo pptx doc.md` (and a PowerPoint entry in Studio's
  Export menu) turns any doc into a real `.pptx`. Each deck slide is driven in
  headless Chromium exactly as it presents — themes, diagrams, the slide fitter —
  and photographed at 2× into a full-bleed 16:9 image slide, with slide titles
  as speaker notes. Uses the same auto-installed Chromium as `avo pdf`.

## 0.9.0

### Minor Changes

- af9bae9: **Annotate sequence steps from the canvas.** Select a message in a sequence
  diagram and a "＋ add note ②" button (and an `n` shortcut, taught in the hint
  chip) opens the editor focused on that message's `summary` — the annotation
  appears automatically in the Step-by-step list under the diagram with the SAME
  reference number as the diagram badge (the list now shows real message numbers,
  so a note on step 4 reads ④ even when steps 1–3 have none). Structured edits on
  terse sugar items (arrow messages, string cards…) now materialize the item to
  its object form first instead of failing silently — annotating a one-liner
  message just works, and untouched siblings keep their terse spelling.

## 0.8.0

### Minor Changes

- 1dd0752: **Studio doc view now reads like the site.** A left sidebar lists the
  project's documents (the open one highlighted) with a "‹ Home" link and a
  New-doc entry — pick on the left, the doc displays and edits on the right
  (collapses on narrow windows, where the top-bar switcher takes over). And the
  cover is its own edit surface: hover the rendered cover for an "✎ Edit cover"
  chip and click to open the cover editor — the detached gray placeholder strip
  is gone. Keyboard block-roving starts at the first real block.

## 0.7.0

### Minor Changes

- f8b303a: **Streamlined Studio navigation — no modes to learn.** The Home | Edit | Site |
  Present segmented switch is gone. Studio is now just pages and actions, like a
  website: **Home** (the doc grid — click the wordmark to return) → click a card
  and you're **in the doc**, viewing and editing the same rendered surface.
  **▶ Present** is a button (⇧⌘P, Esc returns), and **Site ↗** opens the built
  docs site in its own browser tab — pointed at the current doc when you're in
  one. The top bar stays contextual: editing chrome only appears inside a doc.

## 0.6.0

### Minor Changes

- c56f620: **Studio opens on a Home page** — a front page for your docs, like a site
  landing. A searchable card grid (most recently edited first) with each doc's
  title, slug, and last-edited time; click a card to edit, hover for a one-click
  Present; a dashed "New doc" card opens the template picker; "Browse the site"
  jumps to Site mode. The wordmark is now a Home button, the mode switch gains
  Home | Edit | Site | Present, and the top bar hides doc-editing chrome (save
  state, autosave, export, undo) while on Home.

## 0.5.1

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

## 0.5.0

### Minor Changes

- d143316: Add a **Theme Generator** to Avodado Studio. A "Theme" button in the toolbar
  opens a right-docked panel where you pick a base theme and tune the 11 friendly
  colors + 3 font slots, with the canvas re-tinting live as you edit. **Install**
  writes a `*.theme.json` into the project's `.avodado/themes` (or `~/.avodado/themes`
  for a global theme) via a new `POST /api/theme` route on the file bridge, and
  activates it — so it immediately appears in the theme picker and in `avo theme`.

## 0.4.0

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

## 0.3.1

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

## 0.3.0

### Minor Changes

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

## 0.2.0

### Minor Changes

- Brand favicon + studio review-before-write mode.
  - render: new brand exports (`FAVICON_SVG`, `FAVICON_DATA_URI`, `FAVICON_LINK`)
    — a clean avocado favicon, now on every rendered page (`avo html`/`preview`).
  - cli: `avo serve`/`avo build` pages and slide decks carry the favicon.
  - studio: the tab icon matches; **review mode** — with autosave off, the save
    chip reads "Unsaved · N changes" and saving opens a review dialog listing
    edited / added / removed / reordered blocks with Apply / Cancel, so nothing
    touches the file until approved. Deleting a block or diagram part asks first
    (double-⌫ confirms; pristine just-inserted scaffolding deletes silently).

## 0.1.0

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
