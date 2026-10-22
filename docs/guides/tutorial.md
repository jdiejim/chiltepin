```meta
title: The Chiltepin tutorial
subtitle: A deck-first tour of the full feature set — render it with `chiltepin slides docs/tutorial.md`.
tag: TUTORIAL · FULL TOUR
```

## What you'll learn {center}

Every `#`/`##` heading you see is one slide. This deck tours the whole block
vocabulary — architecture, data, process, planning, RBAC, and narrative — plus
cross-references and how slides themselves work.

```drivers
title: The four things Chiltepin gives you
items:
  - { title: One source of truth, body: "Diagrams live in the .md file, not a separate tool.", tag: "WHAT", icon: doc, accent: blue }
  - { title: Typed blocks, body: "A growing library of typed blocks with strict schemas.", tag: "HOW", icon: grid, accent: green }
  - { title: Validated, body: "chiltepin check gates every change.", tag: "WHY", icon: check, accent: purple }
  - { title: Many outputs, body: "HTML, slides, and PDF from one file.", tag: "WHERE", icon: layers, accent: amber }
```

## Documentation as code

The shift: stop maintaining diagrams in one tool and prose in another. One file,
validated, rendered many ways.

```cvt
title: Before and after
current:
  label: Prose-only docs
  items: [Diagrams rot in a separate tool, Nothing validates them, Copy-paste drift]
target:
  label: Chiltepin
  items: [Structure lives in the file, chiltepin check gates every change, One source of truth]
note: The .md on disk is always the truth.
```

## The one rule {center}

```pullquote
text: The .md file is the source of truth — edit a block surgically, never regenerate the whole doc.
attribution: The one rule
```

```callout
tone: tip
title: Definition of done
body: "A change isn't finished until `chiltepin check` passes — schemas, references, and duplicate ids all green."
```

## A block = type + YAML

A block is a fenced section whose info-string is the **type** and whose body is
**YAML**. Add an `id:` to reference it; add a `title:` so it reads like a document.

```code
blocks:
  - title: The shape of every block
    lang: markdown
    code: |
      ```stats
      stats:
        - { value: "76", label: Block types, trend: flat }
      ```
```

## System context

Start a system doc with who uses it and what it touches — that's a `c4` context
diagram.

```c4
title: Chiltepin in context
level: context
nodes:
  - { id: author, col: 1, row: 1, kind: person, name: Author, desc: Writes docs. }
  - { id: chiltepin, col: 2, row: 1, kind: system, name: Chiltepin }
  - { id: ci, col: 3, row: 1, kind: external, name: CI }
edges:
  - { from: author, to: chiltepin, label: edits .md }
  - { from: chiltepin, to: ci, label: "chiltepin check" }
```

## The build pipeline

Use `block` for topology — boxes and arrows. A `preset:` (`infra` / `event` /
`ddd` / `network`) picks the domain framing; `layers:` switches to horizontal
bands.

```block
preset: infra
title: Markdown in, many outputs out
systemLabel: "@chiltepin/*"
layers:
  - { label: Author }
  - { label: Core }
  - { label: Output }
nodes:
  - { id: md, layer: 0, kind: external, name: Markdown }
  - { id: core, layer: 1, kind: service, name: parse + validate }
  - { id: render, layer: 1, kind: service, name: render }
  - { id: html, layer: 2, kind: cdn, name: HTML }
  - { id: pdf, layer: 2, kind: store, name: PDF }
  - { id: slides, layer: 2, kind: web, name: Slides }
edges:
  - md -> core
  - core -> render
  - render -> html
  - render -> pdf
  - render -> slides
```

## Behavior over time

When A calls B, then B replies — that's temporal, so use `sequence`, not a flow.

```sequence
id: seq-tour
title: Validate a document
endpoint: { method: POST, path: /check }
actors:
  - { id: CLI, name: chiltepin CLI }
  - { id: Core, name: "@chiltepin/core" }
  - { id: User, name: Terminal }
messages:
  - User -> CLI: chiltepin check
  - CLI -> Core: parse + validate
  - Core --> CLI: diagnostics
  - CLI --> User: OK / errors
```

The terse arrow form is the default — `->` a call, `-->` a response,
`-x->` an error. Switch to the object form when a message needs `kind: async`,
a `summary`, or a `code` snippet.

## Decisions and branches

A `flow` is for decisions and branches (`variant: dag` frames it as a
pipeline, and its cousins `dfd` and `swimlane` cover data-flow and cross-team
processes).

```flow
title: Does it pass?
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Edit }
  - { id: check, col: 2, row: 1, kind: decision, label: chiltepin check? }
  - { id: ship, col: 3, row: 1, kind: end, label: Ship }
  - { id: fix, col: 2, row: 2, kind: process, label: Fix it }
edges:
  - start -> check
  - check -> ship: pass
  - check -x-> fix: fail
  - fix -> check
```

## A state machine

Use `state` when one object has a lifecycle — the reader asks which states
exist and what forces each transition.

```state
title: Document lifecycle
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: draft, col: 2, row: 1, kind: wait, name: DRAFT }
  - { id: review, col: 3, row: 1, kind: active, name: REVIEW }
  - { id: pub, col: 4, row: 1, kind: active, name: PUBLISHED }
  - { id: end, col: 5, row: 1, kind: terminal }
transitions:
  - { from: s0, to: draft, event: create }
  - { from: draft, to: review, event: "chiltepin check" }
  - { from: review, to: pub, event: merge }
  - { from: pub, to: end, event: archive }
```

## The data model

`erd` is for tables, keys, and relationships — never flatten a schema into a plain
table.

```erd
entities:
  - name: docs
    columns:
      - { name: slug, type: text, pk: true }
      - { name: theme, type: text }
  - name: blocks
    columns:
      - { name: id, type: text, pk: true }
      - { name: doc_slug, type: text, fk: true }
      - { name: type, type: text }
relations:
  - docs ||--o{ blocks: contains
```

Relations use crow's-foot sugar — `||--||` 1:1, `||--o{` 1:N, `}o--||` N:1,
`}o--o{` N:M.

## Backend internals

Use `felogic` for module internals — the frontend by default, `variant: be`
for the backend controller → service → repository chain.

```felogic
variant: be
title: How chiltepin html works
nodes:
  - { id: cmd, col: 1, row: 1, kind: controller, name: renderCmd, note: "chiltepin html" }
  - { id: svc, col: 2, row: 1, kind: service, name: Renderer, note: blocks → HTML }
  - { id: reg, col: 1, row: 2, kind: repository, name: BlockRegistry, note: lookup }
  - { id: theme, col: 2, row: 2, kind: gateway, name: ThemeLoader, note: CSS vars }
edges:
  - { from: cmd, to: svc, kind: uses }
  - { from: svc, to: reg, kind: uses }
  - { from: svc, to: theme, kind: uses }
```

## The component tree

Use `frontend` when the reader asks how the UI is composed — root, layouts,
pages, hooks, stores.

```frontend
title: A docs viewer
nodes:
  - { id: app, kind: root, name: App }
  - { id: layout, parent: app, kind: layout, name: DocLayout }
  - { id: page, parent: layout, kind: page, name: DocPage }
  - { id: doc, parent: page, kind: component, name: ChiltepinDoc }
  - { id: hook, parent: doc, kind: hook, name: useTheme }
```

## Access = intersected gates

For RBAC, use `composition` when access is the AND of independent checks — not
a sequence of steps.

```composition
title: How edit access is decided
result: May edit the doc
gates:
  - { kicker: "L1 · Identity", label: Signed in, desc: A valid user., source: "Source: JWT" }
  - { kicker: "L2 · Scope", label: In range, desc: The doc is in scope., source: "Source: lookup" }
  - { kicker: "L3 · Permission", label: Granted, desc: Edit is allowed., source: "Source: app DB" }
```

## Anatomy of an identifier

Use `anatomy` when one delimited string carries the meaning — a permission, a
URN, a path.

```anatomy
title: Anatomy of a permission
separator: ":"
parts:
  - { label: App, value: chiltepin, note: Which product. }
  - { label: Feature, value: docs, note: The area. }
  - { label: Action, value: edit, note: The capability. }
```

## Role × capability

Use `matrix` when the reader asks who can do what — roles down, resources
across, a level per cell.

```matrix
title: Who can do what
corner: Role / Action
cols: [Read, Edit, Publish]
rows:
  - { label: Viewer, cells: [Full, "—", "—"] }
  - { label: Author, cells: [Full, Full, "—"] }
  - { label: Maintainer, cells: [Full, Full, Full] }
```

## Weighing approaches

Use `options` to record the approaches you weighed — the rejected ones explain
the chosen one.

```options
title: How should themes work?
items:
  - { kicker: Option 1, title: Hard-code CSS, how: One stylesheet per theme., pros: [Simple], cons: ["Rebuild to change"], verdict: "REJECTED", tone: rejected }
  - { kicker: Option 2, title: JSON theme files, how: Friendly names → CSS vars., pros: [No rebuild, Editable], cons: ["A tiny loader"], verdict: "CHOSEN", tone: chosen }
```

## A one-thing fact sheet

`spec` is a compact label → value sheet for one thing; a `steps:` row holds a
short procedure.

```spec
title: The editorial look
accent: amber
rows:
  - { label: Look, value: "Warm paper, near-black ink, one rust accent." }
  - { label: Dark mode, value: "Follows the reader's OS setting." }
  - { label: Apply, steps: [Write Markdown, "chiltepin html", Done] }
```

## Numbers that matter

Use `stats` when a handful of numbers tells the story — each carries a delta
and a trend.

```stats
stats:
  - { value: "76", label: Block types, trend: flat }
  - { value: "12", label: Block families, trend: flat }
  - { value: "3", label: Output formats, trend: flat }
```

## Plan in phases

Use `timeline` when the reader asks what happens in what order.

Items take a terse one-liner — `[status] date · label · description`:

```timeline
items:
  - "[current] now · Write your first doc · Edit, then chiltepin check"
  - "[next] next · Gate it in CI · chiltepin check on every PR"
  - "[future] later · Present it · chiltepin slides"
```

## Schedule with dates

When phases have real durations, `gantt` draws bars across periods.

```gantt
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Core, start: 0, span: 1, kind: done }
  - { label: CLI + render, start: 1, span: 2, kind: active }
  - { label: "1.0", start: 3, span: 1, kind: milestone }
```

## Now / Next / Later

Use `kanban` for work in flight — any named columns of cards.

```kanban
columns:
  - label: Now
    cards:
      - { title: First doc }
      - { title: Pick a theme, tag: design }
  - label: Next
    cards:
      - { title: Wire CI }
  - label: Later
    cards:
      - { title: Author a deck }
```

## Track the work

`statustable` tracks work in a table — free columns plus one status per row,
in your own status vocabulary or the defaults.

```statustable
columns: [Task, Update]
rows:
  - { cells: [Scaffold the repo, chiltepin init ran clean], status: done }
  - { cells: [Write getting-started, Draft out for review], status: in progress }
  - { cells: [Add to CI, Waiting on repo admin], status: todo }
```

## Tell it as a pyramid

Use `pyramid` when tiers have rank — vision over strategy, the test pyramid.

```pyramid
levels:
  - { label: Meta, desc: Title + intent }
  - { label: Big picture, desc: Architecture / landscape }
  - { label: Detail, desc: One flow or module }
  - { label: Plan, desc: Roadmap + tracker }
```

## Prioritize on two axes

`quadrant` plots items in a 2×2 — effort vs impact, risk vs reward, anything.

```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.25, y: 0.8, label: Add a callout }
  - { x: 0.75, y: 0.85, label: Author a deck }
  - { x: 0.3, y: 0.3, label: Tweak a color }
```

## Map the journey

Use `journey` when the reader asks what an experience feels like across
stages.

```journey
stages: [{ label: Discover }, { label: Author }, { label: Validate }, { label: Ship }]
rows:
  - { label: Tool, cells: ["chiltepin init", "edit .md", "chiltepin check", "chiltepin pdf"] }
  - { label: Feeling, cells: [Curious, Focused, Tense, Proud] }
emotion: [0.6, 0.7, 0.4, 0.9]
```

## Explain in layers

Use `layers` when each tier answers one question — an L1/L2/L3 model.

```layers
title: A doc in three layers
items:
  - { kicker: L1, title: Prose, source: Markdown, question: "What's the story?", body: Plain paragraphs carry the narrative. }
  - { kicker: L2, title: Blocks, source: typed YAML, question: "What's the structure?", body: "Diagrams, tables, and stories." }
  - { kicker: L3, title: Refs, source: "doc#id", question: "How do they connect?", body: Stories point at the flows that satisfy them. }
```

## Weigh the trade-offs

`proscons` weighs two sides of one decision.

```proscons
prosLabel: HTML output
consLabel: PDF output
pros: [Interactive, Live theme switch, Tiny files]
cons: [Print-ready, Email-friendly, Needs Chromium once]
```

## Break it down (MECE)

`tree` with `variant: issue` decomposes one thing into exhaustive,
non-overlapping parts.

```tree
variant: issue
title: What goes in a doc?
nodes:
  - { id: root, label: A doc }
  - { id: prose, parent: root, label: Prose }
  - { id: struct, parent: root, label: Structure }
  - { id: diag, parent: struct, label: Diagrams }
  - { id: tab, parent: struct, label: Tables }
```

## An HTTP endpoint

`endpoint` is a Swagger-style card; `chiltepin sync openapi` can generate a whole set.

```endpoint
method: POST
path: /docs/{slug}/check
title: Validate a document
description: Run schema + reference checks on one doc.
params:
  - { name: slug, in: path, type: string, required: true, desc: Doc to validate }
responses:
  - { status: 200, desc: No diagnostics }
  - { status: 422, desc: Diagnostics found }
```

## What the user sees

Use `wireframe` when the reader asks what the user sees — low-fi screens, no
design tool.

```wireframe
title: The rendered page
screens:
  - device: browser
    title: Rendered doc
    url: localhost/out.html
    label: A Chiltepin page in the browser
    elements:
      - { type: header, label: The Chiltepin tutorial }
      - { type: text, rows: 2 }
      - { type: image, label: sequence diagram }
      - { type: button, label: Switch theme, tone: accent }
```

## Connect with `doc#id`

Give a block an `id:`, then reference it with `doc#id` (or bare `#id` in the same
file). A dangling ref fails `chiltepin check`. This story links to the flow above.

```userstory
id: US-tour
role: doc author
want: link a story to the flow that satisfies it
soThat: the document becomes a connected, checkable model
priority: Med
points: 3
criteria:
  - { given: a sequence has an id, when: I add a matching ref, then: chiltepin check resolves it }
links:
  - { ref: "#seq-tour", mode: sequence, label: The validate flow }
```

## Key terms

`glossary` is plain term → definition rows.

```glossary
terms:
  - { term: Block, def: A fenced section whose info-string is a typed block name. }
  - { term: "doc#id", def: "A cross-reference to a block id, checked by chiltepin check." }
  - { term: Skin, def: "The one editorial look every export uses, in light and dark." }
```

## One look, light and dark

```table
columns: [Mode, When]
rows:
  - [Light, "The default — warm paper, near-black ink, one rust accent"]
  - [Dark, "When your OS prefers dark; nothing to configure"]
note: Every export — HTML, slides, PDF — uses the same editorial skin.
```

## How slides work {top}

This whole file is a deck. The rules:

```callout
tone: note
title: Authoring for slides
body: "Each `#`/`##` heading starts a slide and is its title. Everything under it — prose and blocks — rides along, so a slide can stack several blocks. Alignment is automatic; force it with a heading marker: `{top}`, `{center}`, or `{bottom}`."
```

## Always validate {center}

```code
blocks:
  - title: The loop
    lang: bash
    code: |
      chiltepin check                 # validate everything
      chiltepin preview docs/x.md     # render + open
      chiltepin slides docs/x.md      # present it
      chiltepin block                 # every block, one line each
      chiltepin pdf docs/x.md           # one doc to PDF
```

## Recap

```table
columns: [If you want to show…, Reach for]
rows:
  - [Who uses the system, "c4 (context)"]
  - [Boxes and arrows / topology, "block (presets: infra · event · ddd · network)"]
  - [A call-and-response over time, sequence]
  - [Branches and decisions, "flow (variant: dag) · swimlane · dfd"]
  - ["Tables, keys, relationships", erd]
  - [Module internals, "felogic (variant: be) · frontend · uml"]
  - [Access rules, "composition · anatomy · matrix"]
  - [A weighed decision, "options · proscons · cvt"]
  - [A plan, "timeline · gantt · kanban · statustable"]
  - [A story or chart, "pyramid · quadrant · journey · stats · chart"]
note: The skill lives in skills/chiltepin/SKILL.md; chiltepin block <type> prints any block's fields.
```
