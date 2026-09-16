# Composition recipes

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up).
These are worked examples of composition, not forms to fill in. Two different
systems must not produce structurally identical docs.

Start from the reader
questions, not from a recipe. Keep a block only if your system raises its
question, and drop it if not. Add a block these stacks never mention when your
system needs it. Fields: `chiltepin block <type>`; discriminators: the family files.

Each recipe: the reader questions → the block stack in document order → the
alternatives rejected, and why. The stack notes what each block carries and
what the prose around it carries. Prose carries why, tradeoff, and consequence — never a
description of the block beside it.

## Backend architecture

Reader questions: What are the boundaries? · What calls what on the critical
path? · Who owns what?

1. `meta` — the system's name and its one-line job.
2. Prose — why the system exists; the one constraint that shaped the design.
3. `c4` — ours vs external, one level only. Prose after: what the boundary
   decision costs, not what the picture already shows.
4. `cluster` or `block` (`preset: infra`) — the deployment topology. Prose
   after: which parts fail independently.
5. `sequence` — the one request path that pays the bills, with its failure
   branch. Prose after: the consequence a client can rely on.
6. `table` — service × responsibility × owner.
7. `callout` — the invariant that must not break.

Rejected: `uml` (class detail is the code's job) · `graph` (no boundaries —
a backend doc is about what contains what).

## AI / agent architecture

Reader questions: What does the loop do? · What can it call? · What fills the
window? · What does a real run look like?

1. `meta` — the agent's name and the task it owns.
2. Prose — the task delegated to the agent; where a human stays in the loop.
3. `agentloop` — environment, tools, memory, stop condition.
4. `context` — the window budget. Prose after: what gets evicted first, and
   why that is safe.
5. `prompt` — the contract the model is held to.
6. `sequence` — one turn end-to-end, including a tool failure.
7. `trace` — one real transcript, evidence the loop behaves as drawn.
8. `callout` — the safety boundary the agent cannot cross.

Rejected: `flow` for the loop itself (the loop is the primitive, not a
branch chart) — but a multi-step AI *workflow* is the next recipe.

## AI workflow (RAG, routing, multi-agent, generate → check → repair)

Reader questions: What are the steps? · Which step is a model, a tool, a
person, or memory? · Where does it branch, retry, or stop?

1. `meta` — the workflow's name and the outcome it produces.
2. Prose — the trigger and the stop condition in two sentences.
3. `flow` — the workflow as the request describes it: `kind: llm` for model
   calls, `agent` for autonomous steps, `tool` for retrieval / APIs / code,
   `human` for review gates, `memory` for stores, `decision` for routers and
   checks, `-x->` for the repair path. Shape it from the ask; never reuse a
   generic loop.
4. `swimlane` — instead of `flow` when several agents or teams own steps.
5. `cycle` — the improve-and-re-evaluate loop, when there is one.
6. `context` or `envelope` — the budget: tokens per turn, or cost per run.
7. `callout` — what the workflow must never do on its own.

## Frontend architecture

Reader questions: What are the modules? · What states can the UI be in? ·
Where does data come from?

1. `meta` — the app and its rendering model in one line.
2. Prose — the rendering-model decision (SSR/SPA/islands) and its cost.
3. `frontend` or `felogic` — the module graph. Prose after: the dependency
   rule the graph must keep.
4. `wireframe` — the one screen that matters.
5. `state` — the UI states, error and empty included. Prose after: which
   state users actually sit in most.
6. `sequence` — the data-fetch path.
7. `table` — the routes.

Rejected: `c4` (usually one container — a boundary diagram with one box says
nothing).

## Data flow / pipeline

Reader questions: Where does data come from and go? · What shape is it at
rest? · How fresh is it?

1. `meta` — the pipeline and what depends on its output.
2. Prose — why batch or stream; the cost of staleness in user terms.
3. `dfd` (processes and stores) or `sankey` (when volumes are the story).
   Prose after: the stage that loses or transforms data.
4. `erd` — the shape at rest.
5. `steps` — the backfill / replay procedure an operator runs.
6. `slo` — the freshness targets the team commits to.

Rejected: `sequence` (a pipeline has no request/response pairing to draw).

Zone patterns compose — they are not block types. A medallion view
(bronze → silver → gold) is `block` with `layers`: one layer per zone, one
node per dataset with `tech` for format and retention, edges for the
promotions. A deployment topology is `block` with `preset: infra` and
`groups` for the account and network boundaries.

## State machine

Reader questions: What states exist? · What forces a transition? · What is
illegal?

1. `meta` — the object whose lifecycle this is.
2. Prose — why these states exist; the invariant the machine protects.
3. `state` — states and transitions.
4. `table` — transition × guard × side effect.
5. `sequence` — one path that exercises the risky transition. Prose after:
   what a caller observes while it runs.
6. `callout` — the illegal states, and why they must stay illegal.

Rejected: `flow` (flows end; lifecycles loop back).

## Incident writeup

Reader questions: What happened, when? · Why did it break? · What did it
cost? · What prevents recurrence?

1. `meta` — incident id, date, severity.
2. `timeline` — detection to resolution. Prose after: where the response was
   slow, and why.
3. `sequence` or `flow` — the failure mechanism, not the happy path.
4. `stats` — the impact in numbers.
5. `steps` — remediation, each step with an owner.
6. `takeaways` — what the organization keeps from the incident.

Rejected: `scqa` (a postmortem argues with evidence, not narrative).

## ADR

Reader questions: What forced a decision? · What were the options? · What did
we accept by choosing?

1. `meta` — the decision's id and title.
2. Prose (Context) — the forcing fact, with a number in it.
3. `options` — candidates against the criteria, verdict per card.
4. `callout` (title "Decision") — the decision in one sentence.
5. `proscons` — the consequences of the winner, both directions. Prose after:
   the tradeoff the team explicitly accepts.
6. `statustable` — the follow-up work the decision creates.

Rejected: `harvey` (only when criteria resist numbers) · `scorecard`
(weights imply a precision most ADRs do not have).

## API reference

Reader questions: What can I call? · What do errors look like? · How do calls
compose?

1. `meta` — the API and its version.
2. Prose — auth model, versioning, base URL: what endpoint cards cannot
   carry.
3. `endpoint` × N — one card per operation, examples included.
4. `sequence` — a multi-call workflow. Prose after: the ordering rule the
   workflow depends on.
5. `table` — the error codes and what the client should do about each.
6. `glossary` — the domain terms the paths use.

Rejected: `packet` (binary protocols only) · standalone `code` (snippets
live inside the endpoint cards).
