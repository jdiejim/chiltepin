# Chiltepin blocks — Flows, sequences & state

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Exchange — actors trading messages over time (`sequence`) and one
request's time split across services (`spans`); Flow — steps and branches
through a graph (`flow`, `dfd`, `swimlane`, `cycle`, `gitgraph`, `saga`);
Modes — one object, discrete states (`state`); plus one Structure block for
linear procedures (`steps`).
**Answers**: What calls what, in what order? What happens when this fails?
What states can it be in? What are the exact steps?
**Not this family**: topology at rest → `block` or `c4` (architecture.md);
how much moves → `sankey` (charts-overviews.md);
tasks with owner and status → `statustable` (planning.md).

#### `sequence` — interaction over time (rich SVG + step list + footer)
Lifelines, numbered arrows, frames, activation bars, a step list under the SVG.
Answers: who calls whom, in what order? `sequence`, not `flow`, when the question
is message order between actors. Short `label` on the arrow; detail in `summary`.
`kind: note` is a box, not a message. Close every frame with `end` (`W_SEQ_FRAME`).
Activation: `-> +B` opens a bar on B; `--> -A` closes the SENDER's bar. Only the
first `-` closes, so inside an `alt` put the sign on the LAST branch's reply.
#### `spans` — distributed-trace waterfall (where did the time go?)
One lane per service, one bar per span on a shared time axis, nested by `parent`;
the critical path takes the accent. Bars sit exactly where the span ran. Answers:
how long did each call take, and which one did the response wait on? One request
per block; the density check warns past 40 spans. `sequence` for order, not duration.
#### `state` — state machine (+ transition table)
States on a grid joined by event arrows, plus a transition table. Answers: what
states can it be in, and what moves it? Give it one `kind: start` state and mark
`terminal` states. `state`, not `flow`, for one object's discrete modes.
#### `flow` — flowchart with decisions, incl. AI systems
Start, process, decision, end, and the AI kit (`kind: agent / llm / tool /
memory / guard / eval / human`); `variant: dag` frames a pipeline. Answers:
what happens next, what if the check fails, which step is a model, a tool,
a check, or a person? Omit `col`/`row` and let auto-layout place the nodes;
`kit.md` has the node and edge vocabulary and the `agentloop` rule. `flow`,
not `sequence`, for branching. Split at a hand-off, never inside a loop.
#### `dfd` — data-flow diagram
External entities, numbered processes, and stores joined by labelled data
flows. Answers: where does the data come from, and where does it land?
`dfd`, not `flow`, when the arrows carry data rather than control.
#### `gitgraph` — the branching and release model
Commit dots on branch lanes, in the order the history happened. The first
commit on a branch opens its lane; `merge: <branch>` closes that branch into
the commit's branch; `tag` marks a release. Answers: how do branches fork,
merge, and ship? `gitgraph` for branches; `timeline` for phases.
#### `swimlane` — who does which step, in what order
One lane per owner; a step names its lane (`lane: Sales`); the links set its column.
`phases` bands the columns and `phase: <label>` keeps a step in its band; `accent: true`
marks the focal step. `flow` for one object's decisions; `sequence` for messages.
#### `saga` — a distributed transaction and what runs backwards
Forward steps left to right, the compensation under each, and the compensating
flow drawn back from the failing step. Answers: what happens when step 3 fails?
`failAt` derives every status (failed, compensated, skipped); set `status` only to
override. Without `failAt` it draws the happy path. Keep it to 12 steps.
`saga` for the transaction as a whole; `sequence` for the messages of one step.
#### `steps` — a numbered how-to / runbook stepper
A vertical stepper: title, body, an optional command on the dark surface, a note.
Answers: what are the exact steps, in order? `steps` for a linear procedure a person
runs; `flow` / `swimlane` when it branches; `statustable` when items carry status.
#### `cycle` — a closed loop of stages arranged in a circle
Stages clockwise from 12 o'clock, the last feeding the first; 2–8 stages. A
fixed frame: use it only when the request names a loop with no exit. Answers:
what repeats? `flow` when it branches, retries, or ends; `steps` for one pass.
#### `timing` — UML timing diagram
One lane per lifeline stepping through `states` over a shared time axis
(`from` … `to` in `unit`), `events` as instants, `constraints` as duration
brackets. Answers: what state is each part in at time t, and how long does
a phase last? `timing` when durations and overlaps are the point (a circuit
breaker, a lease, a handshake); `state` for the transitions without time;
`sequence` for message order; `spans` for measured traces.
