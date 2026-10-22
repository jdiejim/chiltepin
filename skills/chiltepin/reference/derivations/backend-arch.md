# Derivation — seller payout engine

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## Facts from the request

- Our marketplace for used camera gear. The payout engine holds seller
  balances between charge capture and payout, and takes an 8% platform fee.
- Components: `marketplace-core` (outside the engine), `settler`,
  `payout-api`, `batcher` (all Go), `ledger-db` (Postgres 16), and the
  external acquirer.
- Interactions: `charge.captured` over Kafka; journals posted over SQL;
  transfers created over REST; status webhooks back over HTTPS.
- About 38,000 SEPA transfers a day, in a 14:00–14:40 UTC window.
- Constraint: a regulator can ask for any seller's balance on any past
  date. Every movement is a double-entry journal; balances are derived.
- Failure: the acquirer times out; the batcher retries with the same
  `transfer_id`, and the acquirer deduplicates on it.
- Owners: Payments Core and Money Movement.

Reader: an engineer who reviews a change to the payout engine. Their next
action is to approve or block that change.

## From fact to claim heading

Read alone, the headings make the case that the engine is safe to change.

| Fact | Heading (the claim) | Block |
|---|---|---|
| Kafka between checkout and the engine | Checkout never waits on the payout engine | `c4` (container), every edge with a protocol |
| Balances are derived from journals | No balance column exists to drift | `erd` of journals, entries, transfers |
| Retry with the same `transfer_id` | A timed-out transfer is retried, never sent twice | `sequence` of the 14:00 run, timeout included |
| Two teams | Payments Core owns the ledger; Money Movement owns the run | `table` |

The opening: "The payout engine moves about 38,000 SEPA transfers a day in
a 40-minute window, and a timeout can never pay a seller twice. Balances
are derived from journals, so any past balance can be rebuilt for a regulator."

## The last section

A reviewer needs the rule a change must not break. The doc ends on it:
"Every money movement is one balanced journal; a database trigger rejects
an unbalanced one." Then the one open question — who approves a change to
the trigger — with its owner.

## Left out

- `block` (`preset: infra`) — the request gave no deployment facts.
- `uml` — class detail is the code's job.

## What would change the shape

- Regions or accounts → a `block` with `preset: infra` and a group per real
  boundary.
- A slow-tail complaint with traces → `spans` for the batch run.
