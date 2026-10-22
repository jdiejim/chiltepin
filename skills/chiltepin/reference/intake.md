# Intake checklists — what to ask before writing

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Use
this in step 1 (GROUND) of the loop, for every new document.

## The reader first

Every inventory starts with three facts: who reads the doc, at what moment,
and what they decide or do next. The reader sets the first block.

| Reader | Their moment | Lead with |
|---|---|---|
| Executive or sponsor | a decision meeting | the answer, its cost, and the risk |
| On-call engineer | an alert at 3 am | symptom → action, then the escalation |
| Engineer who changes the system | a design review or a first change | the mechanism, then where it breaks |
| Integrator | writing the client code | the endpoint, the payload, the error codes |
| New joiner | week one | who to ask, the one path they will touch, the words |

When the request names no reader, pick the one whose next action the
request implies, and say so in one clause of the opening.

## Limits

For each limit the request names (80 ms, 3 repairs, 15 min, $400), find
two facts: what happens when it is hit, and who chose it. Draw the first as
an edge or a step. State the second in the sentence. When the request does
not say, the limit is an open question with an owner: put it in the closing
`faq` or `statustable`, not in a caveat.

## The ask-back protocol

1. **Identify the document type.** Match the ask to a checklist below. No
   match → fall back to the four generic questions: reader and moment · job ·
   scope · form.
2. **Diff the checklist against the ask and the files.** Note which items
   the user or the files already answer — never ask for something you have.
3. **Ask everything at once.** Ask for every missing **CRITICAL** item in ONE
   batched message of 2-6 pointed questions — never drip one question per turn.
   Fold in a nice-to-have only when its answer would change the outline.
4. **If the user is unavailable** (or the gaps are minor), proceed. Mark
   each invented value once, where the reader acts on it: in the block's
   `note`, or one inline "(assumed)". When most specifics are invented, say
   so once in the opening and set `meta.status: example`. Each missing fact
   the reader needs becomes an open question with an owner in the last
   section. Never collect caveats in a closing list, and never open with an
   assumptions `callout`.
5. **Leave out what you cannot ground.** A block with no fact behind it —
   an invented transcript, prompt, metric, or owner — is slop. Drop the
   block, or ask for the fact.

Each checklist marks items **CRITICAL** (the document is wrong without them)
vs *nice-to-have* (improves it, but safely assumable).

Raw tabular data? Ask for the export, never a screenshot, and import it
with `chiltepin sync csv <file>`.

## API / endpoint spec

- **CRITICAL** — the routes + methods to document (all of them, or which subset?).
- **CRITICAL** — the auth model: scheme, token type, scopes/permissions per route.
- Request/response examples — real payloads beat invented ones.
- Error codes and what each means to the caller.
- Rate limits (per key? per IP? headers exposed?).
- Versioning scheme (URL, header, none).

## System design

- **CRITICAL** — functional requirements: what must the system do, for whom?
- **CRITICAL** — scale numbers: DAU, writes/day, reads/day, data size and growth.
- **CRITICAL** — latency and consistency targets (p95/p99; strong vs eventual, where).
- Existing stack and constraints (languages, cloud, what's already built).
- Budget envelope (infra spend, buy-vs-build appetite).
- Team size and skill mix (shapes how much operational complexity is affordable).

## Agent system

- **CRITICAL** — the model(s) used, and where in the loop.
- **CRITICAL** — the tools: each tool's name and what it actually does.
- **CRITICAL** — stop conditions: when does the loop end, and what bounds it?
- Memory strategy (none, scratchpad, vector store, summaries — and eviction).
- One real transcript of a representative episode (for the `trace` block).
- Eval criteria — how is "it works" measured?
- Guardrails: input/output filtering, permissioning, human-in-the-loop points.

## Architecture overview / onboarding

- **CRITICAL** — the system inventory: the services/components and one line each.
- **CRITICAL** — the one key request path a new joiner will touch most.
- Owners — which team/person owns each piece.
- Deploy topology (where it runs: regions, clusters, environments).

## Runbook

- **CRITICAL** — the trigger: which alert/symptom puts you in this runbook?
- **CRITICAL** — the exact commands to run, verbatim (no "restart the service" hand-waving).
- **CRITICAL** — the verification step: how do you know it worked?
- Access needed (VPN, roles, break-glass credentials) before you start.
- Escalation path — who to page when the runbook doesn't resolve it.
- Rollback — how to undo the intervention if it makes things worse.

## ADR

- **CRITICAL** — the options actually considered (not a padded strawman list).
- **CRITICAL** — the deciding constraint: which force actually picked the winner?
- **CRITICAL** — status: proposed, accepted, superseded?
- Consequences observed so far (if the decision already shipped).

## Roadmap

- **CRITICAL** — the horizon (quarter? half? year?).
- **CRITICAL** — the milestones and what "done" means for each.
- **CRITICAL** — current status per milestone/phase.
- Owners per workstream.
- Dependencies between items (and on other teams).

## Design system

- **CRITICAL** — the token source: actual color values, type sizes/weights, spacing.
- **CRITICAL** — the component list with a status per component (stable/beta/…).
- Usage rules — the do/don't guidance per token or component.
- Contribution process — how a new component gets in.

## Deck

- **CRITICAL** — the audience (engineers? leadership? customers?).
- **CRITICAL** — the time slot (5 minutes and 30 need different decks).
- **CRITICAL** — the decision sought — what should the room say yes to?
- The 3 numbers that matter (the exhibits hang off them).
- Appendix depth — how much backup material to prepare.

## Data model

- **CRITICAL** — the entities and their relationships (with cardinality).
- **CRITICAL** — lifecycle states: which records have a state machine, and what is it?
- Volumes per table (rows now, growth rate).
- Retention — what gets deleted/archived, and when.

## Postmortem / incident

- **CRITICAL** — the timeline: detection → mitigation → resolution, with times.
- **CRITICAL** — the impact: who/what was affected, how badly, for how long.
- **CRITICAL** — the root cause (the real one, not the first symptom).
- Action items with owners (and due dates if agreed).

## Reviewing an existing doc

When asked to review (not write) a doc, run `chiltepin review <file>`, then
walk step 6 of the loop in `SKILL.md` as the reader. Report findings worst
first, and quote each diagnostic and each `review` line verbatim. Also flag:

- Two blocks that draw the same boxes, or three tables in a row where one
  wants to be a `matrix`, `list`, or diagram.
- A block with fewer than ~3 rows or nodes: fold it into prose.
- Stale counts, versions, dates, and statuses (`timeline`, `statustable`,
  `inventory`), even when you cannot verify the correction.

Fix only what you were asked to fix.
