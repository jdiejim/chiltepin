# Designing systems — the design method & the architecture blocks

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this for any architecture or design ask.

## Designing a system — reason it, don't template it

"Design an X" asks (a notification system, a rate limiter, "how would you build Y
at scale") are where templating shows worst. Every real system's document
is shaped by *its* bottleneck. Do the design reasoning; each step emits the block
that carries it:

1. **Requirements — ask, then pin them down.** Functional (what it does) and
   non-functional (scale, latency, consistency, durability). If the user gave no
   scale or constraints, **ask back** (step 1 of the loop in `SKILL.md`;
   checklists in `intake.md`). Emit `drivers` when the requirements carry
   consequences — each driver a real requirement, never a platitude.
2. **Envelope math.** Users × actions × fan-out → QPS, storage/day, peak factor.
   Emit `envelope`: the givens, one row per derivation step, and the bottom
   line the design must meet. Use `stats` only for measured numbers. Skip the
   step when scale is not the story.
3. **Contract.** The API surface (`endpoint` per route that matters) and the data
   model (`erd`). These fix the names every later block reuses.
4. **High level, shaped by the dominant motion.** Request/reply system → `c4`;
   one request through DNS, load balancer, cache, database and queue → `block`
   with numbered `step`s (below); things flowing through stages → `block`
   (`preset: event`) or `dfd`;
   deployment/regions/zones → `block` (`preset: infra`); a k8s estate →
   `cluster`. One overview diagram of the whole system, using the real names
   from step 3.
5. **Deep-dive the bottleneck — this is where documents differ.** Work out what
   actually breaks at the stated scale, and design *that* section:
   - hot reads → caching + invalidation (a `sequence` of the miss path)
   - write spikes → queue + backpressure (a `flow` with the shed path)
   - fan-out → push vs pull (`options`, then the chosen `sequence`)
   - cross-service consistency → outbox or saga (a `saga` with `failAt` on
     the step that fails, or a `state` of the outbox row)
   - geo-latency → replication + CDN (a `preset: infra` `block` per region)
   - a latency budget → `spans` of the slow path, or a waterfall `chart`

   One or two deep dives, chosen by the numbers from step 2 — never a fixed list.
6. **Trade-offs on the record.** The genuine alternatives as `options` (with
   `tone: chosen` on the winner), or `proscons` when only one option's tension
   matters. A design doc with no rejected alternative wasn't a decision.
7. **Failure & operations.** What breaks, the blast radius, how it degrades: a
   `table` of failure modes → responses, `kind: error`/`forbidden` edges on the
   diagrams, a `flow` of the degradation path.
8. **What happens next.** The doc ends here: the open decisions with who
   decides each (`faq`), and the follow-up work with owners (`statustable`).
   A `timeline` of phases comes before them only when the request has dates.

**Patterns are ingredients, not the meal.** When a named pattern is load-bearing
(pub-sub, saga, circuit breaker, CQRS, …), write it as a `pattern` card plus
one structure diagram that fits it (`block` for system patterns, `felogic` or
`uml` for code patterns, `flow`/`state`/`sequence` for agent patterns). Then
**name every node in the user's domain**: a card whose participants are still
"ServiceA" was pasted, not designed. Comparing patterns side by side → a
`gallery` with a nested `pattern`/diagram per cell.

The outline that falls out of steps 1-8 differs per system. A rate limiter's doc
is mostly steps 4-6 with algorithmic depth (`state`, `code`). A social feed's is
dominated by step 5 fan-out math, a payments integration by step 7 failure
semantics. **If two of your design docs share the same section list, you skipped
step 5.**

## Architecture views — one overview, then one zoom

`blocks/architecture.md` picks between `c4`, `block` (and its presets
`infra`, `event`, `ddd`, `network`, `k8s`), and `cluster`; `kit.md` has the
node kinds, edges, and fit fixes. Show the whole system once (`c4` context,
or a `block` landscape), then zoom into the one or two places the doc is
about: `felogic` for a module's internals, a `preset: infra` `block` or
`cluster` for deployment, a `sequence` for the runtime of one path. Never
redraw the same boxes in a second engine. Stitch the levels with prose and
a link: "inside [the `api` container](#context): …".

## The request diagram — number the steps, name the paths

A system-design diagram tells one request: the client resolves DNS, the load
balancer picks a server, the server reads the cache, a miss goes to a replica.
Draw it as a `block` and number the edges, so the prose can say "in step 4 the
API reads the cache".

- `step: N` on an edge draws a circled numeral just before its label. Number
  one request 1, 2, 3 in the order it happens. The terse form is
  `- 4. api -> cache: GET link`.
- Give a step only to the edges the prose walks. Replication, metrics and
  cleanup edges carry no step.
- When two requests share the diagram, give each edge `path: read` or
  `path: write`. Each path draws in its own hue, its numerals too, and the
  legend names it. Keep one count across both paths (read 1–5, write 6–9), so
  each number appears once. Use no `path` when the diagram tells one request.
- A hop that both requests take (browser to load balancer) is two edges, one
  per path. The renderer stacks their labels.
- An error edge stays red on any path.
- Walk the steps by number in the prose: what happens, its latency, and what
  fails there. A step with nothing to say joins a range ("steps 1–3 resolve and
  route the request").

The kind picks the silhouette. `db` is a cylinder, `replica` and `shards` are
sets of cylinders, `cache` is a memory card, `queue`, `topic` and `stream` are
pipes, `cdn` and `external` are clouds, `lb` and `gateway` are the bar, and
`worker` is a card with a gear. Only `replicas: N` draws a pile of cards: use
it for N copies of one server, never to mark a cache.

Lay the grid out left to right in five columns or fewer: clients, the edge
(DNS, CDN, load balancer), the app servers, then the data stores. Put the
queue and its workers under the app tier.

```block
title: Short-link redirect — the read path
nodes:
  - { id: web, col: 1, row: 2, kind: browser, name: Browser }
  - { id: dns, col: 1, row: 1, kind: dns, name: DNS, tech: Route 53 }
  - { id: lb, col: 2, row: 2, kind: lb, name: Load balancer, tech: ALB }
  - { id: api, col: 3, row: 2, kind: server, name: redirect-api, tech: Go, replicas: 4 }
  - { id: cache, col: 4, row: 1, kind: cache, name: link cache, tech: Redis }
  - { id: ro, col: 4, row: 3, kind: replica, name: links replicas, tech: Postgres }
edges:
  - 1. web -> dns: resolve sho.rt
  - 2. web -> lb: GET /aB3x
  - 3. lb -> api
  - 4. api -> cache: GET link
  - 5. api -> ro: on miss
```
