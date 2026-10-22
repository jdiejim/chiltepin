```meta
title: Support triage agent
subtitle: How the ticket-triage agent works — loop, prompts, budget, and evals.
tag: Agent system · v1
status: example
```

## Requirements

```drivers
id: agent-requirements
title: What the agent must do
items:
  - { title: Resolve or route, body: Answer from the KB or escalate to the right queue., tag: "JOB", icon: check, accent: green }
  - { title: Grounded answers, body: Every claim cites a KB article., tag: "GUARDRAIL", icon: shield, accent: purple }
  - { title: Bounded cost, body: "One episode stays under 40k tokens.", tag: "BUDGET", icon: bolt, accent: amber }
```

## The loop

```agentloop
id: agent-loop
title: Triage loop
agent:
  name: Triage agent
  model: claude-sonnet-4-6
  note: Routes each ticket to a fix or a human.
env: Customer
tools:
  - { name: search_kb, desc: Search help-center articles }
  - { name: get_account, desc: Look up plan and billing state }
  - { name: create_ticket, desc: Escalate to a human queue }
memory:
  - conversation history
  - customer profile
stop: reply sent or ticket escalated
```

## Prompt anatomy

```prompt
id: agent-prompt
title: Triage prompt
segments:
  - kind: system
    label: role + guardrails
    text: "You are a support agent for {{product}}. Answer only from KB articles; cite the article id."
  - kind: user
    text: "Customer ({{plan}} plan) writes: {{ticket}}"
vars:
  - { name: product, desc: Product name from config }
  - { name: plan, desc: Plan tier of the customer }
  - { name: ticket, desc: The inbound ticket body }
```

## Context budget

```context
id: agent-budget
title: Where one episode's window goes
window: 200000
segments:
  - { label: system prompt, tokens: 4000, accent: navy }
  - { label: tool schemas, tokens: 6000, accent: teal }
  - { label: KB retrieval, tokens: 18000, accent: amber }
  - { label: history, tokens: 12000, accent: purple }
```

## One turn, end to end

```sequence
id: agent-seq-turn
title: A tool-using turn
actors:
  - { id: User, name: Customer }
  - { id: Agent, name: Agent }
  - { id: KB, name: search_kb }
messages:
  - { from: User, to: Agent, label: ticket text, kind: sync }
  - { from: Agent, to: KB, label: "search_kb(query)", kind: sync }
  - { from: KB, to: Agent, label: top 3 articles, kind: response }
  - { from: Agent, to: User, label: cited reply, kind: response }
  - from: User
    to: Agent
    label: message
```

## A real episode

```trace
id: agent-episode
title: Password reset — one episode
turns:
  - role: user
    text: I never get the reset email.
  - role: assistant
    thinking: Could be a bounce — check delivery before blaming spam.
    text: Let me check our email logs.
  - role: tool
    tool: search_kb
    args: '{ "query": "reset email not delivered" }'
    result: "KB-142: bounced mail troubleshooting"
  - role: assistant
    text: "Your mailbox rejected the email (KB-142) — free up space and I will resend it."
```

## Eval results

```table
id: agent-evals
columns: [Eval, Target, Current]
rows:
  - [Resolution without escalation, "40%", "46%"]
  - [Citation accuracy, "99%", "98.7%"]
  - ["Tokens per episode (p95)", "40k", "31k"]
```
