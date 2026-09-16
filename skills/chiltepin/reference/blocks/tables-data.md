# Chiltepin blocks — Tables, metrics & code

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; block → family map:
`INDEX.md`. Schemas reject unknown fields.

**Shape**: Grid — two axes of exact values (`table`, `benchmark`) — plus
Structure & emphasis for headline numbers, targets, and code as evidence
(`stats`, `slo`, `code`).
**Answers**: What are the exact values? How big, fast, or reliable is it,
as measured?
**Not this family** — a table with a job has its own block:

- cells are permission levels → `matrix` (business.md)
- a value grid read by intensity → `heatmap` (charts-overviews.md)
- the numbers move over time → `chart` (charts-overviews.md)
- scores you invented rather than measured → `scorecard` or `harvey`
  (business.md)
- a status per row → `statustable` (planning.md); components with a
  maturity → `inventory` (design-system.md)
- term — definition → `glossary`; releases → `changelog`; findings with
  evidence → `audit`; a standard applied → `checklist` (quality.md)
- touchpoints per stage → `journey`; API params / responses → `endpoint`

### Tables & metrics

#### `table` — comparison table
Rows × columns of exact values; a cell can carry a tone and emphasis.
Answers: what are the exact values?
`table`, not `matrix`, when cells are data rather than permissions; not
`heatmap` when the reader needs the numbers rather than the pattern.

#### `stats` — KPI / metric cards
A row of cards: value, label, delta, and a trend arrow.
Answers: how big is it right now?
`stats` for a few KPIs with trends; `bignumber` for one hero number; `chart`
when the numbers move over time; `envelope` for an estimate.

#### `slo` — service-level objectives with error budgets
One row-card per objective: SLI, target, current, window, and a burn bar.
Answers: are we inside the error budget?
`budget` is the fraction consumed (0–1): the bar turns amber past 0.5, red
past 0.8, "exhausted" at 1. Omit it to skip the bar.
`slo` for reliability targets; `okr` for goals; `stats` for plain KPIs.

#### `benchmark` — measured results, side by side
Subject columns × metric rows; the best cell per row is derived from the
numbers and highlighted. Never bold a winner yourself. `better: low` flips a
row (latency, cost); `better: none` turns the highlight off; `best: true`
forces it for a tie. `variants` on a row stacks one value per condition and
compares each condition on its own line. Answers: what did we measure?
`benchmark` for measured numbers; `scorecard` or `harvey` for scores you gave.

#### `code` — code the reader will copy or diff
When the reader will copy or diff it, it is a `code` block, not prose or a
table; when the change is the point, `kind: compare` or `kind: diff`.
`highlight: "3-5, 8"` bands the lines that matter; `lines: true` numbers
them; `cols: 2` sets snippets side by side (request / response); `kind:
compare` is before / after under eyebrows; `kind: terminal` is a `session`.
`lang: text` for prompts and plain notes (no highlighting); `lang: markdown`
for Markdown source.
`steps` for a runbook with prose between commands; `gallery` for a card grid.
