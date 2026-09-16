# chiltepin-core

## 0.25.0

### Minor Changes

- 4ddfd9a: `flow` gains AI node kinds — `agent`, `llm`, `tool`, `human`, `memory` — drawn with a kind chip and listed in the legend, so an AI workflow (RAG, routing, multi-agent hand-off, generate → check → repair) is drawn from the request instead of the fixed `agentloop` frame. The skill routes workflow questions to `flow` / `swimlane` / `cycle` and keeps `agentloop` for one agent's loop.

## 0.24.0

### Minor Changes

- 32b6304: Avodado is now **Chiltepin**. New package names: `chiltepin` (CLI, binary `chiltepin`), `chiltepin-core`, `chiltepin-render`, `chiltepin-studio`. The skill installs with `npx skills add jdiejim/chiltepin`. The config file is `chiltepin.config.*`; the old `avodado.config.*` still loads with a warning for now, and an existing `.avodado-build.json` manifest is read once and replaced. The `avo` binary and the `@avodado/*` packages are deprecated on npm with a pointer here. New logo and favicon.

## 0.23.0

### Minor Changes

- 45e3ff8: Repair the unquoted-comma trap instead of reporting it. A single-line `{ … }` map whose cell has no key of its own (`label: Hold as BACKORDERED, email ETA`, `value: 1,000,000 followers`) is folded back into the field before it on the source line, before YAML parses it, so the text survives exactly. `E_PARSE_YAML` now says what to do for a `[ ]` inside a row cell and for an inline map that does not close on its line. A terse line whose text holds a colon (`name type required — Sum: lines plus tax`) is rescued from the single-pair map YAML makes of it. The skill gains `reference/patterns.md`: twelve messaging and event patterns (pub/sub, competing consumers, partitioned streams, backbone, outbox, dead-letter and retry, CQRS, event sourcing, saga, scatter-gather, backpressure and circuit breaker, CDC and webhooks, idempotency), each as a block stack with its trap; the generation eval adds seven scenarios for them.
- 45e3ff8: Thirteen new block types and a new family. **Quality & audits**: `audit` (severity-ranked findings with evidence, fix, owner, status and a count strip), `checklist` (pass / fail with evidence, `"[pass] item — evidence"` terse form, pass rate derived), `perfbudget` (budgets vs measured, over / near / ok derived), `percentiles` (p50 … p99 · max per row on one axis with the SLO rule), `threatmodel` (dfd shapes inside dashed trust boundaries plus a STRIDE threats table). **UML**: `usecase` (actors, system boundary, include / extend / generalize), `pkg` (package diagram with dashed dependencies), `timing` (lifelines stepping through states over time). **ML**: `neuralnet` (layered network with unit counts and activations), `modelcard`. **Deck shapes**: `chevrons` (process strip with the current phase), `roadmap` (themes × periods with status chips and a now rule), and `mindmap`. `chart` gains six kinds: `pie`, `histogram`, `bell` (normal curve with σ bands and z-scored markers), `boxplot`, `pareto` (80% rule), `bullet`. The skill gains `reference/blocks/quality.md`, entries for every new block, and `reference/patterns-design.md` (the 23 GoF and the common architectural patterns mapped to block stacks); the generation eval gains 15 scenarios for them. 107 block types across 13 families.
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

### Patch Changes

- 45e3ff8: Fixes from the first generation eval (16 fresh-agent scenarios, `evals/generate`).
  - Drawings wider than 1600 viewBox units (a 12-state machine, a 14-node data flow, an 8-participant sequence) no longer shrink to half size: the stage keeps the drawing at its natural width and scrolls sideways. Print and slides still fit to the page.
  - State-machine numerals dodge state boxes, as the other graph renderers already did.
  - Gantt period heads stagger onto two rows when they do not fit their column, and cut with a tooltip when even two columns are too narrow.
  - A long quadrant y-axis endpoint label widens the left gutter instead of clipping.
  - Slopegraph labels get two more pixels of separation.
  - `avo check` hints: an unknown field that looks like a value fragment now names the unquoted-comma trap and shows the quoted form; a string where a list expects an object lists the terse forms that exist for that list.
  - Studio bundles the renderer, so its canvas picks up the same fixes.

## 0.22.0

### Minor Changes

- 2b88a17: Step-through builds for decks. Diagrams with a natural order now mark it: `sequence` (messages and frame `open` / `else` markers in document order; an activation bar arrives with the message that opened it; the step list follows the diagram), `flow` (a topological walk from `start`, each edge with the node it leads to), `state` (transitions in document order, label and table row with the arrow), `saga` (steps left to right, then the compensations from the failure point back), `spans` (bars by `start` across lanes), `steps` and `timeline` (items). The renderer emits `data-reveal="n"` on the group that appears at step n (`svg/reveal.ts` › `revealAttr`); the attribute is inert everywhere except the deck. In `avo slides` output, → / Space / PageDown / the Next button reveal one step at a time before the deck advances, earlier steps stay, and the step just revealed takes the accent for that moment (the presentation-time exception to the one-accent rule); ← / Backspace / PageUp walk back one step, then one slide. A slide reached backwards, by the jump menu or by URL hash shows its build complete in its normal rendering; the hash keeps the slide index only. Builds are announced through an `aria-live` region ("Step 3 of 18"); `prefers-reduced-motion` drops the fade. Nothing is hidden by the markup: without JS, in print, and on a page the diagram is whole. Opt a slide out with the `{nobuild}` heading marker (`## Title {nobuild}`), stripped from the title like `{top}` / `{split}` — `@avodado/core` gains `readBuildMarker` beside the other marker readers. Studio bundles the renderer, so Present mode gets the same builds.
- 6498446: Two cloud & microservices blocks. **`spans`** draws a distributed-trace waterfall: one lane per service (first-appearance order, with a chip for its dominant span kind), a nice-number time axis in `unit` (`ms` · `s` · `us`), and one bar per span placed by `start` and sized by `duration` on that shared scale — bars lighten with nesting depth (ink → muted → paper-2), a thin connector joins each child to its parent, the critical path (root, then the longest child at every hop) takes the accent, and `error: true` draws a negative outline plus an `ERR` chip. `attrs` and `note` list under the drawing; a name that cannot fit its bar follows the duration label instead of being cut. Terse item: `service/id: name · start · duration [· parent]`. Density warns past 40 spans. **`rollout`** draws a progressive-delivery strip: one paper card per stage with a `STAGE n` eyebrow, the name, the status chip (done = paper-2 fill · current = accent outline · next = dashed · blocked = negative), an ink traffic bar, the hold `duration`, and the note; each stage's `gate` rides as a chip on the connector to the next card; `rollback` is the footer line; `strategy` (`canary` · `blue-green` · `rolling` · `feature-flag`) shows in the eyebrow. Terse stage: `"[status] traffic% · name · duration — gate"`.
- 6498446: `block` learns deployment topology. Groups nest by declaration: `groups[].parent: <id>` places a zone inside a region and a subnet inside the zone; the renderer draws parents first and steps each child in 8px with its own eyebrow tab (three levels read), and `avo check` warns (`W_GROUP_NESTING`) when a child's cells fall outside its parent or the `parent` id resolves to nothing. Nodes take `replicas: N` — from 2 up the node draws as a stacked card (two offset paper cards behind) with a `×N` chip, and the legend names it. `preset: k8s` frames a Kubernetes namespace map: `ingress` (the entry, so the accent), `service`, `deployment`, `pod`, `configmap`, `secret`, `job` / `cronjob`, `node` and `namespace` get chips, shapes and glyphs. A new cloud glyph set (`svg/glyphs.ts`) draws one 14px single-stroke `muted` path per kind — function, bucket, queue, topic, cache, db, cdn, lb, gateway, pod, cluster, user, browser, mobile, cron, ml, secret, config — with a generic box for everything else. `cluster` follows the family's accent rule: the single `gateway`-kind service, when exactly one exists. Documents without `parent` or `replicas` render byte-for-byte as before.
- 6498446: Two async-contract blocks. `eventcontract` is the twin of `endpoint` for events: `name`, `version`, `channel`, `summary`, `producers` / `consumers`, `delivery` (at-least-once · at-most-once · exactly-once), `ordering` (none · per-key · global), `key`, `retention`, payload `schema` and `headers` (terse `name type [required] — desc`), an `example`, `errors` (terse `Name — when`), and a `note`. It renders as a card in the skin: an `EVENT · v2` eyebrow, a channel chip, a PRODUCERS → CONSUMERS strip of mono chips, the delivery facts as outlined word chips, the payload table with the partition-key row marked `#` (the card's one accent) and optional fields `?`, and the example on the code surface. `saga` draws a distributed transaction: `steps` (terse `id: Name · service · compensate`, or `· service · action · compensate`) as paper cards left to right with the owning service as a chip, the compensation under each as a dashed card, and `failAt` naming the step that fails — it takes the one accent and a `FAILED` chip, earlier steps read `COMPENSATED`, later ones `SKIPPED` on the inactive fill, the forward arrows past it turn dashed, and a `negative` dashed compensating flow runs right to left back to step 1; `mode: orchestration` adds a coordinator band on top fanning out to every step. Both blocks carry data paths for Studio, a legend (saga), a density budget of 12 saga steps, catalog templates, and skill reference entries.
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

- 430ba0b: Schema hardening: numbers, grid coordinates, the ERD column shorthand, and in-block references.

  **Non-finite numbers are rejected.** Zod's `z.number()` accepts `Infinity`, and YAML `.inf` parses to exactly that, so `packet: {width: .inf}` validated clean and then made a renderer append to a string until the process ran out of memory. Every numeric field now goes through one shared builder that requires a finite value; no block field wants `Infinity`. A test fails the build if a bare `z.number()` returns to the schema file.

  **Fields that multiply output size carry a ceiling.** `packet.width` (≤ 128), `packet.fields[].bits` (≤ 4096) and a `wireframe` element's `rows` (≤ 40) each became a renderer loop bound — `width: 1000000` produced a 108 MB page with no diagnostic. A value that is merely unwise rather than impossible warns instead: `W_DENSE_BLOCK` above 64 bits per row, and above 12 rows in one wireframe element.

  **Grid coordinates are 1-based whole numbers.** `col: 0` used to paint a node at a negative x, entirely outside the `viewBox`, with nothing on the page to say a node was lost. `col` / `row` are now integers from 1 and `cols` / `rows` / `w` spans at least one cell, across `c4`, `block`, `dfd`, `graph`, `felogic`, `swimlane`, `state`, `flow`, `uml`, `frontend`, `sankey` and the shared group panel. `lane` and `layer` stay 0-based: they index a declared list. Studio's "+ Add group" chip seeded `col: 0`; it now seeds the schema's floor.

  **The ERD column shorthand keeps a multi-word default.** `created_at timestamptz default=CURRENT TIMESTAMP` parsed as `default: CURRENT`, `type: "timestamptz TIMESTAMP"`. The shorthand now tokenizes quote-aware and paren-aware, only treats a leading `name:` as the single-pair separator, and reads `default=` to the closing quote or to the next flag. `default=12:00`, `default=0::numeric`, `default="hello world"`, `enum(a:b,c)` and `numeric(10, 2)` all survive.

  **An in-block reference to a thing that does not exist is reported.** An `erd` relation naming an entity that is not declared, a `block` edge naming a missing node, a duplicate entity name and a duplicate node or group id were all discarded in silence while the diagram rendered as if the line were never written. They are now `E_SCHEMA`, matching what `spans` and `saga` already do for theirs.

  Diagnostics also read better: a non-finite value reports its cause once instead of three times, and a fractional coordinate says "expected a whole number" with the fix.

- 3a8d480: `sequence` is now a complete sequence diagram. Core: `messages[]` items are a union of a message (now with `activate` / `deactivate`), a frame open (`{ frame: alt | opt | loop | par | break | critical, label? }`), a frame else (`{ else: label }`) and a frame end (`{ end: true }`); terse forms `- alt: token valid`, `- else: expired`, `- end`, and `A -> +B` / `B --> -A` activation signs; a new `W_SEQ_FRAME` warning for a stray `else`/`end` or an unclosed frame; the density budget counts messages only; the Mermaid dialect keeps `alt`/`opt`/`loop`/`par`/`critical`/`break` … `else`/`and`/`option` … `end` and the `+`/`-` activation suffixes instead of dropping them. Render: variable row heights, UML frames (tab, `[guard]`, dashed else divider, nested insets) drawn under the lifelines, explicit or inferred activation bars (a bar opens on an incoming call and closes on its reply), real self-message loops, note boxes beside one lifeline or over two, and frame dividers in the step list. Studio: the message form and inline editor pick the union arm that matches the item, and step numbers skip frame markers.
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

### Patch Changes

- 430ba0b: CLI safety: no silent data loss, no stale site, no unreadable document called clean, no anonymous render crash.

  **A command never destroys a file you wrote.** `avo sync openapi|csv|sql|dbml|prisma --out` used to overwrite the target and print a checkmark; it now refuses, names the file, and names `--force`. The same rule covers every command that writes to a path you named: `avo new -o`, `avo block -o`, `avo template -o`, `avo design <slug> -o`, and `avo skill -o` never replace an existing file, while the export commands (`avo html|slides|pdf|pptx`, and the gallery writers `demo` / `catalog` / `compare` / `design -p -o`) replace a file only when the path already carries the extension they produce — re-exporting `report.html` is the normal loop, writing HTML over `notes.md` is not. Each of those commands gained a `--force` flag. `avo init` already skipped existing files and is unchanged; `avo build` owns its output directory and is covered by the manifest below.

  **`avo build` prunes.** It records what it generated in `dist/.avodado-build.json` and, on the next build, removes exactly the files that manifest lists and this build no longer generates — so a doc deleted from `docs/` stops being served. Nothing else is touched: a `CNAME`, an `assets/` folder, or any other file you placed in the output directory was never in the manifest. An output directory with no manifest (built by an older Avodado) is left completely alone, with a one-line note; pruning starts from the next build.

  **A file that is not UTF-8 is reported, not validated.** `avo check` used to pass invalid bytes and UTF-16 files clean, silently validating replacement characters. It now emits `E_ENCODING` naming the file and the line. A UTF-8 byte order mark is stripped instead of pushing the first fence off line 1. Symlinks under the docs root are no longer followed, and the same file reached by two paths loads once — a `docs/loop -> .` cycle used to invent dozens of duplicate-id errors.

  **A renderer crash names its document.** `avo build` reported a renderer throw as a bare `Invalid string length` with no file, line, or block type. Every render is now guarded per document: the failure becomes an `E_RENDER` error that names the file, the line, and the block (found by re-rendering each block on its own), the failed document gets a placeholder page so its URL keeps working, every other document still builds, and the build exits 1. `avo html|slides|pdf|pptx` prefix the same attribution onto their error. `@avodado/core` adds the `E_ENCODING` and `E_RENDER` codes to the diagnostic taxonomy.

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

- d5e8928: Sequence polish found by the write eval: message labels get a paint-order halo so text stays legible where it crosses a lifeline; `foot` items render as spaced pills instead of running together; step-list error rows no longer inherit the generic `.err` block style. Core: an unquoted numeric or boolean label in a terse arrow item (`A -> B: 200`) now expands to a string label instead of failing schema validation.
- 2b88a17: Studio: right-click menus and motion on the direct-edit layer.
  - **Context menus** (right-click, ⇧F10, the Menu key) on every diagram part — grid nodes (add a connected node in a direction with a kind picker, change kind, replicas, add to / remove from group, rename, delete with its edges), edges (kind, edit label, reverse, delete), empty cells (insert node / group), the block background (insert node, direction, open YAML), sequence actors and messages (connect mode, notes, kind, wrap a range in `alt`/`opt`/`loop`/…, activate/deactivate, delete), ERD entities and columns (add column, relation mode, pk/fk/unique/nullable/indexed toggles, delete). Every item is ≤ 2 clicks from the right-click and writes the same YAML ops the drag/connect layers emit — one undo step each.
  - **Motion**: commits play a FLIP (transform-only, 140 ms ease-out) across the re-render; new parts pop, re-routed edges crossfade, deletions fade out first. The connect ghost edge is dashed terra and the snap target gets a highlight ring. All skipped under `prefers-reduced-motion`.
  - `felogic` and `cluster` join the connect-spec table (drag-to-move, connect, menus); the felogic renderer now emits the grid metadata attrs the editor reads (no visual change).
  - core exports `SEQUENCE_FRAME_KINDS`.

## 0.21.0

### Minor Changes

- e1f3a0e: feat(core,cli): per-type density budgets — `avo check` now warns when a diagram should be split
  - New core lint `lintDensity(doc, file)` and exported `DENSITY_BUDGETS` map: conservative per-type complexity caps (sequence >8 actors or >24 messages; flow/dfd >24 nodes; state >16 states; c4/block/felogic/frontend >20 nodes; erd >12 entities; tree >40 nodes; graph >30 nodes; cluster >16 services; archmap >8 areas; kanban >8 columns; timeline >20 items; journey >10 stages). Pure counts, no heuristics; a block at exactly the cap passes.
  - New diagnostic code `W_DENSE_BLOCK`, wired into `avo check` beside the prose lint. Always a warning with a per-type split suggestion — it never affects the exit code, and `--strict-prose` does not escalate it.

- e1f3a0e: feat: new `fishbone` block type (88 total) — cause & effect (Ishikawa) analysis. One `effect` at the head of a horizontal spine, 1–8 `causes` as bones alternating above and below, up to 8 `items` (specific causes) ticked along each bone. The renderer spaces bones by label width, so long labels grow the diagram instead of overlapping; text stays horizontal and wraps with an ellipsis past four lines. Studio and MCP pick up the new type via the bundled core/render and the regenerated embedded skill.
- e1f3a0e: feat(core,cli): STE-informed prose linter — `lintProse` in core, wired into `avo check` with `--strict-prose`
  - `@avodado/core` exports `lintProse(doc, file, opts?)` and `PROSE_CHECK_CODES`. Six checks, all level `warn`: `W_PROSE_LONG_SENTENCE`, `W_PROSE_LONG_PARAGRAPH`, `W_PROSE_PASSIVE_STEP`, `W_PROSE_TENSE`, `W_PROSE_FILLER_OPENER`, `W_PROSE_TERM_DRIFT`. Glossary terms gain an optional `avoid` list; a listed word in the doc's prose reports term drift.
  - `avo check` runs the prose lint on every doc, next to schema validation and reference resolution. Findings surface as ordinary diagnostics (table, `--json`, code frames) and stay warnings — exit 0. The new `--strict-prose` flag escalates `W_PROSE_*` to errors and exit 1. `avo build` is unchanged: prose warnings never fail a build.
  - `@avodado/render` renders the glossary `avoid` field as "not:" chips; `@avodado/studio` bundles core/render and is patched to pick both up. `@avodado/mcp` embeds the updated skill reference.
  - Block text fields (`description`, `lede`, `body`, `note`, `subtitle`, `summary`) are exempt from `W_PROSE_LONG_PARAGRAPH` — fields carry complete information, and a sentence-count cap pressures fact deletion; markdown paragraphs, `prose` texts, and `steps` item text keep the cap, and fields keep every form check.

- e1f3a0e: chart `kind: scatter` gains numeric-axis `points` (x/y, `size` bubbles, per-point labels with collision nudging) plus `guides` (dashed x/y reference lines and TL/TR/BL/BR quadrant labels) and `xLabel`/`yLabel` axis titles; `tree` gains `variant: org` (top-down tidy org chart, node `role` under the label). Both additive — existing `labels`+`series` scatter and default/issue trees render byte-identically.
- e1f3a0e: feat: two new block types (90 total) — `storymap` and `slopegraph`. `storymap` (planning) is a user story map: a `backbone` of 1–10 ordered activities across the top, 1–6 release `slices` as horizontal bands whose cards stack under the step they belong to; each slice must give exactly one cell per backbone step (validated), cards are strings or `{ title, tag }`. `slopegraph` (charts & overviews) is a ranked before/after comparison: `left`/`right` column headers, 2–20 items each drawn as one straight line between the two baselines, positioned by value on a shared linear scale; colliding labels are nudged apart deterministically and an `accent` highlights the lines that carry the story. Both types ship density budgets (backbone > 10 steps, items > 20 warn `W_DENSE_BLOCK`). Studio and MCP pick up the new types via the bundled core/render and the regenerated embedded skill.

### Patch Changes

- e1f3a0e: `avo check` now enforces the on-disk convention with `W_DOC_CONVENTION` warnings: doc filenames under the docs root must be kebab-case slugs, and docs may sit at most one group level deep (`docs/<area>/<doc>.md`). Files outside the docs root are not checked. The warnings never gate the exit code and no flag escalates them. `avo init` documents the layout in its config template, its summary line, and the skill's `reference/organizing.md` ("Where files live"). `@avodado/core` adds the `W_DOC_CONVENTION` code to the diagnostic union.
- e1f3a0e: docs(skill): rewrite authoring skill as toolkit (question→primitive table, selection procedure, recipes, STE style guide); rewrite demo/template prose
  - The skill gains two reference files: `reference/recipes.md` (composition recipes) and `reference/style-ste.md` (STE-informed writing rules). Both join `SKILL_REFERENCE_FILES`, the `avo skill` stitch, and the MCP embedded skill.
  - SKILL.md is rewritten around a question→primitive table and a 7-step selection procedure; the trigger-word playbooks and the flat glossary table are gone.
  - Demo, template, and prefilled doc-template prose (`@avodado/core` docTemplates) follow the new prose rules: no restating the block, short factual sentences.
  - `@avodado/studio` bundles core/render, so it is patched to pick up the rewritten doc templates.

## 0.20.2

### Patch Changes

- 4eceaec: Each package now exports its own `package.json`.

  An `exports` map that omits `./package.json` makes
  `require.resolve('@avodado/core/package.json')` throw, which is the ordinary way
  a consumer reads a dependency's version. The website hit exactly this: its
  version badge fell back to a hard-coded string and advertised v0.41.0 for a
  0.42.0 release. Adding the subpath costs nothing and removes the trap.

## 0.20.1

### Patch Changes

- 6837e18: Repaired flow-mapping values in the new templates that swallowed the keys after them.

  An unquoted YAML flow value containing a comma absorbs everything up to the
  closing brace, so `mitigation: Rehearsed twice, owner: Orders` parsed as one
  long `mitigation` string with no owner and no status. Every field involved is
  optional, so it validated cleanly and only showed up in the rendered document —
  a sequence message losing its `kind`, a risk row losing its owner.

  Twenty-six rows across seven templates are fixed, and a test now rejects the
  pattern at the source rather than waiting for someone to notice the render.

## 0.20.0

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

## 0.19.0

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

## 0.18.0

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

## 0.17.0

### Minor Changes

- 2cde519: Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
  `c4` written as just nodes + edges used to come back as a tall column of ranks
  that outgrew the page and shrank to a thin strip on a slide; it now runs across
  the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

  New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
  for the other direction — it steers the auto-layout only, so diagrams with
  `col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.

## 0.16.1

### Patch Changes

- 0451174: Slides: the stage-column treatment now covers every stacked text block —
  `agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
  steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
  are already grids (team, persona, drivers, gallery) or whose vertical order is
  the point (layers, changelog) are untouched. Also fixes the terse OKR
  key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
  progress bars show the real percentage instead of clamping to 100%.

## 0.16.0

### Minor Changes

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

## 0.15.0

### Minor Changes

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

## 0.14.0

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

## 0.13.0

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

## 0.12.1

### Patch Changes

- 7052a5d: Rename the CLI package `@avodado/cli` → **`avodado`** (unscoped) for
  discoverability: `npm i -g avodado`, `npx avodado`, and the command is available
  as both `avo` and `avodado`. `@avodado/cli` is deprecated and points here.

  Also improve the npm READMEs: the CLI README opens with a worked example (a
  Markdown doc with a `sequence` block → `avo check` / `avo html` / `avo studio`)
  in plainer language; the core README lists the real block-type set (77 across 12
  families) instead of a stale short list.

## 0.12.0

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

## 0.11.0

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

## 0.10.0

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

## 0.9.0

### Minor Changes

- Agentic blocks, 106-pattern library, the full shape language, and a restructured skill. **AI & agents family** (79 → 83 blocks): `agentloop` (agent + tools + memory with numbered loop arrows and a stop-condition pill), `trace` (execution transcript with thinking and tool calls), `prompt` (prompt anatomy with highlighted `{{variables}}`), `context` (context-window token budget bar with overflow) + an Agent-system-doc playbook. **Design library 80 → 106**: interpreter (the 23rd GoF), architecture classics (mvc, mvvm, dependency-injection, unit-of-work, active-record, data-mapper, event-bus, specification, null-object), resilience/concurrency/messaging (retry-backoff, bulkhead, timeout, cache-aside, throttling, actor-model, producer-consumer, thread-pool, competing-consumers, splitter-aggregator), and agentic patterns (plan-and-execute, human-in-the-loop, agentic-rag, swarm-handoff, chain-of-thought, context-compaction). **Diagram elegance**: labeled C4 edges (and dense block-family diagrams) render as circled step numerals with a legend below; C4 tech renders as a chip; all node cards drop the left accent bar for the clean rounded agent-card look. **Shape language, 21 silhouettes by kind**: cylinder, tiered cylinder (warehouse), pail (S3), sharded trio, replica set, pipe, cloud, hexagon (gateway), octagon (lb), instance stack (cache + worker pools), server rack, shield (waf), actor figure, crowd, browser window, phone, ƒ circle (lambda), clock (cron), vault dial (secrets), globe (region), clean card — plus new kinds shard/replica/users/crowd/region/geo. **Skill restructured** for progressive disclosure: a 598-line hub (down from 2,373) + `reference/` spokes (blocks contract, system design, decks, and new per-document intake checklists with a batched ask-back protocol); `avo skill`, the Copilot adapter, and the MCP embed stitch everything into one prompt; `avo init` installs the full folder. **Plus**: a new `archmap` block (83 → 84) — the target-architecture capability mosaic with status-coded tiles (current/target/new/gap/deprecated) and an auto-legend; the shape language extends into `belogic`/`felogic` (db → cylinder, queue → pipe, cache → stack, external → cloud), `c4` (`store` → true database cylinder), and `cluster`; secrets render as a padlock and schedulers as the industry-standard calendar-with-clock; the ERD is restyled (tinted header band, content-sized entities, zebra rows, PK/FK chips); and block titles no longer render twice (the section head owns the title; the block body's duplicate header is suppressed at top level).
- The documentation-tool release. **New commands**: `avo serve` (zero-dep live-reload dev server — watch, SSE reload, in-page diagnostics banner), `avo build` (docs/ → a static site: index cards, sidebar nav with per-doc sections, cross-doc `doc#id` refs rewritten to real links), `avo mcp` (setup snippets + `--stdio` server), `avo install <tool>` (claude/cursor/copilot/windsurf — replaces the old per-tool commands, Copilot correctly named), `avo tour` (interactive 7-chapter terminal onboarding with a live-caught planted bug), `avo demo [family]` (filtered showcases with an interactive picker). **Removed**: the duplicate `render` command (use `html`). **Render**: blocks with an `id:` emit real anchors + `data-block-id`; userstory/stories ref chips are real links; C4 goes professional (level-aware `C4 · CONTAINER` tag, centered structurizr-style typography, dashed externals, legend derived from the kinds present, taller cards) and the layered architecture drops its solid label slabs for tinted zone bands with optional per-layer `color`. **Catalog** groups all blocks by family. **Skill**: `reference/blocks/` per-family split with INDEX + whole contract table (coverage-tested), trimmed trigger frontmatter, new "Organizing a documentation set" + "Reviewing an existing doc" + "C4 done right" guides. **Slides** gain an automated gate (full-demo deck + split-layout tests). New professional cfonts wordmark + one-line banner (ANSI-free when piped) and purpose-grouped help.
- Twelve more blocks (67 → 79) plus consulting-style decks. **Engineering & decisions**: `waterfall` (latency/cost budget cascade with a dashed budget line and over/under chip), `heatmap` (numeric grid with intensity ramp + legend), `scorecard` (weighted decision matrix with computed totals and winner highlight), `risk` (register with likelihood × impact severity chips), and `chart` gains a `radar` kind. **Design system** (new family): `palette` (color-token swatches with auto-contrast labels), `typescale` (live type specimen), `dodont` (Do/Don't guideline cards), `inventory` (component status board) + a Design-system doc playbook in the skill. **Algorithms & data structures** (new family): `array` (cells, indices, pointer labels, window highlight), `linkedlist` (singly/doubly with head/curr markers), `bintree` (binary tree with per-node walkthrough states), `hashmap` (buckets + collision chains); `graph` gains node `state` (visited/current/frontier/target) and edge `weight` for BFS/Dijkstra walkthroughs. **Decks**: `{split}` heading marker renders the consulting layout (message left, exhibit right), every slide gets a footer (deck title · page number), and the skill gains a Consulting-style decks section (action titles → one exhibit → takeaway). Also fixes `avo <cmd> | head` leaving an unsettled flush await.
- Fourteen new block types — the catalog grows from 53 to 67. **Everyday primitives**: `chart` (bar / line / area / donut, pure SVG), `figure` (image + caption), `diff` (unified +/− code diff on the dark editor surface), `steps` (numbered runbook stepper with per-step commands), `faq` (Q&A accordions). **System design**: `envelope` (back-of-envelope capacity math — assumptions → derivation rows → highlighted result), `slo` (service objectives with error-budget burn bars), `terminal` (shell session, distinct from code). **Business & strategy**: `swot`, `funnel` (conversion trapezoids with stage-to-stage %), `okr` (objectives + key-result progress bars), `persona` (user persona cards), `changelog` (release rail with typed change chips), `team` (people cards). All fully registered: strict schemas, renderers + CSS in the house style, `avo block` scaffolds, catalog descriptions, demo showcase sections, and skill documentation (glossary, contract table, examples, new Business & strategy family).
- Presentation text blocks + a full template set. **Three new blocks (84 → 87)**: `divider` (deck part-break interstitial — kicker, big title, accent wash), `bignumber` (the hero-stat slide: one huge figure + claim + context), `takeaways` (numbered presentation-scale closing statements). Dividers render full-width on slides; blocks whose title _is_ the visual no longer have it lifted into the section head; `{split}`/`{top}` heading markers no longer leak into HTML doc headings. **`avo template` grows from 1 to 11**: adr, design-doc, runbook, roadmap, api-spec, system-design, agent-system, design-system, postmortem, data-model, and a `deck` template demonstrating the consulting formula (divider → `{split}` argument slides → bignumber → takeaways) — every template schema-validated by tests and namespaced so several scaffold cleanly into one repo. The skill's deck guide covers when to use each, and the playbooks table maps each playbook to its template.
- System-design diagram overhaul. **Quick mode**: `col`/`row` are now optional on the block family, `graph`, and `felogic`/`belogic` — omit coordinates and the layout is computed from the edges. **Canonical shapes by kind**: db/store/warehouse render as cylinders, queue/topic/stream as horizontal-cylinder pipes, cdn/external as clouds, gateway/lb/proxy as hexagons, cache/redis as stacked-instance cards. **~40 new node kinds** with glyphs (dns, waf, auth/idp, monitor, scheduler, stream, warehouse, search, ml/llm/agent, vm, secrets, notification, email, ci, git, registry, device, analytics, config, …) plus vendor aliases (postgres/mysql/mongo→db, kafka/kinesis→stream, s3, sqs, redis, elasticsearch). **C4**: edge `tech:` labels, multiple named `boundaries[]`, and a fix for edge labels never rendering. **Cluster**: namespaces now sit side by side, self-sized, in the refined zone style. **UML**: content-sized class cards with tinted header compartments. **Polish**: nested infra zone labels no longer overlap, off-palette ink normalized to theme vars, graph label clamping, slide decks render text at presentation scale with a proper measure (text-only slides no longer over-scale). Skill updated throughout.

## 0.8.0

### Minor Changes

- New `gallery` block (now 53): a real grid (2 columns by default; set `cols` for
  3–4) of cells. Each cell is a syntax-highlighted code snippet, a note, or a
  **nested block** (`block: { type: c4, …data }`) — so you can lay out a bug gallery
  of code or compare several architectures/diagrams side by side. Nested blocks are
  validated against their own schema. Skill, `avo block`/`avo catalog`, and the
  showcase updated.

## 0.7.0

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

## 0.6.0

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

## 0.5.0

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

## 0.4.0

### Minor Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).

## 0.3.0

### Minor Changes

- Gap-filling blocks (inspired by replicating a rich design doc), bringing the catalog to **44**:
  - **`pullquote`** — a standout pull-quote with optional attribution.
  - **`layers`** — a layered explanation: N numbered layers, each with a kicker / title / source / question + body (e.g. an L1/L2/L3 model).
  - **`callout` gains a `success` tone** (green).
  - **`userstory` is richer** — optional `title` and `tags`, shown as a header with the points pill.

  All wired through the schema, renderer, `avo new` templates, and the authoring skill.

## 0.2.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

## 0.1.0

### Minor Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.

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
