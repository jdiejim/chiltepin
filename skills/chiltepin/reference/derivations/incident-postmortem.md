# Derivation — duplicate campaign sends

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## Evidence in the request

- Our email platform sends about 62 million campaign emails a day; workers
  consume send-batch jobs from a queue.
- Cause: a config refactor dropped the send queue's 15-minute visibility
  override; the new default was 60 s, and batch jobs run 90 s.
- Mechanism: the broker redelivered in-flight jobs. Workers read the send
  ledger before the send but wrote it only after the ESP accepted.
- Eight timestamped events, 14:12 to 15:03 UTC. Support tickets came three
  minutes before the pager.
- Impact: 1.9M duplicates (3.1% of the day), 41 minutes, 214 campaigns,
  3.1× unsubscribes.
- Four actions with owners, dates, and status.

Readers: engineering leadership, who approve the actions, and the four
owners, who carry them out.

## Order of the sections, and why

Leadership reads the impact first, so the doc leads with the number.

1. Opening: "A config refactor cut the send queue's visibility timeout to
   60 s, and 1.9M campaign emails went out twice in 41 minutes. Batch jobs
   run 90 s, so the broker redelivered every job still in flight."
2. **1.9M customers got the same campaign twice** → `bignumber`, with
   3.1% of the day and the unsubscribe multiple as its context.
3. **The ledger was written after the send, so it could not stop a
   redelivery** → `sequence`. The failure is an order of messages.
4. **Support saw it three minutes before the pager** → `timeline`, eight
   events. Prose says why detection was the slow half.
5. **Four fixes, each with an owner and a date** → `statustable`. The doc
   ends here: it asks leadership to approve these four.

One number carries the story, so a `bignumber` replaces a `stats` row.

## Left out

- `takeaways` — they would restate the four actions.
- `scqa` — a postmortem argues from evidence, not from narrative.
- `fishbone` — there was one cause chain, not branching causes.

## What would change the shape

- Several contributing causes → `fishbone` before the mechanism.
- A trace of the slow path exists → `spans` instead of `sequence`.
- The incident is still open → status prose in the present perfect ("sends
  have duplicated since 14:12"), and the doc ends on the next update time.
