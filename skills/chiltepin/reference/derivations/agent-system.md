# Derivation — invoice reconciliation agent

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## Reader, moment, decision

The billing lead and a platform engineer, in the production-approval
review. They decide one thing: does the agent go live for all carriers?

## Facts

- Our freight billing team receives 1,400 carrier invoice lines a week;
  about 30% disagree with the quoted rate.
- One agent handles one invoice line per episode, on one named model.
- Five named tools: `get_shipment`, `search_rate_card`,
  `get_invoice_history`, `post_proposal`, `escalate`.
- Memory: carrier correction history; verdicts on earlier lines.
- Limits: the agent escalates when no booking resolves, when the delta is
  over $400, or when the currencies differ. Finance chose the $400 line.
- A billing clerk approves every proposal. The agent's service account has
  no ledger credential.
- Eight weeks measured: six window segments in tokens; 68% of lines
  auto-proposed; 45 s of clerk time per line; 0.4% of proposals reversed.
- One real transcript, with a rate-card timeout and one retry.

## Outline, as the reader meets it

1. Opening: "The agent proposes a fix for 68% of disputed lines, and a
   clerk approves each one. In eight weeks, 0.4% of its proposals were
   reversed."
2. **One agent, five tools, and no ledger access** → `agentloop`. One
   agent and the reader asked how its loop behaves (`kit.md`).
3. **History is evicted first when the window fills** → `context`, six
   measured segments.
4. **A rate-card timeout costs one retry, not a wrong proposal** → `trace`,
   the real transcript with its failure.
5. **Clerks spend 45 s per line instead of reconciling it** → `stats`, with
   `better: down` on the clerk time.
6. **What the review decides** → `faq`: go live for all carriers or the top
   ten; keep the $400 line or raise it. Each question names who answers it.

## Cut, and why

- `prompt` — the request gave no prompt text. An invented prompt is slop.
- `sequence` — the trace already shows the order of one episode.
- A `flow` for the three escalation rules — one sentence holds them.

## Other facts, other shape

- A second agent (a dispute writer) or a router → `agentloop` drops out.
  The workflow becomes a `flow` from the AI kit, with a hand-off edge.
- No transcript → no `trace`; ask the user for one run.
