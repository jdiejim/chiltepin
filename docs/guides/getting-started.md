```meta
title: Getting started with Chiltepin
subtitle: The 80/20 tour — what Chiltepin is, how a doc is built, and the handful of commands you'll use every day.
tag: GUIDE · START HERE
```

## What is Chiltepin?

Chiltepin is **documentation-as-code**: a doc is plain Markdown with typed, fenced
YAML blocks, and the `.md` file on disk is the single source of truth. Prose stays
prose. Anything structured — a diagram, a table, a roadmap, a user story — goes in
a block that renders to clean HTML, slides, or PDF.

```callout
tone: tip
title: The one rule
body: "The .md file is the source of truth. Edit a block surgically — never regenerate a whole document — and run `chiltepin check` until it passes. A passing check is the definition of done."
```

## Anatomy of a block

Every block is a fenced code block whose **info-string is the block type** and
whose **body is YAML**. Give a block an `id:` when you want to reference it; set a
`title:` so the rendered section reads like a document.

```code
title: A sequence block
lang: markdown
code: |
  ```sequence
  id: seq-gs-checkout
  title: Place an order
  actors:
    - { id: Client, name: Client }
    - { id: API, name: Orders API }
  messages:
    - Client -> API: POST /orders
    - API --> Client: 201 Created
  ```
```

Messages use the terse arrow form — `->` is a call, `-->` a response,
`-x->` an error; the text after the colon is the label. (An item can also be a
full object when it needs more fields — `kind: async`, a `summary`, a `code`
snippet.)

That block renders as a real SVG sequence diagram — here it is live:

```sequence
id: seq-gs-checkout
title: Place an order
lede: The client gets 201 only after the order row is in Postgres.
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: DB, name: Postgres, sub: orders }
messages:
  - Client -> API: POST /orders
  - API -> DB: INSERT order
  - DB --> API: order_id
  - API --> Client: 201 Created
```

## The everyday workflow

Four steps, over and over: scaffold once, then edit → validate → render.

```flow
title: Author → validate → render
nodes:
  - { id: init, col: 1, row: 1, kind: start, label: chiltepin init }
  - { id: edit, col: 2, row: 1, kind: process, label: Edit the .md }
  - { id: check, col: 3, row: 1, kind: decision, label: chiltepin check passes? }
  - { id: render, col: 4, row: 1, kind: end, label: render / preview }
  - { id: fix, col: 3, row: 2, kind: process, label: Fix diagnostics }
edges:
  - init -> edit
  - edit -> check
  - check -> render: "yes"
  - check -x-> fix: "no"
  - fix -> edit
```

## The CLI you'll actually use

```table
columns: [Command, What it does]
rows:
  - ["chiltepin init", Scaffold docs/ and chiltepin.config.json]
  - ["chiltepin check [globs]", "Validate schemas, references, and duplicate ids — exits non-zero on errors"]
  - ["chiltepin <file.md>", Render to a temp HTML file and open it in your browser]
  - ["chiltepin html / slides / pdf <file>", Render one doc to a standalone HTML page, a slide deck, or a PDF]
  - ["chiltepin studio", "The local surface — Edit visually, browse the built Site live, Present slides"]
  - ["chiltepin build", "Build a static HTML site from all docs — index, sidebar nav, cross-doc links"]
  - ["chiltepin demo [-s]", Render the built-in showcase of every block (-s for slides)]
  - ["chiltepin block [type]", "Every block on one line — or one block's fields, terse forms, and example"]
  - ["chiltepin new <name>", Scaffold a whole doc (adr, runbook, …) or a single block]
  - ["npx skills add jdiejim/chiltepin -y", "Install the authoring skill into your AI agent — Claude Code, Cursor, Codex, and more"]
  - ["chiltepin sync openapi <spec>", Generate an API doc straight from an OpenAPI file]
```

## A few blocks to get the feel

You compose a doc from **2–5 blocks, each a different lens**. A KPI strip:

```stats
stats:
  - { value: "76", label: Block types, trend: flat }
  - { value: "12", label: Block families, trend: flat }
  - { value: "3", label: Export formats, trend: flat }
```

A roadmap as a timeline:

Timeline items take a terse one-liner — `[status] date · label · description`:

```timeline
items:
  - "[current] now · Write your first doc · Edit this file, run chiltepin check"
  - "[next] next · Wire it into review · Run chiltepin check in CI on every PR"
  - "[future] later · Present it · chiltepin slides turns headings into a deck"
```

## Connect blocks with `doc#id`

Give a block an `id:`, then point at it as `doc#id` (or bare `#id` in the same
file). The only reference-bearing field today is `userstory.links[].ref`, and a
dangling reference fails `chiltepin check` — so the model stays honest.

```userstory
id: US-1
role: new user
want: see how a cross-reference works
soThat: I can wire stories to the diagrams that satisfy them
priority: High
points: 2
criteria:
  - { given: I open this doc, when: I follow the link, then: I land on the request flow }
links:
  - { ref: "#seq-gs-checkout", mode: sequence, label: Request flow }
```

## Look & slides

- **Look.** One editorial skin for every export. Pages follow your OS
  light/dark setting. There is nothing to pick.
- **Slides.** Any doc is a deck: `chiltepin slides <file>`. Each `#`/`##` heading starts
  a new slide and is its title; everything under it rides along. See the advanced
  tutorial (`docs/tutorial.md`) for a deck-first walkthrough of the whole feature
  set.

```callout
tone: note
title: Next steps
body: "Edit this file and run `chiltepin check`. Then open `docs/tutorial.md` for the full feature tour, and run `chiltepin block <type>` for any block's fields."
```
