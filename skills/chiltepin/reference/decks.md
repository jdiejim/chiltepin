# Slide decks — `chiltepin slides`

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this for any slides or deck ask.

## Slide decks (`chiltepin slides`)

Any document renders as a deck with `chiltepin slides`. **Each top-level heading
(`#`/`##`) starts a new slide and is its title.** Everything until the next
heading — prose *and* every block — stays on that slide, so a slide can hold
several blocks. (`###`+ headings stay in the slide body; to keep things on the
same slide, just don't add a new `#`/`##`.)

````md
# Why now
A sentence of context, then any blocks under this heading.

```drivers
items:
  - { title: Slow checkout, body: "p95 over 7 d hit 2.4 s against an 800 ms target.", icon: clock }
```

# The fix
Next heading → next slide. This one stacks two blocks.

```stats
stats:
  - { value: "800ms", label: New p95 target, trend: flat }
```

```callout
tone: success
body: Both blocks land on "The fix" slide.
```
````

- This means a normal Chiltepin doc (sections under `##` headings) already
  presents cleanly — no special markup needed. To author *for* slides, write one
  `##` heading per slide and keep each to **one idea**. A heading plus one strong
  visual (a diagram, `drivers`, `stats`, `pyramid`, `quadrant`, `timeline`) reads
  better than dense prose.
- **Vertical alignment is automatic** — light slides (one block, little prose)
  center; heavier slides (stacked blocks or lots of prose) top-align. To force it,
  add a marker to the heading: `## Title {top}`, `## Title {center}`, or
  `## Title {bottom}` (the marker is stripped from the displayed title). A fourth
  marker, `## Title {split}`, switches the slide to the consulting layout —
  prose left, exhibit right (see *Consulting-style decks* below).
- **Builds are automatic.** A diagram with a natural order — `sequence`,
  `flow`, `state`, `saga`, `spans`, `steps`, `timeline` — reveals one item per
  → press before the deck moves on; earlier items stay, the newest takes the
  accent, and ← walks back. Add `## Title {nobuild}` to show that slide whole.
  The page and print always show everything.
- Every non-cover slide automatically gets a footer (deck title · page number).
- **`chiltepin build` — and the studio's Site link — emit both views of every
  doc**: the page plus a companion deck at `<slug>.slides.html`. A Doc | Slides
  toggle links the two on each page, so a doc is a deck with no extra command.
  Studio's Present mode shows the current doc's deck without even saving.
- **Long sections paginate automatically** — each slide has a content budget
  weighted by block item counts. A hero-scale block is one heavy enough to
  fill a slide on its own — a big diagram, a many-card grid. It splits onto
  its own slide with the same section title instead of sharing the stage with
  its section's prose.
- **Two-part slides auto-split.** Substantial prose plus a medium exhibit that
  would overflow stacked lays out side by side automatically. Prose becomes
  the left message column, the exhibit the right — the same layout `{split}`
  forces. Write the section naturally; the deck picks the layout.
- The `meta` block is the cover slide. A doc with **no headings at all** falls
  back to one slide per block (legacy behavior).

### Consulting-style decks

For an executive or consulting-grade deck, hold every slide to the formula
**assertion → exhibit → takeaway**:

- **Action titles.** Each `##` is a full-sentence assertion the slide proves
  ("Checkout latency costs us conversions"), never a topic label
  ("Latency"). Someone flipping through only the titles should get the whole
  argument.
- **`{split}` layout.** `## Title {split}` puts the slide's prose in a left
  *message* column and its blocks in a right *exhibit* column — the classic
  consulting slide. Write 1-3 short punchy paragraphs, then exactly one strong
  block.
- **One exhibit per slide.** A `chart`, `scorecard`, `heatmap`, or
  a diagram — the block *is the evidence* for the title's claim. Two exhibits
  means two slides.
- **Open each part with a `divider`.** A deck with 3+ parts gets an
  interstitial per part — a `divider` alone under its own `##` heading
  (`kicker: PART 2`, an assertion as the `title`). It renders as a clean
  full-band break slide.
- **The money slide is a `bignumber`.** When one metric carries the whole
  argument ("-75% checkout p95"), give it its own `{split}` slide: message
  left, the `bignumber` as the exhibit right. Do not use a one-item `stats` row.
- **Close on the ask.** `takeaways` holds the 2-4 things the room must
  remember; the last one is the ask: the owner, the date, the next step.
  Never close on caveats.
- **No thin slides.** A heading floating over one small block reads empty —
  merge it into a neighbour, or give it a message column with `{split}`.

A three-part skeleton using all three:

````md
## Part 1 — checkout is bleeding conversions

```divider
kicker: PART 1
title: Checkout is bleeding conversions
```

## One number tells the story {split}

The async capture change removed the 1.7s synchronous call from the
request path. Nothing else moved.

```bignumber
value: "-75%"
label: Checkout p95 after the change
trend: down
```

## What to remember

```takeaways
items:
  - text: The synchronous capture call was the bottleneck
  - text: Moving it to a queue cut p95 by 75%
  - text: Conversion recovered within two weeks
```
````

````md
## Checkout latency costs us conversions {split}

Every 100ms of checkout latency costs ~0.6% conversion. Our p95 has drifted
to 2.4s — the synchronous capture call is 71% of it.

```chart
kind: bar
title: Where the 2.4s goes
labels: [Gateway, Fraud, Capture, Persist, Render]
series:
  - { label: p95 ms, values: [120, 260, 1700, 180, 140] }
```
````


### The design-review arc — one worked shape

For a full design-review deck, this **arc** is one worked shape, not a form
to fill. Keep the principles below it. Take every slide, exhibit, and title
from the fact inventory, and drop a slide when no fact supports it.

| # | Slide (always an action title) | Layout | Exhibit |
|---|---|---|---|
| 1 | Cover | `meta` | — |
| 2 | PART 1 · the problem | `divider` | — |
| 3 | *The pain, stated as a claim* | `{split}` | `chart` — the evidence |
| 4 | *The scale is real* | — | `envelope` — the math that sets the target |
| 5 | PART 2 · the design | `divider` | — |
| 6 | *Who touches the system* | — | `c4` (context) |
| 7 | *The design, stated as a claim* | `{split}` | `block` — the shape |
| 8 | *The decision that mattered* | `{split}` | `options` — chosen vs rejected |
| 9 | *The budget holds* | — | a waterfall `chart` against the target |
| 10 | *One request, end to end* | — | `sequence` |
| 11 | *When X degrades, …* | — | `swimlane` — the ops story |
| 12 | PART 3 · the commitment | `divider` | — |
| 13 | *What we're measured on* | — | `slo` |
| 14 | *The number that matters* | — | `bignumber` |
| 15 | Takeaways | — | `takeaways` — the close |

What the arc encodes (keep these even when you reshape it):

- **Three parts, opened by dividers**: problem → design → commitment. The
  reader always knows where they are.
- **Evidence before design**: slides 3-4 earn the right to propose anything —
  a complaint chart, a metric, then the envelope math. That math turns pain
  into a numeric target the rest of the deck answers to.
- **One decision slide** (8): every real design had a fork; show the rejected
  option honestly or the deck reads as a sales pitch.
- **Slides 9-11 are chosen by YOUR bottleneck**, not by this table: a fan-out
  system shows `sequence` + `swimlane`; a storage system might show `erd` +
  `heatmap`; an AI system a `flow` built from the kit (`kit.md`) + measured
  eval results. Two or three deep dives, never a fixed list.
- **Close on the commitment**: the objectives the team states (`slo`) → the
  number that matters (`bignumber`, echoing slide 4's target) →
  `takeaways`. The last takeaway carries the ask (effort, flag, rollback).

## Provenance and position

`## Title {source: production traces, 14 Oct 2026}` puts a source line in the
slide footer, where every consulting exhibit carries one. It sits in the
footer rather than under the block on purpose. The fitter scales the exhibit,
and a source line that shrinks with it stops being readable.

A deck with two or more `divider` bands also grows a **tracker** in the slide
header — the parts of the deck with the current one lit. The room always
knows where it is. One divider draws nothing: a strip of one says nothing.
