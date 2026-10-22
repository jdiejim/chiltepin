# Chiltepin blocks — Quality & audits

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Verdicts with evidence. What is wrong now (`audit`), what passes
and fails a standard (`checklist`), what is over budget (`perfbudget`), how
long the tail is (`percentiles`), and what an attacker can do (`threatmodel`).
**Answers**: What did the review find? Are we ready? Are we within budget?
How slow is the slow path? Where can this be attacked, and what stops it?
**Not this family**: what MIGHT go wrong → `risk` (planning.md); service
targets over time → `slo` (tables-data.md); measured results side by side →
`benchmark` (tables-data.md); where the time goes in one request → `spans`.

#### `audit` — findings register
Severity-ranked rows with evidence, fix, owner, status, and a count strip per
severity. Answers: what did the review find, and how bad is it? One finding
per row; `evidence` is what was observed (a path, a query, a log line), `fix`
the change. `audit`, not `risk`, for defects found; `risk` for possibilities.
`audit`, not `table`: the severity order and the counts are derived.
#### `checklist` — pass / fail with evidence
Items, or `groups` of items, each with a verdict and the evidence behind it;
the footer derives the pass rate. Terse: `"[pass] item — evidence"` (quote
it: the bracket is YAML flow syntax). Answers: are we ready, and what is
missing? `checklist` for a standard applied once; `statustable` for work in
flight; `list` with `check` markers when nothing is being verified.
#### `perfbudget` — budgets vs measured
One bar per metric against its budget mark; over / near / ok derived
(`lowerIsBetter: false` for scores and throughput). Answers: are we within
budget, and by how much? `perfbudget` for targets with a pass line;
`benchmark` for candidates against each other; `stats` for KPIs with trends.
#### `percentiles` — latency distribution per row
p50 · p90 · p95 · p99 · max per endpoint on one axis, the SLO as a rule;
`scale: log` for a long tail. Answers: how slow is the slow path? A p99 past
the SLO is marked. `percentiles` for the tail; `chart` line for latency over
time; `spans` for where the time goes inside one request.
#### `threatmodel` — STRIDE on a data flow
The dfd shapes inside dashed trust `boundaries`, `channel: plain` hops marked,
and a `threats` table keyed to nodes or edges with the STRIDE letter.
Answers: where can this be attacked, and what stops it? One trust boundary
per block; put the mitigations in the table, not in prose. `threatmodel`,
not `dfd`, when threats are the question; `audit` for what a review found.
