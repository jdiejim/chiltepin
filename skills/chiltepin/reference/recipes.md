# Composition recipes — from facts to an outline

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Use
this in step 2 (PLAN) of the loop. A recipe is not a stack to fill. It lists
the questions a kind of document usually raises, and the fact in the
inventory that makes each block worth its place. Fields:
`chiltepin block <type>`; discriminators: the family files; worked examples
of the reasoning: `derivations/`.

Rules that hold for every recipe:

- Keep a block only when the inventory holds the fact that picks it. No
  fact, no block — and no invented content to fill one.
- Open with two sentences: the answer, then the number or limit that forces
  it. The first block after them shows the whole mechanism, loops intact.
- The order follows the reader's questions. Each recipe names how it ends:
  the open decision and its owner, open questions with who answers each
  (`faq`), follow-up work with owners (`statustable`), or the escalation.
  Never end on caveats. A doc that asks for action ends with the ask: the
  owner, the date, the next step.
- Two docs on different systems do not share a block sequence. If yours
  matches a recipe line by line, check that every block traces to a fact.
- Prose carries why, tradeoff, and consequence — never a description of
  the block beside it.

Page rhythm:

- No block repeats a fact that another block draws. A `spec` holds only
  what no diagram shows.
- Past four blocks, put a light element (a short prose turn, a `callout`,
  `stats`) between two dense diagrams.
- When the headline is one number, lead with `bignumber`.
- A schema longer than 25 lines goes in a field `table` or an
  `eventcontract`, never a code wall.

## Design doc or agreed fix

Questions: What is broken, by how much? · What do we change? · What did we
reject, and why? · What does it cost? · What is still open?

- The problem with a number → the opening, then `stats`, `chart`, or
  `spans` when the measurement is the evidence.
- The change → the diagram of the mechanism after the fix (`flow`,
  `sequence`, `block`), from the kit.
- The choice → `options` with `tone: chosen`, or one sentence: "We rejected
  X because Y."
- The cost → `envelope`, `perfbudget`, or one sentence with the number.
- Ends on: the open decisions with owners (`faq`) and the follow-up work
  (`statustable`). Set `meta.status: proposal` until it is agreed.

Trap: a design doc with no rejected option was not a decision.

## Backend architecture

Questions: What are the boundaries? · What calls what on the critical path?
· What fails independently? · Who owns what?

- Ours vs external, one level → `c4`. The prose after it gives what the
  boundary costs.
- Where it runs (accounts, clusters, regions) → `block` (`preset: infra`)
  or `cluster`, from the kit (`kit.md`).
- The one request path that pays the bills, with its failure branch →
  `sequence`.
- Data that a regulator or a migration cares about → `erd`.
- Named owners per service → `table` or `team`.
- A rule that code must never break → `spec` (several) or `callout` (one).
- Ends on: the open design questions, or the next change, with owners.

Traps: `uml` (class detail is the code's job); `graph` (no boundaries).

## AI system — agents, models, tools, guards, people

Questions: What runs, in what order? · Which step is a model, a tool, a
check, or a person? · Where does it branch, retry, or stop? · What can it
never do on its own?

- The workflow itself → `flow` built from the AI kit in `kit.md`. Draw one
  node per agent role, model call, tool, store, guard, eval, and human gate
  that the request names. This is the default for RAG, routers, multi-agent
  hand-offs, planner–workers–reviewer, and generate–check–repair.
- Several owners (agents or teams) per step → `swimlane`.
- Where each piece runs and what it reads → `block` with AI kinds.
- One turn's timing across services → `sequence`.
- One agent's loop → `agentloop`, only on the terms in `kit.md`.
- A real transcript exists → `trace`. A real prompt exists → `prompt`.
  Measured token budgets exist → `context`. Cost per run → `envelope`.
- Measured quality → `benchmark` or `stats`; the eval set → `table`.
- A hard boundary, enforced outside the prompt → one `callout`.
- Ends on: what the team decides before the next rollout stage — the
  eval bar, the cap, the human gate — with owners.

Traps: a `cycle` with generic stages; a `prompt` or a `trace` with invented
text.

## Frontend architecture

Questions: What are the modules? · What may import what? · What states can
the UI be in? · Where does data come from?

- A rendering-model decision (SSR, SPA, islands) → prose with its cost.
- Component nesting → `frontend`; an import rule with edges → `felogic`.
- The one screen that matters → `wireframe`.
- UI states, error and empty included → `state`.
- The data-fetch path → `sequence`. Routes with behaviour → `table`.
- Ends on: the rule a new screen must follow, then the open questions.

Trap: `c4` (usually one container; one box says nothing).

## Data flow / pipeline

Questions: Where does data come from and go? · Which stage loses or
changes data? · What shape is it at rest? · How fresh is it?

- Processes and stores → `dfd`; volumes as the story → `sankey`.
- Zones (bronze → silver → gold) → `block` with `layers`, one node per
  dataset with `tech` for format and retention.
- The shape at rest → `erd`. A replay or backfill an operator runs → `steps`.
- Freshness targets the team commits to → `slo`.
- Ends on: what a breached target freezes, and who decides to unfreeze.

Trap: `sequence` (a pipeline has no request/response pairing).

## State machine

Questions: What states exist? · What forces a transition? · What is illegal?

- States and transitions → `state`; guards and side effects per
  transition → `table`.
- A risky transition that callers observe → `sequence`.
- Illegal states that must stay illegal → `spec`.
- Ends on: the transitions still undecided, with owners.

Trap: `flow` (flows end; lifecycles loop back).

## Incident writeup

Questions: What happened, when? · Why did it break? · What did it cost? ·
What prevents recurrence?

- Open with the impact and the cause in two sentences. Present perfect is
  fine for a state that still holds ("has failed since 09:00").
- Detection to resolution with times → `timeline`.
- The failure mechanism, not the happy path → `sequence` or `flow`.
- Measured impact → `stats`.
- Ends on: the actions with owners and dates → `statustable`.

Traps: `scqa` (a postmortem argues with evidence, not narrative); a
`takeaways` block that restates the actions.

## ADR

Questions: What forced a decision? · What were the options? · What did we
accept by choosing?

- `meta.status` (`proposal`, `accepted`, `superseded`) and the decision
  date in `meta.updated`. A superseding ADR links the old one in its first
  sentence.
- The forcing fact, with a number → the opening.
- Candidates against criteria with a verdict each → `options`.
- Consequences both ways → `proscons`. Measured before/after → `benchmark`;
  one metric before/after across many rows → a dumbbell `chart`.
- Ends on: the follow-up work the decision creates → `statustable`, or,
  while it is a proposal, the open questions and who decides → `faq`.

Traps: `harvey` (only when criteria resist numbers); `scorecard` (weights
imply a precision most ADRs do not have); a `callout` that repeats the
decision the opening already states.

## API reference

Questions: What can I call? · What do errors look like? · How do calls
compose?

- An OpenAPI spec exists → `chiltepin sync openapi`, then edit the output.
- One card per operation → `endpoint`. A multi-call workflow → `sequence`.
- Error codes and what the client does → `table`. Domain terms → `glossary`.
- Ends on: the versioning or deprecation rule the integrator must plan for.

Traps: `packet` (binary protocols only); standalone `code` (snippets live
inside the endpoint cards).

## Runbook

Questions: What fired? · What is wrong? · What do I run? · Did it work? ·
How do I undo it? · Who do I call?

- The trigger: the alert name and the symptom, in the opening.
- Diagnosis → a `flow` from symptom to cause, one decision per check.
- The fix → `steps`, with exact commands and a verify step.
- Rollback → `steps` or one step, before the escalation.
- Ends on: the escalation — who to page, when, with what.

Trap: an architecture overview inside the runbook; link to it instead.

## Design system

Questions: Which tokens exist? · What does each style look like? · How do
we use a component? · How mature is each one?

- Colour tokens → `palette`; text styles → `typescale`.
- Usage rules per component → `dodont`.
- Component maturity → `inventory`.
- Ends on: how a new component gets in, and who approves it.

Trap: a `table` of hex values; the `palette` draws the swatches.
