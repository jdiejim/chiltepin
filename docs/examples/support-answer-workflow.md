```meta
title: Support answer workflow
subtitle: How a customer question becomes a sent answer — retrieval, the model, a grounding check, and a human gate.
tag: EXAMPLE
```

The workflow is drawn from the process, not from a template. Each step carries its kind: a tool, a model call, an autonomous agent, a store, or a person. The repair path goes back to the model, never to the customer.

## From question to answer

```flow
id: support-flow
title: Retrieval, draft, check, review
nodes:
  - { id: q, col: 1, row: 1, kind: start, label: Question arrives }
  - { id: triage, col: 2, row: 1, kind: agent, label: "Triage agent\nclassifies intent" }
  - { id: kb, col: 3, row: 1, kind: tool, label: "Search docs\ntop-8 chunks" }
  - { id: draft, col: 4, row: 1, kind: llm, label: "Draft answer\nclaude-sonnet-4-6" }
  - { id: check, col: 5, row: 1, kind: decision, label: Grounded in sources? }
  - { id: review, col: 6, row: 1, kind: human, label: "Support agent\napproves" }
  - { id: sent, col: 7, row: 1, kind: end, label: Answer sent }
  - { id: history, col: 3, row: 2, kind: memory, label: "Case history\nlast 5 tickets" }
  - { id: escalate, col: 5, row: 2, kind: end, label: Escalate to human }
edges:
  - q -> triage
  - triage -> kb: search query
  - kb -> draft: chunks
  - history --> draft: context
  - draft -> check
  - check -> review: "yes"
  - check -x-> draft: "no · repair, max 3"
  - review -> sent
  - triage -x-> escalate: billing dispute
```

The loop from the grounding check back to the model runs at most three times. A fourth failure escalates.

## Where the tokens go

```context
title: One draft turn
window: 200000
segments:
  - { label: system prompt, tokens: 4000 }
  - { label: case history, tokens: 12000 }
  - { label: retrieved chunks, tokens: 24000 }
  - { label: question + draft, tokens: 3000 }
```
