# Derivation — sync engine decision record

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The reader and the decision

An engineer, a year later, asks why manuscript sync is a CRDT. They decide
whether a new feature can build on it.

## What the request gives

- Our co-writing app. In March, 23% of active manuscripts had two or more
  writers in one hour; last-writer-wins overwrote 31 reported edits.
- "Lost my changes" is the top support tag. A ghostwriter and an editor
  often edit one scene at once, so the fix must allow concurrent edits.
- Three options with verdicts: section locking, an OT server, CRDT (Yjs).
- Measured four weeks either side of the rollout: lost-edit tickets, sync
  p50, load p95, storage per manuscript.
- Budgets set before rollout: load p95 500 ms, storage 300 KB. The platform
  lead owns both.
- Cost: 83 KB more per manuscript × 120,000 manuscripts.

## The opening, written before any block

"We replaced last-writer-wins with a CRDT (Yjs), so two writers can edit
one scene at once. In March, 23% of active manuscripts had concurrent
writers and 31 reported edits were overwritten." `meta.status: accepted`;
the decision date goes in `meta.updated`.

## Headings that make the argument

| Heading | Block | The fact that picked it |
|---|---|---|
| Locking blocks the editor; OT needs a server we would run alone | `options` | Three real candidates, each with a verdict; `tone: chosen` on Yjs. |
| A CRDT trades 83 KB per manuscript for zero overwrites | `proscons` | The winner's consequences, both ways. |
| Lost edits fell to zero; load p95 rose but stays under 500 ms | `benchmark` | Four measured metrics before and after, with the better direction. |
| Two numbers reopen this decision | `statustable` | The two budgets, each with its owner and current value. |

Prose under the second heading carries the storage math: under $1 a month.

## How it ends

Not with a summary. The last section names the two budgets that reopen the
decision, their current values, and the platform lead who watches them:
what the future reader checks before building on the CRDT.

## Left out

- `scorecard` — weights would claim a precision the team did not have.
- A "Decision" `callout` — the opening already states it.

## What would change the shape

- Still a proposal → `meta.status: proposal`, no `benchmark`, and the doc
  ends on the open questions and who decides (`faq`).
- Criteria that resist numbers → `harvey` instead of `options`.
