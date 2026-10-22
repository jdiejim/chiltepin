# Chiltepin blocks — Business, decisions & access

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Grid — compare, score, locate (`matrix`, `scorecard`, `harvey`,
`swot`, `scenarios`); cards for decisions, strategy, and access (the rest).
**Answers**: How do the options compare, and which won? Who may do what?
What forces shaped this design? Do the numbers pencil out?
**Not this family**: measured numbers → `benchmark` (tables-data.md); one
option's tradeoffs → `proscons` (planning.md); the decision in one line →
`callout` (narrative.md); day-to-day task state → `statustable` (planning.md).

#### `matrix` — a role × resource capability grid
Rows are roles, columns resources, each cell a permission level tinted by meaning.
Answers: who may do what? `matrix`, not `table`, when every cell is a permission.
#### `anatomy` — the parts of a structured string (e.g. a permission)
The full string with each segment coloured, then one card per segment.
Answers: what does each part of this identifier mean? One string per block.
#### `composition` — effective access as intersected gates
Renders gate ∩ gate ∩ gate = result. Answers: which independent checks must
all pass? `composition`, not `flow`, when access is an AND of checks rather
than an ordered sequence.
#### `drivers` — the forces that shaped a design
A card grid, one card per driver with an icon and a tag; each is a real requirement
with its consequence. Answers: why is the design like this? `list` for plain points.
#### `team` — people cards (who owns what)
Compact cards: initials avatar, name, role, one-line focus; set `initials` for a group.
Answers: who owns what? `team` for real people; `persona` for user archetypes.
#### `options` — approaches explored, with a verdict
One card per option: how, pros, cons, verdict; `tone: chosen` marks the
winner. Answers: which approaches did we weigh, and which won?
`options`, not `proscons`, for several candidates; `proscons` weighs one.
#### `scorecard` — a weighted decision matrix
Criteria as rows, options as columns, a weighted TOTAL row; the winner is
derived. Answers: which option scores highest? `scorecard` when the decision
was scored; `options` for qualitative verdicts; `harvey` for judgements.
#### `spec` — a labelled spec sheet
A fact sheet for one subject; a row with `steps` draws a pill flow. Answers: what
must the reader enforce, or what are this one thing's facts? Not a default closer.
`spec`, not `table`, for one subject; prose when the request gives no such rules.
#### `envelope` — back-of-envelope capacity math
Givens, one derivation row per step, then a highlighted bottom line. Every
value is a string; write units and `≈` freely. Answers: do the numbers pencil
out? `envelope` for the estimate that justifies a design; `stats` for KPIs.
#### `swot` — strengths / weaknesses / opportunities / threats
The 2×2 draws itself from four string lists. A fixed frame: use it only when the
request gives all four sides. `swot` for a position; `quadrant` to plot items.
#### `okr` — objectives + key results
One card per objective, a progress bar per key result coloured by status.
Answers: how far are we on each goal? `slo` for reliability; `statustable` for tasks.
#### `persona` — user persona cards
Cards with an avatar, role, quote, goals, frustrations, and tool chips.
Answers: who do we build for? `persona` for archetypes; `team` for people.
#### `wardley` — value chain against evolution
Components plotted by user visibility (up) and evolution (right), both 0–1;
`movement` draws where one is heading. Answers: what do we build, and what
do we buy? A position on the map replaces an opinion.
#### `harvey` — the rated comparison
Options across, criteria down, a filled ball per judgement (0–4), a weighted
footer. A short `ratings` row means "not assessed", not zero. Answers: which
option fits best? `harvey` for judgements; `benchmark` for measured numbers.
#### `scqa` — the executive summary, in Minto order
Situation, complication, question as a ladder; the answer as the filled
card with its support. Answers: what is the recommendation, and why? A fixed
frame: use it only for an executive ask with a real complication.
#### `scenarios` — base, upside and downside
Cases as columns, drivers as rows, the outcome in its own row; the base case
is badged. A missing value renders `·`, not zero. Answers: how much of the
outcome hangs on each assumption?
