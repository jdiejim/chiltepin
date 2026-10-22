# The diagram kit — nodes, edges, groups, focus

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this in step 4 (COMPOSE) before you write a `flow` or a `block`. It lists the
pieces and the rules that join them. It holds no finished diagram on purpose:
you build each diagram from the fact inventory of step 1.

## Five rules

1. **One node per component the request names.** Name it with the request's
   noun (`ledger-db`, `Refund agent`, `orders topic`). Never name it with its
   kind (`Database`, `Agent`, `Backend`). `chiltepin check` flags a
   placeholder name as `W_GENERIC_LABEL`.
2. **Set `kind` on every node.** The kind picks the glyph, the shape, and the
   hue of its family. Never set a colour on a node. Leave group `color`
   unset: the renderer gives each group its own hue.
3. **Let auto-layout place nodes.** Omit `col` and `row` on every node. Set
   them only when position carries meaning, and then on every node: a fixed
   tier order, or nodes inside `groups` (groups sit on grid cells).
4. **Use groups only for real boundaries**: a trust zone, a deploy unit (VPC,
   cluster, region), or an owner (a team, a vendor). A group that only
   decorates is noise, and an empty group warns (`W_EMPTY_GROUP`).
5. **One diagram answers one question.** When it answers two, write two
   diagrams. The density check warns at the caps (`W_DENSE_BLOCK`).

Set `dir: TB` when the main path has more than five nodes in a row. Also set
it when the reader thinks top to bottom: a request that falls through tiers,
or pipeline stages. Keep one direction per diagram.

## Edges

| Write | Draws | Use it for |
|---|---|---|
| `a -> b: verb phrase` | solid | a call, a write, a hand-off that the sender waits on |
| `a --> b: verb phrase` | dashed | async or optional: an event, a background job, a reply, a cache fill |
| `a -x-> b: verb phrase` | error | a failure, reject, timeout, or repair path |

`block` also takes `kind: forbidden` for a path that must not exist (a
network zone rule). The label says what crosses the edge, in two to four
words of the request's terms: `retrieves top-5 chunks`, `drafts reply`,
`redacts PII`, `publishes order.placed`. Never write `uses`, `calls`, or
`data`. The out-edges of a decision are its answers: `yes` / `no`,
`pass` / `fail`, or the name of each route (`W_DECISION_LABEL`).

Only `-x->` draws as an error. A `no` on the normal path stays `->`: "Score
late? no" leads to the next step, not to a failure. Draw one edge per real
hand-off; a second identical edge warns (`W_DUP_EDGE`). An error edge never
ends at a success node (`W_ERROR_INTO_SUCCESS`), and every node needs an
edge (`W_ORPHAN_NODE`).

## Node kinds — by hue

`kind` is a free string. A known kind gets its glyph and its family hue; an
unknown kind draws a neutral card with the word as its chip, so pick the
closest known kind. `chiltepin block block` prints this list as a field note.

| Hue | Family | Kinds |
|---|---|---|
| blue | compute | `service` `worker` `function` `host` `vm` `pod` `deployment` `scheduler` `cronjob` `ci` `monitor` `analytics` `tool` |
| green | network and security | `gateway` `lb` `proxy` `cdn` `dns` `waf` `auth` `ingress` `region` `guard` (`guardrail`, `policy`) |
| amber | state | `db` `cache` `bucket` `warehouse` `lake` `search` `shard` `replica` `registry` `git` `secrets` `config` `memory` `vector` (`embeddings`) |
| teal | messaging | `queue` `topic` `stream` `producer` `consumer` `webhook` `email` `sms` |
| violet | AI | `agent` `llm` (`model`) `eval` (`judge`, `grader`) `prompt` |
| rose | people | `client` `user` `users` `browser` `mobile` `device` `human` (`reviewer`) |
| none | external | `external` — anything you do not run |

The AI kit borrows hues by what a piece is: a `tool` is compute, `memory`
and `vector` are state, a `guard` is security, a `human` is a person.
`agent` and `llm` draw `tech` as the model chip. Vendor names map to their
kind: `postgres` `mysql` `mongo` `dynamo` → db, `s3` → bucket, `sqs`
`rabbitmq` → queue, `kafka` `kinesis` → stream, `redis` `memcached` → cache,
`elasticsearch` `opensearch` → search. Put the vendor or version in `tech`,
not in the name. `replicas: N` draws N instances of one node.

`flow` adds its own control kinds: `start` and `end` (the trigger, and each
way the run can finish), `process` (a deterministic step), and `decision`
(a branch whose out-edges carry the answers).

## Focus — mark the one thing the heading claims

Hue says what a thing is; focus says which thing matters. Mark the one item
the section heading claims, once. Mark nothing when the heading claims no
single item. `accent` is not a colour: on exactly one item it marks the
focus, and `red` marks the bad item.

| Block | Focus field | Mark |
|---|---|---|
| `options` | `tone: chosen` | the chosen option; the others `rejected` or `viable` |
| `benchmark` | subject `featured: true` | the subject the doc is about |
| `harvey` | `recommend` | the recommended column |
| `swimlane` | step `accent: true` | the step the heading names |
| `code` | `highlight` | the lines the prose talks about |
| `table` | column or cell `highlight` | the one column or cell that answers |
| `chevrons` | `current` | where the work stands; `accent: red` on a failed step |
| `timeline` · `rollout` · `roadmap` | `status: current` | the phase in progress |
| `array` · `linkedlist` · `bintree` · `hashmap` | `tone: active` / `target` | the pointer, and what it looks for |
| `chart` · `treemap` · `sankey` · `slopegraph` · `percentiles` · `timing` · `packet` · `venn` · `mindmap` | `accent` on one item | the item the heading names; `accent: red` on the bad one |
| `context` | `accent: red` | only the segment that breaks the budget |
| `drivers` · `list` · `gallery` · `persona` · `team` · `archmap` · `bignumber` · `divider` · `spec` · `takeaways` | `accent` | omit it: these cards draw no per-item focus |
| `flow` · `sequence` · `spans` · `block` · `c4` · `erd` · `gitgraph` | none | the renderer picks: the success end, the caller's answer, the critical path, the entry, the aggregate root, the trunk |

An `accent` on every item marks nothing: the renderer ignores it.

## Composing AI systems

Read the request for five things. Each one becomes nodes; each hand-off
becomes an edge.

- **Who acts**: each agent role and each model call → `agent` / `llm`.
- **What they call**: each named tool or API → `tool`.
- **What they read and write**: each index, store, or log → `memory`
  (`vector` in `block`).
- **What stops a bad output**: each check or judge → `guard` / `eval`.
- **Where a person decides**: each approval or review → `human`.

Use `flow` when the question is control: order, branches, retries, the stop.
Use `block` when the question is deployment: where each piece runs, which
store it reads, which boundary it crosses. Use `swimlane` when several
owners (agents or teams) share the steps.

The patterns below are vocabulary, not pictures. Real systems combine them —
RAG with a guard and a human gate is common. Draw only the parts the request
has, with the count of nodes the request has.

| Pattern | Nodes it needs | Edges that make it that pattern | Trap |
|---|---|---|---|
| RAG | the answering `llm`; the index as `memory` / `vector`; a query-rewrite `llm` only if the request has one | question → index: retrieves; index → model: grounds; model → answer | drawing retrieval inside the model node |
| Router | a `decision` or a classifier `llm`; one node per route the request names | one out-edge per route, labelled with the route; a fallback edge only if the request has one | inventing routes the request does not list |
| Multi-agent hand-off | one `agent` per role | `hands off <artifact>`; a return edge only if work comes back | one agent with many tools when the roles are separate |
| Planner, workers, reviewer | planner `agent`; one node per worker *kind*; reviewer `eval` or `agent` | planner → worker: assigns; worker → reviewer: submits; reviewer `-x->` planner: rejects | one node per worker instance |
| Generate, check, repair | generator `llm`; checker `guard` or `eval`; a `decision` on the result | fail `-x->` generator: repairs with errors; pass → `end`; a give-up `end` after the retry cap | a loop with no exit |
| Guardrails | a `guard` before the input, after the output, or both | the failing edge `-x->` to an `end` or a `human` | a guard with no failing edge checks nothing |
| Human gate | a `human` node at the decision point | approve → next step; reject `-x->` back or to an `end` | a human node with no reject edge |
| One agent with its tools | an `agent`; one `tool` per named tool | calls → tool; result `-->` agent | this is the `agentloop` frame |

**`agentloop` is one fixed picture**: environment, one agent, its tools, its
memory. Choose it only when the reader asks how one agent's loop behaves.
Several agents, a router, a retrieval step, a guard, an eval, or a human
gate are a `flow` or a `block` built from the nodes above. This rule lives
here only; the other files point to it.

## Splitting a diagram

Split a flow at a hand-off, never inside a loop. Draw the loop once, whole,
then zoom into one step in a second block: the first diagram shows the
mechanism, the second shows what one step does. Each half keeps its own
start and end, and the second names the step it zooms into in its `title`.
Never split a diagram to make it fit when a shorter label or `dir: TB` fits.

## When `review` reports `fit`, or `check` reports `W_FIT` or `W_GEOMETRY`

The drawing scrolls or shrinks hard on the page, two nodes share one cell,
an edge cannot avoid a node, or a label has no room. The hint names the
nodes and a fix. Change the data, then run it again:

| Block | Fit fix, in order |
|---|---|
| `flow` · `block` · `dfd` · `state` | remove `col`/`row`; set `dir: TB`; shorten the longest label to its verb phrase and move detail to `note` or `tech`; split at a hand-off |
| `c4` | keep one level per diagram; past 9 nodes, split into context and container |
| `sequence` | past 6 actors, split by phase; move detail from the arrow `label` to `summary` |
| `swimlane` | merge lanes that hold one step; band the columns with `phases`; split by phase |
| `erd` | past 8 entities, split by aggregate or `schema` |
| `spans` | one request per block |
| `table` · `matrix` · `heatmap` | past 6 columns, split the table or turn rows into columns |
| `gantt` · `roadmap` · `timeline` | coarser periods; one row per workstream, not per task |
| `chart` | shorter `labels`; fewer series; a `unit` instead of the unit in every value |

Never ask for coordinates in pixels, and never draw SVG: geometry belongs to
the renderer.
