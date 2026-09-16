```meta
title: Orchestrator, critic, and guard
subtitle: Three agents with different jobs, and the checks between them, drawn as the workflow it is.
tag: EXAMPLE
```

The orchestrator owns the task. A guard screens what comes in and what goes out. A critic scores every draft against the sources and the policy, and sends failures back with notes. A person sees only what the critic and the guard both let through.

## The workflow

```flow
id: multi-agent
title: Request to release, with a critic and a guard
groups:
  - { col: 2, row: 1, cols: 1, rows: 3, label: Guard }
  - { col: 3, row: 1, cols: 3, rows: 2, label: Orchestration }
nodes:
  - { id: req, col: 1, row: 1, kind: start, label: Request }
  - { id: guardin, col: 2, row: 1, kind: agent, label: "Guard agent\nclaude-haiku-4-5" }
  - { id: orch, col: 3, row: 1, kind: agent, label: "Orchestrator\nclaude-sonnet-4-6" }
  - { id: plan, col: 3, row: 2, kind: llm, label: "Planner\nclaude-sonnet-4-6" }
  - { id: worker, col: 4, row: 1, kind: llm, label: "Worker\nclaude-sonnet-4-6" }
  - { id: search, col: 4, row: 2, kind: tool, label: "Retrieve\ndocs + tickets" }
  - { id: critic, col: 5, row: 1, kind: agent, label: "Critic agent\nclaude-opus-5" }
  - { id: mem, col: 5, row: 2, kind: memory, label: "Run memory\nplans · drafts · scores" }
  - { id: ok, col: 6, row: 1, kind: decision, label: Grounded and in policy? }
  - { id: guardout, col: 6, row: 2, kind: agent, label: "Guard agent\noutput scan" }
  - { id: human, col: 6, row: 3, kind: human, label: "Reviewer\nrefunds over $200" }
  - { id: done, col: 7, row: 1, kind: end, label: Released }
  - { id: reject, col: 2, row: 3, kind: end, label: Refused }
edges:
  - req -> guardin
  - guardin -> orch: safe request
  - guardin -x-> reject: policy violation
  - orch -> plan: task
  - plan -> search: queries
  - search -> worker: evidence
  - orch -> worker: instructions
  - worker -> critic: draft
  - critic -> ok: score + notes
  - ok -> guardout: "yes"
  - ok -x-> worker: "no · notes, max 3"
  - guardout -> done: clean
  - guardout --> human: needs approval
  - human -> done
  - critic --> mem: writes
  - mem --> orch: reads
```

Every draft passes the critic before the guard; the guard never sees an unscored draft, and the person never sees an unscanned one. Three critic rounds without a pass ends the run and files the notes.

## Who owns each step

```swimlane
id: ownership
title: Ownership across the run
lanes: [Guard, Orchestrator, Worker, Critic, Reviewer]
phases:
  - { label: Admit, from: 1 }
  - { label: Produce, from: 2, to: 3 }
  - { label: Judge, from: 4, to: 5 }
  - { label: Release, from: 6 }
steps:
  - screen: Screen the request · Guard · start
  - plan: Plan and delegate · Orchestrator
  - draft: Produce the draft · Worker
  - score: Score against sources and policy · Critic · decision
  - repair: Return notes for repair · Critic
  - scan: Scan the output · Guard
  - approve: Approve if over threshold · Reviewer · end
links:
  - screen -> plan
  - plan -> draft
  - draft -> score
  - score -x-> repair: fail
  - repair --> draft: notes
  - score -> scan: pass
  - scan --> approve: over $200
```
