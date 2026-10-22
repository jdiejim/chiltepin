# Generation eval

End to end: a fresh agent, the installed skill, a working `chiltepin`, one request.
The agent runs the skill's loop in full — ground, plan, `chiltepin block`, write,
`chiltepin check`, `chiltepin review`, fix — and hands off. The scenarios in
`cases.yaml` span the block families and never name a block type.

It measures what the selection eval cannot: whether the whole loop produces
a document that validates, renders, and answers the question, and what it
costs. `evals/selection` scores only the pick. It replaces the former
`evals/write`, which scored a first draft with the CLI forbidden — that
number is now the **1st errors** column here.

## Run

1. Make a scratch project: `chiltepin.config.json`, an empty `docs/`, the skill
   copied to `.claude/skills/chiltepin/`, and `node_modules/chiltepin` linked to
   `packages/cli` of the build under test (so `npx -y chiltepin` resolves to
   it, not to npm). Build the CLI first.
2. For each case start a fresh agent with `PROMPT.md`, substituting the
   project path, the id, the request, and a run directory such as
   `.scratch/evals/gen-<date>/`. Record tokens, tool calls, and seconds from
   each task notification into `<run-dir>/usage.json` as
   `{ "<id>": { "tokens": N, "tools": N, "seconds": N } }`.
3. Score and report:

```
node evals/generate/score.mjs <project-dir> <run-dir>
node evals/generate/report.mjs <project-dir> <run-dir>   # → <run-dir>/report.html
```

Diagram quality, which the check-based score cannot see:

```
node evals/generate/quality.mjs <project-dir> <run-dir> [--cli <bin.js>] [--skill <dir>] [--cases <yaml>]
```

It renders each doc with the run's own CLI in headless Chromium (set
`CHILTEPIN_EVAL_CHROME` to a Chromium binary when Playwright's own build is
missing) and reports, per diagram: edges through a node, edge pairs sharing a
stretch of line, crossings, label collisions, and labels moved to a numbered
legend. It also scores fact recall for cases with `facts`, template echo
(diagram labels found verbatim in the skill or CLI examples but not in the
request), and the doc skeleton (docs that open with a callout, docs that use
`spec`, block-set similarity). `--cases` reads another case file, for example
one entry per repeated run of a case. `JUDGE.md` is the blind A/B judge prompt.

## Read the score

- **selection** — the first structural block that matches `expected` (1),
  `acceptable` (0.5), or `wrong` (0, a keyword trap).
- **1st errors** — `chiltepin check` errors on the draft copied before the agent
  ran any check. This is the skill's raw quality; the error codes say what
  the skill still teaches wrong.
- **final errors / warnings** — the handed-off document. Errors here mean
  the repair loop did not resolve every error.
- **structural blocks** — a size diagnostic; the skill suggests two to five for a full doc.
- **render** — the shipped renderer must not throw on any handed-off doc.
- **tokens / tools / time** — the cost of the whole loop.

The HTML report shows every document rendered, with the first-draft errors
the agent fixed and any diagnostics still open. Read the documents: a clean
check is necessary, not sufficient.

Keep the case set stable; add new cases at the end.

## Results

| Run | Selection | Traps | Clean first write | Clean at handoff | Render failures | Mean tokens | Mean time |
|---|---|---|---|---|---|---|---|
| `gen-2026-09-13` (skill at `skills/chiltepin`, `chiltepin block`) | 15.5/16 | 0 | 13/16 | 16/16 | 0 | 53K | 93 s |
| `gen-2026-09-13` + 7 messaging-pattern cases, re-scored after the comma rescue | 22.5/23 | 0 | 20/23 | 23/23 | 0 | 55K | 99 s |
| `gen-2026-09-13` + 15 coverage-sweep cases (13 new blocks, pareto and histogram chart kinds) | 37.5/38 | 0 | 32/38 | 38/38 | 0 | 54K | 91 s |
| `gen-2026-09-13` + 2 lens cases (swimlane, code) after the vary-the-lens rule | 39.5/40 | 0 | 33/40 | 40/40 | 0 | 55K | 91 s |

| `gen-2026-10-20-before` vs `gen-2026-10-21-after`: 14 diagram-heavy cases (10 existing + 4 fidelity cases), harness skill + router + hues + AI kit | 14/14 → 14/14 | 0 → 0 | 14/14 → 14/14 | 14/14 → 14/14 | 0 → 0 | 69.5K → 88.2K | 198 s → 362 s |

The October run added `quality.mjs` and blind judges. Old → new: edges
through a node 28 → 0, shared stretches 39 → 2, crossings 20 → 12, labels in
a numbered legend 169 → 2 (new docs measured with the final renderer), docs
opening with an assumptions callout 14 → 0, `spec` used 10 → 4. Blind A/B:
new preferred 10 of 14; mean fidelity 3.64 → 4.57, clarity 2.14 → 3.50,
structure 4.07 → 4.21, substance 4.50 → 4.36. Cost rose 27% (the render-and-
review step). Runs and judge files live in `.scratch/evals/`.

`orch-2026-10-21` ran the two orchestrator cases twice each, with a hand-built
reference (`docs/examples/orchestrator-agent.md`) scored by `--cases`. All 4
runs built the orchestrator from the kit (no `agentloop`), drew 21/21 named
parts on the detailed request, and handed off clean, at 106K to 126K tokens.
Geometry passed every diagram; reading the images found what it cannot
measure: a decision edge labelled "no" draws red on the normal path, sequence
actor subtitles overflow, state guards print without brackets, and agents
that split a wide flow after `shots` lost a loop or merged three subagents.
Both open runs invented the same vendor-security scenario.

For comparison, the September 1 write eval averaged 90K to 110K tokens and
12 to 22 tool calls per document with the previous skill layout.

Findings from the first run, all fixed the same day: the SKILL.md rewrite had
dropped the algorithms row (two-pointer picked `flow`); every first-write
error was an unquoted comma inside `{ … }` or a string where a list has no
terse form, so `chiltepin check` now names both; wide drawings shrank to
unreadable, state numerals sat on state boxes, gantt heads collided, and a
quadrant axis label clipped. The evening pass added the seven pattern cases
(pub/sub, feed fan-out, outbox, CQRS, dead-letter, partitioned consumers,
event contract) and showed the same comma trap in 11 of 13 first-draft
schema errors, so the parser now repairs it at the source line; first-write
clean on the same drafts moved from 17/23 to 20/23. The night pass added one
scenario per new block from the coverage sweep (`neuralnet`, `modelcard`,
`mindmap`, `audit`, `checklist`, `perfbudget`, `percentiles`, `threatmodel`,
`usecase`, `pkg`, `timing`, `chevrons`, `roadmap`) plus a pareto and a
histogram request: selection was 15/15 with no traps, 12/15 first drafts
were clean, all 15 rendered. The run's report is
`.scratch/evals/gen-2026-09-13/report.html`.
