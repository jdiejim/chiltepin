# chiltepin-render

## 0.34.1

### Patch Changes

- eda853c: `flow` nodes of kind `agent` and `llm` draw as the agent card: the sparkle mark, the name, and the second label line as a mono model chip.

## 0.34.0

### Minor Changes

- 4ddfd9a: `flow` gains AI node kinds — `agent`, `llm`, `tool`, `human`, `memory` — drawn with a kind chip and listed in the legend, so an AI workflow (RAG, routing, multi-agent hand-off, generate → check → repair) is drawn from the request instead of the fixed `agentloop` frame. The skill routes workflow questions to `flow` / `swimlane` / `cycle` and keeps `agentloop` for one agent's loop.

### Patch Changes

- Updated dependencies [4ddfd9a]
  - chiltepin-core@0.25.0

## 0.33.3

### Patch Changes

- eea0f64: Republish: the 0.33.2 tarball predates the muted section rules and the prose table and link styles. This patch carries them.

## 0.33.2

### Patch Changes

- 8dc104c: Markdown pipe tables inside prose render like the table block (frame, header row, row rules, alternating rows) and prose links use the link colour; they were unstyled.
- 487b111: Section titles and the page footer use a 1px muted rule instead of a 2px ink line, so dark pages have no bright horizontal bars above blocks.
- c0b7e3e: Tables have a visible frame and row rules again: a new `--rule-table` token (32% ink in light, 28% in dark) replaces the 13% hairline on every table kind, and the plain `table` block gets a 1px rounded border.

## 0.33.1

### Patch Changes

- d712087: The 8px band above a document cover is gone: pages, Studio, and exports start at the cover meta line.

## 0.33.0

### Minor Changes

- 32b6304: Avodado is now **Chiltepin**. New package names: `chiltepin` (CLI, binary `chiltepin`), `chiltepin-core`, `chiltepin-render`, `chiltepin-studio`. The skill installs with `npx skills add jdiejim/chiltepin`. The config file is `chiltepin.config.*`; the old `avodado.config.*` still loads with a warning for now, and an existing `.avodado-build.json` manifest is read once and replaced. The `avo` binary and the `@avodado/*` packages are deprecated on npm with a pointer here. New logo and favicon.

### Patch Changes

- Updated dependencies [32b6304]
  - chiltepin-core@0.24.0

## 0.32.0

### Minor Changes

- 45e3ff8: Thirteen new block types and a new family. **Quality & audits**: `audit` (severity-ranked findings with evidence, fix, owner, status and a count strip), `checklist` (pass / fail with evidence, `"[pass] item — evidence"` terse form, pass rate derived), `perfbudget` (budgets vs measured, over / near / ok derived), `percentiles` (p50 … p99 · max per row on one axis with the SLO rule), `threatmodel` (dfd shapes inside dashed trust boundaries plus a STRIDE threats table). **UML**: `usecase` (actors, system boundary, include / extend / generalize), `pkg` (package diagram with dashed dependencies), `timing` (lifelines stepping through states over time). **ML**: `neuralnet` (layered network with unit counts and activations), `modelcard`. **Deck shapes**: `chevrons` (process strip with the current phase), `roadmap` (themes × periods with status chips and a now rule), and `mindmap`. `chart` gains six kinds: `pie`, `histogram`, `bell` (normal curve with σ bands and z-scored markers), `boxplot`, `pareto` (80% rule), `bullet`. The skill gains `reference/blocks/quality.md`, entries for every new block, and `reference/patterns-design.md` (the 23 GoF and the common architectural patterns mapped to block stacks); the generation eval gains 15 scenarios for them. 107 block types across 13 families.
- 45e3ff8: Dark is the look.
  - The render skin's bare `:root` now carries the dark set — deeper surfaces (`paper #15171d`, `paper-2 #1d2028`), the rust accent lifted, and a new drawing **well**: every diagram stage paints a step below its frame with the dot grid and a faint centre glow inside a hairline inset. Light is the explicit choice (`data-theme="light"`) and the print look, always.
  - New `colorScheme` in `avodado.config.json`: `dark` (default), `light`, or `system` (the reader's OS chooses). `avo html`, `avo slides`, `avo build`, `avo serve`, and Studio's site mount honour it; `renderDocument`, `toSlides`, and `buildSite` take a `colorScheme` option.
  - Studio's chrome is dark-first too and follows the same setting, so the canvas and the app never disagree. `/api/meta` reports the scheme.
  - `LIGHT_SET`, `DARK_SET`, and `systemSchemeCss` are exported from `@avodado/render` for hosts that compose their own page.

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

- 45e3ff8: `swimlane` is the block for "who does which step, in what order", and it is harder to get wrong.
  - A step names its lane by label or id (`lane: Sales`, case-insensitive) as well as by index; an unknown lane is `E_SWIMLANE_LANE`, listing the lanes.
  - `col` is optional. Columns derive from the links — a step sits one column after its predecessors; unlinked steps follow — through `swimlanePlacements` in core, so the renderer, the Studio canvas, and `avo check` agree.
  - `phases` bands the columns as a header row (BPMN milestones). Links take `kind: dashed | error` and the `-->` / `-x->` arrows. Steps take `note` and `accent: true`, and the terse form `id: Label · Lane · kind`.

- 45e3ff8: Vary the lens. A new `W_LENS_REPEAT` warning fires on the third `callout` in one document and on the fourth block of any other structural type (tables, code, and one-per-item blocks such as `endpoint` and `userstory` are exempt), naming the block that usually fits instead. The skill gains the matching rule. `swimlane` takes lane labels instead of indices, derives columns from the links when `col` is omitted, draws `phases` bands, accepts dashed and error links, a `note` and one `accent` step, and a terse step line `id: Label · Lane`. `code` gains `highlight` line ranges, `lines` with `start`, `caption`, `cols` for a snippet grid, `kind: compare` for before / after, and `wrap`. The README is rewritten around what the tool does today, with the eval numbers and a rendered hero.

### Patch Changes

- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
- Updated dependencies [45e3ff8]
  - @avodado/core@0.23.0

## 0.31.0

### Minor Changes

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

- 3a8d480: `sequence` is now a complete sequence diagram. Core: `messages[]` items are a union of a message (now with `activate` / `deactivate`), a frame open (`{ frame: alt | opt | loop | par | break | critical, label? }`), a frame else (`{ else: label }`) and a frame end (`{ end: true }`); terse forms `- alt: token valid`, `- else: expired`, `- end`, and `A -> +B` / `B --> -A` activation signs; a new `W_SEQ_FRAME` warning for a stray `else`/`end` or an unclosed frame; the density budget counts messages only; the Mermaid dialect keeps `alt`/`opt`/`loop`/`par`/`critical`/`break` … `else`/`and`/`option` … `end` and the `+`/`-` activation suffixes instead of dropping them. Render: variable row heights, UML frames (tab, `[guard]`, dashed else divider, nested insets) drawn under the lifelines, explicit or inferred activation bars (a bar opens on an incoming call and closes on its reply), real self-message loops, note boxes beside one lifeline or over two, and frame dividers in the step list. Studio: the message form and inline editor pick the union arm that matches the item, and step numbers skip frame markers.

### Patch Changes

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

- 02bc78b: One look. Theme presets are gone: the editorial skin is the single look for every export, and it follows the reader's OS light/dark setting. Removed: `avo theme` (and `avodado.theme.json`, `.avodado/themes/`, `~/.avodado/themes/`), the theme step in `avo init`, the `theme` line in the bare `avo` status, the Studio theme panel with its `/api/theme` route and `/api/meta` theme fields, and the `theme` parameter of the MCP `render_document` tool. A leftover `theme` key in `avodado.config.json` is ignored silently. `@avodado/render` keeps `ThemeName` as the single name `textbook` (label `Editorial`), `themeStyle()` returns `''`, rendered pages no longer stamp `data-theme` on `<html>` (the `[data-theme="dark"]` CSS stays so a host page can force dark), and `themeVars` remains an internal `:root` override with no user surface.
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
- 2b88a17: Studio: right-click menus and motion on the direct-edit layer.
  - **Context menus** (right-click, ⇧F10, the Menu key) on every diagram part — grid nodes (add a connected node in a direction with a kind picker, change kind, replicas, add to / remove from group, rename, delete with its edges), edges (kind, edit label, reverse, delete), empty cells (insert node / group), the block background (insert node, direction, open YAML), sequence actors and messages (connect mode, notes, kind, wrap a range in `alt`/`opt`/`loop`/…, activate/deactivate, delete), ERD entities and columns (add column, relation mode, pk/fk/unique/nullable/indexed toggles, delete). Every item is ≤ 2 clicks from the right-click and writes the same YAML ops the drag/connect layers emit — one undo step each.
  - **Motion**: commits play a FLIP (transform-only, 140 ms ease-out) across the re-render; new parts pop, re-routed edges crossfade, deletions fade out first. The connect ghost edge is dashed terra and the snap target gets a highlight ring. All skipped under `prefers-reduced-motion`.
  - `felogic` and `cluster` join the connect-spec table (drag-to-move, connect, menus); the felogic renderer now emits the grid metadata attrs the editor reads (no visual change).
  - core exports `SEQUENCE_FRAME_KINDS`.

- Updated dependencies [430ba0b]
- Updated dependencies [2b88a17]
- Updated dependencies [6498446]
- Updated dependencies [6498446]
- Updated dependencies [6498446]
- Updated dependencies [6498446]
- Updated dependencies [430ba0b]
- Updated dependencies [d1a5570]
- Updated dependencies [430ba0b]
- Updated dependencies [3a8d480]
- Updated dependencies [d5e8928]
- Updated dependencies [2b88a17]
- Updated dependencies [430ba0b]
  - @avodado/core@0.22.0

## 0.30.0

### Minor Changes

- e1f3a0e: feat: new `fishbone` block type (88 total) — cause & effect (Ishikawa) analysis. One `effect` at the head of a horizontal spine, 1–8 `causes` as bones alternating above and below, up to 8 `items` (specific causes) ticked along each bone. The renderer spaces bones by label width, so long labels grow the diagram instead of overlapping; text stays horizontal and wraps with an ellipsis past four lines. Studio and MCP pick up the new type via the bundled core/render and the regenerated embedded skill.
- e1f3a0e: chart `kind: scatter` gains numeric-axis `points` (x/y, `size` bubbles, per-point labels with collision nudging) plus `guides` (dashed x/y reference lines and TL/TR/BL/BR quadrant labels) and `xLabel`/`yLabel` axis titles; `tree` gains `variant: org` (top-down tidy org chart, node `role` under the label). Both additive — existing `labels`+`series` scatter and default/issue trees render byte-identically.
- e1f3a0e: feat: two new block types (90 total) — `storymap` and `slopegraph`. `storymap` (planning) is a user story map: a `backbone` of 1–10 ordered activities across the top, 1–6 release `slices` as horizontal bands whose cards stack under the step they belong to; each slice must give exactly one cell per backbone step (validated), cards are strings or `{ title, tag }`. `slopegraph` (charts & overviews) is a ranked before/after comparison: `left`/`right` column headers, 2–20 items each drawn as one straight line between the two baselines, positioned by value on a shared linear scale; colliding labels are nudged apart deterministically and an `accent` highlights the lines that carry the story. Both types ship density budgets (backbone > 10 steps, items > 20 warn `W_DENSE_BLOCK`). Studio and MCP pick up the new types via the bundled core/render and the regenerated embedded skill.

### Patch Changes

- 65ec84b: Export size presets and accessibility fixes.

  `avo html` and `avo pdf` accept `--size sm|md|lg|xl` (720 / 960 / 1280 / 1600 px page width). Without the option, output keeps the default width (1180 px content column; A4 PDF page). For PDF, the preset sets the page width with portrait A-series proportions.

  Accessibility: harvey rating balls now carry `role="img"` and an `aria-label` ("N of 4"). Theme tokens that failed WCAG AA text contrast were darkened: the muted-text gray in the base palette (`#8a8475` → `#6f695b`), `minimal` (`#888888` → `#6e6e6e`), and `soft` (`#8b93a7` → `#646c7e`); the accent in `teal`/`soft` (`#f59e0b` → `#b45309`) and `slate` (`#0d9488` → `#0d6d66`).

- 65ec84b: Fan-in entry ports in the shared `ortho` edge router: when two or more edges terminate on the same side of the same node, each gets its own entry port along that side (centered spread, 8px apart, capped to the side's length, ordered by source node id), so their final segments and arrowheads no longer stack. A side with a single incoming edge keeps the previous geometry byte-for-byte. Applies to every block-diagram renderer that routes with `ortho` (block, flow, graph, dfd, state, c4, cluster, swimlane, felogic and their aliases). Studio and MCP are patched because they bundle the renderer.
- 65ec84b: fix(render): the typed `prose` block now renders inline Markdown (bold, `code`, links) in headings, paragraphs, list items, and quotes through the same hardened pipeline as `callout` and `pullquote`. Literal HTML stays escaped; block structure is unchanged.
- e1f3a0e: feat(core,cli): STE-informed prose linter — `lintProse` in core, wired into `avo check` with `--strict-prose`
  - `@avodado/core` exports `lintProse(doc, file, opts?)` and `PROSE_CHECK_CODES`. Six checks, all level `warn`: `W_PROSE_LONG_SENTENCE`, `W_PROSE_LONG_PARAGRAPH`, `W_PROSE_PASSIVE_STEP`, `W_PROSE_TENSE`, `W_PROSE_FILLER_OPENER`, `W_PROSE_TERM_DRIFT`. Glossary terms gain an optional `avoid` list; a listed word in the doc's prose reports term drift.
  - `avo check` runs the prose lint on every doc, next to schema validation and reference resolution. Findings surface as ordinary diagnostics (table, `--json`, code frames) and stay warnings — exit 0. The new `--strict-prose` flag escalates `W_PROSE_*` to errors and exit 1. `avo build` is unchanged: prose warnings never fail a build.
  - `@avodado/render` renders the glossary `avoid` field as "not:" chips; `@avodado/studio` bundles core/render and is patched to pick both up. `@avodado/mcp` embeds the updated skill reference.
  - Block text fields (`description`, `lede`, `body`, `note`, `subtitle`, `summary`) are exempt from `W_PROSE_LONG_PARAGRAPH` — fields carry complete information, and a sentence-count cap pressures fact deletion; markdown paragraphs, `prose` texts, and `steps` item text keep the cap, and fields keep every form check.

- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
- Updated dependencies [e1f3a0e]
  - @avodado/core@0.21.0

## 0.29.3

### Patch Changes

- 4eceaec: Each package now exports its own `package.json`.

  An `exports` map that omits `./package.json` makes
  `require.resolve('@avodado/core/package.json')` throw, which is the ordinary way
  a consumer reads a dependency's version. The website hit exactly this: its
  version badge fell back to a hard-coded string and advertised v0.41.0 for a
  0.42.0 release. Adding the subpath costs nothing and removes the trap.

- Updated dependencies [4eceaec]
  - @avodado/core@0.20.2

## 0.29.2

### Patch Changes

- Updated dependencies [6837e18]
  - @avodado/core@0.20.1

## 0.29.1

### Patch Changes

- Updated dependencies [61a3371]
  - @avodado/core@0.20.0

## 0.29.0

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

## 0.28.1

### Patch Changes

- b418ed2: A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
  The navigation writes the slide number to the URL hash, and `replaceState`
  raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
  `avo compare` and any site embedding a deck logged one error per slide. The
  hash is a convenience, not the navigation itself, so an embedded deck now
  simply goes without it.

## 0.28.0

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
  - @avodado/core@0.18.0

## 0.27.0

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

## 0.26.1

### Patch Changes

- aba44c3: Markdown-aware snippet highlighting: a `code` block (or steps/gallery snippet)
  with `lang: markdown` (or `md`/`mdx`) now colors headings, **bold**, _italic_,
  inline code, links, list markers and blockquotes in the dark code card — and
  fenced code inside the sample still gets generic token highlighting. Any other
  `lang` value keeps the existing universal tokenizer.

## 0.26.0

### Minor Changes

- efe9172: Editable PowerPoint: `avo pptx --editable` emits native PowerPoint elements —
  text boxes with real bullets, tables, dark code boxes, stat cards, callouts,
  quotes, and actual PowerPoint charts for `chart` blocks — so the deck's words
  are editable in PowerPoint. Only diagram blocks (sequence, flow, ERD, C4, …)
  are placed as crisp screenshots, and Chromium only launches when a document
  actually contains one. The render package now exposes each slide's structured
  `parts` (prose text / block type + data) on the slide model for
  structure-aware exporters.

## 0.25.11

### Patch Changes

- 808891d: Code presents at presentation scale on slides: 16px type (the doc page keeps
  12.5px), and a lone tall snippet (18+ lines) splits into a two-column spread —
  left column first, like a printed listing — so it fills the stage at full size
  instead of shrinking to half scale. Long lines wrap inside the columns, and
  the split only happens when the syntax-highlight markup divides cleanly. The
  "Structure your prompts"-style template went from an effective 10px strip to
  15.5px across 98% of the stage.

## 0.25.10

### Patch Changes

- 460ef16: Slides: title cards center properly and title themselves.
  - The cover's title + subtitle sit at the true vertical center (trailing doc
    margins no longer skew the flex centering).
  - A slide that is only a `divider` is its own title card: no stale section
    heading above the PART band, and the jump menu lists it by the band's title.
  - Untitled leading-prose slides drop the meaningless "Slide" header.

## 0.25.9

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

## 0.25.8

### Patch Changes

- 0451174: Slides: the stage-column treatment now covers every stacked text block —
  `agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
  steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
  are already grids (team, persona, drivers, gallery) or whose vertical order is
  the point (layers, changelog) are untouched. Also fixes the terse OKR
  key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
  progress bars show the real percentage instead of clamping to 100%.
- Updated dependencies [0451174]
  - @avodado/core@0.16.1

## 0.25.7

### Patch Changes

- 77e1003: Slides: tall text lists break into stage columns, and the cover centers.
  - `list`, `takeaways`, `steps`, `faq`, `glossary`, and long prose lists flow
    into 2 columns at 4+ items and 3 at 8+ — horizontal space instead of one
    skinny centered strip the fitter would shrink. Short lists keep their single
    column.
  - The cover slide's subtitle (and the whole title column) is properly centered
    on the stage.

## 0.25.6

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

## 0.25.5

### Patch Changes

- ed6dde6: Edge-step numerals (① ② ③) dodge node boxes — a long edge's midpoint can land
  on a node in tight layouts, which printed the badge over the node's label.
  Badges now nudge off any node box along the edge's axis, and keep clear of
  each other when two edges share a corridor. Diagrams without collisions render
  byte-identically.

## 0.25.4

### Patch Changes

- b55ae7e: Decks show diagrams complete on slide entry — the progressive ① ② ③ step
  reveal is removed; navigation is one press per slide again.

## 0.25.3

### Patch Changes

- Updated dependencies [402174b]
  - @avodado/core@0.16.0

## 0.25.2

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

## 0.25.1

### Patch Changes

- c7de193: Diagrams shed their page-card chrome on slides: no border box, tag pill, fig
  number, or dashed rule inside a slide — the slide itself is the card, so
  sequence/flow/architecture diagrams now sit directly on the stage at full
  presentation scale.

## 0.25.0

### Minor Changes

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

## 0.24.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [0d9c992]
  - @avodado/core@0.14.0

## 0.23.0

### Minor Changes

- 43a45ea: **The heading titles the block.** A `##` heading directly above a block now
  titles it: a near-duplicate block `title` is suppressed at render (no more two
  stacked headings saying the same thing — healed in HTML, slides, Studio, and
  PDF), and a title-less block inherits the heading into the sections nav. The
  Markdown-native way to write docs is now simply: put the title in the heading
  and skip `title:` in the YAML.

  The `W_DUP_HEADING` warning is removed (the condition is auto-healed), and core
  exports `trailingHeading` alongside `isNearDuplicateTitle`. The authoring skill
  teaches the new rule.

### Patch Changes

- Updated dependencies [43a45ea]
  - @avodado/core@0.13.0

## 0.22.1

### Patch Changes

- Updated dependencies [7052a5d]
  - @avodado/core@0.12.1

## 0.22.0

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

## 0.21.0

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
  - @avodado/core@0.11.0

## 0.20.0

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

## 0.19.0

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

## 0.18.0

### Minor Changes

- Agentic blocks, 106-pattern library, the full shape language, and a restructured skill. **AI & agents family** (79 → 83 blocks): `agentloop` (agent + tools + memory with numbered loop arrows and a stop-condition pill), `trace` (execution transcript with thinking and tool calls), `prompt` (prompt anatomy with highlighted `{{variables}}`), `context` (context-window token budget bar with overflow) + an Agent-system-doc playbook. **Design library 80 → 106**: interpreter (the 23rd GoF), architecture classics (mvc, mvvm, dependency-injection, unit-of-work, active-record, data-mapper, event-bus, specification, null-object), resilience/concurrency/messaging (retry-backoff, bulkhead, timeout, cache-aside, throttling, actor-model, producer-consumer, thread-pool, competing-consumers, splitter-aggregator), and agentic patterns (plan-and-execute, human-in-the-loop, agentic-rag, swarm-handoff, chain-of-thought, context-compaction). **Diagram elegance**: labeled C4 edges (and dense block-family diagrams) render as circled step numerals with a legend below; C4 tech renders as a chip; all node cards drop the left accent bar for the clean rounded agent-card look. **Shape language, 21 silhouettes by kind**: cylinder, tiered cylinder (warehouse), pail (S3), sharded trio, replica set, pipe, cloud, hexagon (gateway), octagon (lb), instance stack (cache + worker pools), server rack, shield (waf), actor figure, crowd, browser window, phone, ƒ circle (lambda), clock (cron), vault dial (secrets), globe (region), clean card — plus new kinds shard/replica/users/crowd/region/geo. **Skill restructured** for progressive disclosure: a 598-line hub (down from 2,373) + `reference/` spokes (blocks contract, system design, decks, and new per-document intake checklists with a batched ask-back protocol); `avo skill`, the Copilot adapter, and the MCP embed stitch everything into one prompt; `avo init` installs the full folder. **Plus**: a new `archmap` block (83 → 84) — the target-architecture capability mosaic with status-coded tiles (current/target/new/gap/deprecated) and an auto-legend; the shape language extends into `belogic`/`felogic` (db → cylinder, queue → pipe, cache → stack, external → cloud), `c4` (`store` → true database cylinder), and `cluster`; secrets render as a padlock and schedulers as the industry-standard calendar-with-clock; the ERD is restyled (tinted header band, content-sized entities, zebra rows, PK/FK chips); and block titles no longer render twice (the section head owns the title; the block body's duplicate header is suppressed at top level).
- The documentation-tool release. **New commands**: `avo serve` (zero-dep live-reload dev server — watch, SSE reload, in-page diagnostics banner), `avo build` (docs/ → a static site: index cards, sidebar nav with per-doc sections, cross-doc `doc#id` refs rewritten to real links), `avo mcp` (setup snippets + `--stdio` server), `avo install <tool>` (claude/cursor/copilot/windsurf — replaces the old per-tool commands, Copilot correctly named), `avo tour` (interactive 7-chapter terminal onboarding with a live-caught planted bug), `avo demo [family]` (filtered showcases with an interactive picker). **Removed**: the duplicate `render` command (use `html`). **Render**: blocks with an `id:` emit real anchors + `data-block-id`; userstory/stories ref chips are real links; C4 goes professional (level-aware `C4 · CONTAINER` tag, centered structurizr-style typography, dashed externals, legend derived from the kinds present, taller cards) and the layered architecture drops its solid label slabs for tinted zone bands with optional per-layer `color`. **Catalog** groups all blocks by family. **Skill**: `reference/blocks/` per-family split with INDEX + whole contract table (coverage-tested), trimmed trigger frontmatter, new "Organizing a documentation set" + "Reviewing an existing doc" + "C4 done right" guides. **Slides** gain an automated gate (full-demo deck + split-layout tests). New professional cfonts wordmark + one-line banner (ANSI-free when piped) and purpose-grouped help.
- Twelve more blocks (67 → 79) plus consulting-style decks. **Engineering & decisions**: `waterfall` (latency/cost budget cascade with a dashed budget line and over/under chip), `heatmap` (numeric grid with intensity ramp + legend), `scorecard` (weighted decision matrix with computed totals and winner highlight), `risk` (register with likelihood × impact severity chips), and `chart` gains a `radar` kind. **Design system** (new family): `palette` (color-token swatches with auto-contrast labels), `typescale` (live type specimen), `dodont` (Do/Don't guideline cards), `inventory` (component status board) + a Design-system doc playbook in the skill. **Algorithms & data structures** (new family): `array` (cells, indices, pointer labels, window highlight), `linkedlist` (singly/doubly with head/curr markers), `bintree` (binary tree with per-node walkthrough states), `hashmap` (buckets + collision chains); `graph` gains node `state` (visited/current/frontier/target) and edge `weight` for BFS/Dijkstra walkthroughs. **Decks**: `{split}` heading marker renders the consulting layout (message left, exhibit right), every slide gets a footer (deck title · page number), and the skill gains a Consulting-style decks section (action titles → one exhibit → takeaway). Also fixes `avo <cmd> | head` leaving an unsettled flush await.
- Fourteen new block types — the catalog grows from 53 to 67. **Everyday primitives**: `chart` (bar / line / area / donut, pure SVG), `figure` (image + caption), `diff` (unified +/− code diff on the dark editor surface), `steps` (numbered runbook stepper with per-step commands), `faq` (Q&A accordions). **System design**: `envelope` (back-of-envelope capacity math — assumptions → derivation rows → highlighted result), `slo` (service objectives with error-budget burn bars), `terminal` (shell session, distinct from code). **Business & strategy**: `swot`, `funnel` (conversion trapezoids with stage-to-stage %), `okr` (objectives + key-result progress bars), `persona` (user persona cards), `changelog` (release rail with typed change chips), `team` (people cards). All fully registered: strict schemas, renderers + CSS in the house style, `avo block` scaffolds, catalog descriptions, demo showcase sections, and skill documentation (glossary, contract table, examples, new Business & strategy family).
- Presentation text blocks + a full template set. **Three new blocks (84 → 87)**: `divider` (deck part-break interstitial — kicker, big title, accent wash), `bignumber` (the hero-stat slide: one huge figure + claim + context), `takeaways` (numbered presentation-scale closing statements). Dividers render full-width on slides; blocks whose title _is_ the visual no longer have it lifted into the section head; `{split}`/`{top}` heading markers no longer leak into HTML doc headings. **`avo template` grows from 1 to 11**: adr, design-doc, runbook, roadmap, api-spec, system-design, agent-system, design-system, postmortem, data-model, and a `deck` template demonstrating the consulting formula (divider → `{split}` argument slides → bignumber → takeaways) — every template schema-validated by tests and namespaced so several scaffold cleanly into one repo. The skill's deck guide covers when to use each, and the playbooks table maps each playbook to its template.
- System-design diagram overhaul. **Quick mode**: `col`/`row` are now optional on the block family, `graph`, and `felogic`/`belogic` — omit coordinates and the layout is computed from the edges. **Canonical shapes by kind**: db/store/warehouse render as cylinders, queue/topic/stream as horizontal-cylinder pipes, cdn/external as clouds, gateway/lb/proxy as hexagons, cache/redis as stacked-instance cards. **~40 new node kinds** with glyphs (dns, waf, auth/idp, monitor, scheduler, stream, warehouse, search, ml/llm/agent, vm, secrets, notification, email, ci, git, registry, device, analytics, config, …) plus vendor aliases (postgres/mysql/mongo→db, kafka/kinesis→stream, s3, sqs, redis, elasticsearch). **C4**: edge `tech:` labels, multiple named `boundaries[]`, and a fix for edge labels never rendering. **Cluster**: namespaces now sit side by side, self-sized, in the refined zone style. **UML**: content-sized class cards with tinted header compartments. **Polish**: nested infra zone labels no longer overlap, off-palette ink normalized to theme vars, graph label clamping, slide decks render text at presentation scale with a proper measure (text-only slides no longer over-scale). Skill updated throughout.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @avodado/core@0.9.0

## 0.17.2

### Patch Changes

- Refine block styling across the board: softer two-layer shadows, larger and more
  consistent corner radii on card surfaces (drivers, options, spec, list, gallery,
  pattern, composition, code, …), roomier callouts, and a subtle elevation on
  diagram frames — a more polished, cohesive look. Skill notes that code renders on
  a dark editor surface (shared by `gallery` cells and `sequence` snippets).

## 0.17.1

### Patch Changes

- Code now renders as a dark editor surface — near-black background, a One Dark-style
  syntax palette (keywords, strings, numbers, functions, types, comments), generous
  padding, rounded corners, and a title bar with macOS traffic lights on full code
  blocks. The styling + syntax colors now apply everywhere code appears (the `code`
  block, `gallery` code cards, and `sequence` step snippets), not just `code` blocks.

## 0.17.0

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

## 0.16.0

### Minor Changes

- Slides: stop cramming (and over-scaling) blocks. A heavy heading now
  auto-paginates across multiple slides (same title) using a build-time content
  weight, so a big proscons / table / multi-block section no longer shrinks to an
  unreadable size on one slide. And the fit() up-scale is dialled back to a gentle
  1.5x cap so small lone blocks fill a bit without being blown up huge.

## 0.15.0

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

## 0.14.0

### Minor Changes

- Per-slide alignment override. On top of the auto centering/top-align, a heading
  marker forces a slide's vertical alignment: `## Title {top}`, `## Title {center}`,
  or `## Title {bottom}` (the marker is stripped from the displayed title). Documented
  in the skill's "Slide decks" section.

## 0.13.0

### Minor Changes

- Slides: split on headings only, with auto vertical alignment.
  - `avo slides` no longer treats `---` as a slide break — it renders as a normal
    horizontal rule. Slides split **only** at top-level `#`/`##` headings (a doc
    with no headings still falls back to one slide per block).
  - Slide content is auto-aligned: light slides (≤1 block, little prose) stay
    vertically centered; heavier slides (stacked blocks or lots of prose) top-align,
    so dense slides read top-to-bottom instead of floating in the middle.

## 0.12.0

### Minor Changes

- Slides split by heading. `avo slides` now starts a new slide at each top-level
  Markdown heading (`#`/`##`), using the heading as the slide title; everything
  until the next heading (prose + blocks) stays on that slide. A `---` thematic
  break still forces a split, and a doc with no headings falls back to one slide per
  block. This means ordinary section-structured docs present cleanly with no special
  markup. Skill "Slide decks" section, presentation playbook, and prompt updated.

## 0.11.0

### Minor Changes

- Author-controlled slide pagination with `---`.

  `avo slides` now splits the deck on Markdown thematic breaks (`---`): everything
  between two `---` is one slide and can hold several blocks plus prose, with the
  first `#`/`##` heading as the slide title. A document with no `---` keeps the
  previous one-slide-per-block behavior. Documented in the skill (new "Slide decks"
  section) and the `presentation` prompt.

## 0.10.0

### Minor Changes

- Slide titles from Markdown headings, and stronger block routing in the skill.
  - **Slides:** a section's Markdown heading (`#`/`##`) is now the slide's title at
    the top (matching the source), instead of only the block's `title:` field — and
    it's no longer duplicated in the slide body.
  - **Skill:** every block now appears in the "which block when" decision tables, not
    just the glossary — `drivers`, `options`, `spec`, `matrix`, `anatomy`,
    `composition`, `endpoint`, `pullquote`, `layers` were being overlooked because
    they had no routing entry. Fixed the "options compared" signal (was routed to
    `table`, now `options`) and added a worked `belogic` example with UML stereotypes.

## 0.9.1

### Patch Changes

- Wrap layered `block`/`infra` band labels (the left "lane" column) to up to 3 lines
  so long layer names like "Meridian apps — one model" no longer overflow the column —
  matching the node-label and swimlane-lane wrapping.

## 0.9.0

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

## 0.8.0

### Minor Changes

- Remove the `plum` built-in theme. Six themes remain: textbook, minimal, soft,
  dark, teal, slate. `theme: 'plum'` (or `avo theme use plum`) is no longer valid —
  switch any document using it to another theme.

## 0.7.0

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

## 0.6.0

### Minor Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.4.0

## 0.5.1

### Patch Changes

- - **Per-tool skill install/update commands:** `avo claude`, `avo cursor`, `avo github`, `avo windsurf` install or refresh just that tool's adapter + the shared authoring skill (no full project scaffold).
  - **Versioned skills:** installed `SKILL.md` files now carry a `version:` stamped with the CLI version, so you can tell what's installed and re-run a command to update.
  - **`--preview` / `-p`** on `avo html` / `avo slides` / `avo pdf` — render to a temp file and open it in the browser.
  - **Slides:** the gradient rail is static again (derived from the theme accents, no animation), and slide content is now **scaled to fit** so there's no scrolling — diagrams shrink to the slide.
  - **`funnel` and `pyramid` fixed:** the pyramid apex is a flat band (top label fits), funnel stages are wide enough, labels wrap, and both follow the theme colors instead of a fixed palette.

## 0.5.0

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

## 0.4.1

### Patch Changes

- Fix diagrams rendering invisible on slides: the shared SVG `<defs>` (drop-shadow filter + arrow markers) were emitted inside the first slide, which is `display:none` when inactive — and a node referencing `filter="url(#gshadow)"` from a hidden subtree is not rendered, so most diagrams vanished on other slides. The defs are now placed once at the deck root (`renderSlides` returns them separately), so every slide's diagrams resolve their filters/markers and display.

## 0.4.0

### Minor Changes

- Add a **slides / presentation export**. `avo export <doc> --format slides` produces a self-contained HTML deck — one slide for the cover and one per section — with keyboard (←/→, Home/End), button, and jump-to-section navigation, and a coloured right edge per slide. New `renderSlides` in `@avodado/render` and `toSlides` in `@avodado/export` back it (static HTML + a tiny vanilla-JS controller, no runtime dependency). Also prints cleanly (one slide per page).

## 0.3.1

### Patch Changes

- The `endpoint` block's request/response examples (and per-response examples) are now syntax-highlighted JSON — keys, strings, numbers, and `true`/`false`/`null` get theme-aware colors. Highlighting is done at render time (static colored spans, no runtime), and non-JSON snippets pass through safely uncolored.

## 0.3.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.2.0

## 0.2.7

### Patch Changes

- Edge/relationship labels are now drawn in a final pass — on top of all lines and nodes — in **every** diagram block. The remaining ones that still drew labels inline (`felogic`/`belogic`, `graph`, `swimlane`, `cluster`, and the `erd` relation label) are fixed, so a connector line never crosses out a label anywhere.

## 0.2.6

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.

## 0.2.5

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.

## 0.2.4

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.

## 0.2.3

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.

## 0.2.2

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.

## 0.2.1

### Patch Changes

- Diagram rendering polish:
  - **Edge labels are never crossed out.** All diagram renderers (`flow`/`dag`, `c4`, `state`, `dfd`, `uml`, `block`/`infra`/`event`/`ddd`/`network`) now draw labels in a final pass, on top of the lines and nodes — fixing the "state lifecycle" labels being struck through by later transitions. Label pills are theme-aware.
  - **`dfd`** boxes are smaller with more separation so flow labels fit between them.
  - **`c4`** person nodes draw the persona glyph in the top-right corner, clear of the title/description text.
  - **`uml`** class boxes and fonts are smaller; the class boxes and compartment rules now follow the theme.
  - **`infra`/`block`/`network`/etc.** get more outer padding/margin and theme-aware layered-mode colors.
  - Left-accent blocks (`callout`, `userstory`, `toc`, kanban cards) have square accent (left) corners and rounded right corners.

## 0.2.0

### Minor Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.1.0

## 0.1.2

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.

## 0.1.1

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).

## 0.1.0

### Minor Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2

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
