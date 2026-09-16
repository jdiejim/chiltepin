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
place pixels: the renderer owns layout, you own content.

````
## Request flow

```sequence
actors:
  - { id: Client, name: Client }
  - { id: API, name: Orders API }
messages:
  - Client -> API: POST /orders
  - API --> Client: 201 Created
```
````

## Fast path

Use the project's installed CLI (`pnpm exec chiltepin` or `npx --no-install chiltepin`)
to match its dependency version. Otherwise, `npx -y chiltepin@latest …` downloads and
runs the published CLI. In the Chiltepin source repo, use the built
`node packages/cli/dist/bin.js`. The commands below show the fallback form.

Detailed references live beside this file — read them on demand; the table
at the end explains which reference each task needs.

1. **Pick the blocks from the reader's question**, not from the words in the
   request. Use the table below. For a full doc, two to five structural blocks
   often suffice. A single diagram request needs only that diagram. Use prose
   when a small list communicates the same information more clearly.
   Unsure which block exists: `npx -y chiltepin@latest block` lists all 107 block types.
2. **Look up each block you will write**: `npx -y chiltepin@latest block <type>`.
   It prints the fields, enums, terse one-line forms, and a validating
   example. Read a family selection sheet only when the choice remains unclear.
3. **Write the doc.** For a full doc, put `meta` first (title, subtitle, tag). A `##` heading
   above a block is its title. Prose carries why and consequence, never a
   description of the block below it. Rules in the two sections after the
   table.
4. **Check**: `npx -y chiltepin@latest check <file> --json`. Every diagnostic carries
   a stable code and the failing value; `reference/check.md` maps each code
   to its fix. Fix errors and rerun while you make progress. Stop and report
   the blocker if a diagnostic repeats without a new fix or needs missing facts.
   Warnings do not fail the check by default; review them and report relevant ones.
   A non-zero exit is never "done". If the CLI is unavailable, report validation
   as unverified. Never invent a successful check.
5. **Render**: after a clean check, `npx -y chiltepin@latest html <file>` writes
   `<file>.html` next to the source, so the reader gets the page as well as
   the Markdown. Add `-p` to open it. For a deck, `slides <file>` instead.

Handoff: the `.md` and `.html` paths, the actual check result, and any
unresolved diagnostics. Then one line on what to do next: open the `.html`
in a browser, or run `npx -y chiltepin@latest studio` to edit the document visually.
Explain block selection only when the user asks or a tradeoff needs explanation.

Editing an existing doc: read it whole first. Change the one block, and
carry the fact into related blocks within the requested scope. Preserve unrelated
content. Rewrite the whole document only when the user requests a rewrite.

## Pick the block by the reader's question

| Reader question | Blocks | Choose by |
|---|---|---|
| What calls what? | `sequence` · `graph` · `c4` | ordered messages → sequence; topology at rest → graph or c4 |
| What path does a request take through the infrastructure? | `block` · `c4` · `cluster` | tiers and hops → block; system context for a stakeholder → c4; namespaces and replicas → cluster |
| What happens when this fails? | `flow` · `saga` · `state` · `sequence` | branching decisions → flow; multi-service undo → saga; one object's lifecycle → state |
| Where did the time go? | `spans` · `sequence` | measured durations → spans; call order only → sequence |
| What does the event carry, who emits and consumes it? | `eventcontract` · `table` | one event → eventcontract; a catalog → table |
| Who publishes, who subscribes, how does work fan out? | `block` (`preset: event`) · `dfd` · `sequence` | topology of producers, topics, queues, consumers → block; the hop order with the failure branch → sequence; `reference/patterns.md` names the stack per pattern |
| How does this ship, and what stops it? | `rollout` · `steps` · `timeline` | staged traffic with gates → rollout; manual procedure → steps; dated milestones → timeline |
| What lives inside what? | `c4` · `cluster` · `block` · `layers` · `archmap` · `tree` · `composition` · `treemap` | runtime boundaries → c4/cluster/block; conceptual tiers → layers; capability landscape → archmap; part-of → tree/composition; area budget → treemap |
| What changes over time? | `timeline` · `gantt` · `changelog` · `chart` · `slopegraph` · `state` | events → timeline; scheduled work → gantt; released work → changelog; a measured quantity → chart; two snapshots → slopegraph |
| How do these options compare? | `options` · `proscons` · `matrix` · `scorecard` · `benchmark` · `quadrant` · `harvey` | criteria × candidates → options; one option → proscons; numbers → benchmark; two axes → quadrant |
| Where does data go? | `dfd` · `sankey` · `erd` | processes and stores → dfd; volumes → sankey; shape at rest → erd |
| Who does what, when? | `swimlane` · `journey` · `agenda` · `team` · `kanban` | ownership across steps → swimlane; experience over stages → journey; work in flight → kanban |
| What are the exact steps? | `steps` · `flow` | linear → steps; branches or retries → flow |
| What do we build, in what order? | `storymap` · `timeline` · `gantt` | scope per journey step by release → storymap |
| How big, how fast, how much? | `bignumber` · `stats` · `chart` · `envelope` · `benchmark` | one headline → bignumber; a set → stats; napkin math → envelope |
| What is this made of? | `anatomy` · `composition` · `erd` · `layers` | labeled parts of a string → anatomy; proportions → composition |
| What causes this? | `fishbone` · `matrix` | one effect, branching causes → fishbone |
| Why did we decide this? | `options` · `proscons` · `scqa` · `takeaways` · `callout` | the ADR shape → `reference/recipes.md`; the decision alone → callout |
| Is it a table, or a table with a job? | `table` · `statustable` · `matrix` · `heatmap` · `benchmark` · `scorecard` · `glossary` · `changelog` · `inventory` · `audit` · `checklist` · `journey` | `table` only when every cell is a plain fact. A status per row → statustable; two axes with a mark or permission → matrix; a value grid read by intensity → heatmap; measured numbers compared → benchmark; scores you gave → scorecard; term — definition → glossary; releases → changelog; components with a maturity → inventory; findings with evidence → audit; a standard applied → checklist; touchpoints per stage → journey; API params → endpoint |
| What does the API accept and return? | `endpoint` · `code` · `packet` · `table` | HTTP surface → endpoint; wire format → packet; error codes → table |
| How does the AI workflow run end to end? | `flow` · `swimlane` · `block` · `cycle` · `sequence` | agents, models, tools, humans and memory as `flow` nodes with `kind: agent / llm / tool / human / memory` — a RAG pipeline, a router, a multi-agent hand-off, a generate-check-repair loop; several owners per step → swimlane; the deployment around it → block; an improve-and-re-evaluate loop → cycle; one turn's timing → sequence. Draw the workflow the request describes; `agentloop` is only the fixed single-agent frame |
| How does one agent's loop behave? | `agentloop` · `trace` · `prompt` · `context` | the loop → agentloop; one real run → trace; the contract → prompt; window contents → context |
| What did the review find, and are we ready? | `audit` · `checklist` · `risk` | defects found with evidence → audit; a standard applied once → checklist; what might go wrong → risk |
| Are we within budget, and how slow is the tail? | `perfbudget` · `percentiles` · `slo` · `benchmark` | targets with a pass line → perfbudget; p50…p99 per endpoint → percentiles; targets over time → slo |
| Where can this be attacked? | `threatmodel` · `dfd` · `audit` | STRIDE on a data flow with trust boundaries → threatmodel; the flow alone → dfd |
| Who uses the system for what, and which module may depend on which? | `usecase` · `pkg` · `uml` · `timing` | actors and cases → usecase; module dependencies → pkg; classes → uml; states over time with durations → timing; `reference/patterns-design.md` maps the GoF and distributed patterns to blocks |
| What is the model's shape, and what may it be used for? | `neuralnet` · `modelcard` · `chart` | layers → neuralnet; the card → modelcard; loss curves → chart line |
| What ships when, by theme, and where are we in the process? | `roadmap` · `chevrons` · `gantt` · `mindmap` | quarters × themes → roadmap; phases with the current one → chevrons; dated tasks → gantt; unordered ideas around a topic → mindmap |
| What must always hold? | `spec` · `slo` · `glossary` · `callout` | invariants → spec; service targets → slo; terms → glossary |
| What does the user see? | `wireframe` · `frontend` · `felogic` | screens → wireframe; component tree → frontend; module graph with edges → felogic |
| How does the algorithm move through the data? | `array` · `linkedlist` · `bintree` · `hashmap` · `graph` · `code` | pointers, a window, or binary search over cells → array; pointer rewiring → linkedlist; a tree shape → bintree (never `tree`, that is a file hierarchy); hashing → hashmap; visit order → graph with node `state`; the reference implementation → code. A `flow` or `table` is the keyword trap here. |

The type name is a hint, not a cage: a `quadrant` is any two-axis 2×2, a
`journey` any staged progression, a `cvt` any before → after. Relabel every
axis, column, and unit in the user's own nouns.

Twelve old names still work as aliases (`infra` `event` `ddd` `network` →
`block`, `belogic` → `felogic`, `dag` → `flow`, `waterfall` `funnel` →
`chart`, `diff` `terminal` → `code`, `mece` → `tree`, `tracker` →
`statustable`). Write the canonical name in new blocks; never rewrite an
existing fence only to silence the `W_ALIAS_TYPE` warning.

## Writing rules

- Use only the fields `chiltepin block <type>` prints. Schemas are strict: an
  unknown field is an error.
- **Quote any YAML value that contains `,` `:` `#` `{` `}` or starts with a
  special character.** Inside `{ a: b, c: d }` an unquoted comma splits a
  phrase into keys. Numbers that must be strings (`version: "1.0"`, `delta:
  "0"`) get quotes. Prose fields (`desc`, `note`, `summary`, `description`)
  are always quoted. When unsure, write the body as JSON — it is valid YAML.
- Prefer the terse one-line item forms the contract prints (`a -> b: label`,
  `Term — definition`). Switch to the object form only for a field the
  grammar cannot say.
- Give a block an `id:` when another block references it; reference it as
  `doc#id`, or `#id` inside the same doc. A ref to a missing id fails the
  check.
- Use the user's nouns verbatim, and the same name for the same thing in
  every block. Headings say what the reader sees, never the block type.
- **Vary the lens.** One `callout` per doc (the assumptions), never a row of
  them: several points are a `list`, a `spec`, a `faq`, or `takeaways`. A
  third block of the same type is a warning (`W_LENS_REPEAT`). Reach past
  the habitual four (`callout`, `table`, `sequence`, `flow`): ownership
  across steps is a `swimlane`; code the reader will copy or diff is a
  `code` block (`kind: compare` for before / after); terms are a
  `glossary`; questions a reader will ask are a `faq`; a runbook is
  `steps`; side-by-side snippets or nested diagrams are a `gallery`.
  Before writing `table`, read the "table with a job" row: a grid whose
  rows carry a status, score, definition, release, or finding has its own
  block, and that block draws the status chips and derived values for you.
- Diagram data (node names, messages, labels, values) is never trimmed to
  fit. Split a dense diagram into two; `chiltepin check` warns at the caps.
- Every arrow says what crosses it, as a verb phrase, never "uses". A `c4`
  edge without a label is a warning; at container level add `tech` too.
  Solid is a call, dashed is async or optional. Flow runs left to right or
  top to bottom, one direction per diagram.
- `sequence`, `flow`, `erd`, `state`, and pie `chart` also accept a
  ```mermaid fence; `erd` accepts ```dbml and ```prisma. Subsets are in
  `reference/mermaid.md`.

## Prose rules

`reference/style-ste.md` is the authority. Between blocks: three sentences
per paragraph by default, five at most. Every sentence carries a fact, a
decision, or a consequence. Banned openers: "In this section", "This diagram
shows", "It's important to note", "At a high level". Block text fields keep
every fact in short active sentences. Diagram data is untouchable.

## Read more only when the task needs it

| File | When |
|---|---|
| `reference/blocks/INDEX.md` | Scanning every block with a one-line description (same as `chiltepin block`). |
| `reference/blocks/<family>.md` | Choosing between neighbours in one family — discriminators and hard rules the schema cannot express. |
| `reference/writing.md` | The full terse-form table, every YAML trap, `doc#id`, naming. |
| `reference/check.md` | A diagnostic code you do not recognise. |
| `reference/recipes.md` | Composing a whole document: architecture, ADR, API reference, incident, pipeline, agent system. |
| `reference/patterns.md` | Anything with events, queues, streams, fan-out, outbox, CQRS, sagas, retries: which blocks draw each pattern and the trap. |
| `reference/patterns-design.md` | A GoF or architectural design pattern (Strategy, Observer, CQRS, Circuit breaker …): the block stack that documents it. |
| `reference/system-design.md` | Any "design an X" ask — the eight-step method. |
| `reference/intake.md` | A new document with an unclear reader or scope — the questions to ask back. |
| `reference/decks.md` | Any slides or deck ask. |
| `reference/organizing.md` | Multi-doc work — file naming, splitting, index docs. |
| `reference/exemplars/*.md` | Ten finished documents to model on. |
