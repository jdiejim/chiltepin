---
name: chiltepin
description: >-
  Write, edit, validate, and render Chiltepin docs: Markdown with typed YAML
  blocks for diagrams, API references, ADRs, runbooks, and slides. Use when
  the user requests Chiltepin or the chiltepin CLI, or edits typed-block docs in a
  Chiltepin project (chiltepin.config.*). Preserve an explicitly requested format;
  installing this skill alone does not make every Markdown task a Chiltepin task.
---

# Chiltepin — docs as Markdown with typed YAML blocks

A doc is plain Markdown. Anything structured — a diagram, a table, a plan — is
a fenced block whose info-string is the block type and whose body is YAML.
The `.md` file is the only source of truth. Never paste HTML or SVG. Never
place pixels: the renderer owns layout and colour, you own the facts.

## What a great doc looks like

A great doc opens with two sentences the reader could forward: the answer,
then the number or limit that forces it. If the answer is a proposal, the
first sentence says so. The headings, read alone, make the argument. The
first diagram shows the whole mechanism on one screen, loops intact. Later
blocks zoom in on what breaks at the named limit, the number that matters,
and the option chosen over the one rejected, with its cost. Each invented
value is marked once. The doc ends on what happens next: the open decision
and its owner, or the follow-up work.

## Tools

Use the project's CLI (`pnpm exec chiltepin`), else `npx -y chiltepin@latest`;
in the Chiltepin repo, `node packages/cli/dist/bin.js`. Detailed references
live beside this file — read them on demand (the table at the end).

| Command | What it does |
|---|---|
| `chiltepin block` | Prints the catalog: it lists all 107 block types by family, and the old names that still work. |
| `chiltepin block <type>` | Prints one block's fields, field notes, terse forms, and a grammar example. |
| `chiltepin check <file> --json` | Validates. Each diagnostic has a stable code, the value, and a hint. |
| `chiltepin review <file>` | Runs the check, renders every block (light, dark, 400 px, print), and prints one line per problem with its fix in data terms. Writes `contact-sheet.png`. |
| `chiltepin html <file>` | Writes `<file>.html` beside the source. `-p` opens a preview. |
| `chiltepin slides <file>` · `pdf <file>` | Renders the doc as a deck, or as a PDF. |
| `chiltepin sync openapi\|csv\|sql\|dbml\|prisma <file>` | Imports a real source, so you never retype it. |
| `chiltepin audit [path]` | Reads a codebase and lists the docs it needs, with evidence. |
| `chiltepin studio` · `build` | Opens the visual editor, or builds the static site. Hand these to the user. |
| `chiltepin new <type>` | Prints an empty block scaffold. Doc templates (`new adr`) are for a person who starts blank; never fill one from a request. |

## The loop

Run all seven steps for a full doc. For one diagram, run steps 1 and 3–7.

1. **GROUND — build a fact inventory** from the request and every file the
   user points at (import with `sync`). Start with the reader: who, when,
   and what they decide or do next. Then list components (nodes),
   interactions (edges, as verbs), numbers and their sources, limits,
   failure cases, owners, and boundaries. For each limit (80 ms, 3 repairs),
   find what happens when it is hit and who chose it; if nobody says, it is
   an open question with an owner. Ask back when a critical fact is
   missing (`reference/intake.md`).
2. **PLAN — the headings make the argument.** One block per reader question
   (table below; `reference/recipes.md`). Most single-topic docs need 2–5
   blocks; a design or review doc can need more. Open with two sentences:
   the answer, then the number or limit that forces it. Headings state
   claims, or tasks in a how-to (`reference/writing.md`). The last section
   says what happens next: the open decision and its owner, open questions
   (`faq`), or follow-up work (`statustable`). Never end on caveats.
3. **CONTRACT — run `chiltepin block <type>` for each block.** Use only the
   fields it prints. Its example shows grammar only: never reuse its nouns,
   node count, layout, or shape.
4. **COMPOSE — build from the kit (`reference/kit.md`).** Nodes come from the
   inventory, each with a `kind`. Groups mark real boundaries only; edge
   labels are verbs. Omit `col`/`row` unless groups need them. Mark the one
   thing the heading claims, once (the Focus table).
5. **CHECK — run `chiltepin check <file> --json`.** Fix every error, and each
   warning in the data (`reference/check.md`). Rerun while each run makes
   progress. Never report a check you did not run; without the CLI, say so.
6. **REVIEW — run `chiltepin review <file>`.** Fix each line it prints in
   the data, then run it again. Then read the doc as its reader:
   - The opening gives the answer and the number that forces it.
   - The headings, read alone, make the argument.
   - The first diagram shows the whole mechanism, loops intact.
   - Each limit says what happens at the limit, and who chose it.
   - Each number has a unit, a window, a baseline, and a source.
   - Each invented value is marked once; no block repeats another.
   - The last section says what to do or decide next, and who owns it.
   - Would this outline fit any other request? If yes, rebuild it.
7. **HANDOFF.** Give the `.md` and `.html` paths, the actual `check` and
   `review` results, open diagnostics, and open questions with owners.
   Then one next step: open the `.html`, or edit in `chiltepin studio`.

**Invented facts.** Mark an invented value once, where the reader acts on
it: in the block's `note`, or one inline "(assumed)". When most specifics
are invented, say so once in the opening and set `meta.status: example`.
When the central answer is invented, the first sentence says so and
`meta.status` is `proposal`. Never invent a company or product name:
write "our platform". Never write "the request": the reader never saw it.

Editing a doc: read it whole, change the one block, and carry the fact into
related blocks. Rewrite the whole doc only on request.

## Pick the block by the reader's question

Find the question, read the family file, and avoid the trap.

| Reader question | Read | Pick, and the trap |
|---|---|---|
| What calls what, in what order? Where did the time go? | `flows.md` | messages in order → `sequence`; measured durations → `spans` |
| What runs where, inside which boundary? | `architecture.md` | topology → `block` (`kit.md`); stakeholder context → `c4`; namespaces → `cluster`. Not `graph` |
| What happens when it fails? Which states? | `flows.md` | branches, retries → `flow`; multi-service undo → `saga`; one object's lifecycle → `state` |
| What are the exact steps? | `flows.md` | linear → `steps`; branches → `flow`; owners per step → `swimlane` |
| How does the AI system run? | `kit.md` | a `flow` or `block` from the AI kit. `agentloop` is the trap |
| What does the API or event carry? | `api.md` | HTTP → `endpoint`; one event → `eventcontract`; bits → `packet` |
| What shape is the data, and where does it go? | `data-model.md` | at rest → `erd`; processes and stores → `dfd`; volumes → `sankey` |
| How big, how fast, how much? | `tables-data.md` | one headline → `bignumber`; KPIs → `stats`; napkin math → `envelope`; the tail → `percentiles` |
| What changes over time? | `charts-overviews.md`, `planning.md` | a measured quantity → `chart`; ordered events or phases, past or planned → `timeline`; releases → `changelog` |
| What is it made of? | `charts-overviews.md` | part-of → `tree`; proportions → `treemap` (more than 6 parts) or a donut `chart`; an AND of access checks → `composition` |
| Which option, and why? | `business.md` | verdicts → `options`; one option → `proscons`; scores → `scorecard`; measurements → `benchmark` |
| What is the plan, status, or risk? | `planning.md` | status per row → `statustable`; risks → `risk`; themes × quarters → `roadmap` |
| What did the review find? | `quality.md` | findings → `audit`; a standard → `checklist`; STRIDE → `threatmodel` |
| Who does what, and how does it feel? | `flows.md`, `charts-overviews.md` | owners per step → `swimlane`; a staged experience with feelings → `journey` |
| Where do we stand, and what do we build? | `business.md` | `swot`, `wardley`, `scenarios`, `okr`, `persona`, `venn`. A frame with a missing side is the trap |
| How do branches fork and release? | `flows.md` | `gitgraph`, not `timeline` |
| Which tokens, and how do we use them? | `design-system.md` | `palette`, `typescale`, `dodont`, `inventory`, `wireframe` |
| How does the algorithm move through the data? | `algorithms.md` | `array`, `linkedlist`, `bintree`, `hashmap`, or `graph` with `state`. Not `flow` |
| Is it a table, or a table with a job? | `tables-data.md` | `table` only when every cell is a plain fact |

The type name is a hint, not a cage: a `quadrant` is any two-axis 2×2, a
`cvt` any before → after in words (numbers per row: a dumbbell `chart`).
Relabel every axis and unit in the user's nouns.
Fixed frames (`agentloop`, `cycle`, `swot`, `scqa`, `pyramid`, `chevrons`)
draw one set picture: choose one only when the facts already have that
shape. Old block names stay valid (`chiltepin block` lists them); write
the canonical name.

## Writing rules

- **Quote any YAML value that contains `,` `:` `#` `{` `}` or starts with a
  special character.** Inside `{ a: b, c: d }` an unquoted comma splits a
  phrase into keys. Quote numbers that must be strings (`version: "1.0"`).
  Always quote prose fields (`desc`, `note`, `summary`, `description`).
  When unsure, write the body as JSON — it is valid YAML.
- Prefer the terse one-line forms the contract prints (`a -> b: label`,
  `Term — definition`). Use the object form only for a field the grammar
  cannot say.
- **The page contract.** A full doc starts with `meta`: `title`, `subtitle`
  (the answer in one line, never the question), `tag` (the kind of doc),
  and `status`, `owners`, `updated` when known. Your `##` heading is the
  only document heading: it states the claim. A block's `title` renders as
  its caption, "Fig. N · title": it names what the figure shows. `lede` is
  a one-line takeaway above the figure (`reference/writing.md`).
- **Links.** `[text](#id)` points back to an earlier block or heading;
  `[text](doc#id)` points into another doc. Give a block an `id:` when a
  link points at it. A missing target fails the check (`E_DANGLING_LINK`).
- **Numbers.** Give each number a unit, a window or percentile, and a
  baseline or target: "p95 over 7 d: 2.4 s → 600 ms". Set the block's
  `unit` field when it has one. Cite the source in the `note` or the sentence.
- Use the user's nouns verbatim, and one name for one thing in every block.
- **Inline styling** (`==highlight==`, `[Beta]{.pill .done}`, `:check:`) is
  rare: one highlight per section, chips for status words (`reference/writing.md`).
- **Vary the lens.** A third `callout` or a fourth block of one type warns
  (`W_LENS_REPEAT`). Reach past `callout`, `table`, `sequence`, `flow`:
  code to copy → `code`; terms → `glossary`; reader questions → `faq`.
- Never trim diagram data (names, messages, labels, values) to fit; split
  the diagram. `sequence`, `flow`, `erd`, `state`, and pie `chart` also accept
  ```mermaid, with fewer fields (`reference/mermaid.md`).

## Prose rules

`reference/style-ste.md` is the authority. Between blocks, a descriptive
paragraph holds 6 sentences at most and a procedure 3; most need 2–4.
Every sentence carries a fact, a decision, or a consequence. Banned
openers: "In this section", "This diagram shows", "It's important to note",
"At a high level". Block text fields keep every fact in short active
sentences. Diagram data is untouchable.

## Read more only when the task needs it

| File | When |
|---|---|
| `reference/kit.md` | Any `flow` or `block`: node kinds by hue, edges, groups, the Focus table, AI composition, splits, fit. |
| `reference/blocks/<family>.md` | Choosing between neighbours in one family. |
| `reference/recipes.md` | A whole document: the questions each kind of doc raises, and how it ends. |
| `reference/writing.md` | The opening, headings, the page contract, `meta`, links, numbers, inline styling, every YAML trap. |
| `reference/check.md` | A diagnostic code you do not recognise. |
| `reference/derivations/*.md` | Worked derivations: request facts → reader → outline. Reasoning only, no YAML. |
| `reference/patterns.md` | Events, queues, streams, fan-out, outbox, CQRS, sagas, retries. |
| `reference/patterns-design.md` | A GoF or architectural pattern: the blocks that document it. |
| `reference/system-design.md` | Any "design an X" ask — the eight-step method. |
| `reference/intake.md` | An unclear reader or scope — the questions to ask back, by reader. |
| `reference/decks.md` | Any slides or deck ask. |
| `reference/organizing.md` | Multi-doc work — file naming, splitting, index docs. |
