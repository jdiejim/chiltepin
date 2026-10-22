```meta
title: Incident orchestrator
subtitle: Three subagents investigate each page in parallel, and no rollback or restart runs until the on-call engineer approves it.
tag: Explanation
status: example
```

A PagerDuty page becomes one diagnosis in the incident's Slack channel, and no agent changes production without the on-call engineer's approval. Each run stops at 10 tool rounds or 15 minutes, whichever comes first, and posts what it has.

## Three subagents investigate in parallel, and only a person can approve a change

The orchestrator on Opus plans the investigation and gives each Sonnet subagent one question. Because each subagent calls only its own tool, the three run at the same time and the slowest one sets the round.

```flow
id: run
title: One run of the orchestrator, from page to hand-off
nodes:
  - { id: page, kind: start, label: PagerDuty page }
  - { id: plan, kind: agent, label: "Orchestrator plans\nOpus" }
  - { id: logs, kind: agent, label: "Logs agent\nSonnet" }
  - { id: deploys, kind: agent, label: "Deploys agent\nSonnet" }
  - { id: runbooks, kind: agent, label: "Runbook agent\nSonnet" }
  - { id: merge, kind: agent, label: "Orchestrator merges\nOpus" }
  - { id: post, kind: process, label: Post diagnosis to Slack }
  - { id: action, kind: decision, label: Proposes an action? }
  - { id: policy, kind: guard, label: Action policy }
  - { id: oncall, kind: human, label: On-call engineer }
  - { id: argo, kind: tool, label: Argo CD }
  - { id: done, kind: end, label: Hand-off }
edges:
  - page -> plan: alert payload
  - plan -> logs: assigns question
  - plan -> deploys: assigns question
  - plan -> runbooks: assigns question
  - logs --> merge: findings + links
  - deploys --> merge: findings + links
  - runbooks --> merge: findings + links
  - merge -x-> plan: gaps · max 10 rounds
  - merge -> post: diagnosis
  - post -> action
  - action -> policy: rollback or restart
  - action -> done: diagnosis only
  - policy -> oncall: asks approval
  - oncall -> argo: approves
  - oncall -x-> done: rejects
  - argo -> done: action applied
```

When the findings leave a gap, the orchestrator sends the subagents out for another round. At 10 tool rounds or 15 minutes the run stops and posts the diagnosis it has, so a slow page still reaches Slack. Slack gets every diagnosis; only a proposed rollback or restart goes on to the guard.

## No subagent holds a write credential

The subagents read logs, deploy history, and runbooks, and they write nothing. The one path to production is the guard step in [the run](#run): the action policy opens it only after the on-call engineer approves in Slack.

```block
id: reach
title: What each agent can reach
groups:
  - { col: 2, row: 1, cols: 2, rows: 3, label: Agent runtime }
  - { col: 4, row: 1, cols: 1, rows: 3, label: Read only }
  - { col: 2, row: 4, cols: 2, rows: 1, label: Changes production }
nodes:
  - { id: pd, col: 1, row: 1, kind: monitor, name: PagerDuty }
  - { id: slack, col: 1, row: 2, kind: external, name: Incident channel, tech: Slack }
  - { id: oncall, col: 1, row: 3, kind: human, name: On-call engineer }
  - { id: orch, col: 2, row: 1, kind: agent, name: Orchestrator, tech: Claude Opus }
  - { id: logs, col: 3, row: 1, kind: agent, name: Logs agent, tech: Sonnet }
  - { id: deploys, col: 3, row: 2, kind: agent, name: Deploys agent, tech: Sonnet }
  - { id: runbooks, col: 3, row: 3, kind: agent, name: Runbook agent, tech: Sonnet }
  - { id: datadog, col: 4, row: 1, kind: tool, name: Log search, tech: Datadog API }
  - { id: github, col: 4, row: 2, kind: tool, name: Deploy history, tech: GitHub API }
  - { id: index, col: 4, row: 3, kind: vector, name: Runbook index }
  - { id: policy, col: 2, row: 4, kind: guard, name: Action policy }
  - { id: argo, col: 3, row: 4, kind: tool, name: Argo CD, tech: rollback · restart }
edges:
  - pd -> orch: pages with alert
  - orch -> logs: assigns question
  - orch -> deploys: assigns question
  - orch -> runbooks: assigns question
  - logs -> datadog: queries logs
  - deploys -> github: reads deploys
  - runbooks -> index: searches runbooks
  - orch -> slack: posts diagnosis
  - orch -> policy: proposes rollback
  - oncall -> policy: approves in Slack
  - policy -> argo: runs approved action
```

## Three questions to settle before the orchestrator takes real pages

The limits and the approval path work as drawn. Who owns them is still open.

```faq
items:
  - q: Who chose the 10-round and 15-minute caps, and who may change them?
    a: "Not decided. The SRE lead answers before the first production page."
    open: true
  - q: How does Slack show a diagnosis that stopped at a cap?
    a: "Not decided. The orchestrator owners propose a marker for an incomplete diagnosis."
  - q: Who approves a rollback when the on-call engineer does not answer?
    a: "Not decided. The incident commander rota is the candidate; the SRE lead decides."
```
