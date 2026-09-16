```meta
title: Seven AI diagrams, seven questions
subtitle: The same support-automation system drawn seven ways. Each block answers one question; none of them is the fixed agent loop.
tag: EXAMPLE
```

The system answers customer questions. A triage agent classifies, a retriever pulls documentation, a model drafts, a checker grounds the draft, and a person approves anything that touches money. Each diagram below picks the block that answers its question.

## 1 · How does a question become an answer?

```flow
id: rag-flow
title: The RAG answer path
nodes:
  - { id: q, col: 1, row: 1, kind: start, label: Question arrives }
  - { id: triage, col: 2, row: 1, kind: agent, label: "Triage agent\nintent + urgency" }
  - { id: search, col: 3, row: 1, kind: tool, label: "Vector search\ntop-8 chunks" }
  - { id: draft, col: 4, row: 1, kind: llm, label: "Draft answer\nclaude-sonnet-4-6" }
  - { id: ground, col: 5, row: 1, kind: decision, label: Every claim cited? }
  - { id: approve, col: 6, row: 1, kind: human, label: "Support agent\napproves refunds" }
  - { id: sent, col: 7, row: 1, kind: end, label: Answer sent }
  - { id: history, col: 3, row: 2, kind: memory, label: "Case history\nlast 5 tickets" }
  - { id: escalate, col: 5, row: 2, kind: end, label: Escalate to human }
edges:
  - q -> triage
  - triage -> search: search query
  - search -> draft: chunks
  - history --> draft: context
  - draft -> ground
  - ground -> approve: "yes"
  - ground -x-> draft: "no · repair, max 3"
  - approve -> sent
  - triage -x-> escalate: legal or abuse
```

## 2 · Who hands off to whom?

```swimlane
id: handoff
title: Triage, billing, and the human desk
lanes: [Customer, Triage agent, Billing agent, Human desk]
phases:
  - { label: Classify, from: 1, to: 2 }
  - { label: Resolve, from: 3, to: 4 }
  - { label: Close, from: 5 }
steps:
  - ask: Asks about a charge · Customer · start
  - classify: Billing intent? · Triage agent · decision
  - lookup: Fetch invoice + charge · Billing agent
  - propose: Propose refund · Billing agent
  - approve: Approve over $200 · Human desk
  - reply: Reply with outcome · Customer · end
links:
  - ask -> classify
  - classify -> lookup: billing
  - classify -x-> approve: unclear
  - lookup -> propose
  - propose -> approve
  - approve --> reply: approved
```

## 3 · How does the writer improve its own output?

```cycle
id: repair-loop
title: Generate, check, repair
steps:
  - { label: Generate, desc: The model drafts an answer from the retrieved chunks. }
  - { label: Check, desc: A second model call scores grounding and tone against the sources. }
  - { label: Repair, desc: Failed claims go back with the checker's notes; three rounds at most. }
  - { label: Release, desc: A passing draft goes to the human gate, or straight out under $200. }
```

## 4 · What runs where?

```block
id: deployment
preset: infra
title: The services around the agents
groups:
  - { col: 1, row: 1, cols: 1, rows: 2, label: Channels }
  - { col: 2, row: 1, cols: 2, rows: 2, label: Agent runtime }
  - { col: 4, row: 1, cols: 1, rows: 2, label: Knowledge }
  - { col: 5, row: 1, cols: 1, rows: 2, label: Providers }
nodes:
  - { id: chat, col: 1, row: 1, kind: browser, name: Help widget }
  - { id: mail, col: 1, row: 2, kind: email, name: Inbound mail }
  - { id: orch, col: 2, row: 1, kind: agent, name: Orchestrator, tech: Node · queue worker }
  - { id: gate, col: 2, row: 2, kind: user, name: Human desk, tech: approval UI }
  - { id: tools, col: 3, row: 1, kind: service, name: Tool API, tech: invoices · orders }
  - { id: trace, col: 3, row: 2, kind: store, name: Trace store, tech: every turn logged }
  - { id: vec, col: 4, row: 1, kind: search, name: Vector index, tech: docs · 120k chunks }
  - { id: hist, col: 4, row: 2, kind: db, name: Case history, tech: Postgres }
  - { id: model, col: 5, row: 1, kind: llm, name: Model API, tech: Claude }
  - { id: embed, col: 5, row: 2, kind: external, name: Embeddings }
edges:
  - chat -> orch
  - mail -> orch
  - orch -> tools: calls
  - orch -> vec: retrieves
  - orch -> model: prompts
  - orch -> hist: reads
  - orch --> trace: logs
  - orch --> gate: escalates
  - vec --> embed: refreshes
```

## 5 · What does one agent's loop do?

```agentloop
id: triage-loop
title: The triage agent, one turn
agent:
  name: Triage agent
  model: claude-sonnet-4-6
  note: Classifies the ticket, calls tools, and either replies or escalates.
env: Ticket queue
tools:
  - { name: search_docs, desc: Top-8 documentation chunks for a query }
  - { name: get_account, desc: Plan, invoices, open orders }
  - { name: create_ticket, desc: Hand the case to the human desk }
memory:
  - case history · last five tickets
  - customer profile
stop: a reply is sent, or a ticket is created for a person
```

## 6 · What happens in one turn, in time?

```sequence
id: one-turn
title: One draft turn with a repair
actors:
  - { id: orch, name: Orchestrator }
  - { id: vec, name: Vector index }
  - { id: llm, name: Model API }
  - { id: chk, name: Checker }
messages:
  - orch -> vec: search(query)
  - vec --> orch: 8 chunks · 24k tokens
  - orch -> llm: draft(prompt, chunks)
  - llm --> orch: draft v1
  - orch -> chk: grounded?(draft, chunks)
  - chk --> orch: 2 claims uncited
  - orch -> llm: repair(draft, notes)
  - llm --> orch: draft v2
  - orch -> chk: grounded?(draft, chunks)
  - chk --> orch: pass
```

## 7 · Where do the tokens go?

```context
id: budget
title: One draft turn against a 200k window
window: 200000
segments:
  - { label: system prompt, tokens: 4000 }
  - { label: tool schemas, tokens: 6000 }
  - { label: case history, tokens: 12000 }
  - { label: retrieved chunks, tokens: 24000 }
  - { label: question + draft, tokens: 3000 }
```
