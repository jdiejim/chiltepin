# Messaging and event patterns — which blocks draw them

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this when the request is about events, queues, streams, fan-out, or making a
write reliable across two systems. Each pattern names the reader question,
the blocks that can answer it, and the trap. Keep a block only when the
request holds its facts: a `spec` needs real numbers or rules (timeouts,
attempts, keys, TTLs), never invented ones. Node names come from the
request, never from this page. Fields: `chiltepin block <type>`; node kinds
and edges: `kit.md`.

Three rules hold for every pattern here:

- Topology at rest is a `block` with `preset: event`. Producers are `kind:
  producer`, subscribers `kind: consumer`, brokers `kind: topic` (fan-out)
  or `kind: queue` (one taker), streams `kind: stream`. Let auto-layout
  place them; the topic reads as the hub because every edge meets it.
- One event's contract is an `eventcontract`, never a `table` row: it
  carries producers, consumers, delivery, ordering, the partition `key`,
  and retention, which is exactly what a consumer needs to be safe.
- Time and failure are `sequence` (async arrows `-->` for the broker hop,
  an `alt` frame for the failure branch) or `flow` (retry loops, decisions).
  A `block` shows who is wired to whom; it cannot show a retry.

## Publish / subscribe (fan-out to many)

Question: when X happens, who reacts, and does the producer know them?
Blocks: `block` (`preset: event`) with one `producer`, one `topic`, and
one `consumer` per subscriber the request names. The producer edge says
what it publishes; each topic edge says what that consumer does with it.
Then `eventcontract` for the event, and prose on delivery and ordering.
Trap: a `sequence` with one arrow per subscriber hides the point, which is
that the publisher has no arrows to them.


## Competing consumers (one taker wins)

Question: how does work spread across N workers, and how many times is a
message handled? Blocks: `block` (`preset: event`, a `queue` not a `topic`,
one worker node with `replicas: N`) → `spec` when the request states the
delivery and idempotency rules. Trap: drawing it as pub/sub; a queue
delivers each message once.

## Partitioned log and consumer group (streams)

Question: how does the stream scale, and what keeps order? Blocks: `block`
with a group for the topic and a group for the consumer group. Draw one
`queue` node per partition and one `consumer` per member, named as the
request names them. The partition key goes on the producer edge (`key =
order_id`). Then prose on what happens when a consumer joins or leaves. Trap: a `sequence`;
the question is placement, not time.


## Event-driven backbone (many producers, many consumers)

Question: what is the shape of the whole event system? Blocks: `block` in
`layers` mode (Producers · Backbone · Consumers) with one `topic` node in
the middle band → `table` of topics × producer × consumers × retention.
Trap: drawing every topic as a node; past four topics the table carries
it and the diagram shows the bands.

## Outbox (reliable publish after a commit)

Question: how do we never lose an event when the commit succeeds and the
publish fails? Blocks: `sequence` (API → DB writes row and outbox in one
transaction; relay polls outbox → broker; `alt` for the broker being
down) → `state` for the outbox row (pending → published → failed) → `spec`
for the invariants (same transaction, at-least-once, consumer idempotent).
Trap: a `block` alone; the pattern is an ordering of writes, so it needs
time.

## Dead-letter queue and retry (poison messages)

Question: what happens to a message that keeps failing, and who looks at
it? Blocks: `flow` (consume → process → ok / retry with backoff / after N
to the DLQ, `kind: error` on the DLQ edge) → `block` (`queue` → consumer
→ `DLQ` queue) → `table` of failure classes × action × owner. Trap: a
`sequence`; the loop and the threshold are decisions, not messages.

## CQRS (separate read and write models)

Question: why are reads and writes different shapes, and how does a write
reach the read side? Blocks: `block` (command side → write store → events
→ projector → read store → query side, `dfd` also works) → `sequence` for
one write and the eventual read → prose on the consistency lag and what
the UI does about it. Trap: an `erd` of the read model; the reader asked
for the split, not the columns.

## Event sourcing (append-only log)

Question: where is the truth, and how is current state rebuilt? Stack:
`block` (commands → aggregate → event store, `replay` dashed back,
projections subscribing) → `eventcontract` for one event → `spec` for
replay, snapshots, and schema evolution. Trap: a `state` machine of the
aggregate; the pattern is about storage, not lifecycle.

## Saga (multi-service undo)

Question: what happens when step three of five fails after steps one and
two committed? Blocks: `saga` (forward steps, compensation under each,
`failAt`) → `sequence` only if the message order between services is the
question → `table` of steps × compensation × idempotency key. Trap: a
`flow`; a saga's shape is steps with their undo, which `flow` cannot say.

## Scatter-gather

Question: how does one request fan out to N workers and come back as one
answer? Blocks: `block` (coordinator → workers group → aggregator) →
`sequence` with a `par` frame for the parallel calls and the timeout
branch → `spec` for the partial-result rule. Trap: `flow`; the parallelism
is the point and `par` draws it.

## Backpressure, retry, and circuit breaker

Question: what does the system do when a downstream slows or fails?
Blocks: `state` for the breaker (closed → open → half-open) or `flow` for
retry with backoff and the give-up exit → `spec` for the numbers
(timeout, attempts, backoff, jitter, trip threshold) → `sequence` only for
the one call that shows the breaker opening. Trap: prose only; the
numbers are the contract, and `spec` holds them.

## Change data capture and webhooks (events out of a store or to a partner)

Question: how do changes leave the database, or reach a partner, in
order and exactly once as far as they can tell? Blocks: `dfd` (table →
log → connector → topic → consumers) or `sequence` (producer → partner
endpoint, signed, retried, `alt` for 5xx) → `eventcontract` for the
payload → `spec` for signing, retry, and replay. Trap: an `endpoint`
block for a webhook; the partner's endpoint is not ours to document.

## Idempotency

Question: what happens when the same message or request arrives twice?
Blocks: `sequence` with the duplicate as a second message and an `alt`
frame (key seen → return stored result) → `spec` for the key, its scope,
and its TTL → `state` when the record itself moves (received → processed).
Trap: a `callout` only; the reader needs the exact key and window.
