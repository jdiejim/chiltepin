# Chiltepin blocks — Algorithms & data structures

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Structure & emphasis — one data structure frozen at one step
(`array`, `linkedlist`, `bintree`, `hashmap`). One step per block; freeze a
moment, don't animate.
**Answers**: What does the structure hold at this step, and where do the
pointers stand?
**Not this family**: graph algorithms (BFS / DFS / Dijkstra) → `graph` with
node `state` + edge `weight` (charts-overviews.md); a file hierarchy →
`tree` (charts-overviews.md); control flow → `flow` (flows.md).

### Algorithms & data structures

All four blocks share one `tone` enum: `active` is the element under
examination, `visited` is processed, `target` is the goal, `muted` is out of
play. Quote numeric values (`value: "19"`); they are strings.

#### `array` — array cells for algorithm walkthroughs
A row of square cells, indices above, pointer labels (`lo`, `mid`) below.
Answers: where do the pointers stand at this step?
`window` outlines a 0-based inclusive index range.
`array`, not `table`, for binary search, two pointers, and sliding windows;
`table` for tabular data.

#### `linkedlist` — pointer-chain diagram
Boxed nodes joined by arrows; the chain ends in a ground symbol.
Answers: which node does each pointer hold during a reversal or insertion?
`kind: doubly` adds a back-arrow per link. Pointer labels render above.
`linkedlist`, not `flow`, for pointer manipulation; `flow` for control flow.

#### `bintree` — binary tree
Nodes placed by parent and side; a parent centres over its children, so an
unbalanced chain slants. Answers: which path does a search or traversal take?
Every node with a `parent` must set `side`. Two children on one side is a
schema error. Several parentless nodes draw as side-by-side roots (rotations).
`bintree`, not `tree`, for BSTs, heaps, and traversals; `tree` for file
hierarchies.

#### `hashmap` — buckets + chained entries
A column of bucket slots; entries in one bucket chain rightward in entry
order. Answers: where does each key land, and which keys collide?
An entry whose `bucket` is outside `0..buckets-1` is skipped, not clamped.
The render caps at 12 buckets; keep the count readable.
`hashmap`, not `table`, for hashing and collision walkthroughs; `table` for a
plain key-value listing.
