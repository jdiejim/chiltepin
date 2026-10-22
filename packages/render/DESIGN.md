# Render skin — the single source of truth for how blocks look

Every renderer draws from the tokens and roles in this file. No renderer
carries a hex value; a test enforces it. To change the look of Chiltepin,
change this file and `src/css.ts`, never a block.

The goal: **editorial, quiet, dense with content.** Meaning travels through
shape, stroke, dash, and small typographic chips. Color has two channels:
**hue** says what kind of thing a mark is, and **accent** marks the one
answer. Both come from the data; an author never paints a node.

## Tokens

Semantic roles. Renderers name the role (`var(--ink)`), never the value.

| Role | Purpose | Dark (the look) | Light |
|---|---|---|---|
| `paper` | page and default node fill | `#15171d` | `#f7f6f2` |
| `paper-2` | diagram frame, secondary fill, panels | `#1d2028` | `#efede8` |
| `stage` | the drawing well inside the frame, a step below `paper-2` | `#121419` | `#f3f1ec` |
| `stage-glow` | the faint lift at the centre of the well | `rgba(236,234,228,.05)` | `rgba(255,255,255,.6)` |
| `ink` | primary text, primary stroke | `#eceae4` | `#1f2430` |
| `muted` | secondary text, default arrow stroke, chips | `#b4bac6` | `#4f5868` |
| `soft` | sublabels, guards, legend text | `#9da5b3` | `#646d7b` (4.5:1 on paper-2 — the floor for small text) |
| `rule` | hairlines, the dot grid | `rgba(236,234,228,.13)` | `rgba(31,36,48,.14)` |
| `rule-solid` | frame borders, baselines, secondary node and chip outlines | `#7d8499` | `#807b70` (3.6:1 on paper-2 — the floor for a line that carries meaning) |
| `accent` | the one focal thing per diagram (see the rule below) | `#e4744c` | `#b04a25` (4.7:1 on paper-2, so it may carry small text) |
| `accent-tint` | fill behind an accent-stroked shape | `rgba(228,116,76,.14)` | `rgba(176,74,37,.09)` |
| `link` | HTTP calls, external arrows, links in prose | `#93b7e8` | `#2f5c8f` |
| `negative` | real errors only: a crimson (hue ≈ 345°), far from the orange accent | `#f58ca3` (7.8:1 on paper) | `#ad1f45` (5.9:1 on paper-2) |
| `negative-tint` | fill behind an error shape | `rgba(245,140,163,.14)` | `rgba(173,31,69,.08)` |
| `warn` · `warn-tint` | "near the limit", never an error: the amber hue and its tint | `var(--hue-amber)` · `var(--hue-amber-tint)` | same |
| `hue-blue` | compute family: chip, glyph, group tab | `#8fb0e2` (8.1:1 on paper) | `#30609a` (5.5:1 on paper-2) |
| `hue-green` | network, edge and security family | `#93c29c` (8.9:1) | `#3a6c45` (5.3:1) |
| `hue-amber` | state family (stores, caches, config) | `#d6b06a` (8.8:1) | `#7f5e1a` (5.1:1) |
| `hue-violet` | AI family (agent, model, eval, prompt) | `#b7a2e6` (8.0:1) | `#664ea0` (5.7:1) |
| `hue-teal` | messaging family (queue, topic, stream) | `#76bfba` (8.5:1) | `#296966` (5.4:1) |
| `hue-rose` | people family (client, user, human) | `#e39cc6` (8.4:1) | `#9e3f74` (5.2:1) |
| `hue-<name>-tint` | the family's node fill and group panel; opaque (hue over paper), so a node still hides the lines beneath it | `#242935` · `#242c2c` · `#2c2926` · `#282835` · `#212b30` · `#2e2731` | `#e5e9ea` · `#e6eae2` · `#ece8df` · `#eae7eb` · `#e4e9e5` · `#efe6e7` |

Each hue clears 4.5:1 as small text on `paper`, `paper-2`, and its own tint,
in both sets; `ink` and `muted` clear 4.5:1 on every tint.
`src/__tests__/hues.test.ts` computes these ratios from the token blocks.

Legacy names (`--navy`, `--charcoal`, `--gray`, `--light-gray`, `--blue`,
`--highlight`, `--positive`, `--purple`, `--teal`, and their `-soft` tints)
stay defined as aliases of the roles above so untouched renderers keep
working while they migrate. New code never uses a legacy name. The legacy
`--blue`, `--teal` and `--purple` are not the category hues: a family colour
is always `--hue-<name>`.

**Dark is the look.** The bare `:root` in `css.ts` carries the dark set, so
every page, deck, site page, and the Studio canvas is dark unless told
otherwise. Light is the explicit choice — `data-theme="light"` on the root
(the config's `colorScheme: light` stamps it) — and the print look, always,
so a PDF never spends ink on a black page. `colorScheme: system` adds the
one media rule that lets the reader's OS choose. Both sets live in two
constants (`LIGHT_SET`, `DARK_SET`); nothing else in the stylesheet carries
a colour value.

The drawing sits in a **well**: the stage paints `stage` a step below the
frame's `paper-2`, with the dot grid in `rule` and a faint `stage-glow` at
the centre, inside a hairline inset. Node fills are `paper`, one step below
`paper-2` in dark and one step above in light, so nodes read as objects on
the well in both.

## Colour roles

Every colour on a page answers one question. Pick the role by what the mark
means, never by what looks good next to it.

| Role | Means | Where it shows |
|---|---|---|
| `ink` · `muted` · `soft` | the content, then its secondary text, then its labels | all text, default strokes and chips |
| `accent` | the one answer per figure (the rule below) | the focal node or path, the chosen option, the current stage, the tip callout |
| `negative` | an error or a hard failure | error edges (with the cross head), `danger` callouts, a spent error budget, blocked or critical chips, cons |
| `warn` | close to a limit, but not failed | `warn` callouts, an option with `tone: warn`, a `warn` table cell, an error budget close to spent, an in-progress or amber status chip, the `proposal` cover status |
| `hue-<name>` | the category of a thing | node families, groups, status chips named by colour (`green` done, `blue` in review, `teal`, `purple`), a `success` callout (green) |
| `link` | a link or an external call | prose links, HTTP arrows, `info` callouts |

Three pairs must never be confused: `accent` and `negative` (orange and
crimson, about 30° apart in hue and different in saturation), `negative` and
`warn` (crimson and amber), and `warn` and `accent` (amber and orange — warn
always rides in a chip or a rule with its word, accent marks the one answer).
A colour never carries a meaning alone: an error edge also draws a cross
before its head, a status chip also says its word, a warn callout also has its
title. A muted chip (`rule-solid` outline, `muted` text) is for metadata that
is not a state: an agenda owner, a risk that is being mitigated.

## Headings and figures

The page has one heading system: the author's Markdown. The renderer never
promotes a block field to a heading.

- `##` and `###` are the document's headings (h2 30px, h3 19px). Each gets a
  deterministic id from `headingIds` in `chiltepin-core` (block ids reserved),
  and a `#` link that shows on hover.
- A block's `title` is its **figure caption**: "Fig. N · title", 15px, in the
  frame's head row (or on a caption line above a block with no frame). Only a
  titled figure takes a number, in document order, so the caption, the
  contents and `chiltepin shots` print the same N. When the heading right
  above already says the title, the caption keeps the number only.
- Narrative blocks (callout, list, steps, faq, glossary, scqa, prose,
  pullquote, bignumber, divider, takeaways) are not figures: a title there is
  a plain label, or the block draws it itself.
- `lede` is a one-line takeaway above the figure, in the body's voice.
  `description` is small muted text under the caption.
- Decks keep their own section head; the slide header replaces it.

**Rhythm.** A block sits 24px under the text or heading above it and 40px
over what follows, whatever its own margins say. A `##` after a block gets
56px. The cover sits 56px below the top of the page.

**Contents.** A doc with 4+ headings, or about 3+ screens long, gets a table
of contents from its headings plus a figure list: a sticky rail at 1200px and
wider, a collapsed list above the first section below that, and a "Back to
top" link. No script: the page stays static.

**Cover.** A meta row (status chip, tag, "N min read · N figures"), the title,
the subtitle, then a facts strip (owners, reviewers, updated, version) when
the `meta` block names them. The status chip is the only colour on the cover:
`draft` dashed, `proposal` warn, `review` blue, `accepted` green,
`superseded` muted, `deprecated` negative, `example` violet.

**Phones (≤ 640px).** 16px gutters. A drawing never shrinks below 0.62 of its
size (a 13px name stays at 8px); past that its stage scrolls sideways and
fades at the hidden edge. Tables, the status table and the journey scroll in
their own box; the page never scrolls sideways. Label-and-value rows (layers,
risk, stories, pattern, typescale) stack.

**Print and PDF.** A4 with 16 / 14 / 18 mm margins, a running header (the doc
title) and footer ("page X / Y"). Nothing clips: scroll boxes print in full
and wrap, code wraps. Figures, callouts, code and tables keep together; a
heading stays with what follows. The SVG text halo is off on paper, because
it doubles every label in the PDF text layer; edge labels keep their paper
mask.

## The one-accent rule

A diagram spends `accent` on **one focal thing**, and the renderer decides
which from the data, deterministically. One thing: a renderer never accents
two unrelated things in the same diagram.

One thing is not always one mark. It is one answer to one question, and the
answer is drawn at whatever size it is:

- **a path** is a chain of marks. `spans` accents the critical path, so a
  trace whose critical path runs through eight spans carries eight accented
  bars. Capping it at two would cut the chain and misstate the trace.
- **an arrival** is a node plus the edge into it. `flow` accents each `end`
  node that is not an error exit, and the edge that reaches it. Two success
  exits are two arrivals of the same one answer — "where does this end well?"
  — and accenting one of two equal exits would claim a difference the data
  does not carry.
- **a per-item state the author wrote** is the author's count, not the
  renderer's: `tone: active` / `tone: target` (`array`, `linkedlist`,
  `bintree`) and `status: current` (`timeline`, `rollout`). The renderer
  paints exactly what the data says and adds nothing of its own — strip the
  marks and the accent goes to zero. Twelve stages marked `current` is an
  authoring mistake; the skin renders it rather than hiding it.

Everywhere else, the accent holds at one or two marks whatever the data size.
A mark inside an accented shape — its label, its chip — is part of that mark,
not a second one.

| Block | What gets the accent |
|---|---|
| `sequence` | the last `response` message that reaches the first actor (the answer the caller gets); the `endpoint` tag |
| `flow` | the `end` node(s) that are not error exits, and the edge into them |
| `spans` | the critical path: from the root, the longest child at each step |
| `block` | a node whose `kind` is `gateway` or whose `preset` names it the entry; otherwise none |
| `c4` | the one system in scope of a context diagram; otherwise none |
| `usecase` | the case named by `focus`; otherwise none |
| `erd` | the entity on the "one" side of the most relations (the aggregate root); its eyebrow reads `AGGREGATE ROOT` |
| author-marked | the items the author toned `active` / `target`, or gave `status: current` |

Zero accent is a valid outcome. Errors use `negative`, never `accent`.

`src/__tests__/accent.test.ts` enforces this rule. It carries one declared row
per block type — where the accent comes from, how many marks the catalog
example may spend, and which one thing they compose — checks every catalog
example against its row, checks that a renderer-chosen accent does not grow
when the data grows to twelve items, checks that an author-marked accent is
zero when the marks are absent, and checks structurally that the marks of a
path or an arrival all belong to the same thing.

## Two channels: hue is category, accent is focus

Color has two jobs, and they never mix.

- **Hue = category.** A hue says what kind of thing a mark is. The renderer
  takes it from the node `kind` (its family) or from the group. An author
  never picks a hue for one node. An author may name a hue for a group or a
  layer (`color: teal`), because a group is a category.
- **Accent = focus.** The accent marks the one answer (the rule above). The
  focal node drops its family hue and takes the accent outline, the accent
  tint, and an accent chip, so it stays the strongest mark.

Errors stay `negative`. Edges stay `muted`: an edge never takes a hue.

**Node families.** One hue per family, from `svg/blockStyle.ts`:

| Family | Hue | Kinds |
|---|---|---|
| compute | blue | service, worker, function, host, pod, deployment, cron, ci, tool |
| network, edge and security | green | gateway, lb, proxy, cdn, dns, waf, auth, ingress, region, guard |
| state | amber | db, store, cache, bucket, warehouse, search, registry, secrets, config, memory, vector |
| messaging | teal | queue, topic, stream, producer, consumer, webhook, email |
| AI | violet | agent, llm, model, eval, prompt, ml, ai |
| people | rose | client, user, browser, mobile, device, human |
| external and unknown | none | external, namespace, any word the table does not know |

A family hue reaches three places on a node, and no more: the eyebrow chip
(text in the hue), the glyph or silhouette (drawn in the hue), and the fill
(the hue's tint). The outline stays `ink` (primary) or `rule-solid`
(secondary), so the drawing stays calm.

**The AI kit.** `block` (every preset) and `flow` draw an AI system from its
parts, not from the fixed `agentloop` frame. Each part has its own chip,
glyph, and family hue:

| Kind (aliases) | Chip | Glyph | Hue | Notes |
|---|---|---|---|---|
| `agent` | `AGENT` | sparkle | violet | the agent card: `tech` (block) or the second label line (flow) is the mono model chip |
| `llm` (`model`) | `LLM` | sparkle | violet | the agent card |
| `tool` | `TOOL` | wrench | blue | |
| `memory` | `MEMORY` | clock with a back arrow | amber | store outline |
| `vector` (`embeddings`) | `VECTOR` | points on two axes | amber | a cylinder in `block` |
| `human` (`reviewer`) | `HUMAN` | person | rose | dashed outline: a gate outside the automation |
| `guard` (`guardrail`, `policy`) | `GUARD` | shield with a check | green | the agent card in `flow` |
| `eval` (`judge`, `grader`) | `EVAL` | gauge | violet | the agent card in `flow` |
| `prompt` | `PROMPT` | prompt window | violet | `block` only |

**Groups and layers.** A group panel is the hue's tint (a thinner tint when
it is nested), a `rule-solid` hairline, and the tab in the hue. A group or a
layer gets its hue in this order:

1. the hue it names (`color: blue|green|amber|violet|teal|rose`);
2. else the family hue that most of its nodes share;
3. else the next free hue in the rotation blue · amber · violet · teal ·
   green · rose, so neighbours differ.

A nested group (subnet in a zone in a region) repeats its outermost group's
hue unless it names its own: one zone, one hue, at every depth. A hex
`color` keeps the older tint path. Threat-model trust boundaries never take
a hue: they always draw in `negative`.

Hue never carries a meaning alone. Shape, stroke and dash still tell kinds
apart:

- **stroke weight**: 1.5px `ink` for primary nodes, 1px `rule-solid` for secondary;
- **dash**: `4 3` for external / boundary / async, and for the human gate;
- **fill**: the family tint · `paper` (neutral) · `paper-2` (neutral store, inactive) · `accent-tint` / `negative-tint`;
- **an eyebrow chip** inside the node: `SVC`, `DB`, `CACHE`, `QUEUE`, `CLIENT`, `AGENT`, `TOOL`, `EXT`, …

## Type roles

Five roles, fixed sizes at figure density. Renderers use the class, not a
`font-size`.

| Class | Face | Size | Weight | Use |
|---|---|---|---|---|
| `.t-name` | Inter | 13px | 600 | node and entity names, actor names |
| `.t-sub` | mono | 10px | 400 | sublabels: tech, port, path, column type |
| `.t-eyebrow` | mono | 8.5px | 500, `letter-spacing:.14em`, uppercase | kind chips, frame tabs, legend title |
| `.t-arrow` | mono | 9.5px | 400, `letter-spacing:.04em` | arrow and relation labels, guards |
| `.t-badge` | mono | 9px | 600 | step numbers |

Every SVG text gets the paper halo (`paint-order:stroke; stroke:var(--paper)`)
so it survives crossing a line on screen. Print turns the halo off: it
doubles the text in a PDF.

Figures never upscale. An SVG renders at `min(100%, viewBox width)` so a
120-node diagram fills the column and a 4-node diagram stays small, and never
below 0.62 of its width on a screen (the stage scrolls instead). Decks set
`--scale` on the slide root to enlarge.

## Strokes and arrows

- Default edge: 1.5px `muted`, small filled arrowhead (6px).
- Return / response: 1.5px `muted`, dashed `5 4`, open arrowhead.
- Async: 1.25px `muted`, dashed `2 3`, open arrowhead.
- Error: 1.5px `negative`, filled head with a cross on the line just behind
  it (`skErr`), so the edge reads as an error in greyscale and on paper.
- Accent edge: 1.75px `accent`, filled head.
- Relation lines (erd): 1.25px `muted`, cardinality as `1` / `N` letters in
  `.t-arrow` at each end; no crow's-foot glyphs.
- Edge labels: `.t-arrow` on a `paper` mask, never a pill outline, on the
  edge they belong to (two lines at most). A circled numeral with a legend
  entry is only the last resort for a label with no clear place.
- Routes (grid diagrams, `svg/router.ts`): orthogonal, around every node,
  never through one; edges that share a side spread their ports; parallel
  runs keep 8px apart; a back edge loops around its row.

## Chrome around a figure

- No card shadow. The figure sits on `paper-2` with a `rule-solid` hairline
  and a 6px radius, on a dot grid (`radial-gradient` 1px `rule` dots on a 24px
  step).
- Head row: the figure caption ("Fig. N · title") on the left, the type
  eyebrow at the right — plain `.t-eyebrow` in `soft` (`SEQUENCE · GET
  /orders`), never a filled family-colored pill. The endpoint method may take
  the accent.
- The description sits under the head row in small muted text.
- **Legend strip**: a hairline row under the drawing, `.t-eyebrow` "LEGEND"
  then one item per encoding the diagram actually used (node kinds present,
  arrow styles present, the accent's meaning). Generated by the renderer from
  the data; omitted when only one encoding is in play. A kind's chip shows in
  its family hue (text, outline and tint), and dashed for a dashed kind, so
  the legend chip is a small copy of the node chip.
- The step list (sequence) and footer pills stay; badges become hollow
  circles, `muted` stroke, `.t-badge` number; error badges use `negative`.

## Accessibility floor

Every text element passes WCAG AA against what is painted behind it: 4.5:1,
or 3:1 for text at 24px or 18.66px bold. `soft` is the lightest color that
may carry text on `paper-2`; on a dark fill, text is `paper`. On a family
tint, sublines step up from `soft` to `muted`. Never encode a meaning in
color alone: pair it with a chip, a dash, or a glyph. Run the audit on any
page:

```
node packages/render/scripts/contrast-audit.mjs dist/reference/showcase.html
```

It exits non-zero on the first failure and names the section, element, and
ratio. The showcase page must pass before a renderer change ships.

**Non-text (WCAG 1.4.11).** A stroked shape that carries meaning — a node
outline, a chip outline, an arrow, a border that encodes state — needs 3:1
against the surface behind it. `--rule-solid` is the lightest line that may
carry meaning; `--rule` is the decorative hairline and never does.

```
node packages/render/scripts/contrast-audit.mjs dist/reference/showcase.html --nontext
```

Decoration is out of scope, and a renderer says so with `data-decorative` on
the shape (or on the layer that holds it): tick gridlines, row separators
inside a card, the silhouette detail inside a node glyph, and knockout strokes
that only cut a gap between two adjacent marks. The audit also skips a stroke
that paints exactly what is already behind it or its own fill — no line is
drawn there at all.

## What never changes

Labels, messages, fields, node names, counts, order. The skin is a lens on
the data; the data is complete.
