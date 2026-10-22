# Chiltepin blocks — API reference

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Structure & emphasis — one contract card per operation
(`endpoint`) or per event (`eventcontract`) — plus Exchange at the byte
level (`packet`).
**Answers**: What can I call, with what, and what comes back? Who emits this
event, who consumes it, and what does the payload guarantee? What does the
wire carry, bit by bit?
**Not this family**: how calls compose over time → `sequence` (flows.md);
an error-code listing → `table` (tables-data.md); the API already has an
OpenAPI spec → generate the cards with `chiltepin sync openapi`.

### API reference

#### `endpoint` — a Swagger-style API endpoint card
One card per operation: method pill, path, parameters, body, responses, and
example request and response. Answers: what can I call, with what, and what
comes back? Only `method` and `path` are required.
For a whole spec, run `chiltepin sync openapi` instead of writing cards by hand.
`endpoint`, not `sequence`, for the contract of one call; `sequence` for how
calls compose over time.

#### `eventcontract` — an async event contract, the twin of endpoint
One card per event: a producers → consumers strip, delivery facts as chips,
and the payload table with the partition key marked. Answers: who emits
this, who consumes it, and what does the payload guarantee?
Only `name` is required. The card needs no title.
`eventcontract`, not `endpoint`, when the channel is a topic or queue and the
caller never waits for a reply.

#### `packet` — a wire format, bit by bit
A bit ruler across the top, then fields whose cell width is their bit count.
A field that overflows its row wraps and is marked `(cont.)`. The footer
totals bits and bytes. Answers: what does the wire carry, bit by bit?
`packet`, not `table`, when position and width on the wire are the point;
`table` for a field listing.
