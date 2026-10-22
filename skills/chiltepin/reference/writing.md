# Writing a doc — the opening, the headings, the page, the YAML

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this in steps 2–4 of the loop. The field contract, the terse forms, and an
example for every block come from `chiltepin block <type>`. Every sample
here and in the CLI shows grammar only. Take the nouns, the node count, and
the shape from the fact inventory, never from a sample.

## The opening

Before the first block, write two sentences the reader could forward:

1. The answer, in the reader's terms.
2. The number or limit that forces it.

If the answer is a proposal, the first sentence says so, and `meta.status`
is `proposal`. Context and background come after the answer, in a clause or
a later section — never as the opening paragraph. The `meta` subtitle is
the answer in one line, never the question.

Before — the subtitle asks, the heading names a topic, the opening explains
the mechanism before the reader knows the result:

```
subtitle: How a card payment gets approve, review, or decline in under 80 ms

## The 80 ms path from the payment gateway to a decision

The rules engine and the XGBoost model start together when the features
arrive, so the slower of the two sets the path, not their sum.
```

After — the answer, then the number; the heading is the claim:

```
subtitle: Rules and the model score each payment in parallel; a late score falls back to rules.

We propose that the scoring service returns approve, review, or decline
within the payment gateway's 80 ms p99 budget. The proposed hop budgets add
up to 65 ms, and the model's 40 ms deadline sets the critical path.

## The model's 40 ms deadline sets the critical path
```

## Headings

- **Explanation and decision docs use claim headings**: a sentence that the
  section proves ("The 201 returns before any subscriber acts").
- **How-to and reference docs use task labels** ("Replay a gap", "Errors").
- At most half the headings are questions. A question heading must be one
  the reader asks, and the section must answer it in its first sentence.
- Read only the headings in order. They must make the argument without the
  body. If they could sit on another doc, they are a template.
- A heading never names the block type ("Sequence", "Flow").
- Open each section with a sentence that links it to the previous one.

## The page contract

| Element | Renders as | Write |
|---|---|---|
| `##` heading | the only document heading | the claim the section proves |
| block `title` | the figure caption, "Fig. N · title" | what the figure shows ("Decision policy in the scoring service") |
| block `lede` | one line above the figure | the takeaway, when the heading does not already say it |
| block `description` | small text under the caption | scope, source, or how to read an unusual encoding; 2 sentences at most |
| prose between blocks | body text | why, the tradeoff, and the consequence — never a restated figure |

Give every diagram a `title`. Do not repeat the heading in the `title` or
the `lede`. Do not add a `prose` block and raw `##` headings for the same idea.

## `meta` — the cover

| Field | Write |
|---|---|
| `title` | what the doc is, in the user's domain language; the user's name for it when given |
| `subtitle` | the answer in one line |
| `tag` | the kind of doc, from one list: `Explanation`, `How-to`, `Reference`, `Tutorial`, `Design doc`, `ADR`, `Runbook`, `Postmortem`, `Spec` |
| `status` | `draft`, `proposal`, `review`, `accepted`, `superseded`, `deprecated`, or `example` |
| `owners` · `reviewers` | the people or teams the request names; never invented names |
| `updated` · `version` | the date of the last real change; the version the doc describes |

An ADR keeps its status in `status` and its decision date in `updated`. A
superseding ADR links the old one in its first sentence; the old one gets
`status: superseded`. Match the user's register: "quick notes on auth" is
not an "Authn & Authz Architecture Specification".

## Links and references

- `[text](#id)` links back to an earlier block (its `id:`) or heading in
  the same doc. Use it when a later section relies on an earlier figure:
  "the retry cap in [the repair loop](#repair-loop)".
- `[text](doc#id)` links into another doc; `doc` is the path under the docs
  root without `.md` (`payments/api#seq-charge`). `[text](./other.md)` also works.
- A heading's id is its slug: "Replay a gap" → `#replay-a-gap`.
- `ref` fields (`userstory.links[]`, `stories.items[].links[]`) take `doc#id`
  or `#id`. Ids are unique across the whole repo.
- A missing target fails the check: `E_DANGLING_LINK` for a prose link,
  `E_DANGLING_REF` for a `ref`.

## Numbers

Give each number a unit, a window or percentile, and a baseline or target:
"p95 over 7 d: 2.4 s → 600 ms", not "fast" or "2.4 s". Set the block's
`unit` field when it has one (`chart`, `heatmap`, `sankey`, `treemap`,
`slopegraph`, `spans`, `percentiles`, `timing`, `context`, `tree`, and each
`perfbudget` metric). Cite the source in the block's `note` or the sentence:
"(Datadog, 14–21 Oct)". A `stats` item sets `better: up` or `better: down`
when a fall is good news. If the headline is one number, lead with
`bignumber`.

## Inline styling — rare by design

Prose, table cells, and callout bodies take four small forms. Most
paragraphs need none of them. A page with ten colours reads worse than a
plain page.

| Write | Renders as | Use it for |
|---|---|---|
| `==text==` | a highlight | the one fact a skimming reader must not miss |
| `[text]{.teal}` | text in a category hue | a category the reader can name |
| `[Beta]{.pill}` · `{.pill .todo}` · `.done` · `.current` · `.blocked` | a status chip | a status word |
| `[Ctrl]{.kbd}` | a key cap | a key the reader presses |
| `:check:` | a line icon | a mark in a list, a table cell, or a status line |

- Highlight one fact per section, at most. `check` warns at three
  (`W_HIGHLIGHT_OVERUSE`). Use **bold** for a key term.
- Use a hue (`.blue` `.green` `.amber` `.violet` `.teal` `.rose`) only
  when it encodes a category the reader can name, and give it the colour
  the diagrams give that family: "[stores]{.amber} are amber". Never colour
  a word for emphasis.
- Put a status word in a chip. The status picks the outline; a chip never
  takes a hue.
- Put icons in lists, tables, and status lines: `:check: Passed`,
  `:x: Failed`, `:warn: Near the limit`. Never decorate a heading. The
  names are the `icon` list that `chiltepin block list` prints; an unknown
  name or class warns (`W_INLINE_UNKNOWN`).
- In YAML, quote a string that holds a span or an icon:
  `body: ":check: [Beta]{.pill} is live"`. Unquoted, `[` starts a list and
  `: ` splits a key.

## How a block looks

````
```sequence
id: seq-place-order
title: Placing an order with payment capture
actors:
  - { id: web, name: checkout-web }
  - { id: api, name: orders-api }
messages:
  - web -> api: POST /orders
  - api --> web: 201 Created
```
````

- The info-string is exactly one block type from `chiltepin block`. Never
  invent a type.
- The body is **YAML**. JSON is valid YAML and also parses — write JSON when a
  value is full of commas or colons. A `mermaid` fence is also accepted for
  five diagram grammars, with fewer fields (`mermaid.md`).
- Use only the fields the contract prints. The schemas are strict: an
  unknown field is an error.
- Write the terse one-line form the contract prints by default
  (`a -> b: label`, `Term — definition`, `label · value · delta`). It
  expands to the object form at parse time. Switch to the object form only
  for a field the grammar cannot say.
- Never paste raw HTML, `<svg>`, or `<style>` into a doc.

## YAML pitfalls — quote when in doubt

Most "schema errors" are YAML mis-parses. **Quote the value** whenever it
contains:

| Character | What goes wrong unquoted | Fix |
|---|---|---|
| `,` (comma) | Inside `{ a, b }` flow style it is a separator; a sentence becomes 3 keys. | `desc: "40 blocks, themes, agent skill"` |
| `:` (colon) | Read as `key: value`; `1:N` becomes a number sequence. | `card: "1:N"` |
| `#` (hash) | Starts a comment. | `label: "POST /orders #idempotent"` |
| Leading `*` `&` `!` `\|` `>` `%` `@` `` ` `` | YAML anchor / tag / fold characters. | Quote the whole value. |
| Leading `-` + space | Looks like a list item. | Quote. |
| Numeric-looking (`0`, `02`, `1e3`) | Parsed as a number; fails `string` schemas. | `delta: "0"`, `version: "1.0"` |
| `yes` / `no` / `true` / `false` / `null` | YAML 1.1 booleans. | Quote. |
| Empty | Parsed as null. | `name: ""` |

Inline `{ k: v }` maps are fine for short records (under ~5 fields). For
anything longer, use block style — easier diffs, fewer comma traps. When a
`desc` / `note` / `summary` / `description` contains prose, **always quote
it** — those fields are the top source of validation errors.

## Names

- **Use the user's nouns, verbatim.** They say "tenants" — do not write
  "customers". Carry their exact terms into labels, headings, node names.
- **One consistent world.** The service named `orders-api` in the `c4` keeps
  that exact name in the `sequence`, the `erd`, and the prose.
- **Never invent a company or product name.** Write "our platform" or the
  team's own noun. Never write "the request": the reader never saw it.
- `frontend` is a top-down tree; `felogic` (or `variant: be`) is a module
  graph with edges. Do not swap them.
